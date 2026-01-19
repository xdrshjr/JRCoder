# TODO-09: 文档与示例完善

## 目标
编写完整的项目文档，包括API文档、使用指南、最佳实践、示例代码和贡献指南，确保项目易用性和可维护性。

## 内部TODO列表

### TODO 9.1: API文档生成
**优先级**: P0
**预期产出**: 完整的API参考文档

**TSDoc配置**:
```typescript
// typedoc.json
{
  "entryPoints": ["src/index.ts"],
  "out": "docs/api",
  "exclude": ["**/*.test.ts", "**/*.spec.ts"],
  "excludePrivate": true,
  "excludeProtected": false,
  "excludeInternal": true,
  "readme": "README.md",
  "theme": "default",
  "plugin": ["typedoc-plugin-markdown"],
  "githubPages": false
}
```

**文档注释规范**:
```typescript
/**
 * Agent主类，负责协调Planner、Executor和Reflector完成任务
 *
 * @example
 * ```typescript
 * const config = ConfigLoader.load()
 * const logger = new Logger(config.logging)
 * const agent = new Agent(config, logger)
 *
 * await agent.run('实现用户登录功能')
 * ```
 *
 * @public
 */
class Agent {
  /**
   * 创建Agent实例
   *
   * @param config - 全局配置对象
   * @param logger - 日志记录器实例
   *
   * @throws {ConfigError} 配置无效时抛出
   */
  constructor(config: GlobalConfig, logger: ILogger) {
    // ...
  }

  /**
   * 运行Agent执行任务
   *
   * @param userTask - 用户任务描述
   * @returns Promise，任务完成时resolve
   *
   * @throws {AgentError} 执行失败时抛出
   *
   * @remarks
   * 该方法会启动完整的规划-执行-反思循环，直到任务完成或达到最大迭代次数
   *
   * @example
   * ```typescript
   * await agent.run('读取config.json并输出内容')
   * ```
   */
  async run(userTask: string): Promise<void> {
    // ...
  }
}
```

**生成脚本**:
```json
// package.json
{
  "scripts": {
    "docs:api": "typedoc",
    "docs:serve": "http-server docs/api -p 8080",
    "docs:build": "npm run docs:api && npm run docs:guide"
  }
}
```

**验收标准**:
- [ ] 所有公共API有文档注释
- [ ] 示例代码可运行
- [ ] 文档生成无错误
- [ ] 文档结构清晰

---

### TODO 9.2: 用户指南编写
**优先级**: P0
**预期产出**: 完整的用户使用指南

**README.md**:
```markdown
# OpenJRAgent

一个基于TypeScript的自动化编程Agent系统，通过智能规划、工具调用和反思循环实现复杂编程任务的自动化执行。

## 特性

- 🤖 **智能规划**: 自动分析任务复杂度，生成执行计划
- 🛠️ **工具化执行**: 9个标准工具，支持代码查询、文件操作、Shell执行
- 🔄 **反思优化**: 自动评估执行结果，迭代改进
- 🎯 **多模型支持**: 支持OpenAI、Anthropic、Ollama
- 💾 **会话恢复**: 支持中断恢复，状态持久化
- 📊 **性能监控**: 完整的指标收集和性能分析

## 快速开始

### 安装

\`\`\`bash
npm install -g openjragent
\`\`\`

### 配置

创建 `.env` 文件：

\`\`\`bash
OPENAI_API_KEY=your_api_key_here
AGENT_MAX_ITERATIONS=10
\`\`\`

### 运行

\`\`\`bash
# 简单任务
openjragent run "What is TypeScript?"

# 复杂任务
openjragent run "实现一个用户登录功能"

# 使用配置文件
openjragent run "任务描述" --config ./my-config.json

# 恢复会话
openjragent run "继续任务" --resume session-123456
\`\`\`

## 配置

### 配置文件示例

\`\`\`json
{
  "agent": {
    "maxIterations": 10,
    "enableReflection": true,
    "requireConfirmation": true
  },
  "llm": {
    "planner": {
      "provider": "openai",
      "model": "gpt-4-turbo-preview"
    },
    "executor": {
      "provider": "anthropic",
      "model": "claude-3-opus-20240229"
    }
  }
}
\`\`\`

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAI_API_KEY` | OpenAI API密钥 | - |
| `ANTHROPIC_API_KEY` | Anthropic API密钥 | - |
| `AGENT_MAX_ITERATIONS` | 最大迭代次数 | 10 |
| `LOG_LEVEL` | 日志级别 | info |

## 工具

OpenJRAgent提供9个标准工具：

