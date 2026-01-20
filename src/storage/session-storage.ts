/**
 * File-based session storage implementation
 */

import fs from 'fs-extra';
import path from 'path';
import type { SessionData } from '../types';
import type { ISessionStorage } from './interfaces';
import { StorageError } from '../core/errors';

export class FileSessionStorage implements ISessionStorage {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.ensureDirectory();
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureDirectory(): Promise<void> {
    try {
      await fs.ensureDir(this.baseDir);
    } catch (error: any) {
      throw new StorageError(`Failed to create session directory: ${error.message}`);
    }
  }

  /**
   * Get file path for session
   */
  private getFilePath(id: string): string {
    return path.join(this.baseDir, `${id}.json`);
  }

  /**
   * Save session to file
   */
  async save(session: SessionData): Promise<void> {
    try {
      await this.ensureDirectory();
      const filePath = this.getFilePath(session.id);
      await fs.writeJson(filePath, session, { spaces: 2 });
    } catch (error: any) {
      throw new StorageError(`Failed to save session: ${error.message}`, { sessionId: session.id });
    }
  }

  /**
   * Load session from file
   */
  async load(id: string): Promise<SessionData | null> {
    try {
      const filePath = this.getFilePath(id);
      if (!(await fs.pathExists(filePath))) {
        return null;
      }
      return await fs.readJson(filePath);
    } catch (error: any) {
      throw new StorageError(`Failed to load session: ${error.message}`, { sessionId: id });
    }
  }

  /**
   * List all sessions
   */
  async list(): Promise<SessionData[]> {
    try {
      await this.ensureDirectory();
      const files = await fs.readdir(this.baseDir);
      const sessions: SessionData[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.baseDir, file);
          const session = await fs.readJson(filePath);
          sessions.push(session);
        }
      }

      // Sort by creation date (newest first)
      return sessions.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error: any) {
      throw new StorageError(`Failed to list sessions: ${error.message}`);
    }
  }

  /**
   * Delete session
   */
  async delete(id: string): Promise<void> {
    try {
      const filePath = this.getFilePath(id);
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }
    } catch (error: any) {
      throw new StorageError(`Failed to delete session: ${error.message}`, { sessionId: id });
    }
  }
}
