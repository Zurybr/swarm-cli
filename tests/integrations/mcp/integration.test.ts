/**
 * MCP Integration Tests - Issue #24
 * Integration tests for MCP tool integration and configuration
 */

import {
  InMemoryToolRegistry,
  registerMCPTools,
  unregisterMCPTools,
  mapInputSchemaToParameters,
  mcpToolToSkillMetadata,
  isMCPTool,
  parseMCPToolName,
  ToolDefinition,
} from '../../../src/integrations/mcp/integration';
import {
  loadMCPConfig,
  validateServerConfig,
  mergeConfigs,
} from '../../../src/integrations/mcp/config';
import { MCPTool, MCPServerConfig, MCPConfig } from '../../../src/integrations/mcp/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('MCP Tool Integration', () => {
  let registry: InMemoryToolRegistry;
  let mockClient: any;
  const mockTools: MCPTool[] = [
    {
      name: 'read_file',
      description: 'Read a file from the filesystem',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
        },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Write a file to the filesystem',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'File content' },
        },
        required: ['path', 'content'],
      },
    },
  ];

  beforeEach(() => {
    registry = new InMemoryToolRegistry();
    mockClient = {
      getCachedTools: () => mockTools,
      callTool: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'success' }],
        isError: false,
      }),
    };
  });

  describe('InMemoryToolRegistry', () => {
    it('should register and retrieve tools', () => {
      const tool: ToolDefinition = {
        name: 'test-tool',
        description: 'A test tool',
        parameters: { type: 'object' },
        handler: async () => ({ success: true, content: 'ok' }),
      };

      registry.register(tool);
      expect(registry.has('test-tool')).toBe(true);
      expect(registry.get('test-tool')).toEqual(tool);
    });

    it('should unregister tools', () => {
      const tool: ToolDefinition = {
        name: 'test-tool',
        description: 'A test tool',
        parameters: { type: 'object' },
        handler: async () => ({ success: true, content: 'ok' }),
      };

      registry.register(tool);
      registry.unregister('test-tool');
      expect(registry.has('test-tool')).toBe(false);
    });

    it('should list all tools', () => {
      const tool1: ToolDefinition = {
        name: 'tool-1',
        description: 'Tool 1',
        parameters: {},
        handler: async () => ({ success: true, content: '' }),
      };
      const tool2: ToolDefinition = {
        name: 'tool-2',
        description: 'Tool 2',
        parameters: {},
        handler: async () => ({ success: true, content: '' }),
      };

      registry.register(tool1);
      registry.register(tool2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all.map(t => t.name)).toContain('tool-1');
      expect(all.map(t => t.name)).toContain('tool-2');
    });
  });

  describe('registerMCPTools', () => {
    it('should register MCP tools with correct names', () => {
      const registrations = registerMCPTools(
        mockClient,
        'filesystem',
        registry,
        { toolPrefix: 'mcp' }
      );

      expect(registrations).toHaveLength(2);
      expect(registrations[0].fullName).toBe('mcp:filesystem:read_file');
      expect(registrations[1].fullName).toBe('mcp:filesystem:write_file');
    });

    it('should register tools in the registry', () => {
      registerMCPTools(mockClient, 'filesystem', registry);

      expect(registry.has('mcp:filesystem:read_file')).toBe(true);
      expect(registry.has('mcp:filesystem:write_file')).toBe(true);
    });

    it('should use custom prefix', () => {
      const registrations = registerMCPTools(
        mockClient,
        'filesystem',
        registry,
        { toolPrefix: 'custom' }
      );

      expect(registrations[0].fullName).toBe('custom:filesystem:read_file');
    });
  });

  describe('unregisterMCPTools', () => {
    it('should unregister all tools from a server', () => {
      registerMCPTools(mockClient, 'filesystem', registry);
      const count = unregisterMCPTools('filesystem', registry);

      expect(count).toBe(2);
      expect(registry.has('mcp:filesystem:read_file')).toBe(false);
      expect(registry.has('mcp:filesystem:write_file')).toBe(false);
    });
  });

  describe('mapInputSchemaToParameters', () => {
    it('should map input schema to parameters', () => {
      const schema = mockTools[0].inputSchema;
      const params = mapInputSchemaToParameters(schema);

      expect(params.type).toBe('object');
      expect(params.properties).toEqual(schema.properties);
      expect(params.required).toEqual(schema.required);
    });
  });

  describe('mcpToolToSkillMetadata', () => {
    it('should convert MCP tool to skill metadata', () => {
      const metadata = mcpToolToSkillMetadata(mockTools[0], 'filesystem');

      expect(metadata.name).toBe('mcp:filesystem:read_file');
      expect(metadata.description).toBe('Read a file from the filesystem');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.category).toBe('general');
      expect(metadata.tags).toContain('mcp');
      expect(metadata.tags).toContain('filesystem');
    });
  });

  describe('isMCPTool', () => {
    it('should identify MCP tools', () => {
      expect(isMCPTool('mcp:filesystem:read_file')).toBe(true);
      expect(isMCPTool('regular-tool')).toBe(false);
    });

    it('should use custom prefix', () => {
      expect(isMCPTool('custom:server:tool', 'custom')).toBe(true);
      expect(isMCPTool('mcp:server:tool', 'custom')).toBe(false);
    });
  });

  describe('parseMCPToolName', () => {
    it('should parse valid MCP tool names', () => {
      const result = parseMCPToolName('mcp:filesystem:read_file');
      expect(result).toEqual({
        serverName: 'filesystem',
        toolName: 'read_file',
      });
    });

    it('should return null for invalid names', () => {
      expect(parseMCPToolName('invalid-name')).toBeNull();
      expect(parseMCPToolName('prefix:only')).toBeNull();
    });
  });
});

