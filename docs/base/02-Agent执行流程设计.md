# 02-Agent执行流程设计

## 1. 总体执行流程

```
用户输入任务
    ↓
┌─────────────────────────────────────────────────────────┐
│                    主循环开始                            │
│  (最多 maxIterations 次迭代)                            │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 1: Planning (规划阶段)                           │
│  - Planner 分析任务                                      │
│  - 判断是否需要 TODO 列表                                │
│  - 生成执行计划或直接回答                                │
└─────────────────────────────────────────────────────────┘
    ↓
    ├─→ [简单任务] → 直接返回答案 → 结束
    │
    └─→ [复杂任务] → 生成 Plan
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 2: User Confirmation (用户确认)                  │
│  - 展示执行计划                                          │
│  - 等待用户确认/修改/取消                                │
└─────────────────────────────────────────────────────────┘
    ↓
    ├─→ [取消] → 结束
    ├─→ [修改] → 返回 Planning
    └─→ [确认] → 继续
                  ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 3: Executing (执行阶段)                          │
│  - Executor 逐个执行任务                                 │
│  - 调用工具完成具体操作                                  │
│  - 更新任务状态                                          │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 4: Reflecting (反思阶段)                         │
│  - Reflector 评估执行结果                                │
│  - 判断是否达成目标                                      │
│  - 识别问题并提出改进建议                                │
└─────────────────────────────────────────────────────────┘
    ↓
    ├─→ [目标达成] → 生成总结报告 → 结束
    ├─→ [需要改进] → 生成新计划 → 返回 Phase 2
    └─→ [遇到阻塞] → 询问用户 → 根据反馈决定
                                      ↓
                        ├─→ [继续] → 返回 Planning
                        └─→ [终止] → 结束
```

## 2. Planner (规划器) 详细流程

### 2.1 Planner 职责
- 分析用户任务的复杂度
- 判断是否需要生成 TODO 列表
- 将复杂任务分解为可执行的子任务
- 识别任务依赖关系

### 2.2 Planner 执行流程

```typescript
async function plannerPhase(userTask: string, context: AgentState): Promise<PlannerResult> {
  // 1. 构建 Planner 提示词
  const prompt = buildPlannerPrompt(userTask, context);

  // 2. 调用 LLM (Planner 模型)
  const response = await plannerLLM.chat({
    messages: [
      { role: 'system', content: PLANNER_SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7
  });

  // 3. 解析响应
  const result = parsePlannerResponse(response.content);

  // 4. 判断任务类型
  if (result.type === 'simple') {
    // 简单任务：直接返回答案
    return {
      type: 'direct_answer',
      answer: result.answer
    };
  } else {
    // 复杂任务：生成执行计划
    return {
      type: 'plan',
      plan: {
        goal: userTask,
        tasks: result.tasks.map((task, index) => ({
          id: generateId(),
          title: task.title,
          description: task.description,
          status: 'pending',
          priority: index + 1,
          dependencies: task.dependencies || []
        }))
      }
    };
  }
}
```

### 2.3 Planner 提示词模板

```typescript
const PLANNER_SYSTEM_PROMPT = `
你是一个智能任务规划器。你的职责是：

1. 分析用户任务的复杂度
2. 对于简单任务（如查询、解释、简单问答），直接提供答案
3. 对于复杂任务（如编程、多步骤操作），生成详细的执行计划

判断标准：
- 简单任务：单步操作、信息查询、概念解释
- 复杂任务：需要多个步骤、涉及代码修改、需要工具调用

输出格式：
{
  "type": "simple" | "complex",
  "answer": "直接答案（仅简单任务）",
  "tasks": [
    {
      "title": "任务标题",
      "description": "详细描述",
      "dependencies": ["依赖的任务ID"]
    }
  ]
}
`;

function buildPlannerPrompt(userTask: string, context: AgentState): string {
  return `
用户任务：${userTask}

当前上下文：
- 已完成的任务：${context.plan?.tasks.filter(t => t.status === 'completed').length || 0}
- 当前迭代：${context.currentIteration}/${context.maxIterations}

