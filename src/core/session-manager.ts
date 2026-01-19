/**
 * Session manager for session persistence and recovery
 */

import type { ILogger } from '../logger/interfaces';
import type { ISessionStorage } from '../storage/interfaces';
import type { AgentState, GlobalConfig } from '../types';

/**
 * Session data interface
 */
export interface SessionData {
  id: string;
  state: AgentState;
  config: GlobalConfig;
  createdAt: number;
  updatedAt: number;
}

/**
 * Session manager class
 */
export class SessionManager {
  private storage: ISessionStorage;
  private logger: ILogger;
  private autoSaveTimer?: ReturnType<typeof setInterval>;

  constructor(storage: ISessionStorage, logger: ILogger) {
    this.storage = storage;
    this.logger = logger;
  }

  /**
   * Save current session
   */
  async saveSession(
    state: AgentState,
    config: GlobalConfig,
    sessionId?: string
  ): Promise<string> {
    const id = sessionId || `session_${Date.now()}`;

    const sessionData: SessionData = {
      id,
      state: this.sanitizeState(state),
      config: this.sanitizeConfig(config),
      createdAt: sessionId ? (await this.storage.load(sessionId))?.createdAt || Date.now() : Date.now(),
      updatedAt: Date.now(),
    };

    await this.storage.save(sessionData);

    this.logger.info(`Session saved: ${id}`, {
      phase: state.phase,
      iteration: state.currentIteration,
    });

    return id;
  }

  /**
   * Load session by ID
   */
  async loadSession(sessionId: string): Promise<SessionData | null> {
    const sessionData = await this.storage.load(sessionId);

    if (!sessionData) {
      this.logger.warn(`Session not found: ${sessionId}`);
      return null;
    }

    this.logger.info(`Session loaded: ${sessionId}`, {
      phase: sessionData.state.phase,
      iteration: sessionData.state.currentIteration,
    });

    return sessionData;
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<SessionData[]> {
    return this.storage.list();
  }

  /**
   * Delete session by ID
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.storage.delete(sessionId);
    this.logger.info(`Session deleted: ${sessionId}`);
  }

  /**
   * Start auto-save with specified interval
   */
  startAutoSave(
    getState: () => AgentState,
    getConfig: () => GlobalConfig,
    sessionId: string,
    interval: number = 60000
  ): ReturnType<typeof setInterval> {
    // Clear existing timer if any
    this.stopAutoSave();

    this.autoSaveTimer = setInterval(async () => {
      try {
        const state = getState();
        const config = getConfig();

        await this.saveSession(state, config, sessionId);

        this.logger.debug('Auto-save completed', { sessionId });
      } catch (error) {
        this.logger.error('Auto-save failed', error as Error, { sessionId });
      }
    }, interval);

    this.logger.info(`Auto-save started: ${interval}ms interval`, { sessionId });

    return this.autoSaveTimer;
  }

  /**
   * Stop auto-save
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
      this.logger.debug('Auto-save stopped');
    }
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const sessions = await this.listSessions();
    const now = Date.now();
    let cleanedCount = 0;

    for (const session of sessions) {
      const age = now - session.updatedAt;

      if (age > maxAge) {
        await this.deleteSession(session.id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(`Cleaned up ${cleanedCount} old sessions`);
    }

    return cleanedCount;
  }

  /**
   * Export session to JSON string
   */
  async exportSession(sessionId: string): Promise<string | null> {
    const session = await this.loadSession(sessionId);

    if (!session) {
      return null;
    }

    return JSON.stringify(session, null, 2);
  }

  /**
   * Import session from JSON string
   */
  async importSession(jsonString: string): Promise<string> {
    try {
      const sessionData = JSON.parse(jsonString) as SessionData;

      // Validate session data
      if (!sessionData.id || !sessionData.state || !sessionData.config) {
        throw new Error('Invalid session data format');
      }

      // Generate new ID to avoid conflicts
      const newId = `session_${Date.now()}`;
      sessionData.id = newId;
      sessionData.updatedAt = Date.now();

      await this.storage.save(sessionData);

      this.logger.info(`Session imported: ${newId}`);

      return newId;
    } catch (error) {
      this.logger.error('Failed to import session', error as Error);
      throw error;
    }
  }

  /**
   * Sanitize state before saving (remove sensitive data)
   */
  private sanitizeState(state: AgentState): AgentState {
    // Deep clone to avoid mutating original
    const sanitized = JSON.parse(JSON.stringify(state));

    // Remove any sensitive data if needed
    // For now, just return the clone
    return sanitized;
  }

  /**
   * Sanitize config before saving (remove API keys)
   */
  private sanitizeConfig(config: GlobalConfig): GlobalConfig {
    // Deep clone
    const sanitized = JSON.parse(JSON.stringify(config));

    // Remove API keys
    if (sanitized.llm) {
      for (const role of ['planner', 'executor', 'reflector'] as const) {
        if (sanitized.llm[role]?.apiKey) {
          delete sanitized.llm[role].apiKey;
        }
      }
    }

    return sanitized;
  }

  /**
   * Get session statistics
   */
  async getStatistics(): Promise<{
    totalSessions: number;
    oldestSession: number | null;
    newestSession: number | null;
    totalSize: number;
  }> {
    const sessions = await this.listSessions();

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        oldestSession: null,
        newestSession: null,
        totalSize: 0,
      };
    }

    const timestamps = sessions.map((s) => s.updatedAt);
    const totalSize = sessions.reduce(
      (sum, s) => sum + JSON.stringify(s).length * 2,
      0
    );

    return {
      totalSessions: sessions.length,
      oldestSession: Math.min(...timestamps),
      newestSession: Math.max(...timestamps),
      totalSize,
    };
  }
}
