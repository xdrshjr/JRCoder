/**
 * Custom error classes for OpenJRAgent
 */

import { ERROR_CODES } from '../constants';

/**
 * Error category enum
 */
export enum ErrorCategory {
  RECOVERABLE = 'recoverable', // 可恢复错误
  TRANSIENT = 'transient', // 临时错误（可重试）
  PERMANENT = 'permanent', // 永久错误
  CRITICAL = 'critical', // 严重错误（需立即终止）
}

/**
 * Base error class for all agent errors
 */
export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public category: ErrorCategory,
    public details?: any,
    public cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(): boolean {
    return (
      this.category === ErrorCategory.RECOVERABLE ||
      this.category === ErrorCategory.TRANSIENT
    );
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return this.category === ErrorCategory.TRANSIENT;
  }
}

/**
 * Configuration error
 */
export class ConfigError extends AgentError {
  constructor(message: string, details?: any) {
    super(
      `Configuration error: ${message}`,
      ERROR_CODES.CONFIG_ERROR,
      ErrorCategory.PERMANENT,
      details
    );
  }
}

/**
 * Validation error
 */
export class ValidationError extends AgentError {
  constructor(message: string, details?: any) {
    super(
      `Validation error: ${message}`,
      ERROR_CODES.VALIDATION_ERROR,
      ErrorCategory.PERMANENT,
      details
    );
  }
}

/**
 * Tool execution error
 */
export class ToolExecutionError extends AgentError {
  constructor(toolName: string, message: string, cause?: Error) {
    super(
      `Tool '${toolName}' execution failed: ${message}`,
      ERROR_CODES.TOOL_EXECUTION_ERROR,
      ErrorCategory.RECOVERABLE,
      { toolName },
      cause
    );
  }
}

/**
 * Tool not found error
 */
export class ToolNotFoundError extends AgentError {
  constructor(toolName: string) {
    super(
      `Tool '${toolName}' not found`,
      ERROR_CODES.TOOL_NOT_FOUND,
      ErrorCategory.PERMANENT,
      { toolName }
    );
  }
}

/**
 * Tool timeout error
 */
export class ToolTimeoutError extends AgentError {
  constructor(toolName: string, timeout: number) {
    super(
      `Tool '${toolName}' timed out after ${timeout}ms`,
      ERROR_CODES.TOOL_TIMEOUT,
      ErrorCategory.TRANSIENT,
      { toolName, timeout }
    );
  }
}

/**
 * LLM error
 */
export class LLMError extends AgentError {
  constructor(message: string, statusCode?: number, details?: any) {
    const category =
      statusCode === 429 || statusCode === 503
        ? ErrorCategory.TRANSIENT
        : ErrorCategory.PERMANENT;

    super(
      `LLM error: ${message}`,
      ERROR_CODES.LLM_ERROR,
      category,
      { statusCode, ...details }
    );
  }
}

/**
 * LLM timeout error
 */
export class LLMTimeoutError extends AgentError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.LLM_TIMEOUT, ErrorCategory.TRANSIENT, details);
  }
}

/**
 * LLM rate limit error
 */
export class LLMRateLimitError extends AgentError {
  constructor(message: string, retryAfter?: number) {
    super(
      message,
      ERROR_CODES.LLM_RATE_LIMIT,
      ErrorCategory.TRANSIENT,
      { retryAfter }
    );
  }
}

/**
 * LLM invalid response error
 */
export class LLMInvalidResponseError extends AgentError {
  constructor(message: string, details?: any) {
    super(
      message,
      ERROR_CODES.LLM_INVALID_RESPONSE,
      ErrorCategory.RECOVERABLE,
      details
    );
  }
}

/**
 * Storage error
 */
export class StorageError extends AgentError {
  constructor(message: string, details?: any) {
    super(
      `Storage error: ${message}`,
      ERROR_CODES.STORAGE_ERROR,
      ErrorCategory.RECOVERABLE,
      details
    );
  }
}

/**
 * Security error
 */
export class SecurityError extends AgentError {
  constructor(message: string, details?: any) {
    super(
      `Security error: ${message}`,
      ERROR_CODES.SECURITY_ERROR,
      ErrorCategory.CRITICAL,
      details
    );
  }
}

/**
 * File not found error
 */
export class FileNotFoundError extends AgentError {
  constructor(filePath: string) {
    super(
      `File not found: ${filePath}`,
      ERROR_CODES.FILE_NOT_FOUND,
      ErrorCategory.PERMANENT,
      { filePath }
    );
  }
}

/**
 * Permission denied error
 */
export class PermissionDeniedError extends AgentError {
  constructor(resource: string) {
    super(
      `Permission denied: ${resource}`,
      ERROR_CODES.PERMISSION_DENIED,
      ErrorCategory.PERMANENT,
      { resource }
    );
  }
}

/**
 * Network error
 */
export class NetworkError extends AgentError {
  constructor(message: string, details?: any) {
    super(
      `Network error: ${message}`,
      ERROR_CODES.NETWORK_ERROR,
      ErrorCategory.TRANSIENT,
      details
    );
  }
}
