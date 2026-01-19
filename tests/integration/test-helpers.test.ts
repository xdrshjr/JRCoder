/**
 * Integration tests for the test framework itself
 */

import { TestHelpers } from '../../utils/test-helpers';

describe('Test Helpers', () => {
  describe('createMockLLMClient', () => {
    it('should create mock client with responses', async () => {
      const responses = [
        TestHelpers.createMockLLMResponse('Response 1'),
        TestHelpers.createMockLLMResponse('Response 2')
      ];

      const client = TestHelpers.createMockLLMClient(responses);

      const result1 = await client.chat({ messages: [], temperature: 0.7 });
      const result2 = await client.chat({ messages: [], temperature: 0.7 });

      expect(result1.content).toBe('Response 1');
      expect(result2.content).toBe('Response 2');
    });

    it('should reuse last response when exhausted', async () => {
      const responses = [
        TestHelpers.createMockLLMResponse('Only response')
      ];

      const client = TestHelpers.createMockLLMClient(responses);

      const result1 = await client.chat({ messages: [], temperature: 0.7 });
      const result2 = await client.chat({ messages: [], temperature: 0.7 });
      const result3 = await client.chat({ messages: [], temperature: 0.7 });

      expect(result1.content).toBe('Only response');
      expect(result2.content).toBe('Only response');
      expect(result3.content).toBe('Only response');
    });

    it('should track call count', async () => {
      const responses = [TestHelpers.createMockLLMResponse('Response')];
      const client = TestHelpers.createMockLLMClient(responses);

      await client.chat({ messages: [], temperature: 0.7 });
      await client.chat({ messages: [], temperature: 0.7 });

      expect(client.chat).toHaveBeenCalledTimes(2);
    });
  });

  describe('createMockTool', () => {
    it('should create mock tool with result', async () => {
      const result = { success: true, data: { value: 42 } };
      const tool = TestHelpers.createMockTool('test_tool', result);

      expect(tool.name).toBe('test_tool');
      expect(tool.dangerous).toBe(false);

      const executeResult = await tool.execute({});
      expect(executeResult).toEqual(result);
    });

    it('should validate parameters', () => {
      const tool = TestHelpers.createMockTool('test_tool', { success: true });

      const validation = tool.validate({ param: 'value' });

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should provide definition', () => {
      const tool = TestHelpers.createMockTool('test_tool', { success: true });

      const definition = tool.getDefinition();

      expect(definition.name).toBe('test_tool');
      expect(definition.description).toContain('Mock tool');
    });
  });

  describe('createTestConfig', () => {
    it('should create default config', () => {
      const config = TestHelpers.createTestConfig();

      expect(config.agent.maxIterations).toBe(5);
      expect(config.llm.planner.provider).toBe('openai');
      expect(config.logging.level).toBe('error');
    });

    it('should merge overrides', () => {
      const config = TestHelpers.createTestConfig({
        agent: { maxIterations: 10 }
      });

      expect(config.agent.maxIterations).toBe(10);
      expect(config.agent.enableReflection).toBe(true); // Default preserved
    });

    it('should deep merge nested overrides', () => {
      const config = TestHelpers.createTestConfig({
        llm: {
          planner: { temperature: 0.9 }
        }
      });

      expect(config.llm.planner.temperature).toBe(0.9);
      expect(config.llm.planner.model).toBe('gpt-4'); // Default preserved
    });
  });

  describe('createTestLogger', () => {
    it('should create logger with mocked methods', () => {
      const logger = TestHelpers.createTestLogger();

      logger.info('test message');
      logger.error('error message');
      logger.debug('debug message');

      expect(logger.info).toHaveBeenCalledWith('test message');
      expect(logger.error).toHaveBeenCalledWith('error message');
      expect(logger.debug).toHaveBeenCalledWith('debug message');
    });

    it('should track tool logging', () => {
      const logger = TestHelpers.createTestLogger();

      logger.logToolCall('file_read', { path: 'test.txt' });
      logger.logToolResult('file_read', { success: true });

      expect(logger.logToolCall).toHaveBeenCalled();
      expect(logger.logToolResult).toHaveBeenCalled();
    });
  });

  describe('waitFor', () => {
    it('should wait for condition to be true', async () => {
      let value = false;
      setTimeout(() => { value = true; }, 100);

      await TestHelpers.waitFor(() => value, 1000, 50);

      expect(value).toBe(true);
    });

    it('should timeout if condition never true', async () => {
      await expect(
        TestHelpers.waitFor(() => false, 200, 50)
      ).rejects.toThrow('Timeout waiting for condition');
    });

    it('should return immediately if condition already true', async () => {
      const startTime = Date.now();
      await TestHelpers.waitFor(() => true, 1000, 50);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('sleep', () => {
    it('should sleep for specified duration', async () => {
      const startTime = Date.now();
      await TestHelpers.sleep(100);
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(90);
      expect(duration).toBeLessThan(200);
    });
  });

  describe('createTempDir and cleanupTempDir', () => {
    it('should create and cleanup temp directory', async () => {
      const tempDir = await TestHelpers.createTempDir();

      expect(tempDir).toBeTruthy();

      const fs = require('fs-extra');
      const exists = await fs.pathExists(tempDir);
      expect(exists).toBe(true);

      await TestHelpers.cleanupTempDir(tempDir);

      const existsAfter = await fs.pathExists(tempDir);
      expect(existsAfter).toBe(false);
    });
  });

  describe('createMockLLMResponse', () => {
    it('should create response with defaults', () => {
      const response = TestHelpers.createMockLLMResponse('Test content');

      expect(response.content).toBe('Test content');
      expect(response.finishReason).toBe('stop');
      expect(response.usage.totalTokens).toBe(15);
    });

    it('should create response with tool calls', () => {
      const toolCalls = [{ id: 'call_1', name: 'test_tool', arguments: {} }];
      const response = TestHelpers.createMockLLMResponse('', {
        toolCalls,
        finishReason: 'tool_calls'
      });

      expect(response.toolCalls).toEqual(toolCalls);
      expect(response.finishReason).toBe('tool_calls');
    });

    it('should create response with custom usage', () => {
      const usage = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };
      const response = TestHelpers.createMockLLMResponse('Test', { usage });

      expect(response.usage).toEqual(usage);
    });
  });
});
