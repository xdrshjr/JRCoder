/**
 * TUI (Text User Interface) type definitions
 */

import type { AgentPhase, Plan, Task } from '../../types';

// ============================================================================
// Activity Types
// ============================================================================

/**
 * Activity types shown in the content area
 */
export type ActivityType =
  | 'thinking'
  | 'tool_call'
  | 'bash'
  | 'message'
  | 'error'
  | 'log'
  | 'phase_change'
  | 'answer';

/**
 * Tool call status
 */
export type ToolCallStatus = 'running' | 'completed' | 'failed';

/**
 * Base activity interface
 */
export interface BaseActivity {
  id: string;
  type: ActivityType;
  timestamp: number;
  mergeCount?: number; // Number of merged activities
}

/**
 * Thinking activity (Planner/Reflector thought process)
 */
export interface ThinkingActivity extends BaseActivity {
  type: 'thinking';
  content: string;
  source: 'planner' | 'reflector' | 'executor';
}

/**
 * Tool call activity
 */
export interface ToolCallActivity extends BaseActivity {
  type: 'tool_call';
  toolName: string;
  args: Record<string, any>;
  status: ToolCallStatus;
  result?: string;
  error?: string;
}

/**
 * Bash command activity
 */
export interface BashActivity extends BaseActivity {
  type: 'bash';
  command: string;
  output?: string;
  exitCode?: number;
  status: 'running' | 'completed' | 'failed';
}

/**
 * General message activity
 */
export interface MessageActivity extends BaseActivity {
  type: 'message';
  content: string;
  level: 'info' | 'success' | 'warning';
}

/**
 * Error activity
 */
export interface ErrorActivity extends BaseActivity {
  type: 'error';
  message: string;
  error?: string;
  stack?: string;
}

/**
 * Log activity
 */
export interface LogActivity extends BaseActivity {
  type: 'log';
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

/**
 * Phase change activity
 */
export interface PhaseChangeActivity extends BaseActivity {
  type: 'phase_change';
  from: AgentPhase;
  to: AgentPhase;
}

/**
 * Answer activity for simple task responses
 */
export interface AnswerActivity extends BaseActivity {
  type: 'answer';
  content: string;
  source: 'assistant';
}

/**
 * Union type of all activities
 */
export type Activity =
  | ThinkingActivity
  | ToolCallActivity
  | BashActivity
  | MessageActivity
  | ErrorActivity
  | LogActivity
  | PhaseChangeActivity
  | AnswerActivity;

// ============================================================================
// TUI State
// ============================================================================

/**
 * Global TUI state
 */
export interface TUIState {
  // Agent state
  agentPhase: AgentPhase;
  currentTask: Task | null;
  plan: Plan | null;

  // Activity records
  activities: Activity[];

  // UI state
  isInputFocused: boolean;
  scrollPosition: number;

