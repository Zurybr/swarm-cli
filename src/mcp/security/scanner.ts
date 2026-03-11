/**
 * MCP Security Scanner - Issue #24.5
 * Security scanning for MCP server configurations
 */

import {
  SecurityScanResult,
  SecurityFinding,
  RiskLevel,
  FindingSeverity,
  FindingType,
  SandboxConfig,
  MCPSecurityPermissions,
} from './types';
import { MCPServerConfig } from '../../integrations/mcp/types';

/**
 * Sensitive paths that should always be denied
 */
const SENSITIVE_PATHS = [
  '~/.ssh',
  '~/.gnupg',
  '~/.config',
  '/etc/passwd',
  '/etc/shadow',
  '/etc/ssh',
  '/root',
  '**/.env',
  '**/.env.local',
  '**/.env.*.local',
  '**/credentials.json',
  '**/secrets.json',
  '**/.git/config',
  '**/.npmrc',
  '**/.pypirc',
];

/**
 * Sensitive environment variables
 */
const SENSITIVE_ENV_VARS = [
  'PASSWORD',
  'SECRET',
  'KEY',
  'TOKEN',
  'API_KEY',
  'PRIVATE_KEY',
  'CREDENTIAL',
  'AUTH',
];

/**
 * Commands that are considered risky
 */
const RISKY_COMMANDS = [
  'sudo',
  'su',
  'chmod',
  'chown',
  'rm -rf',
  'dd',
  'mkfs',
  'fdisk',
  'eval',
  'exec',
];

/**
 * MCP Security Scanner
 * Analyzes server configurations for security risks
 */
export class MCPSecurityScanner {
  /**
   * Scan a server configuration for security risks
   */
  async scanServer(config: MCPServerConfig): Promise<SecurityScanResult> {
    const findings: SecurityFinding[] = [];

    // Scan various aspects
    this.scanFilesystemAccess(config, findings);
    this.scanNetworkAccess(config, findings);
    this.scanCommand(config, findings);
    this.scanEnvironment(config, findings);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(findings);
    const riskLevel = this.determineRiskLevel(riskScore);

    return {
      riskLevel,
      riskScore,
      findings,
      serverName: config.name,
      scannedAt: new Date(),
    };
  }

  /**
   * Scan with security configuration applied
   */
  async scanWithSecurity(
    config: MCPServerConfig,
    sandbox?: SandboxConfig,
    permissions?: MCPSecurityPermissions
  ): Promise<SecurityScanResult> {
    // First scan the base configuration
    const baseResult = await this.scanServer(config);
    const findings = [...baseResult.findings];

    // Check if security measures mitigate risks
    if (sandbox) {
      this.evaluateSandboxMitigations(sandbox, findings);
    }

    if (permissions) {
      this.evaluatePermissionMitigations(permissions, findings);
    }

    // Recalculate risk score
    const riskScore = this.calculateRiskScore(findings);
    const riskLevel = this.determineRiskLevel(riskScore);

    return {
      riskLevel,
      riskScore,
      findings,
      serverName: config.name,
      scannedAt: new Date(),
    };
  }

  /**
   * Scan filesystem access configuration
   */
  private scanFilesystemAccess(
    config: MCPServerConfig,
    findings: SecurityFinding[]
  ): void {
    // Check for broad filesystem access in args
    const args = config.args || [];
    const hasRootAccess = args.some((arg: string) => 
      arg === '/' || arg === '~' || arg === '/home'
    );

    if (hasRootAccess) {
      findings.push({
        type: 'filesystem',
        severity: 'danger',
        message: 'Server has access to root or home directory',
        recommendation: 'Limit filesystem access to specific project directories. Use sandbox.allowedPaths to restrict access.',
        context: { args },
      });
    }

    // Check for access to multiple directories
    const dirCount = args.filter((arg: string) => 
      arg.startsWith('/') || arg.startsWith('~') || arg.startsWith('./')
    ).length;

    if (dirCount > 3) {
      findings.push({
        type: 'filesystem',
        severity: 'warning',
        message: `Server has access to ${dirCount} directories`,
        recommendation: 'Consider limiting the number of accessible directories.',
        context: { dirCount },
      });
    }

    // Check for sensitive paths in args
    for (const arg of args) {
      for (const sensitive of SENSITIVE_PATHS) {
        if (this.pathMatches(arg, sensitive)) {
          findings.push({
            type: 'filesystem',
            severity: 'danger',
            message: `Server may have access to sensitive path: ${sensitive}`,
            recommendation: 'Add this path to permissions.filesystem.deny list.',
            context: { path: arg, sensitivePath: sensitive },
          });
        }
      }
    }
  }

