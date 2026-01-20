/**
 * CLI command implementations
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { ConfigLoader } from '../config/loader';
import { UserConfigManager } from '../config/user-config';
import { Logger } from '../logger/logger';
import { Agent } from '../core/agent';
import { CONFIG_PRESETS } from '../config/presets';
import { GlobalConfig, DeepPartial } from '../types';
import { DisplayManager } from './display';
import { ReportGenerator } from './report-generator';
import { LogViewer } from './log-viewer';
import { FileSessionStorage } from '../storage/session-storage';
import { runWithTUI } from './tui';
import { VERSION } from '../index';
import fs from 'fs-extra';

/**
 * Apply CLI options to configuration
 */
export function applyCliOptions(config: GlobalConfig, options: any): GlobalConfig {
  const newConfig = { ...config };

  if (options.maxIterations) {
    newConfig.agent.maxIterations = options.maxIterations;
  }
  if (options.reflection === false) {
    newConfig.agent.enableReflection = false;
  }
  if (options.confirmation === false) {
    newConfig.agent.requireConfirmation = false;
  }
  if (options.plannerModel) {
    newConfig.llm.planner.model = options.plannerModel;
  }
  if (options.executorModel) {
    newConfig.llm.executor.model = options.executorModel;
  }
  if (options.reflectorModel) {
    newConfig.llm.reflector.model = options.reflectorModel;
  }
  if (options.logLevel) {
    newConfig.logging.level = options.logLevel;
  }
  if (options.workspace) {
    newConfig.tools.workspaceDir = options.workspace;
  }

  return newConfig;
}

/**
 * Run agent command
 */
export async function runCommand(task: string, options: any): Promise<void> {
  const display = new DisplayManager();

  try {
    // 0. Check if user config exists (first-time run detection)
    if (!UserConfigManager.exists()) {
      console.log(
        chalk.yellow(
          '\n⚠️  No configuration found. This appears to be your first time using OpenJRAgent.\n'
        )
      );

      const { runInit } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'runInit',
          message: 'Would you like to run the configuration wizard now?',
          default: true,
        },
      ]);

      if (runInit) {
        await initCommand();
        console.log(chalk.cyan('\nNow running your task...\n'));
      } else {
        console.log(
          chalk.yellow('\nPlease run "openjragent init" to configure the agent before use.\n')
        );
        process.exit(0);
      }
    }

    // 1. Load configuration
    display.showSpinner('Loading configuration...');
    let config = ConfigLoader.load(options.config);

    // 2. Apply CLI options
    config = applyCliOptions(config, options);

    // 3. Apply preset if specified
    if (options.preset) {
      if (CONFIG_PRESETS[options.preset]) {
        config = ConfigLoader.merge(config, CONFIG_PRESETS[options.preset]);
        display.updateSpinner(`Applied preset: ${options.preset}`);
      } else {
        display.failSpinner(`Unknown preset: ${options.preset}`);
        console.log(chalk.yellow(`Available presets: ${Object.keys(CONFIG_PRESETS).join(', ')}`));
        return;
      }
    }

    display.succeedSpinner('Configuration loaded');

    // 4. Initialize logger
    const logger = new Logger(config.logging);
    logger.info('OpenJRAgent started', {
      type: 'run_command_start',
      task,
      options,
      tuiMode: options.tui === true,
    });

    // 5. Check if TUI mode is enabled (default: false, unless --tui is specified)
    const useTUI = options.tui === true;

    if (useTUI) {
      logger.info('Starting with TUI interface', {
        type: 'tui_mode_selected',
        task,
      });

      // Run with TUI
      await runWithTUI({
        task,
        config,
        logger,
        projectName: 'OpenJRAgent',
        version: VERSION,
      });
    } else {
      logger.info('Starting with legacy CLI mode', {
        type: 'legacy_cli_mode_selected',
        task,
      });

      // 6. Create agent (resume functionality to be implemented)
      const agent = new Agent(config, logger);

      if (options.resume) {
        display.warnSpinner('Session resume not yet implemented, starting new session');
      }

      // 7. Run agent in legacy CLI mode
      console.log(chalk.cyan('\n🤖 Starting Agent Execution\n'));
      console.log(chalk.white('Task:'), chalk.yellow(task));
      console.log();

      await agent.run(task);

      // 8. Show summary (to be implemented when Agent.getState() is available)
      // display.showSummary(agent.getState());

      logger.info('OpenJRAgent completed successfully', {
        type: 'run_command_complete',
      });
    }
  } catch (error) {
    display.failSpinner('Execution failed');
    display.showError(error as Error);
    process.exit(1);
  }
}

