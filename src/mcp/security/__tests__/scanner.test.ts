/**
 * Tests for MCP Security Scanner
 */

import { MCPSecurityScanner, scanServerSecurity, compareSecurity } from '../scanner';
import { MCPServerConfig } from '../../../integrations/mcp/types';
import { SandboxConfig, MCPSecurityPermissions } from '../types';

describe('MCPSecurityScanner', () => {
  let scanner: MCPSecurityScanner;

  beforeEach(() => {
    scanner = new MCPSecurityScanner();
  });

  describe('filesystem access scanning', () => {
    it('should detect root filesystem access', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
      };

      const result = await scanner.scanServer(config);

      expect(result.findings.some(f => 
        f.type === 'filesystem' && 
        f.severity === 'danger' && 
        f.message.includes('root')
      )).toBe(true);
    });

    it('should detect home directory access', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '~'],
      };

      const result = await scanner.scanServer(config);

      expect(result.findings.some(f => 
        f.type === 'filesystem' && 
        f.severity === 'danger'
      )).toBe(true);
    });

    it('should warn about many accessible directories', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/dir1', '/dir2', '/dir3', '/dir4'],
      };

      const result = await scanner.scanServer(config);

      expect(result.findings.some(f => 
        f.type === 'filesystem' && 
        f.severity === 'warning' &&
        f.message.includes('4 directories')
      )).toBe(true);
    });

    it('should detect sensitive path access', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '~/.ssh'],
      };

      const result = await scanner.scanServer(config);

      expect(result.findings.some(f => 
        f.type === 'filesystem' && 
        f.severity === 'danger' &&
        f.message.includes('sensitive')
      )).toBe(true);
    });
  });

  describe('network access scanning', () => {
    it('should warn about HTTP transport', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: [],
        transport: 'http',
        url: 'http://localhost:3000',
      };

      const result = await scanner.scanServer(config);

      expect(result.findings.some(f => 
        f.type === 'network' && 
        f.severity === 'warning'
      )).toBe(true);
    });

    it('should detect URLs in arguments', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'npx',
        args: ['-y', 'some-mcp-server', 'https://api.example.com'],
      };

      const result = await scanner.scanServer(config);

      expect(result.findings.some(f => 
        f.type === 'network' && 
        f.severity === 'info' &&
        f.context?.host === 'api.example.com'
      )).toBe(true);
    });
  });

  describe('command scanning', () => {
    it('should detect risky commands', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'sudo',
        args: ['node', 'server.js'],
      };

      const result = await scanner.scanServer(config);

      expect(result.findings.some(f => 
        f.type === 'command' && 
        f.severity === 'danger' &&
        f.message.includes('sudo')
      )).toBe(true);
    });

    it('should warn about shell execution', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'bash',
        args: ['-c', 'node server.js'],
      };

      const result = await scanner.scanServer(config);

      expect(result.findings.some(f => 
        f.type === 'command' && 
        f.severity === 'warning' &&
        f.message.includes('shell')
      )).toBe(true);
    });

    it('should info about npx usage', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
      };

      const result = await scanner.scanServer(config);

      expect(result.findings.some(f => 
        f.type === 'command' && 
        f.severity === 'info' &&
        f.message.includes('npx')
      )).toBe(true);
    });
  });

  describe('environment scanning', () => {
    it('should detect sensitive environment variables', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: [],
        env: {
          GITHUB_TOKEN: 'ghp_xxx',
          DATABASE_PASSWORD: 'secret',
        },
      };

      const result = await scanner.scanServer(config);

      expect(result.findings.some(f => 
        f.type === 'env' && 
        f.severity === 'warning' &&
        f.message.includes('GITHUB_TOKEN')
      )).toBe(true);
    });

    it('should detect hardcoded secrets', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: [],
        env: {
          API_KEY: 'a-very-long-hardcoded-secret-key-value',
        },
      };

      const result = await scanner.scanServer(config);

      expect(result.findings.some(f => 
        f.type === 'env' && 
        f.severity === 'warning' &&
        f.message.includes('hardcoded')
      )).toBe(true);
    });

    it('should accept environment variable substitution', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: [],
        env: {
          GITHUB_TOKEN: '${GITHUB_TOKEN}',
        },
      };

      const result = await scanner.scanServer(config);

      // Should still warn about sensitive var access, but not about hardcoding
      expect(result.findings.some(f => 
        f.type === 'env' && 
        f.message.includes('hardcoded')
      )).toBe(false);
    });
  });

  describe('risk scoring', () => {
    it('should calculate low risk for safe configuration', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user/projects'],
      };

      const result = await scanner.scanServer(config);

      expect(result.riskLevel).toBe('low');
      expect(result.riskScore).toBeLessThan(25);
    });

    it('should calculate high risk for dangerous configuration', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'sudo',
        args: ['rm', '-rf', '/'],
      };

      const result = await scanner.scanServer(config);

      expect(result.riskLevel).toBe('critical');
      expect(result.riskScore).toBeGreaterThanOrEqual(70);
    });
  });

  describe('sandbox evaluation', () => {
    it('should acknowledge sandbox mitigations', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user'],
      };

      const sandbox: SandboxConfig = {
        maxMemoryMB: 256,
        timeoutSeconds: 60,
        readOnly: true,
        allowNetwork: false,
      };

      const result = await scanner.scanWithSecurity(config, sandbox);

      // Should have info findings about mitigations
      expect(result.findings.some(f => 
        f.type === 'permission' && 
        f.severity === 'info' &&
        f.message.includes('Memory limited')
      )).toBe(true);
    });
  });

  describe('permission evaluation', () => {
    it('should acknowledge permission mitigations', async () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user'],
      };

      const permissions: MCPSecurityPermissions = {
        filesystem: {
          deny: ['~/.ssh', '~/.gnupg'],
        },
        tools: {
          allow: ['fs:read'],
        },
      };

      const result = await scanner.scanWithSecurity(config, undefined, permissions);

      expect(result.findings.some(f => 
        f.type === 'permission' && 
        f.severity === 'info' &&
        f.message.includes('explicitly denied')
      )).toBe(true);
    });
  });
});

describe('scanServerSecurity', () => {
  it('should be a convenience function', async () => {
    const config: MCPServerConfig = {
      name: 'test-server',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
    };

    const result = await scanServerSecurity(config);

    expect(result.serverName).toBe('test-server');
    expect(result.scannedAt).toBeInstanceOf(Date);
    expect(Array.isArray(result.findings)).toBe(true);
  });
});

describe('compareSecurity', () => {
  it('should detect improvement', async () => {
    const scanner = new MCPSecurityScanner();
    
    const config: MCPServerConfig = {
      name: 'test-server',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
    };

    const before = await scanner.scanServer(config);
    const after = await scanner.scanWithSecurity(config, { maxMemoryMB: 256 });

    const comparison = compareSecurity(before, after);

    expect(comparison.improved).toBe(true);
    expect(comparison.scoreChange).toBeLessThan(0);
  });
});
