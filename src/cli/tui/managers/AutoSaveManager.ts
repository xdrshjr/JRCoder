/**
 * AutoSaveManager - Manages automatic saving and restoration of TUI state
 */

import fs from 'fs-extra';
import path from 'path';
import type { ILogger } from '../../../logger/interfaces';
import type { TUIState } from '../types';
import { logger as defaultLogger } from '../logger';

/**
 * Auto save manager options
 */
export interface AutoSaveManagerOptions {
  /**
   * Session ID
   */
  sessionId: string;

  /**
   * Auto-save interval in milliseconds
   */
  intervalMs?: number;

  /**
   * Workspace directory for storing state
   */
  workspaceDir?: string;

  /**
   * Logger instance
   */
  logger?: ILogger;

  /**
   * Enable auto-save
   */
  enabled?: boolean;
}

/**
 * Saved state metadata
 */
export interface SavedStateMetadata {
  /**
   * Session ID
   */
  sessionId: string;

  /**
   * Timestamp when state was saved
   */
  savedAt: number;

  /**
   * Version of the state format
   */
  version: string;

  /**
   * Number of activities in the state
   */
  activityCount: number;
}

/**
 * Saved state with metadata
 */
export interface SavedState {
  /**
   * Metadata about the saved state
   */
  metadata: SavedStateMetadata;

  /**
   * The actual TUI state
   */
  state: TUIState;
}

/**
 * Auto save manager for TUI state
 */
export class AutoSaveManager {
  private sessionId: string;
  private intervalMs: number;
  private workspaceDir: string;
  private logger: ILogger;
  private enabled: boolean;

  private saveInterval: NodeJS.Timeout | null = null;
  private isDirty = false;
  private getState: (() => TUIState) | null = null;

  private readonly STATE_VERSION = '1.0.0';

  /**
   * Create a new auto-save manager
   */
  constructor(options: AutoSaveManagerOptions) {
    this.sessionId = options.sessionId;
    this.intervalMs = options.intervalMs || 60000; // Default: 60 seconds
    this.workspaceDir = options.workspaceDir || '.workspace';
    this.logger = options.logger || defaultLogger;
    this.enabled = options.enabled !== false;

    this.logger.debug('AutoSaveManager initialized', {
      type: 'auto_save_manager_init',
      sessionId: this.sessionId,
      intervalMs: this.intervalMs,
      enabled: this.enabled,
    });
  }

  /**
   * Start auto-save timer
   */
  start(getState: () => TUIState): void {
    if (!this.enabled) {
      this.logger.info('Auto-save is disabled', {
        type: 'auto_save_disabled',
      });
      return;
    }

    this.getState = getState;

    // Clear existing interval if any
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }

    // Start new interval
    this.saveInterval = setInterval(() => {
      if (this.isDirty) {
        this.save().catch((error) => {
          this.logger.error('Auto-save failed', error as Error, {
            type: 'auto_save_error',
            sessionId: this.sessionId,
          });
        });
      }
    }, this.intervalMs);

