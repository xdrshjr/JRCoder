/**
 * Reflector - Execution result evaluation and improvement suggestions
 */

import type { Plan, AgentState } from '../types';
import type { ILLMClient, ILogger } from '../llm/types';
import type { ExecutionResult, ReflectionResult, ReflectionResponse } from './types';

/**
 * System prompt for the Reflector
 */
const REFLECTOR_SYSTEM_PROMPT = `你是一个反思评估器。你的职责是：

1. 评估任务执行结果是否达成目标
2. 识别执行过程中的问题和不足
3. 提出具体的改进建议
4. 判断是否需要重新规划

评估标准：
- 目标达成度：是否完成了用户的原始需求
- 代码质量：是否符合最佳实践
- 错误处理：是否有未处理的错误
- 完整性：是否有遗漏的功能

输出格式（JSON）：
{
  "goalAchieved": true/false,
  "blocked": true/false,
  "summary": "执行总结",
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "question": "需要询问用户的问题（如果blocked）",
  "improvedPlan": { ... }
}

注意事项：
- 客观评估，不要过于乐观或悲观
- 问题要具体，建议要可行
- 如果遇到无法解决的问题，设置blocked为true并提出问题
- 如果目标已达成，设置goalAchieved为true
- 如果需要改进，在suggestions中提供具体建议`;

/**
 * Reflector class for execution evaluation
 */
export class Reflector {
  private llmClient: ILLMClient;
  private logger: ILogger;

  constructor(llmClient: ILLMClient, logger: ILogger) {
    this.llmClient = llmClient;
    this.logger = logger;
  }

  /**
   * Reflect on execution results
   */
  async reflect(
    plan: Plan,
    executionResult: ExecutionResult,
    context: AgentState
  ): Promise<ReflectionResult> {
    this.logger.info('Reflection started');

    // Build prompt
    const prompt = this.buildPrompt(plan, executionResult, context);

    // Call LLM
    const response = await this.llmClient.chat({
      messages: [
        { role: 'system', content: REFLECTOR_SYSTEM_PROMPT, timestamp: Date.now() },
        { role: 'user', content: prompt, timestamp: Date.now() },
      ],
      temperature: 0.5,
      maxTokens: 2048,
    });

    // Parse reflection result
    const reflection = this.parseResponse(response.content);

    // Determine next action
    if (reflection.goalAchieved) {
      this.logger.info('Goal achieved');
      return {
        status: 'completed',
        summary: reflection.summary,
        nextAction: 'finish',
      };
    }

    if (reflection.blocked) {
      this.logger.warn('Execution blocked, need user input');
      return {
        status: 'blocked',
        issues: reflection.issues,
        nextAction: 'ask_user',
        question: reflection.question || '执行遇到问题，请提供更多信息或指导',
      };
    }

    if (context.currentIteration >= context.maxIterations) {
      this.logger.warn('Max iterations reached');
      return {
        status: 'max_iterations_reached',
        summary: reflection.summary,
        nextAction: 'finish',
      };
    }

    this.logger.info('Need improvement, will replan');
    return {
      status: 'needs_improvement',
      issues: reflection.issues,
      suggestions: reflection.suggestions,
      nextAction: 'replan',
      newPlan: reflection.improvedPlan,
    };
  }

  /**
   * Build prompt for reflector
   */
  private buildPrompt(
    plan: Plan,
    executionResult: ExecutionResult,
    context: AgentState
  ): string {
    let prompt = `原始目标：${plan.goal}\n\n`;

    prompt += `执行结果：\n`;
    prompt += `- 完成任务数：${executionResult.completedTasks}\n`;
    prompt += `- 失败任务数：${executionResult.failedTasks}\n\n`;

    prompt += `任务详情：\n`;
    executionResult.results.forEach((r) => {
      const task = plan.tasks.find((t) => t.id === r.taskId);
      if (task) {
        prompt += `- ${task.title}\n`;
        prompt += `  状态: ${r.success ? '成功' : '失败'}\n`;
        if (r.success && r.output) {
          const output = r.output.substring(0, 300);
          prompt += `  输出: ${output}${r.output.length > 300 ? '...' : ''}\n`;
        } else if (!r.success && r.error) {
          prompt += `  错误: ${r.error}\n`;
        }
      }
    });

    prompt += `\n当前迭代：${context.currentIteration}/${context.maxIterations}\n\n`;
    prompt += `请评估执行结果，判断是否达成目标，并提出改进建议。`;

    return prompt;
  }

  /**
   * Parse reflection response
   */
  private parseResponse(content: string): ReflectionResponse {
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

      // If parsing fails, create a default response
      this.logger.warn('Failed to parse reflection response as JSON, using default');
      return {
        goalAchieved: false,
        blocked: false,
        summary: content,
        issues: ['无法解析反思结果'],
        suggestions: ['请检查执行结果并重新规划'],
      };
    }
  }
}
