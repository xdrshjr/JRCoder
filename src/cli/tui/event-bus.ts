/**
 * TUI Event Bus - Event-driven communication for TUI components
 */

import type { TUIEvent, TUIEventType } from './types';
import type { ILogger } from '../../logger/interfaces';

export type TUIEventListener = (event: TUIEvent) => void;

/**
 * TUI Event Bus for managing event communication between components
 */
export class TUIEventBus {
  private listeners: Map<TUIEventType, TUIEventListener[]> = new Map();
  private logger: ILogger | null = null;

  /**
   * Create a new TUI event bus
   */
  constructor(logger?: ILogger) {
    this.logger = logger || null;
  }

  /**
   * Register an event listener
   */
  on(eventType: TUIEventType, listener: TUIEventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    this.listeners.get(eventType)!.push(listener);

    this.logger?.debug(`TUI event listener registered for: ${eventType}`, {
      type: 'tui_event_listener_registered',
      eventType,
    });
  }

  /**
   * Remove an event listener
   */
  off(eventType: TUIEventType, listener: TUIEventListener): void {
    const listeners = this.listeners.get(eventType);
    if (!listeners) {
      return;
    }

    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);

      this.logger?.debug(`TUI event listener removed for: ${eventType}`, {
        type: 'tui_event_listener_removed',
        eventType,
      });
    }
  }

  /**
   * Emit an event to all registered listeners
   */
  emit(event: TUIEvent): void {
    const listeners = this.listeners.get(event.type);
    if (!listeners || listeners.length === 0) {
      return;
    }

    this.logger?.debug(`TUI event emitted: ${event.type}`, {
      type: 'tui_event_emitted',
      eventType: event.type,
      listenerCount: listeners.length,
    });

    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        this.logger?.error(`Error in TUI event listener for ${event.type}`, error as Error, {
          type: 'tui_event_listener_error',
          eventType: event.type,
        });
      }
    }
  }

  /**
   * Register a one-time event listener
   */
  once(eventType: TUIEventType, listener: TUIEventListener): void {
    const onceListener: TUIEventListener = (event) => {
      listener(event);
      this.off(eventType, onceListener);
    };

    this.on(eventType, onceListener);

    this.logger?.debug(`TUI one-time event listener registered for: ${eventType}`, {
      type: 'tui_event_listener_once_registered',
      eventType,
    });
  }

  /**
   * Remove all listeners for a specific event type
   */
  removeAllListeners(eventType?: TUIEventType): void {
    if (eventType) {
      this.listeners.delete(eventType);

      this.logger?.debug(`All TUI event listeners removed for: ${eventType}`, {
        type: 'tui_event_listeners_removed',
        eventType,
      });
    } else {
      this.listeners.clear();

      this.logger?.debug('All TUI event listeners removed', {
        type: 'tui_event_listeners_cleared',
      });
    }
  }

  /**
   * Get the number of listeners for an event type
   */
  listenerCount(eventType: TUIEventType): number {
    return this.listeners.get(eventType)?.length || 0;
  }

  /**
   * Check if there are any listeners for an event type
   */
  hasListeners(eventType: TUIEventType): boolean {
    return this.listenerCount(eventType) > 0;
  }

  /**
   * Get all registered event types
   */
  getEventTypes(): TUIEventType[] {
    return Array.from(this.listeners.keys());
  }
}
