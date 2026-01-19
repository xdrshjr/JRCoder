# TODO-08: 性能优化与监控

## 目标
优化系统性能，实现监控指标收集、性能分析、资源管理和成本控制，确保系统高效运行。

## 内部TODO列表

### TODO 8.1: 性能监控指标收集
**优先级**: P0
**预期产出**: 完整的性能指标收集系统

**指标收集器**:
```typescript
// src/monitoring/metrics-collector.ts
interface Metrics {
  // 执行指标
  execution: {
    totalTasks: number
    completedTasks: number
    failedTasks: number
    averageTaskDuration: number
    totalDuration: number
  }

  // LLM指标
  llm: {
    totalCalls: number
    totalTokens: number
    promptTokens: number
    completionTokens: number
    totalCost: number
    averageLatency: number
    errorRate: number
  }

  // 工具指标
  tools: {
    totalCalls: number
    callsByTool: Record<string, number>
    averageExecutionTime: Record<string, number>
    errorsByTool: Record<string, number>
  }

  // 系统指标
  system: {
    memoryUsage: number
    cpuUsage: number
    activeConnections: number
  }
}

class MetricsCollector {
  private metrics: Metrics
  private startTime: number
  private logger: ILogger

  constructor(logger: ILogger) {
    this.logger = logger
    this.startTime = Date.now()
    this.metrics = this.initializeMetrics()
  }

  private initializeMetrics(): Metrics {
    return {
      execution: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageTaskDuration: 0,
        totalDuration: 0
      },
      llm: {
        totalCalls: 0,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalCost: 0,
        averageLatency: 0,
        errorRate: 0
      },
      tools: {
        totalCalls: 0,
        callsByTool: {},
        averageExecutionTime: {},
        errorsByTool: {}
      },
      system: {
        memoryUsage: 0,
        cpuUsage: 0,
        activeConnections: 0
      }
    }
  }

  // 记录LLM调用
  recordLLMCall(response: LLMResponse, latency: number, cost: number): void {
    this.metrics.llm.totalCalls++
    this.metrics.llm.totalTokens += response.usage.totalTokens
    this.metrics.llm.promptTokens += response.usage.promptTokens
    this.metrics.llm.completionTokens += response.usage.completionTokens
    this.metrics.llm.totalCost += cost

    // 更新平均延迟
    this.metrics.llm.averageLatency =
      (this.metrics.llm.averageLatency * (this.metrics.llm.totalCalls - 1) + latency) /
      this.metrics.llm.totalCalls
  }

  // 记录LLM错误
  recordLLMError(): void {
    this.metrics.llm.errorRate =
      (this.metrics.llm.errorRate * this.metrics.llm.totalCalls + 1) /
      (this.metrics.llm.totalCalls + 1)
  }

  // 记录工具调用
  recordToolCall(toolName: string, executionTime: number, success: boolean): void {
    this.metrics.tools.totalCalls++

    // 按工具统计
    this.metrics.tools.callsByTool[toolName] =
      (this.metrics.tools.callsByTool[toolName] || 0) + 1

    // 更新平均执行时间
    const prevAvg = this.metrics.tools.averageExecutionTime[toolName] || 0
    const prevCount = this.metrics.tools.callsByTool[toolName] - 1

    this.metrics.tools.averageExecutionTime[toolName] =
      (prevAvg * prevCount + executionTime) / this.metrics.tools.callsByTool[toolName]

    // 记录错误
    if (!success) {
      this.metrics.tools.errorsByTool[toolName] =
        (this.metrics.tools.errorsByTool[toolName] || 0) + 1
    }
  }

  // 记录任务完成
  recordTaskCompletion(taskId: string, duration: number, success: boolean): void {
    this.metrics.execution.totalTasks++

    if (success) {
      this.metrics.execution.completedTasks++
    } else {
      this.metrics.execution.failedTasks++
    }

    // 更新平均任务时长
    this.metrics.execution.averageTaskDuration =
      (this.metrics.execution.averageTaskDuration * (this.metrics.execution.totalTasks - 1) + duration) /
      this.metrics.execution.totalTasks
  }

  // 更新系统指标
  updateSystemMetrics(): void {
    const memUsage = process.memoryUsage()
    this.metrics.system.memoryUsage = memUsage.heapUsed

    // CPU使用率（简化版）
    const cpuUsage = process.cpuUsage()
    this.metrics.system.cpuUsage =
      (cpuUsage.user + cpuUsage.system) / 1000000 // 转换为秒
  }

  // 获取指标
  getMetrics(): Metrics {
    this.metrics.execution.totalDuration = Date.now() - this.startTime
    this.updateSystemMetrics()
    return { ...this.metrics }
  }

  // 生成报告
  generateReport(): string {
    const metrics = this.getMetrics()

    return `
