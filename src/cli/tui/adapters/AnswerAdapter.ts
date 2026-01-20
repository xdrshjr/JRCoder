/**
 * AnswerAdapter - Connects simple task answers to TUI
 */

import { EventEmitter } from '../../../core/event-emitter';
import { TUIEventBus } from '../event-bus';
import type { ILogger } from '../../../logger/interfaces';
import type { AgentEvent } from '../../../types';

/**
 * Adapter for displaying simple task answers from Agent
 */
export class AnswerAdapter {
  private logger: ILogger;
  private eventBus: TUIEventBus;

  constructor(eventBus: TUIEventBus, logger: ILogger) {
    this.eventBus = eventBus;
    this.logger = logger;

    this.logger.debug('AnswerAdapter initialized', {
      type: 'answer_adapter_initialized',
    });
  }

  /**
   * Connect to agent's event emitter to listen for simple answer events
   */
  connect(agentEventEmitter: EventEmitter): void {
    this.logger.info('AnswerAdapter connecting to agent event emitter', {
      type: 'answer_adapter_connect',
    });

    // Listen for simple answer events
    agentEventEmitter.on('simple_answer', (event: AgentEvent) => {
      this.handleSimpleAnswer(event);
    });

    this.logger.info('AnswerAdapter connected successfully', {
      type: 'answer_adapter_connected',
    });
  }

  /**
   * Handle simple answer event
   */
  private handleSimpleAnswer(event: AgentEvent): void {
    this.logger.info('Simple answer received', {
      type: 'simple_answer_received',
      answerLength: event.data?.answer?.length || 0,
    });

    // Emit answer event to TUI
    this.eventBus.emit({
      type: 'agent:answer',
      timestamp: Date.now(),
      answer: event.data?.answer || '',
    });

    this.logger.debug('Answer event emitted to TUI', {
      type: 'answer_event_emitted',
    });
  }

  /**
   * Disconnect from event emitter
   */
  disconnect(): void {
    this.logger.info('AnswerAdapter disconnecting', {
      type: 'answer_adapter_disconnect',
    });

    // Event cleanup is handled by agent event emitter
    this.logger.info('AnswerAdapter disconnected', {
      type: 'answer_adapter_disconnected',
    });
  }
}
