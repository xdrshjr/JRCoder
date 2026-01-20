/**
 * File operation tools
 */

import fs from 'fs/promises';
import path from 'path';
import { BaseTool } from './base';
import type { ToolParameter, ToolResult } from '../types';
import { PathValidator, FileSizeValidator } from './validators';

/**
 * File read tool
 */
export class FileReadTool extends BaseTool {
  readonly name = 'file_read';
  readonly description = '读取文件内容';
  readonly parameters: ToolParameter[] = [
    {
      name: 'path',
      type: 'string',
      description:
        '文件路径（可以是相对路径或绝对路径。相对路径相对于工作目录，绝对路径可以指向任何位置）',
      required: true,
    },
    {
      name: 'encoding',
      type: 'string',
      description: '文件编码',
      required: false,
      default: 'utf8',
      enum: ['utf8', 'ascii', 'base64'],
    },
  ];

  constructor(
    private workspaceDir: string,
    private maxFileSize: number
  ) {
    super();
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { path: filePath, encoding = 'utf8' } = args;

    try {
      // Validate path
      const safePath = PathValidator.validate(filePath, this.workspaceDir);

      // Check file size
      await FileSizeValidator.validate(safePath, this.maxFileSize);

      // Read file
      const content = await fs.readFile(safePath, encoding as BufferEncoding);

      return {
        success: true,
        data: {
          path: filePath,
          content,
          size: content.length,
          encoding,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to read file: ${error.message}`,
      };
    }
  }
}

/**
 * File write tool
 */
export class FileWriteTool extends BaseTool {
  readonly name = 'file_write';
  readonly description = '写入或创建文件';
  readonly dangerous = true;
  readonly parameters: ToolParameter[] = [
    {
      name: 'path',
      type: 'string',
      description:
        '文件路径（可以是相对路径或绝对路径。相对路径相对于工作目录，绝对路径可以指向任何位置）',
      required: true,
    },
    {
      name: 'content',
      type: 'string',
      description: '文件内容',
      required: true,
    },
    {
      name: 'mode',
      type: 'string',
      description: '写入模式',
      required: false,
      default: 'overwrite',
      enum: ['overwrite', 'append'],
    },
  ];

  constructor(private workspaceDir: string) {
    super();
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { path: filePath, content, mode = 'overwrite' } = args;

    try {
      // Validate path
      const safePath = PathValidator.validate(filePath, this.workspaceDir);

      // Ensure directory exists
      await fs.mkdir(path.dirname(safePath), { recursive: true });

      // Write file
      if (mode === 'append') {
        await fs.appendFile(safePath, content, 'utf8');
      } else {
        await fs.writeFile(safePath, content, 'utf8');
      }

      // Verify file was created
      const stats = await fs.stat(safePath);

      return {
        success: true,
        data: {
          path: filePath,
          absolutePath: safePath,
          size: stats.size,
          mode,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to write file: ${error.message}`,
      };
    }
  }
}

/**
 * File list tool
 */
export class FileListTool extends BaseTool {
  readonly name = 'file_list';
  readonly description = '列出目录中的文件和子目录';
  readonly parameters: ToolParameter[] = [
    {
      name: 'path',
      type: 'string',
      description: '目录路径',
      required: false,
      default: '.',
    },
    {
      name: 'recursive',
      type: 'boolean',
      description: '是否递归列出子目录',
      required: false,
      default: false,
    },
    {
      name: 'pattern',
      type: 'string',
      description: '文件名匹配模式（glob）',
      required: false,
    },
  ];

  constructor(private workspaceDir: string) {
    super();
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { path: dirPath = '.', recursive = false, pattern } = args;

    try {
      // Validate path
      const safePath = PathValidator.validate(dirPath, this.workspaceDir);

      // List files
      const files = await this.listFiles(safePath, recursive, pattern);

      return {
        success: true,
        data: {
          path: dirPath,
          absolutePath: safePath,
          count: files.length,
          files: files.map((f) => ({
            name: f.name,
            path: path.relative(this.workspaceDir, f.path),
            type: f.isDirectory ? 'directory' : 'file',
            size: f.size,
            modified: f.mtime,
          })),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to list files: ${error.message}`,
      };
    }
  }

  private async listFiles(
    dirPath: string,
    recursive: boolean,
    pattern?: string
  ): Promise<
    Array<{ name: string; path: string; isDirectory: boolean; size: number; mtime: number }>
  > {
    const results: Array<{
      name: string;
      path: string;
      isDirectory: boolean;
      size: number;
      mtime: number;
    }> = [];

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Apply pattern filter if specified
      if (pattern && !this.matchPattern(entry.name, pattern)) {
        continue;
      }

      const stats = await fs.stat(fullPath);

      results.push({
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
        size: stats.size,
        mtime: stats.mtimeMs,
      });

      // Recurse into subdirectories
      if (recursive && entry.isDirectory()) {
        const subFiles = await this.listFiles(fullPath, recursive, pattern);
        results.push(...subFiles);
      }
    }

    return results;
  }

  private matchPattern(filename: string, pattern: string): boolean {
    // Simple glob pattern matching
    const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filename);
  }
}
