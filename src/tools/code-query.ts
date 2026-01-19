/**
 * Code query tool for searching code in the workspace
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from './base';
import type { ToolParameter, ToolResult } from '../types';
import { PathValidator } from './validators';

const execAsync = promisify(exec);

interface SearchResult {
  file: string;
  line: number;
  column: number;
  code: string;
  context: string[];
}

/**
 * Code query tool using ripgrep
 */
export class CodeQueryTool extends BaseTool {
  readonly name = 'code_query';
  readonly description = '在代码库中搜索函数、类、变量或文件';
  readonly parameters: ToolParameter[] = [
    {
      name: 'query',
      type: 'string',
      description: '搜索关键词（函数名、类名、文件名等）',
      required: true,
    },
    {
      name: 'type',
      type: 'string',
      description: '搜索类型',
      required: false,
      default: 'all',
      enum: ['function', 'class', 'variable', 'file', 'all'],
    },
    {
      name: 'path',
      type: 'string',
      description: '限制搜索路径',
      required: false,
    },
  ];

  constructor(private workspaceDir: string) {
    super();
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { query, type = 'all', path } = args;

    try {
      // Validate path if provided
      let searchPath = this.workspaceDir;
      if (path) {
        searchPath = PathValidator.validate(path, this.workspaceDir);
      }

      // Search with ripgrep
      const results = await this.searchWithRipgrep(query, type, searchPath);

      return {
        success: true,
        data: {
          query,
          type,
          count: results.length,
          matches: results.map((r) => ({
            file: r.file,
            line: r.line,
            column: r.column,
            code: r.code,
            context: r.context,
          })),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Code search failed: ${error.message}`,
      };
    }
  }

  private async searchWithRipgrep(
    query: string,
    type: string,
    searchPath: string
  ): Promise<SearchResult[]> {
    const args: string[] = ['--json', '--context', '2', '--line-number', '--column'];

    // Build search pattern based on type
    let pattern = query;
    if (type === 'function') {
      // Match function declarations in multiple languages
      pattern = `(function|def|fn|func|const|let|var)\\s+${query}`;
    } else if (type === 'class') {
      // Match class declarations
      pattern = `(class|interface|struct|type)\\s+${query}`;
    } else if (type === 'variable') {
      // Match variable declarations
      pattern = `(const|let|var|val|def)\\s+${query}`;
    }

    args.push('--regexp', pattern);

    // Execute ripgrep
    try {
      const command = `rg ${args.join(' ')} "${searchPath}"`;
      const { stdout } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB
        cwd: this.workspaceDir,
      });

      return this.parseRipgrepOutput(stdout);
    } catch (error: any) {
      // ripgrep returns exit code 1 when no matches found
      if (error.code === 1) {
        return [];
      }
      throw error;
    }
  }

  private parseRipgrepOutput(output: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = output.split('\n').filter((line) => line.trim());

    let currentMatch: Partial<SearchResult> | null = null;
    const contextLines: string[] = [];

    for (const line of lines) {
      try {
        const data = JSON.parse(line);

        if (data.type === 'match') {
          // Save previous match if exists
          if (currentMatch) {
            results.push({
              ...currentMatch,
              context: [...contextLines],
            } as SearchResult);
            contextLines.length = 0;
          }

          // Start new match
          currentMatch = {
            file: data.data.path.text,
            line: data.data.line_number,
            column: data.data.submatches[0]?.start || 0,
            code: data.data.lines.text.trim(),
          };
        } else if (data.type === 'context' && currentMatch) {
          // Add context line
          contextLines.push(data.data.lines.text.trim());
        }
      } catch {
        // Skip invalid JSON lines
        continue;
      }
    }

    // Add last match
    if (currentMatch) {
      results.push({
        ...currentMatch,
        context: [...contextLines],
      } as SearchResult);
    }

    return results;
  }
}
