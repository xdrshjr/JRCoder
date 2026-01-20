/**
 * StatusBar Component - Bottom status bar showing task progress and statistics
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { StatusBarProps } from '../types';

/**
 * StatusBar component displaying execution statistics
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  completedTasks,
  totalTasks,
  totalTokens,
  totalCost,
}) => {
  // Format large numbers
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };

  // Format cost
  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(4)}`;
  };

  // Calculate progress percentage
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box gap={1}>
        <Text>Tasks:</Text>
        <Text color="cyan">
          {completedTasks}/{totalTasks}
        </Text>
        <Text dimColor>({progressPercent}%)</Text>
      </Box>

      <Box gap={1}>
        <Text>Tokens:</Text>
        <Text color="yellow">{formatTokens(totalTokens)}</Text>
      </Box>

      <Box gap={1}>
        <Text>Cost:</Text>
        <Text color="green">{formatCost(totalCost)}</Text>
      </Box>
    </Box>
  );
};