Performance Metrics Report
==========================

Execution:
- Total Tasks: ${metrics.execution.totalTasks}
- Completed: ${metrics.execution.completedTasks}
- Failed: ${metrics.execution.failedTasks}
- Success Rate: ${(metrics.execution.completedTasks / metrics.execution.totalTasks * 100).toFixed(2)}%
- Average Task Duration: ${metrics.execution.averageTaskDuration.toFixed(2)}ms
- Total Duration: ${(metrics.execution.totalDuration / 1000).toFixed(2)}s

LLM:
- Total Calls: ${metrics.llm.totalCalls}
- Total Tokens: ${metrics.llm.totalTokens}
- Total Cost: $${metrics.llm.totalCost.toFixed(4)}
- Average Latency: ${metrics.llm.averageLatency.toFixed(2)}ms
- Error Rate: ${(metrics.llm.errorRate * 100).toFixed(2)}%

Tools:
- Total Calls: ${metrics.tools.totalCalls}
- Most Used: ${this.getMostUsedTool(metrics.tools.callsByTool)}
- Average Execution Time: ${this.getAverageToolTime(metrics.tools.averageExecutionTime)}ms

System:
- Memory Usage: ${(metrics.system.memoryUsage / 1024 / 1024).toFixed(2)} MB
- CPU Usage: ${metrics.system.cpuUsage.toFixed(2)}s
    `.trim()
  }

  private getMostUsedTool(callsByTool: Record<string, number>): string {
    const entries = Object.entries(callsByTool)
    if (entries.length === 0) return 'N/A'

    const [tool, count] = entries.reduce((max, curr) =>
      curr[1] > max[1] ? curr : max
    )

    return `${tool} (${count} calls)`
  }

  private getAverageToolTime(avgTimes: Record<string, number>): number {
    const times = Object.values(avgTimes)
    if (times.length === 0) return 0

    return times.reduce((sum, time) => sum + time, 0) / times.length
  }

  // 导出指标（Prometheus格式）
  exportPrometheus(): string {
    const metrics = this.getMetrics()

    return `
# HELP agent_tasks_total Total number of tasks
# TYPE agent_tasks_total counter
agent_tasks_total ${metrics.execution.totalTasks}

# HELP agent_tasks_completed Number of completed tasks
# TYPE agent_tasks_completed counter
agent_tasks_completed ${metrics.execution.completedTasks}

# HELP agent_llm_calls_total Total LLM calls
# TYPE agent_llm_calls_total counter
agent_llm_calls_total ${metrics.llm.totalCalls}

# HELP agent_llm_tokens_total Total tokens used
# TYPE agent_llm_tokens_total counter
agent_llm_tokens_total ${metrics.llm.totalTokens}

# HELP agent_llm_cost_total Total cost in USD
# TYPE agent_llm_cost_total counter
agent_llm_cost_total ${metrics.llm.totalCost}

# HELP agent_tool_calls_total Total tool calls
# TYPE agent_tool_calls_total counter
agent_tool_calls_total ${metrics.tools.totalCalls}
    `.trim()
  }
}
```

