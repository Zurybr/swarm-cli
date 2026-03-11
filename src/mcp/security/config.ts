/**
 * MCP Security Configuration - Issue #24.5
 * Load and manage security configuration from YAML
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { parse as parseYAML } from 'yaml';
import {
  MCPSecurityConfig,
  SandboxConfig,
  MCPSecurityPermissions,
  AuditConfig,
} from './types';
import { loadSwarmConfig } from '../../integrations/mcp/config';

/**
 * Default security configuration
 */
const DEFAULT_SECURITY_CONFIG: MCPSecurityConfig = {
  defaults: {
    sandbox: {
      maxMemoryMB: 512,
      maxCpuPercent: 50,
      timeoutSeconds: 300,
      readOnly: false,
    },
    permissions: {
      filesystem: {
        deny: [
          '~/.ssh',
          '~/.gnupg',
          '/etc/passwd',
          '/etc/shadow',
          '**/.env',
          '**/.env.local',
          '**/credentials.json',
        ],
      },
    },
  },
  servers: {},
  audit: {
    enabled: true,
    logPath: path.join(os.homedir(), '.config', 'swarm-cli', 'mcp-audit.log'),
    retentionDays: 30,
  },
};

/**
 * Load security configuration from file
 */
export function loadSecurityConfig(configPath?: string): MCPSecurityConfig {
  try {
    const swarmConfig = loadSwarmConfig(configPath);
    
    // Check for security configuration in swarm config
    if (swarmConfig.mcp && 'security' in swarmConfig.mcp) {
      const rawSecurity = (swarmConfig.mcp as Record<string, unknown>).security as Record<string, unknown>;
      return mergeWithDefaults(rawSecurity);
    }
  } catch (error) {
    // Config file not found or invalid, use defaults
  }

  return { ...DEFAULT_SECURITY_CONFIG };
}

/**
 * Load security configuration from YAML string
 */
export function parseSecurityConfig(yamlContent: string): MCPSecurityConfig {
  const rawConfig = parseYAML(yamlContent) as Record<string, unknown>;
  
  if (rawConfig.mcp && typeof rawConfig.mcp === 'object') {
    const mcp = rawConfig.mcp as Record<string, unknown>;
    if (mcp.security) {
      return mergeWithDefaults(mcp.security as Record<string, unknown>);
    }
  }

  return { ...DEFAULT_SECURITY_CONFIG };
}

/**
 * Get security configuration for a specific server
 */
export function getServerSecurityConfig(
  config: MCPSecurityConfig,
  serverName: string
): {
  sandbox?: SandboxConfig;
  permissions?: MCPSecurityPermissions;
  auditEnabled: boolean;
} {
  const serverConfig = config.servers?.[serverName];
  const defaults = config.defaults;

  // Merge defaults with server-specific config
  const sandbox: SandboxConfig | undefined = serverConfig?.sandbox
    ? { ...defaults?.sandbox, ...serverConfig.sandbox }
    : defaults?.sandbox;

  const permissions: MCPSecurityPermissions | undefined = serverConfig?.permissions
    ? mergePermissions(defaults?.permissions, serverConfig.permissions)
    : defaults?.permissions;

  const auditEnabled = serverConfig?.audit ?? config.audit?.enabled ?? true;

  return {
    sandbox,
    permissions,
    auditEnabled,
  };
}

/**
 * Get audit configuration
 */
export function getAuditConfig(config: MCPSecurityConfig): AuditConfig {
  return config.audit ?? DEFAULT_SECURITY_CONFIG.audit!;
}

/**
 * Validate security configuration
 */
