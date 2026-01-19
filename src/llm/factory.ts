/**
 * LLM Client Factory
 * Creates appropriate LLM client instances based on provider configuration
 */

import type { ILLMClient, ILogger, LLMConfig } from './types';
import { OpenAIClient } from './openai';
import { AnthropicClient } from './anthropic';
import { OllamaClient } from './ollama';
import { ConfigError } from '../core/errors';

/**
 * Factory class for creating LLM clients
 */
export class LLMClientFactory {
  /**
   * Create an LLM client based on the provider configuration
   */
  static create(config: LLMConfig, logger: ILogger): ILLMClient {
    // Validate configuration
    this.validateConfig(config);

    // Create client based on provider
    switch (config.provider) {
      case 'openai':
        return new OpenAIClient(config, logger);

      case 'anthropic':
        return new AnthropicClient(config, logger);

      case 'ollama':
        return new OllamaClient(config, logger);

      default:
        throw new ConfigError(
          `Unsupported LLM provider: ${config.provider}`,
          { provider: config.provider }
        );
    }
  }

  /**
   * Validate LLM configuration
   */
  private static validateConfig(config: LLMConfig): void {
    if (!config.provider) {
      throw new ConfigError('LLM provider is required');
    }

    if (!config.model) {
      throw new ConfigError('LLM model is required');
    }

    // Validate API key for cloud providers
    if (config.provider === 'openai') {
      if (!config.apiKey && !process.env.OPENAI_API_KEY) {
        throw new ConfigError(
          'OpenAI API key is required. Set it in config or OPENAI_API_KEY environment variable.'
        );
      }
    }

    if (config.provider === 'anthropic') {
      if (!config.apiKey && !process.env.ANTHROPIC_API_KEY) {
        throw new ConfigError(
          'Anthropic API key is required. Set it in config or ANTHROPIC_API_KEY environment variable.'
        );
      }
    }

    // Validate temperature
    if (config.temperature !== undefined) {
      if (config.temperature < 0 || config.temperature > 2) {
        throw new ConfigError('Temperature must be between 0 and 2', {
          temperature: config.temperature,
        });
      }
    }

    // Validate maxTokens
    if (config.maxTokens !== undefined) {
      if (config.maxTokens < 1) {
        throw new ConfigError('maxTokens must be positive', {
          maxTokens: config.maxTokens,
        });
      }
    }

    // Validate timeout
    if (config.timeout !== undefined) {
      if (config.timeout < 1000) {
        throw new ConfigError('Timeout must be at least 1000ms', {
          timeout: config.timeout,
        });
      }
    }
  }

  /**
   * Check if a provider is supported
   */
  static isProviderSupported(provider: string): boolean {
    return ['openai', 'anthropic', 'ollama'].includes(provider);
  }

  /**
   * Get list of supported providers
   */
  static getSupportedProviders(): string[] {
    return ['openai', 'anthropic', 'ollama'];
  }
}
