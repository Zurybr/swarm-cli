/**
 * MCP Server Manager - Issue #24
 * Manage multiple MCP server connections
 */

import { EventEmitter } from 'events';
import { MCPClientImpl, MCPClientOptions } from './mcp-client';
import {
  MCPServerConfig,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPInitializeResult,
} from './types';

interface ServerEntry {
  config: MCPServerConfig;
  client: MCPClientImpl;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  connected: boolean;
  serverInfo?: MCPInitializeResult;
  lastError?: string;
  lastConnected?: Date;
}

export interface MCPServerManagerOptions {
  /** Auto-refresh tools and resources */
  autoRefresh?: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Client options */
  clientOptions?: MCPClientOptions;
}

/**
 * Manages multiple MCP server connections
 */
export class MCPServerManager extends EventEmitter {
  private servers: Map<string, ServerEntry> = new Map();
  private options: Required<MCPServerManagerOptions>;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(options: MCPServerManagerOptions = {}) {
    super();
    this.options = {
      autoRefresh: options.autoRefresh ?? true,
      refreshInterval: options.refreshInterval ?? 60000,
      clientOptions: options.clientOptions ?? {},
    };
  }

  /**
   * Add and connect to a server
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    const client = new MCPClientImpl(this.options.clientOptions);

    const entry: ServerEntry = {
      config,
      client,
      tools: [],
      resources: [],
      prompts: [],
      connected: false,
    };

    // Set up event handlers
    client.on('connected', () => {
      entry.connected = true;
      entry.lastConnected = new Date();
      entry.lastError = undefined;
      this.emit('server:connected', config.name);
    });

    client.on('disconnected', () => {
      entry.connected = false;
      this.emit('server:disconnected', config.name);
    });

    client.on('notification', (notification) => {
      this.emit('server:notification', { serverName: config.name, notification });
    });

    try {
      await client.connect(config);
      entry.connected = true;
      entry.serverInfo = client.getServerInfo() ?? undefined;

      // Discover tools, resources, and prompts
      await this.discoverServerCapabilities(entry);

      this.servers.set(config.name, entry);
      this.emit('server:added', config.name);

    } catch (error) {
      entry.lastError = (error as Error).message;
      entry.connected = false;
      this.servers.set(config.name, entry);
      throw error;
    }
  }

  /**
   * Remove a server
   */
  async removeServer(name: string): Promise<void> {
    const entry = this.servers.get(name);
    if (entry) {
      entry.client.disconnect();
      this.servers.delete(name);
      this.emit('server:removed', name);
    }
  }

  /**
   * Get server entry
   */
  getServer(name: string): ServerEntry | undefined {
    return this.servers.get(name);
  }

  /**
   * List all servers with status
   */
  listServers(): Array<{
    name: string;
    connected: boolean;
    toolCount: number;
    resourceCount: number;
    promptCount: number;
    lastError?: string;
    lastConnected?: Date;
  }> {
    return Array.from(this.servers.entries()).map(([name, entry]) => ({
      name,
      connected: entry.connected,
      toolCount: entry.tools.length,
      resourceCount: entry.resources.length,
      promptCount: entry.prompts.length,
      lastError: entry.lastError,
      lastConnected: entry.lastConnected,
    }));
  }

  /**
   * List all tools from all servers
   */
  async listAllTools(): Promise<Map<string, MCPTool[]>> {
    const result = new Map<string, MCPTool[]>();

    for (const [name, entry] of Array.from(this.servers.entries())) {
      if (entry.connected) {
        try {
          entry.tools = await entry.client.listTools();
        } catch (error) {
          entry.lastError = (error as Error).message;
        }
      }
      result.set(name, entry.tools);
    }

    return result;
  }

  /**
   * List all resources from all servers
   */
  async listAllResources(): Promise<Map<string, MCPResource[]>> {
    const result = new Map<string, MCPResource[]>();

    for (const [name, entry] of Array.from(this.servers.entries())) {
      if (entry.connected) {
        try {
          entry.resources = await entry.client.listResources();
        } catch (error) {
          entry.lastError = (error as Error).message;
        }
      }
      result.set(name, entry.resources);
    }

    return result;
  }

  /**
   * List all prompts from all servers
   */
  async listAllPrompts(): Promise<Map<string, MCPPrompt[]>> {
    const result = new Map<string, MCPPrompt[]>();

    for (const [name, entry] of Array.from(this.servers.entries())) {
      if (entry.connected) {
        try {
          entry.prompts = await entry.client.listPrompts();
        } catch (error) {
          entry.lastError = (error as Error).message;
        }
      }
      result.set(name, entry.prompts);
    }

    return result;
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const entry = this.servers.get(serverName);
    if (!entry) {
      throw new Error(`Server not found: ${serverName}`);
    }

    if (!entry.connected) {
      throw new Error(`Server not connected: ${serverName}`);
    }

    return await entry.client.callTool(toolName, args);
  }

