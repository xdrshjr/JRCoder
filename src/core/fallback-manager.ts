/**
 * Fallback manager for graceful degradation
 */

import type { ILogger } from '../logger/interfaces';
import type { ILLMClient, LLMRequest, LLMResponse } from '../llm/types';
import type { BaseTool } from '../tools/base';
import type { ToolResult } from '../types';

/**
 * Fallback manager class
 */
export class FallbackManager {
  private logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  /**
   * Execute LLM request with fallback
   */
  async fallbackLLM(
    primaryClient: ILLMClient,
    fallbackClient: ILLMClient,
    request: LLMRequest
  ): Promise<LLMResponse> {
    try {
      this.logger.debug('Attempting primary LLM client');
      return await primaryClient.chat(request);
    } catch (error) {
      this.logger.warn('Primary LLM failed, using fallback', {
        error: (error as Error).message,
      });

      try {
        return await fallbackClient.chat(request);
      } catch (fallbackError) {
        this.logger.error('Fallback LLM also failed', fallbackError as Error);
        throw fallbackError;
      }
    }
  }

  /**
   * Execute LLM request with multiple fallbacks
   */
  async fallbackLLMChain(
    clients: ILLMClient[],
    request: LLMRequest
  ): Promise<LLMResponse> {
    if (clients.length === 0) {
      throw new Error('No LLM clients provided');
    }

    let lastError: Error | null = null;

    for (let i = 0; i < clients.length; i++) {
      try {
        this.logger.debug(`Attempting LLM client ${i + 1}/${clients.length}`);
        return await clients[i].chat(request);
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`LLM client ${i + 1} failed`, {
          error: (error as Error).message,
        });

        // Continue to next client if available
        if (i < clients.length - 1) {
          this.logger.info(`Trying next LLM client (${i + 2}/${clients.length})`);
        }
      }
    }

    // All clients failed
    this.logger.error('All LLM clients failed');
    throw lastError || new Error('All LLM clients failed');
  }

  /**
   * Execute tool with fallback
   */
  async fallbackTool(
    primaryTool: BaseTool,
    fallbackTool: BaseTool,
    args: Record<string, any>
  ): Promise<ToolResult> {
    try {
      this.logger.debug(`Attempting primary tool: ${primaryTool.name}`);
      return await primaryTool.execute(args);
    } catch (error) {
      this.logger.warn(
        `Primary tool '${primaryTool.name}' failed, using fallback '${fallbackTool.name}'`,
        { error: (error as Error).message }
      );

      try {
        return await fallbackTool.execute(args);
      } catch (fallbackError) {
        this.logger.error(
          `Fallback tool '${fallbackTool.name}' also failed`,
          fallbackError as Error
        );
        throw fallbackError;
      }
    }
  }

  /**
   * Execute multiple operations with partial failure tolerance
   */
  async toleratePartialFailure<T>(
    operations: Array<() => Promise<T>>,
    minSuccessRate: number = 0.5
  ): Promise<T[]> {
    if (operations.length === 0) {
      return [];
    }

    if (minSuccessRate < 0 || minSuccessRate > 1) {
      throw new Error('minSuccessRate must be between 0 and 1');
    }

    this.logger.debug(`Executing ${operations.length} operations with partial failure tolerance`, {
      minSuccessRate,
    });

    const results = await Promise.allSettled(operations.map((op) => op()));

    const successful = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    const successRate = successful.length / results.length;

    this.logger.info(
      `Operations completed: ${successful.length}/${results.length} succeeded`,
      { successRate }
    );

    if (successRate < minSuccessRate) {
      const errorMessages = failed
        .map((r) => (r as PromiseRejectedResult).reason?.message || 'Unknown error')
        .join('; ');

      throw new Error(
        `Too many failures: ${successful.length}/${results.length} succeeded (required: ${minSuccessRate * 100}%). Errors: ${errorMessages}`
      );
    }

    // Log failed operations
    if (failed.length > 0) {
      this.logger.warn(`${failed.length} operations failed`, {
        errors: failed.map((r) => (r as PromiseRejectedResult).reason?.message),
      });
    }

    return successful.map((r) => (r as PromiseFulfilledResult<T>).value);
  }

  /**
   * Execute operation with timeout and fallback
   */
  async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([operation(), timeoutPromise]);
    } catch (error) {
      if (fallback) {
        this.logger.warn('Operation timed out, using fallback', {
          timeout: timeoutMs,
        });

        try {
          return await fallback();
        } catch (fallbackError) {
          this.logger.error('Fallback also failed', fallbackError as Error);
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  /**
   * Execute operation with circuit breaker pattern
   */
  async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    options: {
      failureThreshold: number;
      resetTimeout: number;
      onOpen?: () => void;
      onClose?: () => void;
    }
  ): Promise<T> {
    // Simple circuit breaker implementation
    // In production, consider using a library like 'opossum'

    const state = {
      failures: 0,
      lastFailureTime: 0,
      isOpen: false,
    };

    if (state.isOpen) {
      const timeSinceLastFailure = Date.now() - state.lastFailureTime;

      if (timeSinceLastFailure < options.resetTimeout) {
        throw new Error('Circuit breaker is open');
      }

      // Try to close the circuit
      this.logger.info('Circuit breaker attempting to close');
      state.isOpen = false;
      state.failures = 0;
      options.onClose?.();
    }

    try {
      const result = await operation();

      // Success - reset failure count
      if (state.failures > 0) {
        this.logger.info('Circuit breaker reset after success');
        state.failures = 0;
      }

      return result;
    } catch (error) {
      state.failures++;
      state.lastFailureTime = Date.now();

      this.logger.warn(`Circuit breaker failure ${state.failures}/${options.failureThreshold}`);

      if (state.failures >= options.failureThreshold) {
        this.logger.error('Circuit breaker opened');
        state.isOpen = true;
        options.onOpen?.();
      }

      throw error;
    }
  }
}
