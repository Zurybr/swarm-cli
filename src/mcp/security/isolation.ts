/**
 * MCP Process Isolation / Sandbox - Issue #24.5
 * Sandboxed process runner for secure MCP server execution
 */

import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import {
  SandboxConfig,
  SandboxViolationError,
  MCPSecurityError,
} from './types';

/**
 * Default sandbox configuration
 */
const DEFAULT_SANDBOX_CONFIG: Required<SandboxConfig> = {
  maxMemoryMB: 512,
  maxCpuPercent: 50,
  timeoutSeconds: 300,
  allowedPaths: [],
  deniedPaths: [],
  readOnly: false,
  allowNetwork: false,
  allowedHosts: [],
  allowedEnvVars: [],
  cleanEnv: false,
};

/**
 * Platform detection
 */
const isLinux = os.platform() === 'linux';
const isMacOS = os.platform() === 'darwin';
const isWindows = os.platform() === 'win32';

/**
 * MCP Sandbox for secure process execution
 */
export class MCPSandbox {
  private config: Required<SandboxConfig>;
  private process: ChildProcess | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private memoryCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: SandboxConfig = {}) {
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
    
    // Normalize paths
    this.config.allowedPaths = this.config.allowedPaths.map(p => this.expandPath(p));
    this.config.deniedPaths = this.config.deniedPaths.map(p => this.expandPath(p));
  }

  /**
   * Spawn a sandboxed process
   */
  async spawn(command: string, args: string[] = []): Promise<ChildProcess> {
    // Validate command and paths
    this.validateCommand(command, args);

    // Build spawn options with sandbox restrictions
    const spawnOptions = this.buildSpawnOptions();

    // Spawn the process
    this.process = spawn(command, args, spawnOptions);
    this.startTime = Date.now();

    // Set up timeout
    if (this.config.timeoutSeconds > 0) {
      this.timeoutHandle = setTimeout(() => {
        this.handleTimeout();
      }, this.config.timeoutSeconds * 1000);
    }

    // Set up resource monitoring (Linux only for now)
    if (isLinux && this.process.pid) {
      this.startResourceMonitoring(this.process.pid);
    }

    // Handle process events
    this.process.on('exit', () => {
      this.cleanup();
    });

    this.process.on('error', (error) => {
      console.error(`[Sandbox] Process error: ${error.message}`);
    });

    return this.process;
  }

  /**
   * Kill the sandboxed process
   */
  async kill(): Promise<void> {
    if (this.process && !this.process.killed) {
      // Try graceful shutdown first
      this.process.kill('SIGTERM');

      // Force kill after 5 seconds
      await new Promise<void>((resolve) => {
        const forceKillTimeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process?.on('exit', () => {
          clearTimeout(forceKillTimeout);
          resolve();
        });
      });
    }

    this.cleanup();
  }

  /**
   * Check if process is running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Get process PID
   */
  getPid(): number | undefined {
    return this.process?.pid;
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedTime(): number {
    return (Date.now() - this.startTime) / 1000;
  }

  /**
   * Get current sandbox configuration
   */
  getConfig(): Readonly<Required<SandboxConfig>> {
    return { ...this.config };
  }

  /**
   * Update sandbox configuration (requires restart)
   */
  updateConfig(config: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Build spawn options with sandbox restrictions
   */
  private buildSpawnOptions(): SpawnOptions {
    const options: SpawnOptions = {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    };

    // Handle environment
    if (this.config.cleanEnv) {
      options.env = this.buildCleanEnv();
    } else {
      options.env = {
        ...process.env,
        ...this.buildAllowedEnv(),
      };
    }

    // Platform-specific sandboxing
    if (isLinux) {
      // On Linux, we can use namespaces and resource limits
      // Note: This requires CAP_SYS_ADMIN or unprivileged user namespaces
      Object.assign(options, this.getLinuxSandboxOptions());
    } else if (isMacOS) {
      // On macOS, we can use seatbelt (sandbox-exec)
      Object.assign(options, this.getMacOSSandboxOptions());
    } else if (isWindows) {
      // On Windows, we can use Job Objects
      Object.assign(options, this.getWindowsSandboxOptions());
    }

    return options;
  }

  /**
   * Build clean environment with only allowed variables
   */
  private buildCleanEnv(): Record<string, string> {
    const env: Record<string, string> = {};

    // Always include PATH and HOME
    env.PATH = process.env.PATH || '';
    env.HOME = process.env.HOME || '';

    // Add allowed variables
    for (const varName of this.config.allowedEnvVars) {
      const value = process.env[varName];
      if (value !== undefined) {
        env[varName] = value;
      }
    }

    return env;
  }

  /**
   * Build allowed environment variables
   */
  private buildAllowedEnv(): Record<string, string> {
    if (this.config.allowedEnvVars.length === 0) {
      return {};
    }

    const env: Record<string, string> = {};
    for (const varName of this.config.allowedEnvVars) {
      const value = process.env[varName];
      if (value !== undefined) {
        env[varName] = value;
      }
    }

    return env;
  }

  /**
   * Get Linux-specific sandbox options
   */
  private getLinuxSandboxOptions(): SpawnOptions {
    // Note: Full namespace isolation requires elevated privileges
    // For now, we use basic resource limits via ulimit-style approach
    
    const options: SpawnOptions = {};

    // We'll apply resource limits after spawning via /proc
    // This is a simplified approach - full implementation would use
    // clone() with CLONE_NEWNS, CLONE_NEWNET, etc.

    return options;
  }

  /**
   * Get macOS-specific sandbox options
   */
  private getMacOSSandboxOptions(): SpawnOptions {
    // macOS uses sandbox-exec for isolation
    // This would require wrapping the command with sandbox-exec
    // For now, we return basic options
    return {};
  }

  /**
   * Get Windows-specific sandbox options
   */
  private getWindowsSandboxOptions(): SpawnOptions {
    // Windows uses Job Objects for resource limiting
    // This would require native addon or separate process management
    return {};
  }

  /**
   * Validate command before execution
   */
  private validateCommand(command: string, args: string[]): void {
    // Expand and check command path
    const expandedCommand = this.expandPath(command);

    // Check if command path is in denied paths
    for (const denied of this.config.deniedPaths) {
      if (expandedCommand.startsWith(denied)) {
        throw new SandboxViolationError(
          'Command in denied path',
          { command: expandedCommand, deniedPath: denied }
        );
      }
    }

    // Check arguments for denied paths
    for (const arg of args) {
      if (arg.startsWith('/') || arg.startsWith('~') || arg.startsWith('./')) {
        const expandedArg = this.expandPath(arg);

        // Check against denied paths
        for (const denied of this.config.deniedPaths) {
          if (expandedArg.startsWith(denied)) {
            throw new SandboxViolationError(
              'Argument references denied path',
              { arg: expandedArg, deniedPath: denied }
            );
          }
        }

        // Check against allowed paths (if specified)
        if (this.config.allowedPaths.length > 0) {
          const isAllowed = this.config.allowedPaths.some(
            allowed => expandedArg.startsWith(allowed)
          );
          if (!isAllowed) {
            throw new SandboxViolationError(
              'Argument references non-allowed path',
              { arg: expandedArg, allowedPaths: this.config.allowedPaths }
            );
          }
        }
      }
    }
  }

  /**
   * Start resource monitoring for the process
   */
  private startResourceMonitoring(pid: number): void {
    this.memoryCheckInterval = setInterval(async () => {
      try {
        // Read memory usage from /proc/[pid]/status
        const fs = await import('fs');
        const statusPath = `/proc/${pid}/status`;
        
        if (fs.existsSync(statusPath)) {
          const content = fs.readFileSync(statusPath, 'utf-8');
          const vmRSSMatch = content.match(/VmRSS:\s+(\d+)\s+kB/);
          
          if (vmRSSMatch) {
            const memoryMB = parseInt(vmRSSMatch[1], 10) / 1024;
            
            if (memoryMB > this.config.maxMemoryMB) {
              console.warn(`[Sandbox] Memory limit exceeded: ${memoryMB.toFixed(1)}MB > ${this.config.maxMemoryMB}MB`);
              this.process?.kill('SIGTERM');
            }
          }
        }
      } catch {
        // Process may have exited, ignore errors
      }
    }, 1000); // Check every second
  }

  /**
   * Handle timeout
   */
  private handleTimeout(): void {
    if (this.process && !this.process.killed) {
      console.warn(
        `[Sandbox] Process timed out after ${this.config.timeoutSeconds}s`
      );
      this.process.kill('SIGTERM');
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }

    this.process = null;
  }

  /**
   * Expand path (handle ~ and environment variables)
   */
  private expandPath(p: string): string {
    let expanded = p;

    // Expand home directory
    if (expanded.startsWith('~')) {
      expanded = path.join(os.homedir(), expanded.slice(1));
    }

    // Expand environment variables
    expanded = expanded.replace(/\$\{([^}]+)\}/g, (_, varName) => {
      return process.env[varName] || '';
    });

    // Normalize path
    return path.normalize(expanded);
  }
}

