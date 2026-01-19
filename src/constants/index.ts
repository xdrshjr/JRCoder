/**
 * Constants used throughout the application
 */

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_MAX_ITERATIONS = 10;
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_WORKSPACE_DIR = '.workspace';
export const DEFAULT_LOG_DIR = 'logs';

// ============================================================================
// Limits
// ============================================================================

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_CONVERSATION_LENGTH = 100;
export const MAX_TOOL_EXECUTION_TIME = 60000; // 60s

// ============================================================================
// Tool Names
// ============================================================================

export const TOOL_NAMES = {
  CODE_QUERY: 'code_query',
  FILE_READ: 'file_read',
  FILE_WRITE: 'file_write',
  FILE_LIST: 'file_list',
  SNIPPET_SAVE: 'snippet_save',
  SNIPPET_LOAD: 'snippet_load',
  SNIPPET_LIST: 'snippet_list',
  SHELL_EXEC: 'shell_exec',
  ASK_USER: 'ask_user',
} as const;

// ============================================================================
// Configuration Paths
// ============================================================================

export const CONFIG_PATHS = [
  'config/default.json',
  'config/local.json',
  '.openjragent.json',
] as const;

// ============================================================================
// Error Codes
// ============================================================================

export const ERROR_CODES = {
  CONFIG_ERROR: 'CONFIG_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TOOL_ERROR: 'TOOL_ERROR',
  LLM_ERROR: 'LLM_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;
