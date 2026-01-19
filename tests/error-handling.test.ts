/**
 * Error handling system tests
 */

import {
  ErrorHandler,
  RetryManager,
  StateSnapshotManager,
  SessionManager,
  FallbackManager,
  LLMTimeoutError,
  LLMRateLimitError,
  ToolExecutionError,
  ErrorCategory,
} from '../src/core';
import { Logger } from '../src/logger';
import { defaultConfig } from '../src/config/default';

describe('Error Handling System', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger(defaultConfig.logging);
  });

  describe('ErrorHandler', () => {
    it('should handle transient errors with retry', async () => {
      const errorHandler = new ErrorHandler(logger, {
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000,
      });

      const error = new LLMTimeoutError('Request timed out');
      const result = await errorHandler.handle(error, {
        phase: 'executing',
        iteration: 1,
        retryCount: 0,
      });

      expect(result.action).toBe('retry');
      expect(result.delay).toBeGreaterThan(0);
    });

    it('should handle permanent errors with fail', async () => {
      const errorHandler = new ErrorHandler(logger, {
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000,
      });

      const error = new Error('Permanent error');
      const result = await errorHandler.handle(error, {
        phase: 'executing',
        iteration: 1,
        retryCount: 0,
      });

      expect(result.action).toBe('fail');
    });

    it('should respect max retries', async () => {
      const errorHandler = new ErrorHandler(logger, {
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000,
      });

      const error = new LLMTimeoutError('Request timed out');
      const result = await errorHandler.handle(error, {
        phase: 'executing',
        iteration: 1,
        retryCount: 3,
      });

      expect(result.action).toBe('fail');
    });
  });

  describe('RetryManager', () => {
    it('should retry failed operations', async () => {
      const retryManager = new RetryManager(logger, {
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000,
        fixedDelay: 200,
        strategy: 'exponential',
      });

      let attempts = 0;
      const result = await retryManager.withRetry(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw after max retries', async () => {
      const retryManager = new RetryManager(logger, {
        maxRetries: 2,
        baseDelay: 100,
        maxDelay: 1000,
        fixedDelay: 200,
        strategy: 'exponential',
      });

      await expect(
        retryManager.withRetry(async () => {
          throw new Error('Always fails');
        })
      ).rejects.toThrow('Always fails');
    });
  });

  describe('StateSnapshotManager', () => {
    it('should create and restore snapshots', () => {
      const snapshotManager = new StateSnapshotManager(logger, 10);

      const state = {
        phase: 'executing' as const,
        currentIteration: 1,
        maxIterations: 10,
        startTime: Date.now(),
        conversation: {
          id: 'test',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        metadata: {
          totalTokens: 0,
          totalCost: 0,
          toolCallsCount: 0,
        },
      };

      const snapshotId = snapshotManager.createSnapshot(state, 'test');
      expect(snapshotId).toBeTruthy();

      const restored = snapshotManager.restoreSnapshot(snapshotId);
      expect(restored).toEqual(state);
    });

    it('should clean up old snapshots', () => {
      const snapshotManager = new StateSnapshotManager(logger, 2);

      const state = {
        phase: 'executing' as const,
        currentIteration: 1,
        maxIterations: 10,
        startTime: Date.now(),
        conversation: {
          id: 'test',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        metadata: {
          totalTokens: 0,
          totalCost: 0,
          toolCallsCount: 0,
        },
      };

      snapshotManager.createSnapshot(state, 'snap1');
      snapshotManager.createSnapshot(state, 'snap2');
      snapshotManager.createSnapshot(state, 'snap3');

      expect(snapshotManager.getSnapshotCount()).toBe(2);
    });
  });

  describe('FallbackManager', () => {
    it('should fallback to secondary on primary failure', async () => {
      const fallbackManager = new FallbackManager(logger);

      const primary = async () => {
        throw new Error('Primary failed');
      };

      const fallback = async () => {
        return 'fallback success';
      };

      const result = await fallbackManager.withTimeout(
        primary,
        1000,
        fallback
      );

      expect(result).toBe('fallback success');
    });

    it('should tolerate partial failures', async () => {
      const fallbackManager = new FallbackManager(logger);

      const operations = [
        async () => 'success1',
        async () => {
          throw new Error('fail');
        },
        async () => 'success2',
      ];

      const results = await fallbackManager.toleratePartialFailure(
        operations,
        0.5
      );

      expect(results).toHaveLength(2);
      expect(results).toContain('success1');
      expect(results).toContain('success2');
    });
  });

  describe('Error Types', () => {
    it('should correctly identify error categories', () => {
      const timeoutError = new LLMTimeoutError('Timeout');
      expect(timeoutError.category).toBe(ErrorCategory.TRANSIENT);
      expect(timeoutError.isRetryable()).toBe(true);

      const rateLimitError = new LLMRateLimitError('Rate limit');
      expect(rateLimitError.category).toBe(ErrorCategory.TRANSIENT);
      expect(rateLimitError.isRetryable()).toBe(true);

      const toolError = new ToolExecutionError('test_tool', 'Failed');
      expect(toolError.category).toBe(ErrorCategory.RECOVERABLE);
      expect(toolError.isRecoverable()).toBe(true);
    });
  });
});
