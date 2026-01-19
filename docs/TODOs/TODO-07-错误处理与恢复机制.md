# TODO-07: 错误处理与恢复机制

## 目标
建立完善的错误处理体系，实现错误恢复、重试机制、状态回滚和会话恢复功能，确保系统鲁棒性。

## 内部TODO列表

### TODO 7.1: 错误分类和处理策略
**优先级**: P0
**预期产出**: 完整的错误类型体系和处理策略

**错误分类**:
```typescript
// src/core/errors.ts
enum ErrorCategory {
  RECOVERABLE = 'recoverable',      // 可恢复错误
  TRANSIENT = 'transient',          // 临时错误（可重试）
  PERMANENT = 'permanent',          // 永久错误
  CRITICAL = 'critical'             // 严重错误（需立即终止）
}

enum ErrorCode {
  // LLM错误
  LLM_TIMEOUT = 'LLM_TIMEOUT',
  LLM_RATE_LIMIT = 'LLM_RATE_LIMIT',
  LLM_INVALID_RESPONSE = 'LLM_INVALID_RESPONSE',
  LLM_API_ERROR = 'LLM_API_ERROR',

  // 工具错误
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_VALIDATION_ERROR = 'TOOL_VALIDATION_ERROR',
  TOOL_EXECUTION_ERROR = 'TOOL_EXECUTION_ERROR',
  TOOL_TIMEOUT = 'TOOL_TIMEOUT',

  // 配置错误
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_MISSING = 'CONFIG_MISSING',

  // 系统错误
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  OUT_OF_MEMORY = 'OUT_OF_MEMORY'
}

class AgentError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public category: ErrorCategory,
    public details?: any,
    public cause?: Error
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }

  isRecoverable(): boolean {
    return this.category === ErrorCategory.RECOVERABLE ||
           this.category === ErrorCategory.TRANSIENT
  }

  isRetryable(): boolean {
    return this.category === ErrorCategory.TRANSIENT
  }
}

// 具体错误类型
class LLMTimeoutError extends AgentError {
  constructor(message: string, details?: any) {
    super(
      message,
      ErrorCode.LLM_TIMEOUT,
      ErrorCategory.TRANSIENT,
      details
    )
  }
}

class LLMRateLimitError extends AgentError {
  constructor(message: string, retryAfter?: number) {
    super(
      message,
      ErrorCode.LLM_RATE_LIMIT,
      ErrorCategory.TRANSIENT,
      { retryAfter }
    )
  }
}

class ToolExecutionError extends AgentError {
  constructor(toolName: string, message: string, cause?: Error) {
    super(
      `Tool '${toolName}' execution failed: ${message}`,
      ErrorCode.TOOL_EXECUTION_ERROR,
      ErrorCategory.RECOVERABLE,
      { toolName },
      cause
    )
  }
}

class ConfigError extends AgentError {
  constructor(message: string, details?: any) {
    super(
      message,
      ErrorCode.CONFIG_INVALID,
      ErrorCategory.PERMANENT,
      details
    )
  }
}
```

