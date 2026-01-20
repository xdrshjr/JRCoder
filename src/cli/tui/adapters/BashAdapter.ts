/**
 * BashAdapter - Connects bash/shell command execution to TUI
 */

import { EventEmitter } from '../../../core/event-emitter';
import { TUIEventBus } from '../event-bus';
import type { ILogger } from '../../../logger/interfaces';
import type { AgentEvent, ToolCall, ToolResult } from '../../../types';

/**
 * Adapter for displaying bash command execution
 */
export class BashAdapter {
  private logger: ILogger;
  private eventBus: TUIEventBus;
  private activeBashCommands: Map<string, string> = new Map(); // toolCallId -> activityId

  constructor(eventBus: TUIEventBus, logger: ILogger) {
    this.eventBus = eventBus;
    this.logger = logger;

    this.logger.debug('BashAdapter initialized', {
      type: 'bash_adapter_initialized',
    });
  }

  /**
   * Connect to the agent's event emitter to listen for shell execution events
   */
  connect(agentEventEmitter: EventEmitter): void {
    this.logger.info('BashAdapter connecting to agent event emitter', {
      type: 'bash_adapter_connect',
    });

    // Listen for tool call events and filter for shell_exec
    agentEventEmitter.on('tool_called', (event: AgentEvent) => {
      const toolCall = event.data as ToolCall;
      if (toolCall.name === 'shell_exec') {
        this.handleBashStart(toolCall);
      }
    });

    // Listen for tool completion events and filter for shell_exec
    agentEventEmitter.on('tool_completed', (event: AgentEvent) => {
      const { toolCall, result } = event.data as {
        toolCall: ToolCall;
        result: ToolResult;
      };
      if (toolCall.name === 'shell_exec') {
        this.handleBashComplete(toolCall, result);
      }
    });

    this.logger.info('BashAdapter connected successfully', {
      type: 'bash_adapter_connected',
    });
  }

  /**
   * Handle bash command start
   */
  private handleBashStart(toolCall: ToolCall): void {
    const command = toolCall.arguments.command as string;

    this.logger.info('Bash command started', {
      type: 'bash_command_started',
      command,
      toolCallId: toolCall.id,
      cwd: toolCall.arguments.cwd,
    });

    // Emit bash start event to TUI
    this.eventBus.emit({
      type: 'bash:start',
      timestamp: Date.now(),
      id: toolCall.id,
      command,
    });

    // Track active bash command
    this.activeBashCommands.set(toolCall.id, toolCall.id);

    this.logger.debug('Bash command activity added to TUI', {
      type: 'bash_activity_added',
      toolCallId: toolCall.id,
      activeBashCommandsCount: this.activeBashCommands.size,
    });
  }

  /**
   * Handle bash command completion
   */
  private handleBashComplete(toolCall: ToolCall, result: ToolResult): void {
    const command = toolCall.arguments.command as string;
    const exitCode = result.success ? (result.data?.exitCode ?? 0) : (result.data?.exitCode ?? 1);

    this.logger.info('Bash command completed', {
      type: 'bash_command_completed',
      command,
      toolCallId: toolCall.id,
      exitCode,
      success: result.success,
      executionTime: result.metadata?.executionTime,
    });

    // Emit output if available
    if (result.data) {
      const stdout = result.data.stdout || '';
      const stderr = result.data.stderr || '';
      const output = this.formatOutput(stdout, stderr);

      if (output) {
        this.eventBus.emit({
          type: 'bash:output',
          timestamp: Date.now(),
          id: toolCall.id,
          line: output,
        });
      }
    }

    // Emit bash complete event to TUI
    this.eventBus.emit({
      type: 'bash:complete',
      timestamp: Date.now(),
      id: toolCall.id,
      exitCode,
    });

    // Remove from active bash commands
    this.activeBashCommands.delete(toolCall.id);

    this.logger.debug('Bash command activity updated in TUI', {
      type: 'bash_activity_updated',
      toolCallId: toolCall.id,
      activeBashCommandsCount: this.activeBashCommands.size,
    });
  }

  /**
   * Format command output for display
   */
  private formatOutput(stdout: string, stderr: string): string {
    let output = '';

    if (stdout && stdout.trim()) {
      output += stdout.trim();
    }

    if (stderr && stderr.trim()) {
      if (output) {
        output += '\n';
      }
      output += `[stderr] ${stderr.trim()}`;
    }

    // Truncate long output
    const maxLength = 1000;
    if (output.length > maxLength) {
      output = output.substring(0, maxLength) + '\n... (output truncated)';
    }

    return output;
  }

  /**
   * Emit a bash command start manually
   */
  emitBashStart(id: string, command: string): void {
    this.logger.debug('Manually emitting bash start', {
      type: 'manual_bash_start_emitted',
      command,
      id,
    });

    this.eventBus.emit({
      type: 'bash:start',
      timestamp: Date.now(),
      id,
      command,
    });

    this.activeBashCommands.set(id, id);
  }

  /**
   * Emit bash output manually
   */
  emitBashOutput(id: string, line: string): void {
    this.logger.debug('Manually emitting bash output', {
      type: 'manual_bash_output_emitted',
      id,
      lineLength: line.length,
    });

    this.eventBus.emit({
      type: 'bash:output',
      timestamp: Date.now(),
      id,
      line,
    });
  }

  /**
   * Emit bash complete manually
   */
  emitBashComplete(id: string, exitCode: number): void {
    this.logger.debug('Manually emitting bash complete', {
      type: 'manual_bash_complete_emitted',
      id,
      exitCode,
    });

    this.eventBus.emit({
      type: 'bash:complete',
      timestamp: Date.now(),
      id,
      exitCode,
    });

    this.activeBashCommands.delete(id);
  }

  /**
   * Get count of active bash commands
   */
  getActiveBashCommandsCount(): number {
    return this.activeBashCommands.size;
  }

  /**
   * Check if a bash command is active
   */
  isBashCommandActive(id: string): boolean {
    return this.activeBashCommands.has(id);
  }

  /**
   * Disconnect from event emitter
   */
  disconnect(): void {
    this.logger.info('BashAdapter disconnecting', {
      type: 'bash_adapter_disconnect',
      activeBashCommandsCount: this.activeBashCommands.size,
    });

    // Clear active bash commands
    this.activeBashCommands.clear();

    this.logger.info('BashAdapter disconnected', {
      type: 'bash_adapter_disconnected',
    });
  }
}
