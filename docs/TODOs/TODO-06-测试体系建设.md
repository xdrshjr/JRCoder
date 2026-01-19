# TODO-06: 测试体系建设

## 目标
建立完整的测试体系，包括单元测试、集成测试、端到端测试，确保代码质量和系统稳定性。

## 内部TODO列表

### TODO 6.1: 测试框架搭建
**优先级**: P0
**预期产出**: Jest测试框架配置和测试工具

**核心配置**:
```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
}
```

**测试工具类**:
```typescript
// tests/utils/test-helpers.ts
class TestHelpers {
  // 创建Mock LLM客户端
  static createMockLLMClient(responses: LLMResponse[]): ILLMClient {
    let callCount = 0

    return {
      chat: jest.fn(async () => {
        const response = responses[callCount] || responses[responses.length - 1]
        callCount++
        return response
      }),
      chatStream: jest.fn(async function* () {
        yield 'mock stream'
      }),
      estimateCost: jest.fn(() => 0.01)
    }
  }

  // 创建Mock工具
  static createMockTool(name: string, result: ToolResult): BaseTool {
    return {
      name,
      description: `Mock tool: ${name}`,
      parameters: [],
      dangerous: false,
      execute: jest.fn(async () => result),
      validate: jest.fn(() => ({ valid: true, errors: [] })),
      getDefinition: jest.fn(() => ({
        name,
        description: `Mock tool: ${name}`,
        parameters: {}
      }))
    } as any
  }

  // 创建测试配置
  static createTestConfig(overrides?: Partial<GlobalConfig>): GlobalConfig {
    return {
      agent: {
        maxIterations: 5,
        enableReflection: true,
        requireConfirmation: false,
        autoSave: false,
        saveInterval: 60000
      },
      llm: {
        planner: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 4096,
          timeout: 60000
        },
        executor: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.3,
          maxTokens: 4096,
          timeout: 120000
        },
        reflector: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          temperature: 0.5,
          maxTokens: 2048,
          timeout: 60000
        }
      },
      tools: {
        enabled: ['file_read', 'file_write'],
        workspaceDir: '/tmp/test-workspace',
        maxFileSize: 1024 * 1024,
        allowedExtensions: ['.js', '.ts', '.txt'],
        shellTimeout: 30000,
        shellMaxBuffer: 1024 * 1024
      },
      logging: {
        level: 'error',
        outputDir: '/tmp/test-logs',
        enableConsole: false,
        enableFile: false,
        maxFileSize: 1024 * 1024,
        maxFiles: 1,
        format: 'json'
      },
      cli: {
        theme: 'dark',
        showProgress: false,
        confirmDangerous: false,
        colorOutput: false,
        verboseErrors: false
      },
      storage: {
        type: 'memory',
        snippetDir: '/tmp/test-snippets',
        sessionDir: '/tmp/test-sessions'
      },
      ...overrides
    }
  }

  // 创建测试Logger
  static createTestLogger(): ILogger {
    return {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      logToolCall: jest.fn(),
      logToolResult: jest.fn(),
      logLLMRequest: jest.fn(),
      logLLMResponse: jest.fn(),
      child: jest.fn(() => this.createTestLogger())
    }
  }

  // 等待异步操作
  static async waitFor(
    condition: () => boolean,
    timeout: number = 5000
  ): Promise<void> {
    const startTime = Date.now()

    while (!condition()) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for condition')
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
}
```

**验收标准**:
- [ ] Jest配置正确
- [ ] 测试工具类完整
- [ ] Mock工具易用
- [ ] 覆盖率统计准确

---

### TODO 6.2: 单元测试实现
**优先级**: P0
**预期产出**: 核心模块单元测试

