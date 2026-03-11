/**
 * MCP Audit Logger - Issue #24.5
 * Audit logging for MCP operations
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWriteStream, WriteStream } from 'fs';
import {
  AuditEvent,
  AuditEventType,
  AuditQuery,
  AuditReport,
  AuditConfig,
} from './types';

/**
 * Default audit log path
 */
const DEFAULT_LOG_PATH = path.join(
  os.homedir(),
  '.config',
  'swarm-cli',
  'mcp-audit.log'
);

/**
 * Default retention in days
 */
const DEFAULT_RETENTION_DAYS = 30;

/**
 * Audit Logger for MCP operations
 * Logs all events in JSON Lines format for easy parsing
 */
export class AuditLogger {
  private logPath: string;
  private retentionDays: number;
  private maxSizeMB: number;
  private writeStream: WriteStream | null = null;
  private enabled: boolean;
  private eventBuffer: AuditEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(config: AuditConfig | string) {
    if (typeof config === 'string') {
      this.logPath = config;
      this.retentionDays = DEFAULT_RETENTION_DAYS;
      this.maxSizeMB = 10;
      this.enabled = true;
    } else {
      this.logPath = config.logPath || DEFAULT_LOG_PATH;
      this.retentionDays = config.retentionDays ?? DEFAULT_RETENTION_DAYS;
      this.maxSizeMB = config.maxSizeMB ?? 10;
      this.enabled = config.enabled;
    }

    // Ensure log directory exists
    this.ensureLogDirectory();

    // Start periodic flush
    this.startFlushInterval();
  }

  /**
   * Log an audit event
   */
  async log(event: AuditEvent): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Add to buffer
    this.eventBuffer.push(event);

