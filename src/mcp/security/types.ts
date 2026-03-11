/**
 * MCP Security Types - Issue #24.5
 * Type definitions for MCP security features
 */

// ============================================================================
// Sandbox Configuration
// ============================================================================

export interface SandboxConfig {
  /** Maximum memory in MB (default: 512) */
  maxMemoryMB?: number;
  /** Maximum CPU percentage (default: 50) */
  maxCpuPercent?: number;
  /** Maximum execution time in seconds (default: 300) */
  timeoutSeconds?: number;
  
  /** Paths the server is allowed to access */
  allowedPaths?: string[];
  /** Paths explicitly denied */
  deniedPaths?: string[];
  /** Read-only filesystem access */
  readOnly?: boolean;
  
  /** Allow network access */
  allowNetwork?: boolean;
  /** Allowed hostnames/IPs for network access */
  allowedHosts?: string[];
  
  /** Environment variables to pass through */
  allowedEnvVars?: string[];
  /** Start with clean environment */
  cleanEnv?: boolean;
}

// ============================================================================
// Permission System
// ============================================================================

export interface MCPSecurityPermissions {
  /** Tool permissions */
  tools?: {
    /** Allowed tool patterns (supports wildcards) */
    allow?: string[];
    /** Denied tool patterns (takes precedence) */
    deny?: string[];
  };
  /** Resource permissions */
  resources?: {
    /** Allowed resource URI patterns */
    allow?: string[];
    /** Denied resource URI patterns (takes precedence) */
    deny?: string[];
  };
  /** Filesystem permissions */
  filesystem?: {
    /** Allowed read paths */
    read?: string[];
    /** Allowed write paths */
    write?: string[];
    /** Denied paths (takes precedence) */
    deny?: string[];
  };
}

// ============================================================================
// Audit Logging
// ============================================================================

export type AuditEventType = 
  | 'tool_call'
  | 'resource_read'
  | 'resource_write'
  | 'permission_denied'
  | 'error'
  | 'server_start'
  | 'server_stop'
  | 'sandbox_violation';

export interface AuditEvent {
  /** Event timestamp */
  timestamp: Date;
  /** Server name */
  serverName: string;
  /** Event type */
  eventType: AuditEventType;
  /** Event details */
  details: {
    toolName?: string;
    args?: Record<string, unknown>;
    resourceUri?: string;
    error?: string;
    message?: string;
    violation?: string;
  };
  /** Whether the operation succeeded */
  success: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface AuditQuery {
  /** Filter by server name */
  serverName?: string;
  /** Filter by event type */
  eventType?: AuditEventType;
  /** Filter by success status */
  success?: boolean;
  /** Start date filter */
  startDate?: Date;
  /** End date filter */
  endDate?: Date;
  /** Maximum results to return */
  limit?: number;
}

export interface AuditReport {
  /** Report generation timestamp */
  generatedAt: Date;
  /** Total events in period */
  totalEvents: number;
  /** Events by type */
  eventsByType: Record<AuditEventType, number>;
  /** Events by server */
  eventsByServer: Record<string, number>;
  /** Permission denial count */
  permissionDeniedCount: number;
  /** Error count */
  errorCount: number;
  /** Sandbox violation count */
  sandboxViolationCount: number;
  /** Top denied tools */
  topDeniedTools: Array<{ toolName: string; count: number }>;
  /** Top denied resources */
  topDeniedResources: Array<{ uri: string; count: number }>;
}

// ============================================================================
// Security Scanner
// ============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type FindingSeverity = 'info' | 'warning' | 'danger';
export type FindingType = 'filesystem' | 'network' | 'command' | 'env' | 'permission';

export interface SecurityFinding {
  /** Finding type */
  type: FindingType;
  /** Severity level */
  severity: FindingSeverity;
  /** Finding message */
  message: string;
  /** Recommendation to fix */
  recommendation: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

export interface SecurityScanResult {
  /** Overall risk level */
  riskLevel: RiskLevel;
  /** Risk score (0-100) */
  riskScore: number;
  /** List of findings */
  findings: SecurityFinding[];
  /** Server name that was scanned */
  serverName: string;
  /** Scan timestamp */
  scannedAt: Date;
}

// ============================================================================
// Security Configuration
// ============================================================================

export interface SandboxDefaults {
  maxMemoryMB?: number;
  maxCpuPercent?: number;
  timeoutSeconds?: number;
  readOnly?: boolean;
  allowNetwork?: boolean;
}

export interface PermissionDefaults {
  filesystem?: {
    deny?: string[];
  };
}

export interface AuditConfig {
  /** Enable audit logging */
  enabled: boolean;
  /** Path to audit log file */
  logPath: string;
  /** Days to retain logs */
  retentionDays: number;
  /** Maximum log file size in MB */
  maxSizeMB?: number;
}

export interface ServerSecurityConfig {
  /** Sandbox configuration for this server */
  sandbox?: SandboxConfig;
  /** Permissions for this server */
  permissions?: MCPSecurityPermissions;
  /** Enable audit logging for this server */
  audit?: boolean;
}

export interface MCPSecurityConfig {
  /** Default sandbox settings */
  defaults?: {
    sandbox?: SandboxDefaults;
    permissions?: PermissionDefaults;
  };
  /** Per-server security configuration */
  servers?: Record<string, ServerSecurityConfig>;
  /** Audit logging configuration */
  audit?: AuditConfig;
}

// ============================================================================
// Security Context
// ============================================================================

export interface SecurityContext {
  /** Server name */
  serverName: string;
  /** Sandbox configuration */
  sandbox?: SandboxConfig;
  /** Permission checker */
  permissions?: MCPSecurityPermissions;
  /** Audit logging enabled */
  auditEnabled: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export class MCPSecurityError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MCPSecurityError';
  }
}

export class PermissionDeniedError extends MCPSecurityError {
  constructor(
    public readonly resourceType: 'tool' | 'resource' | 'file',
    public readonly resourceName: string,
    reason?: string
  ) {
    super(
      `Permission denied: ${resourceType} '${resourceName}'${reason ? ` - ${reason}` : ''}`,
      'PERMISSION_DENIED',
      { resourceType, resourceName, reason }
    );
    this.name = 'PermissionDeniedError';
  }
}

export class SandboxViolationError extends MCPSecurityError {
  constructor(
    public readonly violation: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(
      `Sandbox violation: ${violation}`,
      'SANDBOX_VIOLATION',
      { violation, ...details }
    );
    this.name = 'SandboxViolationError';
  }
}

export class SecurityScanError extends MCPSecurityError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SECURITY_SCAN_ERROR', details);
    this.name = 'SecurityScanError';
  }
}
