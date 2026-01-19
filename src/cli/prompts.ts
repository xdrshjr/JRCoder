/**
 * Interactive prompts for CLI
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { Plan } from '../types';

export interface ConfirmationResult {
  action: 'confirm' | 'modify' | 'cancel' | 'replan';
  plan?: Plan;
}

/**
 * Prompt manager for user interactions
 */
export class PromptManager {
  /**
   * Confirm execution plan
   */
  async confirmPlan(plan: Plan): Promise<ConfirmationResult> {
    console.log(chalk.bold('\n📋 执行计划：\n'));
    console.log(chalk.cyan(`目标: ${plan.goal}\n`));

    plan.tasks.forEach((task, index) => {
      console.log(chalk.white(`${index + 1}. ${task.title}`));
      console.log(chalk.gray(`   ${task.description}`));
      if (task.dependencies.length > 0) {
        console.log(chalk.yellow(`   依赖: ${task.dependencies.join(', ')}`));
      }
    });

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '请选择操作：',
        choices: [
          { name: '✅ 确认执行', value: 'confirm' },
          { name: '✏️  修改计划', value: 'modify' },
          { name: '❌ 取消', value: 'cancel' },
        ],
      },
    ]);

    if (answer.action === 'modify') {
      const modifications = await inquirer.prompt([
        {
          type: 'editor',
          name: 'newPlan',
          message: '请修改计划（JSON格式）：',
          default: JSON.stringify(plan, null, 2),
        },
      ]);

      try {
        const modifiedPlan = JSON.parse(modifications.newPlan);
        return { action: 'replan', plan: modifiedPlan };
      } catch (error) {
        console.log(chalk.red('❌ 计划格式错误，请重试'));
        return this.confirmPlan(plan);
      }
    }

    return { action: answer.action };
  }

  /**
   * Confirm dangerous operation
   */
  async confirmDangerousOperation(
    toolName: string,
    args: any
  ): Promise<boolean> {
    console.log(chalk.yellow(`\n⚠️  危险操作: ${toolName}\n`));
    console.log(chalk.gray('参数：'));
    console.log(chalk.gray(JSON.stringify(args, null, 2)));

    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: '是否继续？',
        default: false,
      },
    ]);

    return answer.confirmed;
  }

  /**
   * Ask user a question
   */
  async askUser(question: string, options?: string[]): Promise<string> {
    if (options && options.length > 0) {
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'response',
          message: question,
          choices: options,
        },
      ]);
      return answer.response;
    } else {
      const answer = await inquirer.prompt([
        {
          type: 'input',
          name: 'response',
          message: question,
        },
      ]);
      return answer.response;
    }
  }

  /**
   * Select multiple items
   */
  async selectMultiple(message: string, choices: string[]): Promise<string[]> {
    const answer = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message,
        choices,
      },
    ]);
    return answer.selected;
  }

  /**
   * Confirm exit
   */
  async confirmExit(): Promise<boolean> {
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'exit',
        message: '确定要退出吗？未保存的进度将丢失。',
        default: false,
      },
    ]);
    return answer.exit;
  }

  /**
   * Ask for text input
   */
  async askText(message: string, defaultValue?: string): Promise<string> {
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'text',
        message,
        default: defaultValue,
      },
    ]);
    return answer.text;
  }

  /**
   * Ask for password input
   */
  async askPassword(message: string): Promise<string> {
    const answer = await inquirer.prompt([
      {
        type: 'password',
        name: 'password',
        message,
        mask: '*',
      },
    ]);
    return answer.password;
  }

  /**
   * Confirm action
   */
  async confirm(message: string, defaultValue: boolean = false): Promise<boolean> {
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: defaultValue,
      },
    ]);
    return answer.confirmed;
  }
}
