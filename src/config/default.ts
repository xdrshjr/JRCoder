/**
 * Default configuration
 */

import type { GlobalConfig } from '../types';
import {
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_WORKSPACE_DIR,
  DEFAULT_LOG_DIR,
  DEFAULT_MAX_RETRIES,
  DEFAULT_BASE_DELAY,
  DEFAULT_MAX_DELAY,
  DEFAULT_FIXED_DELAY,
} from '../constants';

export const defaultConfig: GlobalConfig = {
  agent: {
    maxIterations: DEFAULT_MAX_ITERATIONS,
    enableReflection: true,
    requireConfirmation: true,
    autoSave: true,
    saveInterval: 60000,
    maxRetries: DEFAULT_MAX_RETRIES,
  },

  llm: {
    planner: {
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
      temperature: 0.7,
      maxTokens: 4096,
      timeout: 60000,
    },
    executor: {
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
      temperature: 0.3,
      maxTokens: 4096,
      timeout: 120000,
    },
    reflector: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      temperature: 0.5,
      maxTokens: 2048,
      timeout: 60000,
    },
  },

  tools: {
    enabled: [
      'code_query',
      'file_read',
      'file_write',
      'file_list',
      'snippet_save',
      'snippet_load',
      'snippet_list',
      'shell_exec',
      'ask_user',
    ],
    workspaceDir: DEFAULT_WORKSPACE_DIR,
    maxFileSize: 10 * 1024 * 1024,
    allowedExtensions: [
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.py',
      '.java',
      '.go',
      '.rs',
      '.c',
      '.cpp',
      '.h',
      '.hpp',
      '.json',
      '.yaml',
      '.yml',
      '.md',
      '.txt',
    ],
    shellTimeout: 30000,
    shellMaxBuffer: 10 * 1024 * 1024,
  },

  logging: {
    level: 'info',
    outputDir: DEFAULT_LOG_DIR,
    enableConsole: true,
    enableFile: true,
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 10,
    format: 'json',
  },

  cli: {
    theme: 'dark',
    showProgress: true,
    confirmDangerous: true,
    colorOutput: true,
    verboseErrors: false,
  },

  storage: {
    type: 'file',
    snippetDir: '.workspace/snippets',
    sessionDir: '.workspace/sessions',
  },

  retry: {
    maxRetries: DEFAULT_MAX_RETRIES,
    baseDelay: DEFAULT_BASE_DELAY,
    maxDelay: DEFAULT_MAX_DELAY,
    fixedDelay: DEFAULT_FIXED_DELAY,
    strategy: 'exponential',
  },

  errorHandling: {
    enableAutoRetry: true,
    enableStateRollback: true,
    enableFallback: true,
    maxSnapshotAge: 3600000,
    maxSnapshots: 10,
  },
};
