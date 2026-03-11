# MCP Security Module

> Issue #24.5 - MCP Security (High Priority)

This module provides comprehensive security features for MCP (Model Context Protocol) server execution in Swarm CLI.

## Features

### 1. Permission System (`permissions.ts`)

Fine-grained access control for MCP tools, resources, and filesystem operations.

```typescript
import { PermissionChecker } from './permissions';

const checker = new PermissionChecker({
  tools: {
    allow: ['github:*', 'fs:read'],
    deny: ['admin:*'],
  },
  resources: {
    allow: ['file:///home/user/**'],
    deny: ['file:///etc/**'],
  },
  filesystem: {
    read: ['/home/user/**'],
    write: ['/home/user/projects/**'],
    deny: ['**/.env', '**/.ssh/**'],
  },
});

// Check permissions
if (checker.canUseTool('github:list-repos')) {
  // Allow tool call
}

if (checker.canReadFile('/home/user/file.txt')) {
  // Allow file read
}
```

#### Pattern Matching

- **Exact match**: `'github:list-repos'`
- **Single wildcard**: `'github:*'` matches `github:list-repos`, `github:create-repo`
- **Prefix wildcard**: `'*:read'` matches `fs:read`, `db:read`
- **Double wildcard**: `'**'` matches anything

**Important**: Deny lists always take precedence over allow lists.

### 2. Audit Logging (`audit.ts`)

Comprehensive logging of all MCP operations for security analysis.

```typescript
import { AuditLogger } from './audit';

const logger = new AuditLogger({
  enabled: true,
  logPath: '~/.config/swarm-cli/mcp-audit.log',
  retentionDays: 30,
});

// Log events
await logger.logToolCall('github', 'list-repos', {}, true);
await logger.logPermissionDenied('github', 'tool', 'admin:delete');
await logger.logSandboxViolation('database', 'Memory limit exceeded');

// Query logs
const events = await logger.query({
  serverName: 'github',
  eventType: 'permission_denied',
  startDate: new Date('2024-01-01'),
});

// Generate reports
const report = await logger.report();
console.log(`Total events: ${report.totalEvents}`);
console.log(`Permission denials: ${report.permissionDeniedCount}`);
```

#### Event Types

- `tool_call` - Tool invocation
- `resource_read` - Resource access
- `resource_write` - Resource modification
- `permission_denied` - Access denied
- `error` - Operation error
- `server_start` - Server started
- `server_stop` - Server stopped
- `sandbox_violation` - Sandbox rule violation

### 3. Security Scanner (`scanner.ts`)

Analyze MCP server configurations for security risks.

```typescript
import { MCPSecurityScanner } from './scanner';

const scanner = new MCPSecurityScanner();

// Scan a server configuration
const result = await scanner.scanServer({
  name: 'filesystem',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user'],
});

console.log(`Risk level: ${result.riskLevel}`); // 'low' | 'medium' | 'high' | 'critical'
console.log(`Risk score: ${result.riskScore}`); // 0-100

for (const finding of result.findings) {
  console.log(`[${finding.severity}] ${finding.message}`);
  console.log(`  Recommendation: ${finding.recommendation}`);
}
```

#### Risk Factors

- **Filesystem**: Root access, sensitive paths, broad access
- **Network**: HTTP transport, external URLs
- **Command**: Risky commands (sudo, rm -rf), shell execution
- **Environment**: Sensitive variables, hardcoded secrets

### 4. Process Isolation (`isolation.ts`)

Sandboxed process execution with resource limits.

```typescript
import { MCPSandbox } from './isolation';

const sandbox = new MCPSandbox({
  maxMemoryMB: 512,
  maxCpuPercent: 50,
  timeoutSeconds: 300,
  allowedPaths: ['/home/user/projects'],
  deniedPaths: ['**/.env'],
  readOnly: false,
  allowNetwork: false,
  cleanEnv: true,
  allowedEnvVars: ['PATH', 'HOME'],
});

// Spawn sandboxed process
const process = await sandbox.spawn('npx', [
  '-y',
  '@modelcontextprotocol/server-filesystem',
  '/home/user/projects',
]);

// Monitor
console.log(`PID: ${sandbox.getPid()}`);
console.log(`Elapsed: ${sandbox.getElapsedTime()}s`);

// Terminate
await sandbox.kill();
```

#### Platform Support

| Feature | Linux | macOS | Windows |
|---------|-------|-------|---------|
| Memory limits | ✓ | Partial | Partial |
| CPU limits | ✓ | Partial | Partial |
| Timeout | ✓ | ✓ | ✓ |
| Path restrictions | ✓ | ✓ | ✓ |
| Network isolation | Namespaces | Seatbelt | Job Objects |
| Full sandboxing | Recommended | Recommended | Limited |

## Configuration

### YAML Configuration

```yaml
mcp:
  security:
    # Global defaults
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
            - "**/.env"
            - "**/credentials.json"
    
    # Per-server configuration
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
    
    # Audit logging
    audit:
      enabled: true
      logPath: "~/.config/swarm-cli/mcp-audit.log"
      retentionDays: 30
```

### Programmatic Configuration

```typescript
import {
  loadSecurityConfig,
  getServerSecurityConfig,
} from './config';

// Load from file
const config = loadSecurityConfig();

// Get server-specific config
const { sandbox, permissions, auditEnabled } = getServerSecurityConfig(
  config,
  'github'
);
```

## Integration with MCP Client