/**
 * Start command - Launch TUI without initial task
 */
export async function startCommand(options: any): Promise<void> {
  const display = new DisplayManager();

  try {
    // 0. Check if user config exists (first-time run detection)
    if (!UserConfigManager.exists()) {
      console.log(
        chalk.yellow(
          '\n⚠️  No configuration found. This appears to be your first time using OpenJRAgent.\n'
        )
      );

      const { runInit } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'runInit',
          message: 'Would you like to run the configuration wizard now?',
          default: true,
        },
      ]);

      if (runInit) {
        await initCommand();
        console.log(chalk.cyan('\nNow starting TUI...\n'));
      } else {
        console.log(
          chalk.yellow('\nPlease run "openjragent init" to configure the agent before use.\n')
        );
        process.exit(0);
      }
    }

    // 1. Load configuration
    display.showSpinner('Loading configuration...');
    let config = ConfigLoader.load(options.config);

    // 2. Apply CLI options
    config = applyCliOptions(config, options);

    // 3. Apply preset if specified
    if (options.preset) {
      if (CONFIG_PRESETS[options.preset]) {
        config = ConfigLoader.merge(config, CONFIG_PRESETS[options.preset]);
        display.updateSpinner(`Applied preset: ${options.preset}`);
      } else {
        display.failSpinner(`Unknown preset: ${options.preset}`);
        console.log(chalk.yellow(`Available presets: ${Object.keys(CONFIG_PRESETS).join(', ')}`));
        return;
      }
    }

    display.succeedSpinner('Configuration loaded');

    // 4. Initialize logger
    const logger = new Logger(config.logging);
    logger.info('OpenJRAgent TUI started without initial task', {
      type: 'start_command',
      options,
    });

    // 5. Launch TUI without initial task
    logger.info('Launching TUI interface', {
      type: 'tui_launch',
    });

    await runWithTUI({
      task: '', // Empty task - user will input task in TUI
      config,
      logger,
      projectName: 'OpenJRAgent',
      version: VERSION,
    });

    logger.info('TUI session ended', {
      type: 'start_command_complete',
    });
  } catch (error) {
    display.failSpinner('Failed to start TUI');
    display.showError(error as Error);
    process.exit(1);
  }
}

/**
 * Show configuration command
 */
export async function showConfigCommand(options: any): Promise<void> {
  try {
    console.log(chalk.cyan('\n📋 Current Configuration\n'));

    const config = ConfigLoader.load(options.config);

    // Display configuration in a readable format
    console.log(chalk.bold('Agent Settings:'));
    console.log(`  Max Iterations: ${chalk.yellow(config.agent.maxIterations)}`);
    console.log(
      `  Reflection: ${chalk.yellow(config.agent.enableReflection ? 'Enabled' : 'Disabled')}`
    );
    console.log(
      `  Confirmation: ${chalk.yellow(config.agent.requireConfirmation ? 'Required' : 'Disabled')}`
    );
    console.log();

    console.log(chalk.bold('LLM Configuration:'));
    console.log(
      `  Planner: ${chalk.yellow(config.llm.planner.provider)}/${chalk.yellow(config.llm.planner.model)}`
    );
    console.log(
      `  Executor: ${chalk.yellow(config.llm.executor.provider)}/${chalk.yellow(config.llm.executor.model)}`
    );
    console.log(
      `  Reflector: ${chalk.yellow(config.llm.reflector.provider)}/${chalk.yellow(config.llm.reflector.model)}`
    );
    console.log();

    console.log(chalk.bold('Tools:'));
    console.log(`  Enabled: ${chalk.yellow(config.tools.enabled.length)} tools`);
    console.log(`  Workspace: ${chalk.yellow(config.tools.workspaceDir)}`);
    console.log();

    console.log(chalk.bold('CLI Settings:'));
    console.log(
      `  Confirm Dangerous: ${chalk.yellow(config.cli.confirmDangerous ? 'Enabled' : 'Disabled')}`
    );
    console.log(`  Theme: ${chalk.yellow(config.cli.theme)}`);
    console.log(
      `  Show Progress: ${chalk.yellow(config.cli.showProgress ? 'Enabled' : 'Disabled')}`
    );
    console.log();

    console.log(chalk.bold('Logging:'));
    console.log(`  Level: ${chalk.yellow(config.logging.level)}`);
    console.log(`  Output: ${chalk.yellow(config.logging.outputDir)}`);
    console.log();
  } catch (error) {
    console.error(chalk.red('Error loading configuration:'), (error as Error).message);
    process.exit(1);
  }
}

