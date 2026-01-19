/**
 * Configuration presets
 */

import type { DeepPartial, GlobalConfig } from '../types';

export const CONFIG_PRESETS: Record<string, DeepPartial<GlobalConfig>> = {
  // Fast mode: small models, no reflection
  fast: {
    agent: {
      maxIterations: 5,
      enableReflection: false,
      requireConfirmation: false,
    },
    llm: {
      planner: { model: 'gpt-3.5-turbo' },
      executor: { model: 'gpt-3.5-turbo' },
      reflector: { model: 'gpt-3.5-turbo' },
    },
  },

  // Quality mode: large models, all features enabled
  quality: {
    agent: {
      maxIterations: 15,
      enableReflection: true,
      requireConfirmation: true,
    },
    llm: {
      planner: { model: 'gpt-4-turbo-preview' },
      executor: { provider: 'anthropic', model: 'claude-3-opus-20240229' },
      reflector: { model: 'gpt-4-turbo-preview' },
    },
  },

  // Local mode: use Ollama local models
  local: {
    llm: {
      planner: { provider: 'ollama', model: 'llama3:70b', baseURL: 'http://localhost:11434' },
      executor: { provider: 'ollama', model: 'codellama:34b', baseURL: 'http://localhost:11434' },
      reflector: { provider: 'ollama', model: 'llama3:8b', baseURL: 'http://localhost:11434' },
    },
  },

  // Economy mode: minimize cost
  economy: {
    agent: {
      maxIterations: 8,
      enableReflection: true,
    },
    llm: {
      planner: { model: 'gpt-3.5-turbo', maxTokens: 2048 },
      executor: { model: 'gpt-3.5-turbo', maxTokens: 3072 },
      reflector: { model: 'gpt-3.5-turbo', maxTokens: 1024 },
    },
  },
};
