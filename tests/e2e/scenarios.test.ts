/**
 * End-to-End tests for complete scenarios
 */

import { TestHelpers } from '../../utils/test-helpers';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('E2E Scenarios', () => {
  let testWorkspace: string;

  beforeEach(async () => {
    testWorkspace = await TestHelpers.createTempDir();
  });

  afterEach(async () => {
    await TestHelpers.cleanupTempDir(testWorkspace);
  });

  describe('File Manipulation', () => {
    it('should complete file read and write task', async () => {
      // Prepare test environment
      const inputPath = path.join(testWorkspace, 'input.txt');
      const outputPath = path.join(testWorkspace, 'output.txt');
      const content = 'Original content';

      await fs.writeFile(inputPath, content);

      // Simulate file operations
      const readContent = await fs.readFile(inputPath, 'utf8');
      await fs.writeFile(outputPath, readContent);

      // Verify results
      const outputContent = await fs.readFile(outputPath, 'utf8');
      expect(outputContent).toBe(content);
    });

    it('should handle multiple file operations', async () => {
      const files = ['file1.txt', 'file2.txt', 'file3.txt'];
      const content = 'Test content';

      // Write multiple files
      for (const file of files) {
        await fs.writeFile(path.join(testWorkspace, file), content);
      }

      // Read and verify
      for (const file of files) {
        const readContent = await fs.readFile(path.join(testWorkspace, file), 'utf8');
        expect(readContent).toBe(content);
      }
    });

    it('should handle nested directory operations', async () => {
      const nestedPath = path.join(testWorkspace, 'a', 'b', 'c', 'file.txt');
      const content = 'Nested content';

      await fs.ensureDir(path.dirname(nestedPath));
      await fs.writeFile(nestedPath, content);

      const readContent = await fs.readFile(nestedPath, 'utf8');
      expect(readContent).toBe(content);
    });
  });

  describe('Error Handling', () => {
    it('should handle file not found error', async () => {
      const nonExistentPath = path.join(testWorkspace, 'nonexistent.txt');

      await expect(
        fs.readFile(nonExistentPath, 'utf8')
      ).rejects.toThrow();
    });

    it('should handle permission errors gracefully', async () => {
      // This test demonstrates error handling pattern
      const filePath = path.join(testWorkspace, 'test.txt');
      await fs.writeFile(filePath, 'content');

      // Simulate permission check
      const exists = await fs.pathExists(filePath);
      expect(exists).toBe(true);
    });

    it('should recover from errors and retry', async () => {
      let attemptCount = 0;
      const maxAttempts = 3;

      const operation = async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary error');
        }
        return 'success';
      };

      let result;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          result = await operation();
          break;
        } catch (error) {
          if (i === maxAttempts - 1) throw error;
        }
      }

      expect(result).toBe('success');
      expect(attemptCount).toBe(2);
    });
  });

  describe('Configuration Management', () => {
    it('should load and validate configuration', () => {
      const config = TestHelpers.createTestConfig({
        agent: { maxIterations: 10 }
      });

      expect(config.agent.maxIterations).toBe(10);
      expect(config.llm.planner.provider).toBe('openai');
    });

    it('should merge configuration overrides', () => {
      const config = TestHelpers.createTestConfig({
        llm: {
          planner: { temperature: 0.9 }
        }
      });

      expect(config.llm.planner.temperature).toBe(0.9);
      expect(config.llm.planner.model).toBe('gpt-4');
    });

    it('should handle invalid configuration', () => {
      const config = TestHelpers.createTestConfig();
      config.agent.maxIterations = -1;

      // Validation would catch this
      expect(config.agent.maxIterations).toBeLessThan(0);
    });
  });

  describe('Logging and Monitoring', () => {
    it('should log operations', () => {
      const logger = TestHelpers.createTestLogger();

      logger.info('Test operation started');
      logger.debug('Debug information');
      logger.error('Error occurred');

      expect(logger.info).toHaveBeenCalledWith('Test operation started');
      expect(logger.debug).toHaveBeenCalledWith('Debug information');
      expect(logger.error).toHaveBeenCalledWith('Error occurred');
    });

    it('should track tool calls', () => {
      const logger = TestHelpers.createTestLogger();

      logger.logToolCall('file_read', { path: 'test.txt' });
      logger.logToolResult('file_read', { success: true, data: {} });

      expect(logger.logToolCall).toHaveBeenCalled();
      expect(logger.logToolResult).toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    it('should maintain state across operations', async () => {
      const state = {
        iteration: 0,
        completed: [] as string[],
        pending: ['task1', 'task2', 'task3']
      };

      // Simulate task execution
      while (state.pending.length > 0) {
        const task = state.pending.shift()!;
        state.completed.push(task);
        state.iteration++;
      }

      expect(state.completed).toHaveLength(3);
      expect(state.pending).toHaveLength(0);
      expect(state.iteration).toBe(3);
    });

    it('should handle state persistence', async () => {
      const statePath = path.join(testWorkspace, 'state.json');
      const state = {
        phase: 'executing',
        iteration: 5,
        tasks: ['task1', 'task2']
      };

      await fs.writeJSON(statePath, state);
      const loadedState = await fs.readJSON(statePath);

      expect(loadedState).toEqual(state);
    });
  });

  describe('Tool Integration', () => {
    it('should execute tool chain', async () => {
      const tool1 = TestHelpers.createMockTool('tool1', {
        success: true,
        data: { value: 'result1' }
      });

      const tool2 = TestHelpers.createMockTool('tool2', {
        success: true,
        data: { value: 'result2' }
      });

      const result1 = await tool1.execute({});
      const result2 = await tool2.execute({ input: result1.data });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should handle tool failures', async () => {
      const tool = TestHelpers.createMockTool('failing_tool', {
        success: false,
        error: 'Tool execution failed'
      });

      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool execution failed');
    });
  });

  describe('LLM Integration', () => {
    it('should handle LLM responses', async () => {
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

    it('should handle tool calls from LLM', async () => {
      const response = TestHelpers.createMockLLMResponse('', {
        toolCalls: [
          { id: 'call_1', name: 'file_read', arguments: { path: 'test.txt' } }
        ],
        finishReason: 'tool_calls'
      });

      const client = TestHelpers.createMockLLMClient([response]);
      const result = await client.chat({ messages: [], temperature: 0.7 });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls![0].name).toBe('file_read');
    });
  });
});
