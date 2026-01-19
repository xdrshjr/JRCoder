/**
 * Storage interfaces
 */

import type { CodeSnippet, SessionData } from '../types';

/**
 * Snippet storage interface
 */
export interface ISnippetStorage {
  save(snippet: CodeSnippet): Promise<void>;
  load(id: string): Promise<CodeSnippet | null>;
  list(filter?: { tags?: string[]; language?: string }): Promise<CodeSnippet[]>;
  delete(id: string): Promise<void>;
  search(query: string): Promise<CodeSnippet[]>;
}

/**
 * Session storage interface
 */
export interface ISessionStorage {
  save(session: SessionData): Promise<void>;
  load(id: string): Promise<SessionData | null>;
  list(): Promise<SessionData[]>;
  delete(id: string): Promise<void>;
}
