# TODO-04: Agent核心流程实现

## 目标
实现Planner、Executor、Reflector三个核心组件，建立主循环控制器和状态管理器，完成Agent的规划-执行-反思循环。

## 内部TODO列表

### TODO 4.1: 状态管理器实现
**优先级**: P0
**预期产出**: AgentState管理和持久化

**核心实现**:
```typescript
// src/core/state.ts
class StateManager {
  private state: AgentState
  private logger: ILogger
  private eventEmitter: EventEmitter

  constructor(config: GlobalConfig, logger: ILogger) {
    this.logger = logger
    this.eventEmitter = new EventEmitter()
    this.state = this.initializeState(config)
  }

  private initializeState(config: GlobalConfig): AgentState {
    return {
      phase: 'planning',
      plan: undefined,
      conversation: {
        id: generateId(),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      currentIteration: 0,
      maxIterations: config.agent.maxIterations,
      startTime: Date.now(),
      endTime: undefined,
      metadata: {
        totalTokens: 0,
        totalCost: 0,
        toolCallsCount: 0
      }
    }
  }

  getState(): AgentState {
    return { ...this.state }
  }

  updatePhase(phase: AgentPhase): void {
    this.state.phase = phase
    this.eventEmitter.emit({
      type: 'phase_changed',
      timestamp: Date.now(),
      data: { phase }
    })
    this.logger.info(`Phase changed to: ${phase}`)
  }

  setPlan(plan: Plan): void {
    this.state.plan = plan
    this.logger.info('Plan set', { taskCount: plan.tasks.length })
  }

  incrementIteration(): void {
    this.state.currentIteration++
    this.eventEmitter.emit({
      type: 'iteration_started',
      timestamp: Date.now(),
      data: { iteration: this.state.currentIteration }
    })
  }

  addMessage(message: Message): void {
    this.state.conversation.messages.push(message)
    this.state.conversation.updatedAt = Date.now()
  }

  updateMetadata(updates: Partial<AgentState['metadata']>): void {
    this.state.metadata = { ...this.state.metadata, ...updates }
  }

  // 持久化
  async save(path: string): Promise<void> {
    try {
      await fs.mkdir(dirname(path), { recursive: true })
      await fs.writeFile(path, JSON.stringify(this.state, null, 2))
      this.logger.info(`State saved to: ${path}`)
    } catch (error) {
      this.logger.error('Failed to save state', error)
      throw error
    }
  }

  async load(path: string): Promise<void> {
    try {
      const content = await fs.readFile(path, 'utf8')
      this.state = JSON.parse(content)
      this.logger.info(`State loaded from: ${path}`)
    } catch (error) {
      this.logger.error('Failed to load state', error)
      throw error
    }
  }

  // 事件订阅
  on(eventType: EventType, listener: EventListener): void {
    this.eventEmitter.on(eventType, listener)
  }
}
```

**验收标准**:
- [ ] 状态更新触发事件
- [ ] 持久化和恢复正常
- [ ] 线程安全（如需要）
- [ ] 内存占用合理

---

### TODO 4.2: Planner规划器实现
**优先级**: P0
**预期产出**: 任务分析和计划生成

