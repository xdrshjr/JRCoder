/**
 * User interaction tool
 */

import inquirer from 'inquirer';
import { BaseTool } from './base';
import type { ToolParameter, ToolResult } from '../types';

/**
 * Ask user tool for interactive questions
 */
export class AskUserTool extends BaseTool {
  readonly name = 'ask_user';
  readonly description = '向用户提问以获取更多信息';
  readonly parameters: ToolParameter[] = [
    {
      name: 'question',
      type: 'string',
      description: '要问用户的问题',
      required: true,
    },
    {
      name: 'options',
      type: 'array',
      description: '可选的答案选项（如果提供则为多选题）',
      required: false,
    },
  ];

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { question, options } = args;

    try {
      let answer: string;

      if (options && Array.isArray(options) && options.length > 0) {
        // Multiple choice question
        const response = await inquirer.prompt([
          {
            type: 'list',
            name: 'answer',
            message: question,
            choices: options,
          },
        ]);
        answer = response.answer;
      } else {
        // Open-ended question
        const response = await inquirer.prompt([
          {
            type: 'input',
            name: 'answer',
            message: question,
          },
        ]);
        answer = response.answer;
      }

      return {
        success: true,
        data: {
          question,
          answer,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get user input: ${error.message}`,
      };
    }
  }
}