1. **code_query**: 搜索代码库中的函数、类、文件
2. **file_read**: 读取文件内容
3. **file_write**: 写入文件内容
4. **file_list**: 列出目录中的文件
5. **snippet_save**: 保存代码片段
6. **snippet_load**: 加载代码片段
7. **snippet_list**: 列出所有代码片段
8. **shell_exec**: 执行Shell命令
9. **ask_user**: 向用户提问

## 命令

\`\`\`bash
# 运行Agent
openjragent run <task> [options]

# 查看配置
openjragent config:show

# 导出配置
openjragent config:export -o config.json

# 查看日志
openjragent logs --tail 50

# 生成报告
openjragent report --session <id> --format markdown

# 列出会话
openjragent sessions
\`\`\`

## 开发

\`\`\`bash
# 克隆仓库
git clone https://github.com/yourusername/openjragent.git

# 安装依赖
npm install

# 运行测试
npm test

# 构建
npm run build

# 开发模式
npm run dev
\`\`\`

## 许可证

MIT
```

**用户指南 (docs/guide/user-guide.md)**:
```markdown
# 用户指南

## 基本概念

### Agent执行流程

1. **Planning**: Planner分析任务，生成执行计划
2. **Confirming**: 用户确认计划（可选）
3. **Executing**: Executor执行任务，调用工具
4. **Reflecting**: Reflector评估结果，决定下一步

### 任务类型

- **简单任务**: 单步操作，直接返回答案
- **复杂任务**: 多步骤，需要工具调用

## 使用场景

### 场景1: 代码查询

\`\`\`bash
openjragent run "查找项目中所有的API端点定义"
\`\`\`

### 场景2: 文件操作

\`\`\`bash
openjragent run "读取package.json并列出所有依赖"
\`\`\`

### 场景3: 代码生成

\`\`\`bash
openjragent run "创建一个Express路由处理用户登录"
\`\`\`

## 高级功能

### 自定义配置

创建 `openjragent.json`:

\`\`\`json
{
  "agent": {
    "maxIterations": 20,
    "enableReflection": true
  },
  "llm": {
    "planner": {
      "model": "gpt-4"
    }
  }
}
\`\`\`

### 使用预设

\`\`\`bash
# 快速模式（小模型，无反思）
openjragent run "任务" --preset fast

# 高质量模式（大模型，完整流程）
openjragent run "任务" --preset quality

# 本地模式（Ollama）
openjragent run "任务" --preset local
\`\`\`

### 会话管理

\`\`\`bash
# 列出所有会话
openjragent sessions

# 恢复会话
openjragent run "继续" --resume session-123456

# 查看会话日志
openjragent logs --session session-123456
\`\`\`

## 故障排除

### 常见问题

**Q: API调用失败**
A: 检查API密钥是否正确设置，网络是否正常

**Q: 任务执行超时**
A: 增加 `maxIterations` 或简化任务描述

**Q: 工具调用失败**
A: 检查工作目录权限，查看详细日志

### 调试

\`\`\`bash
# 启用调试日志
openjragent run "任务" --log-level debug

# 查看详细错误
openjragent run "任务" --verbose-errors
\`\`\`
```

**验收标准**:
- [ ] README完整清晰
- [ ] 用户指南覆盖所有功能
- [ ] 示例可运行
- [ ] 故障排除有效

---

### TODO 9.3: 最佳实践文档
**优先级**: P1
**预期产出**: 最佳实践和设计模式文档

**最佳实践 (docs/guide/best-practices.md)**:
```markdown
# 最佳实践

## 任务描述

### ✅ 好的任务描述

\`\`\`
实现一个用户登录功能：
1. 创建登录表单（用户名、密码）
2. 实现POST /api/login接口
3. 验证用户凭证
4. 返回JWT token
\`\`\`

### ❌ 不好的任务描述

\`\`\`
做一个登录
\`\`\`

## 配置优化

### 成本优化

\`\`\`json
{
  "llm": {
    "planner": { "model": "gpt-4" },
    "executor": { "model": "gpt-3.5-turbo" },
    "reflector": { "model": "gpt-3.5-turbo" }
  }
}
\`\`\`

### 质量优先

\`\`\`json
{
  "llm": {
    "planner": { "model": "gpt-4-turbo-preview" },
    "executor": { "model": "claude-3-opus" },
    "reflector": { "model": "gpt-4" }
  }
}
\`\`\`

## 工具使用

### 文件操作

\`\`\`typescript
// 先读取，再修改
await agent.run("读取config.json，修改port为3000，保存")
\`\`\`

### 代码查询

\`\`\`typescript
// 具体的查询条件
await agent.run("查找所有导出的API路由函数")
\`\`\`

## 错误处理

### 启用重试

\`\`\`json
{
  "agent": {
    "maxRetries": 3,
    "retryStrategy": "exponential"
  }
}
\`\`\`

### 会话恢复

\`\`\`bash
# 定期保存
openjragent run "长任务" --auto-save

# 恢复
openjragent run "继续" --resume <session-id>
\`\`\`

## 性能优化

### 启用缓存

\`\`\`json
{
  "llm": {
    "enableCache": true,
    "cacheSize": 100,
    "cacheTTL": 3600000
  }
}
\`\`\`

### 并发控制

\`\`\`json
{
  "tools": {
    "maxConcurrent": 5
  }
}
\`\`\`

## 安全建议

1. **不要在代码中硬编码API密钥**
2. **使用环境变量或配置文件**
3. **限制工作目录范围**
4. **启用危险操作确认**
5. **定期审查日志**
```

