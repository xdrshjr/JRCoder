#!/usr/bin/env node

/**
 * Post-install script to initialize user configuration directory
 * This script runs automatically after npm install
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_CONFIG_DIR = path.join(os.homedir(), '.openjragent');
const USER_CONFIG_FILE = path.join(USER_CONFIG_DIR, 'config.json');
const PRESETS_DIR = path.join(USER_CONFIG_DIR, 'presets');
const BACKUPS_DIR = path.join(USER_CONFIG_DIR, 'backups');

/**
 * Ensure a directory exists
 */
function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }
  return false;
}

/**
 * Initialize user configuration directory structure
 */
function initializeUserConfig() {
  try {
    console.log('\n=== OpenJRAgent Post-Install Setup ===\n');

    // Create user config directory structure
    const dirCreated = ensureDirSync(USER_CONFIG_DIR);
    ensureDirSync(PRESETS_DIR);
    ensureDirSync(BACKUPS_DIR);

    if (dirCreated) {
      console.log(`✓ Created user configuration directory: ${USER_CONFIG_DIR}`);
    } else {
      console.log(`✓ User configuration directory already exists: ${USER_CONFIG_DIR}`);
    }

    // Check if config file already exists
    if (fs.existsSync(USER_CONFIG_FILE)) {
      console.log('✓ Configuration file already exists, skipping initialization');
      console.log('\nNote: Run "openjragent init" to reconfigure at any time.\n');
      return;
    }

    // Create default user config file
    const defaultUserConfig = {
      llm: {
        planner: {
          apiKey: '',
          baseURL: '',
        },
        executor: {
          apiKey: '',
          baseURL: '',
        },
        reflector: {
          apiKey: '',
          baseURL: '',
        },
      },
    };

    fs.writeFileSync(USER_CONFIG_FILE, JSON.stringify(defaultUserConfig, null, 2), 'utf8');
    console.log(`✓ Created default configuration file: ${USER_CONFIG_FILE}`);

    // Create README in config directory
    const readmeContent = `# OpenJRAgent User Configuration

This directory stores your personal OpenJRAgent configuration.

## Configuration File

The main configuration is stored in \`config.json\`. You can edit this file to set your API keys and base URLs.

## Getting Started

Run the configuration wizard to set up your API keys:

\`\`\`bash
openjragent init
\`\`\`

This will guide you through:
- Selecting your LLM provider (OpenAI, Anthropic, or Ollama)
- Entering your API keys and base URLs
- Choosing models for Planner, Executor, and Reflector
- Setting agent parameters

## Manual Configuration

You can also manually edit \`config.json\`:

\`\`\`json
{
  "llm": {
    "planner": {
      "apiKey": "your-openai-api-key",
      "baseURL": "https://api.openai.com/v1"
    },
    "executor": {
      "apiKey": "your-openai-api-key",
      "baseURL": "https://api.openai.com/v1"
    },
    "reflector": {
      "apiKey": "your-openai-api-key",
      "baseURL": "https://api.openai.com/v1"
    }
  }
}
\`\`\`

## Environment Variables Alternative

You can also set API keys using environment variables:

\`\`\`bash
export OPENAI_API_KEY=sk-...
export OPENAI_BASE_URL=https://api.openai.com/v1
\`\`\`

## Configuration Priority

Configuration is loaded in this order (highest to lowest):
1. CLI arguments
2. Environment variables
3. User config file (\`~/.openjragent/config.json\`)
4. Project config files (\`.openjragent.json\`, \`config/local.json\`)
5. Default config (\`config/default.json\`)

## Available Commands

\`\`\`bash
# Run configuration wizard
openjragent init

# Validate configuration
openjragent config:validate

# Edit configuration
openjragent config:edit

# Show current configuration
openjragent config:show

# Export configuration
openjragent config:export -o my-config.json

# Reset to defaults
openjragent config:reset
\`\`\`

## Security

Make sure to keep your API keys private. Do not commit \`config.json\` to version control.

## Directory Structure

\`\`\`
~/.openjragent/
├── config.json          # Main configuration file
├── credentials.json     # Sensitive credentials (auto-generated)
├── presets/            # Custom configuration presets
└── backups/            # Configuration backups (last 10 kept)
\`\`\`

## Support

For more information, visit: https://github.com/yourusername/OpenJRAgent
`;

    fs.writeFileSync(path.join(USER_CONFIG_DIR, 'README.md'), readmeContent, 'utf8');
    console.log(`✓ Created README: ${path.join(USER_CONFIG_DIR, 'README.md')}`);

    console.log('\n=== Setup Complete ===\n');
    console.log('Next steps:');
    console.log('  1. Run: openjragent init');
    console.log('  2. Follow the wizard to configure your API keys');
    console.log('  3. Start using: openjragent start\n');
  } catch (error) {
    console.error('Error during post-install setup:', error.message);
    console.error('You can manually run "openjragent init" after installation.\n');
  }
}

// Run initialization
initializeUserConfig();
