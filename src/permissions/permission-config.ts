import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

export type PermissionLevel = boolean | 'ask' | 'auto';

export interface ToolPermission {
  tool: string;
  level: PermissionLevel;
  remember?: boolean;
}

export interface PermissionConfig {
  version: string;
  defaults: {
    [tool: string]: PermissionLevel;
  };
  roles: {
    [roleName: string]: {
      [tool: string]: PermissionLevel;
    };
  };
  remember: {
    [tool: string]: boolean;
  };
}

export function getDefaultPermissionConfig(): PermissionConfig {
  return {
    version: '1.0',
    defaults: {
      'read': true,
      'write': false,
      'execute': 'ask',
      'delete': false,
      'network': 'auto',
    },
    roles: {
      safe: {
        'read': true,
        'write': true,
        'execute': true,
        'delete': 'ask',
        'network': 'auto',
      },
      restricted: {
        'read': true,
        'write': false,
        'execute': false,
        'delete': false,
        'network': false,
      },
    },
    remember: {},
  };
}

export function loadPermissionConfig(configPath?: string): PermissionConfig {
  const defaultPath = path.join(process.cwd(), '.swarm', 'permissions.yaml');
  const searchPaths = [
    configPath,
    process.env.SWARM_PERMISSIONS,
    defaultPath,
  ].filter(Boolean) as string[];

  for (const p of searchPaths) {
    if (p && fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      const parsed = yaml.parse(content) as Partial<PermissionConfig>;
      return { ...getDefaultPermissionConfig(), ...parsed };
    }
  }

  return getDefaultPermissionConfig();
}

export function savePermissionConfig(config: PermissionConfig, configPath?: string): void {
  const defaultPath = path.join(process.cwd(), '.swarm', 'permissions.yaml');
  const savePath = configPath || defaultPath;
  
  const dir = path.dirname(savePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(savePath, yaml.stringify(config), 'utf-8');
}

export function getPermissionFromHierarchy(
  config: PermissionConfig,
  tool: string,
  role?: string
): PermissionLevel {
  if (role && config.roles[role] && config.roles[role][tool] !== undefined) {
    return config.roles[role][tool];
  }
  
  if (config.defaults[tool] !== undefined) {
    return config.defaults[tool];
  }
  
  return 'ask';
}

export function rememberChoice(config: PermissionConfig, tool: string, allowed: boolean): PermissionConfig {
  return {
    ...config,
    remember: {
      ...config.remember,
      [tool]: allowed,
    },
  };
}

export function getRememberedChoice(config: PermissionConfig, tool: string): boolean | null {
  return config.remember[tool] !== undefined ? config.remember[tool] : null;
}
