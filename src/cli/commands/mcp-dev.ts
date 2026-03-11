/**
 * MCP Dev Command - Issue #24.6
 * CLI command for running MCP servers in development mode
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { MCPDevServer } from '../../mcp/sdk/dev.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('MCPDev');

interface DevOptions {
  entry?: string;
  watch?: string;
  build?: string;
  outDir?: string;
}

/**
 * Create the mcp dev command
 */
export function createMCPDevCommand(): Command {
  const cmd = new Command('dev')
    .description('Run MCP server in development mode with hot reload')
    .option('-e, --entry <file>', 'Entry point file', 'src/index.ts')
    .option('-w, --watch <dir>', 'Directory to watch (can be repeated)')
    .option('-b, --build <cmd>', 'Build command', 'npm run build')
    .option('-o, --out-dir <dir>', 'Output directory', 'dist')
    .action(async (options: DevOptions) => {
      try {
        await runDevMode(options);
      } catch (error) {
        logger.error(
          `Dev mode failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });

  return cmd;
}

/**
 * Run development mode
 */
async function runDevMode(options: DevOptions): Promise<void> {
  const entryPoint = path.resolve(options.entry || 'src/index.ts');

  // Verify entry point exists
  if (!fs.existsSync(entryPoint)) {
    throw new Error(`Entry point not found: ${entryPoint}`);
  }

  // Determine watch directories
  const watchDirs = options.watch
    ? [path.resolve(options.watch)]
    : [path.dirname(entryPoint)];

  const devServer = new MCPDevServer({
    entryPoint,
    watchDirs,
    buildCommand: options.build || 'npm run build',
    outDir: options.outDir || 'dist',
  });

  console.log(chalk.bold('\n🔧 MCP Development Mode\n'));
  console.log(chalk.gray(`Entry: ${entryPoint}`));
  console.log(chalk.gray(`Watch: ${watchDirs.join(', ')}`));
  console.log(chalk.gray(`Build: ${options.build || 'npm run build'}`));
  console.log(chalk.gray(`Output: ${options.outDir || 'dist'}`));
  console.log('');

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log(chalk.yellow('\n\nShutting down...'));
    await devServer.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await devServer.start();
}

/**
 * Create dev command for mcp command group
 */
export function registerMCPDevCommand(mcpCommand: Command): void {
  mcpCommand.addCommand(createMCPDevCommand());
}
