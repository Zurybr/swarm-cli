/**
 * Tests for MCP Audit Logger
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AuditLogger, createAuditLogger } from '../audit';
import { AuditConfig } from '../types';

describe('AuditLogger', () => {
  let logger: AuditLogger;
  let testLogPath: string;

  beforeEach(() => {
    // Create a temporary log path for testing
    testLogPath = path.join(os.tmpdir(), `mcp-audit-test-${Date.now()}.log`);
    
    logger = new AuditLogger({
      enabled: true,
      logPath: testLogPath,
      retentionDays: 30,
    });
  });

  afterEach(async () => {
    await logger.close();
    
    // Clean up test log file
    if (fs.existsSync(testLogPath)) {
      fs.unlinkSync(testLogPath);
    }
  });

  describe('logging events', () => {
    it('should log tool call events', async () => {
      await logger.logToolCall('test-server', 'test-tool', { arg1: 'value1' }, true);
      await logger.flush();

      const events = await logger.query({});
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('tool_call');
      expect(events[0].serverName).toBe('test-server');
      expect(events[0].details.toolName).toBe('test-tool');
      expect(events[0].success).toBe(true);
    });

    it('should log resource access events', async () => {
      await logger.logResourceAccess('test-server', 'file:///test/path', 'resource_read', true);
      await logger.flush();

      const events = await logger.query({ eventType: 'resource_read' });
      expect(events.length).toBe(1);
      expect(events[0].details.resourceUri).toBe('file:///test/path');
    });

    it('should log permission denied events', async () => {
      await logger.logPermissionDenied('test-server', 'tool', 'dangerous-tool', 'Not allowed');
      await logger.flush();

      const events = await logger.query({ eventType: 'permission_denied' });
      expect(events.length).toBe(1);
      expect(events[0].success).toBe(false);
    });

    it('should log error events', async () => {
      await logger.logError('test-server', 'Something went wrong', { context: 'test' });
      await logger.flush();

      const events = await logger.query({ eventType: 'error' });
      expect(events.length).toBe(1);
      expect(events[0].details.error).toBe('Something went wrong');
    });

    it('should log server start/stop events', async () => {
      await logger.logServerStart('test-server', true);
      await logger.logServerStop('test-server', 'Normal shutdown');
      await logger.flush();

      const events = await logger.query({});
      expect(events.length).toBe(2);
      expect(events[0].eventType).toBe('server_start');
      expect(events[1].eventType).toBe('server_stop');
    });

    it('should log sandbox violations', async () => {
      await logger.logSandboxViolation('test-server', 'Memory limit exceeded', { limit: 512, used: 600 });
      await logger.flush();

      const events = await logger.query({ eventType: 'sandbox_violation' });
      expect(events.length).toBe(1);
      expect(events[0].details.violation).toBe('Memory limit exceeded');
    });
  });

  describe('querying events', () => {
    beforeEach(async () => {
      // Add some test events
      await logger.logToolCall('server1', 'tool1', {}, true);
      await logger.logToolCall('server2', 'tool2', {}, false);
      await logger.logPermissionDenied('server1', 'tool', 'blocked-tool');
      await logger.logError('server2', 'Test error');
      await logger.flush();
    });

    it('should filter by server name', async () => {
      const events = await logger.query({ serverName: 'server1' });
      expect(events.length).toBe(2);
      expect(events.every(e => e.serverName === 'server1')).toBe(true);
    });

    it('should filter by event type', async () => {
      const events = await logger.query({ eventType: 'permission_denied' });
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('permission_denied');
    });

    it('should filter by success status', async () => {
      const failedEvents = await logger.query({ success: false });
      expect(failedEvents.length).toBe(3);
    });

    it('should apply limit', async () => {
      const events = await logger.query({ limit: 2 });
      expect(events.length).toBe(2);
    });
  });

  describe('report generation', () => {
    beforeEach(async () => {
      // Add various events for report
      await logger.logToolCall('server1', 'tool1', {}, true);
      await logger.logToolCall('server1', 'tool2', {}, true);
      await logger.logToolCall('server2', 'tool1', {}, false);
      await logger.logPermissionDenied('server1', 'tool', 'denied-tool-1');
      await logger.logPermissionDenied('server1', 'tool', 'denied-tool-2');
      await logger.logPermissionDenied('server1', 'tool', 'denied-tool-1'); // Duplicate
      await logger.logError('server1', 'Error 1');
      await logger.logSandboxViolation('server2', 'Violation 1');
      await logger.flush();
    });

    it('should generate a report with correct counts', async () => {
      const report = await logger.report();

      expect(report.totalEvents).toBe(8);
      expect(report.permissionDeniedCount).toBe(3);
      expect(report.errorCount).toBe(1);
      expect(report.sandboxViolationCount).toBe(1);
    });

    it('should count events by type', async () => {
      const report = await logger.report();

      expect(report.eventsByType.tool_call).toBe(3);
      expect(report.eventsByType.permission_denied).toBe(3);
      expect(report.eventsByType.error).toBe(1);
      expect(report.eventsByType.sandbox_violation).toBe(1);
    });

    it('should count events by server', async () => {
      const report = await logger.report();

      expect(report.eventsByServer['server1']).toBe(6);
      expect(report.eventsByServer['server2']).toBe(2);
    });

    it('should identify top denied tools', async () => {
      const report = await logger.report();

      expect(report.topDeniedTools.length).toBeGreaterThan(0);
      // denied-tool-1 appears twice, should be first
      expect(report.topDeniedTools[0].toolName).toBe('denied-tool-1');
      expect(report.topDeniedTools[0].count).toBe(2);
    });
  });

  describe('argument sanitization', () => {
    it('should redact sensitive arguments', async () => {
      await logger.logToolCall('test-server', 'auth-tool', {
        username: 'user',
        password: 'secret123',
        apiKey: 'key123',
        normalArg: 'value',
      }, true);
      await logger.flush();

      const events = await logger.query({});
      const args = events[0].details.args as Record<string, unknown>;

      expect(args.username).toBe('user');
      expect(args.password).toBe('[REDACTED]');
      expect(args.apiKey).toBe('[REDACTED]');
      expect(args.normalArg).toBe('value');
    });
  });

  describe('enable/disable', () => {
    it('should not log when disabled', async () => {
      logger.setEnabled(false);
      
      await logger.logToolCall('server', 'tool', {}, true);
      await logger.flush();

      const events = await logger.query({});
      expect(events.length).toBe(0);
    });

    it('should log when re-enabled', async () => {
      logger.setEnabled(false);
      await logger.logToolCall('server', 'tool1', {}, true);
      
      logger.setEnabled(true);
      await logger.logToolCall('server', 'tool2', {}, true);
      await logger.flush();

      const events = await logger.query({});
      expect(events.length).toBe(1);
      expect(events[0].details.toolName).toBe('tool2');
    });
  });
});

describe('createAuditLogger', () => {
  it('should return null when disabled', () => {
    const logger = createAuditLogger({
      enabled: false,
      logPath: '/tmp/test.log',
      retentionDays: 30,
    });
    expect(logger).toBeNull();
  });

  it('should return logger when enabled', () => {
    const logger = createAuditLogger({
      enabled: true,
      logPath: '/tmp/test.log',
      retentionDays: 30,
    });
    expect(logger).toBeInstanceOf(AuditLogger);
  });
});