  /**
   * Scan network access configuration
   */
  private scanNetworkAccess(
    config: MCPServerConfig,
    findings: SecurityFinding[]
  ): void {
    // HTTP transport implies network access
    if (config.transport === 'http' || config.transport === 'sse') {
      findings.push({
        type: 'network',
        severity: 'warning',
        message: 'Server uses HTTP transport (network access required)',
        recommendation: 'Ensure the server URL is trusted. Use sandbox.allowedHosts to restrict network access.',
        context: { url: config.url },
      });
    }

    // Check for external URLs in args or env
    const urlPattern = /https?:\/\/[^\s]+/g;
    const allStrings = [
      ...(config.args || []),
      ...Object.values(config.env || {}),
    ].filter(Boolean) as string[];

    for (const str of allStrings) {
      const urls = str.match(urlPattern);
      if (urls) {
        for (const url of urls) {
          const host = this.extractHost(url);
          findings.push({
            type: 'network',
            severity: 'info',
            message: `Server configuration contains URL: ${host}`,
            recommendation: 'Verify this URL is intended and trusted.',
            context: { url, host },
          });
        }
      }
    }
  }

  /**
   * Scan command for risky patterns
   */
  private scanCommand(
    config: MCPServerConfig,
    findings: SecurityFinding[]
  ): void {
    const command = config.command.toLowerCase();
    const fullCommand = `${command} ${(config.args || []).join(' ')}`.toLowerCase();

    for (const risky of RISKY_COMMANDS) {
      if (fullCommand.includes(risky)) {
        findings.push({
          type: 'command',
          severity: 'danger',
          message: `Server command contains risky operation: ${risky}`,
          recommendation: 'Review the server command carefully. Consider using an alternative server or applying strict sandboxing.',
          context: { command: config.command, riskyCommand: risky },
        });
      }
    }

    // Check for shell execution
    if (command === 'sh' || command === 'bash' || command === 'zsh') {
      findings.push({
        type: 'command',
        severity: 'warning',
        message: 'Server runs through a shell interpreter',
        recommendation: 'Prefer direct execution of the server binary. Shell interpreters can be manipulated.',
        context: { command: config.command },
      });
    }

    // Check for npx/npm execution
    if (command === 'npx' || command === 'npm') {
      findings.push({
        type: 'command',
        severity: 'info',
        message: 'Server runs via npx/npm',
        recommendation: 'Ensure the package is from a trusted source. Consider pinning the version.',
        context: { command: config.command },
      });
    }
  }

  /**
   * Scan environment variables
   */
  private scanEnvironment(
    config: MCPServerConfig,
    findings: SecurityFinding[]
  ): void {
    const env = config.env || {};

    for (const [key, value] of Object.entries(env)) {
      const upperKey = key.toUpperCase();
      
      // Check for sensitive variable names
      for (const sensitive of SENSITIVE_ENV_VARS) {
        if (upperKey.includes(sensitive)) {
          findings.push({
            type: 'env',
            severity: 'warning',
            message: `Server has access to sensitive environment variable: ${key}`,
            recommendation: 'Ensure this variable is necessary. Use sandbox.allowedEnvVars to limit environment access.',
            context: { key },
          });
          break;
        }
      }

      // Check for hardcoded secrets
      if (typeof value === 'string' && !value.includes('${') && value.length > 20) {
        findings.push({
          type: 'env',
          severity: 'warning',
          message: `Environment variable ${key} may contain a hardcoded secret`,
          recommendation: 'Use environment variable substitution (${VAR_NAME}) instead of hardcoding secrets.',
          context: { key },
        });
      }
    }
  }

