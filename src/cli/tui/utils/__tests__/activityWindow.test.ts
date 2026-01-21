/**
 * Activity Window Unit Tests
 */

import { getActivityWindow, truncateText, getLineWindow } from '../activityWindow';
import type { Activity } from '../../types';

describe('activityWindow', () => {
  describe('getActivityWindow', () => {
    it('should return all activities when count is below max', () => {
      const activities: Activity[] = [
        { id: '1', type: 'message', timestamp: 1, content: 'test1', level: 'info' },
        { id: '2', type: 'message', timestamp: 2, content: 'test2', level: 'info' },
        { id: '3', type: 'message', timestamp: 3, content: 'test3', level: 'info' },
      ];

      const window = getActivityWindow(activities, 10);

      expect(window.activities).toHaveLength(3);
      expect(window.totalCount).toBe(3);
      expect(window.visibleCount).toBe(3);
      expect(window.truncatedCount).toBe(0);
      expect(window.hasMore).toBe(false);
    });

    it('should return last N activities when count exceeds max', () => {
      const activities: Activity[] = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        type: 'message' as const,
        timestamp: i,
        content: `test${i}`,
        level: 'info' as const,
      }));

      const window = getActivityWindow(activities, 30);

      expect(window.activities).toHaveLength(30);
      expect(window.totalCount).toBe(50);
      expect(window.visibleCount).toBe(30);
      expect(window.truncatedCount).toBe(20);
      expect(window.hasMore).toBe(true);

      // Verify we got the last 30 activities
      expect(window.activities[0].id).toBe('20');
      expect(window.activities[29].id).toBe('49');
    });

    it('should handle empty activity list', () => {
      const window = getActivityWindow([], 30);

      expect(window.activities).toHaveLength(0);
      expect(window.totalCount).toBe(0);
      expect(window.visibleCount).toBe(0);
      expect(window.truncatedCount).toBe(0);
      expect(window.hasMore).toBe(false);
    });
  });

  describe('truncateText', () => {
    it('should not truncate text shorter than max length', () => {
      const text = 'Short text';
      expect(truncateText(text, 120)).toBe('Short text');
    });

    it('should truncate text longer than max length', () => {
      const text = 'A'.repeat(150);
      const result = truncateText(text, 120);

      expect(result).toHaveLength(120);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should use default max length', () => {
      const text = 'A'.repeat(150);
      const result = truncateText(text);

      expect(result).toHaveLength(120); // Default MAX_TEXT_LENGTH
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('getLineWindow', () => {
    it('should return all lines when count is below max', () => {
      const text = 'line1\nline2\nline3';
      const window = getLineWindow(text, 10);

      expect(window.lines).toHaveLength(3);
      expect(window.totalLines).toBe(3);
      expect(window.hiddenLines).toBe(0);
      expect(window.hasMore).toBe(false);
    });

    it('should return last N lines when count exceeds max', () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`);
      const text = lines.join('\n');
      const window = getLineWindow(text, 10);

      expect(window.lines).toHaveLength(10);
      expect(window.totalLines).toBe(20);
      expect(window.hiddenLines).toBe(10);
      expect(window.hasMore).toBe(true);

      // Verify we got the last 10 lines
      expect(window.lines[0]).toBe('line11');
      expect(window.lines[9]).toBe('line20');
    });

    it('should handle single line text', () => {
      const text = 'single line';
      const window = getLineWindow(text, 10);

      expect(window.lines).toHaveLength(1);
      expect(window.lines[0]).toBe('single line');
      expect(window.totalLines).toBe(1);
      expect(window.hasMore).toBe(false);
    });

    it('should handle empty text', () => {
      const window = getLineWindow('', 10);

      expect(window.lines).toHaveLength(1);
      expect(window.lines[0]).toBe('');
      expect(window.totalLines).toBe(1);
      expect(window.hasMore).toBe(false);
    });
  });
});
