/**
 * Code snippet management tools
 */

import { BaseTool } from './base';
import type { ToolParameter, ToolResult, CodeSnippet } from '../types';
import type { ISnippetStorage } from '../storage/interfaces';
import { randomBytes } from 'crypto';

/**
 * Generate unique ID
 */
function generateId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Snippet save tool
 */
export class SnippetSaveTool extends BaseTool {
  readonly name = 'snippet_save';
  readonly description = '保存代码片段以便后续复用';
  readonly parameters: ToolParameter[] = [
    {
      name: 'name',
      type: 'string',
      description: '片段名称（唯一标识）',
      required: true,
    },
    {
      name: 'code',
      type: 'string',
      description: '代码内容',
      required: true,
    },
    {
      name: 'description',
      type: 'string',
      description: '片段描述',
      required: false,
    },
    {
      name: 'language',
      type: 'string',
      description: '编程语言',
      required: false,
    },
    {
      name: 'tags',
      type: 'array',
      description: '标签列表',
      required: false,
    },
  ];

  constructor(private storage: ISnippetStorage) {
    super();
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { name, code, description, language, tags = [] } = args;

    try {
      const snippet: CodeSnippet = {
        id: generateId(),
        name,
        code,
        description: description || '',
        language: language || this.detectLanguage(code),
        tags: Array.isArray(tags) ? tags : [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await this.storage.save(snippet);

      return {
        success: true,
        data: {
          id: snippet.id,
          name: snippet.name,
          language: snippet.language,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to save snippet: ${error.message}`,
      };
    }
  }

  private detectLanguage(code: string): string {
    // Simple language detection based on code patterns
    if (code.includes('function') || code.includes('const') || code.includes('let')) {
      if (code.includes('interface') || code.includes('type ') || code.includes(': ')) {
        return 'typescript';
      }
      return 'javascript';
    }
    if (code.includes('def ') || code.includes('import ') || code.includes('class ')) {
      return 'python';
    }
    if (code.includes('package ') || code.includes('func ')) {
      return 'go';
    }
    if (code.includes('fn ') || code.includes('impl ') || code.includes('trait ')) {
      return 'rust';
    }
    if (code.includes('public class') || code.includes('private ') || code.includes('void ')) {
      return 'java';
    }
    return 'plaintext';
  }
}

/**
 * Snippet load tool
 */
export class SnippetLoadTool extends BaseTool {
  readonly name = 'snippet_load';
  readonly description = '加载已保存的代码片段';
  readonly parameters: ToolParameter[] = [
    {
      name: 'name',
      type: 'string',
      description: '片段名称或ID',
      required: true,
    },
  ];

  constructor(private storage: ISnippetStorage) {
    super();
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { name } = args;

    try {
      const snippet = await this.storage.load(name);

      if (!snippet) {
        return {
          success: false,
          error: `Snippet '${name}' not found`,
        };
      }

      return {
        success: true,
        data: {
          id: snippet.id,
          name: snippet.name,
          code: snippet.code,
          description: snippet.description,
          language: snippet.language,
          tags: snippet.tags,
          createdAt: snippet.createdAt,
          updatedAt: snippet.updatedAt,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to load snippet: ${error.message}`,
      };
    }
  }
}

/**
 * Snippet list tool
 */
export class SnippetListTool extends BaseTool {
  readonly name = 'snippet_list';
  readonly description = '列出所有已保存的代码片段';
  readonly parameters: ToolParameter[] = [
    {
      name: 'tags',
      type: 'array',
      description: '按标签过滤',
      required: false,
    },
    {
      name: 'language',
      type: 'string',
      description: '按语言过滤',
      required: false,
    },
  ];

  constructor(private storage: ISnippetStorage) {
    super();
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { tags, language } = args;

    try {
      const filter: { tags?: string[]; language?: string } = {};
      if (tags && Array.isArray(tags)) {
        filter.tags = tags;
      }
      if (language) {
        filter.language = language;
      }

      const snippets = await this.storage.list(filter);

      return {
        success: true,
        data: {
          count: snippets.length,
          snippets: snippets.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            language: s.language,
            tags: s.tags,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          })),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to list snippets: ${error.message}`,
      };
    }
  }
}
