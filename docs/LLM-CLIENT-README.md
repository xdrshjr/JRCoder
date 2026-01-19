# LLM客户端抽象层实现

## 概述

LLM客户端抽象层提供了统一的接口来与不同的LLM提供商（OpenAI、Anthropic、Ollama）进行交互。该实现支持Function Calling、流式输出、自动重试和成本估算等功能。

## 架构

```
src/llm/
├── types.ts          # 类型定义和接口
├── client.ts         # BaseLLMClient抽象基类
├── openai.ts         # OpenAI客户端实现
├── anthropic.ts      # Anthropic (Claude) 客户端实现
├── ollama.ts         # Ollama本地模型客户端实现
├── factory.ts        # LLM客户端工厂
├── manager.ts        # LLM管理器（管理多个客户端实例）
└── index.ts          # 模块导出
```

## 核心功能

### 1. 统一的客户端接口 (ILLMClient)

所有LLM客户端都实现相同的接口：

```typescript
interface ILLMClient {
  chat(request: LLMRequest): Promise<LLMResponse>;
  chatStream(request: LLMRequest): AsyncGenerator<string>;
  estimateCost(tokens: number): number;
}
```

### 2. 支持的提供商

- **OpenAI**: GPT-4, GPT-3.5等模型
- **Anthropic**: Claude 3系列模型
- **Ollama**: 本地运行的开源模型（Llama, CodeLlama等）

### 3. 核心特性

- ✅ Function Calling标准化封装
- ✅ 流式和非流式输出
- ✅ 自动重试机制（指数退避）
- ✅ 成本估算
- ✅ 完整的日志记录
- ✅ 类型安全

## 使用示例

### 基本使用

```typescript
import { LLMClientFactory } from './llm';
import { Logger } from './logger';

// 创建配置
const config = {
  provider: 'openai',
  model: 'gpt-4-turbo-preview',
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
  maxTokens: 4096,
};

// 创建客户端
const logger = new Logger(/* ... */);
const client = LLMClientFactory.create(config, logger);

// 发送请求
const response = await client.chat({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.', timestamp: Date.now() },
    { role: 'user', content: 'Hello!', timestamp: Date.now() },
  ],
});

console.log(response.content);
```

### 使用LLM管理器

```typescript
import { LLMManager } from './llm';
import { GlobalConfig } from './types';

// 创建管理器（自动为planner、executor、reflector创建客户端）
const manager = new LLMManager(config, logger);

// 获取特定角色的客户端
const plannerClient = manager.getClient('planner');
const executorClient = manager.getClient('executor');
const reflectorClient = manager.getClient('reflector');

// 使用客户端
const response = await plannerClient.chat({
  messages: [/* ... */],
});

// 更新使用统计
manager.updateUsage('planner', response.usage.promptTokens, response.usage.completionTokens, cost);

// 获取总使用统计
const totalUsage = manager.getTotalUsage();
console.log(`Total tokens: ${totalUsage.totalTokens}`);
console.log(`Total cost: $${totalUsage.totalCost.toFixed(4)}`);
```

### Function Calling

```typescript
// 定义工具
const tools = [
  {
    name: 'get_weather',
    description: 'Get the current weather in a location',
    parameters: [
      {
        name: 'location',
        type: 'string',
        description: 'The city and state, e.g. San Francisco, CA',
        required: true,
      },
    ],
  },
];

// 发送带工具的请求
const response = await client.chat({
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?', timestamp: Date.now() },
  ],
  tools,
});

// 处理工具调用
if (response.toolCalls) {
  for (const toolCall of response.toolCalls) {
    console.log(`Tool: ${toolCall.name}`);
    console.log(`Arguments:`, toolCall.arguments);
  }
}
```

### 流式输出

```typescript
const stream = client.chatStream({
  messages: [
    { role: 'user', content: 'Write a short story', timestamp: Date.now() },
  ],
});

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

## 配置说明

### OpenAI配置

```typescript
{
  provider: 'openai',
  model: 'gpt-4-turbo-preview',
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1', // 可选
  temperature: 0.7,
  maxTokens: 4096,
  timeout: 60000,
}
```

### Anthropic配置

```typescript
{
  provider: 'anthropic',
  model: 'claude-3-opus-20240229',
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com', // 可选
  temperature: 0.7,
  maxTokens: 4096,
  timeout: 60000,
}
```

### Ollama配置

```typescript
{
  provider: 'ollama',
  model: 'llama3:70b',
  baseURL: 'http://localhost:11434', // Ollama服务地址
  temperature: 0.7,
  maxTokens: 4096,
  timeout: 60000,
}
```

## 错误处理

所有客户端都实现了自动重试机制：

- 429 (Rate Limit): 自动重试，指数退避
- 503 (Service Unavailable): 自动重试
- 超时错误: 自动重试
- 其他错误: 立即抛出

```typescript
try {
  const response = await client.chat(request);
} catch (error) {
  if (error instanceof LLMError) {
    console.error(`LLM Error: ${error.message}`);
    console.error(`Code: ${error.code}`);
    console.error(`Recoverable: ${error.recoverable}`);
  }
}
```

## 成本估算

```typescript
// 估算请求成本
const estimatedCost = client.estimateCost(5000); // 5000 tokens
console.log(`Estimated cost: $${estimatedCost.toFixed(4)}`);

// 实际成本（从响应中获取）
const response = await client.chat(request);
const actualCost = client.estimateCost(response.usage.totalTokens);
```

## 模型定价

### OpenAI
- GPT-4 Turbo: $0.01/1K input, $0.03/1K output
- GPT-3.5 Turbo: $0.0005/1K input, $0.0015/1K output

### Anthropic
- Claude 3 Opus: $0.015/1K input, $0.075/1K output
- Claude 3 Sonnet: $0.003/1K input, $0.015/1K output
- Claude 3 Haiku: $0.00025/1K input, $0.00125/1K output

### Ollama
- 本地模型: 免费

## 测试

```bash
# 运行测试
npm test

# 运行特定测试
npm test -- llm
```

## 扩展

要添加新的LLM提供商：

1. 创建新的客户端类继承`BaseLLMClient`
2. 实现`chat()`和`chatStream()`方法
3. 实现`getPricing()`方法
4. 在`LLMClientFactory`中注册新提供商

```typescript
export class NewProviderClient extends BaseLLMClient {
  async chat(request: LLMRequest): Promise<LLMResponse> {
    // 实现
  }

  async *chatStream(request: LLMRequest): AsyncGenerator<string> {
    // 实现
  }

  protected getPricing(): PricingInfo {
    return { input: 0.001, output: 0.002 };
  }
}
```

## 完成状态

✅ TODO 2.1: LLM客户端基类设计
✅ TODO 2.2: OpenAI客户端实现
✅ TODO 2.3: Anthropic客户端实现
✅ TODO 2.4: Ollama本地模型支持
✅ TODO 2.5: LLM客户端工厂和管理

所有功能已实现并通过编译测试。