**核心逻辑**:
```typescript
// src/core/planner.ts
class Planner {
  private llmClient: ILLMClient
  private logger: ILogger

  constructor(llmClient: ILLMClient, logger: ILogger) {
    this.llmClient = llmClient
    this.logger = logger
  }

  async plan(userTask: string, context: AgentState): Promise<PlannerResult> {
    this.logger.info('Planning started', { task: userTask })

    // 构建提示词
    const prompt = this.buildPrompt(userTask, context)

    // 调用LLM
    const response = await this.llmClient.chat({
      messages: [
        { role: 'system', content: PLANNER_SYSTEM_PROMPT, timestamp: Date.now() },
        { role: 'user', content: prompt, timestamp: Date.now() }
      ],
      temperature: 0.7,
      maxTokens: 4096
    })

    // 解析响应
    const result = this.parseResponse(response.content)

    // 判断任务类型
    if (result.type === 'simple') {
      return {
        type: 'direct_answer',
        answer: result.answer
      }
    }

    // 生成执行计划
    const plan: Plan = {
      id: generateId(),
      goal: userTask,
      tasks: result.tasks.map((task, index) => ({
        id: generateId(),
        title: task.title,
        description: task.description,
        status: 'pending',
        priority: index + 1,
        dependencies: task.dependencies || [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      })),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    this.logger.info('Plan generated', { taskCount: plan.tasks.length })

    return { type: 'plan', plan }
  }

  private buildPrompt(userTask: string, context: AgentState): string {
    let prompt = `用户任务：${userTask}\n\n`

    if (context.plan) {
      const completed = context.plan.tasks.filter(t => t.status === 'completed')
      prompt += `当前上下文：\n`
      prompt += `- 已完成任务：${completed.length}/${context.plan.tasks.length}\n`
      prompt += `- 当前迭代：${context.currentIteration}/${context.maxIterations}\n\n`
    }

    prompt += `请分析这个任务并生成执行计划。`

    return prompt
  }

  private parseResponse(content: string): PlannerResponse {
    try {
      // 尝试解析JSON
      const parsed = JSON.parse(content)
      return parsed
    } catch {
      // 如果不是JSON，尝试从Markdown代码块提取
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1])
      }
      throw new Error('Failed to parse planner response')
    }
  }
}

const PLANNER_SYSTEM_PROMPT = `
你是一个智能任务规划器。你的职责是：

1. 分析用户任务的复杂度
2. 对于简单任务（如查询、解释、简单问答），直接提供答案
3. 对于复杂任务（如编程、多步骤操作），生成详细的执行计划

判断标准：
- 简单任务：单步操作、信息查询、概念解释
- 复杂任务：需要多个步骤、涉及代码修改、需要工具调用

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
`
```

**验收标准**:
- [ ] 正确区分简单/复杂任务
- [ ] 任务分解合理
- [ ] 依赖关系正确
- [ ] JSON解析健壮

---

### TODO 4.3: Executor执行器实现
**优先级**: P0
**预期产出**: 任务执行和工具调用