**错误处理策略**:
```typescript
// src/core/error-handler.ts
class ErrorHandler {
  private logger: ILogger
  private config: GlobalConfig

  constructor(logger: ILogger, config: GlobalConfig) {
    this.logger = logger
    this.config = config
  }

  async handle(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
    // 记录错误
    this.logger.error('Error occurred', error, context)

    // 转换为AgentError
    const agentError = this.normalizeError(error)

    // 根据错误类别决定处理策略
    switch (agentError.category) {
      case ErrorCategory.TRANSIENT:
        return this.handleTransientError(agentError, context)

      case ErrorCategory.RECOVERABLE:
        return this.handleRecoverableError(agentError, context)

      case ErrorCategory.PERMANENT:
        return this.handlePermanentError(agentError, context)

      case ErrorCategory.CRITICAL:
        return this.handleCriticalError(agentError, context)

      default:
        return { action: 'fail', error: agentError }
    }
  }

  private normalizeError(error: Error): AgentError {
    if (error instanceof AgentError) {
      return error
    }

    // 根据错误消息推断错误类型
    if (error.message.includes('timeout')) {
      return new LLMTimeoutError(error.message)
    }

    if (error.message.includes('rate limit')) {
      return new LLMRateLimitError(error.message)
    }

    // 默认为永久错误
    return new AgentError(
      error.message,
      ErrorCode.LLM_API_ERROR,
      ErrorCategory.PERMANENT,
      undefined,
      error
    )
  }

  private async handleTransientError(
    error: AgentError,
    context: ErrorContext
  ): Promise<ErrorHandlingResult> {
    // 临时错误：重试
    if (context.retryCount < this.config.agent.maxRetries) {
      const delay = this.calculateRetryDelay(context.retryCount, error)

      return {
        action: 'retry',
        delay,
        error
      }
    }

    // 超过重试次数，转为永久错误
    return { action: 'fail', error }
  }

  private async handleRecoverableError(
    error: AgentError,
    context: ErrorContext
  ): Promise<ErrorHandlingResult> {
    // 可恢复错误：尝试降级或替代方案
    if (context.phase === 'executing') {
      // 工具执行失败，尝试其他工具
      return {
        action: 'fallback',
        suggestion: 'Try alternative tool',
        error
      }
    }

    return { action: 'skip', error }
  }

  private handlePermanentError(
    error: AgentError,
    context: ErrorContext
  ): ErrorHandlingResult {
    // 永久错误：直接失败
    return { action: 'fail', error }
  }

  private handleCriticalError(
    error: AgentError,
    context: ErrorContext
  ): ErrorHandlingResult {
    // 严重错误：立即终止
    return { action: 'abort', error }
  }

  private calculateRetryDelay(retryCount: number, error: AgentError): number {
    // 指数退避
    const baseDelay = 1000
    const maxDelay = 60000

    if (error instanceof LLMRateLimitError && error.details?.retryAfter) {
      return error.details.retryAfter * 1000
    }

    return Math.min(baseDelay * Math.pow(2, retryCount), maxDelay)
  }
}

interface ErrorContext {
  phase: AgentPhase
  iteration: number
  retryCount: number
  taskId?: string
  toolName?: string
}

interface ErrorHandlingResult {
  action: 'retry' | 'fallback' | 'skip' | 'fail' | 'abort'
  delay?: number
  suggestion?: string
  error: AgentError
}
```

**验收标准**:
- [ ] 错误分类完整
- [ ] 处理策略合理
- [ ] 错误转换准确
- [ ] 日志记录完整

---

### TODO 7.2: 重试机制实现
**优先级**: P0
**预期产出**: 智能重试机制和退避策略

