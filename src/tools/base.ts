/**
 * Base tool class and interfaces
 */

import type {
  ToolParameter,
  ToolDefinition,
  ToolResult,
  ValidationResult,
} from '../types';

/**
 * Abstract base class for all tools
 */
export abstract class BaseTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: ToolParameter[];
  readonly dangerous: boolean = false;

  /**
   * Execute the tool with given arguments
   */
  abstract execute(args: Record<string, any>): Promise<ToolResult>;

  /**
   * Validate tool arguments
   */
  validate(args: Record<string, any>): ValidationResult {
    const errors: string[] = [];

    for (const param of this.parameters) {
      // Check required parameters
      if (param.required && !(param.name in args)) {
        errors.push(`Missing required parameter: ${param.name}`);
        continue;
      }

      // Check parameter type
      if (param.name in args) {
        const value = args[param.name];
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (actualType !== param.type && value !== null && value !== undefined) {
          errors.push(
            `Parameter '${param.name}' expected ${param.type}, got ${actualType}`
          );
        }

        // Check enum values
        if (param.enum && !param.enum.includes(value)) {
          errors.push(
            `Parameter '${param.name}' must be one of: ${param.enum.join(', ')}`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get tool definition for LLM Function Calling
   */
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
      dangerous: this.dangerous,
    };
  }

  /**
   * Build properties object for LLM schema
   */
  protected buildProperties(): Record<string, any> {
    return this.parameters.reduce(
      (acc, param) => {
        acc[param.name] = {
          type: param.type,
          description: param.description,
          enum: param.enum,
        };
        return acc;
      },
      {} as Record<string, any>
    );
  }

  /**
   * Get required parameter names
   */
  protected getRequiredParams(): string[] {
    return this.parameters.filter((p) => p.required).map((p) => p.name);
  }
}

/**
 * Interface for tool execution context
 */
export interface ToolContext {
  workspaceDir: string;
  maxFileSize: number;
  allowedExtensions: string[];
  shellTimeout: number;
  shellMaxBuffer: number;
}