请分析这个任务并生成执行计划。
`;
}
```

## 3. Executor (执行器) 详细流程

### 3.1 Executor 职责
- 按顺序执行计划中的任务
- 调用合适的工具完成具体操作
- 处理工具调用结果
- 更新任务状态

### 3.2 Executor 执行流程

```typescript
async function executorPhase(plan: Plan, context: AgentState): Promise<ExecutionResult> {
  const results: TaskResult[] = [];

  // 1. 获取下一个待执行的任务
  while (true) {
    const nextTask = getNextTask(plan);
    if (!nextTask) break;

    // 2. 更新任务状态为 in_progress
    updateTaskStatus(nextTask.id, 'in_progress');
    logger.info(`开始执行任务: ${nextTask.title}`);

    try {
      // 3. 构建 Executor 提示词
      const prompt = buildExecutorPrompt(nextTask, context);

      // 4. 调用 LLM (Executor 模型) 并提供工具
      const response = await executorLLM.chat({
        messages: [
          { role: 'system', content: EXECUTOR_SYSTEM_PROMPT },
          ...context.conversation.messages,
          { role: 'user', content: prompt }
        ],
        tools: toolManager.getDefinitions(),
        temperature: 0.3
      });

      // 5. 处理工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolResults = await executeTools(response.toolCalls);

        // 6. 将工具结果反馈给 LLM
        const finalResponse = await executorLLM.chat({
          messages: [
            ...context.conversation.messages,
            { role: 'assistant', content: response.content, toolCalls: response.toolCalls },
            ...toolResults.map(r => ({ role: 'tool', ...r }))
          ],
          temperature: 0.3
        });

        // 7. 更新任务状态为 completed
        updateTaskStatus(nextTask.id, 'completed', {
          result: finalResponse.content,
          toolCalls: response.toolCalls.length
        });

        results.push({
          taskId: nextTask.id,
          success: true,
          output: finalResponse.content
        });
      } else {
        // 无工具调用，直接完成
        updateTaskStatus(nextTask.id, 'completed', {
          result: response.content
        });

        results.push({
          taskId: nextTask.id,
          success: true,
          output: response.content
        });
      }

    } catch (error) {
      // 8. 处理错误
      logger.error(`任务执行失败: ${nextTask.title}`, error);
      updateTaskStatus(nextTask.id, 'failed', { error: error.message });

      results.push({
        taskId: nextTask.id,
        success: false,
        error: error.message
      });

      // 如果是关键任务失败，终止执行
      if (nextTask.priority <= 2) {
        break;
      }
    }
  }

  return {
    completedTasks: results.filter(r => r.success).length,
    failedTasks: results.filter(r => !r.success).length,
    results
  };
}
```

### 3.3 工具调用处理

```typescript
async function executeTools(toolCalls: ToolCall[]): Promise<ToolResultMessage[]> {
  const results: ToolResultMessage[] = [];

  for (const toolCall of toolCalls) {
    logger.logToolCall(toolCall.name, toolCall.arguments);

    try {
      // 1. 获取工具实例
      const tool = toolManager.getTool(toolCall.name);

      // 2. 验证参数
      const validation = tool.validate(toolCall.arguments);
      if (!validation.valid) {
        throw new ValidationError(`Invalid arguments: ${validation.errors.join(', ')}`);
      }

      // 3. 检查是否需要用户确认
      if (tool.dangerous && config.cli.confirmDangerous) {
        const confirmed = await askUserConfirmation(
          `工具 '${toolCall.name}' 将执行危险操作，是否继续？`,
          toolCall.arguments
        );

        if (!confirmed) {
          results.push({
            role: 'tool',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: 'User cancelled the operation',
            error: 'Operation cancelled by user'
          });
          continue;
        }
      }

      // 4. 执行工具
      const startTime = Date.now();
      const result = await tool.execute(toolCall.arguments);
      const executionTime = Date.now() - startTime;

      logger.logToolResult(toolCall.name, result);

      // 5. 构建结果消息
      results.push({
        role: 'tool',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: JSON.stringify(result.data),
        timestamp: Date.now(),
        metadata: { executionTime }
      });

    } catch (error) {
      logger.error(`Tool execution failed: ${toolCall.name}`, error);

      results.push({
        role: 'tool',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: '',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  return results;
}
```

