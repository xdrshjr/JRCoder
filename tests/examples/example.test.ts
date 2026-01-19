/**
 * Example test file demonstrating testing patterns
 * This file serves as a template for writing new tests
 */

import { TestHelpers } from '../utils/test-helpers';

describe('Example Test Suite', () => {
  // Setup runs before each test
  beforeEach(() => {
    // Initialize test data
  });

  // Cleanup runs after each test
  afterEach(() => {
    // Clean up resources
    jest.clearAllMocks();
  });

  describe('Basic Testing Patterns', () => {
    it('should demonstrate simple assertion', () => {
      const value = 42;
      expect(value).toBe(42);
    });

    it('should demonstrate object comparison', () => {
      const obj = { name: 'test', value: 42 };
      expect(obj).toEqual({ name: 'test', value: 42 });
    });

    it('should demonstrate array testing', () => {
      const arr = [1, 2, 3];
      expect(arr).toHaveLength(3);
      expect(arr).toContain(2);
    });

    it('should demonstrate async testing', async () => {
      const result = await Promise.resolve('success');
      expect(result).toBe('success');
    });

    it('should demonstrate error testing', () => {
      const throwError = () => {
        throw new Error('Test error');
      };
      expect(throwError).toThrow('Test error');
    });
  });

  describe('Using Test Helpers', () => {
    it('should use mock LLM client', async () => {
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

    it('should use mock tool', async () => {
      const tool = TestHelpers.createMockTool('example_tool', {
        success: true,
        data: { result: 'success' }
      });

      const result = await tool.execute({ param: 'value' });

      expect(result.success).toBe(true);
      expect(result.data.result).toBe('success');
    });

    it('should use test config', () => {
      const config = TestHelpers.createTestConfig({
        agent: { maxIterations: 10 }
      });

      expect(config.agent.maxIterations).toBe(10);
      expect(config.llm.planner.provider).toBe('openai');
    });

    it('should use test logger', () => {
      const logger = TestHelpers.createTestLogger();

      logger.info('Test message');
      logger.error('Error message');

      expect(logger.info).toHaveBeenCalledWith('Test message');
      expect(logger.error).toHaveBeenCalledWith('Error message');
    });

    it('should wait for condition', async () => {
      let value = false;
      setTimeout(() => { value = true; }, 100);

      await TestHelpers.waitFor(() => value, 1000);

      expect(value).toBe(true);
    });
  });

  describe('File Operations', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await TestHelpers.createTempDir();
    });

    afterEach(async () => {
      await TestHelpers.cleanupTempDir(tempDir);
    });

    it('should create and read file', async () => {
      const fs = require('fs-extra');
      const path = require('path');
      const filePath = path.join(tempDir, 'test.txt');
      const content = 'Hello World';

      await fs.writeFile(filePath, content);
      const readContent = await fs.readFile(filePath, 'utf8');

      expect(readContent).toBe(content);
    });
  });

  describe('Mock Functions', () => {
    it('should track function calls', () => {
      const mockFn = jest.fn();

      mockFn('arg1', 'arg2');
      mockFn('arg3');

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(mockFn).toHaveBeenLastCalledWith('arg3');
    });

    it('should mock return values', () => {
      const mockFn = jest.fn()
        .mockReturnValueOnce('first')
        .mockReturnValueOnce('second')
        .mockReturnValue('default');

      expect(mockFn()).toBe('first');
      expect(mockFn()).toBe('second');
      expect(mockFn()).toBe('default');
      expect(mockFn()).toBe('default');
    });

    it('should mock async functions', async () => {
      const mockFn = jest.fn().mockResolvedValue('async result');

      const result = await mockFn();

      expect(result).toBe('async result');
    });
  });

  describe('Matchers', () => {
    it('should use common matchers', () => {
      // Equality
      expect(2 + 2).toBe(4);
      expect({ a: 1 }).toEqual({ a: 1 });

      // Truthiness
      expect(true).toBeTruthy();
      expect(false).toBeFalsy();
      expect(null).toBeNull();
      expect(undefined).toBeUndefined();

      // Numbers
      expect(10).toBeGreaterThan(5);
      expect(5).toBeLessThan(10);
      expect(0.1 + 0.2).toBeCloseTo(0.3);

      // Strings
      expect('hello world').toMatch(/world/);
      expect('hello').toContain('ell');

      // Arrays
      expect([1, 2, 3]).toContain(2);
      expect([1, 2, 3]).toHaveLength(3);

      // Objects
      expect({ a: 1, b: 2 }).toHaveProperty('a');
      expect({ a: 1, b: 2 }).toMatchObject({ a: 1 });
    });
  });

  describe('Test Organization', () => {
    describe('Nested describe blocks', () => {
      it('should organize related tests', () => {
        expect(true).toBe(true);
      });

      it('should make tests easier to read', () => {
        expect(true).toBe(true);
      });
    });

    it.skip('should skip this test', () => {
      // This test will be skipped
    });

    it.only('should only run this test when .only is used', () => {
      // Only this test will run when .only is present
      expect(true).toBe(true);
    });
  });
});