/**
 * Export configuration command
 */
export async function exportConfigCommand(options: any): Promise<void> {
  try {
    console.log(chalk.cyan('\n📤 Exporting Configuration\n'));

    const config = ConfigLoader.load(options.config);

    // Sanitize sensitive information
    const sanitized = JSON.parse(JSON.stringify(config));
    if (sanitized.llm) {
      for (const role of ['planner', 'executor', 'reflector']) {
        if (sanitized.llm[role]?.apiKey) {
          sanitized.llm[role].apiKey = '***';
        }
      }
    }

    const content = JSON.stringify(sanitized, null, 2);

    if (options.output) {
      await fs.writeFile(options.output, content, 'utf8');
      console.log(chalk.green(`✅ Configuration exported to: ${options.output}\n`));
    } else {
      console.log(content);
      console.log();
    }
  } catch (error) {
    console.error(chalk.red('Error exporting configuration:'), (error as Error).message);
    process.exit(1);
  }
}

/**
 * View logs command
 */
export async function viewLogsCommand(options: any): Promise<void> {
  try {
    const viewer = new LogViewer();
    await viewer.viewLogs(options);
  } catch (error) {
    console.error(chalk.red('Error viewing logs:'), (error as Error).message);
    process.exit(1);
  }
}

/**
 * Generate report command
 */
export async function generateReportCommand(options: any): Promise<void> {
  try {
    console.log(chalk.cyan('\n📊 Generating Report\n'));

    const sessionStorage = new FileSessionStorage('.workspace/sessions');
    const session = await sessionStorage.load(options.session);

    if (!session) {
      console.error(chalk.red(`Session not found: ${options.session}`));
      process.exit(1);
    }

    const generator = new ReportGenerator();
    const format = options.format || 'markdown';
    const filepath = await generator.save(session.state, format, options.output);

    console.log(chalk.green(`✅ Report generated: ${filepath}\n`));
  } catch (error) {
    console.error(chalk.red('Error generating report:'), (error as Error).message);
    process.exit(1);
  }
}

/**
 * List sessions command
 */
export async function listSessionsCommand(): Promise<void> {
  try {
    console.log(chalk.cyan('\n📋 Sessions\n'));

    const sessionStorage = new FileSessionStorage('.workspace/sessions');
    const sessions = await sessionStorage.list();

    if (sessions.length === 0) {
      console.log(chalk.gray('No sessions found.\n'));
      return;
    }

    sessions.forEach((session: any, index: number) => {
      const date = new Date(session.createdAt).toLocaleString();
      const status = session.state.phase;
      const statusColor =
        status === 'completed' ? chalk.green : status === 'failed' ? chalk.red : chalk.yellow;

      console.log(`${index + 1}. ${chalk.bold(session.id)} ${statusColor(`[${status}]`)}`);
      console.log(`   Created: ${chalk.gray(date)}`);
      if (session.state.plan) {
        console.log(`   Goal: ${chalk.gray(session.state.plan.goal)}`);
      }
      console.log();
    });
  } catch (error) {
    console.error(chalk.red('Error listing sessions:'), (error as Error).message);
    process.exit(1);
  }
}

/**
 * Initialize user configuration command
 */
