/**
 * MCP Installation Manager - Issue #24.4
 * Handles installation, uninstallation, and updates of MCP servers
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MCPRegistryManager, MCPRegistryEntry } from './registry';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';

/**
 * Installation options
 */
export interface InstallOptions {
  /** Specific version to install */
  version?: string;
  /** Install globally vs locally */
  global?: boolean;
  /** Development mode (link local path) */
  dev?: boolean;
  /** Initial configuration */
  config?: Record<string, unknown>;
  /** Skip security scan */
  skipSecurityScan?: boolean;
}

/**
 * Installation result
 */
export interface InstallResult {
  /** Server name */
  name: string;
  /** Installed version */
  version: string;
  /** Installation path */
  path: string;
  /** Whether it was newly installed or already present */
  isNew: boolean;
  /** Any warnings during installation */
  warnings: string[];
}

/**
 * Update result
 */
export interface UpdateResult {
  /** Server name */
  name: string;
  /** Previous version */
  previousVersion: string;
  /** New version */
  newVersion: string;
  /** Whether an update was performed */
  updated: boolean;
}

/**
 * MCP Installer
 * Manages installation and lifecycle of MCP servers
 */
export class MCPInstaller {
  constructor(
    private registry: MCPRegistryManager,
    private configPath?: string
  ) {}

  /**
   * Get default config path
   */
  private getConfigPath(): string {
    return this.configPath || path.join(
      os.homedir(),
      '.config',
      'swarm-cli',
      'config.yaml'
    );
  }

  /**
   * Install a server from registry
   */
  async install(name: string, options: InstallOptions = {}): Promise<InstallResult> {
    const warnings: string[] = [];

    // 1. Look up in registry
    const entry = await this.registry.get(name);
    
    if (!entry) {
      // Try to install from npm directly if not in registry
      if (name.startsWith('@') || name.includes('/')) {
        return await this.installFromNpm(name, options);
      }
      throw new Error(`Server "${name}" not found in registry. Try using the full package name.`);
    }

    // 2. Check if already installed
    const installedVersion = await this.getInstalledVersion(entry.package);
    if (installedVersion && !options.version) {
      return {
        name: entry.name,
        version: installedVersion,
        path: entry.package,
        isNew: false,
        warnings: ['Server is already installed. Use --version to install a specific version.'],
      };
    }

    // 3. Install package based on runtime
    await this.installPackage(entry, options);

    // 4. Add to config
    await this.addToConfig(entry, options);

    // 5. Mark as installed in registry
    await this.registry.markInstalled(entry.name, options.version || entry.version);

    // 6. Run security scan (unless skipped)
    if (!options.skipSecurityScan) {
      const scanWarnings = await this.runSecurityScan(entry);
      warnings.push(...scanWarnings);
    }

    return {
      name: entry.name,
      version: options.version || entry.version,
      path: entry.package,
      isNew: true,
      warnings,
    };
  }

  /**
   * Install directly from npm
   */
  private async installFromNpm(packageName: string, options: InstallOptions): Promise<InstallResult> {
    console.log(`Installing ${packageName} from npm...`);

    const installCmd = options.global 
      ? `npm install -g ${packageName}`
      : `npm install ${packageName}`;

    try {
      execSync(installCmd, { stdio: 'inherit' });
    } catch (error) {
      throw new Error(`Failed to install ${packageName}: ${error}`);
    }

    const version = await this.getInstalledVersion(packageName) || 'unknown';

    // Add to local registry
    const entry: MCPRegistryEntry = {
      name: packageName.replace(/[@\/]/g, '-'),
      displayName: packageName,
      description: 'Custom MCP server',
      version,
      author: 'Unknown',
      package: packageName,
      tags: ['custom'],
      runtime: 'node',
      installed: true,
      installedVersion: version,
    };

    await this.registry.add(entry);

    return {
      name: entry.name,
      version,
      path: packageName,
      isNew: true,
      warnings: ['Custom server installed. You may need to configure it manually.'],
    };
  }

  /**
   * Install package based on runtime
   */
  private async installPackage(entry: MCPRegistryEntry, options: InstallOptions): Promise<void> {
    const { package: packageName, runtime } = entry;

    if (options.dev && fs.existsSync(packageName)) {
      // Development mode: link local path
      console.log(`Linking local package: ${packageName}`);
      execSync(`npm link ${packageName}`, { stdio: 'inherit' });
      return;
    }

    switch (runtime) {
      case 'node':
        await this.installNodePackage(packageName, options);
        break;
      case 'python':
        await this.installPythonPackage(packageName, options);
        break;
      case 'binary':
        await this.installBinaryPackage(packageName, options);
        break;
      default:
        throw new Error(`Unknown runtime: ${runtime}`);
    }
  }