export function validateSecurityConfig(config: MCPSecurityConfig): string[] {
  const errors: string[] = [];

  // Validate sandbox defaults
  if (config.defaults?.sandbox) {
    const sandbox = config.defaults.sandbox;
    
    if (sandbox.maxMemoryMB !== undefined && sandbox.maxMemoryMB < 64) {
      errors.push('sandbox.maxMemoryMB should be at least 64MB');
    }

    if (sandbox.maxCpuPercent !== undefined && (sandbox.maxCpuPercent < 1 || sandbox.maxCpuPercent > 100)) {
      errors.push('sandbox.maxCpuPercent must be between 1 and 100');
    }

    if (sandbox.timeoutSeconds !== undefined && sandbox.timeoutSeconds < 10) {
      errors.push('sandbox.timeoutSeconds should be at least 10 seconds');
    }
  }

  // Validate audit config
  if (config.audit) {
    if (config.audit.retentionDays !== undefined && config.audit.retentionDays < 1) {
      errors.push('audit.retentionDays must be at least 1');
    }
  }

  // Validate server-specific configs
  for (const [serverName, serverConfig] of Object.entries(config.servers || {})) {
    if (serverConfig.sandbox?.allowedPaths && serverConfig.sandbox?.deniedPaths) {
      // Check for conflicts
      for (const allowed of serverConfig.sandbox.allowedPaths) {
        for (const denied of serverConfig.sandbox.deniedPaths) {
          if (allowed.startsWith(denied) || denied.startsWith(allowed)) {
            errors.push(`Server '${serverName}': Path conflict between allowed and denied: ${allowed} vs ${denied}`);
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Create default security configuration file
 */
export function createDefaultSecurityConfig(configPath?: string): string {
  const defaultPath = configPath ?? path.join(
    os.homedir(),
    '.config',
    'swarm-cli',
    'security.yaml'
  );

  const yamlContent = `# MCP Security Configuration
# See: https://github.com/Zurybr/swarm-cli/docs/mcp-security.md

mcp:
  security:
    # Global defaults applied to all servers
    defaults:
      sandbox:
        maxMemoryMB: 512
        maxCpuPercent: 50
        timeoutSeconds: 300
        readOnly: false
      permissions:
        filesystem:
          deny:
            - "~/.ssh"
            - "~/.gnupg"
            - "/etc/passwd"
            - "/etc/shadow"
            - "**/.env"
            - "**/.env.local"
            - "**/credentials.json"
    
    # Per-server security configuration
    servers:
      filesystem:
        sandbox:
          allowedPaths:
            - "/home/user/projects"
            - "/tmp"
          readOnly: false
        permissions:
          filesystem:
            read:
              - "/home/user/projects/**"
              - "/tmp/**"
            write:
              - "/home/user/projects/**"
            deny:
              - "/home/user/projects/secrets/**"
      
      github:
        sandbox:
          allowNetwork: true
          allowedHosts:
            - "api.github.com"
        permissions:
          tools:
            allow:
              - "github:*"
      
      database:
        sandbox:
          allowNetwork: true
        permissions:
          tools:
            deny:
              - "db:migrate:execute"
    
    # Audit logging configuration
    audit:
      enabled: true
      logPath: "~/.config/swarm-cli/mcp-audit.log"
      retentionDays: 30
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
 * Merge raw config with defaults
 */
function mergeWithDefaults(rawConfig: Record<string, unknown>): MCPSecurityConfig {
  const config: MCPSecurityConfig = {
    defaults: {
      sandbox: {
        ...DEFAULT_SECURITY_CONFIG.defaults!.sandbox,
        ...(rawConfig.defaults as Record<string, unknown>)?.sandbox as SandboxConfig,
      },
      permissions: {
        ...DEFAULT_SECURITY_CONFIG.defaults!.permissions,
        ...(rawConfig.defaults as Record<string, unknown>)?.permissions as MCPSecurityPermissions,
      },
    },
    servers: rawConfig.servers as Record<string, { sandbox?: SandboxConfig; permissions?: MCPSecurityPermissions; audit?: boolean }> || {},
    audit: {
      ...DEFAULT_SECURITY_CONFIG.audit!,
      ...(rawConfig.audit as AuditConfig),
    },
  };

  return config;
}

/**
 * Merge two permission configurations
 */
function mergePermissions(
  base?: MCPSecurityPermissions,
  override?: MCPSecurityPermissions
): MCPSecurityPermissions | undefined {
  if (!base && !override) return undefined;
  if (!base) return override;
  if (!override) return base;

  return {
    tools: {
      allow: [...(base.tools?.allow || []), ...(override.tools?.allow || [])],
      deny: [...(base.tools?.deny || []), ...(override.tools?.deny || [])],
    },
    resources: {
      allow: [...(base.resources?.allow || []), ...(override.resources?.allow || [])],
      deny: [...(base.resources?.deny || []), ...(override.resources?.deny || [])],
    },
    filesystem: {
      read: [...(base.filesystem?.read || []), ...(override.filesystem?.read || [])],
      write: [...(base.filesystem?.write || []), ...(override.filesystem?.write || [])],
      deny: [...(base.filesystem?.deny || []), ...(override.filesystem?.deny || [])],
    },
  };
}

/**
 * Get default security configuration
 */
export function getDefaultSecurityConfig(): MCPSecurityConfig {
  return { ...DEFAULT_SECURITY_CONFIG };
}
