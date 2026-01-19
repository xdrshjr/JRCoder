/**
 * Unit tests for ConfigValidator
 */

import { ConfigValidator } from '@/config/validator';
import { TestHelpers } from '../../utils/test-helpers';
import { GlobalConfig } from '@/types';

describe('ConfigValidator', () => {
  describe('validate', () => {
    it('should validate correct config', () => {
      const config = TestHelpers.createTestConfig();
      const result = ConfigValidator.validate(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid maxIterations (too low)', () => {
      const config = TestHelpers.createTestConfig({
        agent: { maxIterations: 0 } as any
      });
      const result = ConfigValidator.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('maxIterations'))).toBe(true);
    });

    it('should detect invalid maxIterations (too high)', () => {
      const config = TestHelpers.createTestConfig({
        agent: { maxIterations: 101 } as any
      });
      const result = ConfigValidator.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('maxIterations'))).toBe(true);
    });

    it('should detect missing LLM provider', () => {
      const config = TestHelpers.createTestConfig();
      (config.llm.planner as any).provider = '';
      const result = ConfigValidator.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('provider'))).toBe(true);
    });

    it('should detect invalid temperature', () => {
      const config = TestHelpers.createTestConfig();
      config.llm.planner.temperature = 3.0;
      const result = ConfigValidator.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('temperature'))).toBe(true);
    });

    it('should detect invalid log level', () => {
      const config = TestHelpers.createTestConfig();
      (config.logging as any).level = 'invalid';
      const result = ConfigValidator.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('level'))).toBe(true);
    });

    it('should detect missing workspace directory', () => {
      const config = TestHelpers.createTestConfig();
      (config.tools as any).workspaceDir = '';
      const result = ConfigValidator.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('workspaceDir'))).toBe(true);
    });

    it('should detect invalid maxFileSize', () => {
      const config = TestHelpers.createTestConfig();
      config.tools.maxFileSize = -1;
      const result = ConfigValidator.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('maxFileSize'))).toBe(true);
    });

    it('should accept valid config with all fields', () => {
      const config: GlobalConfig = {
        agent: {
          maxIterations: 10,
          enableReflection: true,
          requireConfirmation: true,
          autoSave: true,
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
            provider: 'anthropic',
            model: 'claude-3-opus',
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
          enabled: ['file_read', 'file_write'],
          workspaceDir: '.workspace',
          maxFileSize: 10485760,
          allowedExtensions: ['.js', '.ts'],
          shellTimeout: 30000,
          shellMaxBuffer: 10485760
        },
        logging: {
          level: 'info',
          outputDir: 'logs',
          enableConsole: true,
          enableFile: true,
          maxFileSize: 10485760,
          maxFiles: 10,
          format: 'json'
        },
        cli: {
          theme: 'dark',
          showProgress: true,
          confirmDangerous: true,
          colorOutput: true,
          verboseErrors: false
        },
        storage: {
          type: 'file',
          snippetDir: '.workspace/snippets',
          sessionDir: '.workspace/sessions'
        }
      };

      const result = ConfigValidator.validate(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
