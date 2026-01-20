/**
 * TUI Logger - Simple logger instance for TUI components
 */

import { Logger } from '../../logger';

/**
 * Default TUI logger configuration
 */
const defaultConfig = {
  level: 'info' as const,
  outputDir: 'logs',
  enableConsole: false, // Disable console in TUI mode to avoid conflicts
  enableFile: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  format: 'json' as const,
};

/**
 * Global TUI logger instance
 */
export const logger = new Logger(defaultConfig);