**重试管理器**:
```typescript
// src/core/retry-manager.ts
class RetryManager {
  private logger: ILogger
  private config: RetryConfig

  constructor(logger: ILogger, config: RetryConfig) {
    this.logger = logger
    this.config = config
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? this.config.maxRetries
    const strategy = options.strategy ?? this.config.strategy

    let lastError: Error
    let retryCount = 0

    while (retryCount <= maxRetries) {
      try {
        if (retryCount > 0) {
          this.logger.info(`Retry attempt ${retryCount}/${maxRetries}`)
        }

        return await operation()

      } catch (error) {
        lastError = error

        // 检查是否应该重试
        if (!this.shouldRetry(error, retryCount, maxRetries)) {
          throw error
        }

        // 计算延迟
        const delay = this.calculateDelay(retryCount, strategy, error)

        this.logger.warn(
          `Operation failed, retrying in ${delay}ms`,
          { error: error.message, retryCount }
        )

        // 等待
        await this.sleep(delay)

        retryCount++
      }
    }

    throw lastError!
  }

  private shouldRetry(error: Error, retryCount: number, maxRetries: number): boolean {
    // 超过最大重试次数
    if (retryCount >= maxRetries) {
      return false
    }

    // 检查错误是否可重试
    if (error instanceof AgentError) {
      return error.isRetryable()
    }

    // 默认可重试的错误类型
    const retryableErrors = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED'
    ]

    return retryableErrors.some(code => error.message.includes(code))
  }

  private calculateDelay(
    retryCount: number,
    strategy: RetryStrategy,
    error?: Error
  ): number {
    switch (strategy) {
      case 'exponential':
        return this.exponentialBackoff(retryCount)

      case 'linear':
        return this.linearBackoff(retryCount)

      case 'fixed':
        return this.config.fixedDelay

      case 'adaptive':
        return this.adaptiveBackoff(retryCount, error)

      default:
        return this.exponentialBackoff(retryCount)
    }
  }

  private exponentialBackoff(retryCount: number): number {
    const baseDelay = this.config.baseDelay
    const maxDelay = this.config.maxDelay
    const jitter = Math.random() * 1000

    return Math.min(
      baseDelay * Math.pow(2, retryCount) + jitter,
      maxDelay
    )
  }

  private linearBackoff(retryCount: number): number {
    const baseDelay = this.config.baseDelay
    const maxDelay = this.config.maxDelay

    return Math.min(baseDelay * (retryCount + 1), maxDelay)
  }

  private adaptiveBackoff(retryCount: number, error?: Error): number {
    // 根据错误类型调整延迟
    if (error instanceof LLMRateLimitError && error.details?.retryAfter) {
      return error.details.retryAfter * 1000
    }

    return this.exponentialBackoff(retryCount)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  fixedDelay: number
  strategy: RetryStrategy
}

type RetryStrategy = 'exponential' | 'linear' | 'fixed' | 'adaptive'

interface RetryOptions {
  maxRetries?: number
  strategy?: RetryStrategy
}
```

**集成到LLM客户端**:
```typescript
// src/llm/client.ts (更新)
abstract class BaseLLMClient implements ILLMClient {
  protected retryManager: RetryManager

  async chat(request: LLMRequest): Promise<LLMResponse> {
    return this.retryManager.withRetry(
      () => this.chatInternal(request),
      { maxRetries: 3, strategy: 'exponential' }
    )
  }

  protected abstract chatInternal(request: LLMRequest): Promise<LLMResponse>
}
```

**验收标准**:
- [ ] 重试策略正确实现
- [ ] 退避算法准确
- [ ] 重试次数限制生效
- [ ] 日志记录完整

---

### TODO 7.3: 状态回滚机制
**优先级**: P1
**预期产出**: 状态快照和回滚功能

**状态快照管理**:
```typescript
// src/core/state-snapshot.ts
class StateSnapshotManager {
  private snapshots: Map<string, AgentState> = new Map()
  private logger: ILogger

  constructor(logger: ILogger) {
    this.logger = logger
  }

  // 创建快照
  createSnapshot(state: AgentState, label: string): string {
    const snapshotId = `${label}_${Date.now()}`

    // 深拷贝状态
    const snapshot = JSON.parse(JSON.stringify(state))

    this.snapshots.set(snapshotId, snapshot)

    this.logger.debug(`Snapshot created: ${snapshotId}`)

    return snapshotId
  }

  // 恢复快照
  restoreSnapshot(snapshotId: string): AgentState | null {
    const snapshot = this.snapshots.get(snapshotId)

    if (!snapshot) {
      this.logger.warn(`Snapshot not found: ${snapshotId}`)
      return null
    }

    this.logger.info(`Snapshot restored: ${snapshotId}`)

    return JSON.parse(JSON.stringify(snapshot))
  }

  // 删除快照
  deleteSnapshot(snapshotId: string): void {
    this.snapshots.delete(snapshotId)
  }

  // 清理旧快照
  cleanup(maxAge: number = 3600000): void {
    const now = Date.now()

    for (const [id, snapshot] of this.snapshots.entries()) {
      const age = now - snapshot.startTime

      if (age > maxAge) {
        this.snapshots.delete(id)
        this.logger.debug(`Snapshot cleaned up: ${id}`)
      }
    }
  }

  // 列出所有快照
  listSnapshots(): string[] {
    return Array.from(this.snapshots.keys())
  }
}
```

