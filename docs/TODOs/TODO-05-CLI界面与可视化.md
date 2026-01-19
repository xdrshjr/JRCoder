# TODO-05: CLI界面与可视化

## 目标
实现命令行界面，包括参数解析、交互式提示、进度可视化、实时日志展示和执行报告生成。

## 内部TODO列表

### TODO 5.1: CLI命令框架搭建
**优先级**: P0
**预期产出**: Commander.js命令行框架和参数解析

**核心实现**:
```typescript
// src/cli/index.ts
import { Command } from 'commander'

const program = new Command()

program
  .name('openjragent')
  .description('OpenJRAgent - Automated Programming Agent')
  .version('1.0.0')

// 主命令：运行Agent
program
  .command('run <task>')
  .description('Run agent with a task')
  .option('-c, --config <path>', 'Config file path')
  .option('--max-iterations <number>', 'Maximum iterations', parseInt)
  .option('--no-reflection', 'Disable reflection phase')
  .option('--no-confirmation', 'Skip user confirmation')
  .option('--planner-model <model>', 'Planner model name')
  .option('--executor-model <model>', 'Executor model name')
  .option('--reflector-model <model>', 'Reflector model name')
  .option('--log-level <level>', 'Log level (debug|info|warn|error)')
  .option('--workspace <path>', 'Workspace directory')
  .option('--resume <sessionId>', 'Resume from saved session')
  .option('--preset <name>', 'Use config preset (fast|quality|local|economy)')
  .action(async (task, options) => {
    await runCommand(task, options)
  })

// 配置管理命令
program
  .command('config:export')
  .description('Export current configuration')
  .option('-o, --output <path>', 'Output file path')
  .action(async (options) => {
    await exportConfig(options)
  })

program
  .command('config:show')
  .description('Show current configuration')
  .action(async () => {
    await showConfig()
  })

// 日志查看命令
program
  .command('logs')
  .description('View logs')
  .option('--tail <number>', 'Show last N lines', parseInt, 50)
  .option('--session <id>', 'Filter by session ID')
  .option('--level <level>', 'Filter by log level')
  .option('--follow', 'Follow log output')
  .action(async (options) => {
    await viewLogs(options)
  })

// 报告生成命令
program
  .command('report')
  .description('Generate execution report')
  .option('--session <id>', 'Session ID', { required: true })
  .option('--format <format>', 'Report format (markdown|json|html)', 'markdown')
  .option('-o, --output <path>', 'Output file path')
  .action(async (options) => {
    await generateReport(options)
  })

// 会话管理命令
program
  .command('sessions')
  .description('List all sessions')
  .action(async () => {
    await listSessions()
  })

program.parse(process.argv)
```

**命令实现**:
```typescript
// src/cli/commands.ts
async function runCommand(task: string, options: any): Promise<void> {
  // 1. 加载配置
  let config = ConfigLoader.load(options.config)

  // 2. 应用CLI参数覆盖
  config = applyCliOptions(config, options)

  // 3. 应用预设
  if (options.preset) {
    config = ConfigLoader.merge(config, CONFIG_PRESETS[options.preset])
  }

  // 4. 初始化Logger
  const logger = new Logger(config.logging)

  // 5. 恢复会话或创建新会话
  let agent: Agent
  if (options.resume) {
    agent = await Agent.resume(options.resume, config, logger)
  } else {
    agent = new Agent(config, logger)
  }

  // 6. 运行Agent
  await agent.run(task)
}

function applyCliOptions(config: GlobalConfig, options: any): GlobalConfig {
  if (options.maxIterations) {
    config.agent.maxIterations = options.maxIterations
  }
  if (options.reflection === false) {
    config.agent.enableReflection = false
  }
  if (options.confirmation === false) {
    config.agent.requireConfirmation = false
  }
  if (options.plannerModel) {
    config.llm.planner.model = options.plannerModel
  }
  if (options.executorModel) {
    config.llm.executor.model = options.executorModel
  }
  if (options.reflectorModel) {
    config.llm.reflector.model = options.reflectorModel
  }
  if (options.logLevel) {
    config.logging.level = options.logLevel
  }
  if (options.workspace) {
    config.tools.workspaceDir = options.workspace
  }

  return config
}
```

**验收标准**:
- [ ] 所有命令正常工作
- [ ] 参数解析正确
- [ ] 帮助信息完整
- [ ] 错误提示友好

---

### TODO 5.2: 交互式提示实现
**优先级**: P0
**预期产出**: 用户确认和输入交互

