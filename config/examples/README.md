# Configuration Examples

This directory contains example configuration files for different use cases.

## Available Examples

### 1. OpenAI Configuration (`openai-example.json`)

Complete configuration using OpenAI's GPT models:
- Planner: GPT-4 Turbo
- Executor: GPT-4 Turbo
- Reflector: GPT-3.5 Turbo

**Best for:** High-quality results with OpenAI models

### 2. Anthropic Configuration (`anthropic-example.json`)

Complete configuration using Anthropic's Claude models:
- Planner: Claude 3 Sonnet
- Executor: Claude 3 Opus
- Reflector: Claude 3 Haiku

**Best for:** Excellent instruction following and cost optimization

### 3. Ollama Configuration (`ollama-example.json`)

Complete configuration using local Ollama models:
- Planner: CodeLlama
- Executor: CodeLlama
- Reflector: Llama2

**Best for:** Privacy-focused, no API costs, fully local

### 4. Mixed Providers Configuration (`mixed-providers-example.json`)

Configuration using different providers for different roles:
- Planner: OpenAI GPT-4 Turbo
- Executor: Anthropic Claude 3 Opus
- Reflector: OpenAI GPT-3.5 Turbo

**Best for:** Optimizing cost and performance per role

## How to Use

### Option 1: Project Configuration

Copy any example file to your project root as `.openjragent.json`:

```bash
cp config/examples/openai-example.json .openjragent.json
```

### Option 2: User Configuration

Use examples as reference when running the configuration wizard:

```bash
openjragent init
```

Or manually edit your user configuration:

```bash
# Copy example to user config directory
cp config/examples/openai-example.json ~/.openjragent/config.json

# Edit as needed
nano ~/.openjragent/config.json
```

### Option 3: Custom Config File

Use an example directly with the `--config` flag:

```bash
openjragent run "task" --config config/examples/openai-example.json
```

## Important Notes

1. **API Keys**: These examples do not include API keys. You must:
   - Run `openjragent init` to configure API keys interactively
   - Or manually add API keys to your user config (`~/.openjragent/config.json`)
   - Or set environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)

2. **Security**: Never commit files containing real API keys to version control.

3. **Customization**: Feel free to customize any values based on your needs.

4. **Validation**: After creating your configuration, validate it:
   ```bash
   openjragent config:validate
   ```

## Configuration Priority

When using these examples, remember the configuration priority:
1. Command-line arguments (highest)
2. Custom config file (via `--config`)
3. Environment variables
4. User config (`~/.openjragent/config.json`)
5. Project config (`.openjragent.json`)
6. Default config (lowest)

## Additional Resources

- [Configuration Guide](../../docs/Configuration.md) - Detailed documentation
- [README](../../README.md) - Quick start guide
- [CLAUDE.md](../../CLAUDE.md) - Developer guide
