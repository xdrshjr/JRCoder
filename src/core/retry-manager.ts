/**
 * Retry manager with intelligent retry strategies
 */

import { AgentError } from './errors';
import type { ILogger } from '../logger/interfaces';

/**
 * Retry strategy types
 */
export type RetryStrategy = 'exponential' | 'linear' | 'fixed' | 'adaptive';

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  fixedDelay: number;
  strategy: RetryStrategy;
}

/**
 * Retry options for specific operations
 */
export interface RetryOptions {
  maxRetries?: number;
  strategy?: RetryStrategy;
}

/**
 * Retry manager class
 */
export class RetryManager {
  private logger: ILogger;
  private config: RetryConfig;

  constructor(logger: ILogger, config: RetryConfig) {
    this.logger = logger;
    this.config = config;
  }

  /**
   * Execute operation with retry logic
   */
  async withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const maxRetries = options.maxRetries ?? this.config.maxRetries;
    const strategy = options.strategy ?? this.config.strategy;

    let lastError: Error;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        if (retryCount > 0) {
          this.logger.info(`Retry attempt ${retryCount}/${maxRetries}`);
        }

        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry
        if (!this.shouldRetry(error as Error, retryCount, maxRetries)) {
          throw error;
        }

        // Calculate delay
        const delay = this.calculateDelay(retryCount, strategy, error as Error);

        this.logger.warn(`Operation failed, retrying in ${delay}ms`, {
          error: (error as Error).message,
          retryCount,
        });

        // Wait before retry
        await this.sleep(delay);

        retryCount++;
      }
    }

    throw lastError!;
  }

  /**
   * Check if error should be retried
   */
  private shouldRetry(error: Error, retryCount: number, maxRetries: number): boolean {
    // Exceeded max retries
    if (retryCount >= maxRetries) {
      return false;
    }

    // Check if error is retryable
    if (error instanceof AgentError) {
      return error.isRetryable();
    }

    // Default retryable error patterns
    const retryableErrors = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'timeout',
      'rate limit',
      '429',
      '503',
    ];

    return retryableErrors.some((pattern) =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Calculate delay based on strategy
   */
  private calculateDelay(retryCount: number, strategy: RetryStrategy, error?: Error): number {
    switch (strategy) {
      case 'exponential':
        return this.exponentialBackoff(retryCount);

      case 'linear':
        return this.linearBackoff(retryCount);

      case 'fixed':
        return this.config.fixedDelay;

      case 'adaptive':
        return this.adaptiveBackoff(retryCount, error);

      default:
        return this.exponentialBackoff(retryCount);
    }
  }

  /**
   * Exponential backoff with jitter
   */
  private exponentialBackoff(retryCount: number): number {
    const baseDelay = this.config.baseDelay;
    const maxDelay = this.config.maxDelay;
    const jitter = Math.random() * 1000;

    return Math.min(baseDelay * Math.pow(2, retryCount) + jitter, maxDelay);
  }

  /**
   * Linear backoff
   */
  private linearBackoff(retryCount: number): number {
    const baseDelay = this.config.baseDelay;
    const maxDelay = this.config.maxDelay;

    return Math.min(baseDelay * (retryCount + 1), maxDelay);
  }

  /**
   * Adaptive backoff based on error type
   */
  private adaptiveBackoff(retryCount: number, error?: Error): number {
    // Check for rate limit with retry-after
    if (error instanceof AgentError && error.details?.retryAfter) {
      return error.details.retryAfter * 1000;
    }

    // Check for rate limit in message
    const rateLimitMatch = error?.message.match(/retry after (\d+) seconds?/i);
    if (rateLimitMatch) {
      return parseInt(rateLimitMatch[1]) * 1000;
    }

    // Default to exponential backoff
    return this.exponentialBackoff(retryCount);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
