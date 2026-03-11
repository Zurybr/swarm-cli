/**
 * MCP Client - Issue #24
 * Main client implementation for Model Context Protocol
 */

import { EventEmitter } from 'events';
import {
  MCPClient,
  MCPServerConfig,
  MCPTool,
  MCPToolResult,
  MCPResource,
  MCPResourceContent,
  MCPInitializeResult,
  MCPPrompt,
  MCPPromptResult,
  JSONRPCRequest,
  MCPConnectionError,
} from './types';
import { StdioTransport } from './transports/stdio';
import { HTTPTransport } from './transports/http';
import { MCPTransport } from './types';

export interface MCPClientOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Debug mode - log all messages */
  debug?: boolean;
  /** Auto-initialize on connect */
  autoInitialize?: boolean;
}

/**
 * MCP Client Implementation
 * Provides a high-level API for communicating with MCP servers
 */
export class MCPClientImpl extends EventEmitter implements MCPClient {
  private transport: MCPTransport | null = null;
  private serverConfig: MCPServerConfig | null = null;
  private options: Required<MCPClientOptions>;
  private messageId = 0;
  private tools: MCPTool[] = [];
  private resources: MCPResource[] = [];
  private prompts: MCPPrompt[] = [];
  private serverInfo: MCPInitializeResult | null = null;

  constructor(options: MCPClientOptions = {}) {
    super();
    this.options = {
      timeout: options.timeout ?? 30000,
      debug: options.debug ?? false,
      autoInitialize: options.autoInitialize ?? true,
    };
  }

  /**
   * Connect to an MCP server
   */
  async connect(server: MCPServerConfig): Promise<void> {
    this.serverConfig = server;
    
    // Determine transport type
    const transportType = server.transport ?? this.detectTransportType(server);
    
    // Create appropriate transport
    this.transport = this.createTransport(transportType, server);

    // Set up notification handler
    this.transport.onNotification?.((notification) => {
      this.emit('notification', notification);
    });

    // Connect
    await this.transport.connect();

    // Auto-initialize if enabled
    if (this.options.autoInitialize) {
      await this.initialize();
    }

    this.emit('connected');
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.transport) {
      this.transport.disconnect();
      this.transport = null;
    }
    this.tools = [];
    this.resources = [];
    this.prompts = [];
    this.serverInfo = null;
    this.emit('disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.transport?.isConnected() ?? false;
  }

  /**
   * Initialize the MCP connection
   */
  async initialize(): Promise<MCPInitializeResult> {
    const result = await this.sendRequest<MCPInitializeResult>('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      clientInfo: {
        name: 'swarm-cli',
        version: '0.1.0',
      },
    });

    this.serverInfo = result;

    // Send initialized notification
    await this.sendNotification('notifications/initialized', {});

    return result;
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPTool[]> {
    const response = await this.sendRequest<{ tools: MCPTool[] }>('tools/list', {});
    this.tools = response.tools || [];
    return this.tools;
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    return await this.sendRequest<MCPToolResult>('tools/call', {
      name,
      arguments: args,
    });
  }

  /**
   * List available resources
   */
  async listResources(): Promise<MCPResource[]> {
    const response = await this.sendRequest<{ resources: MCPResource[] }>('resources/list', {});
    this.resources = response.resources || [];
    return this.resources;
  }

  /**
   * Read a resource
   */
  async readResource(uri: string): Promise<MCPResourceContent> {
    const response = await this.sendRequest<{ contents: MCPResourceContent[] }>(
      'resources/read',
      { uri }
    );
    return response.contents?.[0] ?? { uri, mimeType: 'text/plain', text: '' };
  }

  /**
   * List available prompts
   */
  async listPrompts(): Promise<MCPPrompt[]> {
    const response = await this.sendRequest<{ prompts: MCPPrompt[] }>('prompts/list', {});
    this.prompts = response.prompts || [];
    return this.prompts;
  }

  /**
   * Get a prompt
   */
  async getPrompt(
    name: string,
    args?: Record<string, unknown>
  ): Promise<MCPPromptResult> {
    return await this.sendRequest<MCPPromptResult>('prompts/get', {
      name,
      arguments: args,
    });
  }

  /**
   * Get cached tools (synchronous)
   */
  getCachedTools(): MCPTool[] {
    return [...this.tools];
  }

  /**
   * Get cached resources (synchronous)
   */
  getCachedResources(): MCPResource[] {
    return [...this.resources];
  }

  /**
   * Get cached prompts (synchronous)
   */
  getCachedPrompts(): MCPPrompt[] {
    return [...this.prompts];
  }

  /**
   * Get server info
   */
  getServerInfo(): MCPInitializeResult | null {
    return this.serverInfo;
  }

  /**
   * Get server config
   */
  getServerConfig(): MCPServerConfig | null {
    return this.serverConfig;
  }

  /**
   * Send a JSON-RPC request
   */
  private async sendRequest<T>(method: string, params: unknown): Promise<T> {
    if (!this.transport) {
      throw new MCPConnectionError('Not connected to MCP server');
    }

    const id = ++this.messageId;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    if (this.options.debug) {
      console.log(`[MCP ->] ${method}:`, JSON.stringify(params));
    }

    const response = await this.transport.send(request);

    if (response.error) {
      throw new Error(`MCP Error ${response.error.code}: ${response.error.message}`);
    }

    if (this.options.debug) {
      console.log(`[MCP <-] ${method}:`, JSON.stringify(response.result));
    }

    return response.result as T;
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  private async sendNotification(method: string, params: unknown): Promise<void> {
    if (!this.transport) {
      throw new MCPConnectionError('Not connected to MCP server');
    }

    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: ++this.messageId,
      method,
      params,
    };

    // Notifications don't expect responses, but we still send them
    try {
      await this.transport.send(request);
    } catch {
      // Ignore errors for notifications
    }
  }

  /**
   * Detect transport type from config
   */
  private detectTransportType(config: MCPServerConfig): 'stdio' | 'http' | 'sse' {
    if (config.url) {
      return 'http';
    }
    return 'stdio';
  }

  /**
   * Create transport instance
   */
  private createTransport(
    type: 'stdio' | 'http' | 'sse',
    config: MCPServerConfig
  ): MCPTransport {
    switch (type) {
      case 'stdio':
        return new StdioTransport(config, {
          timeout: config.timeout ?? this.options.timeout,
          debug: this.options.debug,
        });
      
      case 'http':
      case 'sse':
        return new HTTPTransport(config, {
          timeout: config.timeout ?? this.options.timeout,
          useSSE: type === 'sse',
          debug: this.options.debug,
        });
      
      default:
        throw new MCPConnectionError(`Unknown transport type: ${type}`);
    }
  }
}

// Re-export for backward compatibility
export { MCPClientImpl as MCPClient };
