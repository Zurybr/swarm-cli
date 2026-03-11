/**
 * MCP Testing Utilities - Issue #24.6
 * Helper utilities for testing MCP servers
 */

import { spawn, ChildProcess } from 'child_process';
import { resolve, dirname } from 'path';
import { Logger } from '../../utils/logger.js';
import {
  MCPTestClientOptions,
  MCPToolResult,
} from './types.js';
import type { MCPTool, MCPResource, MCPPrompt } from '../../integrations/mcp/types.js';

const logger = new Logger('MCPTest');

/**
 * Test client for MCP servers
 * 
 * @example
 * ```typescript
 * const client = new MCPTestClient('./dist/index.js');
 * 
 * // List tools
 * const tools = await client.listTools();
 * 
 * // Call a tool
 * const result = await client.callTool('greet', { name: 'World' });
 * 
 * // Cleanup
 * await client.close();
 * ```
 */
export class MCPTestClient {
  private serverProcess: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests: Map<
    number,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  > = new Map();
  private buffer = '';
  private initialized = false;
  private readonly options: Required<MCPTestClientOptions>;

  constructor(options: MCPTestClientOptions | string) {
    this.options = {
      serverPath: typeof options === 'string' ? options : options.serverPath,
      timeout: typeof options === 'object' ? options.timeout || 30000 : 30000,
      env: typeof options === 'object' ? options.env || {} : {},
    };
  }

  /**
   * Start the server and initialize connection
   */
  async connect(): Promise<void> {
    if (this.serverProcess) {
      throw new Error('Already connected');
    }

    const serverPath = resolve(this.options.serverPath);

    logger.info(`Starting server: ${serverPath}`);

    this.serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...this.options.env,
      },
    });

    // Handle stdout (JSON-RPC responses)
    this.serverProcess.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    // Handle stderr (logs)
    this.serverProcess.stderr?.on('data', (data: Buffer) => {
      logger.debug(`Server stderr: ${data.toString()}`);
    });

    this.serverProcess.on('error', (error) => {
      logger.error(`Server error: ${error.message}`);
    });

    // Wait for process to start
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Initialize MCP connection
    await this.initialize();
  }

  /**
   * Initialize MCP connection
   */
  private async initialize(): Promise<void> {
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'mcp-test-client',
        version: '1.0.0',
      },
    });

    this.initialized = true;
    logger.info('Connected to server', result.serverInfo);
  }

  /**
   * Process buffered JSON-RPC messages
   */
  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      try {
        const message = JSON.parse(line);
        this.handleMessage(message);
      } catch (error) {
        logger.error(`Failed to parse message: ${line}`);
      }
    }
  }

  /**
   * Handle incoming JSON-RPC message
   */
  private handleMessage(message: any): void {
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message || 'Unknown error'));
        } else {
          pending.resolve(message.result);
        }
      }
    }
  }

  /**
   * Send a JSON-RPC request
   */
  private sendRequest(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.serverProcess?.stdin) {
        reject(new Error('Server not connected'));
        return;
      }

      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.options.timeout);

      this.pendingRequests.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      const message = JSON.stringify(request) + '\n';
      this.serverProcess.stdin.write(message);
    });
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPTool[]> {
    const result = await this.sendRequest('tools/list');
    return result.tools;
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<MCPToolResult> {
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });
    return result;
  }

  /**
   * List available resources
   */
  async listResources(): Promise<MCPResource[]> {
    const result = await this.sendRequest('resources/list');
    return result.resources;
  }

  /**
   * Read a resource
   */
  async readResource(uri: string): Promise<any> {
    const result = await this.sendRequest('resources/read', { uri });
    return result.contents[0];
  }

  /**
   * List available prompts
   */
  async listPrompts(): Promise<MCPPrompt[]> {
    const result = await this.sendRequest('prompts/list');
    return result.prompts;
  }

  /**
   * Get a prompt
   */
  async getPrompt(name: string, args?: Record<string, unknown>): Promise<any> {
    const result = await this.sendRequest('prompts/get', {
      name,
      arguments: args,
    });
    return result;
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (!this.serverProcess) {
      return;
    }

    return new Promise((resolve) => {
      if (!this.serverProcess) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        this.serverProcess?.kill('SIGKILL');
      }, 5000);

      this.serverProcess.on('exit', () => {
        clearTimeout(timeout);
        this.serverProcess = null;
        resolve();
      });

      this.serverProcess.kill('SIGTERM');
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.serverProcess !== null && this.initialized;
  }
}

// ============================================================================
// Jest/Vitest Helpers
// ============================================================================

/**
 * Create a test fixture for MCP server testing
 * 
 * @example
 * ```typescript
 * describe('My MCP Server', () => {
 *   const fixture = createMCPTestFixture('./dist/index.js');
 * 
 *   beforeAll(async () => {
 *     await fixture.setup();
 *   });
 * 
 *   afterAll(async () => {
 *     await fixture.teardown();
 *   });
 * 
 *   it('should list tools', async () => {
 *     const tools = await fixture.client.listTools();
 *     expect(tools.length).toBeGreaterThan(0);
 *   });
 * });
 * ```
 */
export function createMCPTestFixture(serverPath: string) {
  let client: MCPTestClient | null = null;

  return {
    get client(): MCPTestClient {
      if (!client) {
        throw new Error('Test fixture not set up. Call setup() first.');
      }
      return client;
    },

    async setup(): Promise<void> {
      client = new MCPTestClient(serverPath);
      await client.connect();
    },

    async teardown(): Promise<void> {
      if (client) {
        await client.close();
        client = null;
      }
    },
  };
}

/**
 * Test helper for tool testing
 */
export async function testTool(
  client: MCPTestClient,
  toolName: string,
  args: Record<string, unknown>,
  expected?: {
    isError?: boolean;
    containsText?: string;
    matchesPattern?: RegExp;
  }
): Promise<MCPToolResult> {
  const result = await client.callTool(toolName, args);

  if (expected) {
    if (expected.isError !== undefined) {
      if (result.isError !== expected.isError) {
        throw new Error(
          `Expected isError=${expected.isError}, got ${result.isError}`
        );
      }
    }

    if (expected.containsText) {
      const text = result.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join(' ');

      if (!text.includes(expected.containsText)) {
        throw new Error(
          `Expected response to contain "${expected.containsText}", got: ${text}`
        );
      }
    }

    if (expected.matchesPattern) {
      const text = result.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join(' ');

      if (!expected.matchesPattern.test(text)) {
        throw new Error(
          `Expected response to match ${expected.matchesPattern}, got: ${text}`
        );
      }
    }
  }

  return result;
}

/**
 * Create a mock MCP tool result
 */
export function mockToolResult(
  text: string,
  isError: boolean = false
): MCPToolResult {
  return {
    content: [{ type: 'text', text }],
    isError,
  };
}

/**
 * Create a mock MCP tool
 */
export function mockTool(
  name: string,
  description: string,
  handler: (args: Record<string, unknown>) => Promise<MCPToolResult>
): MCPTool & { handler: typeof handler } {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler,
  };
}
