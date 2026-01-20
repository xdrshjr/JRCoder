/**
 * Header Component - Top status bar showing project info, phase, and status
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { HeaderProps } from '../types';
import type { AgentPhase } from '../../../types';

/**
 * Phase display colors
 */
const PHASE_COLORS: Record<AgentPhase, string> = {
  planning: 'blue',
  executing: 'cyan',
  reflecting: 'magenta',
  confirming: 'yellow',
  completed: 'green',
  failed: 'red',
  answering: 'gray',
};

/**
 * Phase display labels
 */
const PHASE_LABELS: Record<AgentPhase, string> = {
  planning: 'Planning',
  executing: 'Executing',
  reflecting: 'Reflecting',
  confirming: 'Confirming',
  completed: 'Completed',
  failed: 'Failed',
  answering: 'Answering',
};

/**
 * Header component displaying project information and status
 */
export const Header: React.FC<HeaderProps> = ({ version, phase, isOnline }) => {
  const phaseColor = PHASE_COLORS[phase];
  const phaseLabel = PHASE_LABELS[phase];

  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1} justifyContent="space-between">
      <Box gap={1}>
        <Text>OpenJRAgent</Text>
        <Text dimColor>v{version}</Text>
      </Box>

      <Box gap={1}>
        <Text>Phase:</Text>
        <Text color={phaseColor as any}>{phaseLabel}</Text>
      </Box>

      <Box gap={1}>
        <Text>{isOnline ? '\u2713' : '\u2717'}</Text>
        <Text>{isOnline ? 'Online' : 'Offline'}</Text>
      </Box>
    </Box>
  );
};