### 3.4 Executor 提示词模板

```typescript
const EXECUTOR_SYSTEM_PROMPT = `
你是一个任务执行器。你的职责是：

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
- shell_exec: 执行 Shell 命令
- ask_user: 向用户提问

注意事项：
- 优先使用现有代码，避免重复造轮子
- 修改文件前先读取内容
- 执行危险操作前会提示用户确认
- 如果不确定，使用 ask_user 工具询问用户
`;

function buildExecutorPrompt(task: Task, context: AgentState): string {
  return `
当前任务：${task.title}
任务描述：${task.description}

已完成的任务：
${context.plan.tasks
  .filter(t => t.status === 'completed')
  .map(t => `- ${t.title}`)
  .join('\n')}

请使用合适的工具完成这个任务。
`;
}
```

## 4. Reflector (反思器) 详细流程

### 4.1 Reflector 职责
- 评估任务执行结果
- 判断是否达成目标
- 识别执行中的问题
- 提出改进建议

### 4.2 Reflector 执行流程

```typescript
async function reflectorPhase(
  plan: Plan,
  executionResult: ExecutionResult,
  context: AgentState
): Promise<ReflectionResult> {

  // 1. 构建反思提示词
  const prompt = buildReflectorPrompt(plan, executionResult, context);

  // 2. 调用 LLM (Reflector 模型)
  const response = await reflectorLLM.chat({
    messages: [
      { role: 'system', content: REFLECTOR_SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: 0.5
  });

  // 3. 解析反思结果
  const reflection = parseReflectionResponse(response.content);

  // 4. 判断下一步行动
  if (reflection.goalAchieved) {
    return {
      status: 'completed',
      summary: reflection.summary,
      nextAction: 'finish'
    };
  } else if (reflection.blocked) {
    return {
      status: 'blocked',
      issues: reflection.issues,
      nextAction: 'ask_user',
      question: reflection.question
    };
  } else if (context.currentIteration >= context.maxIterations) {
    return {
      status: 'max_iterations_reached',
      summary: reflection.summary,
      nextAction: 'finish'
    };
  } else {
    return {
      status: 'needs_improvement',
      issues: reflection.issues,
      suggestions: reflection.suggestions,
      nextAction: 'replan',
      newPlan: reflection.improvedPlan
    };
  }
}
```

### 4.3 Reflector 提示词模板

```typescript
const REFLECTOR_SYSTEM_PROMPT = `
你是一个反思评估器。你的职责是：

1. 评估任务执行结果是否达成目标
2. 识别执行过程中的问题和不足
3. 提出具体的改进建议
4. 判断是否需要重新规划

评估标准：
- 目标达成度：是否完成了用户的原始需求
- 代码质量：是否符合最佳实践
- 错误处理：是否有未处理的错误
- 完整性：是否有遗漏的功能

输出格式：
{
  "goalAchieved": true/false,
  "blocked": true/false,
  "summary": "执行总结",
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "question": "需要询问用户的问题（如果 blocked）",
  "improvedPlan": { ... } // 改进后的计划（如果需要）
}
`;

function buildReflectorPrompt(
  plan: Plan,
  executionResult: ExecutionResult,
  context: AgentState
): string {
  return `
原始目标：${plan.goal}

执行结果：
- 完成任务数：${executionResult.completedTasks}
- 失败任务数：${executionResult.failedTasks}

任务详情：
${executionResult.results.map(r => `
- 任务ID: ${r.taskId}
  状态: ${r.success ? '成功' : '失败'}
  ${r.success ? `输出: ${r.output}` : `错误: ${r.error}`}
`).join('\n')}

当前迭代：${context.currentIteration}/${context.maxIterations}

