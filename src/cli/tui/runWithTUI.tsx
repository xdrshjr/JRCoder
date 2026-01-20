/**
 * runWithTUI - Main integration function to run Agent with TUI
 */

import React from 'react';
import { render } from 'ink';
import { v4 as uuid } from 'uuid';
import { TUIApp } from './components/App';
import { TUIEventBus } from './event-bus';
import { ThinkingAdapter, ToolAdapter, BashAdapter, LogAdapter, AnswerAdapter } from './adapters';
import { Agent } from '../../core/agent';
import type { GlobalConfig } from '../../types';
import type { ILogger } from '../../logger/interfaces';
import { logger as defaultLogger } from './logger';

export interface RunWithTUIOptions {
  task: string;
  config: GlobalConfig;
  logger?: ILogger;
  sessionId?: string;
  projectName?: string;
  version?: string;
}

/**
 * Run the Agent with TUI interface
 *
 * This function integrates the Agent system with the TUI by:
 * 1. Initializing the TUI event bus
 * 2. Creating all necessary adapters
 * 3. Rendering the TUI App component
 * 4. Creating the Agent instance (if task is provided)
 * 5. Connecting adapters to Agent components
 * 6. Running the Agent (if task is provided)
 * 7. Waiting for user exit
 */
export async function runWithTUI(options: RunWithTUIOptions): Promise<void> {
  const {
    task,
    config,
    logger = defaultLogger,
    sessionId = uuid(),
    projectName = 'OpenJRAgent',
    version = '1.0.0',
  } = options;

  const hasInitialTask = task && task.trim().length > 0;

  logger.info('Starting Agent with TUI', {
    type: 'run_with_tui_start',
    sessionId,
    task,
    hasInitialTask,
    projectName,
    version,
  });

  // 1. Initialize TUI event bus
  const eventBus = new TUIEventBus(logger);

  logger.debug('TUI event bus initialized', {
    type: 'tui_event_bus_init',
  });

  // 2. Create adapters
  const thinkingAdapter = new ThinkingAdapter(eventBus, logger);
  const toolAdapter = new ToolAdapter(eventBus, logger);
  const bashAdapter = new BashAdapter(eventBus, logger);
  const logAdapter = new LogAdapter(eventBus, logger);
  const answerAdapter = new AnswerAdapter(eventBus, logger);

  logger.debug('TUI adapters created', {
    type: 'tui_adapters_created',
    adapters: ['thinking', 'tool', 'bash', 'log', 'answer'],
  });

  // 3. Render TUI App
  const { unmount, waitUntilExit } = render(
    <TUIApp
      projectName={projectName}
      version={version}
      sessionId={sessionId}
      enableAutoSave={config.agent.autoSave}
      autoSaveIntervalMs={config.agent.saveInterval * 1000} // Convert seconds to milliseconds
      initialTask={task}
      config={config}
      eventBus={eventBus}
    />
  );

  logger.info('TUI App rendered', {
    type: 'tui_app_rendered',
    sessionId,
  });

  // 4. Create Agent instance only if we have an initial task
  let agent: Agent | null = null;

  if (hasInitialTask) {
    agent = new Agent(config, logger);

    logger.info('Agent instance created', {
      type: 'agent_created',
      sessionId,
    });

    // 5. Connect adapters to Agent components
    try {
      const agentEventEmitter = agent.getEventEmitter();

      // Connect all adapters
      thinkingAdapter.connect(agentEventEmitter);
      toolAdapter.connect(agentEventEmitter);
      bashAdapter.connect(agentEventEmitter);
      logAdapter.connect(agentEventEmitter);
      answerAdapter.connect(agentEventEmitter);

      // Connect phase change events
      agentEventEmitter.on('phase_changed', (event) => {
        eventBus.emit({
          type: 'agent:phase',
          timestamp: Date.now(),
          phase: event.data.phase,
        });
      });

      // Connect task completion events for stats update
      agentEventEmitter.on('task_completed', (event) => {
        const state = agent!.getStateManager().getState();

        eventBus.emit({
          type: 'state:update',
          timestamp: Date.now(),
          updates: {
            stats: {
              totalTokens: state.metadata?.totalTokens || 0,
              totalCost: state.metadata?.totalCost || 0,
              completedTasks: state.plan?.tasks.filter((t) => t.status === 'completed').length || 0,
              totalTasks: state.plan?.tasks.length || 0,
            },
          },
        });
      });

      logger.info('All adapters connected to Agent', {
        type: 'adapters_connected',
        sessionId,
      });

      // 6. Run the Agent in the background
      logger.info('Starting Agent execution', {
        type: 'agent_execution_start',
        task,
      });

      // Run agent without blocking TUI
      agent.run(task).catch((error) => {
        logger.error('Agent execution failed', error as Error, {
          type: 'agent_execution_error',
          task,
        });

        // Emit error event to TUI
        eventBus.emit({
          type: 'agent:error',
          timestamp: Date.now(),
          error: {
            name: (error as Error).name || 'Error',
            message: (error as Error).message,
            stack: (error as Error).stack,
          } as any,
        });
      });
    } catch (error) {
      logger.error('Failed to connect adapters', error as Error, {
        type: 'adapter_connection_error',
        sessionId,
      });

      throw error;
    }
  } else {
    logger.info('No initial task provided, waiting for user input', {
      type: 'no_initial_task',
      sessionId,
    });

    // Listen for user input to create and run agent
    eventBus.on('user:input', async (event: any) => {
      const userTask = event.input.trim();

      if (!userTask) {
        logger.warn('Empty user input received', {
          type: 'empty_user_input',
        });
        return;
      }

      logger.info('User task received, creating Agent', {
        type: 'user_task_received',
        task: userTask,
      });

      // Create agent with user's task
      agent = new Agent(config, logger);

      const agentEventEmitter = agent.getEventEmitter();

      // Connect all adapters
      thinkingAdapter.connect(agentEventEmitter);
      toolAdapter.connect(agentEventEmitter);
      bashAdapter.connect(agentEventEmitter);
      logAdapter.connect(agentEventEmitter);
      answerAdapter.connect(agentEventEmitter);

      // Connect phase change events
      agentEventEmitter.on('phase_changed', (phaseEvent) => {
        eventBus.emit({
          type: 'agent:phase',
          timestamp: Date.now(),
          phase: phaseEvent.data.phase,
        });
      });

      // Connect task completion events for stats update
      agentEventEmitter.on('task_completed', (taskEvent) => {
        const state = agent!.getStateManager().getState();

        eventBus.emit({
          type: 'state:update',
          timestamp: Date.now(),
          updates: {
            stats: {
              totalTokens: state.metadata?.totalTokens || 0,
              totalCost: state.metadata?.totalCost || 0,
              completedTasks: state.plan?.tasks.filter((t) => t.status === 'completed').length || 0,
              totalTasks: state.plan?.tasks.length || 0,
            },
          },
        });
      });

      logger.info('Agent created and adapters connected', {
        type: 'agent_created_from_user_input',
      });

      // Run agent
      agent.run(userTask).catch((error) => {
        logger.error('Agent execution failed', error as Error, {
          type: 'agent_execution_error',
          task: userTask,
        });

        // Emit error event to TUI
        eventBus.emit({
          type: 'agent:error',
          timestamp: Date.now(),
          error: {
            name: (error as Error).name || 'Error',
            message: (error as Error).message,
            stack: (error as Error).stack,
          } as any,
        });
      });
    });
  }

  try {
    // 7. Wait for user exit
    await waitUntilExit();

    logger.info('User exited TUI', {
      type: 'tui_exit',
      sessionId,
    });
  } catch (error) {
    logger.error('Failed to run Agent with TUI', error as Error, {
      type: 'run_with_tui_error',
      sessionId,
    });

    throw error;
  } finally {
    // Cleanup
    logger.info('Cleaning up TUI resources', {
      type: 'tui_cleanup',
      sessionId,
    });

    // Disconnect adapters
    thinkingAdapter.disconnect();
    toolAdapter.disconnect();
    bashAdapter.disconnect();
    logAdapter.disconnect();
    answerAdapter.disconnect();

    // Unmount TUI
    unmount();

    logger.info('TUI cleanup complete', {
      type: 'tui_cleanup_complete',
      sessionId,
    });
  }
}
