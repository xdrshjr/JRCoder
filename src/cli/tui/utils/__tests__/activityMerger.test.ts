/**
 * Tests for activity merger utility
 */

import type { Activity } from '../types';
import {
  mergeActivities,
  deduplicateActivities,
  filterActivitiesByType,
  getActivityStats,
} from '../activityMerger';

describe('activityMerger', () => {
  describe('mergeActivities', () => {
    it('should merge consecutive thinking activities', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'thinking',
          timestamp: 1000,
          content: 'First thought',
          source: 'planner',
        },
        {
          id: '2',
          type: 'thinking',
          timestamp: 2000,
          content: 'Second thought',
          source: 'planner',
        },
      ];

      const merged = mergeActivities(activities, { mergeWindowMs: 5000 });

      expect(merged).toHaveLength(1);
      expect(merged[0].content).toContain('First thought');
      expect(merged[0].content).toContain('Second thought');
      expect(merged[0].mergeCount).toBe(2);
    });

    it('should not merge activities from different sources', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'thinking',
          timestamp: 1000,
          content: 'Planner thought',
          source: 'planner',
        },
        {
          id: '2',
          type: 'thinking',
          timestamp: 2000,
          content: 'Reflector thought',
          source: 'reflector',
        },
      ];

      const merged = mergeActivities(activities);

      expect(merged).toHaveLength(2);
    });

    it('should not merge activities outside time window', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'thinking',
          timestamp: 1000,
          content: 'First thought',
          source: 'planner',
        },
        {
          id: '2',
          type: 'thinking',
          timestamp: 10000,
          content: 'Second thought',
          source: 'planner',
        },
      ];

      const merged = mergeActivities(activities, { mergeWindowMs: 5000 });

      expect(merged).toHaveLength(2);
    });

    it('should not merge tool call activities', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'tool_call',
          timestamp: 1000,
          toolName: 'file_read',
          args: { path: 'test.ts' },
          status: 'completed',
        },
        {
          id: '2',
          type: 'tool_call',
          timestamp: 2000,
          toolName: 'file_write',
          args: { path: 'test.ts', content: 'test' },
          status: 'completed',
        },
      ];

      const merged = mergeActivities(activities);

      expect(merged).toHaveLength(2);
    });

    it('should trim activities to maxActivities', () => {
      const activities: Activity[] = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        type: 'message',
        timestamp: 1000 + i,
        content: `Message ${i}`,
        level: 'info' as const,
      }));

      const merged = mergeActivities(activities, { maxActivities: 50 });

      expect(merged.length).toBeLessThanOrEqual(50);
    });

    it('should respect enableMerging flag', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'thinking',
          timestamp: 1000,
          content: 'First thought',
          source: 'planner',
        },
        {
          id: '2',
          type: 'thinking',
          timestamp: 2000,
          content: 'Second thought',
          source: 'planner',
        },
      ];

      const merged = mergeActivities(activities, { enableMerging: false });

      expect(merged).toHaveLength(2);
    });
  });

  describe('deduplicateActivities', () => {
    it('should remove duplicate activities', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'thinking',
          timestamp: 1000,
          content: 'Same thought',
          source: 'planner',
        },
        {
          id: '2',
          type: 'thinking',
          timestamp: 1000,
          content: 'Same thought',
          source: 'planner',
        },
      ];

      const deduplicated = deduplicateActivities(activities);

      expect(deduplicated).toHaveLength(1);
    });

    it('should not remove different activities', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'thinking',
          timestamp: 1000,
          content: 'First thought',
          source: 'planner',
        },
        {
          id: '2',
          type: 'thinking',
          timestamp: 2000,
          content: 'Second thought',
          source: 'planner',
        },
      ];

      const deduplicated = deduplicateActivities(activities);

      expect(deduplicated).toHaveLength(2);
    });
  });

  describe('filterActivitiesByType', () => {
    it('should filter activities by type', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'thinking',
          timestamp: 1000,
          content: 'Thought',
          source: 'planner',
        },
        {
          id: '2',
          type: 'tool_call',
          timestamp: 2000,
          toolName: 'file_read',
          args: {},
          status: 'completed',
        },
        {
          id: '3',
          type: 'thinking',
          timestamp: 3000,
          content: 'Another thought',
          source: 'reflector',
        },
      ];

      const filtered = filterActivitiesByType(activities, ['thinking']);

      expect(filtered).toHaveLength(2);
      expect(filtered.every((a) => a.type === 'thinking')).toBe(true);
    });
  });

  describe('getActivityStats', () => {
    it('should calculate activity statistics', () => {
      const activities: Activity[] = [
        {
          id: '1',
          type: 'thinking',
          timestamp: 1000,
          content: 'Thought',
          source: 'planner',
        },
        {
          id: '2',
          type: 'tool_call',
          timestamp: 2000,
          toolName: 'file_read',
          args: {},
          status: 'completed',
        },
        {
          id: '3',
          type: 'thinking',
          timestamp: 3000,
          content: 'Another thought',
          source: 'reflector',
        },
      ];

      const stats = getActivityStats(activities);

      expect(stats.total).toBe(3);
      expect(stats.byType.thinking).toBe(2);
      expect(stats.byType.tool_call).toBe(1);
      expect(stats.timeRange.start).toBe(1000);
      expect(stats.timeRange.end).toBe(3000);
      expect(stats.timeRange.durationMs).toBe(2000);
    });

    it('should handle empty activities', () => {
      const stats = getActivityStats([]);

      expect(stats.total).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.timeRange.durationMs).toBe(0);
    });
  });
});