    // Flush if buffer is large
    if (this.eventBuffer.length >= 100) {
      await this.flush();
    }
  }

  /**
   * Log a tool call event
   */
  async logToolCall(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    success: boolean,
    error?: string
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      serverName,
      eventType: 'tool_call',
      details: {
        toolName,
        args: this.sanitizeArgs(args),
        error,
      },
      success,
    });
  }

  /**
   * Log a resource access event
   */
  async logResourceAccess(
    serverName: string,
    uri: string,
    eventType: 'resource_read' | 'resource_write',
    success: boolean,
    error?: string
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      serverName,
      eventType,
      details: {
        resourceUri: uri,
        error,
      },
      success,
    });
  }

  /**
   * Log a permission denial
   */
  async logPermissionDenied(
    serverName: string,
    resourceType: 'tool' | 'resource' | 'file',
    resourceName: string,
    reason?: string
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      serverName,
      eventType: 'permission_denied',
      details: {
        message: `${resourceType} '${resourceName}' access denied`,
        args: { resourceType, resourceName, reason },
      },
      success: false,
    });
  }

  /**
   * Log an error
   */
  async logError(
    serverName: string,
    error: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      serverName,
      eventType: 'error',
      details: {
        error,
        message: context ? JSON.stringify(context) : undefined,
      },
      success: false,
    });
  }

  /**
   * Log server start
   */
  async logServerStart(serverName: string, success: boolean, error?: string): Promise<void> {
    await this.log({
      timestamp: new Date(),
      serverName,
      eventType: 'server_start',
      details: {
        message: 'Server started',
        error,
      },
      success,
    });
  }

  /**
   * Log server stop
   */
  async logServerStop(serverName: string, reason?: string): Promise<void> {
    await this.log({
      timestamp: new Date(),
      serverName,
      eventType: 'server_stop',
      details: {
        message: reason || 'Server stopped',
      },
      success: true,
    });
  }

  /**
   * Log a sandbox violation
   */
  async logSandboxViolation(
    serverName: string,
    violation: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      timestamp: new Date(),
      serverName,
      eventType: 'sandbox_violation',
      details: {
        violation,
        message: violation,
        ...details,
      },
      success: false,
    });
  }

  /**
   * Query audit log
   */
  async query(query: AuditQuery): Promise<AuditEvent[]> {
    await this.flush();

    if (!fs.existsSync(this.logPath)) {
      return [];
    }

    const content = fs.readFileSync(this.logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    let events = lines.map(line => {
      try {
        return JSON.parse(line) as AuditEvent;
      } catch {
        return null;
      }
    }).filter((e): e is AuditEvent => e !== null);

    // Apply filters
    if (query.serverName) {
      events = events.filter(e => e.serverName === query.serverName);
    }

    if (query.eventType) {
      events = events.filter(e => e.eventType === query.eventType);
    }

    if (query.success !== undefined) {
      events = events.filter(e => e.success === query.success);
    }

    if (query.startDate) {
      events = events.filter(e => new Date(e.timestamp) >= query.startDate!);
    }

    if (query.endDate) {
      events = events.filter(e => new Date(e.timestamp) <= query.endDate!);
    }

    // Apply limit
    if (query.limit) {
      events = events.slice(-query.limit);
    }

    return events;
  }

  /**
   * Generate a security report
   */
  async report(startDate?: Date, endDate?: Date): Promise<AuditReport> {
    const events = await this.query({
      startDate: startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default: last 7 days
      endDate,
    });

    const eventsByType: Record<AuditEventType, number> = {
      tool_call: 0,
      resource_read: 0,
      resource_write: 0,
      permission_denied: 0,
      error: 0,
      server_start: 0,
      server_stop: 0,
      sandbox_violation: 0,
    };

    const eventsByServer: Record<string, number> = {};
    const deniedTools: Record<string, number> = {};
    const deniedResources: Record<string, number> = {};

    for (const event of events) {
      // Count by type
      eventsByType[event.eventType]++;

      // Count by server
      eventsByServer[event.serverName] = (eventsByServer[event.serverName] || 0) + 1;

      // Track denied tools
      if (event.eventType === 'permission_denied' && event.details.args) {
        const args = event.details.args as { resourceType?: string; resourceName?: string };
        if (args.resourceType === 'tool' && args.resourceName) {
          deniedTools[args.resourceName] = (deniedTools[args.resourceName] || 0) + 1;
        }
        if (args.resourceType === 'resource' && args.resourceName) {
          deniedResources[args.resourceName] = (deniedResources[args.resourceName] || 0) + 1;
        }
      }
    }

    return {
      generatedAt: new Date(),
      totalEvents: events.length,
      eventsByType,
      eventsByServer,
      permissionDeniedCount: eventsByType.permission_denied,
      errorCount: eventsByType.error,
      sandboxViolationCount: eventsByType.sandbox_violation,
      topDeniedTools: Object.entries(deniedTools)
        .map(([toolName, count]) => ({ toolName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topDeniedResources: Object.entries(deniedResources)
        .map(([uri, count]) => ({ uri, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  }

  /**
   * Flush buffered events to disk
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const events = this.eventBuffer;
    this.eventBuffer = [];

    try {
      // Check for log rotation
      await this.rotateIfNeeded();

      // Append events
      const lines = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      
      await new Promise<void>((resolve, reject) => {
        fs.appendFile(this.logPath, lines, 'utf-8', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
      // Re-add events to buffer on failure
      this.eventBuffer = [...events, ...this.eventBuffer];
      throw error;
    }
  }

  /**
   * Close the logger and flush remaining events
   */
  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    await this.flush();

    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }
  }

  /**
   * Enable or disable logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if logging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get the log file path
   */
  getLogPath(): string {
    return this.logPath;
  }

  /**
   * Clear old logs based on retention policy
   */
  async clearOldLogs(): Promise<number> {
    if (!fs.existsSync(this.logPath)) {
      return 0;
    }

    const content = fs.readFileSync(this.logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const cutoffDate = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);

    const recentLines = lines.filter(line => {
      try {
        const event = JSON.parse(line) as AuditEvent;
        return new Date(event.timestamp) >= cutoffDate;
      } catch {
        return true; // Keep unparseable lines
      }
    });

    const removedCount = lines.length - recentLines.length;

    if (removedCount > 0) {
      fs.writeFileSync(this.logPath, recentLines.join('\n') + '\n', 'utf-8');
    }

    return removedCount;
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Rotate log file if it exceeds max size
   */
  private async rotateIfNeeded(): Promise<void> {
    if (!fs.existsSync(this.logPath)) {
      return;
    }

    const stats = fs.statSync(this.logPath);
    const sizeMB = stats.size / (1024 * 1024);

    if (sizeMB >= this.maxSizeMB) {
      const rotatedPath = `${this.logPath}.${Date.now()}.old`;
      fs.renameSync(this.logPath, rotatedPath);

      // Keep only last 5 rotated files
      const dir = path.dirname(this.logPath);
      const baseName = path.basename(this.logPath);
      const rotatedFiles = fs.readdirSync(dir)
        .filter(f => f.startsWith(baseName) && f.endsWith('.old'))
        .sort()
        .reverse();

      for (const file of rotatedFiles.slice(5)) {
        fs.unlinkSync(path.join(dir, file));
      }
    }
  }

  /**
   * Start periodic flush interval
   */
  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch(() => {
        // Ignore flush errors in interval
      });
    }, 5000); // Flush every 5 seconds
  }

  /**
   * Sanitize arguments to remove sensitive data
   */
  private sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential', 'auth'];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(s => lowerKey.includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeArgs(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

/**
 * Create an audit logger from configuration
 */
export function createAuditLogger(config?: AuditConfig): AuditLogger | null {
  if (!config || !config.enabled) {
    return null;
  }

  return new AuditLogger(config);
}

/**
 * Global audit logger instance
 */
let globalAuditLogger: AuditLogger | null = null;

/**
 * Get or create the global audit logger
 */
export function getGlobalAuditLogger(config?: AuditConfig): AuditLogger {
  if (!globalAuditLogger && config) {
    globalAuditLogger = new AuditLogger(config);
  }
  return globalAuditLogger!;
}

/**
 * Set the global audit logger
 */
export function setGlobalAuditLogger(logger: AuditLogger | null): void {
  globalAuditLogger = logger;
}
