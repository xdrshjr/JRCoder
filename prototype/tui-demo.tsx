#!/usr/bin/env node
/**
 * OpenJRAgent TUI Prototype Demo
 *
 * This is a simple prototype to demonstrate the TUI layout and basic functionality.
 * It simulates agent execution without actually connecting to the real agent system.
 *
 * Usage:
 *   npm install
 *   npx ts-node prototype/tui-demo.tsx
 */

import React, { useState, useEffect, FC } from 'react';
import { render, Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';

// ============================================================================
// Types
// ============================================================================

type AgentPhase = 'planning' | 'executing' | 'reflecting' | 'completed';
type ActivityStatus = 'pending' | 'running' | 'completed' | 'failed';

interface Activity {
  id: number;
  type: 'thinking' | 'tool' | 'bash' | 'message';
  timestamp: Date;
  content: string;
  status?: ActivityStatus;
  details?: string;
}

// ============================================================================
// Header Component
// ============================================================================

interface HeaderProps {
  projectName: string;
  version: string;
  phase: AgentPhase;
  isOnline: boolean;
}

const Header: FC<HeaderProps> = ({ projectName, version, phase, isOnline }) => {
  const phaseColors = {
    planning: 'blue',
    executing: 'cyan',
    reflecting: 'magenta',
    completed: 'green'
  };

  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1} justifyContent="space-between">
      <Box>
        <Text bold>{projectName}</Text>
        <Text dimColor> v{version}</Text>
      </Box>
      <Box marginX={2}>
        <Text color={phaseColors[phase]}>Phase: {phase.toUpperCase()}</Text>
      </Box>
      <Box>
        <Text color={isOnline ? 'green' : 'red'}>
          {isOnline ? 'Online' : 'Offline'}
        </Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Activity Item Component
// ============================================================================

interface ActivityItemProps {
  activity: Activity;
  isLatest: boolean;
}

const ActivityItem: FC<ActivityItemProps> = ({ activity, isLatest }) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const renderIcon = () => {
    if (activity.status === 'running') {
      return <Text color="cyan"><Spinner type="dots" /></Text>;
    }
    if (activity.status === 'completed') {
      return <Text color="green">✓</Text>;
    }
    if (activity.status === 'failed') {
      return <Text color="red">✗</Text>;
    }
    return null;
  };

  const typeLabels = {
    thinking: '[Thinking]',
    tool: '[Tool Call]',
    bash: '[Bash]',
    message: '[Message]'
  };

  const typeColors = {
    thinking: 'gray',
    tool: 'cyan',
    bash: 'yellow',
    message: 'white'
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>{formatTime(activity.timestamp)} </Text>
        {renderIcon()}
        <Text color={typeColors[activity.type]}> {typeLabels[activity.type]}</Text>
        <Text bold={isLatest}> {activity.content}</Text>
      </Box>
      {activity.details && (
        <Box marginLeft={2}>
          <Text dimColor>{activity.details}</Text>
        </Box>
      )}
    </Box>
  );
};

// ============================================================================
// Status Bar Component
// ============================================================================

interface StatusBarProps {
  tasksCompleted: number;
  tasksTotal: number;
  tokens: number;
  cost: number;
  iteration: number;
}

const StatusBar: FC<StatusBarProps> = ({
  tasksCompleted,
  tasksTotal,
  tokens,
  cost,
  iteration
}) => {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text>Tasks: </Text>
      <Text color="cyan">{tasksCompleted}/{tasksTotal}</Text>
      <Text> | Tokens: </Text>
      <Text color="yellow">{(tokens / 1000).toFixed(1)}k</Text>
      <Text> | Cost: </Text>
      <Text color="green">${cost.toFixed(4)}</Text>
      <Text> | Iteration: </Text>
      <Text color="magenta">{iteration}/10</Text>
    </Box>
  );
};

// ============================================================================
// Input Box Component
// ============================================================================

interface InputBoxProps {
  onSubmit: (value: string) => void;
  enabled: boolean;
}