**核心实现**:
```typescript
// src/cli/prompts.ts
import inquirer from 'inquirer'
import chalk from 'chalk'

class PromptManager {
  // 计划确认
  async confirmPlan(plan: Plan): Promise<ConfirmationResult> {
    console.log(chalk.bold('\n📋 执行计划：\n'))
    console.log(chalk.cyan(`目标: ${plan.goal}\n`))

    plan.tasks.forEach((task, index) => {
      console.log(chalk.white(`${index + 1}. ${task.title}`))
      console.log(chalk.gray(`   ${task.description}`))
      if (task.dependencies.length > 0) {
        console.log(chalk.yellow(`   依赖: ${task.dependencies.join(', ')}`))
      }
    })

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
    ])

    if (answer.action === 'modify') {
      const modifications = await inquirer.prompt([
        {
          type: 'editor',
          name: 'newPlan',
          message: '请修改计划（JSON格式）：',
          default: JSON.stringify(plan, null, 2)
        }
      ])

      try {
        const modifiedPlan = JSON.parse(modifications.newPlan)
        return { action: 'replan', plan: modifiedPlan }
      } catch (error) {
        console.log(chalk.red('❌ 计划格式错误，请重试'))
        return this.confirmPlan(plan)
      }
    }

    return { action: answer.action }
  }

  // 危险操作确认
  async confirmDangerousOperation(
    toolName: string,
    args: any
  ): Promise<boolean> {
    console.log(chalk.yellow(`\n⚠️  危险操作: ${toolName}\n`))
    console.log(chalk.gray('参数：'))
    console.log(chalk.gray(JSON.stringify(args, null, 2)))

    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: '是否继续？',
        default: false
      }
    ])

    return answer.confirmed
  }

  // 用户输入
  async askUser(question: string, options?: string[]): Promise<string> {
    if (options && options.length > 0) {
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'response',
          message: question,
          choices: options
        }
      ])
      return answer.response
    } else {
      const answer = await inquirer.prompt([
        {
          type: 'input',
          name: 'response',
          message: question
        }
      ])
      return answer.response
    }
  }

  // 多选
  async selectMultiple(
    message: string,
    choices: string[]
  ): Promise<string[]> {
    const answer = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message,
        choices
      }
    ])
    return answer.selected
  }

  // 确认退出
  async confirmExit(): Promise<boolean> {
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'exit',
        message: '确定要退出吗？未保存的进度将丢失。',
        default: false
      }
    ])
    return answer.exit
  }
}
```

**验收标准**:
- [ ] 交互流程流畅
- [ ] 输入验证完善
- [ ] 错误处理友好
- [ ] 支持Ctrl+C中断

---

### TODO 5.3: 进度可视化实现
**优先级**: P1
**预期产出**: 加载动画、进度条、阶段显示

