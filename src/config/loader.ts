/**
 * Configuration loader with multi-level priority
 */

import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import type { GlobalConfig, DeepPartial, LogLevel } from '../types';
import { ConfigError } from '../core/errors';
import { deepMerge } from '../utils';
import { defaultConfig } from './default';
import { ConfigValidator } from './validator';
import { UserConfigManager } from './user-config';

export class ConfigLoader {
  private static CONFIG_PATHS: string[] = [];

  /**
   * Initialize CONFIG_PATHS with absolute paths
   */
  private static initializeConfigPaths() {
    if (this.CONFIG_PATHS.length > 0) return;

    let moduleDir: string;

    // Try to get module directory using import.meta.url (ESM) or __filename (CJS)
    try {
      const filePath = fileURLToPath(import.meta.url);
      moduleDir = path.dirname(filePath);
    } catch {
      // Fallback to __filename if available
      if (typeof __filename !== 'undefined') {
        moduleDir = path.dirname(__filename);
      } else {
        // Final fallback: use process.cwd() and try to find config directory
        moduleDir = path.join(process.cwd(), 'src', 'config');
      }
    }

    // Calculate the project root directory
    // When bundled, moduleDir might be directory containing the bundled CLI
    // We need to find the OpenJRAgent installation directory by searching for config/default.json
    let projectRoot = moduleDir;

    // If moduleDir ends with 'dist', go up one level (the project root)
    if (path.basename(moduleDir) === 'dist') {
      projectRoot = path.dirname(moduleDir);
    } else if (path.basename(moduleDir) === 'cli') {
      // If CLI is in a 'cli' subdirectory, go up two levels
      projectRoot = path.dirname(path.dirname(moduleDir));
    }

    // Default config file in the project installation directory
    const defaultConfigPath = path.join(projectRoot, 'config', 'default.json');

    // Local and project config files (relative to current working directory)
    const localConfigPath = 'config/local.json';
    const projectConfigPath = '.openjragent.json';

    this.CONFIG_PATHS = [defaultConfigPath, localConfigPath, projectConfigPath];
  }

  /**
   * Load configuration with priority: CLI args > env vars > config files > defaults
   */
  static load(customPath?: string): GlobalConfig {
    // Initialize config paths
    this.initializeConfigPaths();

    // 1. Start with default config
    let config: GlobalConfig = { ...defaultConfig };

    // 2. Load and merge config files (excluding user config)
    for (const configPath of this.CONFIG_PATHS) {
      if (fs.existsSync(configPath)) {
        try {
          const fileConfig = this.loadConfigFile(configPath);
          config = deepMerge(config, fileConfig);
        } catch (error: any) {
          console.warn(`Warning: Failed to load config from ${configPath}:`, error);
        }
      }
    }

    // 3. Load user config with credentials using UserConfigManager
    const userConfig = UserConfigManager.load();
    if (userConfig) {
      config = deepMerge(config, userConfig);
    }

    // 4. Load custom config file if specified
    if (customPath) {
      if (!fs.existsSync(customPath)) {
        throw new ConfigError(`Custom config file not found: ${customPath}`);
      }
      const customConfig = this.loadConfigFile(customPath);
      config = deepMerge(config, customConfig);
    }

    // 5. Load and merge environment variables
    const envConfig = this.loadEnvConfig();
    config = deepMerge(config, envConfig);

    // 6. Validate final configuration
    const validation = ConfigValidator.validate(config);
    if (!validation.valid) {
      throw new ConfigError(
        `Invalid configuration: ${validation.errors.join(', ')}`,
        validation.errors
      );
    }

    return config;
  }

