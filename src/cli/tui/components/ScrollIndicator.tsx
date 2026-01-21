/**
 * Scroll Indicator Component
 *
 * Displays scrolling hints and status at the top/bottom of ContentArea.
 */

import React from 'react';
import { Box, Text } from 'ink';

/**
 * Props for ScrollIndicator component
 */
export interface ScrollIndicatorProps {
  /** Position - top or bottom of content area */
  position: 'top' | 'bottom';

  /** Number of hidden activities in this direction */
  hiddenCount: number;

  /** Whether we're at the edge (no more scrolling in this direction) */
  isAtEdge: boolean;

  /** Current scroll mode (optional, shown at bottom) */
  scrollMode?: 'auto' | 'manual';

  /** Current position range (e.g., "45-75 / 156") */
  currentRange?: string;
}

/**
 * Scroll indicator component.
 *
 * Shows at the top/bottom of ContentArea to indicate:
 * - How many activities are hidden in each direction
 * - Available keyboard shortcuts
 * - Current scroll mode and position
 *
 * @param props - Component props
 * @returns React component or null if at edge
 */
export const ScrollIndicator: React.FC<ScrollIndicatorProps> = ({
  position,
  hiddenCount,
  isAtEdge,
  scrollMode,
  currentRange,
}) => {
  // Don't show anything if no hidden activities
  if (hiddenCount === 0) return null;

  // Don't show bottom indicator if at bottom edge (no newer activities)
  if (isAtEdge && position === 'bottom') return null;

  return (
    <Box paddingX={1} borderStyle="single" borderColor="gray">
      {/* Top indicator - shows earlier activities */}
      {position === 'top' && (
        <Text dimColor>
          {`↑ ${hiddenCount} earlier activities • [PageUp/↑] Scroll up`}
        </Text>
      )}

      {/* Bottom indicator - shows newer activities and status */}
      {position === 'bottom' && (
        <Box flexDirection="column">
          <Text dimColor>
            {`↓ ${hiddenCount} newer activities • [PageDown/↓] Scroll down`}
          </Text>

          {/* Manual mode warning */}
          {scrollMode === 'manual' && (
            <Text color="yellow">
              [Manual scroll mode] • [Esc] Return to auto-scroll
            </Text>
          )}

          {/* Position range */}
          {currentRange && (
            <Text dimColor>
              Position: {currentRange}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};
