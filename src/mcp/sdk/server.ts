/**
 * MCP Server Builder - Issue #24.6
 * High-level SDK for building custom MCP servers
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { EventEmitter } from 'events';
import {
  MCPServerOptions,
  MCPCapabilities,
  MCPToolHandler,
  MCPResourceHandler,
  MCPPromptHandler,
  MCPToolResult,
  MCPResourceContent,
  MCPPromptResult,
  MCPToolExecutionError,
  MCPServerEvents,
} from './types.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('MCPSDK');

/**
 * High-level builder for creating MCP servers
 * 
 * @example
 * ```typescript
 * const server = new MCPServerBuilder({
 *   name: 'my-server',
 *   version: '1.0.0',
 * });
 * 
 * server.addTool({
 *   name: 'greet',
 *   description: 'Greet someone',
 *   inputSchema: { type: 'object', properties: { name: { type: 'string' } } },
 *   handler: async ({ name }) => ({
 *     content: [{ type: 'text', text: `Hello, ${name}!` }],
 *   }),
 * });
 * 
 * await server.start();
 * ```
 */
export class MCPServerBuilder extends EventEmitter {
  private tools: Map<string, MCPToolHandler> = new Map();
  private resources: Map<string, MCPResourceHandler> = new Map();
  private prompts: Map<string, MCPPromptHandler> = new Map();
  private server: Server | null = null;
  private running = false;

  constructor(private options: MCPServerOptions) {
    super();
  }

  /**
   * Add a tool to the server
   */
  addTool(tool: MCPToolHandler): this {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool "${tool.name}" already exists, overwriting`);
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  /**
   * Add multiple tools to the server
   */
  addTools(tools: MCPToolHandler[]): this {
    tools.forEach(tool => this.addTool(tool));
    return this;
  }

  /**
   * Remove a tool from the server
   */
  removeTool(name: string): this {
    this.tools.delete(name);
    return this;
  }

  /**
   * Add a resource to the server
   */
  addResource(resource: MCPResourceHandler): this {
    if (this.resources.has(resource.uri)) {
      logger.warn(`Resource "${resource.uri}" already exists, overwriting`);
    }
    this.resources.set(resource.uri, resource);
    return this;
  }

  /**
   * Add multiple resources to the server
   */
  addResources(resources: MCPResourceHandler[]): this {
    resources.forEach(resource => this.addResource(resource));
    return this;
  }

  /**
   * Remove a resource from the server
   */
  removeResource(uri: string): this {
    this.resources.delete(uri);
    return this;
  }

  /**
   * Add a prompt to the server
   */
  addPrompt(prompt: MCPPromptHandler): this {
    if (this.prompts.has(prompt.name)) {
      logger.warn(`Prompt "${prompt.name}" already exists, overwriting`);
    }
    this.prompts.set(prompt.name, prompt);
    return this;
  }

  /**
   * Add multiple prompts to the server
   */
  addPrompts(prompts: MCPPromptHandler[]): this {
    prompts.forEach(prompt => this.addPrompt(prompt));
    return this;
  }

  /**
   * Remove a prompt from the server
   */
  removePrompt(name: string): this {
    this.prompts.delete(name);
    return this;
  }

  /**
   * Get server capabilities based on registered items
   */
  private getCapabilities(): MCPCapabilities {
    const capabilities: MCPCapabilities = {};

    if (this.tools.size > 0) {
      capabilities.tools = { listChanged: true };
    }

    if (this.resources.size > 0) {
      capabilities.resources = { subscribe: false, listChanged: true };
    }

    if (this.prompts.size > 0) {
      capabilities.prompts = { listChanged: true };
    }

    return { ...capabilities, ...this.options.capabilities };
  }

  /**
   * Create the MCP server instance
   */
  private createServer(): Server {
    const server = new Server(
      {
        name: this.options.name,
        version: this.options.version,
      },
      {
        capabilities: this.getCapabilities(),
      }
    );

    // Set up request handlers
    this.setupHandlers(server);

    return server;
  }

  /**
   * Set up MCP request handlers
   */
  private setupHandlers(server: Server): void {
    // Tools handlers
    if (this.tools.size > 0) {
      server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
          tools: Array.from(this.tools.values()).map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        };
      });

      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const tool = this.tools.get(name);

        if (!tool) {
          throw new MCPToolExecutionError(name, new Error(`Tool not found: ${name}`));
        }

        this.emit('tool:call', name, args || {});

        try {
          const result = await tool.handler(args || {});
          this.emit('tool:result', name, result);
          return result as unknown as import('@modelcontextprotocol/sdk/types.js').ServerResult;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.emit('tool:error', name, err);
          throw new MCPToolExecutionError(name, err);
        }
      });
    }

    // Resources handlers
    if (this.resources.size > 0) {
      server.setRequestHandler(ListResourcesRequestSchema, async () => {
        return {
          resources: Array.from(this.resources.values()).map(resource => ({
            uri: resource.uri,
            name: resource.name,
            description: resource.description,
            mimeType: resource.mimeType,
          })),
        };
      });

      server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const { uri } = request.params;
        const resource = this.resources.get(uri);

        if (!resource) {
          throw new Error(`Resource not found: ${uri}`);
        }

        this.emit('resource:read', uri);

        const content = await resource.handler();
        return { contents: [content] };
      });
    }

    // Prompts handlers
    if (this.prompts.size > 0) {
      server.setRequestHandler(ListPromptsRequestSchema, async () => {
        return {
          prompts: Array.from(this.prompts.values()).map(prompt => ({
            name: prompt.name,
            description: prompt.description,
            arguments: prompt.arguments,
          })),
        };
      });

      server.setRequestHandler(GetPromptRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const prompt = this.prompts.get(name);

        if (!prompt) {
          throw new Error(`Prompt not found: ${name}`);
        }

        this.emit('prompt:get', name, args);

        const result = await prompt.handler(args);
        return result as unknown as import('@modelcontextprotocol/sdk/types.js').ServerResult;
      });
    }
  }

  /**
   * Start the MCP server
   * @param transport - Optional transport (defaults to stdio)
   */
  async start(transport?: StdioServerTransport): Promise<void> {
    if (this.running) {
      throw new Error('Server is already running');
    }

    this.server = this.createServer();
    const actualTransport = transport || new StdioServerTransport();

    await this.server.connect(actualTransport);
    this.running = true;

    this.emit('server:start');
    logger.info(`MCP server "${this.options.name}" started`);

    // Handle graceful shutdown
    const shutdown = async () => {
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (!this.running || !this.server) {
      return;
    }

    await this.server.close();
    this.running = false;
    this.server = null;

    this.emit('server:stop');
    logger.info(`MCP server "${this.options.name}" stopped`);
  }

  /**
   * Check if the server is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get server info
   */
  getInfo(): { name: string; version: string; description?: string } {
    return {
      name: this.options.name,
      version: this.options.version,
      description: this.options.description,
    };
  }

  /**
   * Get registered tools
   */
  getTools(): MCPToolHandler[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get registered resources
   */
  getResources(): MCPResourceHandler[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get registered prompts
   */
  getPrompts(): MCPPromptHandler[] {
    return Array.from(this.prompts.values());
  }

  /**
   * Get server statistics
   */
  getStats(): {
    tools: number;
    resources: number;
    prompts: number;
    running: boolean;
  } {
    return {
      tools: this.tools.size,
      resources: this.resources.size,
      prompts: this.prompts.size,
      running: this.running,
    };
  }
}

// Re-export event types for TypeScript users
export type { MCPServerEvents };
