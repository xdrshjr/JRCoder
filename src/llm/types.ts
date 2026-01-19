/**
 * LLM Client Type Definitions
 */

import type {
  LLMConfig,
  LLMRequest,
  LLMResponse,
  ToolDefinition,
  Message,
} from '../types';

/**
 * LLM Client Interface
 */
export interface ILLMClient {
  /**
   * Send a chat request to the LLM
   */
  chat(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Send a streaming chat request to the LLM
   */
  chatStream(request: LLMRequest): AsyncGenerator<string>;

  /**
   * Estimate the cost of a request based on token count
   */
  estimateCost(tokens: number): number;
}

/**
 * Pricing information for a model
 */
export interface PricingInfo {
  input: number; // Cost per 1000 input tokens
  output: number; // Cost per 1000 output tokens
}

/**
 * Model pricing map
 */
export type ModelPricingMap = Record<string, PricingInfo>;

/**
 * Usage statistics
 */
export interface UsageStats {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  requestCount: number;
}

/**
 * LLM Client role type
 */
export type LLMClientRole = 'planner' | 'executor' | 'reflector';

/**
 * Logger interface for LLM clients
 */
export interface ILogger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: Error, data?: any): void;
  logLLMRequest(request: LLMRequest): void;
  logLLMResponse(response: LLMResponse): void;
  logToolCall(toolName: string, args: any): void;
  logToolResult(toolName: string, result: any): void;
}

/**
 * Sleep utility type
 */
export type SleepFunction = (ms: number) => Promise<void>;

export { LLMConfig, LLMRequest, LLMResponse, ToolDefinition, Message };
