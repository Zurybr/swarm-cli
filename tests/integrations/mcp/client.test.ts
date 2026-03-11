/**
 * MCP Client Tests - Issue #24
 * Unit tests for MCP client and transports
 */

import { MCPClientImpl } from '../../../src/integrations/mcp/mcp-client';
import { StdioTransport } from '../../../src/integrations/mcp/transports/stdio';
import { HTTPTransport } from '../../../src/integrations/mcp/transports/http';
import {
  MCPServerConfig,
  MCPTool,
  MCPResource,
} from '../../../src/integrations/mcp/types';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

describe('MCPClientImpl', () => {
  let client: MCPClientImpl;

  beforeEach(() => {
    client = new MCPClientImpl({ debug: false });
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('constructor', () => {
    it('should create client with default options', () => {
      const defaultClient = new MCPClientImpl();
      expect(defaultClient).toBeDefined();
      expect(defaultClient.isConnected()).toBe(false);
    });

    it('should accept custom options', () => {
      const customClient = new MCPClientImpl({
        timeout: 5000,
        debug: true,
        autoInitialize: false,
      });
      expect(customClient).toBeDefined();
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('getCachedTools', () => {
    it('should return empty array when not connected', () => {
      const tools = client.getCachedTools();
      expect(tools).toEqual([]);
    });
  });

  describe('getCachedResources', () => {
    it('should return empty array when not connected', () => {
      const resources = client.getCachedResources();
      expect(resources).toEqual([]);
    });
  });

  describe('getServerInfo', () => {
    it('should return null when not initialized', () => {
      const info = client.getServerInfo();
      expect(info).toBeNull();
    });
  });

  describe('getServerConfig', () => {
    it('should return null when not connected', () => {
      const config = client.getServerConfig();
      expect(config).toBeNull();
    });
  });
});

describe('StdioTransport', () => {
  let transport: StdioTransport;
  const mockConfig: MCPServerConfig = {
    name: 'test-server',
    command: 'node',
    args: ['server.js'],
  };

  beforeEach(() => {
    transport = new StdioTransport(mockConfig, { debug: false });
  });

  afterEach(() => {
    transport.disconnect();
  });

  describe('constructor', () => {
    it('should create transport with config', () => {
      expect(transport).toBeDefined();
    });

    it('should accept custom options', () => {
      const customTransport = new StdioTransport(mockConfig, {
        timeout: 5000,
        bufferSize: 2048,
        debug: true,
      });
      expect(customTransport).toBeDefined();
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      expect(transport.isConnected()).toBe(false);
    });
  });

  describe('getNextId', () => {
    it('should increment message IDs', () => {
      const id1 = transport.getNextId();
      const id2 = transport.getNextId();
      expect(id2).toBe(id1 + 1);
    });
  });
});

describe('HTTPTransport', () => {
  let transport: HTTPTransport;
  const mockConfig: MCPServerConfig = {
    name: 'http-server',
    command: '',
    args: [],
    url: 'http://localhost:3000/mcp',
  };

  beforeEach(() => {
    transport = new HTTPTransport(mockConfig, { debug: false });
  });

  afterEach(() => {
    transport.disconnect();
  });

  describe('constructor', () => {
    it('should create transport with config', () => {
      expect(transport).toBeDefined();
    });

    it('should accept custom options', () => {
      const customTransport = new HTTPTransport(mockConfig, {
        timeout: 5000,
        useSSE: true,
        headers: { 'X-Custom': 'value' },
        debug: true,
      });
      expect(customTransport).toBeDefined();
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      expect(transport.isConnected()).toBe(false);
    });
  });

  describe('getNextId', () => {
    it('should increment message IDs', () => {
      const id1 = transport.getNextId();
      const id2 = transport.getNextId();
      expect(id2).toBe(id1 + 1);
    });
  });
});

describe('MCP Types', () => {
  describe('MCPTool', () => {
    it('should define tool structure', () => {
      const tool: MCPTool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'A message',
            },
          },
          required: ['message'],
        },
      };

      expect(tool.name).toBe('test-tool');
      expect(tool.description).toBe('A test tool');
      expect(tool.inputSchema.type).toBe('object');
    });
  });

  describe('MCPResource', () => {
    it('should define resource structure', () => {
      const resource: MCPResource = {
        uri: 'file:///test.txt',
        name: 'test.txt',
        mimeType: 'text/plain',
      };

      expect(resource.uri).toBe('file:///test.txt');
      expect(resource.name).toBe('test.txt');
      expect(resource.mimeType).toBe('text/plain');
    });
  });
});