请评估执行结果，判断是否达成目标，并提出改进建议。
`;
}
```

## 5. 用户确认机制

### 5.1 确认时机
- 执行计划生成后
- 危险工具调用前
- 遇到阻塞需要用户决策时

### 5.2 确认流程

```typescript
async function userConfirmationPhase(plan: Plan): Promise<ConfirmationResult> {
  // 1. 展示执行计划
  console.log(chalk.bold('\n📋 执行计划：\n'));
  console.log(chalk.cyan(`目标: ${plan.goal}\n`));

  plan.tasks.forEach((task, index) => {
    console.log(chalk.white(`${index + 1}. ${task.title}`));
    console.log(chalk.gray(`   ${task.description}`));
    if (task.dependencies.length > 0) {
      console.log(chalk.yellow(`   依赖: ${task.dependencies.join(', ')}`));
    }
  });

  // 2. 询问用户
  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '请选择操作：',
      choices: [
        { name: '✅ 确认执行', value: 'confirm' },
        { name: '✏️  修改计划', value: 'modify' },
        { name: '❌ 取消', value: 'cancel' }
      ]
    }
  ]);

  // 3. 处理用户选择
  switch (answer.action) {
    case 'confirm':
      return { action: 'proceed' };

    case 'modify':
      const modifications = await inquirer.prompt([
        {
          type: 'editor',
          name: 'newPlan',
          message: '请修改计划（JSON 格式）：',
          default: JSON.stringify(plan, null, 2)
        }
      ]);

      try {
        const modifiedPlan = JSON.parse(modifications.newPlan);
        return { action: 'replan', plan: modifiedPlan };
      } catch (error) {
        console.log(chalk.red('❌ 计划格式错误，请重试'));
        return userConfirmationPhase(plan); // 递归重试
      }

    case 'cancel':
      return { action: 'cancel' };
  }
}
```

### 5.3 危险操作确认

```typescript
async function askUserConfirmation(
  message: string,
  details?: any
): Promise<boolean> {
  console.log(chalk.yellow(`\n⚠️  ${message}\n`));

  if (details) {
    console.log(chalk.gray('详细信息：'));
    console.log(chalk.gray(JSON.stringify(details, null, 2)));
  }

  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: '是否继续？',
      default: false
    }
  ]);

  return answer.confirmed;
}
```

## 6. 主循环控制器

### 6.1 主循环伪代码

```typescript
async function mainLoop(userTask: string, config: GlobalConfig): Promise<void> {
  // 1. 初始化
  const stateManager = new StateManager();
  const logger = new Logger(config.logging);
  const toolManager = new ToolManager(config.tools);

  stateManager.updatePhase('planning');
  logger.info('Agent 启动', { task: userTask });

  try {
    // 2. 主循环
    while (stateManager.state.currentIteration < config.agent.maxIterations) {
      stateManager.incrementIteration();
      logger.info(`开始第 ${stateManager.state.currentIteration} 次迭代`);

      // Phase 1: Planning
      stateManager.updatePhase('planning');
      const plannerResult = await plannerPhase(userTask, stateManager.state);

      if (plannerResult.type === 'direct_answer') {
        // 简单任务，直接返回答案
        console.log(chalk.green('\n✅ 答案：\n'));
        console.log(plannerResult.answer);
        break;
      }

      // 复杂任务，设置计划
      stateManager.setPlan(plannerResult.plan);

      // Phase 2: User Confirmation
      if (config.agent.requireConfirmation) {
        stateManager.updatePhase('confirming');
        const confirmation = await userConfirmationPhase(plannerResult.plan);

        if (confirmation.action === 'cancel') {
          logger.info('用户取消执行');
          break;
        } else if (confirmation.action === 'replan') {
          stateManager.setPlan(confirmation.plan);
        }
      }

      // Phase 3: Executing
      stateManager.updatePhase('executing');
      const executionResult = await executorPhase(
        stateManager.state.plan,
        stateManager.state
      );

      // Phase 4: Reflecting
      if (config.agent.enableReflection) {
        stateManager.updatePhase('reflecting');
        const reflectionResult = await reflectorPhase(
          stateManager.state.plan,
          executionResult,
          stateManager.state
        );

        // 根据反思结果决定下一步
        if (reflectionResult.nextAction === 'finish') {
          console.log(chalk.green('\n✅ 任务完成！\n'));
          console.log(reflectionResult.summary);
          break;
        } else if (reflectionResult.nextAction === 'ask_user') {
          const userResponse = await askUser(reflectionResult.question);
          userTask = `${userTask}\n\n用户反馈：${userResponse}`;
          continue; // 重新规划
        } else if (reflectionResult.nextAction === 'replan') {
          stateManager.setPlan(reflectionResult.newPlan);
          continue; // 继续下一次迭代
        }
      } else {
        // 不启用反思，直接完成
        console.log(chalk.green('\n✅ 执行完成！\n'));
        break;
      }
    }

    // 3. 达到最大迭代次数
    if (stateManager.state.currentIteration >= config.agent.maxIterations) {
      console.log(chalk.yellow('\n⚠️  达到最大迭代次数，任务可能未完全完成\n'));
    }

  } catch (error) {
    // 4. 错误处理
    logger.error('Agent 执行失败', error);
    console.log(chalk.red(`\n❌ 错误：${error.message}\n`));
  } finally {
    // 5. 清理和保存
    stateManager.updatePhase('completed');
    await stateManager.save(`logs/session-${Date.now()}.json`);
    logger.info('Agent 结束');
  }
}
```

