/**
 * Ollama Local LLM Client Implementation
 */

import { BaseLLMClient } from './client';
import type { ILogger, LLMConfig, LLMRequest, LLMResponse, PricingInfo } from './types';
import type { Message, ToolDefinition, ToolCall } from '../types';
import { LLMError } from '../core/errors';

/**
 * Ollama API response format (OpenAI-compatible)
 */
interface OllamaCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Ollama streaming chunk format
 */
interface OllamaStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

/**
 * Ollama LLM Client
 * Uses OpenAI-compatible API endpoint
 */
export class OllamaClient extends BaseLLMClient {
  private baseURL: string;

  constructor(config: LLMConfig, logger: ILogger) {
    super(config, logger);
    this.baseURL = config.baseURL || 'http://localhost:11434';
  }

  /**
   * Send a chat request to Ollama
   */
  async chat(request: LLMRequest): Promise<LLMResponse> {
    this.validateRequest(request);
    this.logger.logLLMRequest(request);

    try {
      const response = await this.withRetry(async () => {
        const res = await fetch(`${this.baseURL}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: this.convertMessages(request.messages),
            tools: this.convertTools(request.tools),
            temperature: this.getEffectiveTemperature(request),
            max_tokens: this.getEffectiveMaxTokens(request),
            stream: false,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }

        return (await res.json()) as OllamaCompletionResponse;
      });

      const result = this.parseResponse(response);
      this.logger.logLLMResponse(result);

      return result;
    } catch (error) {
      this.logger.error('Ollama chat request failed', error as Error);
      throw new LLMError(`Ollama request failed: ${(error as Error).message}`, undefined, {
        model: this.config.model,
        baseURL: this.baseURL,
      });
    }
  }

  /**
   * Send a streaming chat request to Ollama
   */
  async *chatStream(request: LLMRequest): AsyncGenerator<string> {
    this.validateRequest(request);
    this.logger.logLLMRequest(request);

    try {
      const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: this.convertMessages(request.messages),
          tools: this.convertTools(request.tools),
          temperature: this.getEffectiveTemperature(request),
          max_tokens: this.getEffectiveMaxTokens(request),
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const chunk: OllamaStreamChunk = JSON.parse(data);
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            // Skip invalid JSON
            continue;
          }
        }
      }
    } catch (error) {
      this.logger.error('Ollama streaming request failed', error as Error);
      throw new LLMError(
        `Ollama streaming request failed: ${(error as Error).message}`,
        undefined,
        { model: this.config.model, baseURL: this.baseURL }
      );
    }
  }

  /**
   * Convert internal messages to OpenAI-compatible format
   */
  private convertMessages(messages: Message[]): any[] {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        const toolMsg = msg as any;
        return {
          role: 'tool',
          tool_call_id: toolMsg.toolCallId,
          content: msg.content,
        };
      }

      if (msg.role === 'assistant') {
        const assistantMsg = msg as any;
        if (assistantMsg.toolCalls && assistantMsg.toolCalls.length > 0) {
          return {
            role: 'assistant',
            content: msg.content || null,
            tool_calls: assistantMsg.toolCalls.map((tc: ToolCall) => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          };
        }
      }

      return {
        role: msg.role,
        content: msg.content,
      };
    });
  }

  /**
   * Convert internal tool definitions to OpenAI-compatible format
   */
  private convertTools(tools?: ToolDefinition[]): any[] | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.reduce(
            (acc, param) => {
              acc[param.name] = {
                type: param.type,
                description: param.description,
                enum: param.enum,
              };
              return acc;
            },
            {} as Record<string, any>
          ),
          required: tool.parameters.filter((p) => p.required).map((p) => p.name),
        },
      },
    }));
  }

  /**
   * Parse Ollama response to internal format
   */
  private parseResponse(response: OllamaCompletionResponse): LLMResponse {
    const choice = response.choices[0];
    const message = choice.message;

    // Extract tool calls if present
    const toolCalls: ToolCall[] | undefined = message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    // Determine finish reason
    let finishReason: LLMResponse['finishReason'] = 'stop';
    if (choice.finish_reason === 'length') {
      finishReason = 'length';
    } else if (choice.finish_reason === 'tool_calls') {
      finishReason = 'tool_calls';
    }

    return {
      content: message.content || '',
      toolCalls,
      finishReason,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Get pricing information for local models (free)
   */
  protected getPricing(): PricingInfo {
    return { input: 0, output: 0 };
  }
}
