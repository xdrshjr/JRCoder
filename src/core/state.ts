/**
 * State Manager for Agent execution state
 */

import { promises as fs } from 'fs';
import { dirname } from 'path';
import type { AgentState, AgentPhase, Plan, Message, GlobalConfig, EventType } from '../types';
import type { ILogger } from '../llm/types';
import { EventEmitter, type EventListener } from './event-emitter';
import { generateId } from '../utils';

/**
 * Manages the Agent's execution state
 */
export class StateManager {
  private state: AgentState;
  private logger: ILogger;
  private eventEmitter: EventEmitter;

  constructor(config: GlobalConfig, logger: ILogger) {
    this.logger = logger;
    this.eventEmitter = new EventEmitter();
    this.state = this.initializeState(config);
  }

  /**
   * Initialize a new agent state
   */
  private initializeState(config: GlobalConfig): AgentState {
    return {
      phase: 'planning',
      plan: undefined,
      conversation: {
        id: generateId(),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      currentIteration: 0,
      maxIterations: config.agent.maxIterations,
      startTime: Date.now(),
      endTime: undefined,
      metadata: {
        totalTokens: 0,
        totalCost: 0,
        toolCallsCount: 0,
      },
    };
  }

  /**
   * Get a copy of the current state
   */
  getState(): AgentState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Update the current phase
   */
  updatePhase(phase: AgentPhase): void {
    this.state.phase = phase;
    this.eventEmitter.emit({
      type: 'phase_changed',
      timestamp: Date.now(),
      data: { phase },
    });
    this.logger.info(`Phase changed to: ${phase}`);
  }

  /**
   * Set the execution plan
   */
  setPlan(plan: Plan): void {
    this.state.plan = plan;
    this.logger.info('Plan set', { taskCount: plan.tasks.length });
  }

  /**
   * Increment the iteration counter
   */
  incrementIteration(): void {
    this.state.currentIteration++;
    this.eventEmitter.emit({
      type: 'iteration_started',
      timestamp: Date.now(),
      data: { iteration: this.state.currentIteration },
    });
    this.logger.info(`Iteration ${this.state.currentIteration} started`);
  }

  /**
   * Add a message to the conversation
   */
  addMessage(message: Message): void {
    this.state.conversation.messages.push(message);
    this.state.conversation.updatedAt = Date.now();
  }

  /**
   * Update metadata
   */
  updateMetadata(updates: Partial<AgentState['metadata']>): void {
    this.state.metadata = { ...this.state.metadata, ...updates };
  }

  /**
   * Mark the agent as completed
   */
  markCompleted(): void {
    this.state.endTime = Date.now();
    this.updatePhase('completed');
  }

  /**
   * Mark the agent as failed
   */
  markFailed(): void {
    this.state.endTime = Date.now();
    this.updatePhase('failed');
  }

  /**
   * Save state to file
   */
  async save(path: string): Promise<void> {
    try {
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.writeFile(path, JSON.stringify(this.state, null, 2), 'utf8');
      this.logger.info(`State saved to: ${path}`);
    } catch (error) {
      this.logger.error('Failed to save state', error as Error);
      throw error;
    }
  }

  /**
   * Load state from file
   */
  async load(path: string): Promise<void> {
    try {
      const content = await fs.readFile(path, 'utf8');
      this.state = JSON.parse(content);
      this.logger.info(`State loaded from: ${path}`);
    } catch (error) {
      this.logger.error('Failed to load state', error as Error);
      throw error;
    }
  }

  /**
   * Subscribe to events
   */
  on(eventType: EventType, listener: EventListener): void {
    this.eventEmitter.on(eventType, listener);
  }

  /**
   * Unsubscribe from events
   */
  off(eventType: EventType, listener: EventListener): void {
    this.eventEmitter.off(eventType, listener);
  }

  /**
   * Get the event emitter
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }
}