**集成到Agent**:
```typescript
// src/core/agent.ts (更新)
class Agent {
  private snapshotManager: StateSnapshotManager

  async run(userTask: string): Promise<void> {
    try {
      while (this.shouldContinue()) {
        // 在每个阶段开始前创建快照
        const snapshotId = this.snapshotManager.createSnapshot(
          this.stateManager.getState(),
          `iteration_${this.stateManager.getState().currentIteration}`
        )

        try {
          // 执行阶段
          await this.executePhase()

        } catch (error) {
          // 错误处理
          const result = await this.errorHandler.handle(error, this.getErrorContext())

          if (result.action === 'retry') {
            // 回滚到快照
            const restoredState = this.snapshotManager.restoreSnapshot(snapshotId)
            if (restoredState) {
              this.stateManager.setState(restoredState)
            }

            // 等待后重试
            await this.sleep(result.delay!)
            continue
          }

          if (result.action === 'fail') {
            throw error
          }
        }

        // 成功后删除快照
        this.snapshotManager.deleteSnapshot(snapshotId)
      }

    } finally {
      // 清理快照
      this.snapshotManager.cleanup()
    }
  }
}
```

**验收标准**:
- [ ] 快照创建正确
- [ ] 回滚功能正常
- [ ] 内存管理合理
- [ ] 清理机制生效

---

### TODO 7.4: 会话恢复功能
**优先级**: P1
**预期产出**: 会话持久化和恢复

**会话管理器**:
```typescript
// src/core/session-manager.ts
class SessionManager {
  private storage: ISessionStorage
  private logger: ILogger

  constructor(storage: ISessionStorage, logger: ILogger) {
    this.storage = storage
    this.logger = logger
  }

  // 保存会话
  async saveSession(state: AgentState, config: GlobalConfig): Promise<string> {
    const sessionId = `session_${Date.now()}`

    const sessionData: SessionData = {
      id: sessionId,
      state,
      config,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    await this.storage.save(sessionData)

    this.logger.info(`Session saved: ${sessionId}`)

    return sessionId
  }

  // 加载会话
  async loadSession(sessionId: string): Promise<SessionData | null> {
    const sessionData = await this.storage.load(sessionId)

    if (!sessionData) {
      this.logger.warn(`Session not found: ${sessionId}`)
      return null
    }

    this.logger.info(`Session loaded: ${sessionId}`)

    return sessionData
  }

  // 恢复Agent
  async resumeAgent(sessionId: string, logger: ILogger): Promise<Agent> {
    const sessionData = await this.loadSession(sessionId)

    if (!sessionData) {
      throw new Error(`Cannot resume session: ${sessionId}`)
    }

    // 创建Agent
    const agent = new Agent(sessionData.config, logger)

    // 恢复状态
    ;(agent as any).stateManager.setState(sessionData.state)

    this.logger.info(`Agent resumed from session: ${sessionId}`)

    return agent
  }

  // 列出所有会话
  async listSessions(): Promise<SessionData[]> {
    return this.storage.list()
  }

  // 删除会话
  async deleteSession(sessionId: string): Promise<void> {
    await this.storage.delete(sessionId)
    this.logger.info(`Session deleted: ${sessionId}`)
  }

  // 自动保存
  startAutoSave(agent: Agent, interval: number = 60000): NodeJS.Timer {
    return setInterval(async () => {
      try {
        const state = (agent as any).stateManager.getState()
        const config = (agent as any).config

        await this.saveSession(state, config)

        this.logger.debug('Auto-save completed')
      } catch (error) {
        this.logger.error('Auto-save failed', error)
      }
    }, interval)
  }
}
```

