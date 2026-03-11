/**
 * HTTP/SSE Transport - Issue #24.1
 * Transport implementation for HTTP and Server-Sent Events based MCP servers
 */

import { EventEmitter } from 'events';
import * as http from 'http';
import * as https from 'https';
import {
  MCPTransport,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
  MCPServerConfig,
  MCPConnectionError,
  MCPTimeoutError,
} from '../types';

export interface HTTPTransportOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Use Server-Sent Events for streaming */
  useSSE?: boolean;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Debug mode */
  debug?: boolean;
}

/**
 * HTTP/SSE transport for MCP servers that communicate via HTTP
 */
export class HTTPTransport extends EventEmitter implements MCPTransport {
  private config: MCPServerConfig;
  private options: Required<HTTPTransportOptions>;
  private messageId = 0;
  private sseConnection: http.ClientRequest | null = null;
  private connected = false;

  constructor(config: MCPServerConfig, options: HTTPTransportOptions = {}) {
    super();
    this.config = config;
    this.options = {
      timeout: options.timeout ?? 30000,
      useSSE: options.useSSE ?? true,
      headers: options.headers ?? {},
      debug: options.debug ?? false,
    };
  }

  /**
   * Connect to the MCP server
   * For HTTP, this establishes SSE connection if enabled
   */
  async connect(): Promise<void> {
    if (!this.config.url) {
      throw new MCPConnectionError('URL is required for HTTP transport');
    }

    if (this.options.useSSE) {
      await this.connectSSE();
    } else {
      // Simple HTTP - just verify the endpoint is reachable
      await this.verifyEndpoint();
    }

    this.connected = true;
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.sseConnection) {
      this.sseConnection.destroy();
      this.sseConnection = null;
    }
    this.connected = false;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Send a JSON-RPC request
   */
  async send(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    return new Promise((resolve, reject) => {
      if (!this.config.url) {
        reject(new MCPConnectionError('URL not configured'));
        return;
      }

      const url = new URL(this.config.url);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const body = JSON.stringify(request);

      if (this.options.debug) {
        console.log(`[MCP HTTP ->]:`, body);
      }

      const requestOptions: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...this.options.headers,
        },
        timeout: this.options.timeout,
      };

      const req = client.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (this.options.debug) {
            console.log(`[MCP HTTP <-]:`, data);
          }

          if (res.statusCode && res.statusCode >= 400) {
            reject(new MCPConnectionError(
              `HTTP error ${res.statusCode}: ${data}`
            ));
            return;
          }

          try {
            const response = JSON.parse(data) as JSONRPCResponse;
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response);
            }
          } catch (error) {
            reject(new MCPConnectionError(
              `Invalid JSON response: ${(error as Error).message}`
            ));
          }
        });
      });

      req.on('error', (error) => {
        reject(new MCPConnectionError(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new MCPTimeoutError(
          `Request timeout after ${this.options.timeout}ms`
        ));
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Register notification handler (for SSE mode)
   */
  onNotification(handler: (notification: JSONRPCNotification) => void): void {
    this.on('notification', handler);
  }

  /**
   * Get next message ID
   */
  getNextId(): number {
    return ++this.messageId;
  }

  /**
   * Connect via Server-Sent Events
   */
  private async connectSSE(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config.url) {
        reject(new MCPConnectionError('URL not configured'));
        return;
      }

      const url = new URL(this.config.url);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const requestOptions: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...this.options.headers,
        },
      };

      const req = client.request(requestOptions, (res) => {
        if (res.statusCode !== 200) {
          reject(new MCPConnectionError(
            `SSE connection failed: HTTP ${res.statusCode}`
          ));
          return;
        }

        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk.toString();
          this.processSSEData(buffer);
          buffer = ''; // Clear after processing
        });

        res.on('end', () => {
          this.connected = false;
          this.emit('disconnect');
        });

        // Connection established
        this.sseConnection = req;
        resolve();
      });

      req.on('error', (error) => {
        reject(new MCPConnectionError(`SSE connection failed: ${error.message}`));
      });

      req.end();
    });
  }

  /**
   * Verify HTTP endpoint is reachable
   */
  private async verifyEndpoint(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config.url) {
        reject(new MCPConnectionError('URL not configured'));
        return;
      }

      const url = new URL(this.config.url);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const requestOptions: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'HEAD',
        timeout: this.options.timeout,
      };

      const req = client.request(requestOptions, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          reject(new MCPConnectionError(
            `Endpoint check failed: HTTP ${res.statusCode}`
          ));
        }
      });

      req.on('error', (error) => {
        reject(new MCPConnectionError(`Endpoint check failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new MCPTimeoutError('Endpoint check timeout'));
      });

      req.end();
    });
  }

  /**
   * Process SSE data
   */
  private processSSEData(data: string): void {
    const lines = data.split('\n');
    let eventType = '';
    let eventData = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        eventData += line.slice(5).trim();
      } else if (line === '' && eventData) {
        // Empty line signals end of event
        this.handleSSEEvent(eventType, eventData);
        eventType = '';
        eventData = '';
      }
    }
  }

  /**
   * Handle SSE event
   */
  private handleSSEEvent(type: string, data: string): void {
    if (this.options.debug) {
      console.log(`[MCP SSE event]:`, type, data);
    }

    try {
      const message = JSON.parse(data);

      // Check if it's a notification
      if ('method' in message && !('id' in message)) {
        this.emit('notification', message as JSONRPCNotification);
      }
    } catch {
      // Ignore invalid JSON
    }
  }
}
