/**
 * Agent - Main loop controller
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import type { GlobalConfig, Plan, Task } from '../types';
import type { ILogger } from '../llm/types';
import { StateManager } from './state';
import { Planner } from './planner';
import { Executor } from './executor';
import { Reflector } from './reflector';
import { LLMManager } from '../llm/manager';
import { ToolManager } from '../tools/manager';
import { EventEmitter } from './event-emitter';
import type { ConfirmationResult } from './types';
import { generateId } from '../utils';

/**
 * Main Agent class that orchestrates the planning-execution-reflection loop
 */
export class Agent {
  private stateManager: StateManager;
  private planner: Planner;
  private executor: Executor;
  private reflector: Reflector;
  private config: GlobalConfig;
  private logger: ILogger;
  private toolManager: ToolManager;
  private llmManager: LLMManager;

  constructor(config: GlobalConfig, logger: ILogger) {
    this.config = config;
    this.logger = logger;

    // Initialize components
    this.llmManager = new LLMManager(config, logger);

    // Import snippet storage
    const { FileSnippetStorage } = require('../storage/snippet-storage');
    const snippetStorage = new FileSnippetStorage(config.storage.snippetDir);

    this.toolManager = new ToolManager(
      config.tools,
      logger,
      snippetStorage,
      config.cli.confirmDangerous
    );

    this.stateManager = new StateManager(config, logger);
    this.planner = new Planner(this.llmManager.getClient('planner'), logger);
    this.executor = new Executor(
      this.llmManager.getClient('executor'),
      this.toolManager,
      logger,
      this.stateManager
    );
    this.reflector = new Reflector(this.llmManager.getClient('reflector'), logger);
  }