const InputBox: FC<InputBoxProps> = ({ onSubmit, enabled }) => {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    if (value.trim() && enabled) {
      onSubmit(value);
      setValue('');
    }
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="green">
      <Box paddingX={1}>
        <Text color="green">&gt; </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={enabled ? 'Type your message...' : 'Please wait...'}
        />
      </Box>
      <Box paddingX={1}>
        <Text dimColor>
          Enter: Send | Ctrl+C: Exit
        </Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Main App Component
// ============================================================================

const App: FC = () => {
  const [phase, setPhase] = useState<AgentPhase>('planning');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState({
    tasksCompleted: 0,
    tasksTotal: 5,
    tokens: 0,
    cost: 0,
    iteration: 1
  });
  const [inputEnabled, setInputEnabled] = useState(false);
  const [activityId, setActivityId] = useState(0);

  // Simulate agent execution
  useEffect(() => {
    const simulateExecution = async () => {
      // Phase 1: Planning
      await addActivity({
        type: 'thinking',
        content: 'Analyzing task complexity...',
        status: 'running'
      });

      await sleep(1000);

      await addActivity({
        type: 'thinking',
        content: 'This is a complex task requiring multiple steps',
        status: 'completed'
      });

      await sleep(500);

      await addActivity({
        type: 'thinking',
        content: 'Generated execution plan with 5 tasks',
        status: 'completed'
      });

      await sleep(1000);

      // Phase 2: Executing
      setPhase('executing');
      setInputEnabled(true);

      await addActivity({
        type: 'tool',
        content: 'code_query({"query": "authentication", "type": "function"})',
        status: 'running'
      });

      await sleep(1500);
      updateLastActivity({ status: 'completed', details: 'Found 3 matching functions' });
      setStats(prev => ({ ...prev, tokens: prev.tokens + 1200, cost: prev.cost + 0.0012 }));

      await sleep(500);

      await addActivity({
        type: 'tool',
        content: 'file_read({"path": "src/auth/middleware.ts"})',
        status: 'running'
      });

      await sleep(1000);
      updateLastActivity({ status: 'completed', details: 'Read 245 lines successfully' });
      setStats(prev => ({ ...prev, tokens: prev.tokens + 800, cost: prev.cost + 0.0008 }));

      await sleep(500);
      setStats(prev => ({ ...prev, tasksCompleted: 1 }));

      await addActivity({
        type: 'bash',
        content: '$ npm install jsonwebtoken',
        status: 'running'
      });

      await sleep(2000);
      updateLastActivity({
        status: 'completed',
        details: 'added 5 packages in 2.3s\nExit code: 0'
      });
      setStats(prev => ({ ...prev, tasksCompleted: 2 }));

      await sleep(500);

      await addActivity({
        type: 'tool',
        content: 'file_write({"path": "src/auth/token.ts", "content": "..."})',
        status: 'running'
      });

      await sleep(1500);
      updateLastActivity({ status: 'completed', details: 'File written successfully (1.2KB)' });
      setStats(prev => ({ ...prev, tasksCompleted: 3, tokens: prev.tokens + 2500, cost: prev.cost + 0.0025 }));

      await sleep(1000);

      // Phase 3: Reflecting
      setPhase('reflecting');
      setInputEnabled(false);

      await addActivity({
        type: 'thinking',
        content: 'Evaluating execution results...',
        status: 'running'
      });

      await sleep(1500);
      updateLastActivity({ status: 'completed' });

      await addActivity({
        type: 'thinking',
        content: 'All tasks completed successfully. Goal achieved.',
        status: 'completed'
      });

      await sleep(1000);

      // Phase 4: Completed
      setPhase('completed');
      setStats(prev => ({ ...prev, tasksCompleted: 5 }));
      setInputEnabled(true);

      await addActivity({
        type: 'message',
        content: 'Agent execution completed! You can now provide additional instructions.',
        status: 'completed'
      });
    };

    simulateExecution();
  }, []);

  const addActivity = async (activityData: Omit<Activity, 'id' | 'timestamp'>) => {
    const newActivity: Activity = {
      ...activityData,
      id: activityId,
      timestamp: new Date()
    };
    setActivityId(prev => prev + 1);
    setActivities(prev => [...prev, newActivity]);
  };

  const updateLastActivity = (updates: Partial<Activity>) => {
    setActivities(prev => {
      const newActivities = [...prev];
      const last = newActivities[newActivities.length - 1];
      if (last) {
        newActivities[newActivities.length - 1] = { ...last, ...updates };
      }
      return newActivities;
    });
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleUserInput = (input: string) => {
    addActivity({
      type: 'message',
      content: `User: ${input}`,
      status: 'completed'
    });

    // Simulate response
    setTimeout(() => {
      addActivity({
        type: 'message',
        content: 'Understood! Processing your request...',
        status: 'completed'
      });
    }, 500);
  };

  // Handle Ctrl+C
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      process.exit(0);
    }
  });

  return (
    <Box flexDirection="column" height="100%">
      <Header
        projectName="OpenJRAgent"
        version="1.0.0"
        phase={phase}
        isOnline={true}
      />

      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={0}>
        {activities.length === 0 ? (
          <Box justifyContent="center" alignItems="center" flexGrow={1}>
            <Text dimColor>Initializing agent...</Text>
          </Box>
        ) : (
          activities.map((activity, index) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              isLatest={index === activities.length - 1}
            />
          ))
        )}
      </Box>

      <StatusBar
        tasksCompleted={stats.tasksCompleted}
        tasksTotal={stats.tasksTotal}
        tokens={stats.tokens}
        cost={stats.cost}
        iteration={stats.iteration}
      />

      <InputBox
        onSubmit={handleUserInput}
        enabled={inputEnabled}
      />
    </Box>
  );
};

// ============================================================================
// Entry Point
// ============================================================================

console.clear();
render(<App />);
