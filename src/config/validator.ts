/**
 * Configuration validator using Joi
 */

import Joi from 'joi';
import type { GlobalConfig, ValidationResult } from '../types';

const LLMConfigSchema = Joi.object({
  provider: Joi.string().valid('openai', 'anthropic', 'ollama').required(),
  model: Joi.string().required(),
  apiKey: Joi.string().optional(),
  baseURL: Joi.string().uri().optional(),
  temperature: Joi.number().min(0).max(2).default(0.7),
  maxTokens: Joi.number().min(1).max(128000).default(4096),
  topP: Joi.number().min(0).max(1).optional(),
  timeout: Joi.number().min(1000).max(600000).default(60000),
});

const GlobalConfigSchema = Joi.object({
  agent: Joi.object({
    maxIterations: Joi.number().min(1).max(100).default(10),
    enableReflection: Joi.boolean().default(true),
    requireConfirmation: Joi.boolean().default(true),
    autoSave: Joi.boolean().default(true),
    saveInterval: Joi.number().min(1000).default(60000),
  }),

  llm: Joi.object({
    planner: LLMConfigSchema,
    executor: LLMConfigSchema,
    reflector: LLMConfigSchema,
  }),

  tools: Joi.object({
    enabled: Joi.array().items(Joi.string()).default([]),
    workspaceDir: Joi.string().required(),
    maxFileSize: Joi.number().min(1).default(10485760),
    allowedExtensions: Joi.array().items(Joi.string()).default([]),
    shellTimeout: Joi.number().min(1000).default(30000),
    shellMaxBuffer: Joi.number().min(1).default(10485760),
  }),

  logging: Joi.object({
    level: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
    outputDir: Joi.string().default('logs'),
    enableConsole: Joi.boolean().default(true),
    enableFile: Joi.boolean().default(true),
    maxFileSize: Joi.number().min(1).default(10485760),
    maxFiles: Joi.number().min(1).default(10),
    format: Joi.string().valid('json', 'text').default('json'),
  }),

  cli: Joi.object({
    theme: Joi.string().valid('light', 'dark').default('dark'),
    showProgress: Joi.boolean().default(true),
    confirmDangerous: Joi.boolean().default(true),
    colorOutput: Joi.boolean().default(true),
    verboseErrors: Joi.boolean().default(false),
  }),

  storage: Joi.object({
    type: Joi.string().valid('file', 'memory').default('file'),
    snippetDir: Joi.string().default('.workspace/snippets'),
    sessionDir: Joi.string().default('.workspace/sessions'),
  }),
});

export class ConfigValidator {
  /**
   * Validate configuration against schema
   */
  static validate(config: any): ValidationResult {
    const result = GlobalConfigSchema.validate(config, {
      abortEarly: false,
      allowUnknown: false,
    });

    if (result.error) {
      return {
        valid: false,
        errors: result.error.details.map((d) => d.message),
      };
    }

    return {
      valid: true,
      errors: [],
    };
  }

  /**
   * Validate and return sanitized config
   */
  static validateAndSanitize(config: any): { config: GlobalConfig; errors: string[] } {
    const result = GlobalConfigSchema.validate(config, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (result.error) {
      return {
        config: result.value,
        errors: result.error.details.map((d) => d.message),
      };
    }

    return {
      config: result.value,
      errors: [],
    };
  }
}
