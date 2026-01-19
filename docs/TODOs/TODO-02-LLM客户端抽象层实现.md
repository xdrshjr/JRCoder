# TODO-02: LLM客户端抽象层实现

## 目标
实现统一的LLM客户端接口，支持OpenAI、Anthropic和Ollama三种Provider，提供Function Calling标准化封装。

## 内部TODO列表

### TODO 2.1: LLM客户端基类设计
**优先级**: P0
**预期产出**: 抽象基类和类型定义

**核心接口**:
```typescript
// src/llm/types.ts
interface LLMRequest {
  messages: Message[]
  tools?: ToolDefinition[]
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
}

interface LLMResponse {
  content: string
  toolCalls?: ToolCall[]
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error'
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// src/llm/client.ts
abstract class BaseLLMClient implements ILLMClient {
  protected config: LLMConfig
  protected logger: ILogger

  constructor(config: LLMConfig, logger: ILogger) {
    this.config = config
    this.logger = logger
  }

  // 子类必须实现
  abstract chat(request: LLMRequest): Promise<LLMResponse>
  abstract chatStream(request: LLMRequest): AsyncGenerator<string>

  // 通用方法
  estimateCost(tokens: number): number {
    const pricing = this.getPricing()
    return (tokens / 1000) * pricing.perThousandTokens
  }

  protected abstract getPricing(): PricingInfo

  // 重试逻辑（通用）
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        if (i === maxRetries - 1) throw error
        await sleep(Math.pow(2, i) * 1000)
      }
    }
  }
}
```

**验收标准**:
- [ ] 接口定义完整且类型安全
- [ ] 基类提供通用功能（重试、成本估算）
- [ ] 支持流式和非流式两种模式
- [ ] 错误处理统一

---

### TODO 2.2: OpenAI客户端实现
**优先级**: P0
**预期产出**: 完整的OpenAI适配器

**实现要点**:
```typescript
// src/llm/openai.ts
class OpenAIClient extends BaseLLMClient {
  private client: OpenAI

  constructor(config: LLMConfig, logger: ILogger) {
    super(config, logger)
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout
    })
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    this.logger.logLLMRequest(request)

    const response = await this.withRetry(() =>
      this.client.chat.completions.create({
        model: this.config.model,
        messages: this.convertMessages(request.messages),
        tools: this.convertTools(request.tools),
        temperature: request.temperature ?? this.config.temperature,
        max_tokens: request.maxTokens ?? this.config.maxTokens,
        top_p: request.topP
      })
    )

    const result = this.parseResponse(response)
    this.logger.logLLMResponse(result)

    return result
  }

  async *chatStream(request: LLMRequest): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      ...this.buildParams(request),
      stream: true
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) yield content
    }
  }

  private convertMessages(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
    return messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: msg.toolCallId,
          content: msg.content
        }
      }
      return {
        role: msg.role,
        content: msg.content
      }
    })
  }

  private convertTools(tools?: ToolDefinition[]): OpenAI.ChatCompletionTool[] {
    if (!tools) return []
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }))
  }

  protected getPricing(): PricingInfo {
    const pricing = {
      'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }
    }
    return pricing[this.config.model] || pricing['gpt-3.5-turbo']
  }
}
```

**验收标准**:
- [ ] 支持GPT-4和GPT-3.5模型
- [ ] Function Calling正确转换
- [ ] 流式输出正常工作
- [ ] 错误码正确映射

---

### TODO 2.3: Anthropic客户端实现
**优先级**: P0
**预期产出**: Claude模型适配器

**实现要点**:
```typescript
// src/llm/anthropic.ts
class AnthropicClient extends BaseLLMClient {
  private client: Anthropic

  constructor(config: LLMConfig, logger: ILogger) {
    super(config, logger)
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    })
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    // Anthropic的消息格式转换
    const { system, messages } = this.extractSystemMessage(request.messages)

    const response = await this.withRetry(() =>
      this.client.messages.create({
        model: this.config.model,
        system: system,
        messages: messages,
        tools: this.convertTools(request.tools),
        temperature: request.temperature,
        max_tokens: request.maxTokens ?? 4096
      })
    )

    return this.parseResponse(response)
  }

  private extractSystemMessage(messages: Message[]): {
    system?: string
    messages: Anthropic.MessageParam[]
  } {
    const systemMsg = messages.find(m => m.role === 'system')
    const otherMsgs = messages.filter(m => m.role !== 'system')

    return {
      system: systemMsg?.content,
      messages: otherMsgs.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    }
  }

  private parseResponse(response: Anthropic.Message): LLMResponse {
    const toolCalls: ToolCall[] = []
    let content = ''

    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input
        })
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: this.mapStopReason(response.stop_reason),
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      }
    }
  }

  protected getPricing(): PricingInfo {
    return {
      'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
      'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 }
    }[this.config.model]
  }
}
```

