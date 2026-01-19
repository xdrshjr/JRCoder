# 工具系统核心实现 (TODO-03)

## 概述

本次实现完成了 OpenJRAgent 的工具系统核心功能，包括 9 个标准工具、工具管理器和安全验证机制。

## 已完成的任务

### ✅ TODO 3.1: 工具基类和接口定义

**文件**: `src/tools/base.ts`

实现了：
- `BaseTool` 抽象基类
- 参数验证逻辑
- LLM Function 定义生成
- 工具上下文接口

**核心功能**:
- 类型安全的参数验证
- 自动生成 OpenAI/Anthropic 兼容的工具定义
- 支持危险操作标记

### ✅ TODO 3.2: 代码查询和文件操作工具

**文件**:
- `src/tools/code-query.ts` - 代码查询工具
- `src/tools/file-ops.ts` - 文件操作工具

实现的工具：
1. **CodeQueryTool** - 使用 ripgrep 进行代码搜索
   - 支持按类型搜索（function, class, variable, file）
   - 提供上下文行
   - JSON 格式输出

2. **FileReadTool** - 读取文件
   - 路径安全验证
   - 文件大小限制
   - 多种编码支持

3. **FileWriteTool** - 写入文件
   - 标记为危险操作
   - 支持覆盖和追加模式
   - 自动创建目录

4. **FileListTool** - 列出文件
   - 支持递归列表
   - Glob 模式匹配
   - 文件元信息

### ✅ TODO 3.3: 代码片段管理工具

**文件**: `src/tools/snippet.ts`

实现的工具：
1. **SnippetSaveTool** - 保存代码片段
   - 自动语言检测
   - 标签支持
   - 唯一 ID 生成

2. **SnippetLoadTool** - 加载代码片段
   - 按 ID 或名称查找
   - 完整元数据返回

3. **SnippetListTool** - 列出代码片段
   - 按标签过滤
   - 按语言过滤

### ✅ TODO 3.4: Shell执行和用户交互工具

**文件**:
- `src/tools/shell.ts` - Shell 执行工具
- `src/tools/ask-user.ts` - 用户交互工具

实现的工具：
1. **ShellExecTool** - 执行 Shell 命令
   - 危险命令黑名单
   - 超时机制
   - 跨平台支持（Windows/Linux/Mac）

2. **AskUserTool** - 向用户提问
   - 多选题支持
   - 开放式问题
   - 使用 inquirer.js

### ✅ TODO 3.5: 工具管理器和验证器

**文件**:
- `src/tools/manager.ts` - 工具管理器
- `src/tools/validators.ts` - 安全验证器

实现的功能：
1. **ToolManager** - 工具管理器
   - 工具注册和获取
   - 参数验证
   - 危险操作确认
   - 执行时间统计
   - 批量执行支持

2. **安全验证器**:
   - `PathValidator` - 防止路径遍历攻击
   - `FileSizeValidator` - 文件大小限制
   - `CommandValidator` - 危险命令检测
   - `ExtensionValidator` - 文件扩展名验证

## 项目结构

```
src/tools/
├── base.ts              # 工具基类和接口
├── manager.ts           # 工具管理器
├── validators.ts        # 安全验证器
├── code-query.ts        # 代码查询工具
├── file-ops.ts          # 文件操作工具
├── snippet.ts           # 代码片段工具
├── shell.ts             # Shell 执行工具
├── ask-user.ts          # 用户交互工具
└── index.ts             # 模块导出
```

## 使用示例

### 基本使用

```typescript
import { ToolManager } from './tools/manager';
import { FileSnippetStorage } from './storage/snippet-storage';

// 初始化
const config = {
  enabled: ['file_read', 'file_write', 'shell_exec'],
  workspaceDir: '.workspace',
  maxFileSize: 10 * 1024 * 1024,
  allowedExtensions: ['.js', '.ts', '.txt'],
  shellTimeout: 30000,
  shellMaxBuffer: 10 * 1024 * 1024,
};

const snippetStorage = new FileSnippetStorage('.workspace/snippets');
const toolManager = new ToolManager(config, logger, snippetStorage);

// 执行工具
const result = await toolManager.execute({
  id: 'call-1',
  name: 'file_read',
  arguments: { path: 'example.txt' }
});

if (result.success) {
  console.log('Content:', result.data.content);
}
```

### 获取工具定义（用于 LLM）

```typescript
const definitions = toolManager.getDefinitions();
// 传递给 LLM API 的 tools 参数
```

## 安全特性

1. **路径安全**: 所有文件操作限制在工作目录内
2. **命令验证**: 阻止危险的 Shell 命令（rm -rf /, fork bomb 等）
3. **文件大小限制**: 防止读取过大文件
4. **危险操作确认**: 写入文件和执行命令需要用户确认
5. **参数验证**: 严格的类型和值验证

## 测试

测试文件: `src/__tests__/tools.test.ts`

运行测试:
```bash
npm test
```

测试覆盖：
- 工具注册和管理
- 文件读写操作
- 代码片段管理
- Shell 命令执行
- 参数验证
- 安全检查

## 性能指标

- 工具调用响应时间: < 5s
- 文件操作: < 1s（小文件）
- 代码搜索: < 3s（中等代码库）
- Shell 命令: 根据命令而定，有超时保护

## 依赖项

- `inquirer` - 用户交互
- `fs-extra` - 文件操作
- `child_process` - Shell 执行
- `crypto` - ID 生成

## 下一步

工具系统已完成，可以继续实现：
- TODO-02: Agent 核心（Planner, Executor, Reflector）
- TODO-04: LLM 客户端集成
- TODO-05: CLI 界面

## 验收标准

✅ 所有 9 个工具实现完成
✅ 安全测试通过（路径遍历、命令注入）
✅ 参数验证捕获所有错误
✅ 危险操作确认机制生效
✅ 执行时间统计准确
✅ 项目编译成功
✅ 代码符合 TypeScript 规范

## 示例运行

查看 `src/examples/tool-usage.ts` 获取完整的使用示例。

运行示例:
```bash
npm run build
node dist/examples/tool-usage.js
```
