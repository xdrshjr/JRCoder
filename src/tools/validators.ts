/**
 * Tool validators for security and safety checks
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { ValidationError } from '../core/errors';

/**
 * Path validator - prevents path traversal attacks
 */
export class PathValidator {
  /**
   * Validate and normalize a file path
   */
  static validate(filePath: string, workspaceDir: string): string {
    // Resolve to absolute path
    const absolutePath = path.resolve(workspaceDir, filePath);
    const normalizedWorkspace = path.resolve(workspaceDir);

    // Prevent path traversal attacks
    if (!absolutePath.startsWith(normalizedWorkspace)) {
      throw new ValidationError(
        'Path is outside workspace directory',
        { path: filePath, workspace: workspaceDir }
      );
    }

    return absolutePath;
  }

  /**
   * Check if path is within workspace
   */
  static isWithinWorkspace(filePath: string, workspaceDir: string): boolean {
    try {
      this.validate(filePath, workspaceDir);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * File size validator
 */
export class FileSizeValidator {
  /**
   * Validate file size doesn't exceed limit
   */
  static async validate(filePath: string, maxSize: number): Promise<void> {
    try {
      const stats = await fs.stat(filePath);

      if (stats.size > maxSize) {
        throw new ValidationError(
          `File size (${stats.size} bytes) exceeds limit (${maxSize} bytes)`,
          { path: filePath, size: stats.size, maxSize }
        );
      }
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Failed to check file size: ${error.message}`, {
        path: filePath,
      });
    }
  }
}

/**
 * Command validator - prevents dangerous shell commands
 */
export class CommandValidator {
  private static readonly DANGEROUS_PATTERNS = [
    /rm\s+-rf\s+\//i, // rm -rf /
    /:\(\)\{.*\}/i, // Fork bomb
    /mkfs/i, // Format disk
    /dd\s+if=/i, // Disk operations
    />\s*\/dev\/sd[a-z]/i, // Write to disk device
    /curl.*\|\s*bash/i, // Pipe to bash
    /wget.*\|\s*sh/i, // Pipe to shell
  ];

  /**
   * Validate shell command for dangerous patterns
   */
  static validate(command: string): void {
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        throw new ValidationError(
          'Dangerous command detected and blocked',
          { command, pattern: pattern.source }
        );
      }
    }
  }

  /**
   * Check if command is dangerous
   */
  static isDangerous(command: string): boolean {
    try {
      this.validate(command);
      return false;
    } catch {
      return true;
    }
  }
}

/**
 * File extension validator
 */
export class ExtensionValidator {
  /**
   * Validate file extension is allowed
   */
  static validate(filePath: string, allowedExtensions: string[]): void {
    const ext = path.extname(filePath).toLowerCase();

    if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
      throw new ValidationError(
        `File extension '${ext}' is not allowed`,
        { path: filePath, allowed: allowedExtensions }
      );
    }
  }

  /**
   * Check if extension is allowed
   */
  static isAllowed(filePath: string, allowedExtensions: string[]): boolean {
    try {
      this.validate(filePath, allowedExtensions);
      return true;
    } catch {
      return false;
    }
  }
}