**核心逻辑**:
```typescript
// src/core/executor.ts
class Executor {
  private llmClient: ILLMClient
  private toolManager: ToolManager
  private logger: ILogger

  constructor(
    llmClient: ILLMClient,
    toolManager: ToolManager,
    logger: ILogger
  ) {
    this.llmClient = llmClient
    this.toolManager = toolManager
    this.logger = logger
  }

  async execute(plan: Plan, context: AgentState): Promise<ExecutionResult> {
    const results: TaskResult[] = []

    while (true) {
      const nextTask = this.getNextTask(plan)
      if (!nextTask) break

      this.logger.info(`Executing task: ${nextTask.title}`)
      this.updateTaskStatus(plan, nextTask.id, 'in_progress')

      try {
        const result = await this.executeTask(nextTask, context)
        results.push(result)

        if (result.success) {
          this.updateTaskStatus(plan, nextTask.id, 'completed', result.output)
        } else {
          this.updateTaskStatus(plan, nextTask.id, 'failed', undefined, result.error)

          // 关键任务失败则终止
          if (nextTask.priority <= 2) {
            break
          }
        }
      } catch (error) {
        this.logger.error(`Task execution failed: ${nextTask.title}`, error)
        this.updateTaskStatus(plan, nextTask.id, 'failed', undefined, error.message)
        results.push({
          taskId: nextTask.id,
          success: false,
          error: error.message
        })
        break
      }
    }

    return {
      completedTasks: results.filter(r => r.success).length,
      failedTasks: results.filter(r => !r.success).length,
      results
    }
  }

  private async executeTask(task: Task, context: AgentState): Promise<TaskResult> {
    // 构建提示词
    const prompt = this.buildPrompt(task, context)

    // 第一次LLM调用（可能返回工具调用）
    const response = await this.llmClient.chat({
      messages: [
        { role: 'system', content: EXECUTOR_SYSTEM_PROMPT, timestamp: Date.now() },
        ...context.conversation.messages,
        { role: 'user', content: prompt, timestamp: Date.now() }
      ],
      tools: this.toolManager.getDefinitions(),
      temperature: 0.3
    })

    // 更新Token统计
    context.metadata.totalTokens += response.usage.totalTokens

    // 如果有工具调用
    if (response.toolCalls && response.toolCalls.length > 0) {
      // 执行工具
      const toolResults = await this.executeTools(response.toolCalls, context)

      // 将工具结果反馈给LLM
      const finalResponse = await this.llmClient.chat({
        messages: [
          ...context.conversation.messages,
          {
            role: 'assistant',
            content: response.content,
            toolCalls: response.toolCalls,
            timestamp: Date.now()
          },
          ...toolResults.map(r => ({
            role: 'tool' as const,
            content: JSON.stringify(r.data),
            toolCallId: r.toolCallId,
            toolName: r.toolName,
            timestamp: Date.now()
          }))
        ],
        temperature: 0.3
      })

      context.metadata.totalTokens += finalResponse.usage.totalTokens

      return {
        taskId: task.id,
        success: true,
        output: finalResponse.content
      }
    }

    // 无工具调用，直接返回
    return {
      taskId: task.id,
      success: true,
      output: response.content
    }
  }

  private async executeTools(
    toolCalls: ToolCall[],
    context: AgentState
  ): Promise<ToolResultMessage[]> {
    const results: ToolResultMessage[] = []

    for (const toolCall of toolCalls) {
      const result = await this.toolManager.execute(toolCall)
      context.metadata.toolCallsCount++

      results.push({
        role: 'tool',
        content: result.success ? JSON.stringify(result.data) : '',
        error: result.error,
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        timestamp: Date.now()
      })
    }

    return results
  }

  private getNextTask(plan: Plan): Task | null {
    // 找到第一个pending且依赖已完成的任务
    for (const task of plan.tasks) {
      if (task.status !== 'pending') continue

      const depsCompleted = task.dependencies.every(depId => {
        const depTask = plan.tasks.find(t => t.id === depId)
        return depTask?.status === 'completed'
      })

      if (depsCompleted) return task
    }

    return null
  }

  private updateTaskStatus(
    plan: Plan,
    taskId: string,
    status: TaskStatus,
    result?: string,
    error?: string
  ): void {
    const task = plan.tasks.find(t => t.id === taskId)
    if (task) {
      task.status = status
      task.updatedAt = Date.now()
      if (result) task.result = result
      if (error) task.error = error
    }
  }

  private buildPrompt(task: Task, context: AgentState): string {
    let prompt = `当前任务：${task.title}\n`
    prompt += `任务描述：${task.description}\n\n`

    if (context.plan) {
      const completed = context.plan.tasks.filter(t => t.status === 'completed')
      if (completed.length > 0) {
        prompt += `已完成的任务：\n`
        completed.forEach(t => {
          prompt += `- ${t.title}\n`
        })
        prompt += `\n`
      }
    }

    prompt += `请使用合适的工具完成这个任务。`

    return prompt
  }
}

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
- shell_exec: 执行Shell命令
- ask_user: 向用户提问

注意事项：
- 优先使用现有代码，避免重复造轮子
- 修改文件前先读取内容
- 执行危险操作前会提示用户确认
- 如果不确定，使用ask_user工具询问用户
`
```

**验收标准**:
- [ ] 任务按依赖顺序执行
- [ ] 工具调用正确
- [ ] 错误处理完善
- [ ] Token统计准确

---

### TODO 4.4: Reflector反思器实现
**优先级**: P0
**预期产出**: 执行结果评估和改进建议

**核心逻辑**:
```typescript
// src/core/reflector.ts
class Reflector {
  private llmClient: ILLMClient
  private logger: ILogger

  constructor(llmClient: ILLMClient, logger: ILogger) {
    this.llmClient = llmClient
    this.logger = logger
  }