## 7. 状态转换图

```
[初始化]
    ↓
[planning] ──→ [direct_answer] ──→ [completed]
    ↓
[confirming]
    ↓
    ├──→ [cancel] ──→ [completed]
    └──→ [proceed]
            ↓
        [executing]
            ↓
        [reflecting]
            ↓
            ├──→ [goal_achieved] ──→ [completed]
            ├──→ [blocked] ──→ [ask_user] ──→ [planning]
            ├──→ [needs_improvement] ──→ [planning]
            └──→ [max_iterations] ──→ [completed]
```

## 8. 错误恢复策略

### 8.1 工具调用失败
```typescript
// 策略：重试 3 次，失败后跳过或询问用户
if (toolCallFailed) {
  if (retryCount < 3) {
    await sleep(1000 * retryCount);
    retry();
  } else {
    if (task.priority <= 2) {
      // 关键任务失败，询问用户
      await askUser('关键任务失败，是否继续？');
    } else {
      // 非关键任务，跳过
      markTaskAsSkipped(task.id);
    }
  }
}
```

### 8.2 LLM 调用失败
```typescript
// 策略：指数退避重试，最多 5 次
if (llmCallFailed) {
  if (retryCount < 5) {
    await sleep(Math.pow(2, retryCount) * 1000);
    retry();
  } else {
    throw new LLMError('LLM 调用失败，请检查配置');
  }
}
```

### 8.3 用户中断
```typescript
// 策略：保存当前状态，支持恢复
process.on('SIGINT', async () => {
  console.log('\n⚠️  检测到中断信号，正在保存状态...');
  await stateManager.save('logs/interrupted-session.json');
  console.log('✅ 状态已保存，可使用 --resume 恢复');
  process.exit(0);
});
```

## 9. 性能优化

### 9.1 并行工具调用
```typescript
// 如果多个工具调用无依赖关系，并行执行
const independentCalls = identifyIndependentCalls(toolCalls);
const results = await Promise.all(
  independentCalls.map(call => executeTools([call]))
);
```

### 9.2 缓存机制
```typescript
// 缓存代码查询结果，避免重复调用
const cacheKey = `code_query:${JSON.stringify(args)}`;
const cached = cache.get(cacheKey);
if (cached) return cached;

const result = await tool.execute(args);
cache.set(cacheKey, result, { ttl: 300 }); // 5分钟过期
```

### 9.3 流式输出
```typescript
// 对于长时间执行的任务，使用流式输出提升体验
const stream = await executorLLM.chatStream(request);
for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```
