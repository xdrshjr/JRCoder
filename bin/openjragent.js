#!/usr/bin/env node

// Wrapper to run OpenJRAgent using tsx
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the path to the source file
const srcPath = join(__dirname, '..', 'src', 'cli', 'index.ts');

// Run tsx with the source file and pass all arguments
const child = spawn('npx', ['tsx', srcPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