  /**
   * Normalize plan to ensure all tasks have required fields
   */
  private normalizePlan(plan: Partial<Plan> | Plan, originalGoal: string): Plan {
    const now = Date.now();

    // Normalize tasks
    const tasks =
      plan.tasks?.map((task, index) => {
        const normalized: Task = {
          id: task.id || generateId(),
          title: task.title,
          description: task.description,
          status: task.status || 'pending',
          priority: task.priority || index + 1,
          dependencies: task.dependencies || [],
          createdAt: task.createdAt || now,
          updatedAt: task.updatedAt || now,
          result: task.result,
          error: task.error,
        };
        return normalized;
      }) || [];

    // Convert dependency titles to IDs if needed
    const titleToIdMap = new Map(tasks.map((t) => [t.title, t.id]));
    tasks.forEach((task) => {
      task.dependencies = task.dependencies
        .map((dep) => {
          // If it's not a valid UUID, treat it as a title
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dep)) {
            return titleToIdMap.get(dep);
          }
          return dep;
        })
        .filter((depId): depId is string => depId !== undefined);
    });

    return {
      id: plan.id || generateId(),
      goal: plan.goal || originalGoal,
      tasks,
      currentTaskId: plan.currentTaskId,
      createdAt: plan.createdAt || now,
      updatedAt: plan.updatedAt || now,
    };
  }

  /**
   * Classify task as simple or complex using LLM
   */
  private async classifyTask(userTask: string): Promise<boolean> {
    this.logger.info('Classifying task complexity');

    const prompt = `请判断以下任务是否是简单问答任务。

判断标准：
- 简单任务：问候语、简单问答、信息查询、概念解释、不需要工具调用、不需要文件操作
- 复杂任务：需要编程、需要修改代码、需要执行命令、需要多个步骤、需要工具调用

用户任务：${userTask}

请只回答"简单"或"复杂"，不要其他内容。`;

    const response = await this.llmManager.getClient('reflector').chat({
      messages: [
        { role: 'system', content: prompt, timestamp: Date.now() },
        { role: 'user', content: userTask, timestamp: Date.now() },
      ],
      temperature: 0.1,
      maxTokens: 10,
    });

    const isSimple = response.content.trim().includes('简单');
    this.logger.info(`Task classified as: ${isSimple ? 'simple' : 'complex'}`);

    return isSimple;
  }

  /**
   * Get direct answer for simple tasks
   */
  private async getSimpleAnswer(userTask: string): Promise<void> {
    this.stateManager.updatePhase('answering');

    this.logger.info('Getting direct answer for simple task');

    const response = await this.llmManager.getClient('executor').chat({
      messages: [
        {
          role: 'system',
          content: '你是一个友好的助手。请直接、简洁地回答用户的问题。不要提及任何工具或计划。',
          timestamp: Date.now(),
        },
        { role: 'user', content: userTask, timestamp: Date.now() },
      ],
      temperature: 0.7,
      maxTokens: 1000,
    });

    // Update token statistics
    this.stateManager.updateMetadata({
      totalTokens: response.usage.totalTokens,
    });

    // Emit simple_answer event
    this.stateManager.getEventEmitter().emit({
      type: 'simple_answer',
      timestamp: Date.now(),
      data: { answer: response.content },
    });

    // Log the answer
    this.logger.info('Simple task answer provided');

    // Mark as completed
    this.stateManager.markCompleted();
  }

  /**
   * Run the agent with a user task
   */
  async run(userTask: string): Promise<void> {
    this.logger.info('Agent started', { task: userTask });

    try {
      // Classify task before entering planning phase
      const isSimple = await this.classifyTask(userTask);

      if (isSimple) {
        // Simple task: get direct answer
        await this.getSimpleAnswer(userTask);
        return;
      }

      // Complex task: continue with normal flow
      // First iteration: Generate the complete plan
      this.stateManager.incrementIteration();

      // Phase 1: Planning
      this.stateManager.updatePhase('planning');
      const plannerResult = await this.planner.plan(userTask, this.stateManager.getState());

      if (plannerResult.type === 'direct_answer') {
        console.log(chalk.green('\n✅ 答案：\n'));
        console.log(plannerResult.answer);
        return;
      }

      this.stateManager.setPlan(plannerResult.plan);

      // Phase 2: User Confirmation
      if (this.config.agent.requireConfirmation) {
        this.stateManager.updatePhase('confirming');
        const confirmation = await this.userConfirmation(plannerResult.plan);

        if (confirmation.action === 'cancel') {
          this.logger.info('User cancelled execution');
          console.log(chalk.yellow('\n⚠️  执行已取消\n'));
          return;
        } else if (confirmation.action === 'replan') {
          // Normalize the modified plan to ensure all required fields are present
          const normalizedPlan = this.normalizePlan(confirmation.plan!, userTask);
          this.stateManager.setPlan(normalizedPlan);
        }
      }

      // Main execution loop
      while (this.stateManager.getState().currentIteration < this.config.agent.maxIterations) {
        // Phase 3: Executing
        this.stateManager.updatePhase('executing');
        const currentPlan = this.stateManager.getState().plan!;
        const executionResult = await this.executor.execute(
          currentPlan,
          this.stateManager.getState()
        );

        // Update plan with modified task statuses
        this.stateManager.setPlan(currentPlan);

        // Check if all tasks are completed
        const allCompleted = this.stateManager
          .getState()
          .plan!.tasks.every((t) => t.status === 'completed' || t.status === 'failed');

        if (allCompleted) {
          // Phase 4: Reflecting
          if (this.config.agent.enableReflection) {
            this.stateManager.updatePhase('reflecting');
            const reflectionResult = await this.reflector.reflect(
              this.stateManager.getState().plan!,
              executionResult,
              this.stateManager.getState()
            );

            if (reflectionResult.nextAction === 'finish') {
              console.log(chalk.green('\n✅ 任务完成！\n'));
              if (reflectionResult.summary) {
                console.log(reflectionResult.summary);
              }
              return;
            } else if (reflectionResult.nextAction === 'ask_user') {
              const userResponse = await this.askUser(reflectionResult.question!);
              userTask = `${userTask}\n\n用户反馈：${userResponse}`;
              this.stateManager.incrementIteration();
              continue;
            } else if (reflectionResult.nextAction === 'replan') {
              if (reflectionResult.issues && reflectionResult.issues.length > 0) {
                console.log(chalk.yellow('\n⚠️  发现问题，重新规划：\n'));
                reflectionResult.issues.forEach((issue) => {
                  console.log(chalk.yellow(`  - ${issue}`));
                });
              }
              if (
                reflectionResult.newPlan &&
                reflectionResult.newPlan.tasks &&
                Array.isArray(reflectionResult.newPlan.tasks)
              ) {
                // Normalize the plan to ensure all required fields are present
                const normalizedPlan = this.normalizePlan(
                  reflectionResult.newPlan,
                  this.stateManager.getState().plan!.goal
                );
                this.stateManager.setPlan(normalizedPlan);
              } else if (reflectionResult.newPlan) {
                this.logger.warn('Invalid new plan from reflector, missing tasks array');
                console.log(chalk.yellow('正在重新生成计划...\n'));
                this.stateManager.updatePhase('planning');
                const plannerResult = await this.planner.plan(
                  userTask,
                  this.stateManager.getState()
                );
                if (plannerResult.type !== 'plan') {
                  this.logger.error('Planner did not return a plan during replan');
                  throw new Error('重新规划失败');
                }
                this.stateManager.setPlan(plannerResult.plan);
              }
              this.stateManager.incrementIteration();
              continue;
            }
          } else {
            console.log(chalk.green('\n✅ 执行完成！\n'));
            return;
          }
        } else {
          // There are still pending tasks, continue execution
          this.stateManager.incrementIteration();
          continue;
        }
      }

      // Max iterations reached
      if (this.stateManager.getState().currentIteration >= this.config.agent.maxIterations) {
        console.log(chalk.yellow('\n⚠️  达到最大迭代次数\n'));
      }
    } catch (error) {
      this.logger.error('Agent execution failed', error as Error);
      console.log(chalk.red(`\n❌ 错误：${(error as Error).message}\n`));
      this.stateManager.markFailed();
    } finally {
      this.stateManager.markCompleted();
      await this.stateManager.save(`logs/session-${Date.now()}.json`);
      this.logger.info('Agent finished');
    }
  }

  /**
   * User confirmation for execution plan
   */
  private async userConfirmation(plan: Plan): Promise<ConfirmationResult> {
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
          { name: '❌ 取消', value: 'cancel' },
        ],
      },
    ]);

    return { action: answer.action };
  }

  /**
   * Ask user a question
   */
  private async askUser(question: string): Promise<string> {
    console.log(chalk.yellow(`\n❓ ${question}\n`));

    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'response',
        message: '请输入：',
      },
    ]);

    return answer.response;
  }

  /**
   * Get the state manager
   */
  getStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * Get the event emitter
   */
  getEventEmitter(): EventEmitter {
    return this.stateManager.getEventEmitter();
  }

  /**
   * Get the tool manager
   */
  getToolManager(): ToolManager {
    return this.toolManager;
  }
}
