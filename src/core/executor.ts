/**
 * Executor - Task execution and tool calling
 */

import type { Plan, Task, TaskStatus, AgentState, ToolCall, Message } from '../types';
import type { ILLMClient, ILogger } from '../llm/types';
import type { ExecutionResult, TaskResult } from './types';
import type { ToolManager } from '../tools/manager';
import type { StateManager } from './state';

/**
 * System prompt for the Executor
 */
const EXECUTOR_SYSTEM_PROMPT = `你是一个任务执行器。你的职责是：

1. 理解当前任务的目标
2. 选择合适的工具完成任务
3. 正确调用工具并处理结果
4. 如果遇到问题，尝试其他方法或报告错误

可用工具：
- code_query: 查询代码库中的函数、类、文件（仅在需要查找现有代码时使用）
- file_read: 读取文件内容（在修改文件前必须先读取）
- file_write: 写入文件内容（创建或修改代码文件时必须使用）
- file_list: 列出目录中的文件（检查文件结构时使用）
- snippet_save: 保存代码片段
- snippet_load: 加载代码片段
- snippet_list: 列出所有代码片段
- shell_exec: 执行Shell命令
- ask_user: 向用户提问

 关键规则（必须遵守）：
- **实现功能时必须使用file_write工具写入代码**
- **不要使用file_list来"实现"或"添加"功能 - file_list只是用来查看文件列表**
- **创建新文件时直接用file_write，不需要先用file_read或file_list**
- **修改现有文件时先用file_read读取，然后用file_write写入**
- **不要用code_query尝试查找不存在的代码，直接用file_write创建即可**
- **file_list只能用于：检查文件是否存在、查看目录结构、确认文件是否创建成功**
- **不要在"实现"、"开发"、"添加"、"创建"等任务中只使用file_list或code_query**

工具使用场景：
- 创建新功能/文件 → 直接用file_write
- 修改现有代码 → file_read读取 + file_write写入
- 检查文件是否存在 → file_list
- 查找已有代码 → code_query
- 安装依赖/运行命令 → shell_exec

任务执行要求：
- 每次只专注完成当前任务
- 工具调用要准确，参数要完整
- 完成任务时描述具体操作和创建/修改的文件
- 不要只描述计划，要实际执行并报告结果
- 任务要求创建代码时必须使用file_write工具写入实际代码`;

/**
 * Executor class for task execution
 */
export class Executor {
  private llmClient: ILLMClient;
  private toolManager: ToolManager;
  private logger: ILogger;
  private stateManager: StateManager;

  constructor(
    llmClient: ILLMClient,
    toolManager: ToolManager,
    logger: ILogger,
    stateManager: StateManager
  ) {
    this.llmClient = llmClient;
    this.toolManager = toolManager;
    this.logger = logger;
    this.stateManager = stateManager;
  }