  /**
   * Load configuration from JSON file
   */
  private static loadConfigFile(filePath: string): DeepPartial<GlobalConfig> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error: any) {
      throw new ConfigError(`Failed to load config file '${filePath}': ${error.message}`);
    }
  }

  /**
   * Load configuration from environment variables
   */
  private static loadEnvConfig(): DeepPartial<GlobalConfig> {
    // Load .env file if exists
    dotenv.config();

    const config: DeepPartial<GlobalConfig> = {};

    // LLM API Keys
    if (process.env.OPENAI_API_KEY) {
      config.llm = config.llm || {};
      config.llm.planner = { ...config.llm.planner, apiKey: process.env.OPENAI_API_KEY };
      config.llm.executor = { ...config.llm.executor, apiKey: process.env.OPENAI_API_KEY };
      config.llm.reflector = { ...config.llm.reflector, apiKey: process.env.OPENAI_API_KEY };
    }

    if (process.env.ANTHROPIC_API_KEY) {
      config.llm = config.llm || {};
      if (config.llm.planner?.provider === 'anthropic') {
        config.llm.planner.apiKey = process.env.ANTHROPIC_API_KEY;
      }
      if (config.llm.executor?.provider === 'anthropic') {
        config.llm.executor.apiKey = process.env.ANTHROPIC_API_KEY;
      }
      if (config.llm.reflector?.provider === 'anthropic') {
        config.llm.reflector.apiKey = process.env.ANTHROPIC_API_KEY;
      }
    }

    // LLM Base URLs
    if (process.env.OPENAI_BASE_URL) {
      config.llm = config.llm || {};
      config.llm.planner = { ...config.llm.planner, baseURL: process.env.OPENAI_BASE_URL };
      config.llm.executor = { ...config.llm.executor, baseURL: process.env.OPENAI_BASE_URL };
      config.llm.reflector = { ...config.llm.reflector, baseURL: process.env.OPENAI_BASE_URL };
    }

    if (process.env.ANTHROPIC_BASE_URL) {
      config.llm = config.llm || {};
      if (config.llm.planner?.provider === 'anthropic') {
        config.llm.planner.baseURL = process.env.ANTHROPIC_BASE_URL;
      }
      if (config.llm.executor?.provider === 'anthropic') {
        config.llm.executor.baseURL = process.env.ANTHROPIC_BASE_URL;
      }
      if (config.llm.reflector?.provider === 'anthropic') {
        config.llm.reflector.baseURL = process.env.ANTHROPIC_BASE_URL;
      }
    }

    // Agent configuration
    if (process.env.AGENT_MAX_ITERATIONS) {
      config.agent = config.agent || {};
      config.agent.maxIterations = parseInt(process.env.AGENT_MAX_ITERATIONS, 10);
    }

    if (process.env.AGENT_ENABLE_REFLECTION) {
      config.agent = config.agent || {};
      config.agent.enableReflection = process.env.AGENT_ENABLE_REFLECTION === 'true';
    }

    if (process.env.AGENT_REQUIRE_CONFIRMATION) {
      config.agent = config.agent || {};
      config.agent.requireConfirmation = process.env.AGENT_REQUIRE_CONFIRMATION === 'true';
    }

    // Logging configuration
    if (process.env.LOG_LEVEL) {
      config.logging = config.logging || {};
      config.logging.level = process.env.LOG_LEVEL as LogLevel;
    }

    if (process.env.LOG_OUTPUT_DIR) {
      config.logging = config.logging || {};
      config.logging.outputDir = process.env.LOG_OUTPUT_DIR;
    }

    // Tools configuration
    if (process.env.TOOLS_WORKSPACE_DIR) {
      config.tools = config.tools || {};
      config.tools.workspaceDir = process.env.TOOLS_WORKSPACE_DIR;
    }

    if (process.env.TOOLS_MAX_FILE_SIZE) {
      config.tools = config.tools || {};
      config.tools.maxFileSize = parseInt(process.env.TOOLS_MAX_FILE_SIZE, 10);
    }

    // CLI configuration
    if (process.env.CLI_THEME) {
      config.cli = config.cli || {};
      config.cli.theme = process.env.CLI_THEME as 'light' | 'dark';
    }

    if (process.env.CLI_SHOW_PROGRESS) {
      config.cli = config.cli || {};
      config.cli.showProgress = process.env.CLI_SHOW_PROGRESS === 'true';
    }

    return config;
  }

  /**
   * Merge two configurations
   */
  static merge(base: GlobalConfig, override: DeepPartial<GlobalConfig>): GlobalConfig {
    return deepMerge(base, override);
  }

  /**
   * Export configuration (sanitized)
   */
  static export(config: GlobalConfig): string {
    const sanitized = this.sanitize(config);
    return JSON.stringify(sanitized, null, 2);
  }

  /**
   * Remove sensitive information from config
   */
  private static sanitize(config: GlobalConfig): any {
    const sanitized = JSON.parse(JSON.stringify(config));

    // Remove API keys
    if (sanitized.llm) {
      for (const role of ['planner', 'executor', 'reflector']) {
        if (sanitized.llm[role]?.apiKey) {
          sanitized.llm[role].apiKey = '***';
        }
      }
    }

    return sanitized;
  }
}