```typescript
import { MCPClientImpl } from '../integrations/mcp/mcp-client';
import { PermissionChecker, AuditLogger, MCPSandbox } from './security';

class SecureMCPClient extends MCPClientImpl {
  private permissionChecker: PermissionChecker | null = null;
  private auditLogger: AuditLogger | null = null;
  private sandbox: MCPSandbox | null = null;

  async connect(server, security) {
    // Apply sandbox
    if (security?.sandbox) {
      this.sandbox = new MCPSandbox(security.sandbox);
      // Use sandbox.spawn() instead of direct spawn
    }

    // Set up permissions
    if (security?.permissions) {
      this.permissionChecker = new PermissionChecker(security.permissions);
    }

    // Set up audit logging
    if (security?.auditEnabled) {
      this.auditLogger = new AuditLogger(auditConfig);
    }

    await super.connect(server);
  }

  async callTool(name, args) {
    // Check permissions
    if (this.permissionChecker && !this.permissionChecker.canUseTool(name)) {
      await this.auditLogger?.logPermissionDenied(
        this.serverName,
        'tool',
        name
      );
      throw new PermissionDeniedError('tool', name);
    }

    // Log the call
    await this.auditLogger?.logToolCall(
      this.serverName,
      name,
      args,
      true
    );

    return super.callTool(name, args);
  }
}
```

## Security Best Practices

### 1. Always Use Sandbox for Untrusted Servers

```typescript
const sandbox = new MCPSandbox({
  maxMemoryMB: 256,
  timeoutSeconds: 60,
  readOnly: true,
  allowNetwork: false,
});
```

### 2. Use Read-Only Mode When Possible

```yaml
sandbox:
  readOnly: true
```

### 3. Explicitly Deny Sensitive Paths

```yaml
permissions:
  filesystem:
    deny:
      - "~/.ssh"
      - "~/.gnupg"
      - "**/.env"
      - "**/credentials.json"
```

### 4. Review Audit Logs Regularly

```typescript
const report = await auditLogger.report();
if (report.permissionDeniedCount > 0) {
  console.warn('Security: Permission denials detected!');
}
```

### 5. Scan Servers Before First Use

```typescript
const result = await scanner.scanServer(config);
if (result.riskLevel === 'critical') {
  throw new Error('Server configuration too risky!');
}
```

### 6. Use Minimal Permissions Principle

Only grant the minimum permissions needed for the server to function.

```yaml
servers:
  github:
    permissions:
      tools:
        allow:
          - "github:search"  # Only search, not write operations
```

## API Reference

### PermissionChecker

```typescript
class PermissionChecker {
  constructor(permissions?: MCPSecurityPermissions);
  
  canUseTool(toolName: string): boolean;
  canAccessResource(uri: string): boolean;
  canReadFile(path: string): boolean;
  canWriteFile(path: string): boolean;
  
  checkTool(toolName: string): void;  // Throws if denied
  checkResource(uri: string): void;
  checkFileRead(path: string): void;
  checkFileWrite(path: string): void;
  
  updatePermissions(permissions: MCPSecurityPermissions): void;
  getPermissions(): Readonly<MCPSecurityPermissions>;
  hasPermissions(): boolean;
}
```

### AuditLogger

```typescript
class AuditLogger {
  constructor(config: AuditConfig | string);
  
  log(event: AuditEvent): Promise<void>;
  logToolCall(serverName, toolName, args, success, error?): Promise<void>;
  logResourceAccess(serverName, uri, eventType, success, error?): Promise<void>;
  logPermissionDenied(serverName, resourceType, resourceName, reason?): Promise<void>;
  logError(serverName, error, context?): Promise<void>;
  logServerStart(serverName, success, error?): Promise<void>;
  logServerStop(serverName, reason?): Promise<void>;
  logSandboxViolation(serverName, violation, details?): Promise<void>;
  
  query(filters: AuditQuery): Promise<AuditEvent[]>;
  report(startDate?, endDate?): Promise<AuditReport>;
  
  flush(): Promise<void>;
  close(): Promise<void>;
  setEnabled(enabled: boolean): void;
  clearOldLogs(): Promise<number>;
}
```

### MCPSecurityScanner

```typescript
class MCPSecurityScanner {
  scanServer(config: MCPServerConfig): Promise<SecurityScanResult>;
  scanWithSecurity(config, sandbox?, permissions?): Promise<SecurityScanResult>;
}
```

### MCPSandbox

```typescript
class MCPSandbox {
  constructor(config?: SandboxConfig);
  
  spawn(command: string, args?: string[]): Promise<ChildProcess>;
  kill(): Promise<void>;
  
  isRunning(): boolean;
  getPid(): number | undefined;
  getElapsedTime(): number;
  getConfig(): Readonly<Required<SandboxConfig>>;
  updateConfig(config: Partial<SandboxConfig>): void;
}
```

## Testing

Run tests with:

```bash
npm test src/mcp/security
```

Individual test files:
- `__tests__/permissions.test.ts` - Permission system tests
- `__tests__/audit.test.ts` - Audit logging tests
- `__tests__/scanner.test.ts` - Security scanner tests
- `__tests__/isolation.test.ts` - Process isolation tests

## Future Improvements

1. **Linux Namespaces**: Full isolation using `unshare` or `clone` with `CLONE_NEWNS`, `CLONE_NEWNET`
2. **macOS Seatbelt**: Integration with `sandbox-exec` for stronger isolation
3. **Windows Job Objects**: Native resource limiting on Windows
4. **Docker Integration**: Option to run servers in Docker containers
5. **seccomp-bpf**: Syscall filtering on Linux
6. **AppArmor/SELinux**: Integration with Mandatory Access Control systems
