/**
 * Test helper utilities
 * Provides mock objects and helper functions for testing
 */

import {
  GlobalConfig,
  ILogger,
  ILLMClient,
  LLMRequest,
  LLMResponse,
  BaseTool,
  ToolResult,
  ToolDefinition,
  ToolParameter
} from '@/types';

/**
 * Test helper class with utility methods
 */
export class TestHelpers {
  /**
   * Create a mock LLM client with predefined responses
   */
  static createMockLLMClient(responses: LLMResponse[]): ILLMClient {
    let callCount = 0;

    return {
      chat: jest.fn(async (request: LLMRequest): Promise<LLMResponse> => {
        const response = responses[callCount] || responses[responses.length - 1];
        callCount++;
        return response;
      }),
      chatStream: jest.fn(async function* () {
        yield 'mock stream';
      }),
      estimateCost: jest.fn((tokens: number) => tokens * 0.00001)
    };
  }

  /**
   * Create a mock tool for testing
   */
  static createMockTool(name: string, result: ToolResult): BaseTool {
    return {
      name,
      description: `Mock tool: ${name}`,
      parameters: [] as ToolParameter[],
      dangerous: false,
      execute: jest.fn(async () => result),
      validate: jest.fn(() => ({ valid: true, errors: [] })),
      getDefinition: jest.fn((): ToolDefinition => ({
        name,
        description: `Mock tool: ${name}`,
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }))
    } as any;
  }

  /**
   * Create a test configuration with optional overrides
   */
  static createTestConfig(overrides?: Partial<GlobalConfig>): GlobalConfig {
    const defaultConfig: GlobalConfig = {
      agent: {
        maxIterations: 5,
        enableReflection: true,
        requireConfirmation: false,
        autoSave: false,
        saveInterval: 60000
      },
      llm: {
        planner: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 4096,
          timeout: 60000
        },
        executor: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.3,
          maxTokens: 4096,
          timeout: 120000
        },
        reflector: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          temperature: 0.5,
          maxTokens: 2048,
          timeout: 60000
        }
      },
      tools: {
        enabled: ['file_read', 'file_write', 'file_list'],
        workspaceDir: '/tmp/test-workspace',
        maxFileSize: 1024 * 1024,
        allowedExtensions: ['.js', '.ts', '.txt', '.json'],
        shellTimeout: 30000,
        shellMaxBuffer: 1024 * 1024
      },
      logging: {
        level: 'error',
        outputDir: '/tmp/test-logs',
        enableConsole: false,
        enableFile: false,
        maxFileSize: 1024 * 1024,
        maxFiles: 1,
        format: 'json'
      },
      cli: {
        theme: 'dark',
        showProgress: false,
        confirmDangerous: false,
        colorOutput: false,
        verboseErrors: false
      },
      storage: {
        type: 'memory',
        snippetDir: '/tmp/test-snippets',
        sessionDir: '/tmp/test-sessions'
      }
    };

    return this.deepMerge(defaultConfig, overrides || {});
  }

  /**
   * Create a test logger that doesn't output anything
   */
  static createTestLogger(): ILogger {
    return {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      logToolCall: jest.fn(),
      logToolResult: jest.fn(),
      logLLMRequest: jest.fn(),
      logLLMResponse: jest.fn(),
      child: jest.fn(function(this: ILogger) {
        return this;
      })
    };
  }

  /**
   * Wait for a condition to be true
   */
  static async waitFor(
    condition: () => boolean,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (!condition()) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for condition');
      }
      await this.sleep(interval);
    }
  }

  /**
   * Sleep for a specified duration
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Deep merge two objects
   */
  static deepMerge<T>(target: T, source: Partial<T>): T {
    const output = { ...target };

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  }

  /**
   * Check if value is an object
   */
  private static isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Create a mock LLM response
   */
  static createMockLLMResponse(
    content: string,
    options?: {
      toolCalls?: any[];
      finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
      usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    }
  ): LLMResponse {
    return {
      content,
      toolCalls: options?.toolCalls,
      finishReason: options?.finishReason || 'stop',
      usage: options?.usage || {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15
      }
    };
  }

  /**
   * Create a temporary directory for testing
   */
  static async createTempDir(): Promise<string> {
    const fs = require('fs-extra');
    const path = require('path');
    const os = require('os');

    const tempDir = path.join(os.tmpdir(), `openjragent-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
    return tempDir;
  }

  /**
   * Clean up temporary directory
   */
  static async cleanupTempDir(dir: string): Promise<void> {
    const fs = require('fs-extra');
    try {
      await fs.remove(dir);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}
