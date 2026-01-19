/**
 * Logger interfaces
 */

import type { LLMRequest, LLMResponse, ToolResult } from '../types';

/**
 * Logger interface
 */
export interface ILogger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: Error, data?: any): void;

  // Special logging methods
  logToolCall(toolName: string, args: any): void;
  logToolResult(toolName: string, result: ToolResult): void;
  logLLMRequest(request: LLMRequest): void;
  logLLMResponse(response: LLMResponse): void;

  // Create child logger with context
  child(context: Record<string, any>): ILogger;
}