**集成到Agent**:
```typescript
// src/core/agent.ts (更新)
class Agent {
  private metricsCollector: MetricsCollector

  constructor(config: GlobalConfig, logger: ILogger) {
    // ...
    this.metricsCollector = new MetricsCollector(logger)
  }

  async run(userTask: string): Promise<void> {
    try {
      // ... 执行逻辑

    } finally {
      // 输出性能报告
      const report = this.metricsCollector.generateReport()
      this.logger.info('Performance Report:\n' + report)

      // 保存指标
      await this.saveMetrics()
    }
  }

  private async saveMetrics(): Promise<void> {
    const metrics = this.metricsCollector.getMetrics()
    const filePath = `logs/metrics-${Date.now()}.json`

    await fs.writeFile(filePath, JSON.stringify(metrics, null, 2))
  }
}
```

**验收标准**:
- [ ] 所有关键指标被收集
- [ ] 指标计算准确
- [ ] 报告格式清晰
- [ ] Prometheus格式正确

---

### TODO 8.2: LLM调用优化
**优先级**: P0
**预期产出**: Token优化和缓存机制

**Token优化器**:
```typescript
// src/llm/token-optimizer.ts
class TokenOptimizer {
  private logger: ILogger

  constructor(logger: ILogger) {
    this.logger = logger
  }

  // 压缩消息历史
  compressMessages(messages: Message[], maxTokens: number): Message[] {
    // 估算Token数
    let totalTokens = this.estimateTokens(messages)

    if (totalTokens <= maxTokens) {
      return messages
    }

    this.logger.info(`Compressing messages: ${totalTokens} -> ${maxTokens} tokens`)

    // 保留系统消息和最近的消息
    const systemMessages = messages.filter(m => m.role === 'system')
    const otherMessages = messages.filter(m => m.role !== 'system')

    // 从最新消息开始保留
    const compressed: Message[] = [...systemMessages]
    let currentTokens = this.estimateTokens(systemMessages)

    for (let i = otherMessages.length - 1; i >= 0; i--) {
      const msg = otherMessages[i]
      const msgTokens = this.estimateTokens([msg])

      if (currentTokens + msgTokens <= maxTokens) {
        compressed.push(msg)
        currentTokens += msgTokens
      } else {
        break
      }
    }

    // 按时间排序
    return compressed.sort((a, b) => a.timestamp - b.timestamp)
  }

  // 估算Token数（简化版）
  private estimateTokens(messages: Message[]): number {
    // 粗略估算：1 token ≈ 4 字符
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0)
    return Math.ceil(totalChars / 4)
  }

  // 优化提示词
  optimizePrompt(prompt: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokens([{
      role: 'user',
      content: prompt,
      timestamp: Date.now()
    }])

    if (estimatedTokens <= maxTokens) {
      return prompt
    }

    // 截断提示词
    const ratio = maxTokens / estimatedTokens
    const targetLength = Math.floor(prompt.length * ratio)

    return prompt.substring(0, targetLength) + '...'
  }
}
```

**响应缓存**:
```typescript
// src/llm/response-cache.ts
class LLMResponseCache {
  private cache: Map<string, CacheEntry> = new Map()
  private maxSize: number
  private ttl: number

  constructor(maxSize: number = 100, ttl: number = 3600000) {
    this.maxSize = maxSize
    this.ttl = ttl
  }

  // 生成缓存键
  private generateKey(request: LLMRequest): string {
    const key = {
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      temperature: request.temperature,
      maxTokens: request.maxTokens
    }

    return crypto.createHash('md5').update(JSON.stringify(key)).digest('hex')
  }

  // 获取缓存
  get(request: LLMRequest): LLMResponse | null {
    const key = this.generateKey(request)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.response
  }

  // 设置缓存
  set(request: LLMRequest, response: LLMResponse): void {
    const key = this.generateKey(request)

    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now()
    })
  }

  // 清空缓存
  clear(): void {
    this.cache.clear()
  }

  // 获取缓存统计
  getStats(): CacheStats {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0 // 需要额外跟踪
    }
  }
}

interface CacheEntry {
  response: LLMResponse
  timestamp: number
}

interface CacheStats {
  size: number
  maxSize: number
  hitRate: number
}
```