  /**
   * Execute all tasks in the plan
   */
  async execute(plan: Plan, context: AgentState): Promise<ExecutionResult> {
    const results: TaskResult[] = [];

    this.logger.info(`Starting execution of ${plan.tasks.length} tasks`);

    while (true) {
      const nextTask = this.getNextTask(plan);
      if (!nextTask) break;

      this.logger.info(`Executing task: ${nextTask.title} (priority: ${nextTask.priority})`);
      this.updateTaskStatus(plan, nextTask.id, 'in_progress');

      try {
        const result = await this.executeTask(nextTask, context);
        results.push(result);

        if (result.success) {
          this.updateTaskStatus(plan, nextTask.id, 'completed', result.output);
          this.logger.info(`Task completed: ${nextTask.title}`);
        } else {
          this.updateTaskStatus(plan, nextTask.id, 'failed', undefined, result.error);

          // If critical task fails, stop execution
          if (nextTask.priority <= 2) {
            this.logger.warn('Critical task failed, stopping execution');
            break;
          }
          // Continue to next task for non-critical failures
          this.logger.info(`Non-critical task failed, continuing: ${nextTask.title}`);
          continue;
        }
      } catch (error) {
        this.logger.error(`Task execution failed: ${nextTask.title}`, error as Error);
        this.updateTaskStatus(plan, nextTask.id, 'failed', undefined, (error as Error).message);
        results.push({
          taskId: nextTask.id,
          success: false,
          error: (error as Error).message,
        });

        // If critical task fails, stop execution
        if (nextTask.priority <= 2) {
          this.logger.warn('Critical task error, stopping execution');
          break;
        }
        // Continue to next task for non-critical errors
        this.logger.info(`Non-critical task error, continuing: ${nextTask.title}`);
      }
    }

    this.logger.info(
      `Execution finished: ${results.length} tasks executed, ${results.filter((r) => r.success).length} successful`
    );

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

      // Build assistant message with tool_calls
      const assistantMessage: any = {
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        tool_calls: response.toolCalls,
      };

      // Build tool result messages
      const toolMessages = toolResults.map((r) => ({
        role: 'tool' as const,
        content: r.success ? JSON.stringify(r.data) : r.error || 'Tool execution failed',
        timestamp: Date.now(),
        tool_call_id: r.metadata?.toolCallId,
        metadata: {
          toolName: r.metadata?.toolName,
        },
      }));

      // Build messages with tool results
      const messagesWithResults: Message[] = [
        ...context.conversation.messages,
        assistantMessage,
        ...toolMessages,
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

      // Update conversation history with tool calls and results via StateManager
      this.logger.info(`Adding ${response.toolCalls.length} tool calls to conversation history`);
      this.stateManager.addMessage(assistantMessage);
      toolMessages.forEach((msg) => this.stateManager.addMessage(msg));
      this.logger.info(`Conversation now has messages in StateManager`);

      // Check if any critical tool failed (file_write, shell_exec)
      const failedCriticalTools = toolResults.filter(
        (r) => !r.success && ['file_write', 'shell_exec'].includes(r.metadata?.toolName)
      );

      if (failedCriticalTools.length > 0) {
        return {
          taskId: task.id,
          success: false,
          error: `Critical tool(s) failed: ${failedCriticalTools.map((t) => t.metadata?.toolName).join(', ')}`,
        };
      }

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

      const depsCompleted = task.dependencies.every((depIdOrTitle) => {
        // Try to find by ID first, then by title (for backward compatibility)
        let depTask = plan.tasks.find((t) => t.id === depIdOrTitle);
        if (!depTask) {
          depTask = plan.tasks.find((t) => t.title === depIdOrTitle);
        }
        return depTask?.status === 'completed';
      });

      if (depsCompleted) {
        this.logger.info(
          `Found next task: ${task.title} (status: ${task.status}, deps: ${task.dependencies.length})`
        );
        return task;
      }
    }

    this.logger.info('No more pending tasks with completed dependencies');
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
   * Extract target directory from user's goal
   * Looks for Windows absolute paths in the goal string
   */
  private extractTargetDirectory(goal: string): string | null {
    // Look for Windows absolute path pattern (e.g., M:\tmp\TMP-PROJECT\TEST-01)
    // This regex matches: drive letter + colon + backslash/forward slash + path components
    const pathPattern = /([A-Za-z]:[\\/](?:[\w\-. ]+[\\/])*[\w\-. ]+)/g;

    const matches = goal.match(pathPattern);
    if (matches && matches.length > 0) {
      // Take the first (or longest) path found
      let targetPath = matches[0];

      // If multiple paths found, prefer the longest one (likely the most specific)
      if (matches.length > 1) {
        targetPath = matches.reduce((longest, current) =>
          current.length > longest.length ? current : longest
        );
      }

      // Clean up the path
      targetPath = targetPath.trim();
      // Normalize path separators to backslash for Windows
      targetPath = targetPath.replace(/\//g, '\\');
      // Remove trailing backslash if present
      targetPath = targetPath.replace(/\\+$/, '');

      this.logger.info(`Extracted target directory from goal: ${targetPath}`);
      return targetPath;
    }

    this.logger.info('No target directory found in goal');
    return null;
  }

  /**
   * Build prompt for executor
   */
  private buildPrompt(task: Task, context: AgentState): string {
    let prompt = `当前任务：${task.title}\n`;
    prompt += `任务描述：${task.description}\n\n`;

    // Detect if user specified a target directory in the original goal
    const targetDir = context.plan ? this.extractTargetDirectory(context.plan.goal) : null;

    // Add workspace information
    prompt += `当前工作目录信息：\n`;
    prompt += `- 默认工作目录：${this.toolManager.getWorkspaceDir()}\n`;

    if (targetDir) {
      prompt += `- 用户指定的目标目录：${targetDir}\n`;
      prompt += `- 使用file_write时，必须使用绝对路径指向目标目录，例如：${targetDir}\\文件名\n`;
      prompt += `- 所有文件都应该创建在目标目录中\n\n`;
    } else {
      prompt += `- 使用file_write时，路径应该是相对于工作目录的相对路径\n\n`;
    }

    // Check if task requires code creation/modification
    const taskText = `${task.title} ${task.description}`.toLowerCase();
    const codeRelatedKeywords = [
      '实现',
      'implement',
      'implement',
      '添加',
      'add',
      'adding',
      '创建',
      'create',
      'creating',
      '开发',
      'develop',
      'developing',
      '编写',
      'write',
      'writing',
      '编写代码',
      'write code',
      '编写游戏',
      'write game',
    ];

    const requiresCodeWriting = codeRelatedKeywords.some((keyword) =>
      taskText.includes(keyword.toLowerCase())
    );

    if (requiresCodeWriting) {
      prompt += `⚠️ 重要提醒：这个任务需要编写或修改代码！\n`;
      prompt += `你必须使用file_write工具来创建或修改代码文件。\n`;
      if (targetDir) {
        prompt += `记住：使用绝对路径将文件写入目标目录 ${targetDir}\n`;
      }
      prompt += `不要只使用file_list或code_query，这些工具不会创建任何文件。\n\n`;
    }

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