**验收标准**:
- [ ] 最佳实践全面
- [ ] 示例清晰
- [ ] 建议可行
- [ ] 安全提示完整

---

### TODO 9.4: 示例代码库
**优先级**: P1
**预期产出**: 完整的示例代码集合

**示例目录结构**:
```
examples/
├── basic/
│   ├── simple-query.ts
│   ├── file-operations.ts
│   └── code-search.ts
├── advanced/
│   ├── custom-tool.ts
│   ├── multi-model.ts
│   └── session-resume.ts
├── integrations/
│   ├── express-api.ts
│   ├── cli-tool.ts
│   └── github-actions.ts
└── README.md
```

**基础示例 (examples/basic/simple-query.ts)**:
```typescript
import { Agent, ConfigLoader, Logger } from 'openjragent'

async function main() {
  // 加载配置
  const config = ConfigLoader.load()

  // 创建Logger
  const logger = new Logger(config.logging)

  // 创建Agent
  const agent = new Agent(config, logger)

  // 运行简单查询
  await agent.run('What is the difference between let and const in JavaScript?')
}

main().catch(console.error)
```

**高级示例 (examples/advanced/custom-tool.ts)**:
```typescript
import { BaseTool, ToolParameter, ToolResult } from 'openjragent'

// 自定义工具
class WeatherTool extends BaseTool {
  readonly name = 'get_weather'
  readonly description = 'Get current weather for a city'
  readonly parameters: ToolParameter[] = [
    {
      name: 'city',
      type: 'string',
      description: 'City name',
      required: true
    }
  ]

  async execute(args: Record<string, any>): Promise<ToolResult> {
    const { city } = args

    try {
      // 调用天气API
      const response = await fetch(`https://api.weather.com/${city}`)
      const data = await response.json()

      return {
        success: true,
        data: {
          city,
          temperature: data.temp,
          condition: data.condition
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }
}

// 使用自定义工具
async function main() {
  const config = ConfigLoader.load()
  const logger = new Logger(config.logging)
  const agent = new Agent(config, logger)

  // 注册自定义工具
  const toolManager = (agent as any).executor.toolManager
  toolManager.register(new WeatherTool())

  // 使用工具
  await agent.run('What is the weather in Beijing?')
}

main().catch(console.error)
```

**集成示例 (examples/integrations/express-api.ts)**:
```typescript
import express from 'express'
import { Agent, ConfigLoader, Logger } from 'openjragent'

const app = express()
app.use(express.json())

// 创建Agent实例
const config = ConfigLoader.load()
const logger = new Logger(config.logging)

