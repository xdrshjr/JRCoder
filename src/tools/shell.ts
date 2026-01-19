/**
 * Shell execution tool
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from './base';
import type { ToolParameter, ToolResult } from '../types';
import { CommandValidator } from './validators';

const execAsync = promisify(exec);

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Shell execution tool
 */
export class ShellExecTool extends BaseTool {
  readonly name = 'shell_exec';
  readonly description = '执行Shell命令';
  readonly dangerous = true;
  readonly parameters: ToolParameter[] = [
    {
      name: 'command',
      type: 'string',
      description: '要执行的命令',
      required: true,
    },
    {
      name: 'cwd',
      type: 'string',
      description: '工作目录',
      required: false,
    },
    {
      name: 'timeout',
      type: 'number',
      description: '超时时间（毫秒）',
      required: false,
      default: 30000,
    },
  ];

  constructor(
    private workspaceDir: string,
    private defaultTimeout: number,
    private maxBuffer: number
  ) {
    super();
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { command, cwd, timeout = this.defaultTimeout } = args;

    try {
      // Validate command for dangerous patterns
      CommandValidator.validate(command);

      // Execute command
      const result = await this.execCommand(command, cwd, timeout);

      return {
        success: true,
        data: {
          command,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Command execution failed: ${error.message}`,
      };
    }
  }

  private async execCommand(
    command: string,
    cwd?: string,
    timeout?: number
  ): Promise<ExecResult> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd || this.workspaceDir,
        timeout: timeout || this.defaultTimeout,
        maxBuffer: this.maxBuffer,
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
      });

      return {
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0,
      };
    } catch (error: any) {
      // Command failed but we still want to return stdout/stderr
      return {
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        exitCode: error.code || 1,
      };
    }
  }
}
