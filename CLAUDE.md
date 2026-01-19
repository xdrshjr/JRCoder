# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenJRAgent is an automated programming agent built with TypeScript that uses intelligent planning, tool execution, and reflection loops to accomplish complex programming tasks. It follows a multi-agent architecture with three specialized roles: Planner, Executor, and Reflector.

## Build and Development Commands

```bash
# Build the project
npm run build

# Build and watch for changes
npm run build:watch

# Run in development mode
npm run dev

# Start the built CLI
npm start

# Clean build artifacts
npm run clean
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test:watch

# Run tests with coverage
npm test:coverage
```

Test files are located in:
- `src/__tests__/` - Unit tests alongside source code
- `tests/` - Integration and end-to-end tests

Jest configuration:
- Test files: `**/__tests__/**/*.ts`, `**/*.test.ts`, `**/*.spec.ts`
- Coverage threshold: 80% for branches, functions, lines, and statements
- Test timeout: 10 seconds
- Setup file: `tests/setup.ts`

## Code Quality

```bash
# Lint code
npm run lint

# Lint and auto-fix issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting without modifying files
npm run format:check
```

## CLI Usage

The CLI binary is `openjragent` (defined in package.json bin field).

```bash
# Run agent with a task
openjragent run "task description"

# Run with custom configuration
openjragent run "task" --config ./my-config.json

# Run with specific options
openjragent run "task" \
  --max-iterations 20 \
  --planner-model gpt-4 \
  --log-level debug \
  --no-reflection

# Resume from saved session
openjragent run "task" --resume <sessionId>

# Use configuration preset
openjragent run "task" --preset quality

# View configuration
openjragent config:show

# Export configuration
openjragent config:export -o my-config.json

# View logs
openjragent logs --tail 100 --follow

# Generate execution report
openjragent report --session <id> --format markdown

# List all sessions
openjragent sessions
```

## Architecture

### Multi-Agent System

The system operates in a loop with four phases:

1. **Planning Phase** (Planner)
   - Analyzes task complexity
   - For simple tasks: returns direct answer
   - For complex tasks: generates execution plan with TODO list
   - Located in: `src/core/planner.ts`

2. **User Confirmation Phase**
   - Displays execution plan to user
   - Waits for confirmation/modification/cancellation
   - Can be disabled with `--no-confirmation`

3. **Execution Phase** (Executor)
   - Executes tasks sequentially from the plan
   - Calls tools via LLM function calling
   - Updates task status (pending → in_progress → completed/failed)
   - Located in: `src/core/executor.ts`

4. **Reflection Phase** (Reflector)
   - Evaluates execution results
   - Determines if goal is achieved
   - Identifies issues and suggests improvements
   - Can trigger replanning if needed
   - Located in: `src/core/reflector.ts`

### Core Components

- **Agent** (`src/core/agent.ts`): Main loop controller orchestrating all phases
- **State Manager** (`src/core/state.ts`): Manages agent state throughout execution
- **Event Emitter** (`src/core/event-emitter.ts`): Event-driven communication between components
- **Tool Manager** (`src/tools/manager.ts`): Manages tool registration and execution
- **LLM Manager** (`src/llm/manager.ts`): Manages multiple LLM clients for different roles

### Tool System

All tools inherit from `BaseTool` (`src/tools/base.ts`) and implement:
- `execute(args)`: Main execution logic
- `validate(args)`: Parameter validation
- `getDefinition()`: Returns tool definition for LLM function calling

Available tools (in `src/tools/`):
- `code-query.ts`: Search for functions, classes, and files in codebase
- `file-ops.ts`: Read, write, and list files
- `snippet.ts`: Save, load, and list reusable code snippets
- `shell.ts`: Execute shell commands (marked as dangerous)
- `ask-user.ts`: Interactive user prompts

Tools marked as `dangerous: true` require user confirmation when `cli.confirmDangerous` is enabled.

### LLM Client Architecture

The system supports multiple LLM providers through a unified interface (`ILLMClient` in `src/llm/types.ts`):

- **OpenAI** (`src/llm/openai.ts`): GPT-4, GPT-3.5-turbo
- **Anthropic** (`src/llm/anthropic.ts`): Claude models
- **Ollama** (`src/llm/ollama.ts`): Local models