**CLI集成**:
```typescript
// src/cli/commands.ts (更新)
async function runCommand(task: string, options: any): Promise<void> {
  let agent: Agent

  if (options.resume) {
    // 恢复会话
    const sessionManager = new SessionManager(
      new FileSessionStorage(config.storage.sessionDir),
      logger
    )

    agent = await sessionManager.resumeAgent(options.resume, logger)

    console.log(chalk.green(`✅ Session resumed: ${options.resume}`))

  } else {
    // 创建新Agent
    agent = new Agent(config, logger)
  }

  // 启动自动保存
  if (config.agent.autoSave) {
    const sessionManager = new SessionManager(
      new FileSessionStorage(config.storage.sessionDir),
      logger
    )

    const autoSaveTimer = sessionManager.startAutoSave(
      agent,
      config.agent.saveInterval
    )

    // 清理
    process.on('exit', () => clearInterval(autoSaveTimer))
  }

  await agent.run(task)
}
```

**验收标准**:
- [ ] 会话保存完整
- [ ] 恢复功能正常
- [ ] 自动保存生效
- [ ] 会话管理命令可用

---

### TODO 7.5: 优雅降级和容错
**优先级**: P2
**预期产出**: 降级策略和容错机制

**降级管理器**:
```typescript
// src/core/fallback-manager.ts
class FallbackManager {
  private logger: ILogger

  constructor(logger: ILogger) {
    this.logger = logger
  }

  // LLM降级
  async fallbackLLM(
    primaryClient: ILLMClient,
    fallbackClient: ILLMClient,
    request: LLMRequest
  ): Promise<LLMResponse> {
    try {
      return await primaryClient.chat(request)
    } catch (error) {
      this.logger.warn('Primary LLM failed, using fallback', { error: error.message })

      try {
        return await fallbackClient.chat(request)
      } catch (fallbackError) {
        this.logger.error('Fallback LLM also failed', fallbackError)
        throw fallbackError
      }
    }
  }

  // 工具降级
  async fallbackTool(
    primaryTool: BaseTool,
    fallbackTool: BaseTool,
    args: Record<string, any>
  ): Promise<ToolResult> {
    try {
      return await primaryTool.execute(args)
    } catch (error) {
      this.logger.warn(
        `Primary tool '${primaryTool.name}' failed, using fallback '${fallbackTool.name}'`,
        { error: error.message }
      )

      return await fallbackTool.execute(args)
    }
  }

  // 部分失败容错
  async toleratePartialFailure<T>(
    operations: Array<() => Promise<T>>,
    minSuccessRate: number = 0.5
  ): Promise<T[]> {
    const results = await Promise.allSettled(operations.map(op => op()))

    const successful = results.filter(r => r.status === 'fulfilled')
    const successRate = successful.length / results.length

    if (successRate < minSuccessRate) {
      throw new Error(
        `Too many failures: ${successful.length}/${results.length} succeeded`
      )
    }

    this.logger.info(
      `Partial failure tolerated: ${successful.length}/${results.length} succeeded`
    )

    return successful.map(r => (r as PromiseFulfilledResult<T>).value)
  }
}
```

**验收标准**:
- [ ] LLM降级正常
- [ ] 工具降级正常
- [ ] 部分失败容错生效
- [ ] 降级日志完整

---

## 依赖关系
- 依赖 TODO-01（日志系统）
- 依赖 TODO-02（LLM客户端）
- 依赖 TODO-04（Agent核心）
- TODO 7.1 是其他TODO的基础

## 风险与缓解
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 重试导致成本增加 | 中 | 限制重试次数和策略 |
| 状态回滚不完整 | 高 | 完整的状态快照 |
| 会话恢复失败 | 中 | 验证机制+降级方案 |
| 降级策略不当 | 中 | 充分测试降级路径 |

## 完成标准
- [ ] 所有5个内部TODO完成
- [ ] 错误处理覆盖所有场景
- [ ] 重试机制稳定
- [ ] 会话恢复测试通过
