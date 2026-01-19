# TODO-03: 工具系统核心实现

## 目标
实现9个标准工具（代码查询、文件操作、代码片段、Shell、用户交互），建立工具管理器和安全验证机制。

## 内部TODO列表

### TODO 3.1: 工具基类和接口定义
**优先级**: P0
**预期产出**: 标准化工具接口和基类实现

**核心设计**:
```typescript
// src/tools/base.ts
interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required: boolean
  default?: any
  enum?: any[]
}

interface ToolResult {
  success: boolean
  data?: any
  error?: string
  metadata?: {
    executionTime: number
    tokensUsed?: number
  }
}

abstract class BaseTool {
  abstract readonly name: string
  abstract readonly description: string
  abstract readonly parameters: ToolParameter[]
  readonly dangerous: boolean = false

  // 子类实现
  abstract execute(args: Record<string, any>): Promise<ToolResult>

  // 参数验证（通用逻辑）
  validate(args: Record<string, any>): ValidationResult {
    const errors: string[] = []

    for (const param of this.parameters) {
      // 检查必需参数
      if (param.required && !(param.name in args)) {
        errors.push(`Missing required parameter: ${param.name}`)
        continue
      }

      // 检查类型
      if (param.name in args) {
        const value = args[param.name]
        const actualType = Array.isArray(value) ? 'array' : typeof value

        if (actualType !== param.type && value !== null) {
          errors.push(`Parameter '${param.name}' type mismatch`)
        }

        // 检查枚举
        if (param.enum && !param.enum.includes(value)) {
          errors.push(`Parameter '${param.name}' invalid value`)
        }
      }
    }

    return { valid: errors.length === 0, errors }
  }

  // 获取LLM Function定义
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: this.buildProperties(),
        required: this.getRequiredParams()
      }
    }
  }

  private buildProperties(): Record<string, any> {
    return this.parameters.reduce((acc, param) => {
      acc[param.name] = {
        type: param.type,
        description: param.description,
        enum: param.enum
      }
      return acc
    }, {})
  }
}
```

**验收标准**:
- [ ] 接口定义完整且类型安全
- [ ] 参数验证逻辑健壮
- [ ] Function定义符合OpenAI/Anthropic规范
- [ ] 支持危险操作标记

---

### TODO 3.2: 代码查询和文件操作工具
**优先级**: P0
**预期产出**: CodeQueryTool, FileReadTool, FileWriteTool, FileListTool

**CodeQueryTool实现**:
```typescript
// src/tools/code-query.ts
class CodeQueryTool extends BaseTool {
  readonly name = 'code_query'
  readonly description = '在代码库中搜索函数、类、变量或文件'
  readonly parameters = [
    { name: 'query', type: 'string', required: true, description: '搜索关键词' },
    { name: 'type', type: 'string', required: false, enum: ['function', 'class', 'file', 'all'] },
    { name: 'path', type: 'string', required: false, description: '限制搜索路径' }
  ]

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { query, type = 'all', path } = args

    try {
      // 使用ripgrep进行代码搜索
      const results = await this.searchWithRipgrep(query, type, path)

      return {
        success: true,
        data: {
          query,
          matches: results.map(r => ({
            file: r.file,
            line: r.line,
            code: r.code,
            context: r.context
          }))
        }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  private async searchWithRipgrep(
    query: string,
    type: string,
    path?: string
  ): Promise<SearchResult[]> {
    const args = ['--json', '--context', '3']

    // 根据类型添加过滤
    if (type === 'function') {
      args.push('--regexp', `(function|def|fn)\\s+${query}`)
    } else if (type === 'class') {
      args.push('--regexp', `class\\s+${query}`)
    } else {
      args.push(query)
    }

    if (path) args.push(path)

    const result = await execCommand('rg', args)
    return this.parseRipgrepOutput(result.stdout)
  }
}
```

**FileReadTool实现**:
```typescript
// src/tools/file-ops.ts
class FileReadTool extends BaseTool {
  readonly name = 'file_read'
  readonly description = '读取文件内容'
  readonly parameters = [
    { name: 'path', type: 'string', required: true },
    { name: 'encoding', type: 'string', required: false, enum: ['utf8', 'base64'], default: 'utf8' }
  ]

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { path, encoding = 'utf8' } = args

    try {
      // 安全检查
      const safePath = PathValidator.validate(path, config.tools.workspaceDir)

      // 文件大小检查
      await FileSizeValidator.validate(safePath, config.tools.maxFileSize)

      // 读取文件
      const content = await fs.readFile(safePath, encoding)

      return {
        success: true,
        data: { path, content, size: content.length }
      }
    } catch (error) {
      return { success: false, error: `Failed to read file: ${error.message}` }
    }
  }
}

class FileWriteTool extends BaseTool {
  readonly name = 'file_write'
  readonly description = '写入或创建文件'
  readonly dangerous = true
  readonly parameters = [
    { name: 'path', type: 'string', required: true },
    { name: 'content', type: 'string', required: true },
    { name: 'mode', type: 'string', required: false, enum: ['overwrite', 'append'] }
  ]

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { path, content, mode = 'overwrite' } = args

    try {
      const safePath = PathValidator.validate(path, config.tools.workspaceDir)

      // 确保目录存在
      await fs.mkdir(dirname(safePath), { recursive: true })

      // 写入文件
      if (mode === 'append') {
        await fs.appendFile(safePath, content)
      } else {
        await fs.writeFile(safePath, content)
      }

      return { success: true, data: { path, size: content.length } }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}
```

