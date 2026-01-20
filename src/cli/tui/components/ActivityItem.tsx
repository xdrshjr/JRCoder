/**
 * ActivityItem Component - Display different types of activities
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type {
  ActivityItemProps,
  ThinkingActivity,
  ToolCallActivity,
  BashActivity,
  MessageActivity,
  ErrorActivity,
  LogActivity,
  PhaseChangeActivity,
} from '../types';

/**
 * Main ActivityItem component that routes to specific activity renderers
 */
export const ActivityItem: React.FC<ActivityItemProps> = ({ activity }) => {
  switch (activity.type) {
    case 'thinking':
      return <ThinkingActivityItem activity={activity} />;
    case 'tool_call':
      return <ToolCallActivityItem activity={activity} />;
    case 'bash':
      return <BashActivityItem activity={activity} />;
    case 'message':
      return <MessageActivityItem activity={activity} />;
    case 'error':
      return <ErrorActivityItem activity={activity} />;
    case 'log':
      return <LogActivityItem activity={activity} />;
    case 'phase_change':
      return <PhaseChangeActivityItem activity={activity} />;
    default:
      return null;
  }
};

/**
 * Thinking activity renderer
 */
const ThinkingActivityItem: React.FC<{ activity: ThinkingActivity }> = ({ activity }) => {
  const sourceLabel = activity.source === 'planner' ? 'Planning' :
                      activity.source === 'reflector' ? 'Reflecting' : 'Thinking';

  return (
    <Box paddingLeft={1} flexDirection="column">
      <Box>
        <Text color="gray">\u2022 [{sourceLabel}] </Text>
        <Text>{activity.content}</Text>
      </Box>
    </Box>
  );
};

/**
 * Tool call activity renderer
 */
const ToolCallActivityItem: React.FC<{ activity: ToolCallActivity }> = ({ activity }) => {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box>
        <Text color="cyan">\u2022 [Tool] </Text>
        <Text bold>{activity.toolName}</Text>
        {Object.keys(activity.args).length > 0 && (
          <Text color="gray">({formatArgs(activity.args)})</Text>
        )}
      </Box>

      {activity.status === 'running' && (
        <Box paddingLeft={2}>
          <Spinner type="dots" />
          <Text> Running...</Text>
        </Box>
      )}

      {activity.status === 'completed' && activity.result && (
        <Box paddingLeft={2}>
          <Text color="green">\u2713 {activity.result}</Text>
        </Box>
      )}

      {activity.status === 'failed' && activity.error && (
        <Box paddingLeft={2}>
          <Text color="red">\u2717 {activity.error}</Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Bash activity renderer
 */
const BashActivityItem: React.FC<{ activity: BashActivity }> = ({ activity }) => {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box>
        <Text color="yellow">\u2022 [Bash] </Text>
        <Text backgroundColor="gray" color="white"> $ {activity.command} </Text>
      </Box>

      {activity.status === 'running' && (
        <Box paddingLeft={2}>
          <Spinner type="dots" />
          <Text> Executing...</Text>
        </Box>
      )}

      {activity.output && (
        <Box paddingLeft={2} flexDirection="column">
          {activity.output.split('\n').slice(0, 10).map((line: string, index: number) => (
            <Text key={index} dimColor>
              {line}
            </Text>
          ))}
        </Box>
      )}

      {activity.status === 'completed' && activity.exitCode !== undefined && (
        <Box paddingLeft={2}>
          {activity.exitCode === 0 ? (
            <Text color="green">\u2713 Exit code: {activity.exitCode}</Text>
          ) : (
            <Text color="red">\u2717 Exit code: {activity.exitCode}</Text>
          )}
        </Box>
      )}
    </Box>
  );
};

/**
 * Message activity renderer
 */
const MessageActivityItem: React.FC<{ activity: MessageActivity }> = ({ activity }) => {
  const levelColor: Record<'info' | 'success' | 'warning', string> = {
    info: 'cyan',
    success: 'green',
    warning: 'yellow',
  };

  const levelIcon: Record<'info' | 'success' | 'warning', string> = {
    info: '\u2139',
    success: '\u2713',
    warning: '\u26A0',
  };

  return (
    <Box paddingLeft={1}>
      <Text color={levelColor[activity.level] as any}>
        {levelIcon[activity.level]} {activity.content}
      </Text>
    </Box>
  );
};

/**
 * Error activity renderer
 */
const ErrorActivityItem: React.FC<{ activity: ErrorActivity }> = ({ activity }) => {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box>
        <Text color="red">\u2022 [Error] {activity.message}</Text>
      </Box>
      {activity.error && (
        <Box paddingLeft={2}>
          <Text color="red" dimColor>
            {activity.error}
          </Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Log activity renderer
 */
const LogActivityItem: React.FC<{ activity: LogActivity }> = ({ activity }) => {
  const levelColor: Record<'debug' | 'info' | 'warn' | 'error', string> = {
    debug: 'gray',
    info: 'cyan',
    warn: 'yellow',
    error: 'red',
  };

  const levelLabel = activity.level.toUpperCase();

  return (
    <Box paddingLeft={1}>
      <Text color={levelColor[activity.level] as any}>
        [{levelLabel}] {activity.message}
      </Text>
    </Box>
  );
};

/**
 * Phase change activity renderer
 */
const PhaseChangeActivityItem: React.FC<{ activity: PhaseChangeActivity }> = ({ activity }) => {
  const phaseIcon: Record<string, string> = {
    planning: '\uD83D\uDCCB',
    executing: '\u2699',
    reflecting: '\uD83E\uDD14',
    confirming: '\u2753',
    completed: '\u2705',
    failed: '\u274C',
  };

  return (
    <Box paddingLeft={1}>
      <Text bold>
        {phaseIcon[activity.to]} Phase changed: {activity.from} {'->'} {activity.to}
      </Text>
    </Box>
  );
};

/**
 * Format tool arguments for display
 */
function formatArgs(args: Record<string, any>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return '';

  const formatted = entries
    .map(([key, value]) => {
      const valueStr = typeof value === 'string'
        ? value.length > 50 ? `${value.substring(0, 50)}...` : value
        : JSON.stringify(value);
      return `${key}=${valueStr}`;
    })
    .join(', ');

  return formatted.length > 100 ? `${formatted.substring(0, 100)}...` : formatted;
}
