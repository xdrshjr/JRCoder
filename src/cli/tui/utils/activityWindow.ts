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
}

/**
 * Get a window of the most recent activities.
 *
 * This implements virtual windowing to prevent rendering all activities,
 * which would cause the ContentArea to grow indefinitely and push other
 * components off screen.
 *
 * @param activities - All activities
 * @param maxVisible - Maximum number of visible activities (default from constants)
 * @returns Activity window with metadata
 *
 * @example
 * ```typescript
 * const window = getActivityWindow(allActivities, 30);
 * // window.activities contains the last 30 activities
 * // window.hasMore is true if there are more than 30 activities
 * // window.truncatedCount shows how many are hidden
 * ```
 */
export function getActivityWindow(
  activities: Activity[],
  maxVisible: number = ACTIVITY_DISPLAY.MAX_VISIBLE_ACTIVITIES
): ActivityWindow {
  const totalCount = activities.length;
  const hasMore = totalCount > maxVisible;
  const visibleActivities = hasMore
    ? activities.slice(-maxVisible)
    : activities;
  const visibleCount = visibleActivities.length;
  const truncatedCount = Math.max(0, totalCount - maxVisible);

  return {
    activities: visibleActivities,
    totalCount,
    visibleCount,
    truncatedCount,
    hasMore,
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