**验收标准**:
- [ ] 代码搜索支持正则表达式
- [ ] 文件操作限制在工作目录内
- [ ] 文件大小限制生效
- [ ] 错误处理完善

---

### TODO 3.3: 代码片段管理工具
**优先级**: P1
**预期产出**: SnippetSaveTool, SnippetLoadTool, SnippetListTool

**实现要点**:
```typescript
// src/tools/snippet.ts
class SnippetSaveTool extends BaseTool {
  readonly name = 'snippet_save'
  readonly description = '保存代码片段以便后续复用'
  readonly parameters = [
    { name: 'name', type: 'string', required: true },
    { name: 'code', type: 'string', required: true },
    { name: 'description', type: 'string', required: false },
    { name: 'language', type: 'string', required: false },
    { name: 'tags', type: 'array', required: false }
  ]

  constructor(private storage: ISnippetStorage) {
    super()
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { name, code, description, language, tags = [] } = args

    try {
      const snippet: CodeSnippet = {
        id: generateId(),
        name,
        code,
        description: description || '',
        language: language || this.detectLanguage(code),
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      await this.storage.save(snippet)

      return {
        success: true,
        data: { id: snippet.id, name: snippet.name }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  private detectLanguage(code: string): string {
    // 简单的语言检测
    if (code.includes('function') || code.includes('const')) return 'javascript'
    if (code.includes('def ') || code.includes('import ')) return 'python'
    if (code.includes('interface') || code.includes('type ')) return 'typescript'
    return 'plaintext'
  }
}

class SnippetLoadTool extends BaseTool {
  readonly name = 'snippet_load'
  readonly description = '加载已保存的代码片段'
  readonly parameters = [
    { name: 'name', type: 'string', required: true, description: '片段名称或ID' }
  ]

  constructor(private storage: ISnippetStorage) {
    super()
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { name } = args

    try {
      const snippet = await this.storage.load(name)

      if (!snippet) {
        return { success: false, error: `Snippet '${name}' not found` }
      }

      return {
        success: true,
        data: {
          id: snippet.id,
          name: snippet.name,
          code: snippet.code,
          description: snippet.description,
          language: snippet.language
        }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}
```

**验收标准**:
- [ ] 代码片段可保存和加载
- [ ] 支持标签过滤
- [ ] 语言自动检测准确
- [ ] 搜索功能正常

---

### TODO 3.4: Shell执行和用户交互工具
**优先级**: P0
**预期产出**: ShellExecTool, AskUserTool

**ShellExecTool实现**:
```typescript
// src/tools/shell.ts
class ShellExecTool extends BaseTool {
  readonly name = 'shell_exec'
  readonly description = '执行Shell命令'
  readonly dangerous = true
  readonly parameters = [
    { name: 'command', type: 'string', required: true },
    { name: 'cwd', type: 'string', required: false },
    { name: 'timeout', type: 'number', required: false, default: 30000 }
  ]

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { command, cwd, timeout = 30000 } = args

    try {
      // 安全检查
      this.validateCommand(command)

      // 执行命令
      const result = await this.execCommand(command, cwd, timeout)

      return {
        success: true,
        data: {
          command,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode
        }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  private validateCommand(command: string): void {
    // 危险命令黑名单
    const dangerousPatterns = [
      /rm\s+-rf\s+\//,
      /:\(\)\{.*\}/,  // Fork bomb
      /mkfs/,
      /dd\s+if=/
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        throw new SecurityError('Dangerous command blocked')
      }
    }
  }

  private async execCommand(
    command: string,
    cwd?: string,
    timeout?: number
  ): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      exec(command, {
        cwd: cwd || process.cwd(),
        timeout,
        maxBuffer: config.tools.shellMaxBuffer
      }, (error, stdout, stderr) => {
        if (error) {
          reject(error)
        } else {
          resolve({ stdout, stderr, exitCode: 0 })
        }
      })
    })
  }
}
```

