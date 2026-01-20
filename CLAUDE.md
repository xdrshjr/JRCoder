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
# Start TUI directly without task (recommended)
openjragent start

# Run agent with a task (uses modern TUI by default)
openjragent run "task description"

# Run with TUI interface (explicit)
openjragent run "task" --tui

# Run without TUI (legacy CLI mode)
openjragent run "task" --no-tui

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

# Start TUI with preset
openjragent start --preset quality

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

### TUI Keyboard Shortcuts

When running with TUI mode:
- **Enter**: Submit user input
- **Ctrl+C**: Exit the application
- **Ctrl+S**: Manually save current session
- **Ctrl+L**: Clear screen activities
- **Ctrl+P**: Pause/Resume agent execution
- **Ctrl+D**: Toggle debug mode
- **Ctrl+E**: Export logs to file
- **F1**: Show/Hide help overlay
- **↑/↓**: Navigate command history

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
- **TUI System** (`src/cli/tui/`): Modern text user interface for enhanced user experience

### TUI (Text User Interface) System

The TUI provides a modern, interactive interface similar to Claude Code and Gemini CLI. Built with ink (React for CLI) for a component-based architecture.

**Key Features:**
- **Real-time Status Display**: Header showing current phase, project info, and online status
- **Activity Stream**: Hierarchical display of agent thinking, tool calls, bash execution, and results
- **Interactive Input**: Advanced input box with command history, multiline support, and keyboard shortcuts
- **Session Management**: Automatic session saving/restoration and history tracking
- **Progress Tracking**: Status bar with task progress, token usage, and cost statistics
- **Debug Mode**: Optional debug overlay for development and troubleshooting

**TUI Components** (`src/cli/tui/components/`):
- `App.tsx`: Main application component with state management
- `Header.tsx`: Top bar with project name, version, phase indicator, and status
- `ContentArea.tsx`: Scrollable activity display area
- `ActivityItem.tsx`: Renders different activity types (thinking, tool calls, bash, messages, errors)
- `StatusBar.tsx`: Bottom bar with statistics (tasks, tokens, cost)
- `AdvancedInput.tsx`: Input box with history navigation and multiline mode
- `ErrorBoundary.tsx`: Error handling wrapper
- `LoadingIndicator.tsx`, `EmptyState.tsx`: UI state components

**TUI Architecture** (`src/cli/tui/`):
- `event-bus.ts`: Central event system for TUI updates
- `adapters/`: Connect Agent events to TUI
  - `ThinkingAdapter.ts`: Captures Planner/Reflector thinking process
  - `ToolAdapter.ts`: Monitors tool execution lifecycle
  - `BashAdapter.ts`: Streams bash command output
  - `LogAdapter.ts`: Filters and displays important logs
- `managers/`: Session and state management
  - `SessionHistoryManager.ts`: Command history persistence
  - `AutoSaveManager.ts`: Periodic state snapshots
- `hooks/`: Custom React hooks
  - `useKeyBindings.ts`: Keyboard shortcut handling
- `utils/`: Helper functions
  - `activityMerger.ts`: Merge similar activities to prevent UI clutter

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

### User Configuration System

OpenJRAgent uses a multi-layered configuration system with user-specific settings stored in `~/.openjragent/`.

**Directory Structure:**
```
~/.openjragent/
├── config.json          # Main user configuration
├── credentials.json     # Sensitive credentials (auto-separated, 0600 permissions)
├── presets/            # Custom configuration presets
└── backups/            # Automatic configuration backups (last 10 kept)
```

**First-Time Setup:**
When you first run OpenJRAgent, you'll be prompted to configure it:
```bash
openjragent init
```

This interactive wizard will:
1. Create the `~/.openjragent/` directory structure
2. Guide you through selecting an LLM provider
3. Collect API keys and base URLs
4. Configure models for Planner, Executor, and Reflector
5. Set agent parameters
6. Validate the configuration and test LLM connectivity

**Configuration Management Commands:**
```bash
openjragent init              # Run configuration wizard
openjragent config:show       # Display current configuration
openjragent config:edit       # Edit configuration interactively
openjragent config:validate   # Validate and test connection
openjragent config:export     # Export configuration (sanitized)
openjragent config:reset      # Reset to defaults with backup
```

**Configuration Priority:**
Configuration is loaded from multiple sources (in order of precedence):
1. Command-line arguments
2. Custom config file (via `--config`)
3. Environment variables (`.env` file)
4. User config (`~/.openjragent/config.json` - created by `openjragent init`)
5. Project config (`.openjragent.json` in project root)
6. Default config (`config/default.json`)

**Automatic Credential Separation:**
When saving configuration, API keys and base URLs are automatically:
- Extracted from the main config
- Saved to `credentials.json` with restricted permissions (0600)
- Merged back when loading configuration
- Never included in exported configurations or backups

**Installation Behavior:**
During `npm install`, a postinstall script automatically:
- Creates the `~/.openjragent/` directory structure
- Initializes a default config file (if none exists)
- Creates a README with configuration instructions

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
  - `src/cli/tui/`: Modern TUI system (ink + React)
    - `components/`: React components (Header, ContentArea, StatusBar, InputBox, ActivityItem, etc.)
    - `adapters/`: Event adapters connecting Agent to TUI (ThinkingAdapter, ToolAdapter, BashAdapter, LogAdapter)
    - `managers/`: Session and state management (SessionHistoryManager, AutoSaveManager)
    - `hooks/`: Custom React hooks (useKeyBindings)
    - `utils/`: Utility functions (activity merging, formatting)
    - `types.ts`: TUI-specific TypeScript types
    - `event-bus.ts`: Central event system
    - `index.ts`: Main TUI exports
- `src/config/`: Configuration loading and validation
- `src/logger/`: Logging system
- `src/storage/`: Storage implementations (memory, file)
- `src/types/`: TypeScript type definitions
- `src/__tests__/`: Unit tests
- `tests/`: Integration tests
- `docs/`: Technical documentation (architecture, design docs, TODOs)
  - `docs/base/`: Core architecture documentation
  - `docs/dev-plan/`: Development plans and roadmaps
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
- TUI components follow React best practices with hooks and functional components
- Event-driven architecture keeps TUI decoupled from core Agent logic
- Session management ensures user work is never lost with auto-save every 60 seconds
- DO NOT use emojis in log messages or user-facing text unless explicitly requested
