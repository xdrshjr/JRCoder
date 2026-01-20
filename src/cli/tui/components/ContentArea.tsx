/**
 * ContentArea Component - Scrollable activity display area with performance optimizations
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { Box } from 'ink';
import type { ContentAreaProps, Activity } from '../types';
import { ActivityItem } from './ActivityItem';
import { EmptyState } from './EmptyState';
import { mergeActivities } from '../utils/activityMerger';
import { logger } from '../logger';

/**
 * ContentArea component displaying a scrollable list of activities
 *
 * Features:
 * - Empty state when no activities
 * - Activity merging to reduce clutter
 * - Full-screen display using flexGrow
 * - Shows all activities (terminal handles scrolling)
 */
export const ContentArea: React.FC<ContentAreaProps> = ({
  activities,
  enableMerging = true,
  mergeConfig,
}) => {
  const bottomRef = useRef<any>(null);

  // Auto-scroll to bottom when new activities are added
  useEffect(() => {
    if (bottomRef.current) {
      // In ink, we don't have traditional scrolling, so we'll just show the latest items
      // The terminal itself handles scrolling
    }
  }, [activities]);

  // Apply activity merging to reduce clutter and improve performance
  const processedActivities = useMemo(() => {
    if (!enableMerging || activities.length === 0) {
      return activities;
    }

    try {
      const merged = mergeActivities(activities, mergeConfig);

      logger.debug('Activities merged', {
        type: 'activities_merged',
        originalCount: activities.length,
        mergedCount: merged.length,
        reduction:
          (((activities.length - merged.length) / activities.length) * 100).toFixed(2) + '%',
      });

      return merged;
    } catch (error) {
      logger.error('Failed to merge activities', error as Error, {
        type: 'activity_merge_error',
      });
      return activities;
    }
  }, [activities, enableMerging, mergeConfig]);

  // Show empty state if no activities
  if (processedActivities.length === 0) {
    return (
      <Box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        flexGrow={1}
        paddingY={2}
      >
        <EmptyState message="No activities yet" helperText="Agent is thinking..." icon="💭" />
      </Box>
    );
  }

  logger.debug('ContentArea rendering', {
    type: 'content_area_render',
    totalActivities: processedActivities.length,
  });

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
      {processedActivities.map((activity: Activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
      <Box ref={bottomRef} />
    </Box>
  );
};
