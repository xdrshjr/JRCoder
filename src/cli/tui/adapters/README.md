# TUI Adapters

TUI Adapters connect the Agent's core components to the TUI event bus, enabling real-time visualization of the agent's execution process.

## Overview

The adapter system provides four specialized adapters:

1. **ThinkingAdapter** - Monitors and displays thinking processes from Planner and Reflector
2. **ToolAdapter** - Tracks and visualizes tool calls and their lifecycle
3. **BashAdapter** - Handles shell command execution display
4. **LogAdapter** - Integrates the logging system with TUI

## Architecture

```
Agent (EventEmitter)
    ↓ events
Adapters
    ↓ TUI events
TUIEventBus
    ↓ render
TUI Components
```

## Usage

### Basic Setup

```typescript
import { Agent } from './core/agent';
import { TUIEventBus } from './cli/tui/event-bus';
import {
  ThinkingAdapter,
  ToolAdapter,
  BashAdapter,
  LogAdapter,
} from './cli/tui/adapters';
import { Logger } from './logger';

// Create instances
const logger = new Logger(config);
const agent = new Agent(config, logger);
const tuiEventBus = new TUIEventBus(logger);

// Create adapters
const thinkingAdapter = new ThinkingAdapter(tuiEventBus, logger);
const toolAdapter = new ToolAdapter(tuiEventBus, logger);
const bashAdapter = new BashAdapter(tuiEventBus, logger);
const logAdapter = new LogAdapter(tuiEventBus, logger);

// Connect adapters to agent
const agentEventEmitter = agent.getEventEmitter();
thinkingAdapter.connect(agentEventEmitter);
toolAdapter.connect(agentEventEmitter);
bashAdapter.connect(agentEventEmitter);
logAdapter.connect(agentEventEmitter);

// Run agent
await agent.run('Your task here');
```

### ThinkingAdapter

Monitors Planner and Reflector thinking processes.

**Events Emitted:**
- `agent:thinking` - When the agent is thinking (with source: 'planner' | 'reflector' | 'executor')

**Methods:**
```typescript
// Manual emission
thinkingAdapter.emitPlannerThinking('Analyzing task complexity...');
thinkingAdapter.emitReflectorThinking('Evaluating results...');
thinkingAdapter.emitExecutorThinking('Processing task...');

// Disconnect
thinkingAdapter.disconnect();
```

**Logging:**
- Debug: Initialization, event emission details
- Info: Connection status, disconnection

### ToolAdapter

Tracks tool call lifecycle (start, running, completed, failed).

**Events Emitted:**
- `tool:call` - When a tool is called (id, toolName, args)
- `tool:result` - When a tool completes (id, success, result, error)

**Methods:**
```typescript
// Manual emission
toolAdapter.emitToolCall(id, 'file_read', { path: './file.txt' });
toolAdapter.emitToolResult(id, true, 'File content here');

// Status checks
const isActive = toolAdapter.isToolCallActive(toolCallId);
const count = toolAdapter.getActiveToolCallsCount();

// Disconnect
toolAdapter.disconnect();
```

**Logging:**
- Info: Tool call started/completed, execution time
- Debug: Activity added/updated in TUI

### BashAdapter

Handles shell command execution display.

**Events Emitted:**
- `bash:start` - When a bash command starts (id, command)
- `bash:output` - When bash output is received (id, line)
- `bash:complete` - When bash command completes (id, exitCode)

**Methods:**
```typescript
// Manual emission
bashAdapter.emitBashStart(id, 'npm install');
bashAdapter.emitBashOutput(id, 'Installing dependencies...');
bashAdapter.emitBashComplete(id, 0);

// Status checks
const isActive = bashAdapter.isBashCommandActive(id);
const count = bashAdapter.getActiveBashCommandsCount();

// Disconnect
bashAdapter.disconnect();
```

**Logging:**
- Info: Command started/completed, exit code
- Debug: Activity added/updated in TUI

**Features:**
- Automatic stdout/stderr formatting
- Output truncation for long outputs (max 1000 characters)
- Exit code tracking

### LogAdapter

