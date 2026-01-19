#!/usr/bin/env node

/**
 * Test runner script
 * Provides convenient commands for running different types of tests
 */

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const command = args[0] || 'all';

const runCommand = (cmd, cmdArgs) => {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..')
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`));
      } else {
        resolve();
      }
    });
  });
};

const commands = {
  all: async () => {
    console.log('Running all tests...\n');
    await runCommand('npm', ['test']);
  },

  unit: async () => {
    console.log('Running unit tests...\n');
    await runCommand('npm', ['test', '--', 'tests/unit']);
  },

  integration: async () => {
    console.log('Running integration tests...\n');
    await runCommand('npm', ['test', '--', 'tests/integration']);
  },

  e2e: async () => {
    console.log('Running E2E tests...\n');
    await runCommand('npm', ['test', '--', 'tests/e2e']);
  },

  performance: async () => {
    console.log('Running performance tests...\n');
    await runCommand('npm', ['test', '--', 'tests/performance']);
  },

  coverage: async () => {
    console.log('Running tests with coverage...\n');
    await runCommand('npm', ['run', 'test:coverage']);
  },

  watch: async () => {
    console.log('Running tests in watch mode...\n');
    await runCommand('npm', ['run', 'test:watch']);
  },

  help: () => {
    console.log(`
Test Runner Commands:

  all           Run all tests (default)
  unit          Run unit tests only
  integration   Run integration tests only
  e2e           Run end-to-end tests only
  performance   Run performance tests only
  coverage      Run tests with coverage report
  watch         Run tests in watch mode
  help          Show this help message

Examples:
  node scripts/test.js all
  node scripts/test.js unit
  node scripts/test.js coverage
    `);
  }
};

const run = async () => {
  try {
    const handler = commands[command];
    if (!handler) {
      console.error(`Unknown command: ${command}`);
      commands.help();
      process.exit(1);
    }

    await handler();
    console.log('\n✅ Tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    process.exit(1);
  }
};

run();
