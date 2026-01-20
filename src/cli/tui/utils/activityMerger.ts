/**
 * Activity Merger - Utilities for merging and deduplicating activities
 */

import type {
  Activity,
  ThinkingActivity,
  MessageActivity,
  ErrorActivity,
  PhaseChangeActivity,
} from '../types';

/**
 * Configuration for activity merging
 */
export interface ActivityMergeConfig {
  /**
   * Maximum time window (ms) to consider activities for merging
   * @default 5000
   */
  mergeWindowMs?: number;

  /**
   * Maximum number of activities to keep (older ones are removed)
   * @default 1000
   */
  maxActivities?: number;

  /**
   * Whether to merge consecutive similar activities
   * @default true
   */
  enableMerging?: boolean;

  /**
   * Whether to trim activities to maxActivities
   * @default true
   */
  enableTrimming?: boolean;
}

const DEFAULT_CONFIG: Required<ActivityMergeConfig> = {
  mergeWindowMs: 5000,
  maxActivities: 1000,
  enableMerging: true,
  enableTrimming: true,
};

/**
 * Check if two activities should be merged
 */
function shouldMerge(prev: Activity, current: Activity, windowMs: number): boolean {
  // Must be within time window
  if (current.timestamp - prev.timestamp > windowMs) {
    return false;
  }

  // Must be same type
  if (prev.type !== current.type) {
    return false;
  }

  // Type-specific merge logic
  switch (current.type) {
    case 'thinking':
      // Merge consecutive thinking activities from the same source
      return (prev as ThinkingActivity).source === (current as ThinkingActivity).source;

    case 'message':
      // Merge consecutive messages with the same level
      return (prev as MessageActivity).level === (current as MessageActivity).level;

    case 'bash':
      // Don't merge bash activities (each command is distinct)
      return false;

    case 'tool_call':
      // Don't merge tool calls (each call is distinct)
      return false;

    case 'phase_change':
      // Don't merge phase changes
      return false;

    case 'error':
      // Merge consecutive errors with the same message
      return (prev as ErrorActivity).message === (current as ErrorActivity).message;

    default:
      return false;
  }
}

/**
 * Merge two activities
 */
function mergeActivity(prev: Activity, current: Activity): Activity {
  const merged = { ...current };

  switch (current.type) {
    case 'thinking': {
      const prevThinking = prev as ThinkingActivity;
      const currentThinking = current as ThinkingActivity;
      return {
        ...merged,
        content: `${prevThinking.content}\n${currentThinking.content}`,
        mergeCount: (prev.mergeCount || 1) + 1,
      } as ThinkingActivity;
    }

    case 'message': {
      const prevMessage = prev as MessageActivity;
      const currentMessage = current as MessageActivity;
      return {
        ...merged,
        content: `${prevMessage.content}\n${currentMessage.content}`,
        mergeCount: (prev.mergeCount || 1) + 1,
      } as MessageActivity;
    }

    case 'error':
      // Increment error count
      return {
        ...merged,
        mergeCount: (prev.mergeCount || 1) + 1,
      } as ErrorActivity;

    default:
      // No merging for other types
      return merged;
  }
}

/**
 * Merge consecutive similar activities to reduce clutter
 *
 * @example
 * ```ts
 * const activities = [
 *   { type: 'thinking', content: 'Analyzing...', timestamp: 1000 },
 *   { type: 'thinking', content: 'Still analyzing...', timestamp: 2000 },
 *   { type: 'tool_call', toolName: 'file_read', timestamp: 3000 },
 * ];
 *
 * const merged = mergeActivities(activities);
 * // Returns:
 * // [
 * //   { type: 'thinking', content: 'Analyzing...\nStill analyzing...', timestamp: 2000, mergeCount: 2 },
 * //   { type: 'tool_call', toolName: 'file_read', timestamp: 3000 },
 * // ]
 * ```
 */
export function mergeActivities(
  activities: Activity[],
  config: ActivityMergeConfig = {}
): Activity[] {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enableMerging || activities.length === 0) {
    return finalConfig.enableTrimming
      ? trimActivities(activities, finalConfig.maxActivities)
      : activities;
  }

  const merged: Activity[] = [];
  let lastActivity: Activity | null = null;

  for (const activity of activities) {
    if (lastActivity && shouldMerge(lastActivity, activity, finalConfig.mergeWindowMs)) {
      // Merge with last activity
      lastActivity = mergeActivity(lastActivity, activity);
      merged[merged.length - 1] = lastActivity;
    } else {
      // Add as new activity
      merged.push(activity);
      lastActivity = activity;
    }
  }

  return finalConfig.enableTrimming
    ? trimActivities(merged, finalConfig.maxActivities)
    : merged;
}

/**
 * Trim activities to keep only the most recent ones
 */
function trimActivities(activities: Activity[], maxActivities: number): Activity[] {
  if (activities.length <= maxActivities) {
    return activities;
  }

  // Keep the most recent activities
  return activities.slice(activities.length - maxActivities);
}

/**
 * Deduplicate activities by removing exact duplicates
 */
export function deduplicateActivities(activities: Activity[]): Activity[] {
  const seen = new Set<string>();
  const deduplicated: Activity[] = [];

  for (const activity of activities) {
    // Create a hash key based on type and key properties
    const key = createActivityKey(activity);

    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(activity);
    }
  }

  return deduplicated;
}

/**
 * Create a unique key for an activity
 */
function createActivityKey(activity: Activity): string {
  switch (activity.type) {
    case 'thinking': {
      const thinking = activity as ThinkingActivity;
      return `thinking:${thinking.source}:${thinking.content}`;
    }

    case 'tool_call':
      return `tool_call:${activity.id}`;

    case 'bash':
      return `bash:${activity.id}`;

    case 'message': {
      const message = activity as MessageActivity;
      return `message:${activity.timestamp}:${message.content}`;
    }

    case 'phase_change': {
      const phaseChange = activity as PhaseChangeActivity;
      return `phase_change:${phaseChange.from}:${phaseChange.to}:${activity.timestamp}`;
    }

    case 'error': {
      const error = activity as ErrorActivity;
      return `error:${error.message}:${activity.timestamp}`;
    }

    default:
      return `${activity.type}:${activity.timestamp}`;
  }
}

/**
 * Filter activities by type
 */
export function filterActivitiesByType(
  activities: Activity[],
  types: Activity['type'][]
): Activity[] {
  return activities.filter((activity) => types.includes(activity.type));
}

/**
 * Get activity statistics
 */
export interface ActivityStats {
  total: number;
  byType: Record<string, number>;
  timeRange: {
    start: number;
    end: number;
    durationMs: number;
  };
}

export function getActivityStats(activities: Activity[]): ActivityStats {
  const byType: Record<string, number> = {};

  let minTimestamp = Infinity;
  let maxTimestamp = -Infinity;

  for (const activity of activities) {
    // Count by type
    byType[activity.type] = (byType[activity.type] || 0) + 1;

    // Track time range
    if (activity.timestamp < minTimestamp) {
      minTimestamp = activity.timestamp;
    }
    if (activity.timestamp > maxTimestamp) {
      maxTimestamp = activity.timestamp;
    }
  }

  return {
    total: activities.length,
    byType,
    timeRange: {
      start: minTimestamp === Infinity ? 0 : minTimestamp,
      end: maxTimestamp === -Infinity ? 0 : maxTimestamp,
      durationMs: maxTimestamp - minTimestamp || 0,
    },
  };
}
