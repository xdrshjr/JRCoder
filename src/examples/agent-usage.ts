/**
 * Example usage of the Agent core system
 */

import { Agent } from '../core';
import { Logger } from '../logger';
import { ConfigLoader } from '../config';

async function main() {
  console.log('=== OpenJRAgent Core Example ===\n');

  try {
    // Load configuration
    const config = ConfigLoader.load();

    // Initialize logger
    const logger = new Logger(config.logging);

    // Create agent
    const agent = new Agent(config, logger);

    // Example task
    const task = '请解释什么是 TypeScript 的泛型？';

    console.log(`Task: ${task}\n`);

    // Run agent
    await agent.run(task);

    console.log('\n=== Agent execution completed ===');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run example if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
