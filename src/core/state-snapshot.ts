/**
 * State snapshot manager for rollback functionality
 */

import type { ILogger } from '../logger/interfaces';
import type { AgentState } from '../types';

/**
 * State snapshot manager class
 */
export class StateSnapshotManager {
  private snapshots: Map<string, AgentState> = new Map();
  private logger: ILogger;
  private maxSnapshots: number;

  constructor(logger: ILogger, maxSnapshots: number = 10) {
    this.logger = logger;
    this.maxSnapshots = maxSnapshots;
  }

  /**
   * Create a snapshot of the current state
   */
  createSnapshot(state: AgentState, label: string): string {
    const snapshotId = `${label}_${Date.now()}`;

    // Deep clone the state
    const snapshot = this.deepClone(state);

    this.snapshots.set(snapshotId, snapshot);

    this.logger.debug(`Snapshot created: ${snapshotId}`, {
      phase: state.phase,
      iteration: state.currentIteration,
    });

    // Clean up old snapshots if exceeding max
    this.cleanupOldSnapshots();

    return snapshotId;
  }

  /**
   * Restore state from a snapshot
   */
  restoreSnapshot(snapshotId: string): AgentState | null {
    const snapshot = this.snapshots.get(snapshotId);

    if (!snapshot) {
      this.logger.warn(`Snapshot not found: ${snapshotId}`);
      return null;
    }

    this.logger.info(`Snapshot restored: ${snapshotId}`, {
      phase: snapshot.phase,
      iteration: snapshot.currentIteration,
    });

    // Return a deep clone to prevent mutation
    return this.deepClone(snapshot);
  }

  /**
   * Delete a specific snapshot
   */
  deleteSnapshot(snapshotId: string): boolean {
    const deleted = this.snapshots.delete(snapshotId);

    if (deleted) {
      this.logger.debug(`Snapshot deleted: ${snapshotId}`);
    }

    return deleted;
  }

  /**
   * Clean up snapshots older than maxAge
   */
  cleanup(maxAge: number = 3600000): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, snapshot] of this.snapshots.entries()) {
      const age = now - snapshot.startTime;

      if (age > maxAge) {
        this.snapshots.delete(id);
        cleanedCount++;
        this.logger.debug(`Snapshot cleaned up: ${id}`, { age });
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(`Cleaned up ${cleanedCount} old snapshots`);
    }
  }

  /**
   * Clean up old snapshots when exceeding max count
   */
  private cleanupOldSnapshots(): void {
    if (this.snapshots.size <= this.maxSnapshots) {
      return;
    }

    // Sort snapshots by timestamp (oldest first)
    const sortedSnapshots = Array.from(this.snapshots.entries()).sort(
      (a, b) => a[1].startTime - b[1].startTime
    );

    // Remove oldest snapshots
    const toRemove = this.snapshots.size - this.maxSnapshots;
    for (let i = 0; i < toRemove; i++) {
      const [id] = sortedSnapshots[i];
      this.snapshots.delete(id);
      this.logger.debug(`Snapshot removed (max limit): ${id}`);
    }
  }

  /**
   * List all snapshot IDs
   */
  listSnapshots(): string[] {
    return Array.from(this.snapshots.keys());
  }

  /**
   * Get snapshot count
   */
  getSnapshotCount(): number {
    return this.snapshots.size;
  }

  /**
   * Clear all snapshots
   */
  clearAll(): void {
    const count = this.snapshots.size;
    this.snapshots.clear();
    this.logger.info(`Cleared all ${count} snapshots`);
  }

  /**
   * Deep clone an object using JSON serialization
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Get memory usage estimate (in bytes)
   */
  getMemoryUsage(): number {
    let totalSize = 0;

    for (const snapshot of this.snapshots.values()) {
      // Rough estimate using JSON string length
      totalSize += JSON.stringify(snapshot).length * 2; // UTF-16 encoding
    }

    return totalSize;
  }
}