  /**
   * Evaluate how sandbox settings mitigate risks
   */
  private evaluateSandboxMitigations(
    sandbox: SandboxConfig,
    findings: SecurityFinding[]
  ): void {
    // Add mitigated findings for sandbox settings
    if (sandbox.maxMemoryMB) {
      findings.push({
        type: 'permission',
        severity: 'info',
        message: `Memory limited to ${sandbox.maxMemoryMB}MB`,
        recommendation: 'Good practice - this prevents memory exhaustion attacks.',
      });
    }

    if (sandbox.timeoutSeconds) {
      findings.push({
        type: 'permission',
        severity: 'info',
        message: `Execution timeout set to ${sandbox.timeoutSeconds}s`,
        recommendation: 'Good practice - this prevents runaway processes.',
      });
    }

    if (sandbox.readOnly) {
      findings.push({
        type: 'permission',
        severity: 'info',
        message: 'Filesystem access is read-only',
        recommendation: 'Good practice - this prevents unauthorized modifications.',
      });
    }

    if (!sandbox.allowNetwork) {
      findings.push({
        type: 'permission',
        severity: 'info',
        message: 'Network access is disabled',
        recommendation: 'Good practice - this prevents data exfiltration.',
      });
    }

    if (sandbox.allowedPaths?.length) {
      findings.push({
        type: 'permission',
        severity: 'info',
        message: `Filesystem restricted to ${sandbox.allowedPaths.length} path(s)`,
        recommendation: 'Good practice - limits potential damage from filesystem access.',
      });
    }
  }

  /**
   * Evaluate how permission settings mitigate risks
   */
  private evaluatePermissionMitigations(
    permissions: MCPSecurityPermissions,
    findings: SecurityFinding[]
  ): void {
    if (permissions.filesystem?.deny?.length) {
      findings.push({
        type: 'permission',
        severity: 'info',
        message: `${permissions.filesystem.deny.length} path(s) explicitly denied`,
        recommendation: 'Good practice - explicit denials protect sensitive paths.',
      });
    }

    if (permissions.tools?.allow?.length && !permissions.tools?.deny?.length) {
      findings.push({
        type: 'permission',
        severity: 'info',
        message: `${permissions.tools.allow.length} tool(s) explicitly allowed`,
        recommendation: 'Good practice - using allow-lists limits available functionality.',
      });
    }
  }

  /**
   * Calculate risk score from findings
   */
  private calculateRiskScore(findings: SecurityFinding[]): number {
    let score = 0;

    for (const finding of findings) {
      // Severity weights (but ignore info-level mitigations)
      if (finding.severity === 'danger') {
        score += 30;
      } else if (finding.severity === 'warning') {
        score += 10;
      } else if (finding.severity === 'info') {
        // Info findings from mitigations reduce the score
        if (finding.type === 'permission') {
          score -= 5;
        }
      }
    }

    // Clamp to 0-100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): RiskLevel {
    if (score >= 70) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  /**
   * Check if a path matches a pattern
   */
  private pathMatches(path: string, pattern: string): boolean {
    const normalizedPath = path.replace(/\\/g, '/');
    const normalizedPattern = pattern.replace(/\\/g, '/');

    if (normalizedPattern.includes('**')) {
      const regex = new RegExp(
        '^' + normalizedPattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*') + '$'
      );
      return regex.test(normalizedPath);
    }

    return normalizedPath.includes(normalizedPattern);
  }

  /**
   * Extract host from URL
   */
  private extractHost(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }
}

/**
 * Quick scan function for convenience
 */
export async function scanServerSecurity(
  config: MCPServerConfig
): Promise<SecurityScanResult> {
  const scanner = new MCPSecurityScanner();
  return scanner.scanServer(config);
}

/**
 * Compare two scan results to see if security improved
 */
export function compareSecurity(
  before: SecurityScanResult,
  after: SecurityScanResult
): {
  improved: boolean;
  scoreChange: number;
  riskChange: number;
} {
  const scoreChange = after.riskScore - before.riskScore;
  
  const riskLevels: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };
  
  const riskChange = riskLevels[after.riskLevel] - riskLevels[before.riskLevel];

  return {
    improved: scoreChange < 0,
    scoreChange,
    riskChange,
  };
}
