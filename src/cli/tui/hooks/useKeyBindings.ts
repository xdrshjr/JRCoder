/**
 * useKeyBindings Hook - Global keyboard shortcut bindings
 */

import { useInput } from 'ink';
import { logger } from '../logger';

/**
 * Key binding handlers
 */
export interface KeyBindingHandlers {
  /**
   * Handler for exit (Ctrl+C)
   */
  onExit?: () => void;

  /**
   * Handler for save session (Ctrl+S)
   */
  onSaveSession?: () => void;

  /**
   * Handler for clear screen (Ctrl+L)
   */
  onClearScreen?: () => void;

  /**
   * Handler for toggle pause (Ctrl+P)
   */
  onTogglePause?: () => void;

  /**
   * Handler for show help (F1)
   */
  onShowHelp?: () => void;

  /**
   * Handler for toggle debug mode (Ctrl+D)
   */
  onToggleDebug?: () => void;

  /**
   * Handler for export logs (Ctrl+E)
   */
  onExportLogs?: () => void;
}

/**
 * Hook options
 */
export interface UseKeyBindingsOptions {
  /**
   * Whether the key bindings are active
   */
  isActive?: boolean;

  /**
   * Whether to log key presses
   */
  logKeyPresses?: boolean;
}

/**
 * Custom hook for global keyboard shortcuts
 *
 * @param handlers - Key binding handlers
 * @param options - Hook options
 */
export function useKeyBindings(
  handlers: KeyBindingHandlers,
  options: UseKeyBindingsOptions = {}
): void {
  const { isActive = true, logKeyPresses = false } = options;

  useInput(
    (input, key) => {
      // Log key press if enabled
      if (logKeyPresses) {
        logger.debug('Key pressed', {
          type: 'key_press',
          input,
          key: JSON.stringify(key),
        });
      }

      // Ctrl+C: Exit
      if (key.ctrl && input === 'c') {
        logger.info('Exit shortcut triggered', {
          type: 'shortcut_triggered',
          shortcut: 'Ctrl+C',
        });

        handlers.onExit?.();
        return;
      }

      // Ctrl+S: Save session
      if (key.ctrl && input === 's') {
        logger.info('Save session shortcut triggered', {
          type: 'shortcut_triggered',
          shortcut: 'Ctrl+S',
        });

        handlers.onSaveSession?.();
        return;
      }

      // Ctrl+L: Clear screen
      if (key.ctrl && input === 'l') {
        logger.info('Clear screen shortcut triggered', {
          type: 'shortcut_triggered',
          shortcut: 'Ctrl+L',
        });

        handlers.onClearScreen?.();
        return;
      }

      // Ctrl+P: Toggle pause
      if (key.ctrl && input === 'p') {
        logger.info('Toggle pause shortcut triggered', {
          type: 'shortcut_triggered',
          shortcut: 'Ctrl+P',
        });

        handlers.onTogglePause?.();
        return;
      }

      // Ctrl+D: Toggle debug mode
      if (key.ctrl && input === 'd') {
        logger.info('Toggle debug shortcut triggered', {
          type: 'shortcut_triggered',
          shortcut: 'Ctrl+D',
        });

        handlers.onToggleDebug?.();
        return;
      }

      // Ctrl+E: Export logs
      if (key.ctrl && input === 'e') {
        logger.info('Export logs shortcut triggered', {
          type: 'shortcut_triggered',
          shortcut: 'Ctrl+E',
        });

        handlers.onExportLogs?.();
        return;
      }

      // F1: Show help (note: F1 may not be available in all terminals)
      // Commenting out F1 binding as it's not supported by ink's useInput
      // if (key.f1) {
      //   logger.info('Help shortcut triggered', {
      //     type: 'shortcut_triggered',
      //     shortcut: 'F1',
      //   });
      //   handlers.onShowHelp?.();
      //   return;
      // }
    },
    { isActive }
  );
}

/**
 * Get help text for available keyboard shortcuts
 */
export function getKeyBindingsHelpText(): string {
  return `
Available Keyboard Shortcuts:

  Ctrl+C    Exit the application
  Ctrl+S    Save current session
  Ctrl+L    Clear screen
  Ctrl+P    Pause/Resume agent execution
  Ctrl+D    Toggle debug mode
  Ctrl+E    Export logs
  F1        Show this help

Input Commands:

  Enter     Send message (single line mode)
  Ctrl+M    Toggle multiline mode
  ↑/↓       Navigate command history (single line mode)
  Ctrl+Enter Send message (multiline mode)

Scrolling Activities:

  PageUp/PageDown   Scroll through activities (30 at a time)
  ↑/↓              Scroll through activities (5 at a time, when input disabled)
  Esc              Return to auto-scroll mode
  `.trim();
}
