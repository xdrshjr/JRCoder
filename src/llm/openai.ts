/**
 * OpenAI LLM Client Implementation
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources';
import { BaseLLMClient } from './client';
import type {
  ILogger,
  LLMConfig,
  LLMRequest,
  LLMResponse,
  PricingInfo,
  ModelPricingMap,
} from './types';
import type { Message, ToolDefinition, ToolCall } from '../types';
import { LLMError } from '../core/errors';

/**
 * OpenAI model pricing (per 1000 tokens)
 */
const OPENAI_PRICING: ModelPricingMap = {
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-32k': { input: 0.06, output: 0.12 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-16k': { input: 0.001, output: 0.002 },
};

/**
 * OpenAI LLM Client
 */
export class OpenAIClient extends BaseLLMClient {
  private client: OpenAI;

  constructor(config: LLMConfig, logger: ILogger) {
    super(config, logger);

    // Initialize OpenAI client
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
    });
  }

  /**
   * Send a chat request to OpenAI
   */
  async chat(request: LLMRequest): Promise<LLMResponse> {
    this.validateRequest(request);
    this.logger.logLLMRequest(request);

    try {
      const response = await this.withRetry(async () => {
        return await this.client.chat.completions.create({
          model: this.config.model,
          messages: this.convertMessages(request.messages),
          tools: this.convertTools(request.tools),
          temperature: this.getEffectiveTemperature(request),
          max_tokens: this.getEffectiveMaxTokens(request),
          top_p: request.temperature !== undefined ? undefined : this.config.topP,
        });
      });

      const result = this.parseResponse(response);
      this.logger.logLLMResponse(result);

      return result;
    } catch (error) {
      this.logger.error('OpenAI chat request failed', error as Error);
      throw new LLMError(
        `OpenAI request failed: ${(error as Error).message}`,
        (error as any).status,
        { model: this.config.model }
      );
    }
  }

  /**
   * Send a streaming chat request to OpenAI
   */
  async *chatStream(request: LLMRequest): AsyncGenerator<string> {
    this.validateRequest(request);
    this.logger.logLLMRequest(request);

    try {
      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        messages: this.convertMessages(request.messages),
        tools: this.convertTools(request.tools),
        temperature: this.getEffectiveTemperature(request),
        max_tokens: this.getEffectiveMaxTokens(request),
        top_p: request.temperature !== undefined ? undefined : this.config.topP,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      this.logger.error('OpenAI streaming request failed', error as Error);
      throw new LLMError(
        `OpenAI streaming request failed: ${(error as Error).message}`,
        (error as any).status,
        { model: this.config.model }
      );
    }
  }

  /**
   * Convert internal messages to OpenAI format
   */
  private convertMessages(messages: Message[]): ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        const toolMsg = msg as any;
        // Support both toolCallId (camelCase) and tool_call_id (snake_case)
        const toolCallId = toolMsg.tool_call_id || toolMsg.toolCallId;
        return {
          role: 'tool',
          tool_call_id: toolCallId,
          content: msg.content,
        } as ChatCompletionMessageParam;
      }

      if (msg.role === 'assistant') {
        const assistantMsg = msg as any;
        // Support both toolCalls (camelCase) and tool_calls (snake_case)
        const toolCalls = assistantMsg.tool_calls || assistantMsg.toolCalls;
        if (toolCalls && toolCalls.length > 0) {
          return {
            role: 'assistant',
            content: msg.content || null,
            tool_calls: toolCalls.map((tc: ToolCall) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          } as ChatCompletionMessageParam;
        }
      }

      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      } as ChatCompletionMessageParam;
    });
  }

  /**
   * Convert internal tool definitions to OpenAI format
   */
  private convertTools(tools?: ToolDefinition[]): ChatCompletionTool[] | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.reduce(
            (acc, param) => {
              const paramDef: any = {
                type: param.type,
                description: param.description,
              };

              if (param.enum) {
                paramDef.enum = param.enum;
              }

              if (param.type === 'array') {
                paramDef.items = { type: 'string' };
              }

              acc[param.name] = paramDef;
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
   * Parse OpenAI response to internal format
   */
  private parseResponse(response: OpenAI.Chat.Completions.ChatCompletion): LLMResponse {
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
    } else if (choice.finish_reason === 'content_filter') {
      finishReason = 'error';
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
   * Get pricing information for the current model
   */
  protected getPricing(): PricingInfo {
    return (
      OPENAI_PRICING[this.config.model] ||
      OPENAI_PRICING['gpt-3.5-turbo'] || { input: 0.0005, output: 0.0015 }
    );
  }
}