  async reflect(
    plan: Plan,
    executionResult: ExecutionResult,
    context: AgentState
  ): Promise<ReflectionResult> {
    this.logger.info('Reflection started')

    // 构建提示词
    const prompt = this.buildPrompt(plan, executionResult, context)

    // 调用LLM
    const response = await this.llmClient.chat({
      messages: [
        { role: 'system', content: REFLECTOR_SYSTEM_PROMPT, timestamp: Date.now() },
        { role: 'user', content: prompt, timestamp: Date.now() }
      ],
      temperature: 0.5,
      maxTokens: 2048
    })

    // 解析反思结果
    const reflection = this.parseResponse(response.content)

    // 判断下一步行动
    if (reflection.goalAchieved) {
      return {
        status: 'completed',
        summary: reflection.summary,
        nextAction: 'finish'
      }
    }

    if (reflection.blocked) {
      return {
        status: 'blocked',
        issues: reflection.issues,
        nextAction: 'ask_user',
        question: reflection.question
      }
    }

    if (context.currentIteration >= context.maxIterations) {
      return {
        status: 'max_iterations_reached',
        summary: reflection.summary,
        nextAction: 'finish'
      }
    }

    return {
      status: 'needs_improvement',
      issues: reflection.issues,
      suggestions: reflection.suggestions,
      nextAction: 'replan',
      newPlan: reflection.improvedPlan
    }
  }

  private buildPrompt(
    plan: Plan,
    executionResult: ExecutionResult,
    context: AgentState
  ): string {
    let prompt = `原始目标：${plan.goal}\n\n`

    prompt += `执行结果：\n`
    prompt += `- 完成任务数：${executionResult.completedTasks}\n`
    prompt += `- 失败任务数：${executionResult.failedTasks}\n\n`

    prompt += `任务详情：\n`
    executionResult.results.forEach(r => {
      const task = plan.tasks.find(t => t.id === r.taskId)
      prompt += `- ${task?.title}\n`
      prompt += `  状态: ${r.success ? '成功' : '失败'}\n`
      if (r.success) {
        prompt += `  输出: ${r.output}\n`
      } else {
        prompt += `  错误: ${r.error}\n`
      }
    })

    prompt += `\n当前迭代：${context.currentIteration}/${context.maxIterations}\n\n`
    prompt += `请评估执行结果，判断是否达成目标，并提出改进建议。`

    return prompt
  }

  private parseResponse(content: string): ReflectionResponse {
    try {
      const parsed = JSON.parse(content)
      return parsed
    } catch {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1])
      }
      throw new Error('Failed to parse reflection response')
    }
  }
}

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
`
```

**验收标准**:
- [ ] 目标达成判断准确
- [ ] 问题识别全面
- [ ] 改进建议可行
- [ ] 阻塞检测正确

---

### TODO 4.5: 主循环控制器实现
**优先级**: P0
**预期产出**: Agent主循环和用户确认机制