app.post('/api/agent/run', async (req, res) => {
  const { task } = req.body

  try {
    const agent = new Agent(config, logger)
    await agent.run(task)

    const state = (agent as any).stateManager.getState()

    res.json({
      success: true,
      result: state.plan?.tasks.map(t => ({
        title: t.title,
        status: t.status,
        result: t.result
      }))
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.listen(3000, () => {
  console.log('Agent API server running on port 3000')
})
```

**验收标准**:
- [ ] 示例覆盖所有主要功能
- [ ] 代码可直接运行
- [ ] 注释清晰
- [ ] README说明完整

---

### TODO 9.5: 贡献指南和开发文档
**优先级**: P2
**预期产出**: 贡献指南和开发者文档

**贡献指南 (CONTRIBUTING.md)**:
```markdown
# 贡献指南

感谢您对OpenJRAgent的关注！

## 开发环境

### 要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- Git

### 设置

\`\`\`bash
# Fork并克隆仓库
git clone https://github.com/yourusername/openjragent.git
cd openjragent

# 安装依赖
npm install

# 运行测试
npm test

# 启动开发模式
npm run dev
\`\`\`

## 开发流程

1. **创建分支**: `git checkout -b feature/your-feature`
2. **编写代码**: 遵循代码规范
3. **添加测试**: 确保测试覆盖率>80%
4. **运行测试**: `npm test`
5. **提交代码**: 遵循提交规范
6. **创建PR**: 描述清晰，关联Issue

## 代码规范

### TypeScript

- 使用严格模式
- 所有公共API必须有类型定义
- 使用ESLint和Prettier

### 命名规范

- 类名: PascalCase
- 函数/变量: camelCase
- 常量: UPPER_SNAKE_CASE
- 接口: IInterfaceName

### 注释规范

\`\`\`typescript
/**
 * 函数描述
 *
 * @param param1 - 参数1描述
 * @param param2 - 参数2描述
 * @returns 返回值描述
 *
 * @example
 * \`\`\`typescript
 * const result = myFunction('value1', 'value2')
 * \`\`\`
 */
function myFunction(param1: string, param2: string): string {
  // ...
}
\`\`\`

## 测试

### 单元测试

\`\`\`typescript
describe('MyClass', () => {
  it('should do something', () => {
    const instance = new MyClass()
    expect(instance.method()).toBe(expected)
  })
})
\`\`\`

### 集成测试

\`\`\`typescript
describe('Integration', () => {
  it('should work end-to-end', async () => {
    const agent = new Agent(config, logger)
    await agent.run('task')
    // assertions
  })
})
\`\`\`

## 提交规范

使用Conventional Commits:

\`\`\`
feat: 添加新功能
fix: 修复bug
docs: 文档更新
test: 测试相关
refactor: 重构
perf: 性能优化
chore: 构建/工具相关
\`\`\`

示例:
\`\`\`
feat(tools): add weather query tool
fix(llm): handle timeout error correctly
docs(api): update API documentation
\`\`\`

## Pull Request

### 标题

- 清晰描述变更内容
- 关联Issue: `feat: add feature (#123)`

### 描述

- 变更内容
- 测试情况
- 相关Issue
- 截图（如有）

### 检查清单

- [ ] 代码遵循规范
- [ ] 添加了测试
- [ ] 测试通过
- [ ] 文档已更新
- [ ] 无breaking changes（或已说明）

## 发布流程

1. 更新版本号
2. 更新CHANGELOG
3. 创建Git tag
4. 发布到npm

## 问题反馈

- Bug报告: 使用Issue模板
- 功能请求: 详细描述用例
- 问题讨论: 使用Discussions
```

**开发者文档 (docs/development/architecture.md)**:
```markdown
# 架构文档

## 系统架构

\`\`\`
┌─────────────────────────────────────┐
│           CLI Layer                  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         Agent Core Layer             │
│  ┌──────┐  ┌──────┐  ┌──────┐      │
│  │Planner│→│Executor│→│Reflector│   │
│  └──────┘  └──────┘  └──────┘      │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│        Tool System Layer             │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│     Infrastructure Layer             │
│  LLM | Logger | Config | Storage     │
└─────────────────────────────────────┘
\`\`\`

## 核心模块

### Agent

主控制器，协调各组件完成任务。

### Planner

任务规划器，分析任务并生成执行计划。

### Executor

任务执行器，调用工具完成具体操作。

### Reflector

反思评估器，评估执行结果并提出改进建议。

## 设计模式

### 策略模式

LLM客户端使用策略模式支持多Provider。

### 工厂模式

LLMClientFactory创建不同Provider的客户端。

### 观察者模式

EventEmitter实现事件通知机制。

### 模板方法模式

BaseTool定义工具执行模板。

## 扩展点

### 自定义工具

继承BaseTool实现自定义工具。

### 自定义LLM Provider

实现ILLMClient接口。

### 自定义存储

实现IStorage接口。
```

**验收标准**:
- [ ] 贡献指南完整
- [ ] 开发流程清晰
- [ ] 代码规范明确
- [ ] 架构文档详细

---

## 依赖关系
- 依赖所有前置TODO（需要完整系统）
- TODO 9.1 是其他TODO的基础

## 风险与缓解
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 文档过时 | 中 | 自动化文档生成 |
| 示例不可用 | 中 | CI中运行示例 |
| 贡献门槛高 | 低 | 详细的入门指南 |

## 完成标准
- [ ] 所有5个内部TODO完成
- [ ] API文档完整
- [ ] 用户指南清晰
- [ ] 示例可运行