export async function initCommand(): Promise<void> {
  console.log(chalk.cyan('\n=== OpenJRAgent Configuration Wizard ===\n'));

  try {
    // 1. Check if config already exists
    const hasConfig = UserConfigManager.exists();
    if (hasConfig) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Configuration already exists. Do you want to overwrite it?',
          default: false,
        },
      ]);

      if (!overwrite) {
        console.log(chalk.yellow('\nConfiguration initialization cancelled.\n'));
        return;
      }
    }

    // 2. Select LLM provider
    const { provider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Select your primary LLM provider:',
        choices: [
          { name: 'OpenAI (GPT-4, GPT-3.5)', value: 'openai' },
          { name: 'Anthropic (Claude)', value: 'anthropic' },
          { name: 'Ollama (Local models)', value: 'ollama' },
        ],
      },
    ]);

    // 3. Configure API credentials based on provider
    let credentials: any = {};

    if (provider === 'openai') {
      const answers = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'Enter your OpenAI API Key:',
          mask: '*',
          validate: (input) => (input.trim().length > 0 ? true : 'API Key is required'),
        },
        {
          type: 'input',
          name: 'baseURL',
          message: 'Enter OpenAI Base URL (press Enter for default):',
          default: 'https://api.openai.com/v1',
        },
      ]);

      credentials = { openai: answers };
    } else if (provider === 'anthropic') {
      const answers = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'Enter your Anthropic API Key:',
          mask: '*',
          validate: (input) => (input.trim().length > 0 ? true : 'API Key is required'),
        },
        {
          type: 'input',
          name: 'baseURL',
          message: 'Enter Anthropic Base URL (press Enter for default):',
          default: 'https://api.anthropic.com',
        },
      ]);

      credentials = { anthropic: answers };
    } else if (provider === 'ollama') {
      const { baseURL } = await inquirer.prompt([
        {
          type: 'input',
          name: 'baseURL',
          message: 'Enter Ollama Base URL:',
          default: 'http://localhost:11434',
        },
      ]);

      credentials = { ollama: { baseURL } };
    }

    // 4. Select models
    const modelChoices = getModelChoices(provider);
    const { plannerModel, executorModel, reflectorModel } = await inquirer.prompt([
      {
        type: 'list',
        name: 'plannerModel',
        message: 'Select Planner model:',
        choices: modelChoices,
      },
      {
        type: 'list',
        name: 'executorModel',
        message: 'Select Executor model:',
        choices: modelChoices,
      },
      {
        type: 'list',
        name: 'reflectorModel',
        message: 'Select Reflector model:',
        choices: modelChoices,
      },
    ]);

    // 5. Agent configuration
    const { maxIterations, enableReflection } = await inquirer.prompt([
      {
        type: 'number',
        name: 'maxIterations',
        message: 'Maximum iterations:',
        default: 10,
      },
      {
        type: 'confirm',
        name: 'enableReflection',
        message: 'Enable reflection phase (improves quality but increases cost)?',
        default: true,
      },
    ]);

    // 6. Build configuration object
    const providerCreds = credentials[provider];
    const config: DeepPartial<GlobalConfig> = {
      llm: {
        planner: {
          provider,
          model: plannerModel,
          apiKey: providerCreds?.apiKey,
          baseURL: providerCreds?.baseURL,
        },
        executor: {
          provider,
          model: executorModel,
          apiKey: providerCreds?.apiKey,
          baseURL: providerCreds?.baseURL,
        },
        reflector: {
          provider,
          model: reflectorModel,
          apiKey: providerCreds?.apiKey,
          baseURL: providerCreds?.baseURL,
        },
      },
      agent: {
        maxIterations,
        enableReflection,
      },
    };

    // 7. Save configuration
    const spinner = ora('Saving configuration...').start();
    await UserConfigManager.save(config);
    spinner.succeed('Configuration saved successfully!');

    // 8. Display saved paths
    console.log(chalk.cyan('\nConfiguration files:'));
    console.log(`  Config: ${chalk.yellow(UserConfigManager.getConfigPath())}`);
    console.log(`  Credentials: ${chalk.yellow(UserConfigManager.getCredentialsPath())}`);

    // 9. Validate connection
    console.log();
    const validationSpinner = ora('Validating LLM connection...').start();
    const connectionTest = await validateLLMConnection(config);

    if (connectionTest.success) {
      validationSpinner.succeed('LLM connection test passed');
      console.log(chalk.green('\n✅ Configuration is complete and working!'));
      console.log(chalk.cyan('\nYou can now run: openjragent start\n'));
    } else {
      validationSpinner.fail('LLM connection test failed');
      console.log(chalk.yellow(`\nWarning: ${connectionTest.error}`));
      console.log(chalk.yellow('Your configuration was saved, but the connection test failed.'));
      console.log(chalk.yellow('Please verify your API key and base URL are correct.'));
      console.log(
        chalk.cyan('\nYou can test your configuration with: openjragent config:validate\n')
      );
    }
  } catch (error) {
    console.error(chalk.red('\nError during initialization:'), (error as Error).message);
    process.exit(1);
  }
}

