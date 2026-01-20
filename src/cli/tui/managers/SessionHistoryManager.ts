/**
 * SessionHistoryManager - Manages command history for user sessions
 */

import fs from 'fs-extra';
import path from 'path';
import type { ILogger } from '../../../logger/interfaces';
import { logger as defaultLogger } from '../logger';

/**
 * History entry
 */
export interface HistoryEntry {
  /**
   * User input message
   */
  message: string;

  /**
   * Timestamp when the message was sent
   */
  timestamp: number;

  /**
   * Session ID
   */
  sessionId: string;
}

/**
 * Session history manager options
 */
export interface SessionHistoryManagerOptions {
  /**
   * Maximum number of history entries to keep
   */
  maxHistorySize?: number;

  /**
   * Workspace directory for storing history
   */
  workspaceDir?: string;

  /**
   * Logger instance
   */
  logger?: ILogger;
}

/**
 * Session history manager for managing command history
 */
export class SessionHistoryManager {
  private history: HistoryEntry[] = [];
  private maxHistorySize: number;
  private workspaceDir: string;
  private logger: ILogger;

  /**
   * Create a new session history manager
   */
  constructor(options: SessionHistoryManagerOptions = {}) {
    this.maxHistorySize = options.maxHistorySize || 100;
    this.workspaceDir = options.workspaceDir || '.workspace';
    this.logger = options.logger || defaultLogger;

    this.logger.debug('SessionHistoryManager initialized', {
      type: 'history_manager_init',
      maxHistorySize: this.maxHistorySize,
      workspaceDir: this.workspaceDir,
    });
  }

  /**
   * Add a message to history
   */
  add(message: string, sessionId: string): void {
    const entry: HistoryEntry = {
      message,
      timestamp: Date.now(),
      sessionId,
    };

    this.history.push(entry);

    // Trim history if it exceeds max size
    if (this.history.length > this.maxHistorySize) {
      const removed = this.history.shift();
      this.logger.debug('History entry removed (max size exceeded)', {
        type: 'history_entry_removed',
        removedTimestamp: removed?.timestamp,
        currentSize: this.history.length,
      });
    }

    this.logger.debug('History entry added', {
      type: 'history_entry_added',
      messageLength: message.length,
      sessionId,
      historySize: this.history.length,
    });
  }

  /**
   * Get a history entry by index (0 is most recent)
   */
  get(index: number): string | undefined {
    if (index < 0 || index >= this.history.length) {
      return undefined;
    }

    const entry = this.history[this.history.length - 1 - index];
    return entry?.message;
  }

  /**
   * Get all history messages (most recent first)
   */
  getAll(): string[] {
    return this.history.map((entry) => entry.message).reverse();
  }

  /**
   * Get all history entries
   */
  getAllEntries(): HistoryEntry[] {
    return [...this.history].reverse();
  }

  /**
   * Get history for a specific session
   */
  getForSession(sessionId: string): string[] {
    return this.history
      .filter((entry) => entry.sessionId === sessionId)
      .map((entry) => entry.message)
      .reverse();
  }

  /**
   * Clear all history
   */
  clear(): void {
    const previousSize = this.history.length;
    this.history = [];

    this.logger.info('History cleared', {
      type: 'history_cleared',
      previousSize,
    });
  }

  /**
   * Get history size
   */
  size(): number {
    return this.history.length;
  }

  /**
   * Check if history is empty
   */
  isEmpty(): boolean {
    return this.history.length === 0;
  }

  /**
   * Save history to disk
   */
  async save(sessionId: string): Promise<void> {
    try {
      const historyDir = path.join(this.workspaceDir, 'sessions', sessionId);
      await fs.ensureDir(historyDir);

      const historyFile = path.join(historyDir, 'history.json');
      const sessionHistory = this.history.filter((entry) => entry.sessionId === sessionId);

      await fs.writeJSON(historyFile, sessionHistory, { spaces: 2 });

      this.logger.info('History saved to disk', {
        type: 'history_saved',
        sessionId,
        entryCount: sessionHistory.length,
        filePath: historyFile,
      });
    } catch (error) {
      this.logger.error('Failed to save history', error as Error, {
        type: 'history_save_error',
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Load history from disk
   */
  async load(sessionId: string): Promise<void> {
    try {
      const historyFile = path.join(this.workspaceDir, 'sessions', sessionId, 'history.json');

      // Check if history file exists
      if (!(await fs.pathExists(historyFile))) {
        this.logger.debug('No history file found', {
          type: 'history_load_skip',
          sessionId,
          filePath: historyFile,
        });
        return;
      }

      const sessionHistory = await fs.readJSON(historyFile);

      // Validate and load history
      if (Array.isArray(sessionHistory)) {
        // Remove old entries from this session
        this.history = this.history.filter((entry) => entry.sessionId !== sessionId);

        // Add loaded entries
        this.history.push(...sessionHistory);

        // Trim if necessary
        if (this.history.length > this.maxHistorySize) {
          this.history = this.history.slice(-this.maxHistorySize);
        }

        this.logger.info('History loaded from disk', {
          type: 'history_loaded',
          sessionId,
          entryCount: sessionHistory.length,
          filePath: historyFile,
        });
      }
    } catch (error) {
      this.logger.error('Failed to load history', error as Error, {
        type: 'history_load_error',
        sessionId,
      });
      // Don't throw - just continue with empty history
      this.history = [];
    }
  }

  /**
   * Export history to a file
   */
  async export(filePath: string, format: 'json' | 'txt' = 'json'): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(filePath));

      if (format === 'json') {
        await fs.writeJSON(filePath, this.history, { spaces: 2 });
      } else {
        const content = this.history
          .map((entry) => {
            const timestamp = new Date(entry.timestamp).toISOString();
            return `[${timestamp}] ${entry.message}`;
          })
          .join('\n');

        await fs.writeFile(filePath, content, 'utf8');
      }

      this.logger.info('History exported', {
        type: 'history_exported',
        filePath,
        format,
        entryCount: this.history.length,
      });
    } catch (error) {
      this.logger.error('Failed to export history', error as Error, {
        type: 'history_export_error',
        filePath,
        format,
      });
      throw error;
    }
  }

  /**
   * Search history by keyword
   */
  search(keyword: string): HistoryEntry[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.history.filter((entry) => entry.message.toLowerCase().includes(lowerKeyword));
  }

  /**
   * Get statistics about the history
   */
  getStats(): {
    totalEntries: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
    uniqueSessions: number;
  } {
    if (this.history.length === 0) {
      return {
        totalEntries: 0,
        oldestTimestamp: null,
        newestTimestamp: null,
        uniqueSessions: 0,
      };
    }

    const timestamps = this.history.map((entry) => entry.timestamp);
    const sessions = new Set(this.history.map((entry) => entry.sessionId));

    return {
      totalEntries: this.history.length,
      oldestTimestamp: Math.min(...timestamps),
      newestTimestamp: Math.max(...timestamps),
      uniqueSessions: sessions.size,
    };
  }
}