  /**
   * Read a resource from a specific server
   */
  async readResource(serverName: string, uri: string): Promise<unknown> {
    const entry = this.servers.get(serverName);
    if (!entry) {
      throw new Error(`Server not found: ${serverName}`);
    }

    if (!entry.connected) {
      throw new Error(`Server not connected: ${serverName}`);
    }

    return await entry.client.readResource(uri);
  }

  /**
   * Get a prompt from a specific server
   */
  async getPrompt(
    serverName: string,
    promptName: string,
    args?: Record<string, unknown>
  ): Promise<unknown> {
    const entry = this.servers.get(serverName);
    if (!entry) {
      throw new Error(`Server not found: ${serverName}`);
    }

    if (!entry.connected) {
      throw new Error(`Server not connected: ${serverName}`);
    }

    return await entry.client.getPrompt(promptName, args);
  }

  /**
   * Find a tool by name across all servers
   */
  findTool(toolName: string): { server: string; tool: MCPTool } | null {
    for (const [name, entry] of Array.from(this.servers.entries())) {
      const tool = entry.tools.find((t) => t.name === toolName);
      if (tool) {
        return { server: name, tool };
      }
    }
    return null;
  }

  /**
   * Find a resource by URI across all servers
   */
  findResource(uri: string): { server: string; resource: MCPResource } | null {
    for (const [name, entry] of Array.from(this.servers.entries())) {
      const resource = entry.resources.find((r) => r.uri === uri);
      if (resource) {
        return { server: name, resource };
      }
    }
    return null;
  }

  /**
   * Start auto-refresh of tools and resources
   */
  startAutoRefresh(): void {
    if (this.refreshTimer) return;

    this.refreshTimer = setInterval(async () => {
      await this.refreshAll();
    }, this.options.refreshInterval);
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Refresh all servers
   */
  async refreshAll(): Promise<void> {
    for (const [name, entry] of Array.from(this.servers.entries())) {
      if (entry.connected) {
        try {
          await this.discoverServerCapabilities(entry);
        } catch (error) {
          entry.lastError = (error as Error).message;
        }
      }
    }
  }

  /**
   * Reconnect all disconnected servers
   */
  async reconnectAll(): Promise<void> {
    for (const [name, entry] of Array.from(this.servers.entries())) {
      if (!entry.connected) {
        try {
          await this.reconnectServer(name);
        } catch (error) {
          entry.lastError = (error as Error).message;
        }
      }
    }
  }

  /**
   * Reconnect a specific server
   */
  async reconnectServer(name: string): Promise<void> {
    const entry = this.servers.get(name);
    if (!entry) {
      throw new Error(`Server not found: ${name}`);
    }

    // Disconnect existing client
    entry.client.disconnect();

    // Create new client
    const client = new MCPClientImpl(this.options.clientOptions);
    
    // Set up event handlers
    client.on('connected', () => {
      entry.connected = true;
      entry.lastConnected = new Date();
      entry.lastError = undefined;
      this.emit('server:connected', name);
    });

    client.on('disconnected', () => {
      entry.connected = false;
      this.emit('server:disconnected', name);
    });

    // Connect
    await client.connect(entry.config);
    entry.client = client;
    entry.connected = true;
    entry.serverInfo = client.getServerInfo() ?? undefined;

    // Discover capabilities
    await this.discoverServerCapabilities(entry);
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    connected: number;
    disconnected: number;
    totalTools: number;
    totalResources: number;
    totalPrompts: number;
  } {
    const entries = Array.from(this.servers.values());
    return {
      total: entries.length,
      connected: entries.filter((e) => e.connected).length,
      disconnected: entries.filter((e) => !e.connected).length,
      totalTools: entries.reduce((sum, e) => sum + e.tools.length, 0),
      totalResources: entries.reduce((sum, e) => sum + e.resources.length, 0),
      totalPrompts: entries.reduce((sum, e) => sum + e.prompts.length, 0),
    };
  }

  /**
   * Clear all servers
   */
  async clear(): Promise<void> {
    this.stopAutoRefresh();

    for (const entry of Array.from(this.servers.values())) {
      entry.client.disconnect();
    }

    this.servers.clear();
    this.emit('cleared');
  }

  /**
   * Discover server capabilities
   */
  private async discoverServerCapabilities(entry: ServerEntry): Promise<void> {
    // Discover tools
    try {
      entry.tools = await entry.client.listTools();
    } catch {
      entry.tools = entry.client.getCachedTools();
    }

    // Discover resources
    try {
      entry.resources = await entry.client.listResources();
    } catch {
      entry.resources = entry.client.getCachedResources();
    }

    // Discover prompts
    try {
      entry.prompts = await entry.client.listPrompts();
    } catch {
      entry.prompts = entry.client.getCachedPrompts();
    }
  }
}