**配置系统测试**:
```typescript
// tests/unit/config/loader.test.ts
describe('ConfigLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('load', () => {
    it('should load default config', () => {
      const config = ConfigLoader.load()

      expect(config.agent.maxIterations).toBe(10)
      expect(config.llm.planner.provider).toBe('openai')
    })

    it('should merge config files', () => {
      const config = ConfigLoader.load('tests/fixtures/custom-config.json')

      expect(config.agent.maxIterations).toBe(20)
    })

    it('should apply environment variables', () => {
      process.env.AGENT_MAX_ITERATIONS = '15'

      const config = ConfigLoader.load()

      expect(config.agent.maxIterations).toBe(15)

      delete process.env.AGENT_MAX_ITERATIONS
    })

    it('should throw error for invalid config', () => {
      expect(() => {
        ConfigLoader.load('tests/fixtures/invalid-config.json')
      }).toThrow(ConfigError)
    })
  })

  describe('validate', () => {
    it('should validate correct config', () => {
      const config = TestHelpers.createTestConfig()
      const result = ConfigLoader.validate(config)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect invalid maxIterations', () => {
      const config = TestHelpers.createTestConfig({
        agent: { maxIterations: 0 }
      })
      const result = ConfigLoader.validate(config)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('agent.maxIterations must be between 1 and 100')
    })
  })
})
```

**工具系统测试**:
```typescript
// tests/unit/tools/file-read.test.ts
describe('FileReadTool', () => {
  let tool: FileReadTool
  let workspaceDir: string

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp('/tmp/test-')
    tool = new FileReadTool()
  })

  afterEach(async () => {
    await fs.rm(workspaceDir, { recursive: true })
  })

  it('should read file successfully', async () => {
    const filePath = path.join(workspaceDir, 'test.txt')
    await fs.writeFile(filePath, 'Hello World')

    const result = await tool.execute({ path: 'test.txt' })

    expect(result.success).toBe(true)
    expect(result.data.content).toBe('Hello World')
  })

  it('should reject path outside workspace', async () => {
    const result = await tool.execute({ path: '../../../etc/passwd' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('outside workspace')
  })

  it('should reject file exceeding size limit', async () => {
    const filePath = path.join(workspaceDir, 'large.txt')
    await fs.writeFile(filePath, 'x'.repeat(20 * 1024 * 1024))

    const result = await tool.execute({ path: 'large.txt' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('exceeds limit')
  })
})
```

**LLM客户端测试**:
```typescript
// tests/unit/llm/openai.test.ts
describe('OpenAIClient', () => {
  let client: OpenAIClient
  let mockOpenAI: jest.Mocked<OpenAI>

  beforeEach(() => {
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    } as any

    client = new OpenAIClient(
      {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'test-key',
        temperature: 0.7,
        maxTokens: 4096,
        timeout: 60000
      },
      TestHelpers.createTestLogger()
    )

    // 注入mock
    ;(client as any).client = mockOpenAI
  })

  it('should call OpenAI API correctly', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          role: 'assistant',
          content: 'Test response'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15
      }
    } as any)

    const result = await client.chat({
      messages: [{ role: 'user', content: 'Test', timestamp: Date.now() }]
    })

    expect(result.content).toBe('Test response')
    expect(result.usage.totalTokens).toBe(15)
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1)
  })

  it('should handle tool calls', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: 'call_123',
            type: 'function',
            function: {
              name: 'file_read',
              arguments: '{"path":"test.txt"}'
            }
          }]
        },
        finish_reason: 'tool_calls'
      }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    } as any)

    const result = await client.chat({
      messages: [{ role: 'user', content: 'Read file', timestamp: Date.now() }],
      tools: [{ name: 'file_read', description: 'Read file', parameters: {} }]
    })

    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls![0].name).toBe('file_read')
  })
})
```

**验收标准**:
- [ ] 所有核心模块有单元测试
- [ ] 测试覆盖率>80%
- [ ] 边界条件测试完整
- [ ] Mock使用正确

---

### TODO 6.3: 集成测试实现
**优先级**: P1
**预期产出**: 模块间集成测试

