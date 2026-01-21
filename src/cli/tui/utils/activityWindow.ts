/**
 * Activity Window Utilities
 *
 * Implements virtual windowing for activities to prevent unlimited
 * content area growth and ensure proper layout.
 */

import type { Activity } from '../types';
import { ACTIVITY_DISPLAY } from '../constants';

/**
 * Activity window result containing the visible activities
 * and metadata about truncation.
 */
export interface ActivityWindow {
  /** Visible activities (last N activities) */
  activities: Activity[];

  /** Total number of activities */
  totalCount: number;

  /** Number of visible activities */
  visibleCount: number;

  /** Number of truncated (hidden) activities */
  truncatedCount: number;

  /** Whether there are more activities than can be shown */
  hasMore: boolean;

  /** Whether there are newer activities (scroll down to see) */
  hasNewer: boolean;

  /** Current scroll offset from bottom */
  scrollOffset: number;

  /** Whether currently at the top of the activity list */
  isAtTop: boolean;

  /** Whether currently at the bottom of the activity list */
  isAtBottom: boolean;
}

/**
 * Get a window of the most recent activities.
 *
 * This implements virtual windowing to prevent rendering all activities,
 * which would cause the ContentArea to grow indefinitely and push other
 * components off screen.
 *
 * Supports scrolling by accepting a scrollOffset parameter (offset from bottom).
 *
 * @param activities - All activities
 * @param scrollOffset - Scroll offset from bottom (default 0 = show latest)
 * @param maxVisible - Maximum number of visible activities (default from constants)
 * @returns Activity window with metadata
 *
 * @example
 * ```typescript
 * // Show latest 30 activities
 * const window = getActivityWindow(allActivities, 0, 30);
 *
 * // Show 30 activities with 20 offset from bottom (scroll up 20 items)
 * const scrolledWindow = getActivityWindow(allActivities, 20, 30);
 * ```
 */
export function getActivityWindow(
  activities: Activity[],
  scrollOffset: number = 0,
  maxVisible: number = ACTIVITY_DISPLAY.MAX_VISIBLE_ACTIVITIES
): ActivityWindow {
  const totalCount = activities.length;
  const maxScroll = Math.max(0, totalCount - maxVisible);
  const clampedOffset = Math.min(scrollOffset, maxScroll);

  // Calculate display range: from bottom, offset upward
  const endIndex = totalCount - clampedOffset;
  const startIndex = Math.max(0, endIndex - maxVisible);

  const visibleActivities = activities.slice(startIndex, endIndex);
  const visibleCount = visibleActivities.length;
  const truncatedCount = startIndex;

  return {
    activities: visibleActivities,
    totalCount,
    visibleCount,
    truncatedCount,
    hasMore: startIndex > 0,
    hasNewer: clampedOffset > 0,
    scrollOffset: clampedOffset,
    isAtTop: startIndex === 0,
    isAtBottom: clampedOffset === 0,
  };
}

/**
 * Truncate text to a maximum length with ellipsis.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default from constants)
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(
  text: string,
  maxLength: number = ACTIVITY_DISPLAY.MAX_TEXT_LENGTH
): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Get a window of lines from text output.
 *
 * Returns the last N lines from multiline text, with metadata
 * about truncation.
 *
 * @param text - Multiline text
 * @param maxLines - Maximum number of lines to show
 * @returns Object with visible lines and truncation info
 */
export function getLineWindow(
  text: string,
  maxLines: number
): {
  lines: string[];
  totalLines: number;
  hiddenLines: number;
  hasMore: boolean;
} {
  const allLines = text.split('\n');
  const totalLines = allLines.length;
  const hasMore = totalLines > maxLines;
  const lines = hasMore ? allLines.slice(-maxLines) : allLines;
  const hiddenLines = Math.max(0, totalLines - maxLines);

  return {
    lines,
    totalLines,
    hiddenLines,
    hasMore,
  };
}

/**
 * Clamp scroll offset to valid range.
 *
 * Ensures scrollOffset is within [0, maxOffset] where maxOffset is
 * the maximum number of activities we can scroll up.
 *
 * @param offset - Desired scroll offset
 * @param totalActivities - Total number of activities
 * @param windowSize - Size of the visible window
 * @returns Clamped scroll offset
 *
 * @example
 * ```typescript
 * // With 100 activities and 30 window size, max offset is 70
 * clampScrollOffset(100, 100, 30); // Returns 70
 * clampScrollOffset(-10, 100, 30); // Returns 0
 * clampScrollOffset(50, 100, 30);  // Returns 50
 * ```
 */
export function clampScrollOffset(
  offset: number,
  totalActivities: number,
  windowSize: number
): number {
  const maxOffset = Math.max(0, totalActivities - windowSize);
  return Math.max(0, Math.min(offset, maxOffset));
}
