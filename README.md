# OpenJRAgent

OpenJRAgent is an automated programming agent built with TypeScript that uses intelligent planning, tool execution, and reflection loops to accomplish complex programming tasks.

## Features

- **Intelligent Task Planning**: Automatically judges task complexity and generates execution plans
- **Tool-based Execution**: Standardized tool interface supporting code queries, file operations, shell execution, and more
- **Reflection & Optimization**: Automatic evaluation after execution with iterative improvements
- **Multi-Model Support**: Planner/Executor/Reflector can use different LLMs for cost optimization
- **User Interaction**: Pauses at critical points for user confirmation to ensure controllability

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

### Environment Variables

Create a `.env` file in the project root:

```bash
# LLM API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

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

### Configuration File

You can also use a configuration file (`.openjragent.json`):

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

## Usage

```bash
# Run agent with a task
openjragent run "Implement a python game about snake eating. set on the M:\tmp\TMP-PROJECT\TEST-01"

# Use a specific configuration file
openjragent run "Fix bug in checkout" --config ./my-config.json

# Override specific parameters
openjragent run "Add dark mode" \
  --max-iterations 20 \
  --planner-model gpt-4 \
  --log-level debug

# Use a preset configuration
openjragent run "Optimize performance" --preset quality

# Show current configuration
openjragent config:show

# Export configuration
openjragent config:export -o my-config.json
```

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
│   └── index.ts       # Entry point
├── config/            # Configuration files
├── docs/              # Documentation
├── tests/             # Test files
└── logs/              # Log output
```

## Architecture

OpenJRAgent follows a multi-agent architecture:

1. **Planner**: Analyzes tasks and generates execution plans
2. **Executor**: Executes tasks using available tools
3. **Reflector**: Evaluates results and suggests improvements

The agent operates in a loop:
```
Planning → User Confirmation → Execution → Reflection → (repeat if needed)
```

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

## Status

🚀 **Current Status**: Core infrastructure and systems complete

### Completed Modules

- ✅ **Project Infrastructure** (TODO-01)
  - Project scaffolding and build system
  - Configuration system with multi-layer support
  - Logging system with Winston
  - Storage system (file-based and in-memory)

- ✅ **Tool System** (TODO-03)
  - 9 standard tools (code query, file operations, snippets, shell, user interaction)
  - Tool manager with security validation
  - Path traversal protection and command validation
  - Dangerous operation confirmation

- ✅ **CLI Interface** (TODO-05)
  - Complete command framework (run, config, logs, report, sessions)
  - Interactive prompts with Inquirer.js
  - Progress visualization with Ora and cli-progress
  - Real-time log viewer
  - Report generator (Markdown/JSON/HTML)

- ✅ **Testing Infrastructure** (TODO-06)
  - Jest configuration with 80% coverage threshold
  - Unit, integration, E2E, and performance tests
  - Mock helpers for LLM clients and tools
  - Test utilities and examples

- ✅ **Error Handling & Recovery** (TODO-07)
  - 13 error types with 4 categories (recoverable, transient, permanent, critical)
  - Retry manager with 4 strategies (exponential, linear, fixed, adaptive)
  - State snapshot manager for rollback
  - Session manager for persistence
  - Fallback manager for graceful degradation

### In Progress

- ⏳ **LLM Client Adapters** (TODO-02)
  - OpenAI, Anthropic, and Ollama client implementations
  - LLM manager and factory pattern

- ⏳ **Agent Core** (TODO-04)
  - Planner, Executor, and Reflector implementation
  - Main agent loop and state management
  - Integration with tool system and LLM clients

### Next Steps

1. Complete LLM client implementations
2. Implement Agent core (Planner/Executor/Reflector)
3. Integration testing of complete workflow
4. Documentation and examples
5. Performance optimization
