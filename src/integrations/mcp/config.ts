/**
 * MCP Configuration - Issue #24.2
 * Load and manage MCP server configurations from YAML
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parse as parseYAML } from 'yaml';
import { MCPServerConfig, MCPConfig, SwarmConfig } from './types';

/**
 * Default configuration paths to search
 */
const CONFIG_PATHS = [
  './swarm-cli.yaml',
  './swarm-cli.yml',
  './.swarm-cli.yaml',
  './.swarm-cli.yml',
];

const GLOBAL_CONFIG_PATHS = [
  () => path.join(os.homedir(), '.config', 'swarm-cli', 'config.yaml'),
  () => path.join(os.homedir(), '.config', 'swarm-cli', 'config.yml'),
  () => path.join(os.homedir(), '.swarm-cli', 'config.yaml'),
  () => path.join(os.homedir(), '.swarm-cli', 'config.yml'),
];

/**
 * Environment variable substitution pattern
 */
const ENV_VAR_PATTERN = /\$\{([^}]+)\}/g;

/**
 * Load MCP configuration from file
 */
export function loadMCPConfig(configPath?: string): MCPConfig {
  const config = loadSwarmConfig(configPath);
  return config.mcp ?? { servers: {} };
}

/**
 * Load full Swarm configuration from file
 */
export function loadSwarmConfig(configPath?: string): SwarmConfig {
  // Try specified path first
  if (configPath) {
    return loadConfigFromPath(configPath);
  }

  // Try local config paths
  for (const localPath of CONFIG_PATHS) {
    if (fs.existsSync(localPath)) {
      return loadConfigFromPath(localPath);
    }
  }

  // Try global config paths
  for (const getGlobalPath of GLOBAL_CONFIG_PATHS) {
    const globalPath = getGlobalPath();
    if (fs.existsSync(globalPath)) {
      return loadConfigFromPath(globalPath);
    }
  }

  // No config found, return empty
  return { mcp: { servers: {} } };
}

/**
 * Load configuration from a specific path
 */
function loadConfigFromPath(configPath: string): SwarmConfig {
  const content = fs.readFileSync(configPath, 'utf-8');
  const rawConfig = parseYAML(content) as SwarmConfig;

  // Substitute environment variables
  return substituteEnvVars(rawConfig);
}

/**
 * Substitute environment variables in configuration
 * Supports ${VAR_NAME} syntax
 */
function substituteEnvVars(config: unknown): any {
  if (typeof config === 'string') {
    return config.replace(ENV_VAR_PATTERN, (_, varName) => {
      const value = process.env[varName];
      if (value === undefined) {
        console.warn(`Warning: Environment variable ${varName} is not set`);
        return '';
      }
      return value;
    });
  }

  if (Array.isArray(config)) {
    return config.map(substituteEnvVars);
  }

  if (config && typeof config === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      result[key] = substituteEnvVars(value);
    }
    return result;
  }

  return config;
}

/**
 * Get a specific server configuration
 */
export function getServerConfig(
  config: MCPConfig,
  serverName: string
): MCPServerConfig | undefined {
  return config.servers[serverName];
}

/**
 * Get all server configurations
 */
export function getAllServerConfigs(config: MCPConfig): MCPServerConfig[] {
  return Object.entries(config.servers).map(([name, serverConfig]) => ({
    ...serverConfig,
    name,
  }));
}

/**
 * Validate a server configuration
 */
export function validateServerConfig(config: MCPServerConfig): string[] {
  const errors: string[] = [];

  if (!config.name) {
    errors.push('Server name is required');
  }

  if (!config.command && !config.url) {
    errors.push('Either command or url is required');
  }

  if (config.transport === 'stdio' && !config.command) {
    errors.push('command is required for stdio transport');
  }

  if ((config.transport === 'http' || config.transport === 'sse') && !config.url) {
    errors.push('url is required for http/sse transport');
  }

  if (config.args && !Array.isArray(config.args)) {
    errors.push('args must be an array');
  }

  if (config.env && typeof config.env !== 'object') {
    errors.push('env must be an object');
  }

  return errors;
}

/**
 * Create a default configuration file
 */
export function createDefaultConfig(configPath?: string): string {
  const defaultPath = configPath ?? path.join(
    os.homedir(),
    '.config',
    'swarm-cli',
    'config.yaml'
  );

  const defaultConfig: SwarmConfig = {
    mcp: {
      servers: {
        filesystem: {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user'],
        },
        github: {
          name: 'github',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: {
            GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}',
          },
        },
      },
    },
  };

  const yamlContent = `# Swarm CLI Configuration
# See: https://github.com/Zurybr/swarm-cli

mcp:
  servers:
    # Filesystem MCP server
    filesystem:
      name: filesystem
      command: npx
      args:
        - "-y"
        - "@modelcontextprotocol/server-filesystem"
        - "/home/user"

    # GitHub MCP server
    github:
      name: github
      command: npx
      args:
        - "-y"
        - "@modelcontextprotocol/server-github"
      env:
        GITHUB_PERSONAL_ACCESS_TOKEN: "\${GITHUB_TOKEN}"
`;

  // Create directory if it doesn't exist
  const dir = path.dirname(defaultPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write config file
  fs.writeFileSync(defaultPath, yamlContent, 'utf-8');

  return defaultPath;
}

/**
 * Merge multiple configurations (later configs override earlier)
 */
export function mergeConfigs(...configs: MCPConfig[]): MCPConfig {
  const merged: MCPConfig = { servers: {} };

  for (const config of configs) {
    for (const [name, server] of Object.entries(config.servers)) {
      merged.servers[name] = server;
    }
  }

  return merged;
}

/**
 * Get the path to the user's config directory
 */
export function getConfigDir(): string {
  return path.join(os.homedir(), '.config', 'swarm-cli');
}

/**
 * Check if a configuration file exists
 */
export function configExists(configPath?: string): boolean {
  if (configPath) {
    return fs.existsSync(configPath);
  }

  for (const localPath of CONFIG_PATHS) {
    if (fs.existsSync(localPath)) {
      return true;
    }
  }

  for (const getGlobalPath of GLOBAL_CONFIG_PATHS) {
    if (fs.existsSync(getGlobalPath())) {
      return true;
    }
  }

  return false;
}
