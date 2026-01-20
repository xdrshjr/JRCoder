/**
 * File-based snippet storage implementation
 */

import fs from 'fs-extra';
import path from 'path';
import type { CodeSnippet } from '../types';
import type { ISnippetStorage } from './interfaces';
import { StorageError } from '../core/errors';

export class FileSnippetStorage implements ISnippetStorage {
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
      throw new StorageError(`Failed to create snippet directory: ${error.message}`);
    }
  }

  /**
   * Get file path for snippet
   */
  private getFilePath(id: string): string {
    return path.join(this.baseDir, `${id}.json`);
  }

  /**
   * Save snippet to file
   */
  async save(snippet: CodeSnippet): Promise<void> {
    try {
      await this.ensureDirectory();
      const filePath = this.getFilePath(snippet.id);
      await fs.writeJson(filePath, snippet, { spaces: 2 });
    } catch (error: any) {
      throw new StorageError(`Failed to save snippet: ${error.message}`, { snippetId: snippet.id });
    }
  }

  /**
   * Load snippet from file
   */
  async load(id: string): Promise<CodeSnippet | null> {
    try {
      const filePath = this.getFilePath(id);
      if (!(await fs.pathExists(filePath))) {
        return null;
      }
      return await fs.readJson(filePath);
    } catch (error: any) {
      throw new StorageError(`Failed to load snippet: ${error.message}`, { snippetId: id });
    }
  }

  /**
   * List all snippets with optional filtering
   */
  async list(filter?: { tags?: string[]; language?: string }): Promise<CodeSnippet[]> {
    try {
      await this.ensureDirectory();
      const files = await fs.readdir(this.baseDir);
      const snippets: CodeSnippet[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.baseDir, file);
          const snippet = await fs.readJson(filePath);

          // Apply filters
          if (filter) {
            if (filter.language && snippet.language !== filter.language) {
              continue;
            }
            if (filter.tags && filter.tags.length > 0) {
              const hasTag = filter.tags.some((tag) => snippet.tags.includes(tag));
              if (!hasTag) {
                continue;
              }
            }
          }

          snippets.push(snippet);
        }
      }

      return snippets;
    } catch (error: any) {
      throw new StorageError(`Failed to list snippets: ${error.message}`);
    }
  }

  /**
   * Delete snippet
   */
  async delete(id: string): Promise<void> {
    try {
      const filePath = this.getFilePath(id);
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }
    } catch (error: any) {
      throw new StorageError(`Failed to delete snippet: ${error.message}`, { snippetId: id });
    }
  }

  /**
   * Search snippets by query
   */
  async search(query: string): Promise<CodeSnippet[]> {
    try {
      const all = await this.list();
      const lowerQuery = query.toLowerCase();

      return all.filter(
        (snippet) =>
          snippet.name.toLowerCase().includes(lowerQuery) ||
          snippet.description.toLowerCase().includes(lowerQuery) ||
          snippet.code.toLowerCase().includes(lowerQuery) ||
          snippet.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    } catch (error: any) {
      throw new StorageError(`Failed to search snippets: ${error.message}`, { query });
    }
  }
}
