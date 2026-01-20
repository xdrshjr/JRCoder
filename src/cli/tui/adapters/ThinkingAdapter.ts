/**
 * ThinkingAdapter - Connects Planner and Reflector thinking process to TUI
 */

import { EventEmitter } from '../../../core/event-emitter';
import { TUIEventBus } from '../event-bus';
import type { ILogger } from '../../../logger/interfaces';
import type { AgentEvent } from '../../../types';
import { v4 as uuid } from 'uuid';

/**
 * Adapter for displaying thinking process from Planner and Reflector
 */
export class ThinkingAdapter {
  private logger: ILogger;
  private eventBus: TUIEventBus;

  constructor(eventBus: TUIEventBus, logger: ILogger) {
    this.eventBus = eventBus;
    this.logger = logger;

    this.logger.debug('ThinkingAdapter initialized', {
      type: 'thinking_adapter_initialized',
    });
  }

  /**
   * Connect to the agent's event emitter to listen for thinking events
   */
  connect(agentEventEmitter: EventEmitter): void {
    this.logger.info('ThinkingAdapter connecting to agent event emitter', {
      type: 'thinking_adapter_connect',
    });

    // Listen for planning phase events
    agentEventEmitter.on('phase_changed', (event: AgentEvent) => {
      if (event.data.phase === 'planning') {
        this.logger.debug('Planning phase started, monitoring thinking process', {
          type: 'planning_phase_started',
        });

        this.eventBus.emit({
          type: 'agent:thinking',
          timestamp: Date.now(),
          content: 'Analyzing task complexity and generating plan...',
          source: 'planner',
        });
      }
    });

    // Listen for reflection phase events
    agentEventEmitter.on('phase_changed', (event: AgentEvent) => {
      if (event.data.phase === 'reflecting') {
        this.logger.debug('Reflection phase started, monitoring thinking process', {
          type: 'reflection_phase_started',
        });

        this.eventBus.emit({
          type: 'agent:thinking',
          timestamp: Date.now(),
          content: 'Evaluating execution results and generating feedback...',
          source: 'reflector',
        });
      }
    });

    // Listen for iteration completed to show summary
    agentEventEmitter.on('iteration_completed', (event: AgentEvent) => {
      this.logger.debug('Iteration completed, showing summary', {
        type: 'iteration_completed',
        iteration: event.data.iteration,
      });

      this.eventBus.emit({
        type: 'agent:thinking',
        timestamp: Date.now(),
        content: `Iteration ${event.data.iteration} completed`,
        source: 'executor',
      });
    });

    this.logger.info('ThinkingAdapter connected successfully', {
      type: 'thinking_adapter_connected',
    });
  }

  /**
   * Emit a thinking activity to the TUI
   */
  emitThinking(content: string, source: 'planner' | 'reflector' | 'executor'): void {
    this.logger.debug('Emitting thinking activity', {
      type: 'thinking_activity_emitted',
      source,
      contentLength: content.length,
    });

    this.eventBus.emit({
      type: 'agent:thinking',
      timestamp: Date.now(),
      content,
      source,
    });
  }

  /**
   * Emit planner thinking
   */
  emitPlannerThinking(content: string): void {
    this.logger.debug('Emitting planner thinking', {
      type: 'planner_thinking_emitted',
      contentLength: content.length,
    });

    this.emitThinking(content, 'planner');
  }

  /**
   * Emit reflector thinking
   */
  emitReflectorThinking(content: string): void {
    this.logger.debug('Emitting reflector thinking', {
      type: 'reflector_thinking_emitted',
      contentLength: content.length,
    });

    this.emitThinking(content, 'reflector');
  }

  /**
   * Emit executor thinking
   */
  emitExecutorThinking(content: string): void {
    this.logger.debug('Emitting executor thinking', {
      type: 'executor_thinking_emitted',
      contentLength: content.length,
    });

    this.emitThinking(content, 'executor');
  }

  /**
   * Disconnect from event emitter
   */
  disconnect(): void {
    this.logger.info('ThinkingAdapter disconnecting', {
      type: 'thinking_adapter_disconnect',
    });

    // Event cleanup is handled by the agent event emitter
    this.logger.info('ThinkingAdapter disconnected', {
      type: 'thinking_adapter_disconnected',
    });
  }
}
