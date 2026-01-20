# OpenJRAgent

OpenJRAgent is an automated programming agent built with TypeScript that uses intelligent planning, tool execution, and reflection loops to accomplish complex programming tasks.

## Features

- **Modern TUI Interface**: Beautiful text-based UI with real-time status updates, similar to Claude Code and Gemini CLI
- **Intelligent Task Planning**: Automatically judges task complexity and generates execution plans
- **Tool-based Execution**: Standardized tool interface supporting code queries, file operations, shell execution, and more
- **Reflection & Optimization**: Automatic evaluation after execution with iterative improvements
- **Multi-Model Support**: Planner/Executor/Reflector can use different LLMs for cost optimization
- **Session Management**: Automatic session saving and restoration with command history
- **User Interaction**: Interactive interface with keyboard shortcuts and command history

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd OpenJRAgent

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

### Quick Start

First-time users should run the interactive configuration wizard:

```bash
openjragent init
```

This will guide you through:
1. Selecting your LLM provider (OpenAI, Anthropic, or Ollama)
2. Entering your API keys and base URLs
3. Choosing models for Planner, Executor, and Reflector
4. Setting agent parameters (max iterations, reflection, etc.)

Configuration is saved to `~/.openjragent/config.json`

### Configuration Management Commands

```bash
# Initialize or reconfigure
openjragent init

# Show current configuration
openjragent config:show

# Edit configuration interactively
openjragent config:edit

# Validate configuration and test LLM connection
openjragent config:validate

# Export configuration to a file
openjragent config:export -o my-config.json

# Reset to defaults (with backup)
openjragent config:reset
```

### User Configuration Directory

OpenJRAgent creates a configuration directory in your home folder:

```
~/.openjragent/
├── config.json          # Main configuration file
├── credentials.json     # Sensitive credentials (auto-generated)
├── presets/            # Custom configuration presets
└── backups/            # Configuration backups (last 10 kept)
```

### Configuration Priority

Configuration is loaded from multiple sources with the following priority (highest to lowest):

1. **Command-line arguments** - `--max-iterations`, `--planner-model`, etc.
2. **Custom config file** - via `--config <path>` argument
3. **Environment variables** - `OPENAI_API_KEY`, `AGENT_MAX_ITERATIONS`, etc.
4. **User config** - `~/.openjragent/config.json` (created by `openjragent init`)
5. **Project config** - `.openjragent.json` in project root
6. **Default config** - Built-in defaults

### Environment Variables

You can also use environment variables (create a `.env` file):

```bash
# LLM API Keys
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1

ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Agent Configuration
AGENT_MAX_ITERATIONS=10
AGENT_ENABLE_REFLECTION=true
AGENT_REQUIRE_CONFIRMATION=true

# Logging Configuration
LOG_LEVEL=info
LOG_OUTPUT_DIR=logs

# Tools Configuration
TOOLS_WORKSPACE_DIR=.workspace
```

### Project Configuration File

For project-specific settings, create `.openjragent.json` in your project root:

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
      "model": "gpt-4-turbo-preview"
    },
    "executor": {
      "provider": "openai",
      "model": "gpt-4-turbo-preview"
    },
    "reflector": {
      "provider": "openai",
      "model": "gpt-3.5-turbo"
    }
  }
}
```

**Note:** Do not commit API keys to version control. Use the user config (`~/.openjragent/config.json`) or environment variables for credentials.

### Security Best Practices

1. **Never commit API keys** - Use user config or environment variables
2. **Use credentials.json** - API keys are automatically separated into `~/.openjragent/credentials.json` with restricted permissions (0600)
3. **Keep backups** - Configuration changes are automatically backed up to `~/.openjragent/backups/`
4. **Validate configuration** - Run `openjragent config:validate` to test your setup

For more details, see [Configuration Guide](docs/Configuration.md).

## Usage

### Basic Usage

```bash
# Run agent with a task (uses modern TUI by default)
openjragent run "Implement a python game about snake eating, put it on tmp folder"

