# OpenJRAgent CLI 使用指南

## 概述

OpenJRAgent 提供了一个功能完整的命令行界面（CLI），支持任务执行、配置管理、日志查看和报告生成。

## 安装

```bash
npm install -g openjragent
```

或者在项目中本地安装：

```bash
npm install openjragent
```

## 基本用法

### 运行 Agent

```bash
# 基本用法
openjragent run "实现用户登录功能"

# 使用自定义配置文件
openjragent run "实现用户登录功能" --config ./my-config.json

# 指定最大迭代次数
openjragent run "修复 bug" --max-iterations 20

# 禁用反思和确认（快速模式）
openjragent run "修复 bug" --no-reflection --no-confirmation

# 使用配置预设
openjragent run "实现功能" --preset fast
openjragent run "实现功能" --preset quality
openjragent run "实现功能" --preset local
openjragent run "实现功能" --preset economy

# 指定不同的模型
openjragent run "实现功能" \
  --planner-model gpt-4 \
  --executor-model claude-3-opus \
  --reflector-model gpt-3.5-turbo

# 恢复之前的会话
openjragent run "继续任务" --resume session-123456

# 设置日志级别
openjragent run "实现功能" --log-level debug

# 指定工作目录
openjragent run "实现功能" --workspace ./my-workspace
```

### 配置管理

```bash
# 查看当前配置
openjragent config:show

# 使用自定义配置文件查看
openjragent config:show --config ./my-config.json

# 导出配置到文件
openjragent config:export --output ./exported-config.json

# 导出配置到控制台
openjragent config:export
```

### 日志查看

```bash
# 查看最近的日志（默认50行）
openjragent logs

# 查看最近100行日志
openjragent logs --tail 100

# 查看特定会话的日志
openjragent logs --session session-123456

# 按日志级别过滤
openjragent logs --level error

# 实时跟踪日志
openjragent logs --follow

# 组合使用
openjragent logs --session session-123456 --level debug --tail 200
```

### 报告生成

```bash
# 生成 Markdown 报告
openjragent report --session session-123456

# 生成 JSON 报告
openjragent report --session session-123456 --format json

# 生成 HTML 报告
openjragent report --session session-123456 --format html

# 指定输出路径
openjragent report --session session-123456 --output ./reports/my-report.md
```

### 会话管理

```bash
# 列出所有会话
openjragent sessions
```

## 配置预设

OpenJRAgent 提供了4种预设配置：

### 1. Fast（快速模式）
- 使用小模型（GPT-3.5）
- 禁用反思
- 最大迭代次数：5
- 适用场景：快速原型、简单任务

```bash
openjragent run "任务" --preset fast
```

### 2. Quality（高质量模式）
- 使用大模型（GPT-4、Claude Opus）
- 启用反思
- 最大迭代次数：15
- 适用场景：复杂任务、生产代码

```bash
openjragent run "任务" --preset quality
```

### 3. Local（本地模式）
- 使用 Ollama 本地模型
- 无需 API Key
- 适用场景：离线开发、隐私保护

```bash
openjragent run "任务" --preset local
```

### 4. Economy（经济模式）
- 使用小模型但启用反思
- 平衡成本和质量
- 适用场景：日常开发

```bash
openjragent run "任务" --preset economy
```

## 环境变量

在 `.env` 文件中配置：

```bash
# LLM API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# LLM Base URLs（可选）
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Agent 配置
AGENT_MAX_ITERATIONS=10
AGENT_ENABLE_REFLECTION=true
AGENT_REQUIRE_CONFIRMATION=true

# 日志配置
LOG_LEVEL=info
LOG_OUTPUT_DIR=logs

# 工具配置
TOOLS_WORKSPACE_DIR=.workspace
TOOLS_MAX_FILE_SIZE=10485760

# CLI 配置
CLI_THEME=dark
CLI_SHOW_PROGRESS=true
```

## 配置文件

创建 `.openjragent.json` 或 `config/local.json`：

```json
{
  "agent": {
    "maxIterations": 10,
    "enableReflection": true,
    "requireConfirmation": true
  },
  "llm": {
    "planner": {
      "provider": "openai",
      "model": "gpt-4-turbo-preview",
      "temperature": 0.7
    },
    "executor": {
      "provider": "anthropic",
      "model": "claude-3-opus-20240229",
      "temperature": 0.3
    },
    "reflector": {
      "provider": "openai",
      "model": "gpt-3.5-turbo",
      "temperature": 0.5
    }
  },
  "tools": {
    "enabled": [
      "code_query",
      "file_read",
      "file_write",
      "file_list",
      "snippet_save",
      "snippet_load",
      "snippet_list",
      "shell_exec",
      "ask_user"
    ],
    "workspaceDir": ".workspace"
  },
  "logging": {
    "level": "info",
    "outputDir": "logs"
  }
}
```