**核心逻辑**:
```typescript
// src/core/agent.ts
class Agent {
  private stateManager: StateManager
  private planner: Planner
  private executor: Executor
  private reflector: Reflector
  private config: GlobalConfig
  private logger: ILogger

  constructor(config: GlobalConfig, logger: ILogger) {
    this.config = config
    this.logger = logger

    // 初始化组件
    const llmManager = new LLMManager(config, logger)
    const toolManager = new ToolManager(config.tools, logger)

    this.stateManager = new StateManager(config, logger)
    this.planner = new Planner(llmManager.getClient('planner'), logger)
    this.executor = new Executor(
      llmManager.getClient('executor'),
      toolManager,
      logger
    )
    this.reflector = new Reflector(llmManager.getClient('reflector'), logger)
  }

  async run(userTask: string): Promise<void> {
    this.logger.info('Agent started', { task: userTask })

    try {
      // 主循环
      while (this.stateManager.getState().currentIteration < this.config.agent.maxIterations) {
        this.stateManager.incrementIteration()

        // Phase 1: Planning
        this.stateManager.updatePhase('planning')
        const plannerResult = await this.planner.plan(userTask, this.stateManager.getState())

        if (plannerResult.type === 'direct_answer') {
          console.log(chalk.green('\n✅ 答案：\n'))
          console.log(plannerResult.answer)
          break
        }

        this.stateManager.setPlan(plannerResult.plan)

        // Phase 2: User Confirmation
        if (this.config.agent.requireConfirmation) {
          this.stateManager.updatePhase('confirming')
          const confirmation = await this.userConfirmation(plannerResult.plan)

          if (confirmation.action === 'cancel') {
            this.logger.info('User cancelled execution')
            break
          } else if (confirmation.action === 'replan') {
            this.stateManager.setPlan(confirmation.plan)
          }
        }

        // Phase 3: Executing
        this.stateManager.updatePhase('executing')
        const executionResult = await this.executor.execute(
          this.stateManager.getState().plan!,
          this.stateManager.getState()
        )

        // Phase 4: Reflecting
        if (this.config.agent.enableReflection) {
          this.stateManager.updatePhase('reflecting')
          const reflectionResult = await this.reflector.reflect(
            this.stateManager.getState().plan!,
            executionResult,
            this.stateManager.getState()
          )

          if (reflectionResult.nextAction === 'finish') {
            console.log(chalk.green('\n✅ 任务完成！\n'))
            console.log(reflectionResult.summary)
            break
          } else if (reflectionResult.nextAction === 'ask_user') {
            const userResponse = await this.askUser(reflectionResult.question!)
            userTask = `${userTask}\n\n用户反馈：${userResponse}`
            continue
          } else if (reflectionResult.nextAction === 'replan') {
            continue
          }
        } else {
          console.log(chalk.green('\n✅ 执行完成！\n'))
          break
        }
      }

      // 达到最大迭代次数
      if (this.stateManager.getState().currentIteration >= this.config.agent.maxIterations) {
        console.log(chalk.yellow('\n⚠️  达到最大迭代次数\n'))
      }

    } catch (error) {
      this.logger.error('Agent execution failed', error)
      console.log(chalk.red(`\n❌ 错误：${error.message}\n`))
    } finally {
      this.stateManager.updatePhase('completed')
      await this.stateManager.save(`logs/session-${Date.now()}.json`)
      this.logger.info('Agent finished')
    }
  }

  private async userConfirmation(plan: Plan): Promise<ConfirmationResult> {
    console.log(chalk.bold('\n📋 执行计划：\n'))
    console.log(chalk.cyan(`目标: ${plan.goal}\n`))

    plan.tasks.forEach((task, index) => {
      console.log(chalk.white(`${index + 1}. ${task.title}`))
      console.log(chalk.gray(`   ${task.description}`))
    })

    const answer = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: '请选择操作：',
      choices: [
        { name: '✅ 确认执行', value: 'confirm' },
        { name: '❌ 取消', value: 'cancel' }
      ]
    }])

    return { action: answer.action }
  }

  private async askUser(question: string): Promise<string> {
    const answer = await inquirer.prompt([{
      type: 'input',
      name: 'response',
      message: question
    }])

    return answer.response
  }
}
```

**验收标准**:
- [ ] 主循环正确执行
- [ ] 用户确认机制生效
- [ ] 状态正确保存
- [ ] 错误恢复正常

---

## 依赖关系
- 依赖 TODO-02（LLM客户端）
- 依赖 TODO-03（工具系统）
- TODO 4.1 是其他TODO的基础
- TODO 4.5 依赖 TODO 4.2-4.4

## 风险与缓解
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LLM响应不稳定 | 高 | 重试机制+响应验证 |
| 任务依赖死锁 | 中 | 依赖检测算法 |
| 无限循环 | 中 | 最大迭代次数限制 |
| 状态不一致 | 中 | 事务性更新 |

## 完成标准
- [ ] 所有5个内部TODO完成
- [ ] 端到端测试通过
- [ ] 规划-执行-反思循环正常
- [ ] 用户确认流程完整
