/**
 * Anthropic (Claude) LLM Client Implementation
 */

import Anthropic from '@anthropic-ai/sdk';
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
 * Anthropic model pricing (per 1000 tokens)
 */
const ANTHROPIC_PRICING: ModelPricingMap = {
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  'claude-2.1': { input: 0.008, output: 0.024 },
  'claude-2.0': { input: 0.008, output: 0.024 },
};

/**
 * Anthropic LLM Client
 */
export class AnthropicClient extends BaseLLMClient {
  private client: Anthropic;

  constructor(config: LLMConfig, logger: ILogger) {
    super(config, logger);

    // Initialize Anthropic client
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
    });
  }

  /**
   * Send a chat request to Anthropic
   */
  async chat(request: LLMRequest): Promise<LLMResponse> {
    this.validateRequest(request);
    this.logger.logLLMRequest(request);

    try {
      // Extract system message and convert other messages
      const { system, messages } = this.extractSystemMessage(request.messages);

      const params: any = {
        model: this.config.model,
        max_tokens: this.getEffectiveMaxTokens(request),
        messages: messages,
        temperature: this.getEffectiveTemperature(request),
      };

      // Add system message if present
      if (system) {
        params.system = system;
      }

      // Add tools if present
      if (request.tools && request.tools.length > 0) {
        params.tools = this.convertTools(request.tools);
      }

      const response = await this.withRetry(async () => {
        return await this.client.messages.create(params);
      });

      const result = this.parseResponse(response);
      this.logger.logLLMResponse(result);

      return result;
    } catch (error) {
      this.logger.error('Anthropic chat request failed', error as Error);
      throw new LLMError(
        `Anthropic request failed: ${(error as Error).message}`,
        (error as any).status,
        { model: this.config.model }
      );
    }
  }

  /**
   * Send a streaming chat request to Anthropic
   */
  async *chatStream(request: LLMRequest): AsyncGenerator<string> {
    this.validateRequest(request);
    this.logger.logLLMRequest(request);

    try {
      const { system, messages } = this.extractSystemMessage(request.messages);

      const params: any = {
        model: this.config.model,
        max_tokens: this.getEffectiveMaxTokens(request),
        messages: messages,
        temperature: this.getEffectiveTemperature(request),
        stream: true,
      };

      if (system) {
        params.system = system;
      }

      if (request.tools && request.tools.length > 0) {
        params.tools = this.convertTools(request.tools);
      }

      const stream = await this.client.messages.create(params);

      for await (const event of stream as any) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield event.delta.text;
          }
        }
      }
    } catch (error) {
      this.logger.error('Anthropic streaming request failed', error as Error);
      throw new LLMError(
        `Anthropic streaming request failed: ${(error as Error).message}`,
        (error as any).status,
        { model: this.config.model }
      );
    }
  }

  /**
   * Extract system message from messages array
   * Anthropic requires system message to be separate from other messages
   */
  private extractSystemMessage(messages: Message[]): {
    system?: string;
    messages: any[];
  } {
    const systemMsg = messages.find((m) => m.role === 'system');
    const otherMsgs = messages.filter((m) => m.role !== 'system');

    return {
      system: systemMsg?.content,
      messages: this.convertMessages(otherMsgs),
    };
  }

  /**
   * Convert internal messages to Anthropic format
   */
  private convertMessages(messages: Message[]): any[] {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        const toolMsg = msg as any;
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolMsg.toolCallId,
              content: msg.content,
            },
          ],
        };
      }

      if (msg.role === 'assistant') {
        const assistantMsg = msg as any;
        if (assistantMsg.toolCalls && assistantMsg.toolCalls.length > 0) {
          const content: any[] = [];

          // Add text content if present
          if (msg.content) {
            content.push({
              type: 'text',
              text: msg.content,
            });
          }

          // Add tool use blocks
          assistantMsg.toolCalls.forEach((tc: ToolCall) => {
            content.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          });

          return {
            role: 'assistant',
            content,
          };
        }
      }

      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      };
    });
  }

  /**
   * Convert internal tool definitions to Anthropic format
   */
  private convertTools(tools: ToolDefinition[]): any[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: tool.parameters.reduce((acc, param) => {
          acc[param.name] = {
            type: param.type,
            description: param.description,
            enum: param.enum,
          };
          return acc;
        }, {} as Record<string, any>),
        required: tool.parameters.filter((p) => p.required).map((p) => p.name),
      },
    }));
  }

  /**
   * Parse Anthropic response to internal format
   */
  private parseResponse(response: Anthropic.Messages.Message): LLMResponse {
    const toolCalls: ToolCall[] = [];
    let content = '';

    // Extract content and tool calls from content blocks
    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if ((block as any).type === 'tool_use') {
        const toolBlock = block as any;
        toolCalls.push({
          id: toolBlock.id,
          name: toolBlock.name,
          arguments: toolBlock.input as Record<string, any>,
        });
      }
    }

    // Determine finish reason
    let finishReason: LLMResponse['finishReason'] = 'stop';
    if (response.stop_reason === 'max_tokens') {
      finishReason = 'length';
    } else if ((response.stop_reason as any) === 'tool_use') {
      finishReason = 'tool_calls';
    } else if (response.stop_reason === 'end_turn') {
      finishReason = 'stop';
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  /**
   * Get pricing information for the current model
   */
  protected getPricing(): PricingInfo {
    return (
      ANTHROPIC_PRICING[this.config.model] ||
      ANTHROPIC_PRICING['claude-3-sonnet-20240229'] || { input: 0.003, output: 0.015 }
    );
  }
}
