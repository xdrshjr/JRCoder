# Agent 核心流程实现

## 概述

本项目实现了 OpenJRAgent 的核心 Agent 流程，包括：

- **Planner（规划器）**: 分析任务并生成执行计划
- **Executor（执行器）**: 执行任务并调用工具
- **Reflector（反思器）**: 评估执行结果并提出改进建议
- **StateManager（状态管理器）**: 管理 Agent 执行状态
- **Agent（主控制器）**: 协调规划-执行-反思循环

## 核心组件

### 1. StateManager（状态管理器）

管理 Agent 的执行状态，包括：
- 当前阶段（planning, executing, reflecting, confirming, completed, failed）
- 执行计划和任务列表
- 对话历史
- 迭代计数和元数据

```typescript
import { StateManager } from './core';

const stateManager = new StateManager(config, logger);
stateManager.updatePhase('planning');
stateManager.setPlan(plan);
```

### 2. Planner（规划器）

分析用户任务并生成执行计划：
- 判断任务复杂度（简单/复杂）
- 简单任务直接返回答案
- 复杂任务生成详细的任务列表

```typescript
import { Planner } from './core';

const planner = new Planner(llmClient, logger);
const result = await planner.plan(userTask, context);

if (result.type === 'direct_answer') {
  console.log(result.answer);
} else {
  // 执行计划
  executePlan(result.plan);
}
```

### 3. Executor（执行器）

执行计划中的任务：
- 按依赖顺序执行任务
- 调用合适的工具完成操作
- 处理工具调用结果
- 更新任务状态

```typescript
import { Executor } from './core';

const executor = new Executor(llmClient, toolManager, logger);
const result = await executor.execute(plan, context);

console.log(`Completed: ${result.completedTasks}`);
console.log(`Failed: ${result.failedTasks}`);
```

### 4. Reflector（反思器）

评估执行结果：
- 判断是否达成目标
- 识别执行中的问题
- 提出改进建议
- 决定下一步行动

```typescript
import { Reflector } from './core';

const reflector = new Reflector(llmClient, logger);
const result = await reflector.reflect(plan, executionResult, context);

if (result.nextAction === 'finish') {
  console.log('Task completed!');
} else if (result.nextAction === 'replan') {
  // 重新规划
}
```

### 5. Agent（主控制器）

协调整个执行流程：

```typescript
import { Agent } from './core';
import { Logger } from './logger';
import { ConfigLoader } from './config';

const config = ConfigLoader.load();
const logger = new Logger(config.logging);
const agent = new Agent(config, logger);

await agent.run('实现用户登录功能');
```

## 执行流程

```
用户输入任务
    ↓
┌─────────────────────────────────────┐
│  Phase 1: Planning (规划阶段)       │
│  - Planner 分析任务                 │
│  - 生成执行计划或直接回答           │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Phase 2: User Confirmation (确认)  │
│  - 展示执行计划                     │
│  - 等待用户确认/修改/取消           │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Phase 3: Executing (执行阶段)      │
│  - Executor 逐个执行任务            │
│  - 调用工具完成具体操作             │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Phase 4: Reflecting (反思阶段)     │
│  - Reflector 评估执行结果           │
│  - 判断是否达成目标                 │
│  - 提出改进建议                     │
└─────────────────────────────────────┘
    ↓
    ├─→ [目标达成] → 完成
    ├─→ [需要改进] → 返回 Planning
    └─→ [遇到阻塞] → 询问用户
```

## 配置

在 `.env` 文件中配置 API 密钥：

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-...

# Anthropic API Key (可选)
ANTHROPIC_API_KEY=sk-ant-...

# Agent 配置
AGENT_MAX_ITERATIONS=10
AGENT_ENABLE_REFLECTION=true
AGENT_REQUIRE_CONFIRMATION=true
```

## 使用示例

### 简单任务（直接回答）

```typescript
const agent = new Agent(config, logger);
await agent.run('什么是 TypeScript？');
// 输出: TypeScript 是 JavaScript 的超集...
```

### 复杂任务（生成计划）

```typescript
const agent = new Agent(config, logger);
await agent.run('实现一个用户登录功能');

// 输出:
// 📋 执行计划：
// 目标: 实现一个用户登录功能
//
// 1. 创建登录表单组件
//    设计并实现登录表单的 UI
// 2. 实现登录 API 接口
//    创建后端登录验证逻辑
// 3. 添加状态管理
//    使用 Redux/Context 管理登录状态
// ...
```

## 事件系统

Agent 支持事件监听：

```typescript
const agent = new Agent(config, logger);
const stateManager = agent.getStateManager();

stateManager.on('phase_changed', (event) => {
  console.log(`Phase changed to: ${event.data.phase}`);
});

stateManager.on('iteration_started', (event) => {
  console.log(`Iteration ${event.data.iteration} started`);
});

await agent.run(task);
```

## 状态持久化

Agent 会自动保存执行状态：

```typescript
// 状态会自动保存到 logs/session-{timestamp}.json
await agent.run(task);

// 手动保存状态
const stateManager = agent.getStateManager();
await stateManager.save('custom-path.json');

// 加载状态
await stateManager.load('custom-path.json');
```

## 测试

运行示例：

```bash
# 编译项目
npm run build

# 运行 Agent 示例
node dist/examples/agent-usage.js
```

## 架构特点

1. **模块化设计**: 每个组件职责单一，易于测试和扩展
2. **类型安全**: 完整的 TypeScript 类型定义
3. **事件驱动**: 支持事件监听和状态变化通知
4. **可配置**: 支持多层级配置和环境变量
5. **可观测**: 完整的日志记录和状态管理
6. **用户友好**: 支持用户确认和交互

## 下一步

- [ ] 添加更多工具支持
- [ ] 实现流式输出
- [ ] 添加并行任务执行
- [ ] 实现任务优先级调度
- [ ] 添加更多测试用例
