import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import * as os from 'os';

export interface ServerConfig {
  url: string;
  token: string;
}

export interface ClientConfig {
  server: ServerConfig | null;
  localMode: boolean;
}

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.swarm');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'config.yaml');
const PROJECT_CONFIG_FILE = '.swarm/config.yaml';

let cachedConfig: ClientConfig | null = null;

function getGlobalConfigPath(): string {
  return GLOBAL_CONFIG_FILE;
}

function getProjectConfigPath(): string {
  return path.join(process.cwd(), PROJECT_CONFIG_FILE);
}

function ensureConfigDir(): void {
  if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
    fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }
}

function loadYamlConfig(filePath: string): ServerConfig | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = yaml.parse(content);
    
    if (data?.server?.url && data?.server?.token) {
      return {
        url: data.server.url,
        token: data.server.token,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function loadClientConfig(forceReload = false): ClientConfig {
  if (cachedConfig && !forceReload) {
    return cachedConfig;
  }

  const projectConfig = loadYamlConfig(getProjectConfigPath());
  if (projectConfig) {
    cachedConfig = {
      server: projectConfig,
      localMode: false,
    };
    return cachedConfig;
  }

  const globalConfig = loadYamlConfig(getGlobalConfigPath());
  if (globalConfig) {
    cachedConfig = {
      server: globalConfig,
      localMode: false,
    };
    return cachedConfig;
  }

  cachedConfig = {
    server: null,
    localMode: true,
  };
  return cachedConfig;
}

export function saveServerConfig(url: string, token: string, global = false): void {
  const configPath = global ? getGlobalConfigPath() : getProjectConfigPath();
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const existingConfig = fs.existsSync(configPath)
    ? yaml.parse(fs.readFileSync(configPath, 'utf-8')) || {}
    : {};

  const newConfig = {
    ...existingConfig,
    server: {
      url,
      token,
    },
  };

  fs.writeFileSync(configPath, yaml.stringify(newConfig), 'utf-8');
  cachedConfig = null;
}

export function clearServerConfig(global = false): void {
  const configPath = global ? getGlobalConfigPath() : getProjectConfigPath();
  
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8');
    const data = yaml.parse(content) || {};
    delete data.server;
    fs.writeFileSync(configPath, yaml.stringify(data), 'utf-8');
  }
  
  cachedConfig = null;
}

export function isRemoteMode(): boolean {
  const config = loadClientConfig();
  return config.server !== null && !config.localMode;
}

export function isLocalMode(): boolean {
  return !isRemoteMode();
}

export function getServerConfig(): ServerConfig | null {
  return loadClientConfig().server;
}

export function setLocalMode(local: boolean): void {
  const config = loadClientConfig();
  config.localMode = local;
}

export function reloadClientConfig(): ClientConfig {
  return loadClientConfig(true);
}
