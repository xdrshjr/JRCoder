/**
 * EmptyState - Component for displaying empty states
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface EmptyStateProps {
  /**
   * Primary message
   * @default "No activities yet"
   */
  message?: string;

  /**
   * Secondary message (helper text)
   */
  helperText?: string;

  /**
   * Icon to display (single character or emoji)
   */
  icon?: string;

  /**
   * Whether to show in full screen (centered)
   * @default false
   */
  fullScreen?: boolean;
}

/**
 * EmptyState component for displaying empty states
 *
 * @example
 * ```tsx
 * <EmptyState
 *   message="No activities yet"
 *   helperText="Agent is thinking..."
 *   icon="💭"
 * />
 * ```
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  message = 'No activities yet',
  helperText,
  icon,
  fullScreen = false,
}) => {
  const content = (
    <Box flexDirection="column" alignItems="center">
      {icon && (
        <>
          <Text>{icon}</Text>
          <Text>{'\n'}</Text>
        </>
      )}
      <Text color="gray">{message}</Text>
      {helperText && (
        <>
          <Text>{'\n'}</Text>
          <Text dimColor>{helperText}</Text>
        </>
      )}
    </Box>
  );

  if (fullScreen) {
    return (
      <Box justifyContent="center" alignItems="center" height="100%">
        {content}
      </Box>
    );
  }

  return content;
};
