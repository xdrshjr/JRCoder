/**
 * CLI command implementations
 */

import chalk from 'chalk';
import { ConfigLoader } from '../config/loader';
import { Logger } from '../logger/logger';
import { Agent } from '../core/agent';
import { CONFIG_PRESETS } from '../config/presets';
import { GlobalConfig } from '../types';
import { DisplayManager } from './display';
import { ReportGenerator } from './report-generator';
import { LogViewer } from './log-viewer';
import { FileSessionStorage } from '../storage/session-storage';
import * as fs from 'fs-extra';

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
    logger.info('OpenJRAgent started', { task, options });

    // 5. Create agent (resume functionality to be implemented)
    const agent = new Agent(config, logger);

    if (options.resume) {
      display.warnSpinner('Session resume not yet implemented, starting new session');
    }

    // 6. Run agent
    console.log(chalk.cyan('\n🤖 Starting Agent Execution\n'));
    console.log(chalk.white('Task:'), chalk.yellow(task));
    console.log();

    await agent.run(task);

    // 7. Show summary (to be implemented when Agent.getState() is available)
    // display.showSummary(agent.getState());

    logger.info('OpenJRAgent completed successfully');
  } catch (error) {
    display.failSpinner('Execution failed');
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
