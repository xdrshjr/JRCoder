/**
 * Tool system tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs-extra';
import { ToolManager } from '../tools/manager';
import { FileSnippetStorage } from '../storage/snippet-storage';
import type { GlobalConfig, ToolCall } from '../types';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  logToolCall: jest.fn(),
  logToolResult: jest.fn(),
};

describe('Tool System', () => {
  const testDir = path.join(__dirname, '../../.test-workspace');
  const snippetDir = path.join(testDir, 'snippets');

  let toolManager: ToolManager;
  let snippetStorage: FileSnippetStorage;

  const config: GlobalConfig['tools'] = {
    enabled: [
      'code_query',
      'file_read',
      'file_write',
      'file_list',
      'file_delete',
      'snippet_save',
      'snippet_load',
      'snippet_list',
      'shell_exec',
      'ask_user',
    ],
    workspaceDir: testDir,
    maxFileSize: 10 * 1024 * 1024,
    allowedExtensions: ['.js', '.ts', '.txt', '.md'],
    shellTimeout: 30000,
    shellMaxBuffer: 10 * 1024 * 1024,
  };

  beforeEach(async () => {
    // Create test directories
    await fs.ensureDir(testDir);
    await fs.ensureDir(snippetDir);

    // Initialize storage and tool manager
    snippetStorage = new FileSnippetStorage(snippetDir);
    toolManager = new ToolManager(config, mockLogger as any, snippetStorage, false);
  });

  afterEach(async () => {
    // Clean up test directories
    await fs.remove(testDir);
  });

  describe('ToolManager', () => {
    it('should register all enabled tools', () => {
      const toolNames = toolManager.getToolNames();
      expect(toolNames).toContain('file_read');
      expect(toolNames).toContain('file_write');
      expect(toolNames).toContain('file_list');
      expect(toolNames).toContain('file_delete');
      expect(toolNames).toContain('snippet_save');
      expect(toolNames).toContain('snippet_load');
      expect(toolNames).toContain('snippet_list');
      expect(toolNames).toContain('shell_exec');
      expect(toolNames).toContain('ask_user');
    });

    it('should get tool definitions for LLM', () => {
      const definitions = toolManager.getDefinitions();
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions[0]).toHaveProperty('name');
      expect(definitions[0]).toHaveProperty('description');
      expect(definitions[0]).toHaveProperty('parameters');
    });

    it('should check if tool exists', () => {
      expect(toolManager.hasTool('file_read')).toBe(true);
      expect(toolManager.hasTool('nonexistent_tool')).toBe(false);
    });
  });

  describe('FileReadTool', () => {
    it('should read file successfully', async () => {
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'Hello, World!', 'utf8');

      const toolCall: ToolCall = {
        id: 'test-1',
        name: 'file_read',
        arguments: { path: 'test.txt' },
      };

      const result = await toolManager.execute(toolCall);
      expect(result.success).toBe(true);
      expect(result.data?.content).toBe('Hello, World!');
    });

    it('should fail for non-existent file', async () => {
      const toolCall: ToolCall = {
        id: 'test-2',
        name: 'file_read',
        arguments: { path: 'nonexistent.txt' },
      };

      const result = await toolManager.execute(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('FileWriteTool', () => {
    it('should write file successfully', async () => {
      const toolCall: ToolCall = {
        id: 'test-3',
        name: 'file_write',
        arguments: {
          path: 'output.txt',
          content: 'Test content',
        },
      };

      const result = await toolManager.execute(toolCall);
      expect(result.success).toBe(true);

      const content = await fs.readFile(path.join(testDir, 'output.txt'), 'utf8');
      expect(content).toBe('Test content');
    });

    it('should append to file', async () => {
      const testFile = path.join(testDir, 'append.txt');
      await fs.writeFile(testFile, 'Line 1\n', 'utf8');

      const toolCall: ToolCall = {
        id: 'test-4',
        name: 'file_write',
        arguments: {
          path: 'append.txt',
          content: 'Line 2\n',
          mode: 'append',
        },
      };

      const result = await toolManager.execute(toolCall);
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('Line 1\nLine 2\n');
    });
  });

  describe('FileListTool', () => {
    it('should list files in directory', async () => {
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');

      const toolCall: ToolCall = {
        id: 'test-5',
        name: 'file_list',
        arguments: { path: '.' },
      };

      const result = await toolManager.execute(toolCall);
      expect(result.success).toBe(true);
      expect(result.data?.files).toBeDefined();
      expect(result.data?.files.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('FileDeleteTool', () => {
    it('should delete file successfully', async () => {
      const testFile = path.join(testDir, 'to-delete.txt');
      await fs.writeFile(testFile, 'This file will be deleted');

      const toolCall: ToolCall = {
        id: 'test-delete-1',
        name: 'file_delete',
        arguments: { path: 'to-delete.txt' },
      };

      const result = await toolManager.execute(toolCall);
      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('file');

      const exists = await fs.pathExists(testFile);
      expect(exists).toBe(false);
    });

    it('should delete empty directory', async () => {
      const testDir2 = path.join(testDir, 'empty-dir');
      await fs.ensureDir(testDir2);

      const toolCall: ToolCall = {
        id: 'test-delete-2',
        name: 'file_delete',
        arguments: { path: 'empty-dir' },
      };

      const result = await toolManager.execute(toolCall);
      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('directory');

      const exists = await fs.pathExists(testDir2);
      expect(exists).toBe(false);
    });

    it('should delete directory recursively', async () => {
      const testDir2 = path.join(testDir, 'nested-dir');
      await fs.ensureDir(path.join(testDir2, 'subdir'));
      await fs.writeFile(path.join(testDir2, 'file.txt'), 'content');
      await fs.writeFile(path.join(testDir2, 'subdir', 'file2.txt'), 'content2');

      const toolCall: ToolCall = {
        id: 'test-delete-3',
        name: 'file_delete',
        arguments: { path: 'nested-dir', recursive: true },
      };

      const result = await toolManager.execute(toolCall);
      expect(result.success).toBe(true);
      expect(result.data?.recursive).toBe(true);

      const exists = await fs.pathExists(testDir2);
      expect(exists).toBe(false);
    });

    it('should succeed when deleting non-existent file', async () => {
      const toolCall: ToolCall = {
        id: 'test-delete-4',
        name: 'file_delete',
        arguments: { path: 'non-existent.txt' },
      };

      const result = await toolManager.execute(toolCall);
      expect(result.success).toBe(true);
      expect(result.data?.message).toContain('does not exist');
    });

    it('should handle absolute paths', async () => {
      const testFile = path.join(testDir, 'absolute-delete.txt');
      await fs.writeFile(testFile, 'content');

      const toolCall: ToolCall = {
        id: 'test-delete-5',
        name: 'file_delete',
        arguments: { path: testFile },
      };

      const result = await toolManager.execute(toolCall);
      expect(result.success).toBe(true);

      const exists = await fs.pathExists(testFile);
      expect(exists).toBe(false);
    });
  });

  describe('SnippetTools', () => {
    it('should save and load snippet', async () => {
      const saveCall: ToolCall = {
        id: 'test-6',
        name: 'snippet_save',
        arguments: {
          name: 'test-snippet',
          code: 'function hello() { return "world"; }',
          description: 'Test snippet',
          language: 'javascript',
          tags: ['test', 'function'],
        },
      };

      const saveResult = await toolManager.execute(saveCall);
      expect(saveResult.success).toBe(true);

      const loadCall: ToolCall = {
        id: 'test-7',
        name: 'snippet_load',
        arguments: { name: 'test-snippet' },
      };

      const loadResult = await toolManager.execute(loadCall);
      expect(loadResult.success).toBe(true);
      expect(loadResult.data?.name).toBe('test-snippet');
      expect(loadResult.data?.code).toContain('hello');
    });

    it('should list snippets', async () => {
      const saveCall: ToolCall = {
        id: 'test-8',
        name: 'snippet_save',
        arguments: {
          name: 'snippet1',
          code: 'const x = 1;',
          language: 'javascript',
        },
      };

      await toolManager.execute(saveCall);

      const listCall: ToolCall = {
        id: 'test-9',
        name: 'snippet_list',
        arguments: {},
      };

      const result = await toolManager.execute(listCall);
      expect(result.success).toBe(true);
      expect(result.data?.snippets).toBeDefined();
      expect(result.data?.snippets.length).toBeGreaterThan(0);
    });
  });

  describe('ShellExecTool', () => {
    it('should execute simple command', async () => {
      const toolCall: ToolCall = {
        id: 'test-10',
        name: 'shell_exec',
        arguments: {
          command: process.platform === 'win32' ? 'echo hello' : 'echo "hello"',
        },
      };

      const result = await toolManager.execute(toolCall);
      expect(result.success).toBe(true);
      expect(result.data?.stdout).toContain('hello');
    });

    it('should block dangerous commands', async () => {
      const toolCall: ToolCall = {
        id: 'test-11',
        name: 'shell_exec',
        arguments: {
          command: 'rm -rf /',
        },
      };

      const result = await toolManager.execute(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous command');
    });
  });

  describe('Tool Validation', () => {
    it('should validate required parameters', async () => {
      const toolCall: ToolCall = {
        id: 'test-12',
        name: 'file_read',
        arguments: {}, // Missing required 'path' parameter
      };

      const result = await toolManager.execute(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('required parameter');
    });

    it('should validate parameter types', async () => {
      const toolCall: ToolCall = {
        id: 'test-13',
        name: 'file_read',
        arguments: {
          path: 123, // Should be string
        },
      };

      const result = await toolManager.execute(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('type');
    });
  });
});
