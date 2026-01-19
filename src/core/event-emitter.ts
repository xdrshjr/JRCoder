/**
 * Event Emitter for Agent events
 */

import type { EventType, AgentEvent } from '../types';

export type EventListener = (event: AgentEvent) => void;

/**
 * Simple event emitter for Agent lifecycle events
 */
export class EventEmitter {
  private listeners: Map<EventType, EventListener[]> = new Map();

  /**
   * Register an event listener
   */
  on(eventType: EventType, listener: EventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  }

  /**
   * Remove an event listener
   */
  off(eventType: EventType, listener: EventListener): void {
    const listeners = this.listeners.get(eventType);
    if (!listeners) return;

    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Emit an event to all registered listeners
   */
  emit(event: AgentEvent): void {
    const listeners = this.listeners.get(event.type);
    if (!listeners) return;

    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in event listener for ${event.type}:`, error);
      }
    }
  }

  /**
   * Register a one-time event listener
   */
  once(eventType: EventType, listener: EventListener): void {
    const onceListener: EventListener = (event) => {
      listener(event);
      this.off(eventType, onceListener);
    };
    this.on(eventType, onceListener);
  }

  /**
   * Remove all listeners for a specific event type
   */
  removeAllListeners(eventType?: EventType): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event type
   */
  listenerCount(eventType: EventType): number {
    return this.listeners.get(eventType)?.length || 0;
  }
}