**验收标准**:
- [ ] 支持Claude 3系列模型
- [ ] System message正确处理
- [ ] Tool use正确解析
- [ ] Token计数准确

---

### TODO 2.4: Ollama本地模型支持
**优先级**: P1
**预期产出**: 本地模型适配器

**实现要点**:
```typescript
// src/llm/ollama.ts
class OllamaClient extends BaseLLMClient {
  private baseURL: string

  constructor(config: LLMConfig, logger: ILogger) {
    super(config, logger)
    this.baseURL = config.baseURL || 'http://localhost:11434'
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    // Ollama使用OpenAI兼容API
    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages: request.messages,
        tools: request.tools,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: false
      })
    })

    if (!response.ok) {
      throw new LLMError(`Ollama request failed: ${response.statusText}`)
    }

    const data = await response.json()
    return this.parseOpenAIResponse(data)
  }

  async *chatStream(request: LLMRequest): AsyncGenerator<string> {
    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...this.buildParams(request),
        stream: true
      })
    })

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(l => l.trim())

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6))
          const content = data.choices[0]?.delta?.content
          if (content) yield content
        }
      }
    }
  }

  protected getPricing(): PricingInfo {
    // 本地模型无成本
    return { input: 0, output: 0 }
  }
}
```

**验收标准**:
- [ ] 支持Llama、CodeLlama等模型
- [ ] 连接本地Ollama服务
- [ ] 流式输出正常
- [ ] 错误处理完善

---

### TODO 2.5: LLM客户端工厂和管理
**优先级**: P0
**预期产出**: 客户端创建工厂和多实例管理

**工厂模式**:
```typescript
// src/llm/factory.ts
class LLMClientFactory {
  static create(config: LLMConfig, logger: ILogger): ILLMClient {
    switch (config.provider) {
      case 'openai':
        return new OpenAIClient(config, logger)
      case 'anthropic':
        return new AnthropicClient(config, logger)
      case 'ollama':
        return new OllamaClient(config, logger)
      default:
        throw new ConfigError(`Unsupported LLM provider: ${config.provider}`)
    }
  }
}

// src/llm/manager.ts
class LLMManager {
  private clients: Map<string, ILLMClient> = new Map()

  constructor(
    private config: GlobalConfig,
    private logger: ILogger
  ) {
    this.initializeClients()
  }

  private initializeClients(): void {
    // 为每个角色创建客户端
    this.clients.set('planner',
      LLMClientFactory.create(this.config.llm.planner, this.logger)
    )
    this.clients.set('executor',
      LLMClientFactory.create(this.config.llm.executor, this.logger)
    )
    this.clients.set('reflector',
      LLMClientFactory.create(this.config.llm.reflector, this.logger)
    )
  }

  getClient(role: 'planner' | 'executor' | 'reflector'): ILLMClient {
    const client = this.clients.get(role)
    if (!client) {
      throw new Error(`LLM client for role '${role}' not found`)
    }
    return client
  }

  // 统计所有客户端的Token使用
  getTotalUsage(): UsageStats {
    // 实现统计逻辑
  }
}
```

**验收标准**:
- [ ] 工厂模式正确创建客户端
- [ ] 支持多角色多实例
- [ ] Token使用统计准确
- [ ] 客户端可热切换

---

## 依赖关系
- 依赖 TODO-01（配置系统、日志系统）
- TODO 2.1 是其他TODO的基础
- TODO 2.5 依赖 TODO 2.2-2.4

## 风险与缓解
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| API变更 | 高 | 版本锁定+适配层 |
| 速率限制 | 中 | 实现指数退避重试 |
| 成本超支 | 中 | Token计数+预算告警 |
| 本地模型不稳定 | 低 | 降级到云端模型 |

## 完成标准
- [ ] 所有5个内部TODO完成
- [ ] 三种Provider全部测试通过
- [ ] Function Calling兼容性测试通过
- [ ] 性能测试：单次调用<5s
