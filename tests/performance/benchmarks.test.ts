/**
 * Performance and stress tests
 */

import { TestHelpers } from '../../utils/test-helpers';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('Performance Tests', () => {
  let testWorkspace: string;

  beforeEach(async () => {
    testWorkspace = await TestHelpers.createTempDir();
  });

  afterEach(async () => {
    await TestHelpers.cleanupTempDir(testWorkspace);
  });

  describe('File Operations Performance', () => {
    it('should handle 100 file operations efficiently', async () => {
      const startTime = Date.now();
      const fileCount = 100;

      // Write files
      const writePromises = [];
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(testWorkspace, `file${i}.txt`);
        writePromises.push(fs.writeFile(filePath, `Content ${i}`));
      }
      await Promise.all(writePromises);

      // Read files
      const readPromises = [];
      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(testWorkspace, `file${i}.txt`);
        readPromises.push(fs.readFile(filePath, 'utf8'));
      }
      await Promise.all(readPromises);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete in less than 5 seconds
    });

    it('should handle large file efficiently', async () => {
      const filePath = path.join(testWorkspace, 'large.txt');
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB

      const startTime = Date.now();

      await fs.writeFile(filePath, largeContent);
      await fs.readFile(filePath, 'utf8');

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });

  describe('Mock LLM Performance', () => {
    it('should handle 100 LLM calls efficiently', async () => {
      const responses = [TestHelpers.createMockLLMResponse('Response')];
      const client = TestHelpers.createMockLLMClient(responses);

      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(client.chat({ messages: [], temperature: 0.7 }));
      }
      await Promise.all(promises);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });

  describe('Tool Execution Performance', () => {
    it('should handle 100 tool calls efficiently', async () => {
      const tool = TestHelpers.createMockTool('test_tool', {
        success: true,
        data: { value: 42 }
      });

      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(tool.execute({ param: i }));
      }
      await Promise.all(promises);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        const config = TestHelpers.createTestConfig();
        const logger = TestHelpers.createTestLogger();
        logger.info(`Iteration ${i}`);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle large data structures efficiently', () => {
      const largeArray = new Array(10000).fill(0).map((_, i) => ({
        id: i,
        data: `Item ${i}`,
        timestamp: Date.now()
      }));

      const startMemory = process.memoryUsage().heapUsed;

      // Process large array
      const processed = largeArray.map(item => ({
        ...item,
        processed: true
      }));

      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsed = endMemory - startMemory;

      expect(processed).toHaveLength(10000);
      expect(memoryUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent file operations', async () => {
      const operations = 50;
      const promises = [];

      for (let i = 0; i < operations; i++) {
        const filePath = path.join(testWorkspace, `concurrent${i}.txt`);
        promises.push(
          fs.writeFile(filePath, `Content ${i}`).then(() =>
            fs.readFile(filePath, 'utf8')
          )
        );
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(operations);
      results.forEach((content, i) => {
        expect(content).toBe(`Content ${i}`);
      });
    });

    it('should handle concurrent mock operations', async () => {
      const client = TestHelpers.createMockLLMClient([
        TestHelpers.createMockLLMResponse('Response')
      ]);

      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(client.chat({ messages: [], temperature: 0.7 }));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(50);
      results.forEach(result => {
        expect(result.content).toBe('Response');
      });
    });
  });

  describe('Stress Tests', () => {
    it('should handle rapid sequential operations', async () => {
      const iterations = 1000;
      const logger = TestHelpers.createTestLogger();

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        logger.info(`Iteration ${i}`);
      }

      const duration = Date.now() - startTime;

      expect(logger.info).toHaveBeenCalledTimes(iterations);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });

    it('should handle deep nesting', () => {
      const createNestedObject = (depth: number): any => {
        if (depth === 0) return { value: 'leaf' };
        return { nested: createNestedObject(depth - 1) };
      };

      const deepObject = createNestedObject(100);

      const traverse = (obj: any, depth = 0): number => {
        if (!obj.nested) return depth;
        return traverse(obj.nested, depth + 1);
      };

      const maxDepth = traverse(deepObject);

      expect(maxDepth).toBe(100);
    });

    it('should handle large configuration merges', () => {
      const baseConfig = TestHelpers.createTestConfig();

      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        TestHelpers.createTestConfig({
          agent: { maxIterations: i }
        });
      }

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });
});
