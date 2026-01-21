/**
 * TUI Layout Constants
 *
 * Defines fixed heights and display settings for TUI components
 * to prevent layout issues and ensure consistent rendering.
 */

/**
 * Component Heights (in terminal lines)
 */
export const LAYOUT_HEIGHTS = {
  /** Header component height */
  HEADER: 3,

  /** Status bar component height */
  STATUS_BAR: 3,

  /** Input box height in single-line mode */
  INPUT_SINGLE_LINE: 4,

  /** Maximum input box height in multi-line mode */
  INPUT_MULTILINE_MAX: 14,

  /** Minimum safe content area height */
  MIN_CONTENT_HEIGHT: 10,
} as const;

/**
 * Activity Display Settings
 */
export const ACTIVITY_DISPLAY = {
  /** Maximum number of visible activities in ContentArea (virtual window) */
  MAX_VISIBLE_ACTIVITIES: 30,

  /** Maximum lines to show for bash command output */
  MAX_BASH_OUTPUT_LINES: 10,

  /** Maximum lines to show for tool call results */
  MAX_TOOL_RESULT_LINES: 5,

  /** Maximum characters per line before truncation */
  MAX_TEXT_LENGTH: 120,

  /** Maximum lines to show in multiline input */
  MAX_INPUT_LINES: 10,
} as const;

/**
 * Terminal Settings
 */
export const TERMINAL = {
  /** Minimum supported terminal height */
  MIN_HEIGHT: 24,

  /** Default terminal height if detection fails */
  DEFAULT_HEIGHT: 40,
} as const;

/**
 * Calculate the available height for ContentArea based on terminal height
 * and input mode.
 *
 * @param terminalHeight - Total terminal height in lines
 * @param isInputMultiline - Whether input is in multiline mode
 * @returns Available height for ContentArea in lines
 */
export function calculateContentHeight(
  terminalHeight: number,
  isInputMultiline: boolean
): number {
  // Use default height if terminal height is invalid
  const safeTerminalHeight = terminalHeight > 0
    ? terminalHeight
    : TERMINAL.DEFAULT_HEIGHT;

  // Calculate input height based on mode
  const inputHeight = isInputMultiline
    ? LAYOUT_HEIGHTS.INPUT_MULTILINE_MAX
    : LAYOUT_HEIGHTS.INPUT_SINGLE_LINE;

  // Calculate content height: terminal - header - statusBar - input
  const contentHeight = safeTerminalHeight
    - LAYOUT_HEIGHTS.HEADER
    - LAYOUT_HEIGHTS.STATUS_BAR
    - inputHeight;

  // Ensure minimum content height
  return Math.max(contentHeight, LAYOUT_HEIGHTS.MIN_CONTENT_HEIGHT);
}
