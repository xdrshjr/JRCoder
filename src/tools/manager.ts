/**
 * Tool manager for registering and executing tools
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { BaseTool } from './base';
import { CodeQueryTool } from './code-query';
import { FileReadTool, FileWriteTool, FileListTool } from './file-ops';
import { SnippetSaveTool, SnippetLoadTool, SnippetListTool } from './snippet';
import { ShellExecTool } from './shell';
import { AskUserTool } from './ask-user';
import type { ToolCall, ToolResult, ToolDefinition, GlobalConfig } from '../types';
import type { ISnippetStorage } from '../storage/interfaces';
import type { ILogger } from '../llm/types';
import { ToolExecutionError } from '../core/errors';

/**
 * Tool manager class
 */
export class ToolManager {
  private tools: Map<string, BaseTool> = new Map();
  private logger: ILogger;
  private config: GlobalConfig['tools'];
  private confirmDangerous: boolean;

  constructor(
    config: GlobalConfig['tools'],
    logger: ILogger,
    snippetStorage: ISnippetStorage,
    confirmDangerous: boolean = true
  ) {
    this.config = config;
    this.logger = logger;
    this.confirmDangerous = confirmDangerous;
    this.registerDefaultTools(snippetStorage);
  }

  /**
   * Register default tools
   */
  private registerDefaultTools(snippetStorage: ISnippetStorage): void {
    const allTools: BaseTool[] = [
      new CodeQueryTool(this.config.workspaceDir),
      new FileReadTool(this.config.workspaceDir, this.config.maxFileSize),
      new FileWriteTool(this.config.workspaceDir),
      new FileListTool(this.config.workspaceDir),
      new SnippetSaveTool(snippetStorage),
      new SnippetLoadTool(snippetStorage),
      new SnippetListTool(snippetStorage),
      new ShellExecTool(
        this.config.workspaceDir,
        this.config.shellTimeout,
        this.config.shellMaxBuffer
      ),
      new AskUserTool(),
    ];

    // Only register enabled tools
    for (const tool of allTools) {
      if (this.config.enabled.includes(tool.name)) {
        this.register(tool);
      }
    }
  }

  /**
   * Register a tool
   */
  register(tool: BaseTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' already registered`);
    }

    this.tools.set(tool.name, tool);
    this.logger.info(`Tool registered: ${tool.name}`);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): BaseTool {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolExecutionError(name, 'Tool not found');
    }
    return tool;
  }

  /**
   * Get all tool definitions for LLM
   */
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => tool.getDefinition());
  }

  /**
   * Execute a tool call
   */
  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.getTool(toolCall.name);

    // Validate arguments
    const validation = tool.validate(toolCall.arguments);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
      };
    }

    // Check for dangerous operations
    if (tool.dangerous && this.confirmDangerous) {
      const confirmed = await this.askConfirmation(toolCall);
      if (!confirmed) {
        return {
          success: false,
          error: 'Operation cancelled by user',
        };
      }
    }

    // Log tool call
    this.logger.logToolCall(toolCall.name, toolCall.arguments);

    // Execute tool
    const startTime = Date.now();
    try {
      const result = await tool.execute(toolCall.arguments);
      const executionTime = Date.now() - startTime;

      // Add execution time to metadata
      result.metadata = {
        ...result.metadata,
        executionTime,
      };

      // Log result
      this.logger.logToolResult(toolCall.name, result);

      return result;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Tool execution error: ${toolCall.name}`, error);

      return {
        success: false,
        error: error.message,
        metadata: { executionTime },
      };
    }
  }

  /**
   * Execute multiple tool calls in parallel
   */
  async executeMany(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    return Promise.all(toolCalls.map((call) => this.execute(call)));
  }

  /**
   * Ask user for confirmation of dangerous operation
   */
  private async askConfirmation(toolCall: ToolCall): Promise<boolean> {
    console.log(chalk.yellow(`\n⚠️  Dangerous operation: ${toolCall.name}`));
    console.log(chalk.gray(JSON.stringify(toolCall.arguments, null, 2)));

    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Continue?',
        default: false,
      },
    ]);

    return answer.confirmed;
  }

  /**
   * Get list of registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get workspace directory
   */
  getWorkspaceDir(): string {
    return this.config.workspaceDir;
  }
}