Integrates the logging system with TUI, filtering important log events.

**Events Emitted:**
- `activity:add` - Adds log/message activities to TUI

**Important Log Types** (configurable):
- `task_start`
- `task_complete`
- `phase_change`
- `iteration_start`
- `iteration_complete`
- `agent_started`
- `agent_completed`
- `agent_failed`

**Methods:**
```typescript
// Manual emission
logAdapter.emitLogActivity('info', 'Custom log message', { key: 'value' });

// Manage important log types
logAdapter.addImportantLogType('custom_event');
logAdapter.removeImportantLogType('task_start');
const types = logAdapter.getImportantLogTypes();

// Disconnect
logAdapter.disconnect();
```

**Logging:**
- Info: Event handling (phase change, task start/complete, iteration)
- Debug: Log type management
- Error: Agent errors

## Event Flow

### Tool Call Example

```
1. Executor calls tool
   ↓
2. Executor emits 'tool_called' event
   ↓
3. ToolAdapter handles event
   ↓
4. ToolAdapter emits 'tool:call' to TUIEventBus
   ↓
5. TUI App receives event and updates UI
   ↓
6. Tool executes
   ↓
7. Executor emits 'tool_completed' event
   ↓
8. ToolAdapter handles event
   ↓
9. ToolAdapter emits 'tool:result' to TUIEventBus
   ↓
10. TUI App receives event and updates UI
```

## Logging Standards

All adapters follow these logging conventions:

- **Debug**: Initialization, detailed event processing, internal state changes
- **Info**: Connection/disconnection, major events (tool calls, phase changes)
- **Warn**: Unexpected but recoverable situations
- **Error**: Errors in event handling

Each log entry includes:
- Descriptive message
- `type` field for log categorization
- Relevant context data (IDs, counts, statuses)

## Testing

Run adapter tests:

```bash
npm test -- src/cli/tui/adapters/__tests__
```

Each adapter has comprehensive tests covering:
- Initialization
- Event emission
- Event handling
- Connection/disconnection
- Error scenarios

## Best Practices

1. **Always connect adapters before running the agent**
   ```typescript
   // Good
   adapter.connect(agentEventEmitter);
   await agent.run(task);

   // Bad
   await agent.run(task);
   adapter.connect(agentEventEmitter); // Too late!
   ```

2. **Disconnect adapters when done**
   ```typescript
   try {
     await agent.run(task);
   } finally {
     thinkingAdapter.disconnect();
     toolAdapter.disconnect();
     bashAdapter.disconnect();
     logAdapter.disconnect();
   }
   ```

3. **Use manual emission sparingly**
   - Manual emission methods are for testing and special cases
   - Let the agent emit events automatically in production

4. **Monitor adapter status**
   ```typescript
   // Check if tools/bash commands are still active
   if (toolAdapter.getActiveToolCallsCount() > 0) {
     console.log('Tools still running...');
   }
   ```

5. **Customize log filtering**
   ```typescript
   // Only show critical events
   logAdapter.removeImportantLogType('iteration_start');
   logAdapter.addImportantLogType('critical_error');
   ```

## Troubleshooting

### Events not appearing in TUI

1. Check adapter connection:
   ```typescript
   // Verify event emitter is connected
   const emitter = agent.getEventEmitter();
   console.log('Listener count:', emitter.listenerCount('tool_called'));
   ```

2. Check TUI event bus:
   ```typescript
   // Verify TUI is listening
   console.log('TUI listeners:', tuiEventBus.getEventTypes());
   ```

### Duplicate events

- Ensure adapters are only connected once
- Disconnect adapters before reconnecting

### Missing tool/bash events

- Verify the event is being emitted by the Executor
- Check that the adapter is connected to the correct event emitter
- Ensure StateManager's event emitter is being used

## Future Enhancements

Potential improvements for adapters:

1. **Buffering** - Buffer rapid events to prevent UI flooding
2. **Filtering** - More granular event filtering
3. **Metrics** - Track adapter performance and event counts
4. **Replay** - Record and replay events for debugging
5. **Streaming** - Support for real-time streaming output from bash commands
