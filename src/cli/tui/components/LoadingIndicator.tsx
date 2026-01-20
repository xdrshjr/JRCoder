/**
 * LoadingIndicator - Component for displaying loading states
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

export interface LoadingIndicatorProps {
  /**
   * Loading message to display
   * @default "Loading OpenJRAgent..."
   */
  message?: string;

  /**
   * Spinner type
   * @default "dots"
   */
  spinnerType?: 'dots' | 'line' | 'pipe' | 'simpleDots' | 'simpleDotsScrolling' | 'star' | 'flip' | 'hamburger' | 'growVertical' | 'growHorizontal' | 'balloon' | 'noise' | 'bounce' | 'boxBounce';

  /**
   * Whether to show in full screen (centered)
   * @default true
   */
  fullScreen?: boolean;
}

/**
 * LoadingIndicator component for displaying loading states
 *
 * @example
 * ```tsx
 * <LoadingIndicator message="Initializing Agent..." />
 * ```
 */
export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = 'Loading OpenJRAgent...',
  spinnerType = 'dots',
  fullScreen = true,
}) => {
  const content = (
    <Box>
      <Text color="cyan">
        <Spinner type={spinnerType} />
      </Text>
      <Text> {message}</Text>
    </Box>
  );

  if (fullScreen) {
    return (
      <Box
        justifyContent="center"
        alignItems="center"
        height="100%"
        flexDirection="column"
      >
        {content}
      </Box>
    );
  }

  return content;
};
