/**
 * MCP Development Mode - Issue #24.6
 * Watch mode for MCP server development with hot reload
 */

import { spawn, ChildProcess } from 'child_process';
import { watch, FSWatcher } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { Logger } from '../../utils/logger.js';
import { MCPDevServerOptions } from './types.js';

const logger = new Logger('MCPDev');

/**
 * Development server with hot reload for MCP servers
 * 
 * @example
 * ```typescript
 * const devServer = new MCPDevServer({
 *   entryPoint: './src/index.ts',
 *   watchDirs: ['./src'],
 * });
 * 
 * await devServer.start();
 * ```
 */
export class MCPDevServer {
  private serverProcess: ChildProcess | null = null;
  private watcher: FSWatcher | null = null;
  private isRestarting = false;
  private restartTimeout: NodeJS.Timeout | null = null;
  private readonly options: Required<MCPDevServerOptions>;

  constructor(options: MCPDevServerOptions) {
    this.options = {
      entryPoint: options.entryPoint,
      watchDirs: options.watchDirs || [dirname(options.entryPoint)],
      buildCommand: options.buildCommand || 'npm run build',
      outDir: options.outDir || './dist',
    };
  }

  /**
   * Start the development server
   */
  async start(): Promise<void> {
    logger.info('Starting MCP development server...');
    logger.info(`Entry point: ${this.options.entryPoint}`);
    logger.info(`Watching: ${this.options.watchDirs.join(', ')}`);

    // Initial build
    await this.build();

    // Start the server
    await this.startServer();

    // Watch for changes
    this.watchFiles();

    logger.info('Development server ready. Press Ctrl+C to stop.');
  }

  /**
   * Stop the development server
   */
  async stop(): Promise<void> {
    logger.info('Stopping development server...');

    // Stop file watcher
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    // Clear any pending restart
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    // Stop the server process
    await this.stopServer();

    logger.info('Development server stopped.');
  }

  /**
   * Build the server
   */
  private async build(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info('Building...');

      const buildProcess = spawn(this.options.buildCommand, [], {
        shell: true,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      buildProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      buildProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      buildProcess.on('close', (code) => {
        if (code === 0) {
          logger.info('Build completed');
          resolve();
        } else {
          logger.error(`Build failed with code ${code}`);
          if (stderr) {
            console.error(stderr);
          }
          reject(new Error(`Build failed: ${stderr || stdout}`));
        }
      });

      buildProcess.on('error', (error) => {
        logger.error(`Build error: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * Start the MCP server process
   */
  private async startServer(): Promise<void> {
    if (this.serverProcess) {
      await this.stopServer();
    }

    const entryExt = extname(this.options.entryPoint);
    const entryBase = basename(this.options.entryPoint, entryExt);
    const serverPath = join(this.options.outDir, `${entryBase}.js`);

    logger.info(`Starting server: ${serverPath}`);

    this.serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    this.serverProcess.stdout?.on('data', (data) => {
      console.log(`[server] ${data.toString().trim()}`);
    });

    this.serverProcess.stderr?.on('data', (data) => {
      console.error(`[server] ${data.toString().trim()}`);
    });

    this.serverProcess.on('error', (error) => {
      logger.error(`Server error: ${error.message}`);
    });

    this.serverProcess.on('exit', (code, signal) => {
      if (code !== null && code !== 0 && !this.isRestarting) {
        logger.error(`Server exited with code ${code}`);
      }
    });

    // Give the server time to start
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  /**
   * Stop the MCP server process
   */
  private async stopServer(): Promise<void> {
    if (!this.serverProcess) {
      return;
    }

    return new Promise((resolve) => {
      if (!this.serverProcess) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        logger.warn('Force killing server process...');
        this.serverProcess?.kill('SIGKILL');
      }, 5000);

      this.serverProcess.on('exit', () => {
        clearTimeout(timeout);
        this.serverProcess = null;
        resolve();
      });

      this.serverProcess.kill('SIGTERM');
    });
  }

  /**
   * Watch for file changes
   */
  private watchFiles(): void {
    this.watcher = watch(
      this.options.watchDirs[0],
      { recursive: true },
      (eventType, filename) => {
        if (!filename) {
          return;
        }

        // Only watch TypeScript and JavaScript files
        if (!filename.endsWith('.ts') && !filename.endsWith('.js')) {
          return;
        }

        // Ignore node_modules and dist
        if (filename.includes('node_modules') || filename.includes('dist')) {
          return;
        }

        logger.info(`File changed: ${filename}`);
        this.scheduleRestart();
      }
    );

    this.watcher.on('error', (error) => {
      logger.error(`Watcher error: ${error.message}`);
    });
  }

  /**
   * Schedule a restart (debounced)
   */
  private scheduleRestart(): void {
    if (this.isRestarting) {
      return;
    }

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
    }

    this.restartTimeout = setTimeout(async () => {
      this.isRestarting = true;
      this.restartTimeout = null;

      try {
        logger.info('Restarting...');
        await this.build();
        await this.startServer();
        logger.info('Restarted successfully');
      } catch (error) {
        logger.error(
          `Restart failed: ${error instanceof Error ? error.message : String(error)}`
        );
      } finally {
        this.isRestarting = false;
      }
    }, 1000);
  }
}

/**
 * Run development mode from CLI
 */
export async function runDevMode(options: MCPDevServerOptions): Promise<void> {
  const devServer = new MCPDevServer(options);

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await devServer.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await devServer.start();
  } catch (error) {
    logger.error(
      `Failed to start dev server: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}
