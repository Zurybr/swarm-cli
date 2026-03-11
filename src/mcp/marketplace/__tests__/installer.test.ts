/**
 * Tests for MCP Installer
 */

import { MCPInstaller, InstallOptions } from '../installer';
import { MCPRegistryManager, MCPRegistryEntry } from '../registry';
import * as fs from 'fs';
import * as childProcess from 'child_process';

// Mock modules
jest.mock('fs');
jest.mock('child_process');
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedChildProcess = childProcess as jest.Mocked<typeof childProcess>;

describe('MCPInstaller', () => {
  let installer: MCPInstaller;
  let registryManager: MCPRegistryManager;
  const testConfigPath = '/tmp/test-config.yaml';

  beforeEach(() => {
    registryManager = new MCPRegistryManager('/tmp/test-registry.json');
    installer = new MCPInstaller(registryManager, testConfigPath);
    jest.clearAllMocks();
  });

  describe('install', () => {
    const mockServer: MCPRegistryEntry = {
      name: 'test-server',
      displayName: 'Test Server',
      description: 'A test server',
      version: '1.0.0',
      author: 'Test',
      package: '@test/server',
      tags: ['test'],
      runtime: 'node',
    };

    beforeEach(async () => {
      // Setup registry with test server
      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [mockServer],
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      mockedFs.writeFileSync.mockImplementation(() => undefined);
      mockedFs.mkdirSync.mockImplementation(() => undefined);

      await registryManager.load();
    });

    it('should install a server from registry', async () => {
      mockedChildProcess.execSync.mockImplementation(() => Buffer.from(''));
      mockedFs.existsSync.mockReturnValue(false); // Config doesn't exist yet

      const result = await installer.install('test-server');

      expect(result.name).toBe('test-server');
      expect(result.isNew).toBe(true);
      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });

    it('should skip installation if already installed', async () => {
      // Mock already installed
      mockedChildProcess.execSync.mockImplementation((cmd: string) => {
        if (cmd.includes('npm list')) {
          return Buffer.from(JSON.stringify({
            dependencies: {
              '@test/server': { version: '1.0.0' }
            }
          }));
        }
        return Buffer.from('');
      });

      const result = await installer.install('test-server');

      expect(result.isNew).toBe(false);
      expect(result.warnings).toContain('Server is already installed. Use --version to install a specific version.');
    });

    it('should install specific version when requested', async () => {
      mockedChildProcess.execSync.mockImplementation(() => Buffer.from(''));
      mockedFs.existsSync.mockReturnValue(false);

      const options: InstallOptions = { version: '2.0.0' };
      const result = await installer.install('test-server', options);

      expect(result.version).toBe('2.0.0');
      expect(mockedChildProcess.execSync).toHaveBeenCalledWith(
        expect.stringContaining('@2.0.0'),
        expect.any(Object)
      );
    });

    it('should install from npm directly if not in registry', async () => {
      mockedChildProcess.execSync.mockImplementation(() => Buffer.from(''));
      mockedFs.existsSync.mockReturnValue(false);

      const result = await installer.install('@custom/mcp-server');

      expect(result.name).toBe('-custom-mcp-server');
      expect(result.isNew).toBe(true);
    });

    it('should throw error if server not found', async () => {
      await expect(installer.install('non-existent'))
        .rejects.toThrow('not found in registry');
    });

    it('should handle required environment variables', async () => {
      const serverWithEnv: MCPRegistryEntry = {
        ...mockServer,
        name: 'github',
        requiredEnv: ['GITHUB_TOKEN'],
      };

      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [serverWithEnv],
      };

      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      await registryManager.load();

      mockedChildProcess.execSync.mockImplementation(() => Buffer.from(''));
      mockedFs.existsSync.mockReturnValue(false);

      await installer.install('github');

      // Should add env var to config
      const writeCall = mockedFs.writeFileSync.mock.calls[0];
      const configContent = writeCall[1] as string;
      expect(configContent).toContain('GITHUB_TOKEN');
    });
  });

  describe('uninstall', () => {
    const mockServer: MCPRegistryEntry = {
      name: 'test-server',
      displayName: 'Test Server',
      description: 'A test server',
      version: '1.0.0',
      author: 'Test',
      package: '@test/server',
      tags: ['test'],
      runtime: 'node',
      installed: true,
      installedVersion: '1.0.0',
    };

    beforeEach(async () => {
      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [mockServer],
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation((path: any) => {
        if (typeof path === 'string' && path.includes('registry')) {
          return JSON.stringify(mockRegistry);
        }
        return 'mcp:\n  servers:\n    test-server:\n      name: test-server';
      });
      mockedFs.writeFileSync.mockImplementation(() => undefined);

      await registryManager.load();
    });

    it('should uninstall a server', async () => {
      mockedChildProcess.execSync.mockImplementation(() => Buffer.from(''));

      await installer.uninstall('test-server');

      expect(mockedChildProcess.execSync).toHaveBeenCalledWith(
        expect.stringContaining('npm uninstall'),
        expect.any(Object)
      );
    });

    it('should throw error if server not installed', async () => {
      const notInstalled = { ...mockServer, installed: false };
      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [notInstalled],
      };

      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      await registryManager.load();

      await expect(installer.uninstall('test-server'))
        .rejects.toThrow('is not installed');
    });
  });

  describe('update', () => {
    const mockServer: MCPRegistryEntry = {
      name: 'test-server',
      displayName: 'Test Server',
      description: 'A test server',
      version: '1.0.0',
      author: 'Test',
      package: '@test/server',
      tags: ['test'],
      runtime: 'node',
      installed: true,
      installedVersion: '1.0.0',
    };

    beforeEach(async () => {
      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [mockServer],
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      mockedFs.writeFileSync.mockImplementation(() => undefined);

      await registryManager.load();
    });

    it('should update a server', async () => {
      mockedChildProcess.execSync.mockImplementation((cmd: string) => {
        if (cmd.includes('npm list')) {
          return Buffer.from(JSON.stringify({
            dependencies: {
              '@test/server': { version: '2.0.0' }
            }
          }));
        }
        return Buffer.from('');
      });

      const result = await installer.update('test-server');

      expect(result.name).toBe('test-server');
      expect(result.updated).toBe(true);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [
          {
            name: 'server1',
            displayName: 'Server 1',
            description: 'Test',
            version: '1.0.0',
            author: 'Test',
            package: 'pkg1',
            tags: ['test'],
            runtime: 'node' as const,
            installed: true,
          },
          {
            name: 'server2',
            displayName: 'Server 2',
            description: 'Test',
            version: '1.0.0',
            author: 'Test',
            package: 'pkg2',
            tags: ['test'],
            runtime: 'node' as const,
            installed: false,
          },
        ],
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      await registryManager.load();
    });

    it('should list only installed servers', async () => {
      const servers = await installer.list();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('server1');
    });
  });

  describe('test', () => {
    const mockServer: MCPRegistryEntry = {
      name: 'test-server',
      displayName: 'Test Server',
      description: 'A test server',
      version: '1.0.0',
      author: 'Test',
      package: '@test/server',
      tags: ['test'],
      runtime: 'node',
      installed: true,
    };

    beforeEach(async () => {
      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [mockServer],
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      await registryManager.load();
    });

    it('should return success if server is responsive', async () => {
      // Mock spawn
      const mockProcess = {
        on: jest.fn(),
        kill: jest.fn(),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
      };

      (mockedChildProcess.spawn as jest.Mock).mockReturnValue(mockProcess);

      // Simulate successful exit after a delay
      setTimeout(() => {
        const exitCallback = mockProcess.on.mock.calls.find(
          call => call[0] === 'exit'
        )?.[1];
        if (exitCallback) {
          exitCallback(0);
        }
      }, 100);

      const result = await installer.test('test-server');

      expect(result.success).toBe(true);
    });

    it('should return failure if server not found', async () => {
      const result = await installer.test('non-existent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should return failure if server not installed', async () => {
      const notInstalled = { ...mockServer, installed: false };
      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [notInstalled],
      };

      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      await registryManager.load();

      const result = await installer.test('test-server');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not installed');
    });
  });
});