/**
 * Get model choices based on provider
 */
function getModelChoices(provider: string): string[] {
  const models: Record<string, string[]> = {
    openai: ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    ollama: ['llama2', 'codellama', 'mistral', 'deepseek-coder'],
  };

  return models[provider] || [];
}

/**
 * Validate LLM connection
 */
async function validateLLMConnection(config: DeepPartial<GlobalConfig>): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Try to load the full configuration
    const fullConfig = ConfigLoader.merge(ConfigLoader.load(), config) as GlobalConfig;

    // Create a logger for validation
    const logger = new Logger(fullConfig.logging);

    // Try to create an LLM client for executor
    const { LLMManager } = await import('../llm/manager');
    const llmManager = new LLMManager(fullConfig, logger);
    const client = llmManager.getClient('executor');

    // Send a test message using chat method
    await client.chat({
      messages: [
        {
          role: 'user',
          content: 'Hello, this is a test message. Please respond with "OK".',
        },
      ],
      tools: [],
    });

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error during connection test',
    };
  }
}

/**
 * Validate configuration command
 */
export async function validateConfigCommand(options: any): Promise<void> {
  console.log(chalk.cyan('\n🔍 Validating Configuration\n'));

  try {
    // 1. Load configuration
    const config = ConfigLoader.load(options.config);

    // 2. Validate configuration structure
    console.log(chalk.gray('Checking configuration structure...'));
    const { ConfigValidator } = await import('../config/validator');
    const validation = ConfigValidator.validate(config);

    if (!validation.valid) {
      console.log(chalk.red('\nConfiguration structure errors:'));
      validation.errors.forEach((err) => console.log(chalk.red(`  - ${err}`)));
      process.exit(1);
    }

    console.log(chalk.green('✓ Configuration structure is valid\n'));

    // 3. Test LLM connection
    const spinner = ora('Testing LLM connection...').start();
    const connectionTest = await validateLLMConnection(config);

    if (connectionTest.success) {
      spinner.succeed('LLM connection test passed');
      console.log(chalk.green('\n✅ Configuration is valid and working!\n'));
    } else {
      spinner.fail('LLM connection test failed');
      console.log(chalk.red(`\nError: ${connectionTest.error}\n`));
      console.log(chalk.yellow('Please check your API key and base URL settings.'));
      console.log(chalk.cyan('You can update your configuration with: openjragent init\n'));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('\nValidation error:'), (error as Error).message);
    process.exit(1);
  }
}

/**
 * Edit configuration command
 */
export async function editConfigCommand(): Promise<void> {
  console.log(chalk.cyan('\n✏️  Edit Configuration\n'));

  try {
    // 1. Load current configuration
    const currentConfig = UserConfigManager.load();
    if (!currentConfig) {
      console.log(chalk.yellow('No configuration found. Please run: openjragent init\n'));
      process.exit(0);
    }

    // 2. Select what to edit
    const { editTarget } = await inquirer.prompt([
      {
        type: 'list',
        name: 'editTarget',
        message: 'What would you like to edit?',
        choices: [
          { name: 'API Keys and URLs', value: 'credentials' },
          { name: 'Model Configuration', value: 'models' },
          { name: 'Agent Settings', value: 'agent' },
          { name: 'Tools Configuration', value: 'tools' },
          { name: 'Logging Configuration', value: 'logging' },
        ],
      },
    ]);

    // 3. Edit based on selection
    let updatedConfig = { ...currentConfig };

    switch (editTarget) {
      case 'credentials':
        updatedConfig = await editCredentials(updatedConfig);
        break;
      case 'models':
        updatedConfig = await editModels(updatedConfig);
        break;
      case 'agent':
        updatedConfig = await editAgent(updatedConfig);
        break;
      case 'tools':
        updatedConfig = await editTools(updatedConfig);
        break;
      case 'logging':
        updatedConfig = await editLogging(updatedConfig);
        break;
    }

    // 4. Save updated configuration
    const spinner = ora('Saving configuration...').start();
    await UserConfigManager.save(updatedConfig);
    spinner.succeed('Configuration updated successfully!');

    console.log(chalk.green('\n✅ Configuration has been updated!\n'));
    console.log(chalk.cyan('Run "openjragent config:validate" to verify your changes.\n'));
  } catch (error) {
    console.error(chalk.red('\nError editing configuration:'), (error as Error).message);
    process.exit(1);
  }
}

