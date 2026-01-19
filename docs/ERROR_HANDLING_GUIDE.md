# 错误处理与恢复机制使用指南

## 概述

OpenJRAgent 实现了完善的错误处理与恢复机制，包括：

- **错误分类系统**：将错误分为可恢复、临时、永久和严重四类
- **智能重试机制**：支持指数退避、线性退避、固定延迟和自适应策略
- **状态快照管理**：支持状态回滚和恢复
- **会话持久化**：支持会话保存、加载和自动保存
- **降级管理**：支持 LLM 和工具的降级处理

## 错误分类

### ErrorCategory 枚举

```typescript
enum ErrorCategory {
  RECOVERABLE = 'recoverable',  // 可恢复错误
  TRANSIENT = 'transient',      // 临时错误（可重试）
  PERMANENT = 'permanent',      // 永久错误
  CRITICAL = 'critical'         // 严重错误（需立即终止）
}
```

### 错误类型

- **LLMTimeoutError**: LLM 超时错误（临时错误，可重试）
- **LLMRateLimitError**: LLM 速率限制错误（临时错误，可重试）
- **LLMInvalidResponseError**: LLM 响应无效错误（可恢复错误）
- **ToolExecutionError**: 工具执行错误（可恢复错误）
- **ToolNotFoundError**: 工具未找到错误（永久错误）
- **ToolTimeoutError**: 工具超时错误（临时错误）
- **ConfigError**: 配置错误（永久错误）
- **SecurityError**: 安全错误（严重错误）

## 使用示例

### 1. 使用 ErrorHandler

```typescript
import { ErrorHandler, LLMTimeoutError } from './core';
import { Logger } from './logger';

const logger = new Logger(config.logging);
const errorHandler = new ErrorHandler(logger, {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 60000,
});

// 处理错误
try {
  // 执行某些操作
  throw new LLMTimeoutError('Request timed out');
} catch (error) {
  const result = await errorHandler.handle(error as Error, {
    phase: 'executing',
    iteration: 1,
    retryCount: 0,
  });

  if (result.action === 'retry') {
    console.log(`Will retry after ${result.delay}ms`);
    await sleep(result.delay);
    // 重试操作
  } else if (result.action === 'fail') {
    console.error('Operation failed permanently');
  }
}
```

### 2. 使用 RetryManager

```typescript
import { RetryManager } from './core';
import { Logger } from './logger';

const logger = new Logger(config.logging);
const retryManager = new RetryManager(logger, {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 60000,
  fixedDelay: 2000,
  strategy: 'exponential',
});

// 使用重试机制执行操作
const result = await retryManager.withRetry(
  async () => {
    // 执行可能失败的操作
    return await llmClient.chat(request);
  },
  {
    maxRetries: 5,
    strategy: 'adaptive',
  }
);
```

### 3. 使用 StateSnapshotManager

```typescript
import { StateSnapshotManager } from './core';
import { Logger } from './logger';

const logger = new Logger(config.logging);
const snapshotManager = new StateSnapshotManager(logger, 10);

// 创建快照
const snapshotId = snapshotManager.createSnapshot(
  currentState,
  'before_execution'
);

try {
  // 执行操作
  await executeTask();
} catch (error) {
  // 恢复到快照
  const restoredState = snapshotManager.restoreSnapshot(snapshotId);
  if (restoredState) {
    stateManager.setState(restoredState);
    console.log('State restored from snapshot');
  }
}

// 清理快照
snapshotManager.deleteSnapshot(snapshotId);
```

### 4. 使用 SessionManager

```typescript
import { SessionManager } from './core';
import { FileSessionStorage } from './storage';
import { Logger } from './logger';

const logger = new Logger(config.logging);
const storage = new FileSessionStorage('.workspace/sessions');
const sessionManager = new SessionManager(storage, logger);

// 保存会话
const sessionId = await sessionManager.saveSession(
  currentState,
  config
);
console.log(`Session saved: ${sessionId}`);

// 加载会话
const session = await sessionManager.loadSession(sessionId);
if (session) {
  console.log('Session loaded successfully');
  // 恢复状态
  stateManager.setState(session.state);
}

// 启动自动保存
const timer = sessionManager.startAutoSave(
  () => stateManager.getState(),
  () => config,
  sessionId,
  60000 // 每 60 秒保存一次
);

// 停止自动保存
sessionManager.stopAutoSave();
```

### 5. 使用 FallbackManager

```typescript
import { FallbackManager } from './core';
import { Logger } from './logger';

const logger = new Logger(config.logging);
const fallbackManager = new FallbackManager(logger);

// LLM 降级
const response = await fallbackManager.fallbackLLM(
  primaryLLMClient,
  fallbackLLMClient,
  request
);

// 工具降级
const result = await fallbackManager.fallbackTool(
  primaryTool,
  fallbackTool,
  args
);

// 部分失败容错
const results = await fallbackManager.toleratePartialFailure(
  [
    () => operation1(),
    () => operation2(),
    () => operation3(),
  ],
  0.5 // 至少 50% 成功
);
```

## 配置

### 在 config/default.json 中配置

```json
{
  "retry": {
    "maxRetries": 3,
    "baseDelay": 1000,
    "maxDelay": 60000,
    "fixedDelay": 2000,
    "strategy": "exponential"
  },
  "errorHandling": {
    "enableAutoRetry": true,
    "enableStateRollback": true,
    "enableFallback": true,
    "maxSnapshotAge": 3600000,
    "maxSnapshots": 10
  }
}
```

### 重试策略

- **exponential**: 指数退避（推荐）
- **linear**: 线性退避
- **fixed**: 固定延迟
- **adaptive**: 自适应（根据错误类型调整）

## 最佳实践

1. **使用合适的错误类型**：根据错误性质选择正确的错误类型
2. **设置合理的重试次数**：避免过多重试导致资源浪费
3. **定期清理快照**：避免内存占用过大
4. **启用自动保存**：防止意外中断导致数据丢失
5. **使用降级策略**：提高系统可用性

## 注意事项

- 临时错误会自动重试，但有最大重试次数限制
- 永久错误不会重试，需要修复根本原因
- 严重错误会立即终止执行
- 状态快照会占用内存，需要定期清理
- 会话文件会占用磁盘空间，需要定期清理旧会话