**AskUserTool实现**:
```typescript
// src/tools/ask-user.ts
class AskUserTool extends BaseTool {
  readonly name = 'ask_user'
  readonly description = '向用户提问以获取更多信息'
  readonly parameters = [
    { name: 'question', type: 'string', required: true },
    { name: 'options', type: 'array', required: false }
  ]

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { question, options } = args

    try {
      let answer: string

      if (options && options.length > 0) {
        // 多选题
        const response = await inquirer.prompt([{
          type: 'list',
          name: 'answer',
          message: question,
          choices: options
        }])
        answer = response.answer
      } else {
        // 开放式问题
        const response = await inquirer.prompt([{
          type: 'input',
          name: 'answer',
          message: question
        }])
        answer = response.answer
      }

      return { success: true, data: { question, answer } }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}
```

**验收标准**:
- [ ] Shell命令安全检查生效
- [ ] 超时机制正常工作
- [ ] 用户交互流畅
- [ ] 支持多选和开放式问题

---

### TODO 3.5: 工具管理器和验证器
**优先级**: P0
**预期产出**: ToolManager和安全验证机制

**ToolManager实现**:
```typescript
// src/tools/manager.ts
class ToolManager {
  private tools: Map<string, BaseTool> = new Map()
  private logger: ILogger
  private config: GlobalConfig['tools']

  constructor(config: GlobalConfig['tools'], logger: ILogger) {
    this.config = config
    this.logger = logger
    this.registerDefaultTools()
  }

  private registerDefaultTools(): void {
    const snippetStorage = new FileSnippetStorage(this.config.workspaceDir)

    const allTools: BaseTool[] = [
      new CodeQueryTool(),
      new FileReadTool(),
      new FileWriteTool(),
      new FileListTool(),
      new SnippetSaveTool(snippetStorage),
      new SnippetLoadTool(snippetStorage),
      new SnippetListTool(snippetStorage),
      new ShellExecTool(),
      new AskUserTool()
    ]

    // 只注册启用的工具
    for (const tool of allTools) {
      if (this.config.enabled.includes(tool.name)) {
        this.register(tool)
      }
    }
  }

  register(tool: BaseTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' already registered`)
    }
    this.tools.set(tool.name, tool)
    this.logger.info(`Tool registered: ${tool.name}`)
  }

  getTool(name: string): BaseTool {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new ToolExecutionError(name, 'Tool not found')
    }
    return tool
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.getDefinition())
  }

  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.getTool(toolCall.name)

    // 验证参数
    const validation = tool.validate(toolCall.arguments)
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`
      }
    }

    // 危险操作确认
    if (tool.dangerous && this.config.confirmDangerous) {
      const confirmed = await this.askConfirmation(toolCall)
      if (!confirmed) {
        return { success: false, error: 'Operation cancelled by user' }
      }
    }

    // 执行工具
    this.logger.logToolCall(toolCall.name, toolCall.arguments)
    const startTime = Date.now()

    try {
      const result = await tool.execute(toolCall.arguments)
      result.metadata = {
        ...result.metadata,
        executionTime: Date.now() - startTime
      }

      this.logger.logToolResult(toolCall.name, result)
      return result
    } catch (error) {
      this.logger.error(`Tool execution error: ${toolCall.name}`, error)
      return {
        success: false,
        error: error.message,
        metadata: { executionTime: Date.now() - startTime }
      }
    }
  }

  private async askConfirmation(toolCall: ToolCall): Promise<boolean> {
    console.log(chalk.yellow(`\n⚠️  Dangerous operation: ${toolCall.name}`))
    console.log(chalk.gray(JSON.stringify(toolCall.arguments, null, 2)))

    const answer = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: 'Continue?',
      default: false
    }])

    return answer.confirmed
  }
}
```

**验收标准**:
- [ ] 工具注册和获取正常
- [ ] 参数验证捕获所有错误
- [ ] 危险操作确认机制生效
- [ ] 执行时间统计准确

---

## 依赖关系
- 依赖 TODO-01（配置、日志、存储）
- TODO 3.1 是其他TODO的基础
- TODO 3.5 依赖 TODO 3.2-3.4

## 风险与缓解
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Shell命令注入 | 高 | 严格的命令验证和黑名单 |
| 文件路径遍历 | 高 | 路径规范化和边界检查 |
| 工具执行超时 | 中 | 实现超时机制 |
| 代码搜索性能 | 中 | 使用ripgrep优化 |

## 完成标准
- [ ] 所有9个工具实现完成
- [ ] 安全测试通过（路径遍历、命令注入）
- [ ] 性能测试：工具调用<5s
- [ ] 单元测试覆盖率>85%