**集成缓存**:
```typescript
// src/llm/client.ts (更新)
abstract class BaseLLMClient implements ILLMClient {
  protected cache: LLMResponseCache
  protected tokenOptimizer: TokenOptimizer

  async chat(request: LLMRequest): Promise<LLMResponse> {
    // 尝试从缓存获取
    const cached = this.cache.get(request)
    if (cached) {
      this.logger.debug('Cache hit')
      return cached
    }

    // 优化Token
    const optimizedRequest = {
      ...request,
      messages: this.tokenOptimizer.compressMessages(
        request.messages,
        this.config.maxTokens * 0.8 // 留20%给响应
      )
    }

    // 调用API
    const response = await this.chatInternal(optimizedRequest)

    // 缓存响应
    this.cache.set(request, response)

    return response
  }
}
```

**验收标准**:
- [ ] Token压缩正确
- [ ] 缓存命中率>30%
- [ ] 成本降低>20%
- [ ] 响应质量不下降

---

### TODO 8.3: 并发控制和资源管理
**优先级**: P1
**预期产出**: 并发限制和资源池管理

**并发控制器**:
```typescript
// src/core/concurrency-controller.ts
class ConcurrencyController {
  private maxConcurrent: number
  private currentRunning: number = 0
  private queue: Array<() => Promise<any>> = []
  private logger: ILogger

  constructor(maxConcurrent: number, logger: ILogger) {
    this.maxConcurrent = maxConcurrent
    this.logger = logger
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // 如果达到并发限制，加入队列
    if (this.currentRunning >= this.maxConcurrent) {
      await this.enqueue(operation)
    }

    this.currentRunning++

    try {
      return await operation()
    } finally {
      this.currentRunning--
      this.processQueue()
    }
  }

  private enqueue(operation: () => Promise<any>): Promise<void> {
    return new Promise(resolve => {
      this.queue.push(async () => {
        await operation()
        resolve()
      })
    })
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.currentRunning < this.maxConcurrent) {
      const next = this.queue.shift()
      if (next) {
        next()
      }
    }
  }

  getStats(): ConcurrencyStats {
    return {
      currentRunning: this.currentRunning,
      queueLength: this.queue.length,
      maxConcurrent: this.maxConcurrent
    }
  }
}

interface ConcurrencyStats {
  currentRunning: number
  queueLength: number
  maxConcurrent: number
}
```

**资源池管理**:
```typescript
// src/core/resource-pool.ts
class ResourcePool<T> {
  private resources: T[] = []
  private available: T[] = []
  private inUse: Set<T> = new Set()
  private waitQueue: Array<(resource: T) => void> = []

  constructor(
    private factory: () => T,
    private maxSize: number
  ) {}

  async acquire(): Promise<T> {
    // 如果有可用资源，直接返回
    if (this.available.length > 0) {
      const resource = this.available.pop()!
      this.inUse.add(resource)
      return resource
    }

    // 如果未达到最大数量，创建新资源
    if (this.resources.length < this.maxSize) {
      const resource = this.factory()
      this.resources.push(resource)
      this.inUse.add(resource)
      return resource
    }

    // 等待资源释放
    return new Promise(resolve => {
      this.waitQueue.push(resolve)
    })
  }

  release(resource: T): void {
    this.inUse.delete(resource)

    // 如果有等待者，直接分配
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift()!
      this.inUse.add(resource)
      waiter(resource)
    } else {
      this.available.push(resource)
    }
  }

  async withResource<R>(fn: (resource: T) => Promise<R>): Promise<R> {
    const resource = await this.acquire()

    try {
      return await fn(resource)
    } finally {
      this.release(resource)
    }
  }

  getStats(): PoolStats {
    return {
      total: this.resources.length,
      available: this.available.length,
      inUse: this.inUse.size,
      waiting: this.waitQueue.length
    }
  }
}

interface PoolStats {
  total: number
  available: number
  inUse: number
  waiting: number
}
```

