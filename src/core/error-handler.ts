/**
 * Error handler utility
 */

import { AgentError } from './errors';
import type { ILogger } from '../logger/interfaces';

export interface ErrorResponse {
  message: string;
  code: string;
  recoverable: boolean;
  details?: any;
}

export class ErrorHandler {
  /**
   * Handle error and return user-friendly response
   */
  static handle(error: Error, logger?: ILogger): ErrorResponse {
    if (error instanceof AgentError) {
      logger?.error(error.message, error, error.details);
      return {
        message: error.message,
        code: error.code,
        recoverable: error.recoverable,
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
      return error.recoverable;
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
