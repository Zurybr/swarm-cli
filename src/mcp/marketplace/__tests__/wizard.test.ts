/**
 * Tests for MCP Config Wizard
 */

import { MCPConfigWizard } from '../wizard';
import { MCPRegistryManager } from '../registry';
import { MCPInstaller } from '../installer';
import * as fs from 'fs';

// Mock modules
jest.mock('fs');
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));
const mockedFs = fs as jest.Mocked<typeof fs>;

// Import inquirer after mocking
import inquirer from 'inquirer';
const mockedInquirer = inquirer as jest.Mocked<typeof inquirer>;

describe('MCPConfigWizard', () => {
  let wizard: MCPConfigWizard;
  let registryManager: MCPRegistryManager;
  let installer: MCPInstaller;

  beforeEach(() => {
    registryManager = new MCPRegistryManager('/tmp/test-registry.json');
    installer = new MCPInstaller(registryManager, '/tmp/test-config.yaml');
    wizard = new MCPConfigWizard(registryManager, installer);
    jest.clearAllMocks();
  });

  describe('configure', () => {
    const mockServer = {
      name: 'test-server',
      displayName: 'Test Server',
      description: 'A test server',
      version: '1.0.0',
      author: 'Test',
      package: '@test/server',
      tags: ['test'],
      runtime: 'node' as const,
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
      mockedFs.writeFileSync.mockImplementation(() => undefined);
      mockedFs.mkdirSync.mockImplementation(() => undefined);

      await registryManager.load();
    });

    it('should configure an installed server', async () => {
      mockedInquirer.prompt
        .mockResolvedValueOnce({ shouldTest: false });

      await wizard.configure('test-server');

      expect(mockedInquirer.prompt).toHaveBeenCalled();
    });

    it('should prompt to install if server not installed', async () => {
      const notInstalled = { ...mockServer, installed: false };
      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [notInstalled],
      };

      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      await registryManager.load();

      // Mock install method
      const installSpy = jest.spyOn(installer, 'install').mockResolvedValue({
        name: 'test-server',
        version: '1.0.0',
        path: '@test/server',
        isNew: true,
        warnings: [],
      });

      mockedInquirer.prompt
        .mockResolvedValueOnce({ shouldInstall: true })
        .mockResolvedValueOnce({ shouldTest: false });

      await wizard.configure('test-server');

      expect(installSpy).toHaveBeenCalledWith('test-server');
    });

    it('should cancel if user declines installation', async () => {
      const notInstalled = { ...mockServer, installed: false };
      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [notInstalled],
      };

      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      await registryManager.load();

      mockedInquirer.prompt.mockResolvedValueOnce({ shouldInstall: false });

      await wizard.configure('test-server');

      // Should not proceed with configuration
      expect(mockedInquirer.prompt).toHaveBeenCalledTimes(1);
    });

    it('should handle required environment variables', async () => {
      const serverWithEnv = {
        ...mockServer,
        requiredEnv: ['API_KEY'],
      };

      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [serverWithEnv],
      };

      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      await registryManager.load();

      mockedInquirer.prompt
        .mockResolvedValueOnce({ value: 'test-api-key' })
        .mockResolvedValueOnce({ shouldTest: false });

      await wizard.configure('test-server');

      // Should prompt for API_KEY
      expect(mockedInquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'value',
            message: expect.stringContaining('API_KEY'),
          })
        ])
      );
    });
  });

  describe('showInfo', () => {
    const mockServer = {
      name: 'test-server',
      displayName: 'Test Server',
      description: 'A test server',
      version: '1.0.0',
      author: 'Test Author',
      package: '@test/server',
      tags: ['test', 'example'],
      runtime: 'node' as const,
      installed: true,
      installedVersion: '1.0.0',
      configSchema: {
        type: 'object',
        properties: {
          connectionString: {
            type: 'string',
            description: 'Database connection string',
          },
        },
        required: ['connectionString'],
      },
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

    it('should display server information', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await wizard.showInfo('test-server');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test Server')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test Author')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('node')
      );

      consoleSpy.mockRestore();
    });

    it('should show error if server not found', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await wizard.showInfo('non-existent');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('not found')
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('interactiveInstall', () => {
    beforeEach(async () => {
      const mockRegistry = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00Z',
        servers: [
          {
            name: 'server1',
            displayName: 'Server 1',
            description: 'First server',
            version: '1.0.0',
            author: 'Test',
            package: 'pkg1',
            tags: ['database'],
            runtime: 'node' as const,
          },
          {
            name: 'server2',
            displayName: 'Server 2',
            description: 'Second server',
            version: '1.0.0',
            author: 'Test',
            package: 'pkg2',
            tags: ['api'],
            runtime: 'node' as const,
          },
        ],
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRegistry));
      await registryManager.load();
    });

    it('should allow searching by query', async () => {
      mockedInquirer.prompt
        .mockResolvedValueOnce({ searchType: 'search' })
        .mockResolvedValueOnce({ query: 'database' })
        .mockResolvedValueOnce({ selectedServer: 'server1' });

      // Mock configure method
      const configureSpy = jest.spyOn(wizard, 'configure').mockResolvedValue();

      await wizard.interactiveInstall();

      expect(configureSpy).toHaveBeenCalledWith('server1');
    });

    it('should allow browsing by category', async () => {
      mockedInquirer.prompt
        .mockResolvedValueOnce({ searchType: 'category' })
        .mockResolvedValueOnce({ category: 'database' })
        .mockResolvedValueOnce({ selectedServer: 'server1' });

      const configureSpy = jest.spyOn(wizard, 'configure').mockResolvedValue();

      await wizard.interactiveInstall();

      expect(configureSpy).toHaveBeenCalledWith('server1');
    });

    it('should allow listing all servers', async () => {
      mockedInquirer.prompt
        .mockResolvedValueOnce({ searchType: 'all' })
        .mockResolvedValueOnce({ selectedServer: 'server2' });

      const configureSpy = jest.spyOn(wizard, 'configure').mockResolvedValue();

      await wizard.interactiveInstall();

      expect(configureSpy).toHaveBeenCalledWith('server2');
    });

    it('should handle no results', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      mockedInquirer.prompt
        .mockResolvedValueOnce({ searchType: 'search' })
        .mockResolvedValueOnce({ query: 'nonexistent' });

      await wizard.interactiveInstall();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No servers found')
      );

      consoleLogSpy.mockRestore();
    });
  });
});
