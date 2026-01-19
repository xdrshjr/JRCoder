/**
 * Planner - Task analysis and plan generation
 */

import type { AgentState, Plan } from '../types';
import type { ILLMClient, ILogger } from '../llm/types';
import type { PlannerResult, PlannerResponse } from './types';
import { generateId } from '../utils';

/**
 * System prompt for the Planner
 */
const PLANNER_SYSTEM_PROMPT = `你是一个智能任务规划器。你的职责是：

1. 分析用户任务的复杂度
2. 对于简单任务（如查询、解释、简单问答），直接提供答案
3. 对于复杂任务（如编程、多步骤操作），生成详细的执行计划

判断标准：
- 简单任务：单步操作、信息查询、概念解释、简单问答
- 复杂任务：需要多个步骤、涉及代码修改、需要工具调用、需要文件操作

输出格式（JSON）：
{
  "type": "simple" | "complex",
  "answer": "直接答案（仅简单任务）",
  "tasks": [
    {
      "title": "任务标题",
      "description": "详细描述",
      "dependencies": []
    }
  ]
}

注意事项：
- 任务标题要简洁明确
- 任务描述要详细，包含具体的操作步骤
- 合理设置任务依赖关系
- 将复杂任务分解为可执行的小任务
- 每个任务应该是独立可完成的单元`;

/**
 * Planner class for task analysis and planning
 */
export class Planner {
  private llmClient: ILLMClient;
  private logger: ILogger;

  constructor(llmClient: ILLMClient, logger: ILogger) {
    this.llmClient = llmClient;
    this.logger = logger;
  }

  /**
   * Analyze task and generate plan
   */
  async plan(userTask: string, context: AgentState): Promise<PlannerResult> {
    this.logger.info('Planning started', { task: userTask });

    // Build prompt
    const prompt = this.buildPrompt(userTask, context);

    // Call LLM
    const response = await this.llmClient.chat({
      messages: [
        { role: 'system', content: PLANNER_SYSTEM_PROMPT, timestamp: Date.now() },
        { role: 'user', content: prompt, timestamp: Date.now() },
      ],
      temperature: 0.7,
      maxTokens: 4096,
    });

    // Parse response
    const result = this.parseResponse(response.content);

    // Determine task type
    if (result.type === 'simple') {
      this.logger.info('Simple task detected, returning direct answer');
      return {
        type: 'direct_answer',
        answer: result.answer || response.content,
      };
    }

    // Generate execution plan
    const tasks = (result.tasks || []).map((task, index) => ({
      id: generateId(),
      title: task.title,
      description: task.description,
      status: 'pending' as const,
      priority: index + 1,
      dependencies: task.dependencies || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    // Convert dependency titles to IDs
    const titleToIdMap = new Map(tasks.map((t) => [t.title, t.id]));
    tasks.forEach((task) => {
      task.dependencies = task.dependencies
        .map((depTitle) => titleToIdMap.get(depTitle))
        .filter((depId): depId is string => depId !== undefined);
    });

    const plan: Plan = {
      id: generateId(),
      goal: userTask,
      tasks,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.logger.info('Plan generated', { taskCount: plan.tasks.length });

    return { type: 'plan', plan };
  }

  /**
   * Build prompt for planner
   */
  private buildPrompt(userTask: string, context: AgentState): string {
    let prompt = `用户任务：${userTask}\n\n`;

    if (context.plan) {
      const completed = context.plan.tasks.filter((t) => t.status === 'completed');
      prompt += `当前上下文：\n`;
      prompt += `- 已完成任务：${completed.length}/${context.plan.tasks.length}\n`;
      prompt += `- 当前迭代：${context.currentIteration}/${context.maxIterations}\n\n`;

      if (completed.length > 0) {
        prompt += `已完成的任务：\n`;
        completed.forEach((t) => {
          prompt += `- ${t.title}\n`;
        });
        prompt += `\n`;
      }
    }

    prompt += `请分析这个任务并生成执行计划。如果是简单任务，直接提供答案；如果是复杂任务，生成详细的任务列表。`;

    return prompt;
  }

  /**
   * Parse planner response
   */
  private parseResponse(content: string): PlannerResponse {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(content);
      return parsed;
    } catch {
      // Try to extract JSON from markdown code block
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch {
          // Fall through to default
        }
      }

      // If parsing fails, treat as simple task with direct answer
      this.logger.warn('Failed to parse planner response as JSON, treating as simple task');
      return {
        type: 'simple',
        answer: content,
      };
    }
  }
}
