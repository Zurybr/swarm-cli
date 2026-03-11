/**
 * Stdio Transport - Issue #24.1
 * Transport implementation for stdio-based MCP servers
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import {
  MCPTransport,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
  MCPServerConfig,
  MCPConnectionError,
  MCPTimeoutError,
} from '../types';

export interface StdioTransportOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Buffer size for reading data */
  bufferSize?: number;
  /** Debug mode - log all messages */
  debug?: boolean;
}

/**
 * Stdio transport for MCP servers that communicate via stdin/stdout
 */
export class StdioTransport extends EventEmitter implements MCPTransport {
  private process: ChildProcess | null = null;
  private config: MCPServerConfig;
  private options: Required<StdioTransportOptions>;
  private buffer: string = '';
  private messageId = 0;
  private pendingRequests: Map<number, {
    resolve: (response: JSONRPCResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(config: MCPServerConfig, options: StdioTransportOptions = {}) {
    super();
    this.config = config;
    this.options = {
      timeout: options.timeout ?? 30000,
      bufferSize: options.bufferSize ?? 1024 * 1024, // 1MB
      debug: options.debug ?? false,
    };
  }

  /**
   * Connect to the MCP server by spawning a child process
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Merge environment variables
        const env = {
          ...process.env,
          ...this.config.env,
        };

        // Spawn the MCP server process
        this.process = spawn(this.config.command, this.config.args, {
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });

        // Handle process errors
        this.process.on('error', (error) => {
          const mcpError = new MCPConnectionError(
            `Failed to spawn MCP server: ${error.message}`
          );
          this.emit('error', mcpError);
          reject(mcpError);
        });

        // Handle process exit
        this.process.on('exit', (code, signal) => {
          this.emit('disconnect', { code, signal });
          this.cleanup();
        });

        // Handle stdout - this is where JSON-RPC responses come
        this.process.stdout?.on('data', (data: Buffer) => {
          this.handleData(data);
        });

        // Handle stderr - log for debugging
        this.process.stderr?.on('data', (data: Buffer) => {
          const message = data.toString().trim();
          if (message && this.options.debug) {
            console.error(`[MCP ${this.config.name} stderr]:`, message);
          }
          this.emit('stderr', message);
        });

        // Wait a brief moment for process to start
        setImmediate(() => {
          if (this.process && !this.process.killed) {
            resolve();
          }
        });

      } catch (error) {
        reject(new MCPConnectionError(
          `Failed to connect: ${(error as Error).message}`
        ));
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.cleanup();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Send a JSON-RPC request
   */
  async send(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new MCPConnectionError('Not connected to MCP server'));
        return;
      }

      const id = request.id;

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new MCPTimeoutError(
          `Request timeout after ${this.options.timeout}ms: ${request.method}`
        ));
      }, this.options.timeout);

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send the request
      const message = JSON.stringify(request) + '\n';
      
      if (this.options.debug) {
        console.log(`[MCP ${this.config.name} ->]:`, message.trim());
      }

      this.process.stdin.write(message, (error) => {
        if (error) {
          this.pendingRequests.delete(id);
          clearTimeout(timeout);
          reject(new MCPConnectionError(`Write error: ${error.message}`));
        }
      });
    });
  }

  /**
   * Register notification handler
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
   * Handle incoming data from stdout
   */
  private handleData(data: Buffer): void {
    // Append to buffer
    this.buffer += data.toString();

    // Process complete messages (newline-delimited JSON)
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line) {
        this.processMessage(line);
      }
    }

    // Prevent buffer overflow
    if (this.buffer.length > this.options.bufferSize) {
      this.emit('error', new Error('Buffer overflow'));
      this.buffer = '';
    }
  }

  /**
   * Process a single JSON-RPC message
   */
  private processMessage(line: string): void {
    if (this.options.debug) {
      console.log(`[MCP ${this.config.name} <-]:`, line);
    }

    try {
      const message = JSON.parse(line);

      // Check if it's a response
      if ('id' in message && typeof message.id === 'number') {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id);

          if (message.error) {
            pending.reject(new Error(message.error.message));
          } else {
            pending.resolve(message as JSONRPCResponse);
          }
        }
      }
      // Check if it's a notification
      else if ('method' in message && !('id' in message)) {
        this.emit('notification', message as JSONRPCNotification);
      }
    } catch (error) {
      if (this.options.debug) {
        console.error(`[MCP ${this.config.name}] Failed to parse message:`, line);
      }
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    // Clear pending requests
    for (const [id, pending] of Array.from(this.pendingRequests.entries())) {
      clearTimeout(pending.timeout);
      pending.reject(new MCPConnectionError('Connection closed'));
    }
    this.pendingRequests.clear();

    // Kill process
    if (this.process) {
      try {
        this.process.kill('SIGTERM');
      } catch {
        // Ignore errors during cleanup
      }
      this.process = null;
    }

    // Clear buffer
    this.buffer = '';
  }
}
