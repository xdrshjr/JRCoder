# TODO-01: 项目初始化与基础设施搭建

## 目标
建立TypeScript项目基础架构，配置开发环境，实现核心基础设施模块（配置系统、日志系统、错误处理）。

## 内部TODO列表

### TODO 1.1: 项目脚手架搭建
**优先级**: P0
**预期产出**: 完整的项目目录结构和配置文件

**实施步骤**:
1. 初始化npm项目，配置package.json依赖
2. 配置TypeScript编译选项（tsconfig.json）
3. 设置ESLint和Prettier代码规范
4. 创建标准目录结构（src/core, src/tools, src/llm等）
5. 配置构建脚本和开发脚本

**关键配置**:
```json
// tsconfig.json 核心配置
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true
  }
}
```

**验收标准**:
- [ ] 项目可成功编译为JavaScript
- [ ] ESLint检查通过
- [ ] 目录结构符合架构设计
- [ ] 开发脚本（dev/build/test）正常运行

---

### TODO 1.2: 配置系统实现
**优先级**: P0
**预期产出**: 多层级配置加载器和验证器

**核心模块**:
```typescript
// src/config/loader.ts
class ConfigLoader {
  static load(customPath?: string): GlobalConfig {
    // 1. 加载默认配置
    config = loadDefaultConfig()

    // 2. 合并配置文件（优先级递增）
    for path in CONFIG_PATHS:
      if exists(path):
        config = merge(config, loadJSON(path))

    // 3. 合并环境变量
    config = merge(config, loadEnvConfig())

    // 4. 合并CLI参数
    config = merge(config, cliArgs)

    // 5. 验证配置
    validate(config)

    return config
  }
}
```

**实施要点**:
1. 实现深度合并算法（deepMerge）
2. 支持环境变量映射（AGENT_MAX_ITERATIONS → agent.maxIterations）
3. 使用Joi进行Schema验证
4. 提供配置预设（fast/quality/local/economy）
5. 实现配置导出功能（移除敏感信息）

**验收标准**:
- [ ] 支持4层配置优先级
- [ ] 环境变量正确映射
- [ ] 配置验证捕获所有错误
- [ ] 预设配置可正常加载

---

### TODO 1.3: 日志系统实现
**优先级**: P0
**预期产出**: 结构化日志记录器，支持多输出目标

**核心架构**:
```typescript
// src/logger/logger.ts
class Logger implements ILogger {
  private winston: WinstonLogger
  private context: Record<string, any>

  constructor(config: LogConfig) {
    this.winston = createLogger({
      level: config.level,
      format: combine(timestamp(), json()),
      transports: [
        new Console({ format: consoleFormat }),
        new File({ filename: 'combined.log' }),
        new File({ filename: 'error.log', level: 'error' })
      ]
    })
  }

  // 特殊日志方法
  logToolCall(name: string, args: any): void {
    this.info(`Tool: ${name}`, { type: 'tool_call', args })
  }

  logLLMRequest(req: LLMRequest): void {
    this.debug('LLM Request', {
      type: 'llm_request',
      messageCount: req.messages.length,
      toolCount: req.tools?.length
    })
  }
}
```

**实施要点**:
1. 集成Winston日志库
2. 实现控制台彩色输出（chalk）
3. 支持日志轮转（maxSize, maxFiles）
4. 提供子日志器（带上下文）
5. 实现异步写入避免阻塞

**验收标准**:
- [ ] 日志正确输出到控制台和文件
- [ ] 日志级别过滤正常工作
- [ ] 结构化日志可被解析
- [ ] 性能测试：1000条日志<100ms

---

### TODO 1.4: 错误处理体系
**优先级**: P1
**预期产出**: 统一的错误类型和处理机制

**错误类型定义**:
```typescript
// src/core/errors.ts
class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
    public recoverable: boolean = false
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

class ToolExecutionError extends AgentError {
  constructor(toolName: string, message: string) {
    super(
      `Tool '${toolName}' failed: ${message}`,
      'TOOL_ERROR',
      { toolName },
      true  // 可恢复
    )
  }
}

class LLMError extends AgentError {
  constructor(message: string, statusCode?: number) {
    super(
      `LLM error: ${message}`,
      'LLM_ERROR',
      { statusCode },
      statusCode === 429  // 429可重试
    )
  }
}
```

**错误处理器**:
```typescript
class ErrorHandler {
  static handle(error: Error, logger: ILogger): ErrorResponse {
    if (error instanceof AgentError) {
      logger.error(error.message, error, error.details)
      return {
        message: error.message,
        code: error.code,
        recoverable: error.recoverable
      }
    }

    // 未知错误
    logger.error('Unexpected error', error)
    return {
      message: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      recoverable: false
    }
  }
}
```

**验收标准**:
- [ ] 所有错误类型定义完整
- [ ] 错误处理器正确分类错误
- [ ] 可恢复错误标记准确
- [ ] 错误日志包含完整堆栈

---

### TODO 1.5: 存储系统基础
**优先级**: P1
**预期产出**: 文件存储和会话管理

**存储接口**:
```typescript
// src/storage/interfaces.ts
interface ISnippetStorage {
  save(snippet: CodeSnippet): Promise<void>
  load(id: string): Promise<CodeSnippet | null>
  list(filter?: SnippetFilter): Promise<CodeSnippet[]>
  delete(id: string): Promise<void>
  search(query: string): Promise<CodeSnippet[]>
}

interface ISessionStorage {
  save(session: SessionData): Promise<void>
  load(id: string): Promise<SessionData | null>
  list(): Promise<SessionData[]>
  delete(id: string): Promise<void>
}
```

**文件存储实现**:
```typescript
// src/storage/file.ts
class FileSnippetStorage implements ISnippetStorage {
  private baseDir: string

  async save(snippet: CodeSnippet): Promise<void> {
    const filePath = join(this.baseDir, `${snippet.id}.json`)
    await ensureDir(dirname(filePath))
    await writeJSON(filePath, snippet, { spaces: 2 })
  }

  async search(query: string): Promise<CodeSnippet[]> {
    const all = await this.list()
    return all.filter(s =>
      s.name.includes(query) ||
      s.description.includes(query) ||
      s.tags.some(t => t.includes(query))
    )
  }
}
```

**验收标准**:
- [ ] 代码片段可正常保存和加载
- [ ] 会话状态可持久化
- [ ] 搜索功能返回正确结果
- [ ] 并发写入不会导致数据损坏

---

## 依赖关系
- TODO 1.1 是所有其他TODO的前置条件
- TODO 1.2 被 TODO 1.3 依赖（日志需要配置）
- TODO 1.4 被所有模块依赖（错误处理）
- TODO 1.5 被工具系统依赖

## 风险与缓解
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| TypeScript配置复杂 | 中 | 参考成熟项目配置模板 |
| 配置验证遗漏 | 高 | 编写完整的测试用例 |
| 日志性能问题 | 中 | 使用异步写入和缓冲 |
| 存储并发冲突 | 低 | 实现文件锁机制 |

## 完成标准
- [ ] 所有5个内部TODO完成
- [ ] 单元测试覆盖率>80%
- [ ] 集成测试通过
- [ ] 文档完整（API文档+使用示例）
