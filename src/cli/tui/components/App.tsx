/**
 * TUI App - Main application component with advanced features
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, useApp, Text, useStdout } from 'ink';
import { v4 as uuid } from 'uuid';
import { Header } from './Header';
import { ContentArea } from './ContentArea';
import { StatusBar } from './StatusBar';
import { AdvancedInput } from './AdvancedInput';
import { TUIEventBus } from '../event-bus';
import { useKeyBindings, getKeyBindingsHelpText } from '../hooks/useKeyBindings';
import { SessionHistoryManager } from '../managers/SessionHistoryManager';
import { AutoSaveManager } from '../managers/AutoSaveManager';
import { calculateContentHeight } from '../constants';
import type { TUIAppProps, TUIState, Activity, AgentPhaseEvent, TUIEvent } from '../types';
import { logger } from '../logger';

/**
 * Main TUI application component with session management and auto-save
 */
export const TUIApp: React.FC<TUIAppProps> = ({
  projectName,
  version,
  sessionId: providedSessionId,
  initialTask,
  config: providedConfig,
  eventBus: providedEventBus,
  enableAutoSave = true,
  autoSaveIntervalMs = 60000,
}) => {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // Generate or use provided session ID
  const [sessionId] = useState(() => providedSessionId || uuid());

  // Use provided event bus or create new one
  const [eventBus] = useState(() => providedEventBus || new TUIEventBus(logger));

  // Terminal height state
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);

  // TUI state
  const [state, setState] = useState<TUIState>({
    agentPhase: 'planning',
    currentTask: null,
    plan: null,
    activities: [],
    isInputFocused: true,
    scrollPosition: 0,
    stats: {
      totalTokens: 0,
      totalCost: 0,
      completedTasks: 0,
      totalTasks: 0,
    },
  });

  const [isOnline] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isInputMultiline, setIsInputMultiline] = useState(false);

  // Managers
  const [historyManager] = useState(() => new SessionHistoryManager({ logger }));
  const [autoSaveManager] = useState(
    () =>
      new AutoSaveManager({
        sessionId,
        intervalMs: autoSaveIntervalMs,
        enabled: enableAutoSave,
        logger,
      })
  );

  /**
   * Calculate content area height based on terminal height and input mode
   */
  const contentHeight = useMemo(() => {
    return calculateContentHeight(terminalHeight, isInputMultiline);
  }, [terminalHeight, isInputMultiline]);

  /**
   * Initialize managers on mount
   */
  useEffect(() => {
    logger.info('TUI App initialized', {
      type: 'tui_app_init',
      sessionId,
      projectName,
      version,
      enableAutoSave,
      hasInitialTask: !!initialTask,
    });

    // Display welcome message if no initial task
    if (!initialTask || initialTask.trim().length === 0) {
      setState((prev) => ({
        ...prev,
        activities: [
          ...prev.activities,
          {
            id: uuid(),
            type: 'message',
            timestamp: Date.now(),
            content: 'Welcome to OpenJRAgent! Enter your task below to get started.',
            level: 'info',
          } as Activity,
        ],
      }));

      logger.info('No initial task, showing welcome message', {
        type: 'tui_welcome',
      });
    } else {
      setHasStarted(true);
      setState((prev) => ({
        ...prev,
        activities: [
          ...prev.activities,
          {
            id: uuid(),
            type: 'message',
            timestamp: Date.now(),
            content: `Starting task: ${initialTask}`,
            level: 'info',
          } as Activity,
        ],
      }));
    }

    // Load history and state
    const initialize = async () => {
      // Load session history
      await historyManager.load(sessionId);

      // Try to restore previous state
      if (enableAutoSave) {
        const restoredState = await autoSaveManager.restore();
        if (restoredState) {
          setState(restoredState);
          logger.info('Previous session state restored', {
            type: 'state_restored',
            activityCount: restoredState.activities.length,
          });
        }

        // Start auto-save
        autoSaveManager.start(() => state);
      }
    };

    initialize().catch((error) => {
      logger.error('Failed to initialize TUI', error as Error, {
        type: 'tui_init_error',
      });
    });

    // Handle terminal resize
    const handleResize = () => {
      setTerminalHeight(stdout.rows || 24);
    };

    stdout.on?.('resize', handleResize);

    // Cleanup on unmount
    return () => {
      logger.info('TUI App unmounting', {
        type: 'tui_app_unmount',
        sessionId,
      });

      autoSaveManager.stop();

      // Cleanup resize listener
      stdout.off?.('resize', handleResize);

      // Save history
      historyManager.save(sessionId).catch((error) => {
        logger.error('Failed to save history on unmount', error as Error);
      });
    };
  }, []);

  /**
   * Mark state as dirty when it changes
   */
  useEffect(() => {
    autoSaveManager.markDirty();
  }, [state]);

  /**
   * Setup event listeners
   */
  useEffect(() => {
    // Listen for phase changes
    eventBus.on('agent:phase', (event: TUIEvent) => {
      const phaseEvent = event as AgentPhaseEvent;
      setState((prev: TUIState) => ({
        ...prev,
        agentPhase: phaseEvent.phase,
      }));

      // Add phase change activity
      addActivity({
        id: uuid(),
        type: 'phase_change',
        timestamp: Date.now(),
        from: state.agentPhase,
        to: phaseEvent.phase,
      });
    });

    // Listen for thinking events
    eventBus.on('agent:thinking', (event: any) => {
      addActivity({
        id: uuid(),
        type: 'thinking',
        timestamp: Date.now(),
        content: event.content,
        source: event.source,
      });
    });

    // Listen for tool call events
    eventBus.on('tool:call', (event: any) => {
      addActivity({
        id: event.id,
        type: 'tool_call',
        timestamp: Date.now(),
        toolName: event.toolName,
        args: event.args,
        status: 'running',
      });
    });

    // Listen for tool result events
    eventBus.on('tool:result', (event: any) => {
      updateActivity(event.id, {
        status: event.success ? 'completed' : 'failed',
        result: event.result,
        error: event.error,
      });
    });

    // Listen for bash events
    eventBus.on('bash:start', (event: any) => {
      addActivity({
        id: event.id,
        type: 'bash',
        timestamp: Date.now(),
        command: event.command,
        status: 'running',
      });
    });

    eventBus.on('bash:output', (event: any) => {
      updateActivity(event.id, {
        output: event.line,
      });
    });

    eventBus.on('bash:complete', (event: any) => {
      updateActivity(event.id, {
        status: event.exitCode === 0 ? 'completed' : 'failed',
        exitCode: event.exitCode,
      });
    });

    // Listen for agent answer events
    eventBus.on('agent:answer', (event: any) => {
      addActivity({
        id: uuid(),
        type: 'answer',
        timestamp: Date.now(),
        content: event.answer,
        source: 'assistant',
      });
    });

    // Listen for error events
    eventBus.on('agent:error', (event: any) => {
      addActivity({
        id: uuid(),
        type: 'error',
        timestamp: Date.now(),
        message: event.error.message,
        error: event.error.toString(),
        stack: event.error.stack,
      });
    });

    // Listen for state updates
    eventBus.on('state:update', (event: any) => {
      setState((prev) => ({
        ...prev,
        ...event.updates,
      }));
    });

    return () => {
      eventBus.removeAllListeners();
    };
  }, [eventBus]);

  /**
   * Add activity helper
   */
  const addActivity = useCallback(
    (activity: Activity) => {
      setState((prev: TUIState) => ({
        ...prev,
        activities: [...prev.activities, activity],
      }));

      if (debugMode) {
        logger.debug('Activity added', {
          type: 'activity_added',
          activityType: activity.type,
          activityId: activity.id,
        });
      }
    },
    [debugMode]
  );

  /**
   * Update activity helper
   */
  const updateActivity = useCallback(
    (activityId: string, updates: Partial<Activity>) => {
      setState((prev: TUIState) => ({
        ...prev,
        activities: prev.activities.map((activity) =>
          activity.id === activityId ? ({ ...activity, ...updates } as Activity) : activity
        ),
      }));

      if (debugMode) {
        logger.debug('Activity updated', {
          type: 'activity_updated',
          activityId,
          updates: Object.keys(updates),
        });
      }
    },
    [debugMode]
  );

  /**
   * Handle user input
   */
  const handleUserInput = useCallback(
    (input: string) => {
      logger.info('User input received', {
        type: 'user_input',
        length: input.length,
        sessionId,
        hasStarted,
      });

      // Add to history
      historyManager.add(input, sessionId);

      // Emit user input event
      eventBus.emit({
        type: 'user:input',
        timestamp: Date.now(),
        input,
      });

      // Add user message activity
      addActivity({
        id: uuid(),
        type: 'message',
        timestamp: Date.now(),
        content: `User: ${input}`,
        level: 'info',
      });

      // Mark as started if this is the first task
      if (!hasStarted) {
        setHasStarted(true);
        logger.info('First task received, marking as started', {
          type: 'first_task_received',
        });
      }

      // Re-enable input after agent completes
      // The input will be disabled while agent is processing via isInputDisabled logic
    },
    [sessionId, eventBus, historyManager, addActivity, hasStarted]
  );

  /**
   * Handle save session
   */
  const handleSaveSession = useCallback(async () => {
    try {
      await autoSaveManager.save();
      await historyManager.save(sessionId);

      addActivity({
        id: uuid(),
        type: 'message',
        timestamp: Date.now(),
        content: 'Session saved successfully',
        level: 'success',
      });

      logger.info('Session saved manually', {
        type: 'session_saved_manual',
        sessionId,
      });
    } catch (error) {
      logger.error('Failed to save session manually', error as Error, {
        type: 'session_save_manual_error',
        sessionId,
      });
    }
  }, [sessionId, autoSaveManager, historyManager, addActivity]);

  /**
   * Handle clear screen
   */
  const handleClearScreen = useCallback(() => {
    setState((prev: TUIState) => ({
      ...prev,
      activities: [],
    }));

    logger.info('Screen cleared', {
      type: 'screen_cleared',
      sessionId,
    });
  }, [sessionId]);

  /**
   * Handle toggle pause
   */
  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);

    addActivity({
      id: uuid(),
      type: 'message',
      timestamp: Date.now(),
      content: isPaused ? 'Agent resumed' : 'Agent paused',
      level: 'info',
    });

    logger.info(isPaused ? 'Agent resumed' : 'Agent paused', {
      type: 'agent_pause_toggle',
      isPaused: !isPaused,
    });
  }, [isPaused, addActivity]);

  /**
   * Handle show help
   */
  const handleShowHelp = useCallback(() => {
    setShowHelp((prev) => !prev);

    logger.info('Help toggled', {
      type: 'help_toggled',
      showHelp: !showHelp,
    });
  }, [showHelp]);

  /**
   * Handle toggle debug mode
   */
  const handleToggleDebug = useCallback(() => {
    setDebugMode((prev) => !prev);

    addActivity({
      id: uuid(),
      type: 'message',
      timestamp: Date.now(),
      content: debugMode ? 'Debug mode disabled' : 'Debug mode enabled',
      level: 'info',
    });

    logger.info('Debug mode toggled', {
      type: 'debug_mode_toggled',
      debugMode: !debugMode,
    });
  }, [debugMode, addActivity]);

  /**
   * Handle export logs
   */
  const handleExportLogs = useCallback(async () => {
    try {
      const timestamp = Date.now();
      const exportPath = `.workspace/sessions/${sessionId}/history-export-${timestamp}.txt`;

      await historyManager.export(exportPath, 'txt');

      addActivity({
        id: uuid(),
        type: 'message',
        timestamp: Date.now(),
        content: `Logs exported to ${exportPath}`,
        level: 'success',
      });

      logger.info('Logs exported', {
        type: 'logs_exported',
        exportPath,
      });
    } catch (error) {
      logger.error('Failed to export logs', error as Error, {
        type: 'logs_export_error',
      });
    }
  }, [sessionId, historyManager, addActivity]);

  /**
   * Setup keyboard shortcuts
   */
  useKeyBindings({
    onExit: exit,
    onSaveSession: handleSaveSession,
    onClearScreen: handleClearScreen,
    onTogglePause: handleTogglePause,
    onShowHelp: handleShowHelp,
    onToggleDebug: handleToggleDebug,
    onExportLogs: handleExportLogs,
  });

  /**
   * Determine if input should be disabled
   */
  const isInputDisabled =
    isPaused ||
    (hasStarted &&
      (state.agentPhase === 'planning' ||
        state.agentPhase === 'executing' ||
        state.agentPhase === 'reflecting' ||
        state.agentPhase === 'answering'));

  /**
   * Get command history for input
   */
  const commandHistory = historyManager.getAll();

  /**
   * Render help overlay
   */
  const renderHelp = () => {
    if (!showHelp) return null;

    return (
      <Box justifyContent="center" alignItems="center">
        <Box borderStyle="double" borderColor="cyan" padding={2} flexDirection="column" width={80}>
          <Text bold color="cyan">
            Keyboard Shortcuts Help
          </Text>
          <Text>{'\n'}</Text>
          <Text>{getKeyBindingsHelpText()}</Text>
          <Text>{'\n'}</Text>
          <Text dimColor>Press F1 to close this help</Text>
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" height={terminalHeight}>
      {/* Header */}
      <Header
        projectName={projectName}
        version={version}
        phase={state.agentPhase}
        isOnline={isOnline}
      />

      {/* Content Area */}
      <Box flexGrow={1} paddingY={1}>
        <ContentArea activities={state.activities} maxHeight={contentHeight} />
      </Box>

      {/* Status Bar */}
      <StatusBar
        completedTasks={state.stats.completedTasks}
        totalTasks={state.stats.totalTasks}
        totalTokens={state.stats.totalTokens}
        totalCost={state.stats.totalCost}
      />

      {/* Advanced Input */}
      <AdvancedInput
        onSubmit={handleUserInput}
        history={commandHistory}
        placeholder={
          isInputDisabled
            ? isPaused
              ? 'Agent is paused (Ctrl+P to resume)...'
              : 'Agent is working...'
            : 'Type your message and press Enter...'
        }
        disabled={isInputDisabled}
        onMultilineChange={setIsInputMultiline}
      />

      {/* Help Overlay */}
      {renderHelp()}

      {/* Debug Info */}
      {debugMode && (
        <Box paddingX={1} borderStyle="single" borderColor="yellow">
          <Text color="yellow" dimColor>
            [DEBUG] Session: {sessionId} | Activities: {state.activities.length} | History:{' '}
            {historyManager.size()} | Paused: {isPaused.toString()}
          </Text>
        </Box>
      )}
    </Box>
  );
};