# Run with TUI interface (explicit)
openjragent run "Implement a python game about snake eating, put it on tmp folder" --tui

# Run without TUI (legacy CLI mode)
openjragent run "Add dark mode" --no-tui

# Use a specific configuration file
openjragent run "Optimize database queries" --config ./my-config.json

# Resume from a previous session
openjragent run "Continue previous task" --resume <sessionId>
```

### Advanced Usage

```bash
# Override specific parameters
openjragent run "Refactor authentication" \
  --max-iterations 20 \
  --planner-model gpt-4 \
  --log-level debug \
  --no-reflection

# Use a preset configuration
openjragent run "Optimize performance" --preset quality

# Show current configuration
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

When running with the TUI interface:
- **Enter**: Submit your message
- **Ctrl+C**: Exit the application
- **Ctrl+S**: Manually save current session
- **Ctrl+L**: Clear screen activities
- **Ctrl+P**: Pause/Resume agent execution
- **Ctrl+D**: Toggle debug mode
- **Ctrl+E**: Export logs to file
- **F1**: Show/Hide help overlay
- **↑/↓**: Navigate command history

## Development

```bash
# Run in development mode
npm run dev

# Build the project
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## Project Structure

```
OpenJRAgent/
├── src/
│   ├── core/          # Core modules (agent, planner, executor, reflector)
│   ├── tools/         # Tool system
│   ├── llm/           # LLM clients
│   ├── logger/        # Logging system
│   ├── config/        # Configuration system
│   ├── storage/       # Storage system
│   ├── cli/           # CLI interface
│   │   └── tui/       # Modern TUI system (ink + React)
│   │       ├── components/   # React components
│   │       ├── adapters/     # Event adapters
│   │       ├── managers/     # Session management
│   │       ├── hooks/        # Custom hooks
│   │       └── utils/        # Utilities
│   └── index.ts       # Entry point
├── config/            # Configuration files
├── docs/              # Documentation
│   ├── base/          # Architecture documentation
│   └── dev-plan/      # Development plans
├── tests/             # Test files
├── logs/              # Log output
└── .workspace/        # Working directory
```

## Architecture

OpenJRAgent follows a multi-agent architecture with a modern TUI interface:

### Core Agent System

1. **Planner**: Analyzes tasks and generates execution plans
2. **Executor**: Executes tasks using available tools
3. **Reflector**: Evaluates results and suggests improvements

The agent operates in a loop:
```
Planning → User Confirmation → Execution → Reflection → (repeat if needed)
```

### TUI System

The TUI provides a real-time, interactive interface built with ink (React for CLI):

**Interface Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Header: Project Info | Phase | Status                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Content Area: Activity Stream                           │
│   • Agent thinking process                              │
│   • Tool calls and results                              │
│   • Bash command execution                              │
│   • Messages and errors                                 │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ Status Bar: Tasks | Tokens | Cost                       │
├─────────────────────────────────────────────────────────┤
│ Input Box: Your message... (with shortcuts help)        │
└─────────────────────────────────────────────────────────┘
```

**Key Features:**
- Real-time activity streaming
- Automatic session saving every 60 seconds
- Command history navigation
- Debug mode for troubleshooting
- Keyboard shortcuts for common actions
- Error boundaries for stability

## Tools

Available tools:
- `code_query`: Search for functions, classes, and files in codebase
- `file_read`: Read file contents
- `file_write`: Write or create files
- `file_list`: List files in directory
- `snippet_save`: Save reusable code snippets
- `snippet_load`: Load saved code snippets
- `snippet_list`: List all saved snippets
- `shell_exec`: Execute shell commands
- `ask_user`: Ask user for input

## Configuration Presets

- **fast**: Small models, no reflection (quick results)
- **quality**: Large models, all features (best quality)
- **local**: Use Ollama local models (privacy)
- **economy**: Minimize cost while maintaining quality

## License

MIT

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.
