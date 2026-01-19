/**
 * Log viewer for CLI
 */

import chalk from 'chalk';
import * as fs from 'fs-extra';
import chokidar from 'chokidar';
import { LogEntry } from '../types';

export interface LogViewOptions {
  tail?: number;
  session?: string;
  level?: string;
  follow?: boolean;
}

/**
 * Log viewer for displaying and following logs
 */
export class LogViewer {
  private buffer: LogEntry[] = [];
  private readonly maxBufferSize = 100;

  /**
   * Display a single log entry
   */
  displayLog(entry: LogEntry): void {
    this.buffer.push(entry);

    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    const time = new Date(entry.timestamp).toLocaleTimeString();
    const levelColor = {
      debug: chalk.gray,
      info: chalk.cyan,
      warn: chalk.yellow,
      error: chalk.red,
    }[entry.level];

    let output = `${chalk.gray(time)} ${levelColor(entry.level.toUpperCase())}: ${entry.message}`;

    if (entry.context) {
      const contextStr = Object.entries(entry.context)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      output += chalk.gray(` [${contextStr}]`);
    }

    console.log(output);

    if (entry.level === 'debug' && entry.data) {
      console.log(chalk.gray(JSON.stringify(entry.data, null, 2)));
    }
  }

  /**
   * View logs from file
   */
  async viewLogs(options: LogViewOptions): Promise<void> {
    const logFile = options.session ? `logs/session-${options.session}.log` : 'logs/combined.log';

    if (!(await fs.pathExists(logFile))) {
      console.log(chalk.yellow(`Log file not found: ${logFile}`));
      return;
    }

    const content = await fs.readFile(logFile, 'utf8');
    const lines = content.split('\n').filter((l) => l.trim());

    let entries = lines
      .map((line) => {
        try {
          return JSON.parse(line) as LogEntry;
        } catch {
          return null;
        }
      })
      .filter((e) => e !== null) as LogEntry[];

    // Filter by level
    if (options.level) {
      entries = entries.filter((e) => e.level === options.level);
    }

    // Limit number of entries
    if (options.tail) {
      entries = entries.slice(-options.tail);
    }

    // Display entries
    console.log(chalk.cyan(`\n📋 Logs from ${logFile}\n`));
    entries.forEach((entry) => this.displayLog(entry));

    // Follow mode
    if (options.follow) {
      console.log(chalk.gray('\n--- Following logs (Ctrl+C to exit) ---\n'));
      await this.followLogs(logFile);
    }
  }

  /**
   * Follow logs in real-time
   */
  private async followLogs(logFile: string): Promise<void> {
    let lastPosition = (await fs.stat(logFile)).size;

    const watcher = chokidar.watch(logFile, {
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('change', async () => {
      try {
        const stats = await fs.stat(logFile);
        const currentSize = stats.size;

        if (currentSize > lastPosition) {
          const stream = fs.createReadStream(logFile, {
            start: lastPosition,
            end: currentSize,
            encoding: 'utf8',
          });

          let buffer = '';
          stream.on('data', (chunk) => {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            lines.forEach((line) => {
              if (line.trim()) {
                try {
                  const entry = JSON.parse(line) as LogEntry;
                  this.displayLog(entry);
                } catch {
                  // Ignore parse errors
                }
              }
            });
          });

          lastPosition = currentSize;
        }
      } catch (error) {
        // Ignore errors during follow
      }
    });

    // Wait indefinitely (until Ctrl+C)
    await new Promise(() => {});
  }

  /**
   * Get recent logs from buffer
   */
  getRecent(count: number = 10): LogEntry[] {
    return this.buffer.slice(-count);
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer = [];
  }
}