**验收标准**:
- [ ] 并发限制生效
- [ ] 资源池管理正确
- [ ] 无资源泄漏
- [ ] 性能提升明显

---

### TODO 8.4: 成本控制和预算管理
**优先级**: P1
**预期产出**: 成本跟踪和预算告警

**成本管理器**:
```typescript
// src/monitoring/cost-manager.ts
class CostManager {
  private totalCost: number = 0
  private costByModel: Map<string, number> = new Map()
  private budget: number
  private logger: ILogger

  constructor(budget: number, logger: ILogger) {
    this.budget = budget
    this.logger = logger
  }

  // 记录成本
  recordCost(model: string, tokens: number, pricing: PricingInfo): number {
    const cost = this.calculateCost(tokens, pricing)

    this.totalCost += cost

    const modelCost = this.costByModel.get(model) || 0
    this.costByModel.set(model, modelCost + cost)

    // 检查预算
    this.checkBudget()

    return cost
  }

  private calculateCost(tokens: number, pricing: PricingInfo): number {
    // 简化计算，实际应区分input/output tokens
    return (tokens / 1000) * pricing.perThousandTokens
  }

  private checkBudget(): void {
    const remaining = this.budget - this.totalCost
    const usagePercent = (this.totalCost / this.budget) * 100

    if (usagePercent >= 90) {
      this.logger.warn(
        `Budget alert: ${usagePercent.toFixed(2)}% used ($${this.totalCost.toFixed(4)}/$${this.budget})`
      )
    }

    if (this.totalCost >= this.budget) {
      throw new BudgetExceededError(
        `Budget exceeded: $${this.totalCost.toFixed(4)} / $${this.budget}`
      )
    }
  }

  // 获取成本报告
  getCostReport(): CostReport {
    return {
      totalCost: this.totalCost,
      budget: this.budget,
      remaining: this.budget - this.totalCost,
      usagePercent: (this.totalCost / this.budget) * 100,
      costByModel: Object.fromEntries(this.costByModel)
    }
  }

  // 预测成本
  predictCost(estimatedTokens: number, model: string): number {
    // 基于历史数据预测
    const avgCostPerToken = this.totalCost / this.getTotalTokens()
    return estimatedTokens * avgCostPerToken
  }

  private getTotalTokens(): number {
    // 需要从MetricsCollector获取
    return 0
  }
}

interface CostReport {
  totalCost: number
  budget: number
  remaining: number
  usagePercent: number
  costByModel: Record<string, number>
}

class BudgetExceededError extends AgentError {
  constructor(message: string) {
    super(message, ErrorCode.BUDGET_EXCEEDED, ErrorCategory.CRITICAL)
  }
}
```

**验收标准**:
- [ ] 成本跟踪准确
- [ ] 预算告警及时
- [ ] 成本预测合理
- [ ] 超预算保护生效

---

### TODO 8.5: 性能分析和优化建议
**优先级**: P2
**预期产出**: 性能分析工具和优化建议

