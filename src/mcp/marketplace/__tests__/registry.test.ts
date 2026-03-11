/**
 * Tests for MCP Registry Manager
 */

import { MCPRegistryManager, MCPRegistryEntry } from '../registry';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock fs module
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('MCPRegistryManager', () => {
  let registryManager: MCPRegistryManager;
  const testRegistryPath = '/tmp/test-registry.json';

  beforeEach(() => {
    registryManager = new MCPRegistryManager(testRegistryPath);
    jest.clearAllMocks();
  });

  describe('getDefaultRegistryPath', () => {
    it('should return the correct default path', () => {
      const expectedPath = path.join(os.homedir(), '.config', 'swarm-cli', 'mcp-registry.json');
      expect(MCPRegistryManager.getDefaultRegistryPath()).toBe(expectedPath);
    });
  });

  describe('load', () => {
    it('should load registry from file if it exists', async () => {
      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [
          {
            name: 'test-server',
            displayName: 'Test Server',
            description: 'A test server',
            version: '1.0.0',
            author: 'Test',
            package: 'test-package',
            tags: ['test'],
            runtime: 'node' as const,
          },
        ],
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));

      const registry = await registryManager.load();

      expect(mockedFs.existsSync).toHaveBeenCalledWith(testRegistryPath);
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(testRegistryPath, 'utf-8');
      expect(registry.version).toBe('1.0.0');
      expect(registry.servers).toHaveLength(1);
      expect(registry.servers[0].name).toBe('test-server');
    });

    it('should create built-in registry if file does not exist', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.writeFileSync.mockImplementation(() => undefined);

      const registry = await registryManager.load();

      expect(registry.version).toBe('1.0.0');
      expect(registry.servers.length).toBeGreaterThan(0);
      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [
          {
            name: 'filesystem',
            displayName: 'Filesystem Access',
            description: 'Read and write files',
            version: '1.0.0',
            author: 'Test',
            package: 'fs-package',
            tags: ['filesystem', 'utility'],
            runtime: 'node' as const,
          },
          {
            name: 'github',
            displayName: 'GitHub Integration',
            description: 'GitHub API integration',
            version: '1.0.0',
            author: 'Test',
            package: 'github-package',
            tags: ['github', 'api'],
            runtime: 'node' as const,
          },
        ],
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      await registryManager.load();
    });

    it('should search servers by query', async () => {
      const results = await registryManager.search({ query: 'filesystem' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('filesystem');
    });

    it('should filter servers by tag', async () => {
      const results = await registryManager.search({ tags: ['api'] });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('github');
    });

    it('should return all servers without filters', async () => {
      const results = await registryManager.search({});
      expect(results).toHaveLength(2);
    });

    it('should limit results', async () => {
      const results = await registryManager.search({ limit: 1 });
      expect(results).toHaveLength(1);
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [
          {
            name: 'test-server',
            displayName: 'Test Server',
            description: 'A test server',
            version: '1.0.0',
            author: 'Test',
            package: 'test-package',
            tags: ['test'],
            runtime: 'node' as const,
          },
        ],
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      await registryManager.load();
    });

    it('should return server by name', async () => {
      const server = await registryManager.get('test-server');
      expect(server).not.toBeNull();
      expect(server?.name).toBe('test-server');
    });

    it('should return null if server not found', async () => {
      const server = await registryManager.get('non-existent');
      expect(server).toBeNull();
    });

    it('should be case-insensitive', async () => {
      const server = await registryManager.get('TEST-SERVER');
      expect(server).not.toBeNull();
    });
  });

  describe('add', () => {
    beforeEach(async () => {
      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [],
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      mockedFs.writeFileSync.mockImplementation(() => undefined);
      await registryManager.load();
    });

    it('should add new server to registry', async () => {
      const newServer: MCPRegistryEntry = {
        name: 'new-server',
        displayName: 'New Server',
        description: 'A new server',
        version: '1.0.0',
        author: 'Test',
        package: 'new-package',
        tags: ['new'],
        runtime: 'node',
      };

      await registryManager.add(newServer);

      const server = await registryManager.get('new-server');
      expect(server).not.toBeNull();
      expect(server?.name).toBe('new-server');
    });

    it('should update existing server', async () => {
      const server: MCPRegistryEntry = {
        name: 'existing-server',
        displayName: 'Existing Server',
        description: 'Original description',
        version: '1.0.0',
        author: 'Test',
        package: 'existing-package',
        tags: ['existing'],
        runtime: 'node',
      };

      await registryManager.add(server);

      const updatedServer: MCPRegistryEntry = {
        ...server,
        description: 'Updated description',
        version: '2.0.0',
      };

      await registryManager.add(updatedServer);

      const result = await registryManager.get('existing-server');
      expect(result?.description).toBe('Updated description');
      expect(result?.version).toBe('2.0.0');
    });
  });

  describe('remove', () => {
    beforeEach(async () => {
      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [
          {
            name: 'test-server',
            displayName: 'Test Server',
            description: 'A test server',
            version: '1.0.0',
            author: 'Test',
            package: 'test-package',
            tags: ['test'],
            runtime: 'node' as const,
          },
        ],
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      mockedFs.writeFileSync.mockImplementation(() => undefined);
      await registryManager.load();
    });

    it('should remove server from registry', async () => {
      const removed = await registryManager.remove('test-server');
      expect(removed).toBe(true);

      const server = await registryManager.get('test-server');
      expect(server).toBeNull();
    });

    it('should return false if server not found', async () => {
      const removed = await registryManager.remove('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('getTags', () => {
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
            tags: ['database', 'sql'],
            runtime: 'node' as const,
          },
          {
            name: 'server2',
            displayName: 'Server 2',
            description: 'Test',
            version: '1.0.0',
            author: 'Test',
            package: 'pkg2',
            tags: ['api', 'web'],
            runtime: 'node' as const,
          },
        ],
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      await registryManager.load();
    });

    it('should return all unique tags', async () => {
      const tags = await registryManager.getTags();
      expect(tags).toContain('database');
      expect(tags).toContain('sql');
      expect(tags).toContain('api');
      expect(tags).toContain('web');
    });

    it('should sort tags alphabetically', async () => {
      const tags = await registryManager.getTags();
      expect(tags).toEqual(['api', 'database', 'sql', 'web']);
    });
  });

  describe('getStats', () => {
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
            tags: ['database'],
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
            tags: ['api'],
            runtime: 'python' as const,
          },
        ],
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      await registryManager.load();
    });

    it('should return correct statistics', async () => {
      const stats = await registryManager.getStats();

      expect(stats.totalServers).toBe(2);
      expect(stats.installedServers).toBe(1);
      expect(stats.byRuntime.node).toBe(1);
      expect(stats.byRuntime.python).toBe(1);
      expect(stats.byTag.database).toBe(1);
      expect(stats.byTag.api).toBe(1);
    });
  });

  describe('markInstalled', () => {
    beforeEach(async () => {
      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [
          {
            name: 'test-server',
            displayName: 'Test Server',
            description: 'A test server',
            version: '1.0.0',
            author: 'Test',
            package: 'test-package',
            tags: ['test'],
            runtime: 'node' as const,
          },
        ],
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      mockedFs.writeFileSync.mockImplementation(() => undefined);
      await registryManager.load();
    });

    it('should mark server as installed', async () => {
      await registryManager.markInstalled('test-server', '2.0.0');

      const server = await registryManager.get('test-server');
      expect(server?.installed).toBe(true);
      expect(server?.installedVersion).toBe('2.0.0');
    });
  });
});
