/**
 * Example usage of the tool system
 */

import { ToolManager } from '../tools';
import { FileSnippetStorage } from '../storage';
import type { GlobalConfig, ToolCall, ToolDefinition } from '../types';

// Simple logger implementation
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data || '');
  },
  error: (message: string, error?: Error, data?: any) => {
    console.error(`[ERROR] ${message}`, error?.message || '', data || '');
  },
  debug: (message: string, data?: any) => {
    console.log(`[DEBUG] ${message}`, data || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data || '');
  },
  logToolCall: (toolName: string, args: any) => {
    console.log(`[TOOL CALL] ${toolName}`, JSON.stringify(args, null, 2));
  },
  logToolResult: (toolName: string, result: any) => {
    console.log(`[TOOL RESULT] ${toolName}`, result.success ? '✓' : '✗');
  },
  logLLMRequest: (request: any) => {
    console.log(`[LLM REQUEST]`, request);
  },
  logLLMResponse: (response: any) => {
    console.log(`[LLM RESPONSE]`, response);
  },
};

async function main() {
  // Configuration
  const config: GlobalConfig['tools'] = {
    enabled: [
      'file_read',
      'file_write',
      'file_list',
      'snippet_save',
      'snippet_load',
      'snippet_list',
      'shell_exec',
    ],
    workspaceDir: '.workspace',
    maxFileSize: 10 * 1024 * 1024,
    allowedExtensions: ['.js', '.ts', '.txt', '.md', '.json'],
    shellTimeout: 30000,
    shellMaxBuffer: 10 * 1024 * 1024,
  };

  // Initialize storage and tool manager
  const snippetStorage = new FileSnippetStorage('.workspace/snippets');
  const toolManager = new ToolManager(config, logger, snippetStorage, false);

  console.log('=== Tool System Example ===\n');

  // Example 1: Write a file
  console.log('1. Writing a file...');
  const writeCall: ToolCall = {
    id: 'call-1',
    name: 'file_write',
    arguments: {
      path: 'example.txt',
      content: 'Hello from OpenJRAgent tool system!',
    },
  };
  const writeResult = await toolManager.execute(writeCall);
  console.log('Result:', writeResult.success ? '✓ Success' : '✗ Failed');
  console.log();

  // Example 2: Read the file
  console.log('2. Reading the file...');
  const readCall: ToolCall = {
    id: 'call-2',
    name: 'file_read',
    arguments: {
      path: 'example.txt',
    },
  };
  const readResult = await toolManager.execute(readCall);
  console.log('Result:', readResult.success ? '✓ Success' : '✗ Failed');
  if (readResult.success) {
    console.log('Content:', readResult.data?.content);
  }
  console.log();

  // Example 3: Save a code snippet
  console.log('3. Saving a code snippet...');
  const snippetCall: ToolCall = {
    id: 'call-3',
    name: 'snippet_save',
    arguments: {
      name: 'hello-world',
      code: 'function hello() {\n  return "Hello, World!";\n}',
      description: 'A simple hello world function',
      language: 'javascript',
      tags: ['example', 'function'],
    },
  };
  const snippetResult = await toolManager.execute(snippetCall);
  console.log('Result:', snippetResult.success ? '✓ Success' : '✗ Failed');
  console.log();

  // Example 4: List files
  console.log('4. Listing files in workspace...');
  const listCall: ToolCall = {
    id: 'call-4',
    name: 'file_list',
    arguments: {
      path: '.',
    },
  };
  const listResult = await toolManager.execute(listCall);
  console.log('Result:', listResult.success ? '✓ Success' : '✗ Failed');
  if (listResult.success) {
    console.log(`Found ${listResult.data?.count} files`);
  }
  console.log();

  // Example 5: Execute a shell command
  console.log('5. Executing shell command...');
  const shellCall: ToolCall = {
    id: 'call-5',
    name: 'shell_exec',
    arguments: {
      command: process.platform === 'win32' ? 'dir' : 'ls -la',
    },
  };
  const shellResult = await toolManager.execute(shellCall);
  console.log('Result:', shellResult.success ? '✓ Success' : '✗ Failed');
  console.log();

  // Show available tools
  console.log('=== Available Tools ===');
  const definitions = toolManager.getDefinitions();
  definitions.forEach((def: ToolDefinition) => {
    console.log(`- ${def.name}: ${def.description}`);
  });
}

// Run example if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export { main };
