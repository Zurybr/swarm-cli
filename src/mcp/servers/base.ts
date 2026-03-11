/**
 * Base server implementation for MCP servers
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import type { ServerConfig, ServerTool, ToolResult } from './types.js';

export interface BaseServerOptions {
  config: ServerConfig;
  tools: ServerTool[];
  resources?: {
    list: () => Promise<{ resources: Array<{ uri: string; name: string; description?: string }> }>;
    read: (uri: string) => Promise<{ contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }> }>;
  };
}

/**
 * Creates and configures an MCP server with tools and optional resources
 */
export function createServer(options: BaseServerOptions): Server {
  const { config, tools, resources } = options;

  const server = new Server(
    {
      name: config.name,
      version: config.version,
    },
    {
      capabilities: {
        tools: {},
        ...(resources ? { resources: {} } : {}),
      },
    }
  );

  // Register tools list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((tool) => ({
        name: tool.definition.name,
        description: tool.definition.description,
        inputSchema: tool.definition.inputSchema,
      })),
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<ToolResult> => {
    const { name, arguments: args } = request.params;

    const tool = tools.find((t) => t.definition.name === name);
    if (!tool) {
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      return await tool.handler(args || {});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error executing ${name}: ${errorMessage}` }],
        isError: true,
      };
    }
  });

  // Register resources handlers if provided
  if (resources) {
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return resources.list();
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      return resources.read(request.params.uri);
    });
  }

  return server;
}

/**
 * Starts a server with stdio transport
 */
export async function startServer(server: Server): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

/**
 * Creates and starts a server (convenience function)
 */
export async function runServer(options: BaseServerOptions): Promise<void> {
  const server = createServer(options);
  await startServer(server);
}