**核心实现**:
```typescript
// src/cli/display.ts
import ora from 'ora'
import cliProgress from 'cli-progress'
import chalk from 'chalk'

class DisplayManager {
  private spinner: ora.Ora | null = null
  private progressBar: cliProgress.SingleBar | null = null

  // 显示加载动画
  showSpinner(message: string): void {
    this.spinner = ora({
      text: message,
      spinner: 'dots',
      color: 'cyan'
    }).start()
  }

  updateSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.text = message
    }
  }

  succeedSpinner(message?: string): void {
    if (this.spinner) {
      this.spinner.succeed(message)
      this.spinner = null
    }
  }

  failSpinner(message?: string): void {
    if (this.spinner) {
      this.spinner.fail(message)
      this.spinner = null
    }
  }

  // 显示进度条
  showProgressBar(total: number, message: string): void {
    this.progressBar = new cliProgress.SingleBar({
      format: `${message} |${chalk.cyan('{bar}')}| {percentage}% | {value}/{total}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    })
    this.progressBar.start(total, 0)
  }

  updateProgressBar(current: number): void {
    if (this.progressBar) {
      this.progressBar.update(current)
    }
  }

  stopProgressBar(): void {
    if (this.progressBar) {
      this.progressBar.stop()
      this.progressBar = null
    }
  }

  // 显示阶段
  showPhase(phase: AgentPhase): void {
    const phaseIcons = {
      planning: '📋',
      executing: '⚙️',
      reflecting: '🤔',
      confirming: '❓',
      completed: '✅',
      failed: '❌'
    }

    const phaseNames = {
      planning: 'Planning',
      executing: 'Executing',
      reflecting: 'Reflecting',
      confirming: 'Confirming',
      completed: 'Completed',
      failed: 'Failed'
    }

    console.log(
      chalk.bold(`\n${phaseIcons[phase]} ${phaseNames[phase]}\n`)
    )
  }

  // 显示任务列表
  showTasks(plan: Plan): void {
    console.log(chalk.bold('\n📋 Tasks:\n'))

    plan.tasks.forEach((task, index) => {
      const statusIcon = {
        pending: '⏳',
        in_progress: '🔄',
        completed: '✅',
        failed: '❌',
        blocked: '🚫'
      }[task.status]

      const statusColor = {
        pending: chalk.gray,
        in_progress: chalk.cyan,
        completed: chalk.green,
        failed: chalk.red,
        blocked: chalk.yellow
      }[task.status]

      console.log(statusColor(`${index + 1}. ${statusIcon} ${task.title}`))

      if (task.description) {
        console.log(chalk.gray(`   ${task.description}`))
      }
    })

    console.log()
  }

  // 显示执行摘要
  showSummary(state: AgentState): void {
    console.log(chalk.bold('\n📊 Execution Summary\n'))

    const completedTasks = state.plan?.tasks.filter(t => t.status === 'completed').length || 0
    const totalTasks = state.plan?.tasks.length || 0

    console.log(chalk.cyan(`Tasks: ${completedTasks}/${totalTasks} completed`))
    console.log(chalk.cyan(`Iterations: ${state.currentIteration}/${state.maxIterations}`))
    console.log(chalk.cyan(`Total tokens: ${state.metadata.totalTokens}`))
    console.log(chalk.cyan(`Total cost: $${state.metadata.totalCost.toFixed(4)}`))
    console.log(chalk.cyan(`Tool calls: ${state.metadata.toolCallsCount}`))

    const duration = state.endTime ? state.endTime - state.startTime : Date.now() - state.startTime
    console.log(chalk.cyan(`Duration: ${(duration / 1000).toFixed(2)}s`))

    console.log()
  }

  // 显示错误
  showError(error: Error): void {
    console.log(chalk.red('\n❌ Error:\n'))
    console.log(chalk.red(error.message))

    if (error.stack) {
      console.log(chalk.gray('\nStack trace:'))
      console.log(chalk.gray(error.stack))
    }
  }
}
```

**验收标准**:
- [ ] 加载动画流畅
- [ ] 进度条更新及时
- [ ] 阶段切换清晰
- [ ] 颜色主题一致

---

### TODO 5.4: 实时日志展示
**优先级**: P1
**预期产出**: 控制台日志流和日志查看器

**核心实现**:
```typescript
// src/cli/log-viewer.ts
class LogViewer {
  private buffer: LogEntry[] = []
  private maxBufferSize = 100

  // 实时显示日志
  displayLog(entry: LogEntry): void {
    this.buffer.push(entry)

    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift()
    }

    const time = new Date(entry.timestamp).toLocaleTimeString()
    const levelColor = {
      debug: chalk.gray,
      info: chalk.cyan,
      warn: chalk.yellow,
      error: chalk.red
    }[entry.level]

    let output = `${chalk.gray(time)} ${levelColor(entry.level.toUpperCase())}: ${entry.message}`

    if (entry.context) {
      const contextStr = Object.entries(entry.context)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')
      output += chalk.gray(` [${contextStr}]`)
    }

    console.log(output)