**性能分析器**:
```typescript
// src/monitoring/performance-analyzer.ts
class PerformanceAnalyzer {
  private metrics: Metrics
  private logger: ILogger

  constructor(metrics: Metrics, logger: ILogger) {
    this.metrics = metrics
    this.logger = logger
  }

  // 分析性能瓶颈
  analyzeBottlenecks(): PerformanceIssue[] {
    const issues: PerformanceIssue[] = []

    // 检查LLM延迟
    if (this.metrics.llm.averageLatency > 5000) {
      issues.push({
        type: 'high_llm_latency',
        severity: 'high',
        description: `Average LLM latency is ${this.metrics.llm.averageLatency.toFixed(0)}ms`,
        suggestion: 'Consider using a faster model or reducing prompt size'
      })
    }

    // 检查工具执行时间
    for (const [tool, avgTime] of Object.entries(this.metrics.tools.averageExecutionTime)) {
      if (avgTime > 3000) {
        issues.push({
          type: 'slow_tool',
          severity: 'medium',
          description: `Tool '${tool}' average execution time is ${avgTime.toFixed(0)}ms`,
          suggestion: `Optimize '${tool}' implementation or use caching`
        })
      }
    }

    // 检查错误率
    if (this.metrics.llm.errorRate > 0.1) {
      issues.push({
        type: 'high_error_rate',
        severity: 'high',
        description: `LLM error rate is ${(this.metrics.llm.errorRate * 100).toFixed(2)}%`,
        suggestion: 'Check API configuration and network stability'
      })
    }

    // 检查内存使用
    const memoryMB = this.metrics.system.memoryUsage / 1024 / 1024
    if (memoryMB > 500) {
      issues.push({
        type: 'high_memory_usage',
        severity: 'medium',
        description: `Memory usage is ${memoryMB.toFixed(2)} MB`,
        suggestion: 'Check for memory leaks or reduce conversation history'
      })
    }

    return issues
  }

  // 生成优化建议
  generateOptimizationSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = []

    // Token优化建议
    const avgTokensPerCall = this.metrics.llm.totalTokens / this.metrics.llm.totalCalls
    if (avgTokensPerCall > 3000) {
      suggestions.push({
        category: 'token_optimization',
        priority: 'high',
        suggestion: 'Reduce prompt size or compress conversation history',
        expectedImpact: 'Cost reduction: 20-30%'
      })
    }

    // 缓存建议
    if (this.metrics.llm.totalCalls > 50) {
      suggestions.push({
        category: 'caching',
        priority: 'medium',
        suggestion: 'Enable response caching for repeated queries',
        expectedImpact: 'Latency reduction: 50-70%'
      })
    }

    // 并发建议
    if (this.metrics.tools.totalCalls > 20) {
      suggestions.push({
        category: 'concurrency',
        priority: 'medium',
        suggestion: 'Enable parallel tool execution for independent operations',
        expectedImpact: 'Execution time reduction: 30-40%'
      })
    }

    return suggestions
  }

  // 生成性能报告
  generatePerformanceReport(): string {
    const issues = this.analyzeBottlenecks()
    const suggestions = this.generateOptimizationSuggestions()

    let report = 'Performance Analysis Report\n'
    report += '===========================\n\n'

    if (issues.length > 0) {
      report += 'Performance Issues:\n'
      issues.forEach((issue, i) => {
        report += `${i + 1}. [${issue.severity.toUpperCase()}] ${issue.description}\n`
        report += `   Suggestion: ${issue.suggestion}\n\n`
      })
    } else {
      report += 'No performance issues detected.\n\n'
    }

    if (suggestions.length > 0) {
      report += 'Optimization Suggestions:\n'
      suggestions.forEach((suggestion, i) => {
        report += `${i + 1}. [${suggestion.priority.toUpperCase()}] ${suggestion.suggestion}\n`
        report += `   Expected Impact: ${suggestion.expectedImpact}\n\n`
      })
    }

    return report
  }
}

interface PerformanceIssue {
  type: string
  severity: 'low' | 'medium' | 'high'
  description: string
  suggestion: string
}

interface OptimizationSuggestion {
  category: string
  priority: 'low' | 'medium' | 'high'
  suggestion: string
  expectedImpact: string
}
```

**验收标准**:
- [ ] 瓶颈识别准确
- [ ] 优化建议可行
- [ ] 报告清晰易懂
- [ ] 预期影响合理

---

## 依赖关系
- 依赖 TODO-01（日志系统）
- 依赖 TODO-02（LLM客户端）
- 依赖 TODO-04（Agent核心）
- TODO 8.1 是其他TODO的基础

## 风险与缓解
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 监控开销过大 | 中 | 异步收集+采样 |
| 缓存失效策略不当 | 中 | 合理的TTL设置 |
| 并发控制过严 | 低 | 可配置的并发数 |
| 成本预测不准 | 中 | 基于历史数据优化 |

## 完成标准
- [ ] 所有5个内部TODO完成
- [ ] 性能提升>30%
- [ ] 成本降低>20%
- [ ] 监控指标完整