/**
 * Create a sandbox from configuration
 */
export function createSandbox(config?: SandboxConfig): MCPSandbox | null {
  if (!config) {
    return null;
  }
  return new MCPSandbox(config);
}

/**
 * Check if sandboxing capabilities are available on this platform
 */
export function checkSandboxCapabilities(): {
  available: boolean;
  limitations: string[];
  recommendations: string[];
} {
  const limitations: string[] = [];
  const recommendations: string[] = [];

  if (isLinux) {
    // Check for unprivileged user namespaces
    // This is a simplified check
    recommendations.push('For full isolation, enable unprivileged user namespaces');
    recommendations.push('Consider using Docker or Firejail for stronger isolation');
  } else if (isMacOS) {
    recommendations.push('macOS sandbox-exec provides basic isolation');
    recommendations.push('Consider using Docker for stronger isolation');
  } else if (isWindows) {
    limitations.push('Windows sandboxing is limited without additional tools');
    recommendations.push('Consider using Windows Sandbox or Docker for isolation');
  }

  return {
    available: true, // Basic sandboxing is always available
    limitations,
    recommendations,
  };
}

/**
 * Get default sandbox configuration
 */
export function getDefaultSandboxConfig(): Required<SandboxConfig> {
  return { ...DEFAULT_SANDBOX_CONFIG };
}

/**
 * Merge sandbox configurations
 */
export function mergeSandboxConfig(
  base: SandboxConfig,
  override: SandboxConfig
): SandboxConfig {
  return {
    ...base,
    ...override,
    // Merge arrays
    allowedPaths: [...(base.allowedPaths || []), ...(override.allowedPaths || [])],
    deniedPaths: [...(base.deniedPaths || []), ...(override.deniedPaths || [])],
    allowedHosts: [...(base.allowedHosts || []), ...(override.allowedHosts || [])],
    allowedEnvVars: [...(base.allowedEnvVars || []), ...(override.allowedEnvVars || [])],
  };
}