    if (entry.level === 'debug' && entry.data) {
      console.log(chalk.gray(JSON.stringify(entry.data, null, 2)))
    }
  }

  // 查看历史日志
  async viewLogs(options: LogViewOptions): Promise<void> {
    const logFile = options.session
      ? `logs/session-${options.session}.log`
      : 'logs/combined.log'

    const content = await fs.readFile(logFile, 'utf8')
    const lines = content.split('\n').filter(l => l.trim())

    let entries = lines
      .map(line => {
        try {
          return JSON.parse(line) as LogEntry
        } catch {
          return null
        }
      })
      .filter(e => e !== null)

    // 过滤级别
    if (options.level) {
      entries = entries.filter(e => e.level === options.level)
    }

    // 限制数量
    if (options.tail) {
      entries = entries.slice(-options.tail)
    }

    // 显示
    entries.forEach(entry => this.displayLog(entry))

    // 跟踪模式
    if (options.follow) {
      await this.followLogs(logFile)
    }
  }

  private async followLogs(logFile: string): Promise<void> {
    const watcher = chokidar.watch(logFile, {
      persistent: true,
      ignoreInitial: true
    })

    watcher.on('change', async () => {
      // 读取新增内容
      const content = await fs.readFile(logFile, 'utf8')
      const lines = content.split('\n').filter(l => l.trim())
      const lastLine = lines[lines.length - 1]

      try {
        const entry = JSON.parse(lastLine) as LogEntry
        this.displayLog(entry)
      } catch {
        // 忽略解析错误
      }
    })

    // 等待Ctrl+C
    await new Promise(() => {})
  }
}
```

**验收标准**:
- [ ] 实时日志显示正常
- [ ] 日志过滤准确
- [ ] 跟踪模式工作
- [ ] 性能良好

---

### TODO 5.5: 执行报告生成
**优先级**: P1
**预期产出**: Markdown/JSON/HTML报告生成器

**核心实现**:
```typescript
// src/cli/report-generator.ts
class ReportGenerator {
  // 生成Markdown报告
  generateMarkdown(state: AgentState): string {
    const report: string[] = []

    report.push('# Agent Execution Report\n')
    report.push(`**Generated at**: ${new Date().toISOString()}\n`)

    // 概览
    report.push('## Overview\n')
    report.push(`- **Goal**: ${state.plan?.goal || 'N/A'}`)
    report.push(`- **Status**: ${state.phase}`)
    report.push(`- **Iterations**: ${state.currentIteration}/${state.maxIterations}`)
    report.push(`- **Duration**: ${this.formatDuration(state.endTime! - state.startTime)}`)
    report.push('')

    // 统计
    report.push('## Statistics\n')
    report.push(`- **Total tokens**: ${state.metadata.totalTokens}`)
    report.push(`- **Total cost**: $${state.metadata.totalCost.toFixed(4)}`)
    report.push(`- **Tool calls**: ${state.metadata.toolCallsCount}`)
    report.push('')

    // 任务列表
    if (state.plan) {
      report.push('## Tasks\n')
      state.plan.tasks.forEach((task, index) => {
        const statusEmoji = {
          pending: '⏳',
          in_progress: '🔄',
          completed: '✅',
          failed: '❌',
          blocked: '🚫'
        }[task.status]

        report.push(`### ${index + 1}. ${statusEmoji} ${task.title}\n`)
        report.push(`**Status**: ${task.status}`)
        report.push(`**Description**: ${task.description}`)

        if (task.result) {
          report.push(`**Result**: ${task.result}`)
        }

        if (task.error) {
          report.push(`**Error**: ${task.error}`)
        }

        report.push('')
      })
    }

    return report.join('\n')
  }

  // 生成JSON报告
  generateJSON(state: AgentState): string {
    return JSON.stringify(state, null, 2)
  }

  // 生成HTML报告
  generateHTML(state: AgentState): string {
    const markdown = this.generateMarkdown(state)
    const html = marked(markdown)

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Agent Execution Report</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    h2 { color: #666; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
  </style>
</head>
<body>
  ${html}
</body>
</html>
    `
  }

  // 保存报告
  async save(state: AgentState, format: 'markdown' | 'json' | 'html', outputPath?: string): Promise<string> {
    let content: string
    let ext: string

    switch (format) {
      case 'markdown':
        content = this.generateMarkdown(state)
        ext = 'md'
        break
      case 'json':
        content = this.generateJSON(state)
        ext = 'json'
        break
      case 'html':
        content = this.generateHTML(state)
        ext = 'html'
        break
    }

    const filepath = outputPath || `logs/report-${Date.now()}.${ext}`
    await fs.writeFile(filepath, content, 'utf8')

    console.log(chalk.green(`\n✅ Report saved to: ${filepath}\n`))

    return filepath
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }
}
```

**验收标准**:
- [ ] 三种格式报告正确生成
- [ ] 报告内容完整
- [ ] HTML样式美观
- [ ] 文件保存成功

---

## 依赖关系
- 依赖 TODO-01（配置、日志）
- 依赖 TODO-04（Agent核心）
- TODO 5.1 是其他TODO的基础

## 风险与缓解
| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 终端兼容性 | 中 | 测试多种终端 |
| 交互中断 | 中 | 保存状态机制 |
| 显示性能 | 低 | 限制输出频率 |
| 报告格式错误 | 低 | 模板验证 |

## 完成标准
- [ ] 所有5个内部TODO完成
- [ ] CLI命令全部可用
- [ ] 交互流程流畅
- [ ] 报告生成正确