## 交互式功能

### 计划确认

当 `requireConfirmation` 启用时，Agent 会在执行前展示计划并等待确认：

```
📋 执行计划：

目标: 实现用户登录功能

1. 创建登录表单
   设计并实现登录UI组件

2. 实现登录 API
   创建后端登录接口

3. 集成前后端
   连接前端表单和后端API

? 请选择操作： (Use arrow keys)
❯ ✅ 确认执行
  ✏️  修改计划
  ❌ 取消
```

### 危险操作确认

执行危险操作（如文件写入、Shell命令）时会提示确认：

```
⚠️  危险操作: file_write

参数：
{
  "path": "src/index.ts",
  "content": "..."
}

? 是否继续？ (y/N)
```

### 用户输入

Agent 可以通过 `ask_user` 工具向用户提问：

```
? 请选择数据库类型： (Use arrow keys)
❯ PostgreSQL
  MySQL
  MongoDB
  SQLite
```

## 进度可视化

### 加载动画

```
⠋ Loading configuration...
✔ Configuration loaded
```

### 进度条

```
执行任务 |████████████████████████████████████████| 100% | 5/5
```

### 阶段显示

```
📋 Planning

⚙️ Executing

🤔 Reflecting

✅ Completed
```

### 执行摘要

```
📊 Execution Summary

Tasks: 5/5 completed
Iterations: 3/10
Total tokens: 12,345
Total cost: $0.1234
Tool calls: 15
Duration: 45.67s
```

## 日志格式

### 控制台输出

```
14:30:45 INFO: Task started [phase=executing iteration=1]
14:30:46 INFO: Tool called: file_read [type=tool_call]
14:30:47 INFO: Tool completed: file_read [type=tool_result]
```

### 文件输出（JSON）

```json
{
  "level": "info",
  "message": "Task started",
  "timestamp": 1234567890,
  "context": {
    "phase": "executing",
    "iteration": 1
  }
}
```

## 报告格式

### Markdown

```markdown
# Agent Execution Report

**Generated at**: 2024-01-20T14:30:00.000Z

## Overview

- **Goal**: 实现用户登录功能
- **Status**: completed
- **Iterations**: 3/10
- **Duration**: 45s

## Statistics

- **Total tokens**: 12,345
- **Total cost**: $0.1234
- **Tool calls**: 15

## Tasks

### 1. ✅ 创建登录表单

**Status**: completed
**Description**: 设计并实现登录UI组件
**Result**: 成功创建登录表单组件
```

### HTML

生成美观的 HTML 报告，包含样式和格式化。

### JSON

完整的 AgentState JSON 导出，包含所有执行细节。

## 故障排除

### 配置错误

```bash
# 验证配置
openjragent config:show

# 检查环境变量
echo $OPENAI_API_KEY
```

### 日志调试

```bash
# 启用 debug 日志
openjragent run "任务" --log-level debug

# 查看错误日志
openjragent logs --level error
```

### 会话恢复

```bash
# 列出所有会话
openjragent sessions

# 恢复特定会话
openjragent run "继续任务" --resume session-123456
```

## 最佳实践

1. **使用配置文件**：将常用配置保存到文件中，避免每次都输入参数
2. **选择合适的预设**：根据任务复杂度选择预设配置
3. **启用日志**：使用 `--log-level debug` 调试问题
4. **定期查看报告**：使用报告功能分析 Agent 性能
5. **保存重要会话**：使用会话管理功能保存和恢复工作进度

## 示例工作流

### 开发新功能

```bash
# 1. 使用高质量模式开发
openjragent run "实现用户认证功能" --preset quality

# 2. 查看执行日志
openjragent logs --session session-123456

# 3. 生成报告
openjragent report --session session-123456 --format html

# 4. 如果需要继续
openjragent run "添加单元测试" --resume session-123456
```

### 快速修复

```bash
# 使用快速模式修复 bug
openjragent run "修复登录按钮点击无响应" \
  --preset fast \
  --no-confirmation
```

### 本地开发

```bash
# 使用本地模型开发
openjragent run "重构代码" --preset local
```

## 更多信息

- GitHub: https://github.com/yourusername/openjragent
- 文档: https://openjragent.dev/docs
- 问题反馈: https://github.com/yourusername/openjragent/issues