/**
 * Edit credentials (API Keys and URLs)
 */
async function editCredentials(
  config: DeepPartial<GlobalConfig>
): Promise<DeepPartial<GlobalConfig>> {
  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Select provider to edit:',
      choices: [
        { name: 'OpenAI', value: 'openai' },
        { name: 'Anthropic', value: 'anthropic' },
        { name: 'Ollama', value: 'ollama' },
      ],
    },
  ]);

  if (provider === 'openai') {
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter OpenAI API Key (leave blank to keep current):',
        mask: '*',
      },
      {
        type: 'input',
        name: 'baseURL',
        message: 'Enter OpenAI Base URL (leave blank to keep current):',
        default: config.llm?.planner?.baseURL || 'https://api.openai.com/v1',
      },
    ]);

    if (!config.llm) config.llm = {};

    // Update all roles with the same provider
    ['planner', 'executor', 'reflector'].forEach((role) => {
      if (!config.llm![role as keyof typeof config.llm]) {
        config.llm![role as keyof typeof config.llm] = {} as any;
      }
      if (answers.apiKey) {
        (config.llm![role as keyof typeof config.llm] as any).apiKey = answers.apiKey;
      }
      (config.llm![role as keyof typeof config.llm] as any).baseURL = answers.baseURL;
    });
  } else if (provider === 'anthropic') {
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter Anthropic API Key (leave blank to keep current):',
        mask: '*',
      },
      {
        type: 'input',
        name: 'baseURL',
        message: 'Enter Anthropic Base URL (leave blank to keep current):',
        default: config.llm?.planner?.baseURL || 'https://api.anthropic.com',
      },
    ]);

    if (!config.llm) config.llm = {};

    ['planner', 'executor', 'reflector'].forEach((role) => {
      if (!config.llm![role as keyof typeof config.llm]) {
        config.llm![role as keyof typeof config.llm] = {} as any;
      }
      if (answers.apiKey) {
        (config.llm![role as keyof typeof config.llm] as any).apiKey = answers.apiKey;
      }
      (config.llm![role as keyof typeof config.llm] as any).baseURL = answers.baseURL;
    });
  } else if (provider === 'ollama') {
    const { baseURL } = await inquirer.prompt([
      {
        type: 'input',
        name: 'baseURL',
        message: 'Enter Ollama Base URL:',
        default: config.llm?.planner?.baseURL || 'http://localhost:11434',
      },
    ]);

    if (!config.llm) config.llm = {};

    ['planner', 'executor', 'reflector'].forEach((role) => {
      if (!config.llm![role as keyof typeof config.llm]) {
        config.llm![role as keyof typeof config.llm] = {} as any;
      }
      (config.llm![role as keyof typeof config.llm] as any).baseURL = baseURL;
    });
  }

  return config;
}

/**
 * Edit model configuration
 */
async function editModels(config: DeepPartial<GlobalConfig>): Promise<DeepPartial<GlobalConfig>> {
  const currentProvider =
    config.llm?.planner?.provider || config.llm?.executor?.provider || 'openai';

  const modelChoices = getModelChoices(currentProvider);

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'plannerModel',
      message: 'Select Planner model:',
      choices: modelChoices,
      default: config.llm?.planner?.model,
    },
    {
      type: 'list',
      name: 'executorModel',
      message: 'Select Executor model:',
      choices: modelChoices,
      default: config.llm?.executor?.model,
    },
    {
      type: 'list',
      name: 'reflectorModel',
      message: 'Select Reflector model:',
      choices: modelChoices,
      default: config.llm?.reflector?.model,
    },
  ]);

  if (!config.llm) config.llm = {};

  if (config.llm.planner) {
    config.llm.planner.model = answers.plannerModel;
  }
  if (config.llm.executor) {
    config.llm.executor.model = answers.executorModel;
  }
  if (config.llm.reflector) {
    config.llm.reflector.model = answers.reflectorModel;
  }

  return config;
}

