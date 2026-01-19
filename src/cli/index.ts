#!/usr/bin/env node

/**
 * CLI entry point for OpenJRAgent
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { VERSION } from '../index';
import {
  runCommand,
  showConfigCommand,
  exportConfigCommand,
  viewLogsCommand,
  generateReportCommand,
  listSessionsCommand,
} from './commands';

const program = new Command();

program
  .name('openjragent')
  .description('OpenJRAgent - Automated Programming Agent')
  .version(VERSION);

// ============================================================================
// Main Command: Run Agent
// ============================================================================

program
  .command('run <task>')
  .description('Run agent with a task')
  .option('-c, --config <path>', 'Config file path')
  .option('--max-iterations <number>', 'Maximum iterations', parseInt)
  .option('--no-reflection', 'Disable reflection phase')
  .option('--no-confirmation', 'Skip user confirmation')
  .option('--planner-model <model>', 'Planner model name')
  .option('--executor-model <model>', 'Executor model name')
  .option('--reflector-model <model>', 'Reflector model name')
  .option('--log-level <level>', 'Log level (debug|info|warn|error)')
  .option('--workspace <path>', 'Workspace directory')
  .option('--resume <sessionId>', 'Resume from saved session')
  .option('--preset <name>', 'Use configuration preset (fast|quality|local|economy)')
  .action(async (task, options) => {
    try {
      await runCommand(task, options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// ============================================================================
// Configuration Commands
// ============================================================================

program
  .command('config:show')
  .description('Show current configuration')
  .option('-c, --config <path>', 'Config file path')
  .action(async (options) => {
    try {
      await showConfigCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('config:export')
  .description('Export current configuration')
  .option('-c, --config <path>', 'Config file path')
  .option('-o, --output <path>', 'Output file path')
  .action(async (options) => {
    try {
      await exportConfigCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// ============================================================================
// Log Commands
// ============================================================================

program
  .command('logs')
  .description('View logs')
  .option('--tail <number>', 'Show last N lines', parseInt, 50)
  .option('--session <id>', 'Filter by session ID')
  .option('--level <level>', 'Filter by log level')
  .option('--follow', 'Follow log output')
  .action(async (options) => {
    try {
      await viewLogsCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// ============================================================================
// Report Commands
// ============================================================================

program
  .command('report')
  .description('Generate execution report')
  .requiredOption('--session <id>', 'Session ID')
  .option('--format <format>', 'Report format (markdown|json|html)', 'markdown')
  .option('-o, --output <path>', 'Output file path')
  .action(async (options) => {
    try {
      await generateReportCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// ============================================================================
// Session Commands
// ============================================================================

program
  .command('sessions')
  .description('List all sessions')
  .action(async () => {
    try {
      await listSessionsCommand();
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// ============================================================================
// Parse and Execute
// ============================================================================

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
