/**
 * Core Agent types for Planner, Executor, and Reflector
 */

import type { Plan } from '../types';

// ============================================================================
// Planner Types
// ============================================================================

export interface PlannerResponse {
  type: 'simple' | 'complex';
  answer?: string;
  tasks?: Array<{
    title: string;
    description: string;
    dependencies?: string[];
  }>;
}

export type PlannerResultType = 'direct_answer' | 'plan';

export interface DirectAnswerResult {
  type: 'direct_answer';
  answer: string;
}

export interface PlanResult {
  type: 'plan';
  plan: Plan;
}

export type PlannerResult = DirectAnswerResult | PlanResult;

// ============================================================================
// Executor Types
// ============================================================================

export interface TaskResult {
  taskId: string;
  success: boolean;
  output?: string;
  error?: string;
}

export interface ExecutionResult {
  completedTasks: number;
  failedTasks: number;
  results: TaskResult[];
}

// ============================================================================
// Reflector Types
// ============================================================================

export interface ReflectionResponse {
  goalAchieved: boolean;
  blocked: boolean;
  summary: string;
  issues: string[];
  suggestions: string[];
  question?: string;
  improvedPlan?: any;
}

export type ReflectionStatus =
  | 'completed'
  | 'blocked'
  | 'needs_improvement'
  | 'max_iterations_reached';

export type ReflectionAction = 'finish' | 'ask_user' | 'replan';

export interface ReflectionResult {
  status: ReflectionStatus;
  summary?: string;
  issues?: string[];
  suggestions?: string[];
  nextAction: ReflectionAction;
  question?: string;
  newPlan?: Plan;
}

// ============================================================================
// User Confirmation Types
// ============================================================================

export type ConfirmationAction = 'confirm' | 'cancel' | 'replan';

export interface ConfirmationResult {
  action: ConfirmationAction;
  plan?: Plan;
}