    this.logger.info('Auto-save started', {
      type: 'auto_save_started',
      sessionId: this.sessionId,
      intervalMs: this.intervalMs,
    });
  }

  /**
   * Stop auto-save timer
   */
  stop(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;

      this.logger.info('Auto-save stopped', {
        type: 'auto_save_stopped',
        sessionId: this.sessionId,
      });
    }

    // Save one last time if dirty
    if (this.isDirty) {
      this.save().catch((error) => {
        this.logger.error('Final save failed', error as Error, {
          type: 'final_save_error',
          sessionId: this.sessionId,
        });
      });
    }
  }

  /**
   * Mark state as dirty (needs saving)
   */
  markDirty(): void {
    this.isDirty = true;

    this.logger.debug('State marked as dirty', {
      type: 'state_marked_dirty',
      sessionId: this.sessionId,
    });
  }

  /**
   * Save current state to disk
   */
  async save(): Promise<void> {
    if (!this.getState) {
      this.logger.warn('Cannot save: getState function not set', {
        type: 'auto_save_skip_no_getter',
      });
      return;
    }

    try {
      const state = this.getState();
      const stateDir = path.join(this.workspaceDir, 'sessions', this.sessionId);
      await fs.ensureDir(stateDir);

      const savedState: SavedState = {
        metadata: {
          sessionId: this.sessionId,
          savedAt: Date.now(),
          version: this.STATE_VERSION,
          activityCount: state.activities.length,
        },
        state,
      };

      const stateFile = path.join(stateDir, 'tui-state.json');
      await fs.writeJSON(stateFile, savedState, { spaces: 2 });

      this.isDirty = false;

      this.logger.info('State saved successfully', {
        type: 'state_saved',
        sessionId: this.sessionId,
        filePath: stateFile,
        activityCount: state.activities.length,
      });
    } catch (error) {
      this.logger.error('Failed to save state', error as Error, {
        type: 'state_save_error',
        sessionId: this.sessionId,
      });
      throw error;
    }
  }

  /**
   * Restore state from disk
   */
  async restore(): Promise<TUIState | null> {
    try {
      const stateFile = path.join(this.workspaceDir, 'sessions', this.sessionId, 'tui-state.json');

      // Check if state file exists
      if (!(await fs.pathExists(stateFile))) {
        this.logger.debug('No saved state found', {
          type: 'state_restore_skip',
          sessionId: this.sessionId,
          filePath: stateFile,
        });
        return null;
      }

      const savedState: SavedState = await fs.readJSON(stateFile);

      // Validate state version
      if (savedState.metadata.version !== this.STATE_VERSION) {
        this.logger.warn('State version mismatch', {
          type: 'state_version_mismatch',
          savedVersion: savedState.metadata.version,
          currentVersion: this.STATE_VERSION,
        });
        // Could implement migration logic here
      }

      this.logger.info('State restored successfully', {
        type: 'state_restored',
        sessionId: this.sessionId,
        savedAt: savedState.metadata.savedAt,
        activityCount: savedState.metadata.activityCount,
      });

      return savedState.state;
    } catch (error) {
      this.logger.error('Failed to restore state', error as Error, {
        type: 'state_restore_error',
        sessionId: this.sessionId,
      });
      return null;
    }
  }

  /**
   * Delete saved state
   */
  async delete(): Promise<void> {
    try {
      const stateFile = path.join(this.workspaceDir, 'sessions', this.sessionId, 'tui-state.json');

      if (await fs.pathExists(stateFile)) {
        await fs.remove(stateFile);

        this.logger.info('Saved state deleted', {
          type: 'state_deleted',
          sessionId: this.sessionId,
          filePath: stateFile,
        });
      }
    } catch (error) {
      this.logger.error('Failed to delete saved state', error as Error, {
        type: 'state_delete_error',
        sessionId: this.sessionId,
      });
      throw error;
    }
  }

  /**
   * Check if saved state exists
   */
  async exists(): Promise<boolean> {
    try {
      const stateFile = path.join(this.workspaceDir, 'sessions', this.sessionId, 'tui-state.json');

      return await fs.pathExists(stateFile);
    } catch {
      return false;
    }
  }

  /**
   * Get saved state metadata without loading the full state
   */
  async getMetadata(): Promise<SavedStateMetadata | null> {
    try {
      const stateFile = path.join(this.workspaceDir, 'sessions', this.sessionId, 'tui-state.json');

      if (!(await fs.pathExists(stateFile))) {
        return null;
      }

      const savedState: SavedState = await fs.readJSON(stateFile);
      return savedState.metadata;
    } catch (error) {
      this.logger.error('Failed to get state metadata', error as Error, {
        type: 'state_metadata_error',
        sessionId: this.sessionId,
      });
      return null;
    }
  }

  /**
   * Create a backup of the current state
   */
  async backup(): Promise<string> {
    try {
      const stateFile = path.join(this.workspaceDir, 'sessions', this.sessionId, 'tui-state.json');

      if (!(await fs.pathExists(stateFile))) {
        throw new Error('No state file to backup');
      }

      const backupFile = path.join(
        this.workspaceDir,
        'sessions',
        this.sessionId,
        `tui-state-backup-${Date.now()}.json`
      );

      await fs.copy(stateFile, backupFile);

      this.logger.info('State backed up', {
        type: 'state_backed_up',
        sessionId: this.sessionId,
        backupFile,
      });

      return backupFile;
    } catch (error) {
      this.logger.error('Failed to backup state', error as Error, {
        type: 'state_backup_error',
        sessionId: this.sessionId,
      });
      throw error;
    }
  }

  /**
   * Clean up old backups
   */
  async cleanupBackups(keepCount: number = 5): Promise<void> {
    try {
      const sessionDir = path.join(this.workspaceDir, 'sessions', this.sessionId);

      if (!(await fs.pathExists(sessionDir))) {
        return;
      }

      const files = await fs.readdir(sessionDir);
      const backupFiles = files
        .filter((file) => file.startsWith('tui-state-backup-'))
        .map((file) => ({
          name: file,
          path: path.join(sessionDir, file),
          timestamp: parseInt(file.replace('tui-state-backup-', '').replace('.json', '')),
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      // Remove old backups
      const toRemove = backupFiles.slice(keepCount);
      for (const backup of toRemove) {
        await fs.remove(backup.path);
        this.logger.debug('Old backup removed', {
          type: 'backup_removed',
          backupFile: backup.name,
        });
      }

      if (toRemove.length > 0) {
        this.logger.info('Old backups cleaned up', {
          type: 'backups_cleaned',
          removedCount: toRemove.length,
          keptCount: Math.min(keepCount, backupFiles.length),
        });
      }
    } catch (error) {
      this.logger.error('Failed to cleanup backups', error as Error, {
        type: 'backup_cleanup_error',
        sessionId: this.sessionId,
      });
    }
  }
}
