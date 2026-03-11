/**
 * Tests for MCP Process Isolation / Sandbox
 */

import { MCPSandbox, createSandbox, checkSandboxCapabilities, getDefaultSandboxConfig, mergeSandboxConfig } from '../isolation';
import { SandboxConfig, SandboxViolationError } from '../types';

describe('MCPSandbox', () => {
  let sandbox: MCPSandbox;

  afterEach(async () => {
    if (sandbox) {
      await sandbox.kill();
    }
  });

  describe('constructor', () => {
    it('should create sandbox with default config', () => {
      sandbox = new MCPSandbox();
      const config = sandbox.getConfig();

      expect(config.maxMemoryMB).toBe(512);
      expect(config.maxCpuPercent).toBe(50);
      expect(config.timeoutSeconds).toBe(300);
    });

    it('should merge provided config with defaults', () => {
      sandbox = new MCPSandbox({
        maxMemoryMB: 256,
        timeoutSeconds: 60,
      });
      const config = sandbox.getConfig();

      expect(config.maxMemoryMB).toBe(256);
      expect(config.timeoutSeconds).toBe(60);
      expect(config.maxCpuPercent).toBe(50); // Default
    });

    it('should expand paths in config', () => {
      sandbox = new MCPSandbox({
        allowedPaths: ['~/projects'],
      });
      const config = sandbox.getConfig();

      expect(config.allowedPaths[0]).toContain(process.env.HOME || '');
    });
  });

  describe('spawn', () => {
    it('should spawn a simple process', async () => {
      sandbox = new MCPSandbox({
        timeoutSeconds: 10,
      });

      const proc = await sandbox.spawn('echo', ['hello']);

      expect(proc).toBeDefined();
      expect(proc.pid).toBeDefined();
      expect(sandbox.isRunning()).toBe(true);
    });

    it('should enforce timeout', async () => {
      sandbox = new MCPSandbox({
        timeoutSeconds: 1,
      });

      // Sleep command that would run longer than timeout
      const proc = await sandbox.spawn('sleep', ['10']);
      
      // Wait for process to exit due to timeout
      await new Promise<void>((resolve) => {
        proc.on('exit', () => resolve());
      });

      expect(sandbox.isRunning()).toBe(false);
    });

    it('should reject commands in denied paths', async () => {
      sandbox = new MCPSandbox({
        deniedPaths: ['/etc'],
      });

      await expect(sandbox.spawn('/etc/some-command', [])).rejects.toThrow(SandboxViolationError);
    });

    it('should reject args referencing denied paths', async () => {
      sandbox = new MCPSandbox({
        deniedPaths: ['~/.ssh'],
      });

      await expect(sandbox.spawn('cat', ['~/.ssh/id_rsa'])).rejects.toThrow(SandboxViolationError);
    });

    it('should enforce allowed paths when specified', async () => {
      sandbox = new MCPSandbox({
        allowedPaths: ['/tmp'],
      });

      // Should allow /tmp
      const proc = await sandbox.spawn('ls', ['/tmp']);
      expect(proc.pid).toBeDefined();

      // Should reject other paths
      await expect(sandbox.spawn('ls', ['/etc/passwd'])).rejects.toThrow(SandboxViolationError);
    });
  });

  describe('kill', () => {
    it('should kill running process', async () => {
      sandbox = new MCPSandbox();

      await sandbox.spawn('sleep', ['60']);
      expect(sandbox.isRunning()).toBe(true);

      await sandbox.kill();
      expect(sandbox.isRunning()).toBe(false);
    });

    it('should handle already killed process', async () => {
      sandbox = new MCPSandbox();

      await sandbox.spawn('echo', ['hello']);
      
      // Kill twice should not throw
      await sandbox.kill();
      await sandbox.kill();
    });
  });

  describe('environment handling', () => {
    it('should filter environment variables with cleanEnv', async () => {
      process.env.TEST_VAR = 'test-value';
      
      sandbox = new MCPSandbox({
        cleanEnv: true,
        allowedEnvVars: ['TEST_VAR'],
      });

      const proc = await sandbox.spawn('node', ['-e', 'console.log(process.env.TEST_VAR)']);
      
      let output = '';
      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      await new Promise<void>((resolve) => {
        proc.on('exit', () => resolve());
      });

      expect(output.trim()).toBe('test-value');
      
      delete process.env.TEST_VAR;
    });
  });

  describe('getElapsedTime', () => {
    it('should track elapsed time', async () => {
      sandbox = new MCPSandbox();

      await sandbox.spawn('sleep', ['1']);
      
      const elapsed = sandbox.getElapsedTime();
      expect(elapsed).toBeGreaterThanOrEqual(0);
      expect(elapsed).toBeLessThan(2);
    });
  });
});

describe('createSandbox', () => {
  it('should return null when no config provided', () => {
    expect(createSandbox()).toBeNull();
  });

  it('should return sandbox when config provided', () => {
    const sandbox = createSandbox({ maxMemoryMB: 256 });
    expect(sandbox).toBeInstanceOf(MCPSandbox);
  });
});

describe('checkSandboxCapabilities', () => {
  it('should return capabilities info', () => {
    const caps = checkSandboxCapabilities();

    expect(caps.available).toBe(true);
    expect(Array.isArray(caps.limitations)).toBe(true);
    expect(Array.isArray(caps.recommendations)).toBe(true);
  });
});

describe('getDefaultSandboxConfig', () => {
  it('should return default config', () => {
    const config = getDefaultSandboxConfig();

    expect(config.maxMemoryMB).toBe(512);
    expect(config.maxCpuPercent).toBe(50);
    expect(config.timeoutSeconds).toBe(300);
  });
});

describe('mergeSandboxConfig', () => {
  it('should merge configurations', () => {
    const base: SandboxConfig = {
      maxMemoryMB: 512,
      allowedPaths: ['/home/user'],
    };

    const override: SandboxConfig = {
      maxMemoryMB: 256,
      allowedPaths: ['/tmp'],
    };

    const merged = mergeSandboxConfig(base, override);

    expect(merged.maxMemoryMB).toBe(256);
    expect(merged.allowedPaths).toContain('/home/user');
    expect(merged.allowedPaths).toContain('/tmp');
  });
});