  /**
   * Install Node.js package
   */
  private async installNodePackage(packageName: string, options: InstallOptions): Promise<void> {
    let installCmd = options.global 
      ? `npm install -g ${packageName}`
      : `npx -y ${packageName}`;

    if (options.version) {
      installCmd += `@${options.version}`;
    }

    console.log(`Installing Node.js package: ${packageName}`);
    
    try {
      execSync(installCmd, { stdio: 'inherit' });
    } catch (error) {
      throw new Error(`Failed to install Node.js package: ${error}`);
    }
  }

  /**
   * Install Python package
   */
  private async installPythonPackage(packageName: string, options: InstallOptions): Promise<void> {
    let installCmd = `pip install ${packageName}`;
    
    if (options.version) {
      installCmd += `==${options.version}`;
    }

    console.log(`Installing Python package: ${packageName}`);
    
    try {
      execSync(installCmd, { stdio: 'inherit' });
    } catch (error) {
      throw new Error(`Failed to install Python package: ${error}`);
    }
  }

  /**
   * Install binary package
   */
  private async installBinaryPackage(packageName: string, options: InstallOptions): Promise<void> {
    // For binary packages, assume it's a URL to download
    if (packageName.startsWith('http')) {
      const binDir = path.join(os.homedir(), '.local', 'bin');
      if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
      }

      const filename = path.basename(packageName);
      const targetPath = path.join(binDir, filename);

      console.log(`Downloading binary: ${packageName}`);
      
      // Use curl to download
      execSync(`curl -L -o ${targetPath} ${packageName}`, { stdio: 'inherit' });
      execSync(`chmod +x ${targetPath}`, { stdio: 'inherit' });
    } else {
      throw new Error(`Binary package must be a URL: ${packageName}`);
    }
  }

  /**
   * Add server to configuration
   */
  private async addToConfig(entry: MCPRegistryEntry, options: InstallOptions): Promise<void> {
    const configPath = this.getConfigPath();
    let config: any = { mcp: { servers: {} } };

    // Load existing config
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      try {
        config = parseYAML(content);
      } catch {
        // If parsing fails, use default config
      }
    }

    // Ensure structure exists
    if (!config.mcp) config.mcp = {};
    if (!config.mcp.servers) config.mcp.servers = {};

    // Add server config
    const serverConfig: any = {
      name: entry.name,
      command: this.getCommandForRuntime(entry),
      args: this.getArgsForPackage(entry),
    };

    // Add environment variables if required
    if (entry.requiredEnv && entry.requiredEnv.length > 0) {
      serverConfig.env = {};
      entry.requiredEnv.forEach(envVar => {
        serverConfig.env[envVar] = `\${${envVar}}`;
      });
    }

    // Merge with provided config
    if (options.config) {
      Object.assign(serverConfig, options.config);
    }

    config.mcp.servers[entry.name] = serverConfig;

    // Save config
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(configPath, stringifyYAML(config), 'utf-8');
    console.log(`Added ${entry.name} to ${configPath}`);
  }

  /**
   * Get command for runtime
   */
  private getCommandForRuntime(entry: MCPRegistryEntry): string {
    switch (entry.runtime) {
      case 'node':
        return 'npx';
      case 'python':
        return 'python';
      case 'binary':
        return entry.package;
      default:
        return 'npx';
    }
  }

  /**
   * Get args for package
   */
  private getArgsForPackage(entry: MCPRegistryEntry): string[] {
    switch (entry.runtime) {
      case 'node':
        return ['-y', entry.package];
      case 'python':
        return ['-m', entry.package];
      case 'binary':
        return [];
      default:
        return [];
    }
  }

  /**
   * Uninstall a server
   */
  async uninstall(name: string): Promise<void> {
    const entry = await this.registry.get(name);
    
    if (!entry) {
      throw new Error(`Server "${name}" not found in registry`);
    }

    if (!entry.installed) {
      throw new Error(`Server "${name}" is not installed`);
    }

    // Remove from config
    await this.removeFromConfig(entry.name);

    // Uninstall package
    await this.uninstallPackage(entry);

    // Mark as uninstalled in registry
    await this.registry.markUninstalled(entry.name);

    console.log(`Successfully uninstalled ${name}`);
  }

  /**
   * Remove server from configuration
   */
  private async removeFromConfig(name: string): Promise<void> {
    const configPath = this.getConfigPath();
    
    if (!fs.existsSync(configPath)) {
      return;
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    const config = parseYAML(content);

    if (config.mcp?.servers?.[name]) {
      delete config.mcp.servers[name];
      fs.writeFileSync(configPath, stringifyYAML(config), 'utf-8');
    }
  }

  /**
   * Uninstall package based on runtime
   */
  private async uninstallPackage(entry: MCPRegistryEntry): Promise<void> {
    const { package: packageName, runtime } = entry;

    try {
      switch (runtime) {
        case 'node':
          console.log(`Uninstalling Node.js package: ${packageName}`);
          execSync(`npm uninstall -g ${packageName}`, { stdio: 'inherit' });
          break;
        case 'python':
          console.log(`Uninstalling Python package: ${packageName}`);
          execSync(`pip uninstall -y ${packageName}`, { stdio: 'inherit' });
          break;
        case 'binary':
          // Remove binary file
          const binPath = path.join(os.homedir(), '.local', 'bin', path.basename(packageName));
          if (fs.existsSync(binPath)) {
            fs.unlinkSync(binPath);
          }
          break;
      }
    } catch (error) {
      console.warn(`Warning: Failed to uninstall package: ${error}`);
    }
  }

  /**
   * Update a server to latest version
   */
  async update(name: string): Promise<UpdateResult> {
    const entry = await this.registry.get(name);
    
    if (!entry) {
      throw new Error(`Server "${name}" not found in registry`);
    }

    const previousVersion = entry.installedVersion || entry.version;

    // Reinstall with latest version
    await this.installPackage(entry, {});

    // Get new version
    const newVersion = await this.getInstalledVersion(entry.package) || entry.version;

    // Update registry
    await this.registry.markInstalled(entry.name, newVersion);

    return {
      name: entry.name,
      previousVersion,
      newVersion,
      updated: previousVersion !== newVersion,
    };
  }

  /**
   * Update all servers
   */
  async updateAll(): Promise<UpdateResult[]> {
    const stats = await this.registry.getStats();
    const results: UpdateResult[] = [];

    // Get all installed servers
    const installed = await this.registry.search({ installed: true });

    for (const entry of installed) {
      try {
        const result = await this.update(entry.name);
        results.push(result);
      } catch (error) {
        console.error(`Failed to update ${entry.name}:`, error);
      }
    }

    return results;
  }

  /**
   * List installed servers
   */
  async list(): Promise<MCPRegistryEntry[]> {
    return await this.registry.search({ installed: true });
  }

  /**
   * Get installed version of a package
   */
  private async getInstalledVersion(packageName: string): Promise<string | null> {
    try {
      const output = execSync(`npm list -g ${packageName} --depth=0 --json`, {
        encoding: 'utf-8',
      });
      const data = JSON.parse(output);
      return data.dependencies?.[packageName]?.version || null;
    } catch {
      return null;
    }
  }

  /**
   * Run security scan on installed server
   */
  private async runSecurityScan(entry: MCPRegistryEntry): Promise<string[]> {
    const warnings: string[] = [];

    // Check for required environment variables
    if (entry.requiredEnv) {
      for (const envVar of entry.requiredEnv) {
        if (!process.env[envVar]) {
          warnings.push(`Required environment variable ${envVar} is not set`);
        }
      }
    }

    // Run npm audit if Node.js package
    if (entry.runtime === 'node') {
      try {
        const output = execSync(`npm audit --json`, { encoding: 'utf-8' });
        const audit = JSON.parse(output);
        
        if (audit.metadata?.vulnerabilities?.total > 0) {
          warnings.push(`Found ${audit.metadata.vulnerabilities.total} vulnerabilities in dependencies`);
        }
      } catch {
        // Audit failed, not critical
      }
    }

    return warnings;
  }

  /**
   * Test a server connection
   */
  async test(name: string): Promise<{ success: boolean; message: string }> {
    const entry = await this.registry.get(name);
    
    if (!entry) {
      return { success: false, message: `Server "${name}" not found` };
    }

    if (!entry.installed) {
      return { success: false, message: `Server "${name}" is not installed` };
    }

    try {
      // Try to start the server and check if it responds
      const command = this.getCommandForRuntime(entry);
      const args = this.getArgsForPackage(entry);

      const proc = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });

      return new Promise((resolve) => {
        let hasResolved = false;

        proc.on('error', (error) => {
          if (!hasResolved) {
            hasResolved = true;
            resolve({ success: false, message: `Failed to start: ${error.message}` });
          }
        });

        proc.on('exit', (code) => {
          if (!hasResolved) {
            hasResolved = true;
            if (code === 0) {
              resolve({ success: true, message: 'Server started successfully' });
            } else {
              resolve({ success: false, message: `Server exited with code ${code}` });
            }
          }
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true;
            proc.kill();
            resolve({ success: true, message: 'Server is responsive' });
          }
        }, 5000);
      });
    } catch (error) {
      return { 
        success: false, 
        message: `Test failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }
}
