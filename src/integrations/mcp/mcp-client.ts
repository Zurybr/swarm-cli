/**
 * MCP Client - Issue #24
 * Cliente para Model Context Protocol
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { 
  MCPClient, 
  MCPServerConfig, 
  MCPTool, 
  MCPResult, 
  MCPResource, 
  MCPResourceContent 
} from '../../types';

interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: { code: number; message: string };
}

export class MCPClientImpl extends EventEmitter implements MCPClient {
  private process: ChildProcess | null = null;
  private messageId = 0;
  private pendingRequests: Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }> = new Map();
  private serverConfig: MCPServerConfig | null = null;
  private tools: MCPTool[] = [];
  private resources: MCPResource[] = [];
  
  /**
   * Conecta a un servidor MCP
   */
  async connect(server: MCPServerConfig): Promise<void> {
    this.serverConfig = server;
    
    // Spawn proceso hijo
    this.process = spawn(server.command, server.args, {
      env: { ...process.env, ...server.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Manejar stdout
    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleData(data);
    });
    
    // Manejar stderr
    this.process.stderr?.on('data', (data: Buffer) => {
      console.error(`[MCP ${server.name} stderr]:`, data.toString());
    });
    
    // Manejar cierre
    this.process.on('close', (code) => {
      this.emit('disconnect', code);
    });
    
    // Inicializar
    await this.initialize();
  }
  
  /**
   * Desconecta del servidor
   */
  disconnect(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.pendingRequests.clear();
  }
  
  /**
   * Inicializa la conexión MCP
   */
  private async initialize(): Promise<void> {
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'swarm-cli',
        version: '0.1.0'
      }
    });
  }
  
  /**
   * Lista herramientas disponibles
   */
  async listTools(): Promise<MCPTool[]> {
    const response = await this.sendRequest('tools/list', {});
    this.tools = response.tools || [];
    return this.tools;
  }
  
  /**
   * Llama a una herramienta
   */
  async callTool(name: string, args: any): Promise<MCPResult> {
    return await this.sendRequest('tools/call', {
      name,
      arguments: args
    });
  }
  
  /**
   * Lista recursos disponibles
   */
  async listResources(): Promise<MCPResource[]> {
    const response = await this.sendRequest('resources/list', {});
    this.resources = response.resources || [];
    return this.resources;
  }
  
  /**
   * Lee un recurso
   */
  async readResource(uri: string): Promise<MCPResourceContent> {
    return await this.sendRequest('resources/read', { uri });
  }
  
  /**
   * Envía una request JSON-RPC
   */
  private sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('Not connected to MCP server'));
        return;
      }
      
      const id = ++this.messageId;
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };
      
      this.pendingRequests.set(id, { resolve, reject });
      
      // Timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
      
      // Enviar
      this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }
  
  /**
   * Maneja datos recibidos del servidor
   */
  private handleData(data: Buffer): void {
    const lines = data.toString().split('\n').filter(Boolean);
    
    for (const line of lines) {
      try {
        const message: JSONRPCResponse = JSON.parse(line);
        
        if (message.id !== undefined) {
          const pending = this.pendingRequests.get(message.id);
          if (pending) {
            this.pendingRequests.delete(message.id);
            
            if (message.error) {
              pending.reject(new Error(message.error.message));
            } else {
              pending.resolve(message.result);
            }
          }
        }
      } catch {
        // Ignorar mensajes inválidos
      }
    }
  }
  
  /**
   * Obtiene herramientas cacheadas
   */
  getCachedTools(): MCPTool[] {
    return [...this.tools];
  }
  
  /**
   * Obtiene recursos cacheados
   */
  getCachedResources(): MCPResource[] {
    return [...this.resources];
  }
  
  /**
   * Verifica si está conectado
   */
  isConnected(): boolean {
    return this.process !== null && !this.process.killed;
  }
}
