/**
 * MCP Server Manager - Issue #24
 * Gestión de múltiples servidores MCP
 */

import { MCPClientImpl } from './mcp-client';
import { MCPServerConfig, MCPClient, MCPTool, MCPResource } from '../../types';

interface ServerEntry {
  config: MCPServerConfig;
  client: MCPClientImpl;
  tools: MCPTool[];
  resources: MCPResource[];
  connected: boolean;
  lastError?: string;
}

export class MCPServerManager {
  private servers: Map<string, ServerEntry> = new Map();
  private autoRefresh: boolean = true;
  private refreshInterval: number = 60000; // 1 minuto
  private refreshTimer: NodeJS.Timeout | null = null;
  
  constructor(autoRefresh: boolean = true) {
    this.autoRefresh = autoRefresh;
  }
  
  /**
   * Agrega y conecta un servidor MCP
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    const client = new MCPClientImpl();
    
    const entry: ServerEntry = {
      config,
      client,
      tools: [],
      resources: [],
      connected: false
    };
    
    try {
      await client.connect(config);
      entry.connected = true;
      
      // Obtener herramientas y recursos
      entry.tools = await client.listTools();
      entry.resources = await client.listResources();
      
      // Setup event handlers
      client.on('disconnect', () => {
        entry.connected = false;
      });
      
    } catch (error) {
      entry.lastError = (error as Error).message;
      entry.connected = false;
    }
    
    this.servers.set(config.name, entry);
  }
  
  /**
   * Remueve un servidor
   */
  async removeServer(name: string): Promise<void> {
    const entry = this.servers.get(name);
    if (entry) {
      entry.client.disconnect();
      this.servers.delete(name);
    }
  }
  
  /**
   * Lista todos los servidores
   */
  listServers(): Array<{ name: string; connected: boolean; toolCount: number; resourceCount: number }> {
    return Array.from(this.servers.entries()).map(([name, entry]) => ({
      name,
      connected: entry.connected,
      toolCount: entry.tools.length,
      resourceCount: entry.resources.length
    }));
  }
  
  /**
   * Lista todas las herramientas de todos los servidores
   */
  async listAllTools(): Promise<Map<string, MCPTool[]>> {
    const result = new Map<string, MCPTool[]>();
    
    for (const [name, entry] of this.servers) {
      if (entry.connected) {
        try {
          // Refrescar cache
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
   * Lista todos los recursos de todos los servidores
   */
  async listAllResources(): Promise<Map<string, MCPResource[]>> {
    const result = new Map<string, MCPResource[]>();
    
    for (const [name, entry] of this.servers) {
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
   * Llama a una herramienta
   */
  async callTool(serverName: string, toolName: string, args: any): Promise<any> {
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
   * Lee un recurso
   */
  async readResource(serverName: string, uri: string): Promise<any> {
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
   * Busca una herramienta por nombre en todos los servidores
   */
  async findTool(toolName: string): Promise<{ server: string; tool: MCPTool } | null> {
    for (const [name, entry] of this.servers) {
      const tool = entry.tools.find(t => t.name === toolName);
      if (tool) {
        return { server: name, tool };
      }
    }
    return null;
  }
  
  /**
   * Inicia auto-refresh de herramientas y recursos
   */
  startAutoRefresh(): void {
    if (this.refreshTimer) return;
    
    this.refreshTimer = setInterval(async () => {
      for (const [name, entry] of this.servers) {
        if (entry.connected) {
          try {
            entry.tools = await entry.client.listTools();
            entry.resources = await entry.client.listResources();
          } catch (error) {
            entry.lastError = (error as Error).message;
          }
        }
      }
    }, this.refreshInterval);
  }
  
  /**
   * Detiene auto-refresh
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
  
  /**
   * Reconecta todos los servidores desconectados
   */
  async reconnectAll(): Promise<void> {
    for (const [name, entry] of this.servers) {
      if (!entry.connected) {
        try {
          const client = new MCPClientImpl();
          await client.connect(entry.config);
          entry.client = client;
          entry.connected = true;
          entry.tools = await client.listTools();
          entry.resources = await client.listResources();
          entry.lastError = undefined;
        } catch (error) {
          entry.lastError = (error as Error).message;
        }
      }
    }
  }
  
  /**
   * Obtiene estadísticas
   */
  getStats(): {
    total: number;
    connected: number;
    disconnected: number;
    totalTools: number;
    totalResources: number;
  } {
    const entries = Array.from(this.servers.values());
    return {
      total: entries.length,
      connected: entries.filter(e => e.connected).length,
      disconnected: entries.filter(e => !e.connected).length,
      totalTools: entries.reduce((sum, e) => sum + e.tools.length, 0),
      totalResources: entries.reduce((sum, e) => sum + e.resources.length, 0)
    };
  }
  
  /**
   * Limpia todos los servidores
   */
  async clear(): Promise<void> {
    this.stopAutoRefresh();
    
    for (const entry of this.servers.values()) {
      entry.client.disconnect();
    }
    
    this.servers.clear();
  }
}
