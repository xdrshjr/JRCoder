/**
 * ToolAdapter - Connects tool execution to TUI
 */

import { EventEmitter } from '../../../core/event-emitter';
import { TUIEventBus } from '../event-bus';
import type { ILogger } from '../../../logger/interfaces';
import type { AgentEvent, ToolCall, ToolResult } from '../../../types';
import type { ToolCallActivity } from '../types';

/**
 * Adapter for displaying tool calls and their lifecycle
 */
export class ToolAdapter {
  private logger: ILogger;
  private eventBus: TUIEventBus;
  private activeToolCalls: Map<string, string> = new Map(); // toolCallId -> activityId

  constructor(eventBus: TUIEventBus, logger: ILogger) {
    this.eventBus = eventBus;
    this.logger = logger;

    this.logger.debug('ToolAdapter initialized', {
      type: 'tool_adapter_initialized',
    });
  }

  /**
   * Connect to the agent's event emitter to listen for tool events
   */
  connect(agentEventEmitter: EventEmitter): void {
    this.logger.info('ToolAdapter connecting to agent event emitter', {
      type: 'tool_adapter_connect',
    });

    // Listen for tool call events
    agentEventEmitter.on('tool_called', (event: AgentEvent) => {
      this.handleToolCalled(event.data as ToolCall);
    });

    // Listen for tool completion events
    agentEventEmitter.on('tool_completed', (event: AgentEvent) => {
      this.handleToolCompleted(event.data.toolCall as ToolCall, event.data.result as ToolResult);
    });

    this.logger.info('ToolAdapter connected successfully', {
      type: 'tool_adapter_connected',
    });
  }

  /**
   * Handle tool call start
   */
  private handleToolCalled(toolCall: ToolCall): void {
    this.logger.info('Tool call started', {
      type: 'tool_call_started',
      toolName: toolCall.name,
      toolCallId: toolCall.id,
      argsCount: Object.keys(toolCall.arguments).length,
    });

    // Emit tool call event to TUI
    this.eventBus.emit({
      type: 'tool:call',
      timestamp: Date.now(),
      id: toolCall.id,
      toolName: toolCall.name,
      args: toolCall.arguments,
    });

    // Track active tool call
    this.activeToolCalls.set(toolCall.id, toolCall.id);

    this.logger.debug('Tool call activity added to TUI', {
      type: 'tool_call_activity_added',
      toolCallId: toolCall.id,
      activeToolCallsCount: this.activeToolCalls.size,
    });
  }

  /**
   * Handle tool call completion
   */
  private handleToolCompleted(toolCall: ToolCall, result: ToolResult): void {
    this.logger.info('Tool call completed', {
      type: 'tool_call_completed',
      toolName: toolCall.name,
      toolCallId: toolCall.id,
      success: result.success,
      executionTime: result.metadata?.executionTime,
    });

    // Emit tool result event to TUI
    this.eventBus.emit({
      type: 'tool:result',
      timestamp: Date.now(),
      id: toolCall.id,
      success: result.success,
      result: result.success ? this.formatResult(result.data) : undefined,
      error: result.error,
    });

    // Remove from active tool calls
    this.activeToolCalls.delete(toolCall.id);

    this.logger.debug('Tool call activity updated in TUI', {
      type: 'tool_call_activity_updated',
      toolCallId: toolCall.id,
      activeToolCallsCount: this.activeToolCalls.size,
    });
  }

  /**
   * Format tool result for display
   */
  private formatResult(data: any): string {
    if (data === null || data === undefined) {
      return 'No data returned';
    }

    if (typeof data === 'string') {
      // Truncate long strings
      return data.length > 200 ? `${data.substring(0, 200)}...` : data;
    }

    if (typeof data === 'object') {
      try {
        const json = JSON.stringify(data, null, 2);
        return json.length > 200 ? `${json.substring(0, 200)}...` : json;
      } catch {
        return '[Object]';
      }
    }

    return String(data);
  }

  /**
   * Emit a tool call manually
   */
  emitToolCall(id: string, toolName: string, args: Record<string, any>): void {
    this.logger.debug('Manually emitting tool call', {
      type: 'manual_tool_call_emitted',
      toolName,
      toolCallId: id,
    });

    this.eventBus.emit({
      type: 'tool:call',
      timestamp: Date.now(),
      id,
      toolName,
      args,
    });

    this.activeToolCalls.set(id, id);
  }

  /**
   * Emit a tool result manually
   */
  emitToolResult(id: string, success: boolean, result?: string, error?: string): void {
    this.logger.debug('Manually emitting tool result', {
      type: 'manual_tool_result_emitted',
      toolCallId: id,
      success,
    });

    this.eventBus.emit({
      type: 'tool:result',
      timestamp: Date.now(),
      id,
      success,
      result,
      error,
    });

    this.activeToolCalls.delete(id);
  }

  /**
   * Get count of active tool calls
   */
  getActiveToolCallsCount(): number {
    return this.activeToolCalls.size;
  }

  /**
   * Check if a tool call is active
   */
  isToolCallActive(toolCallId: string): boolean {
    return this.activeToolCalls.has(toolCallId);
  }

  /**
   * Disconnect from event emitter
   */
  disconnect(): void {
    this.logger.info('ToolAdapter disconnecting', {
      type: 'tool_adapter_disconnect',
      activeToolCallsCount: this.activeToolCalls.size,
    });

    // Clear active tool calls
    this.activeToolCalls.clear();

    this.logger.info('ToolAdapter disconnected', {
      type: 'tool_adapter_disconnected',
    });
  }
}
