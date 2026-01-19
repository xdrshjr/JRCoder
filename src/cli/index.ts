#!/usr/bin/env node

/**
 * CLI entry point for OpenJRAgent
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { VERSION } from '../index';

const program = new Command();

program
  .name('openjragent')
  .description('OpenJRAgent - Automated Programming Agent')
  .version(VERSION);

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
  .option('--preset <name>', 'Use configuration preset (fast|quality|local|economy)')
  .action(async (task, options) => {
    console.log(chalk.cyan('\n🤖 OpenJRAgent v' + VERSION + '\n'));
    console.log(chalk.yellow('Task:'), task);
    console.log(chalk.gray('Options:'), options);
    console.log(
      chalk.yellow('\n⚠️  Agent core not yet implemented. This is the infrastructure setup.\n')
    );
  });

program
  .command('config:show')
  .description('Show current configuration')
  .option('-c, --config <path>', 'Config file path')
  .action(async (_options) => {
    console.log(chalk.cyan('\n📋 Configuration\n'));
    console.log(chalk.yellow('⚠️  Config display not yet implemented.\n'));
  });

program
  .command('config:export')
  .description('Export current configuration')
  .option('-c, --config <path>', 'Config file path')
  .option('-o, --output <path>', 'Output file path')
  .action(async (_options) => {
    console.log(chalk.cyan('\n📤 Export Configuration\n'));
    console.log(chalk.yellow('⚠️  Config export not yet implemented.\n'));
  });

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
