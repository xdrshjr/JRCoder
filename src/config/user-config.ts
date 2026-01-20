/**
 * User configuration manager
 * Handles initialization and loading of user-specific configuration
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import type { DeepPartial, GlobalConfig } from '../types';

interface Credentials {
  openai?: {
    apiKey?: string;
    baseURL?: string;
  };
  anthropic?: {
    apiKey?: string;
    baseURL?: string;
  };
  ollama?: {
    baseURL?: string;
  };
}

export class UserConfigManager {
  private static readonly USER_CONFIG_DIR = path.join(os.homedir(), '.openjragent');
  private static readonly USER_CONFIG_FILE = path.join(this.USER_CONFIG_DIR, 'config.json');
  private static readonly CREDENTIALS_FILE = path.join(this.USER_CONFIG_DIR, 'credentials.json');
  private static readonly PRESETS_DIR = path.join(this.USER_CONFIG_DIR, 'presets');
  private static readonly BACKUPS_DIR = path.join(this.USER_CONFIG_DIR, 'backups');
  private static readonly MAX_BACKUPS = 10;

  /**
   * Initialize user configuration directory and config file
   * This should be called during installation
   */
  static async initialize(): Promise<void> {
    try {
      // Create user config directory structure
      await fs.ensureDir(this.USER_CONFIG_DIR);
      await fs.ensureDir(this.PRESETS_DIR);
      await fs.ensureDir(this.BACKUPS_DIR);

      // Check if config file already exists
      if (await fs.pathExists(this.USER_CONFIG_FILE)) {
        return;
      }

      // Create default user config
      const userConfig: DeepPartial<GlobalConfig> = {
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

      await fs.writeJSON(this.USER_CONFIG_FILE, userConfig, { spaces: 2 });

      // Create README in config directory
      const readmeContent = `# OpenJRAgent User Configuration

This directory stores your personal OpenJRAgent configuration.

## Configuration File

The main configuration is stored in \`config.json\`. You can edit this file to set your API keys and base URLs.

## Setting API Keys

Edit \`config.json\` and add your API keys:

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

## Security

Make sure to keep your API keys private. Do not commit \`config.json\` to version control.
`;

      await fs.writeFile(path.join(this.USER_CONFIG_DIR, 'README.md'), readmeContent, 'utf8');
    } catch (error) {
      throw new Error(
        `Failed to initialize user configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load user configuration and merge with credentials
   */
  static load(): DeepPartial<GlobalConfig> | null {
    try {
      if (!fs.existsSync(this.USER_CONFIG_FILE)) {
        return null;
      }

      const content = fs.readFileSync(this.USER_CONFIG_FILE, 'utf8');
      const config = JSON.parse(content);

      // Load and merge credentials
      const credentials = this.loadCredentialsSync();
      return this.mergeWithCredentials(config, credentials);
    } catch (error) {
      console.warn(`Warning: Failed to load user config from ${this.USER_CONFIG_FILE}:`, error);
      return null;
    }
  }

  /**
   * Save user configuration with credential separation and backup
   */
  static async save(config: DeepPartial<GlobalConfig>): Promise<void> {
    try {
      await fs.ensureDir(this.USER_CONFIG_DIR);

      // Backup existing config
      if (await fs.pathExists(this.USER_CONFIG_FILE)) {
        await this.backup();
      }

      // Separate credentials from config
      const { credentials, sanitized } = this.separateCredentials(config);

      // Save sanitized config
      await fs.writeJSON(this.USER_CONFIG_FILE, sanitized, { spaces: 2 });

      // Save credentials with restricted permissions
      await fs.writeJSON(this.CREDENTIALS_FILE, credentials, { spaces: 2, mode: 0o600 });
    } catch (error) {
      throw new Error(
        `Failed to save user configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get user config directory path
   */
  static getConfigDir(): string {
    return this.USER_CONFIG_DIR;
  }

  /**
   * Get user config file path
   */
  static getConfigPath(): string {
    return this.USER_CONFIG_FILE;
  }

  /**
   * Check if user config exists
   */
  static exists(): boolean {
    return fs.existsSync(this.USER_CONFIG_FILE);
  }

  /**
   * Remove user config file
   */
  static async remove(): Promise<void> {
    if (await fs.pathExists(this.USER_CONFIG_FILE)) {
      await fs.unlink(this.USER_CONFIG_FILE);
    }
    if (await fs.pathExists(this.CREDENTIALS_FILE)) {
      await fs.unlink(this.CREDENTIALS_FILE);
    }
  }

  /**
   * Separate credentials from config
   */
  private static separateCredentials(config: DeepPartial<GlobalConfig>): {
    credentials: Credentials;
    sanitized: DeepPartial<GlobalConfig>;
  } {
    const credentials: Credentials = {};
    const sanitized = JSON.parse(JSON.stringify(config));

    // Extract API Keys and Base URLs from planner
    if (sanitized.llm?.planner) {
      const provider = sanitized.llm.planner.provider || 'openai';
      if (!credentials[provider as keyof Credentials]) {
        credentials[provider as keyof Credentials] = {};
      }

      if (sanitized.llm.planner.apiKey) {
        (credentials[provider as keyof Credentials] as any).apiKey = sanitized.llm.planner.apiKey;
        delete sanitized.llm.planner.apiKey;
      }

      if (sanitized.llm.planner.baseURL) {
        (credentials[provider as keyof Credentials] as any).baseURL =
          sanitized.llm.planner.baseURL;
        delete sanitized.llm.planner.baseURL;
      }
    }

    // Extract API Keys and Base URLs from executor
    if (sanitized.llm?.executor) {
      const provider = sanitized.llm.executor.provider || 'openai';
      if (!credentials[provider as keyof Credentials]) {
        credentials[provider as keyof Credentials] = {};
      }

      if (sanitized.llm.executor.apiKey) {
        (credentials[provider as keyof Credentials] as any).apiKey =
          sanitized.llm.executor.apiKey;
        delete sanitized.llm.executor.apiKey;
      }

      if (sanitized.llm.executor.baseURL) {
        (credentials[provider as keyof Credentials] as any).baseURL =
          sanitized.llm.executor.baseURL;
        delete sanitized.llm.executor.baseURL;
      }
    }

    // Extract API Keys and Base URLs from reflector
    if (sanitized.llm?.reflector) {
      const provider = sanitized.llm.reflector.provider || 'openai';
      if (!credentials[provider as keyof Credentials]) {
        credentials[provider as keyof Credentials] = {};
      }

      if (sanitized.llm.reflector.apiKey) {
        (credentials[provider as keyof Credentials] as any).apiKey =
          sanitized.llm.reflector.apiKey;
        delete sanitized.llm.reflector.apiKey;
      }

      if (sanitized.llm.reflector.baseURL) {
        (credentials[provider as keyof Credentials] as any).baseURL =
          sanitized.llm.reflector.baseURL;
        delete sanitized.llm.reflector.baseURL;
      }
    }

    return { credentials, sanitized };
  }

  /**
   * Merge config with credentials
   */
  private static mergeWithCredentials(
    config: DeepPartial<GlobalConfig>,
    credentials: Credentials
  ): DeepPartial<GlobalConfig> {
    const merged = JSON.parse(JSON.stringify(config));

    // Merge credentials into planner
    if (merged.llm?.planner) {
      const provider = merged.llm.planner.provider || 'openai';
      const providerCreds = credentials[provider as keyof Credentials];

      if (providerCreds) {
        if (providerCreds.apiKey) {
          merged.llm.planner.apiKey = providerCreds.apiKey;
        }
        if (providerCreds.baseURL) {
          merged.llm.planner.baseURL = providerCreds.baseURL;
        }
      }
    }

    // Merge credentials into executor
    if (merged.llm?.executor) {
      const provider = merged.llm.executor.provider || 'openai';
      const providerCreds = credentials[provider as keyof Credentials];

      if (providerCreds) {
        if (providerCreds.apiKey) {
          merged.llm.executor.apiKey = providerCreds.apiKey;
        }
        if (providerCreds.baseURL) {
          merged.llm.executor.baseURL = providerCreds.baseURL;
        }
      }
    }

    // Merge credentials into reflector
    if (merged.llm?.reflector) {
      const provider = merged.llm.reflector.provider || 'openai';
      const providerCreds = credentials[provider as keyof Credentials];

      if (providerCreds) {
        if (providerCreds.apiKey) {
          merged.llm.reflector.apiKey = providerCreds.apiKey;
        }
        if (providerCreds.baseURL) {
          merged.llm.reflector.baseURL = providerCreds.baseURL;
        }
      }
    }

    return merged;
  }

  /**
   * Load credentials synchronously
   */
  private static loadCredentialsSync(): Credentials {
    try {
      if (!fs.existsSync(this.CREDENTIALS_FILE)) {
        return {};
      }

      const content = fs.readFileSync(this.CREDENTIALS_FILE, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Warning: Failed to load credentials from ${this.CREDENTIALS_FILE}:`, error);
      return {};
    }
  }

  /**
   * Backup current configuration
   */
  private static async backup(): Promise<void> {
    try {
      if (!await fs.pathExists(this.USER_CONFIG_FILE)) {
        return;
      }

      // Create backup with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.BACKUPS_DIR, `config.${timestamp}.json`);

      await fs.copy(this.USER_CONFIG_FILE, backupPath);

      // Clean old backups
      await this.cleanOldBackups();
    } catch (error) {
      console.warn('Warning: Failed to backup configuration:', error);
    }
  }

  /**
   * Clean old backup files, keeping only the most recent MAX_BACKUPS
   */
  private static async cleanOldBackups(): Promise<void> {
    try {
      const files = await fs.readdir(this.BACKUPS_DIR);
      const backupFiles = files
        .filter((file) => file.startsWith('config.') && file.endsWith('.json'))
        .map((file) => ({
          name: file,
          path: path.join(this.BACKUPS_DIR, file),
        }));

      if (backupFiles.length <= this.MAX_BACKUPS) {
        return;
      }

      // Sort by modification time (oldest first)
      const filesWithStats = await Promise.all(
        backupFiles.map(async (file) => ({
          ...file,
          mtime: (await fs.stat(file.path)).mtime,
        }))
      );

      filesWithStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

      // Remove oldest files
      const toRemove = filesWithStats.slice(0, filesWithStats.length - this.MAX_BACKUPS);
      await Promise.all(toRemove.map((file) => fs.unlink(file.path)));
    } catch (error) {
      console.warn('Warning: Failed to clean old backups:', error);
    }
  }

  /**
   * Get presets directory path
   */
  static getPresetsDir(): string {
    return this.PRESETS_DIR;
  }

  /**
   * Get backups directory path
   */
  static getBackupsDir(): string {
    return this.BACKUPS_DIR;
  }

  /**
   * Get credentials file path
   */
  static getCredentialsPath(): string {
    return this.CREDENTIALS_FILE;
  }
}
