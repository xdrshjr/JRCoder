/**
 * Unit tests for Error Handling
 */

import {
  AgentError,
  ToolExecutionError,
  LLMError,
  ConfigError,
  ValidationError
} from '@/core/errors';
import { ErrorHandler } from '@/core/error-handler';
import { TestHelpers } from '../../utils/test-helpers';

describe('Error Classes', () => {
  describe('AgentError', () => {
    it('should create error with message and code', () => {
      const error = new AgentError('Test error', 'TEST_ERROR');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.name).toBe('AgentError');
    });

    it('should include details', () => {
      const details = { foo: 'bar' };
      const error = new AgentError('Test error', 'TEST_ERROR', details);

      expect(error.details).toEqual(details);
    });
  });

  describe('ToolExecutionError', () => {
    it('should create error with tool name', () => {
      const error = new ToolExecutionError('file_read', 'File not found');

      expect(error.message).toContain('file_read');
      expect(error.message).toContain('File not found');
      expect(error.code).toBe('TOOL_ERROR');
    });

    it('should include tool details', () => {
      const details = { path: '/test/file.txt' };
      const error = new ToolExecutionError('file_read', 'File not found', details);

      expect(error.details).toEqual(expect.objectContaining({
        toolName: 'file_read',
        ...details
      }));
    });
  });

  describe('LLMError', () => {
    it('should create error with message', () => {
      const error = new LLMError('API rate limit exceeded');

      expect(error.message).toContain('API rate limit exceeded');
      expect(error.code).toBe('LLM_ERROR');
    });

    it('should include status code', () => {
      const error = new LLMError('API error', { statusCode: 429 });

      expect(error.details).toEqual({ statusCode: 429 });
    });
  });

  describe('ConfigError', () => {
    it('should create error with message', () => {
      const error = new ConfigError('Invalid configuration');

      expect(error.message).toContain('Invalid configuration');
      expect(error.code).toBe('CONFIG_ERROR');
    });
  });

  describe('ValidationError', () => {
    it('should create error with message', () => {
      const error = new ValidationError('Invalid parameter');

      expect(error.message).toContain('Invalid parameter');
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });
});

describe('ErrorHandler', () => {
  let logger: any;

  beforeEach(() => {
    logger = TestHelpers.createTestLogger();
  });

  describe('handle', () => {
    it('should handle AgentError', () => {
      const error = new AgentError('Test error', 'TEST_ERROR');
      const result = ErrorHandler.handle(error, logger);

      expect(result.message).toBe('Test error');
      expect(result.code).toBe('TEST_ERROR');
      expect(result.recoverable).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle ToolExecutionError as recoverable', () => {
      const error = new ToolExecutionError('file_read', 'File not found');
      const result = ErrorHandler.handle(error, logger);

      expect(result.recoverable).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle LLMError with 429 as recoverable', () => {
      const error = new LLMError('Rate limit', { statusCode: 429 });
      const result = ErrorHandler.handle(error, logger);

      expect(result.recoverable).toBe(true);
    });

    it('should handle LLMError with other status as non-recoverable', () => {
      const error = new LLMError('Server error', { statusCode: 500 });
      const result = ErrorHandler.handle(error, logger);

      expect(result.recoverable).toBe(false);
    });

    it('should handle unknown errors', () => {
      const error = new Error('Unknown error');
      const result = ErrorHandler.handle(error, logger);

      expect(result.message).toContain('unexpected error');
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.recoverable).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('isRecoverable', () => {
    it('should return true for ToolExecutionError', () => {
      const error = new ToolExecutionError('file_read', 'Error');
      expect(ErrorHandler.isRecoverable(error)).toBe(true);
    });

    it('should return true for LLMError with 429', () => {
      const error = new LLMError('Rate limit', { statusCode: 429 });
      expect(ErrorHandler.isRecoverable(error)).toBe(true);
    });

    it('should return false for ConfigError', () => {
      const error = new ConfigError('Invalid config');
      expect(ErrorHandler.isRecoverable(error)).toBe(false);
    });

    it('should return false for unknown errors', () => {
      const error = new Error('Unknown');
      expect(ErrorHandler.isRecoverable(error)).toBe(false);
    });
  });

  describe('log', () => {
    it('should log error with details', () => {
      const error = new AgentError('Test error', 'TEST_ERROR', { foo: 'bar' });
      ErrorHandler.log(error, logger);

      expect(logger.error).toHaveBeenCalledWith(
        'Test error',
        error,
        expect.objectContaining({ foo: 'bar' })
      );
    });

    it('should log error without details', () => {
      const error = new Error('Simple error');
      ErrorHandler.log(error, logger);

      expect(logger.error).toHaveBeenCalledWith(
        'Simple error',
        error,
        undefined
      );
    });
  });
});