describe('MCP Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateServerConfig', () => {
    it('should validate a valid config', () => {
      const config: MCPServerConfig = {
        name: 'test',
        command: 'node',
        args: ['server.js'],
      };

      const errors = validateServerConfig(config);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing name', () => {
      const config = {
        command: 'node',
        args: ['server.js'],
      } as any;

      const errors = validateServerConfig(config);
      expect(errors).toContain('Server name is required');
    });

    it('should detect missing command and url', () => {
      const config: MCPServerConfig = {
        name: 'test',
        command: '',
        args: [],
      };

      const errors = validateServerConfig(config);
      expect(errors).toContain('Either command or url is required');
    });

    it('should detect missing command for stdio transport', () => {
      const config: MCPServerConfig = {
        name: 'test',
        command: '',
        args: [],
        transport: 'stdio',
      };

      const errors = validateServerConfig(config);
      expect(errors).toContain('command is required for stdio transport');
    });

    it('should detect missing url for http transport', () => {
      const config: MCPServerConfig = {
        name: 'test',
        command: '',
        args: [],
        transport: 'http',
      };

      const errors = validateServerConfig(config);
      expect(errors).toContain('url is required for http/sse transport');
    });

    it('should validate args type', () => {
      const config = {
        name: 'test',
        command: 'node',
        args: 'not-an-array',
      } as any;

      const errors = validateServerConfig(config);
      expect(errors).toContain('args must be an array');
    });

    it('should validate env type', () => {
      const config = {
        name: 'test',
        command: 'node',
        args: [],
        env: 'not-an-object',
      } as any;

      const errors = validateServerConfig(config);
      expect(errors).toContain('env must be an object');
    });
  });

  describe('mergeConfigs', () => {
    it('should merge multiple configs', () => {
      const config1: MCPConfig = {
        servers: {
          server1: { name: 'server1', command: 'cmd1', args: [] },
        },
      };

      const config2: MCPConfig = {
        servers: {
          server2: { name: 'server2', command: 'cmd2', args: [] },
        },
      };

      const merged = mergeConfigs(config1, config2);
      expect(Object.keys(merged.servers)).toContain('server1');
      expect(Object.keys(merged.servers)).toContain('server2');
    });

    it('should override with later configs', () => {
      const config1: MCPConfig = {
        servers: {
          server1: { name: 'server1', command: 'cmd1', args: [] },
        },
      };

      const config2: MCPConfig = {
        servers: {
          server1: { name: 'server1', command: 'cmd2', args: ['--flag'] },
        },
      };

      const merged = mergeConfigs(config1, config2);
      expect(merged.servers.server1.command).toBe('cmd2');
    });
  });
});

describe('Tool Handler Execution', () => {
  let registry: InMemoryToolRegistry;
  let mockClient: any;

  beforeEach(() => {
    registry = new InMemoryToolRegistry();
    mockClient = {
      getCachedTools: () => [
        {
          name: 'echo',
          description: 'Echo a message',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
            required: ['message'],
          },
        },
      ],
      callTool: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'echoed: hello' }],
        isError: false,
      }),
    };
  });

  it('should execute tool handler', async () => {
    registerMCPTools(mockClient, 'test', registry);

    const tool = registry.get('mcp:test:echo');
    expect(tool).toBeDefined();

    const result = await tool!.handler({ message: 'hello' });
    expect(result.success).toBe(true);
    expect(result.content).toBe('echoed: hello');
  });

  it('should handle tool errors', async () => {
    mockClient.callTool.mockRejectedValue(new Error('Tool failed'));
    registerMCPTools(mockClient, 'test', registry);

    const tool = registry.get('mcp:test:echo');
    const result = await tool!.handler({ message: 'hello' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Tool failed');
  });

  it('should handle MCP error results', async () => {
    mockClient.callTool.mockResolvedValue({
      content: [{ type: 'text', text: 'Error occurred' }],
      isError: true,
    });
    registerMCPTools(mockClient, 'test', registry);

    const tool = registry.get('mcp:test:echo');
    const result = await tool!.handler({ message: 'hello' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('MCP tool returned an error');
  });
});