Each agent role (Planner/Executor/Reflector) can use a different model for cost optimization. The Executor typically uses the most capable model, while the Reflector can use a smaller model.

### Error Handling System

Comprehensive error handling with four error categories:
- **RECOVERABLE**: Can be handled and execution continues
- **TRANSIENT**: Temporary errors that can be retried (timeouts, rate limits)
- **PERMANENT**: Cannot be retried (invalid config, tool not found)
- **CRITICAL**: Requires immediate termination (security errors)

Key components (in `src/core/`):
- `error-handler.ts`: Central error handling logic
- `retry-manager.ts`: Retry strategies (exponential, linear, fixed, adaptive)
- `fallback-manager.ts`: LLM and tool fallback mechanisms
- `state-snapshot.ts`: State rollback capabilities
- `session-manager.ts`: Session persistence and recovery

## Configuration

Configuration is loaded from multiple sources (in order of precedence):
1. Command-line arguments
2. Custom config file (via `--config`)
3. `.openjragent.json` in project root
4. `config/default.json`
5. Environment variables (`.env` file)

### Configuration Presets

- **fast**: Small models, no reflection (quick results)
- **quality**: Large models, all features enabled (best quality)
- **local**: Use Ollama local models (privacy-focused)
- **economy**: Minimize cost while maintaining quality

### Key Configuration Sections

- `agent`: Max iterations, reflection, confirmation, auto-save
- `llm`: Separate configs for planner/executor/reflector (provider, model, temperature, tokens, timeout)
- `tools`: Enabled tools, workspace directory, file size limits, allowed extensions
- `logging`: Level, output directory, console/file output, format
- `cli`: Theme, progress display, dangerous operation confirmation
- `retry`: Max retries, delays, strategy (exponential/linear/fixed/adaptive)
- `errorHandling`: Auto-retry, state rollback, fallback, snapshot management

## State Management

The agent maintains state throughout execution:
- Current phase (planning/confirming/executing/reflecting/completed)
- Current iteration count
- Execution plan with task statuses
- Conversation history (messages exchanged with LLMs)
- Tool call history

State can be:
- Saved to disk (auto-save every 60s by default)
- Restored from saved sessions (via `--resume`)
- Rolled back to snapshots on errors (if `enableStateRollback: true`)

## File Structure Conventions

- `src/core/`: Agent core logic (planner, executor, reflector, state management)
- `src/tools/`: Tool implementations
- `src/llm/`: LLM client adapters
- `src/cli/`: CLI interface and commands
- `src/config/`: Configuration loading and validation
- `src/logger/`: Logging system
- `src/storage/`: Storage implementations (memory, file)
- `src/types/`: TypeScript type definitions
- `src/__tests__/`: Unit tests
- `tests/`: Integration tests
- `docs/`: Technical documentation (architecture, design docs, TODOs)
- `config/`: Configuration files
- `logs/`: Log output directory
- `.workspace/`: Working directory for snippets and sessions

## Important Implementation Details

### Tool Execution Flow

1. LLM returns tool calls in response
2. Executor validates tool arguments using `tool.validate()`
3. If tool is dangerous and `confirmDangerous` is enabled, prompt user
4. Execute tool via `tool.execute()`
5. Log tool call and result
6. Return tool results to LLM for final response

### Conversation Context

The Executor maintains full conversation history including:
- System prompts
- User messages
- Assistant responses
- Tool calls and results

This context is passed to the LLM on each turn to maintain coherence.

### Iteration Limits

The agent has a maximum iteration count (`maxIterations`, default 10) to prevent infinite loops. Each iteration includes:
1. Planning (or replanning)
2. User confirmation (if enabled)
3. Execution
4. Reflection (if enabled)

If max iterations is reached, the agent terminates with a summary of progress.

## Development Notes

- The project uses strict TypeScript configuration with `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`
- All async operations should have proper error handling
- Tools should validate inputs before execution
- Dangerous operations (file writes, shell commands) should be marked with `dangerous: true`
- LLM requests should include timeout configuration
- State should be saved regularly to support recovery from crashes
- Use the logger for all significant events (don't use console.log directly except in CLI display code)
