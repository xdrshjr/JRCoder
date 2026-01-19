/**
 * Executor - Task execution and tool calling
 */

import type { Plan, Task, TaskStatus, AgentState, ToolCall, Message } from '../types';
import type { ILLMClient, ILogger } from '../llm/types';
import type { ExecutionResult, TaskResult } from './types';
import type { ToolManager } from '../tools/manager';

/**
 * System prompt for the Executor
 */
const EXECUTOR_SYSTEM_PROMPT = `你是一个任务执行器。你的职责是：

1. 理解当前任务的目标
2. 选择合适的工具完成任务
3. 正确调用工具并处理结果
4. 如果遇到问题，尝试其他方法或报告错误

可用工具：
- code_query: 查询代码库中的函数、类、文件
- file_read: 读取文件内容
- file_write: 写入文件内容
- file_list: 列出目录中的文件
- snippet_save: 保存代码片段
- snippet_load: 加载代码片段
- snippet_list: 列出所有代码片段
- shell_exec: 执行Shell命令
- ask_user: 向用户提问

注意事项：
- 优先使用现有代码，避免重复造轮子
- 修改文件前先读取内容
- 执行危险操作前会提示用户确认
- 如果不确定，使用ask_user工具询问用户
- 每次只专注完成当前任务
- 工具调用要准确，参数要完整`;

/**
 * Executor class for task execution
 */
export class Executor {
  private llmClient: ILLMClient;
  private toolManager: ToolManager;
  private logger: ILogger;

  constructor(llmClient: ILLMClient, toolManager: ToolManager, logger: ILogger) {
    this.llmClient = llmClient;
    this.toolManager = toolManager;
    this.logger = logger;
  }

  /**
   * Execute all tasks in the plan
   */
  async execute(plan: Plan, context: AgentState): Promise<ExecutionResult> {
    const results: TaskResult[] = [];

    while (true) {
      const nextTask = this.getNextTask(plan);
      if (!nextTask) break;

      this.logger.info(`Executing task: ${nextTask.title}`);
      this.updateTaskStatus(plan, nextTask.id, 'in_progress');

      try {
        const result = await this.executeTask(nextTask, context);
        results.push(result);

        if (result.success) {
          this.updateTaskStatus(plan, nextTask.id, 'completed', result.output);
        } else {
          this.updateTaskStatus(plan, nextTask.id, 'failed', undefined, result.error);

          // If critical task fails, stop execution
          if (nextTask.priority <= 2) {
            this.logger.warn('Critical task failed, stopping execution');
            break;
          }
        }
      } catch (error) {
        this.logger.error(`Task execution failed: ${nextTask.title}`, error as Error);
        this.updateTaskStatus(plan, nextTask.id, 'failed', undefined, (error as Error).message);
        results.push({
          taskId: nextTask.id,
          success: false,
          error: (error as Error).message,
        });
        break;
      }
    }

    return {
      completedTasks: results.filter((r) => r.success).length,
      failedTasks: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: Task, context: AgentState): Promise<TaskResult> {
    // Build prompt
    const prompt = this.buildPrompt(task, context);

    // First LLM call (may return tool calls)
    const response = await this.llmClient.chat({
      messages: [
        { role: 'system', content: EXECUTOR_SYSTEM_PROMPT, timestamp: Date.now() },
        ...context.conversation.messages,
        { role: 'user', content: prompt, timestamp: Date.now() },
      ],
      tools: this.toolManager.getDefinitions(),
      temperature: 0.3,
    });

    // Update token statistics
    context.metadata.totalTokens += response.usage.totalTokens;

    // If there are tool calls
    if (response.toolCalls && response.toolCalls.length > 0) {
      // Execute tools
      const toolResults = await this.executeTools(response.toolCalls, context);

      // Build messages with tool results
      const messagesWithResults: Message[] = [
        ...context.conversation.messages,
        {
          role: 'assistant',
          content: response.content,
          timestamp: Date.now(),
          metadata: { toolCalls: response.toolCalls },
        },
        ...toolResults.map((r) => ({
          role: 'tool' as const,
          content: r.success ? JSON.stringify(r.data) : r.error || 'Tool execution failed',
          timestamp: Date.now(),
          metadata: {
            toolCallId: r.metadata?.toolCallId,
            toolName: r.metadata?.toolName,
          },
        })),
      ];

      // Send tool results back to LLM
      const finalResponse = await this.llmClient.chat({
        messages: [
          { role: 'system', content: EXECUTOR_SYSTEM_PROMPT, timestamp: Date.now() },
          ...messagesWithResults,
        ],
        temperature: 0.3,
      });

      context.metadata.totalTokens += finalResponse.usage.totalTokens;

      return {
        taskId: task.id,
        success: true,
        output: finalResponse.content,
      };
    }

    // No tool calls, return directly
    return {
      taskId: task.id,
      success: true,
      output: response.content,
    };
  }

  /**
   * Execute multiple tools
   */
  private async executeTools(toolCalls: ToolCall[], context: AgentState): Promise<any[]> {
    const results: any[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.toolManager.execute(toolCall);
      context.metadata.toolCallsCount++;

      results.push({
        ...result,
        metadata: {
          ...result.metadata,
          toolCallId: toolCall.id,
          toolName: toolCall.name,
        },
      });
    }

    return results;
  }

  /**
   * Get the next task to execute
   */
  private getNextTask(plan: Plan): Task | null {
    // Find first pending task with completed dependencies
    for (const task of plan.tasks) {
      if (task.status !== 'pending') continue;

      const depsCompleted = task.dependencies.every((depId) => {
        const depTask = plan.tasks.find((t) => t.id === depId);
        return depTask?.status === 'completed';
      });

      if (depsCompleted) return task;
    }

    return null;
  }

  /**
   * Update task status
   */
  private updateTaskStatus(
    plan: Plan,
    taskId: string,
    status: TaskStatus,
    result?: string,
    error?: string
  ): void {
    const task = plan.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = status;
      task.updatedAt = Date.now();
      if (result) task.result = result;
      if (error) task.error = error;
    }
  }

  /**
   * Build prompt for executor
   */
  private buildPrompt(task: Task, context: AgentState): string {
    let prompt = `当前任务：${task.title}\n`;
    prompt += `任务描述：${task.description}\n\n`;

    if (context.plan) {
      const completed = context.plan.tasks.filter((t) => t.status === 'completed');
      if (completed.length > 0) {
        prompt += `已完成的任务：\n`;
        completed.forEach((t) => {
          prompt += `- ${t.title}\n`;
          if (t.result) {
            prompt += `  结果: ${t.result.substring(0, 200)}${t.result.length > 200 ? '...' : ''}\n`;
          }
        });
        prompt += `\n`;
      }
    }

    prompt += `请使用合适的工具完成这个任务。`;

    return prompt;
  }
}