**Agent集成测试**:
```typescript
// tests/integration/agent.test.ts
describe('Agent Integration', () => {
  let agent: Agent
  let config: GlobalConfig
  let logger: ILogger

  beforeEach(() => {
    config = TestHelpers.createTestConfig()
    logger = TestHelpers.createTestLogger()
    agent = new Agent(config, logger)
  })

  it('should complete simple task', async () => {
    // Mock LLM responses
    const mockLLM = TestHelpers.createMockLLMClient([
      {
        content: JSON.stringify({
          type: 'simple',
          answer: 'The answer is 42'
        }),
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      }
    ])

    ;(agent as any).planner.llmClient = mockLLM

    await agent.run('What is the answer?')

    const state = (agent as any).stateManager.getState()
    expect(state.phase).toBe('completed')
  })

  it('should execute complex task with tools', async () => {
    // Mock LLM responses
    const mockLLM = TestHelpers.createMockLLMClient([
      // Planner response
      {
        content: JSON.stringify({
          type: 'complex',
          tasks: [
            { title: 'Read file', description: 'Read test.txt' }
          ]
        }),
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
      },
      // Executor response with tool call
      {
        content: '',
        toolCalls: [{
          id: 'call_1',
          name: 'file_read',
          arguments: { path: 'test.txt' }
        }],
        finishReason: 'tool_calls',
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 }
      },
      // Executor final response
      {
        content: 'File content: Hello World',
        finishReason: 'stop',
        usage: { promptTokens: 30, completionTokens: 10, totalTokens: 40 }
      },
      // Reflector response
      {
        content: JSON.stringify({
          goalAchieved: true,
          summary: 'Task completed successfully'
        }),
        finishReason: 'stop',
        usage: { promptTokens: 40, completionTokens: 15, totalTokens: 55 }
      }
    ])

    ;(agent as any).planner.llmClient = mockLLM
    ;(agent as any).executor.llmClient = mockLLM
    ;(agent as any).reflector.llmClient = mockLLM

    await agent.run('Read test.txt')

    const state = (agent as any).stateManager.getState()
    expect(state.phase).toBe('completed')
    expect(state.metadata.toolCallsCount).toBe(1)
  })
})
```

**工具管理器集成测试**:
```typescript
// tests/integration/tool-manager.test.ts
describe('ToolManager Integration', () => {
  let toolManager: ToolManager
  let workspaceDir: string

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp('/tmp/test-')
    const config = TestHelpers.createTestConfig({
      tools: { workspaceDir }
    })
    toolManager = new ToolManager(config.tools, TestHelpers.createTestLogger())
  })

  afterEach(async () => {
    await fs.rm(workspaceDir, { recursive: true })
  })

  it('should execute tool chain', async () => {
    // 1. Write file
    const writeResult = await toolManager.execute({
      id: 'call_1',
      name: 'file_write',
      arguments: {
        path: 'test.txt',
        content: 'Hello World'
      }
    })

    expect(writeResult.success).toBe(true)

    // 2. Read file
    const readResult = await toolManager.execute({
      id: 'call_2',
      name: 'file_read',
      arguments: { path: 'test.txt' }
    })

    expect(readResult.success).toBe(true)
    expect(readResult.data.content).toBe('Hello World')
  })
})
```

**验收标准**:
- [ ] 模块间交互测试完整
- [ ] 工具链测试通过
- [ ] Agent端到端流程测试通过
- [ ] 错误传播测试完整

---

### TODO 6.4: 端到端测试实现
**优先级**: P1
**预期产出**: 完整场景端到端测试

