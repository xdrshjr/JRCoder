/**
 * Error handler with advanced error handling strategies
 */

import {
  AgentError,
  ErrorCategory,
  LLMTimeoutError,
  LLMRateLimitError,
} from './errors';
import type { ILogger } from '../logger/interfaces';
import type { AgentPhase } from '../types';

export interface ErrorResponse {
  message: string;
  code: string;
  recoverable: boolean;
  details?: any;
}

export interface ErrorContext {
  phase: AgentPhase;
  iteration: number;
  retryCount: number;
  taskId?: string;
  toolName?: string;
}

export interface ErrorHandlingResult {
  action: 'retry' | 'fallback' | 'skip' | 'fail' | 'abort';
  delay?: number;
  suggestion?: string;
  error: AgentError;
}

export interface ErrorHandlerConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

export class ErrorHandler {
  private logger: ILogger;
  private config: ErrorHandlerConfig;

  constructor(logger: ILogger, config: ErrorHandlerConfig) {
    this.logger = logger;
    this.config = config;
  }

  /**
   * Handle error with context and return handling strategy
   */
  async handle(
    error: Error,
    context: ErrorContext
  ): Promise<ErrorHandlingResult> {
    // Log error
    this.logger.error('Error occurred', error, context);

    // Normalize to AgentError
    const agentError = this.normalizeError(error);

    // Determine handling strategy based on error category
    switch (agentError.category) {
      case ErrorCategory.TRANSIENT:
        return this.handleTransientError(agentError, context);

      case ErrorCategory.RECOVERABLE:
        return this.handleRecoverableError(agentError, context);

      case ErrorCategory.PERMANENT:
        return this.handlePermanentError(agentError, context);

      case ErrorCategory.CRITICAL:
        return this.handleCriticalError(agentError, context);

      default:
        return { action: 'fail', error: agentError };
    }
  }

  /**
   * Normalize error to AgentError
   */
  private normalizeError(error: Error): AgentError {
    if (error instanceof AgentError) {
      return error;
    }

    // Infer error type from message
    if (error.message.includes('timeout')) {
      return new LLMTimeoutError(error.message);
    }

    if (error.message.includes('rate limit')) {
      return new LLMRateLimitError(error.message);
    }

    // Check for network errors
    const networkErrorCodes = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
    ];
    if (networkErrorCodes.some((code) => error.message.includes(code))) {
      return new AgentError(
        error.message,
        'NETWORK_ERROR',
        ErrorCategory.TRANSIENT,
        undefined,
        error
      );
    }

    // Default to permanent error
    return new AgentError(
      error.message,
      'UNKNOWN_ERROR',
      ErrorCategory.PERMANENT,
      undefined,
      error
    );
  }

  /**
   * Handle transient errors (retry)
   */
  private handleTransientError(
    error: AgentError,
    context: ErrorContext
  ): ErrorHandlingResult {
    // Check if we can retry
    if (context.retryCount < this.config.maxRetries) {
      const delay = this.calculateRetryDelay(context.retryCount, error);

      this.logger.info(
        `Transient error, will retry (${context.retryCount + 1}/${this.config.maxRetries})`,
        { delay, error: error.message }
      );

      return {
        action: 'retry',
        delay,
        error,
      };
    }

    // Exceeded max retries, treat as permanent
    this.logger.warn('Max retries exceeded, treating as permanent error');
    return { action: 'fail', error };
  }

  /**
   * Handle recoverable errors (fallback or skip)
   */
  private handleRecoverableError(
    error: AgentError,
    context: ErrorContext
  ): ErrorHandlingResult {
    // For tool execution errors, suggest fallback
    if (context.phase === 'executing' && context.toolName) {
      this.logger.info('Recoverable tool error, suggesting fallback');
      return {
        action: 'fallback',
        suggestion: `Try alternative approach for tool '${context.toolName}'`,
        error,
      };
    }

    // For other recoverable errors, skip
    this.logger.info('Recoverable error, skipping');
    return { action: 'skip', error };
  }

  /**
   * Handle permanent errors (fail)
   */
  private handlePermanentError(
    error: AgentError,
    _context: ErrorContext
  ): ErrorHandlingResult {
    this.logger.error('Permanent error, cannot recover', error);
    return { action: 'fail', error };
  }

  /**
   * Handle critical errors (abort immediately)
   */
  private handleCriticalError(
    error: AgentError,
    _context: ErrorContext
  ): ErrorHandlingResult {
    this.logger.error('Critical error, aborting immediately', error);
    return { action: 'abort', error };
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number, error: AgentError): number {
    const baseDelay = this.config.baseDelay;
    const maxDelay = this.config.maxDelay;

    // Check for rate limit with retry-after header
    if (error instanceof LLMRateLimitError && error.details?.retryAfter) {
      return error.details.retryAfter * 1000;
    }

    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 1000;

    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  /**
   * Handle error and return user-friendly response (static method for backward compatibility)
   */
  static handle(error: Error, logger?: ILogger): ErrorResponse {
    if (error instanceof AgentError) {
      logger?.error(error.message, error, error.details);
      return {
        message: error.message,
        code: error.code,
        recoverable: error.isRecoverable(),
        details: error.details,
      };
    }

    // Unknown error
    logger?.error('Unexpected error', error);
    return {
      message: error.message || 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      recoverable: false,
    };
  }

  /**
   * Log error with context
   */
  static log(error: Error, logger: ILogger, context?: Record<string, any>): void {
    if (error instanceof AgentError) {
      logger.error(error.message, error, { ...error.details, ...context });
    } else {
      logger.error(error.message, error, context);
    }
  }

  /**
   * Check if error is recoverable
   */
  static isRecoverable(error: Error): boolean {
    if (error instanceof AgentError) {
      return error.isRecoverable();
    }
    return false;
  }

  /**
   * Check if error is an AgentError
   */
  static isAgentError(error: any): error is AgentError {
    return error instanceof AgentError;
  }
}
