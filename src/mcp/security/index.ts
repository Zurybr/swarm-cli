/**
 * MCP Security Module - Issue #24.5
 * Public exports for MCP security features
 */

// Types
export {
  // Sandbox types
  SandboxConfig,
  // Permission types
  MCPSecurityPermissions,
  // Audit types
  AuditEventType,
  AuditEvent,
  AuditQuery,
  AuditReport,
  AuditConfig,
  // Scanner types
  RiskLevel,
  FindingSeverity,
  FindingType,
  SecurityFinding,
  SecurityScanResult,
  // Config types
  SandboxDefaults,
  PermissionDefaults,
  ServerSecurityConfig,
  MCPSecurityConfig,
  SecurityContext,
  // Error types
  MCPSecurityError,
  PermissionDeniedError,
  SandboxViolationError,
  SecurityScanError,
} from './types';

// Permission system
export {
  PermissionChecker,
  createPermissionChecker,
  matchPattern,
  matchesAnyPattern,
  matchPathPattern,
  normalizePath,
} from './permissions';

// Audit logging
export {
  AuditLogger,
  createAuditLogger,
  getGlobalAuditLogger,
  setGlobalAuditLogger,
} from './audit';

// Security scanner
export {
  MCPSecurityScanner,
  scanServerSecurity,
  compareSecurity,
} from './scanner';

// Process isolation / sandbox
export {
  MCPSandbox,
  createSandbox,
  checkSandboxCapabilities,
  getDefaultSandboxConfig,
  mergeSandboxConfig,
} from './isolation';

// Configuration
export {
  loadSecurityConfig,
  parseSecurityConfig,
  getServerSecurityConfig,
  getAuditConfig,
  validateSecurityConfig,
  createDefaultSecurityConfig,
  getDefaultSecurityConfig,
} from './config';