/**
 * Edit agent settings
 */
async function editAgent(config: DeepPartial<GlobalConfig>): Promise<DeepPartial<GlobalConfig>> {
  const answers = await inquirer.prompt([
    {
      type: 'number',
      name: 'maxIterations',
      message: 'Maximum iterations:',
      default: config.agent?.maxIterations || 10,
    },
    {
      type: 'confirm',
      name: 'enableReflection',
      message: 'Enable reflection phase?',
      default: config.agent?.enableReflection !== false,
    },
    {
      type: 'confirm',
      name: 'requireConfirmation',
      message: 'Require user confirmation before execution?',
      default: config.agent?.requireConfirmation !== false,
    },
  ]);

  if (!config.agent) config.agent = {};

  config.agent.maxIterations = answers.maxIterations;
  config.agent.enableReflection = answers.enableReflection;
  config.agent.requireConfirmation = answers.requireConfirmation;

  return config;
}

/**
 * Edit tools configuration
 */
async function editTools(config: DeepPartial<GlobalConfig>): Promise<DeepPartial<GlobalConfig>> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'workspaceDir',
      message: 'Workspace directory:',
      default: config.tools?.workspaceDir || '.workspace',
    },
    {
      type: 'number',
      name: 'maxFileSize',
      message: 'Maximum file size (in bytes):',
      default: config.tools?.maxFileSize || 10485760,
    },
  ]);

  if (!config.tools) config.tools = {};

  config.tools.workspaceDir = answers.workspaceDir;
  config.tools.maxFileSize = answers.maxFileSize;

  return config;
}

/**
 * Edit logging configuration
 */
async function editLogging(config: DeepPartial<GlobalConfig>): Promise<DeepPartial<GlobalConfig>> {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'level',
      message: 'Log level:',
      choices: ['debug', 'info', 'warn', 'error'],
      default: config.logging?.level || 'info',
    },
    {
      type: 'input',
      name: 'outputDir',
      message: 'Log output directory:',
      default: config.logging?.outputDir || 'logs',
    },
    {
      type: 'confirm',
      name: 'consoleOutput',
      message: 'Enable console output?',
      default: config.logging?.consoleOutput !== false,
    },
    {
      type: 'confirm',
      name: 'fileOutput',
      message: 'Enable file output?',
      default: config.logging?.fileOutput !== false,
    },
  ]);

  if (!config.logging) config.logging = {};

  config.logging.level = answers.level as any;
  config.logging.outputDir = answers.outputDir;
  config.logging.consoleOutput = answers.consoleOutput;
  config.logging.fileOutput = answers.fileOutput;

  return config;
}

/**
 * Reset configuration command
 */
export async function resetConfigCommand(): Promise<void> {
  console.log(chalk.cyan('\n🔄 Reset Configuration\n'));

  try {
    // 1. Check if config exists
    if (!UserConfigManager.exists()) {
      console.log(chalk.yellow('No configuration found. Nothing to reset.\n'));
      process.exit(0);
    }

    // 2. Confirm reset
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message:
          'Are you sure you want to reset configuration to defaults? (Current config will be backed up)',
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow('\nReset cancelled.\n'));
      return;
    }

    // 3. Backup current configuration
    const spinner = ora('Backing up current configuration...').start();
    await UserConfigManager.save(UserConfigManager.load() || {});
    spinner.succeed('Current configuration backed up');

    // 4. Remove current configuration
    await UserConfigManager.remove();

    // 5. Initialize with defaults
    await UserConfigManager.initialize();

    console.log(chalk.green('\n✅ Configuration has been reset to defaults!'));
    console.log(chalk.cyan(`Backup saved to: ${UserConfigManager.getBackupsDir()}\n`));
    console.log(chalk.yellow('Note: You need to run "openjragent init" to configure API keys.\n'));
  } catch (error) {
    console.error(chalk.red('\nError resetting configuration:'), (error as Error).message);
    process.exit(1);
  }
}
