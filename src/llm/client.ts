/**
 * Base LLM Client Abstract Class
 */

import type {
  ILLMClient,
  ILogger,
  LLMConfig,
  LLMRequest,
  LLMResponse,
  PricingInfo,
} from './types';
import { LLMError } from '../core/errors';

/**
 * Sleep utility function
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Abstract base class for all LLM clients
 * Provides common functionality like retry logic and cost estimation
 */
export abstract class BaseLLMClient implements ILLMClient {
  protected config: LLMConfig;
  protected logger: ILogger;

  constructor(config: LLMConfig, logger: ILogger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Send a chat request to the LLM (must be implemented by subclasses)
   */
  abstract chat(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Send a streaming chat request to the LLM (must be implemented by subclasses)
   */
  abstract chatStream(request: LLMRequest): AsyncGenerator<string>;

  /**
   * Get pricing information for the current model (must be implemented by subclasses)
   */
  protected abstract getPricing(): PricingInfo;

  /**
   * Estimate the cost of a request based on token count
   */
  estimateCost(tokens: number): number {
    const pricing = this.getPricing();
    // Average cost (assuming 50/50 split between input and output)
    const avgCostPer1k = (pricing.input + pricing.output) / 2;
    return (tokens / 1000) * avgCostPer1k;
  }

  /**
   * Calculate actual cost based on usage
   */
  protected calculateCost(promptTokens: number, completionTokens: number): number {
    const pricing = this.getPricing();
    const inputCost = (promptTokens / 1000) * pricing.input;
    const outputCost = (completionTokens / 1000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * Retry logic with exponential backoff
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on the last attempt
        if (i === maxRetries - 1) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s...
        const delayMs = Math.pow(2, i) * 1000;
        this.logger.warn(
          `LLM request failed, retrying in ${delayMs}ms (attempt ${i + 1}/${maxRetries})`,
          { error: (error as Error).message }
        );

        await sleep(delayMs);
      }
    }

    // All retries failed
    throw new LLMError(
      `Request failed after ${maxRetries} attempts: ${lastError?.message}`,
      undefined,
      { originalError: lastError }
    );
  }

  /**
   * Check if an error is retryable
   */
  protected isRetryableError(error: any): boolean {
    // Retry on rate limit errors (429)
    if (error.status === 429 || error.statusCode === 429) {
      return true;
    }

    // Retry on service unavailable (503)
    if (error.status === 503 || error.statusCode === 503) {
      return true;
    }

    // Retry on timeout errors
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      return true;
    }

    // Don't retry on other errors
    return false;
  }

  /**
   * Validate request parameters
   */
  protected validateRequest(request: LLMRequest): void {
    if (!request.messages || request.messages.length === 0) {
      throw new LLMError('Request must contain at least one message');
    }

    if (request.temperature !== undefined) {
      if (request.temperature < 0 || request.temperature > 2) {
        throw new LLMError('Temperature must be between 0 and 2');
      }
    }

    if (request.maxTokens !== undefined) {
      if (request.maxTokens < 1) {
        throw new LLMError('maxTokens must be positive');
      }
    }
  }

  /**
   * Get effective temperature (from request or config)
   */
  protected getEffectiveTemperature(request: LLMRequest): number {
    return request.temperature ?? this.config.temperature ?? 0.7;
  }

  /**
   * Get effective max tokens (from request or config)
   */
  protected getEffectiveMaxTokens(request: LLMRequest): number {
    return request.maxTokens ?? this.config.maxTokens ?? 4096;
  }
}
