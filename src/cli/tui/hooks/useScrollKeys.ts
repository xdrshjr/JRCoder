/**
 * Scroll Keys Hook
 *
 * Handles keyboard shortcuts for scrolling through activity history.
 */

import { useInput } from 'ink';
import { SCROLL } from '../constants';

/**
 * Options for the useScrollKeys hook
 */
export interface UseScrollKeysOptions {
  /** Whether arrow key scrolling is active (avoids conflicts with input history) */
  isActive: boolean;

  /** Callback to scroll up by N activities */
  onScrollUp: (amount: number) => void;

  /** Callback to scroll down by N activities */
  onScrollDown: (amount: number) => void;

  /** Callback to jump to the top (oldest activity) */
  onScrollTop: () => void;

  /** Callback to jump to the bottom (newest activity) */
  onScrollBottom: () => void;
}

/**
 * Hook for handling scroll keyboard shortcuts.
 *
 * Keyboard mappings:
 * - PageUp/PageDown: Large scroll (30 activities)
 * - ↑/↓: Small scroll (5 activities) - only when isActive=true
 * - Esc: Return to bottom (exit manual mode)
 *
 * Note: Home/End keys are not supported by Ink's useInput hook.
 *
 * @param options - Scroll key options
 *
 * @example
 * ```typescript
 * useScrollKeys({
 *   isActive: isInputDisabled || isMultilineMode,
 *   onScrollUp: (amount) => setOffset(offset + amount),
 *   onScrollDown: (amount) => setOffset(Math.max(0, offset - amount)),
 *   onScrollTop: () => setOffset(maxOffset),
 *   onScrollBottom: () => setOffset(0),
 * });
 * ```
 */
export function useScrollKeys(options: UseScrollKeysOptions): void {
  const { isActive, onScrollUp, onScrollDown, onScrollTop, onScrollBottom } = options;

  useInput(
    (input, key) => {
      // Page Up/Down - Large step scrolling (always active)
      if (key.pageUp) {
        onScrollUp(SCROLL.STEP_LARGE);
        return;
      }
      if (key.pageDown) {
        onScrollDown(SCROLL.STEP_LARGE);
        return;
      }

      // Escape - Return to bottom (always active)
      if (key.escape) {
        onScrollBottom();
        return;
      }

      // Arrow keys - Small step scrolling (only when active)
      if (!isActive) return;

      if (key.upArrow) {
        onScrollUp(SCROLL.STEP_SMALL);
        return;
      }
      if (key.downArrow) {
        onScrollDown(SCROLL.STEP_SMALL);
        return;
      }
    },
    { isActive: true }
  );
}
