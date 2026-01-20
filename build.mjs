import * as esbuild from 'esbuild';
import { chmod, copyFile } from 'fs/promises';
import { createRequire } from 'module';
import { builtinModules } from 'module';

const require = createRequire(import.meta.url);

// Build CLI
await esbuild.build({
  entryPoints: ['src/cli/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/cli.js',
  external: [
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
    'chalk',
    'commander',
    'fs-extra',
    'inquirer',
    'ora',
    'winston',
    'dotenv',
    'joi',
    'uuid',
    'glob',
    'chokidar',
    'ink',
    'ink-*',
    'react',
    '@anthropic-ai/sdk',
    'openai',
    'cli-progress',
  ],
});

// Make the output file executable
await chmod('dist/cli.js', 0o755);

// Create copy for npm bin entry point (dist/openjragent.js)
await copyFile('dist/cli.js', 'dist/openjragent.js');
await chmod('dist/openjragent.js', 0o755);

console.log('Build complete');
