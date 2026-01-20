/**
 * LogAdapter - Connects logging system to TUI
 */

import { EventEmitter } from '../../../core/event-emitter';
import { TUIEventBus } from '../event-bus';
import type { ILogger } from '../../../logger/interfaces';
import type { AgentEvent } from '../../../types';
import { v4 as uuid } from 'uuid';

/**
 * Log types that should be displayed in TUI
 */
type ImportantLogType =
  | 'task_start'
  | 'task_complete'
  | 'phase_change'
  | 'iteration_start'
  | 'iteration_complete'
  | 'planning_started'
  | 'planning_completed'
  | 'execution_started'
  | 'execution_completed'
  | 'reflection_started'
  | 'reflection_completed';

/**
 * Adapter for integrating the logging system with TUI
 */
export class LogAdapter {
  private logger: ILogger;
  private eventBus: TUIEventBus;
  private importantLogTypes: Set<string>;

  constructor(eventBus: TUIEventBus, logger: ILogger) {
    this.eventBus = eventBus;
    this.logger = logger;

    // Define which log types should be displayed
    this.importantLogTypes = new Set<string>([
      'task_start',
      'task_complete',
      'phase_change',
      'iteration_start',
      'iteration_complete',
      'planning_started',
      'planning_completed',
      'execution_started',
      'execution_completed',
      'reflection_started',
      'reflection_completed',
      'agent_started',
      'agent_completed',
      'agent_failed',
    ]);

    this.logger.debug('LogAdapter initialized', {
      type: 'log_adapter_initialized',
      importantLogTypesCount: this.importantLogTypes.size,
    });
  }

  /**
   * Connect to the agent's event emitter to listen for log events
   */
  connect(agentEventEmitter: EventEmitter): void {
    this.logger.info('LogAdapter connecting to agent event emitter', {
      type: 'log_adapter_connect',
    });

    // Listen for all agent events and filter important ones
    agentEventEmitter.on('phase_changed', (event: AgentEvent) => {
      this.handlePhaseChange(event);
    });

    agentEventEmitter.on('task_started', (event: AgentEvent) => {
      this.handleTaskStart(event);
    });

    agentEventEmitter.on('task_completed', (event: AgentEvent) => {
      this.handleTaskComplete(event);
    });

    agentEventEmitter.on('iteration_started', (event: AgentEvent) => {
      this.handleIterationStart(event);
    });

    agentEventEmitter.on('iteration_completed', (event: AgentEvent) => {
      this.handleIterationComplete(event);
    });

    agentEventEmitter.on('error_occurred', (event: AgentEvent) => {
      this.handleError(event);
    });

    this.logger.info('LogAdapter connected successfully', {
      type: 'log_adapter_connected',
    });
  }

  /**
   * Handle phase change events
   */
  private handlePhaseChange(event: AgentEvent): void {
    const { from, phase: to } = event.data;

    this.logger.info('Phase changed', {
      type: 'phase_changed',
      from,
      to,
    });

    this.eventBus.emit({
      type: 'activity:add',
      timestamp: Date.now(),
      activity: {
        id: uuid(),
        type: 'log',
        timestamp: Date.now(),
        level: 'info',
        message: `Phase changed: ${from} → ${to}`,
        data: { from, to },
      },
    });
  }

  /**
   * Handle task start events
   */
  private handleTaskStart(event: AgentEvent): void {
    const { task } = event.data;

    this.logger.info('Task started', {
      type: 'task_started',
      taskId: task.id,
      taskTitle: task.title,
    });

    this.eventBus.emit({
      type: 'activity:add',
      timestamp: Date.now(),
      activity: {
        id: uuid(),
        type: 'message',
        timestamp: Date.now(),
        content: `Starting task: ${task.title}`,
        level: 'info',
      },
    });
  }

  /**
   * Handle task complete events
   */
  private handleTaskComplete(event: AgentEvent): void {
    const { task } = event.data;

    this.logger.info('Task completed', {
      type: 'task_completed',
      taskId: task.id,
      taskTitle: task.title,
      status: task.status,
    });

    const level = task.status === 'completed' ? 'success' : 'warning';

    this.eventBus.emit({
      type: 'activity:add',
      timestamp: Date.now(),
      activity: {
        id: uuid(),
        type: 'message',
        timestamp: Date.now(),
        content: `Task ${task.status}: ${task.title}`,
        level,
      },
    });
  }

  /**
   * Handle iteration start events
   */
  private handleIterationStart(event: AgentEvent): void {
    const { iteration, maxIterations } = event.data;

    this.logger.info('Iteration started', {
      type: 'iteration_started',
      iteration,
      maxIterations,
    });

    this.eventBus.emit({
      type: 'activity:add',
      timestamp: Date.now(),
      activity: {
        id: uuid(),
        type: 'message',
        timestamp: Date.now(),
        content: `Iteration ${iteration}/${maxIterations} started`,
        level: 'info',
      },
    });
  }

  /**
   * Handle iteration complete events
   */
  private handleIterationComplete(event: AgentEvent): void {
    const { iteration } = event.data;

    this.logger.info('Iteration completed', {
      type: 'iteration_completed',
      iteration,
    });

    this.eventBus.emit({
      type: 'activity:add',
      timestamp: Date.now(),
      activity: {
        id: uuid(),
        type: 'message',
        timestamp: Date.now(),
        content: `Iteration ${iteration} completed`,
        level: 'success',
      },
    });
  }

  /**
   * Handle error events
   */
  private handleError(event: AgentEvent): void {
    const { error, context } = event.data;

    this.logger.error('Agent error occurred', error, {
      type: 'agent_error',
      context,
    });

    this.eventBus.emit({
      type: 'agent:error',
      timestamp: Date.now(),
      error,
    });
  }

  /**
   * Check if a log type should be displayed
   */
  private shouldDisplay(logType: string): boolean {
    return this.importantLogTypes.has(logType);
  }

  /**
   * Add a log type to the display filter
   */
  addImportantLogType(logType: string): void {
    this.logger.debug('Adding important log type', {
      type: 'log_type_added',
      logType,
    });

    this.importantLogTypes.add(logType);
  }

  /**
   * Remove a log type from the display filter
   */
  removeImportantLogType(logType: string): void {
    this.logger.debug('Removing important log type', {
      type: 'log_type_removed',
      logType,
    });

    this.importantLogTypes.delete(logType);
  }

  /**
   * Get all important log types
   */
  getImportantLogTypes(): string[] {
    return Array.from(this.importantLogTypes);
  }

  /**
   * Manually emit a log activity to TUI
   */
  emitLogActivity(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    this.logger.debug('Manually emitting log activity', {
      type: 'manual_log_activity_emitted',
      level,
      messageLength: message.length,
    });

    this.eventBus.emit({
      type: 'activity:add',
      timestamp: Date.now(),
      activity: {
        id: uuid(),
        type: 'log',
        timestamp: Date.now(),
        level,
        message,
        data,
      },
    });
  }

  /**
   * Disconnect from event emitter
   */
  disconnect(): void {
    this.logger.info('LogAdapter disconnecting', {
      type: 'log_adapter_disconnect',
    });

    this.logger.info('LogAdapter disconnected', {
      type: 'log_adapter_disconnected',
    });
  }
}
