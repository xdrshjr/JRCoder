/**
 * Custom error classes for OpenJRAgent
 */

import { ERROR_CODES } from '../constants';

/**
 * Base error class for all agent errors
 */
export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Configuration error
 */
export class ConfigError extends AgentError {
  constructor(message: string, details?: any) {
    super(`Configuration error: ${message}`, ERROR_CODES.CONFIG_ERROR, details, false);
  }
}

/**
 * Validation error
 */
export class ValidationError extends AgentError {
  constructor(message: string, details?: any) {
    super(`Validation error: ${message}`, ERROR_CODES.VALIDATION_ERROR, details, false);
  }
}

/**
 * Tool execution error
 */
export class ToolExecutionError extends AgentError {
  constructor(toolName: string, message: string, details?: any) {
    super(
      `Tool '${toolName}' execution failed: ${message}`,
      ERROR_CODES.TOOL_ERROR,
      { toolName, ...details },
      true
    );
  }
}

/**
 * LLM error
 */
export class LLMError extends AgentError {
  constructor(message: string, statusCode?: number, details?: any) {
    super(
      `LLM error: ${message}`,
      ERROR_CODES.LLM_ERROR,
      { statusCode, ...details },
      statusCode === 429 || statusCode === 503
    );
  }
}

/**
 * Storage error
 */
export class StorageError extends AgentError {
  constructor(message: string, details?: any) {
    super(`Storage error: ${message}`, ERROR_CODES.STORAGE_ERROR, details, true);
  }
}

/**
 * Security error
 */
export class SecurityError extends AgentError {
  constructor(message: string, details?: any) {
    super(`Security error: ${message}`, 'SECURITY_ERROR', details, false);
  }
}