**E2E测试框架**:
```typescript
// tests/e2e/scenarios.test.ts
describe('E2E Scenarios', () => {
  let testWorkspace: string

  beforeEach(async () => {
    testWorkspace = await fs.mkdtemp('/tmp/e2e-test-')
  })

  afterEach(async () => {
    await fs.rm(testWorkspace, { recursive: true })
  })

  it('should complete file manipulation task', async () => {
    // 准备测试环境
    await fs.writeFile(
      path.join(testWorkspace, 'input.txt'),
      'Original content'
    )

    // 运行Agent
    const config = TestHelpers.createTestConfig({
      tools: { workspaceDir: testWorkspace },
      agent: { requireConfirmation: false }
    })

    const agent = new Agent(config, TestHelpers.createTestLogger())

    await agent.run('Read input.txt and write its content to output.txt')

    // 验证结果
    const outputContent = await fs.readFile(
      path.join(testWorkspace, 'output.txt'),
      'utf8'
    )

    expect(outputContent).toBe('Original content')
  })

  it('should handle error and retry', async () => {
    const config = TestHelpers.createTestConfig({
      tools: { workspaceDir: testWorkspace },
      agent: { maxIterations: 3 }
    })

    const agent = new Agent(config, TestHelpers.createTestLogger())

    // 第一次会失败（文件不存在），应该重试
    await agent.run('Read nonexistent.txt')

    const state = (agent as any).stateManager.getState()
    expect(state.currentIteration).toBeGreaterThan(1)
  })
})
```

**CLI E2E测试**:
```typescript
// tests/e2e/cli.test.ts
describe('CLI E2E', () => {
  it('should run via CLI', async () => {
    const result = await exec('node dist/cli/index.js run "What is 1+1?"')

    expect(result.stdout).toContain('2')
    expect(result.exitCode).toBe(0)
  })

  it('should export config', async () => {
    const outputPath = '/tmp/test-config.json'
    await exec(`node dist/cli/index.js config:export -o ${outputPath}`)

    const config = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    expect(config.agent).toBeDefined()
  })
})
```

**验收标准**:
- [ ] 完整场景测试通过
- [ ] CLI命令测试通过
- [ ] 错误恢复测试通过
- [ ] 性能测试达标

---

### TODO 6.5: 性能和压力测试
**优先级**: P2
**预期产出**: 性能基准和压力测试

**性能测试**:
```typescript
// tests/performance/benchmarks.test.ts
describe('Performance Benchmarks', () => {
  it('should complete simple task within 10s', async () => {
    const startTime = Date.now()

    const agent = new Agent(
      TestHelpers.createTestConfig(),
      TestHelpers.createTestLogger()
    )

    await agent.run('What is TypeScript?')

    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(10000)
  })

  it('should handle 100 tool calls efficiently', async () => {
    const toolManager = new ToolManager(
      TestHelpers.createTestConfig().tools,
      TestHelpers.createTestLogger()
    )

    const startTime = Date.now()

    const promises = Array.from({ length: 100 }, (_, i) =>
      toolManager.execute({
        id: `call_${i}`,
        name: 'file_read',
        arguments: { path: 'test.txt' }
      })
    )

    await Promise.all(promises)

    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(5000)
  })
})
```

**内存泄漏测试**:
```typescript
// tests/performance/memory.test.ts
describe('Memory Leak Tests', () => {
  it('should not leak memory during long execution', async () => {
    const initialMemory = process.memoryUsage().heapUsed

    const agent = new Agent(
      TestHelpers.createTestConfig({ agent: { maxIterations: 50 } }),
      TestHelpers.createTestLogger()
    )

    await agent.run('Repeat task 50 times')

    const finalMemory = process.memoryUsage().heapUsed
    const memoryIncrease = finalMemory - initialMemory

    // 内存增长不应超过100MB
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024)
  })
})
```

**验收标准**:
- [ ] 性能基准测试通过
- [ ] 无内存泄漏
- [ ] 并发测试通过
- [ ] 压力测试稳定

---

## 依赖关系
- 依赖所有前置TODO（需要完整系统）
- TODO 6.1 是其他TODO的基础
- TODO 6.4 依赖 TODO 6.2-6.3

## 风险与缓解
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 测试覆盖不足 | 高 | 代码审查+覆盖率检查 |
| Mock不准确 | 中 | 定期与真实API对比 |
| E2E测试不稳定 | 中 | 增加重试机制 |
| 性能测试环境差异 | 低 | 标准化测试环境 |

## 完成标准
- [ ] 所有5个内部TODO完成
- [ ] 测试覆盖率>80%
- [ ] 所有测试通过
- [ ] CI/CD集成完成
