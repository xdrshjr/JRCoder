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
openjragent run "Implement user login functionality"

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

🚧 **Current Status**: Infrastructure setup complete (TODO-01)

Completed:
- ✅ Project scaffolding
- ✅ Configuration system
- ✅ Logging system
- ✅ Error handling
- ✅ Storage system

Next steps:
- ⏳ Tool system implementation
- ⏳ LLM client adapters
- ⏳ Agent core (Planner, Executor, Reflector)
- ⏳ CLI interface
