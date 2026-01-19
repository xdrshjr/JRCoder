/**
 * Core type definitions for OpenJRAgent
 */

// ============================================================================
// Message Protocol
// ============================================================================

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ToolCallMessage extends Message {
  role: 'assistant';
  toolCalls: ToolCall[];
}

export interface ToolResultMessage extends Message {
  role: 'tool';
  toolCallId: string;
  toolName: string;
  result: any;
  error?: string;
}

// ============================================================================
// Task and Plan
// ============================================================================

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: number;
  dependencies: string[];
  createdAt: number;
  updatedAt: number;
  result?: any;
  error?: string;
}

export interface Plan {
  id: string;
  goal: string;
  tasks: Task[];
  currentTaskId?: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Tool System
// ============================================================================

export type ToolParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface ToolParameter {
  name: string;
  type: ToolParameterType;
  description: string;
  required: boolean;
  default?: any;
  enum?: any[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  dangerous?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime: number;
    tokensUsed?: number;
  };
}

// ============================================================================
// Agent State
// ============================================================================

export type AgentPhase =
  | 'planning'
  | 'executing'
  | 'reflecting'
  | 'confirming'
  | 'completed'
  | 'failed';

export interface AgentState {
  phase: AgentPhase;
  plan?: Plan;
  conversation: {
    id: string;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
  };
  currentIteration: number;
  maxIterations: number;
  startTime: number;
  endTime?: number;
  metadata: {
    totalTokens: number;
    totalCost: number;
    toolCallsCount: number;
  };
}

// ============================================================================
// LLM Client
// ============================================================================

export type LLMProvider = 'openai' | 'anthropic' | 'ollama';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeout?: number;
}

export interface LLMRequest {
  messages: Message[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export type LLMFinishReason = 'stop' | 'length' | 'tool_calls' | 'error';

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: LLMFinishReason;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================================================
// Configuration
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface GlobalConfig {
  agent: {
    maxIterations: number;
    enableReflection: boolean;
    requireConfirmation: boolean;
    autoSave: boolean;
    saveInterval: number;
    maxRetries: number;
  };

  llm: {
    planner: LLMConfig;
    executor: LLMConfig;
    reflector: LLMConfig;
  };

  tools: {
    enabled: string[];
    workspaceDir: string;
    maxFileSize: number;
    allowedExtensions: string[];
    shellTimeout: number;
    shellMaxBuffer: number;
  };

  logging: {
    level: LogLevel;
    outputDir: string;
    enableConsole: boolean;
    enableFile: boolean;
    maxFileSize: number;
    maxFiles: number;
    format: 'json' | 'text';
  };

  cli: {
    theme: 'light' | 'dark';
    showProgress: boolean;
    confirmDangerous: boolean;
    colorOutput: boolean;
    verboseErrors: boolean;
  };

  storage: {
    type: 'file' | 'memory';
    snippetDir: string;
    sessionDir: string;
  };

  retry: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    fixedDelay: number;
    strategy: 'exponential' | 'linear' | 'fixed' | 'adaptive';
  };

  errorHandling: {
    enableAutoRetry: boolean;
    enableStateRollback: boolean;
    enableFallback: boolean;
    maxSnapshotAge: number;
    maxSnapshots: number;
  };
}

// ============================================================================
// Storage
// ============================================================================

export interface CodeSnippet {
  id: string;
  name: string;
  description: string;
  language: string;
  code: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SessionData {
  id: string;
  state: AgentState;
  config: GlobalConfig;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Logging
// ============================================================================

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: {
    phase?: AgentPhase;
    iteration?: number;
    toolName?: string;
    [key: string]: any;
  };
  data?: any;
}

// ============================================================================
// Events
// ============================================================================

export type EventType =
  | 'phase_changed'
  | 'task_started'
  | 'task_completed'
  | 'tool_called'
  | 'tool_completed'
  | 'iteration_started'
  | 'iteration_completed'
  | 'error_occurred'
  | 'user_confirmation_required';

export interface AgentEvent {
  type: EventType;
  timestamp: number;
  data: any;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export interface JSONObject {
  [key: string]: JSONValue;
}
export interface JSONArray extends Array<JSONValue> {}