  // Statistics
  stats: TUIStats;
}

/**
 * TUI statistics
 */
export interface TUIStats {
  totalTokens: number;
  totalCost: number;
  completedTasks: number;
  totalTasks: number;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * TUI event types
 */
export type TUIEventType =
  | 'agent:phase'
  | 'agent:thinking'
  | 'agent:error'
  | 'agent:answer'
  | 'tool:call'
  | 'tool:result'
  | 'bash:start'
  | 'bash:output'
  | 'bash:complete'
  | 'user:input'
  | 'activity:add'
  | 'activity:update'
  | 'activity:append'
  | 'activity:complete'
  | 'state:update';

/**
 * Base TUI event
 */
export interface BaseTUIEvent {
  type: TUIEventType;
  timestamp: number;
}

/**
 * Agent phase change event
 */
export interface AgentPhaseEvent extends BaseTUIEvent {
  type: 'agent:phase';
  phase: AgentPhase;
}

/**
 * Agent thinking event
 */
export interface AgentThinkingEvent extends BaseTUIEvent {
  type: 'agent:thinking';
  content: string;
  source: 'planner' | 'reflector' | 'executor';
}

/**
 * Agent error event
 */
export interface AgentErrorEvent extends BaseTUIEvent {
  type: 'agent:error';
  error: Error;
}

/**
 * Agent answer event for simple task responses
 */
export interface AgentAnswerEvent extends BaseTUIEvent {
  type: 'agent:answer';
  answer: string;
}

/**
 * Tool call event
 */
export interface ToolCallEvent extends BaseTUIEvent {
  type: 'tool:call';
  id: string;
  toolName: string;
  args: Record<string, any>;
}

/**
 * Tool result event
 */
export interface ToolResultEvent extends BaseTUIEvent {
  type: 'tool:result';
  id: string;
  success: boolean;
  result?: string;
  error?: string;
}

/**
 * Bash start event
 */
export interface BashStartEvent extends BaseTUIEvent {
  type: 'bash:start';
  id: string;
  command: string;
}

/**
 * Bash output event
 */
export interface BashOutputEvent extends BaseTUIEvent {
  type: 'bash:output';
  id: string;
  line: string;
}

/**
 * Bash complete event
 */
export interface BashCompleteEvent extends BaseTUIEvent {
  type: 'bash:complete';
  id: string;
  exitCode: number;
}

/**
 * User input event
 */
export interface UserInputEvent extends BaseTUIEvent {
  type: 'user:input';
  input: string;
}

/**
 * Activity add event
 */
export interface ActivityAddEvent extends BaseTUIEvent {
  type: 'activity:add';
  activity: Activity;
}

/**
 * Activity update event
 */
export interface ActivityUpdateEvent extends BaseTUIEvent {
  type: 'activity:update';
  activityId: string;
  updates: Partial<Activity>;
}

/**
 * Activity append event (for streaming output)
 */
export interface ActivityAppendEvent extends BaseTUIEvent {
  type: 'activity:append';
  activityId: string;
  content: string;
}

/**
 * Activity complete event
 */
export interface ActivityCompleteEvent extends BaseTUIEvent {
  type: 'activity:complete';
  activityId: string;
  status: 'completed' | 'failed';
}

/**
 * State update event
 */
export interface StateUpdateEvent extends BaseTUIEvent {
  type: 'state:update';
  updates: Partial<TUIState>;
}

/**
 * Union type of all TUI events
 */
export type TUIEvent =
  | AgentPhaseEvent
  | AgentThinkingEvent
  | AgentErrorEvent
  | AgentAnswerEvent
  | ToolCallEvent
  | ToolResultEvent
  | BashStartEvent
  | BashOutputEvent
  | BashCompleteEvent
  | UserInputEvent
  | ActivityAddEvent
  | ActivityUpdateEvent
  | ActivityAppendEvent
  | ActivityCompleteEvent
  | StateUpdateEvent;

// ============================================================================
// Component Props
// ============================================================================

/**
 * Header component props
 */
export interface HeaderProps {
  projectName: string;
  version: string;
  phase: AgentPhase;
  isOnline: boolean;
}

/**
 * Content area component props
 */
export interface ContentAreaProps {
  activities: Activity[];
  enableMerging?: boolean;
  mergeConfig?: {
    mergeWindowMs?: number;
    maxActivities?: number;
    enableMerging?: boolean;
    enableTrimming?: boolean;
  };
}

/**
 * Activity item component props
 */
export interface ActivityItemProps {
  activity: Activity;
}

/**
 * Status bar component props
 */
export interface StatusBarProps {
  completedTasks: number;
  totalTasks: number;
  totalTokens: number;
  totalCost: number;
}

/**
 * Input box component props
 */
export interface InputBoxProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Advanced input component props
 */
export interface AdvancedInputProps {
  onSubmit: (value: string) => void;
  history?: string[];
  placeholder?: string;
  disabled?: boolean;
}

/**
 * TUI App component props
 */
export interface TUIAppProps {
  projectName: string;
  version: string;
  initialTask?: string;
  sessionId?: string;
  enableAutoSave?: boolean;
  autoSaveIntervalMs?: number;
  config?: any; // GlobalConfig type
  eventBus?: any; // TUIEventBus instance
}
