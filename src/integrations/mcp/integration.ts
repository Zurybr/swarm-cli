/**
 * MCP Tool Integration - Issue #24.2
 * Register MCP tools in Swarm CLI tool registry
 */

import { MCPClient, MCPTool, MCPToolResult, MCPToolRegistration, MCPIntegrationOptions } from './types';
import { SkillMetadata } from '../../skills/types/skill';

/**
 * Tool Registry Interface
 * This is the interface that Swarm CLI uses for tool registration
 */
export interface ToolRegistry {
  register(tool: ToolDefinition): void;
  unregister(name: string): void;
  get(name: string): ToolDefinition | undefined;
  getAll(): ToolDefinition[];
  has(name: string): boolean;
}

/**
 * Tool Definition for Swarm CLI
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
  metadata?: Record<string, unknown>;
}

/**
 * Tool Result for Swarm CLI
 */
export interface ToolResult {
  success: boolean;
  content: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * In-memory tool registry implementation
 */
export class InMemoryToolRegistry implements ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}

/**
 * Default integration options
 */
const DEFAULT_OPTIONS: Required<MCPIntegrationOptions> = {
  toolPrefix: 'mcp',
  autoDiscover: true,
  cacheTools: true,
};

/**
 * Register MCP tools in Swarm tool registry
 */
export function registerMCPTools(
  mcpClient: MCPClient,
  serverName: string,
  toolRegistry: ToolRegistry,
  options: MCPIntegrationOptions = {}
): MCPToolRegistration[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const registrations: MCPToolRegistration[] = [];

  // Get tools from client (synchronously if cached, or async)
  const tools = (mcpClient as any).getCachedTools?.() || [];
  
  for (const tool of tools) {
    const registration = registerSingleTool(
      mcpClient,
      serverName,
      tool,
      toolRegistry,
      opts.toolPrefix
    );
    registrations.push(registration);
  }

  return registrations;
}

/**
 * Register MCP tools asynchronously (discovers tools first)
 */
export async function registerMCPToolsAsync(
  mcpClient: MCPClient,
  serverName: string,
  toolRegistry: ToolRegistry,
  options: MCPIntegrationOptions = {}
): Promise<MCPToolRegistration[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Discover tools
  const tools = await mcpClient.listTools();

  const registrations: MCPToolRegistration[] = [];
  
  for (const tool of tools) {
    const registration = registerSingleTool(
      mcpClient,
      serverName,
      tool,
      toolRegistry,
      opts.toolPrefix
    );
    registrations.push(registration);
  }

  return registrations;
}

/**
 * Register a single MCP tool
 */
function registerSingleTool(
  mcpClient: MCPClient,
  serverName: string,
  tool: MCPTool,
  toolRegistry: ToolRegistry,
  prefix: string
): MCPToolRegistration {
  const fullName = `${prefix}:${serverName}:${tool.name}`;

  // Create handler wrapper
  const handler = async (args: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const result = await mcpClient.callTool(tool.name, args);
      return formatToolResult(result);
    } catch (error) {
      return {
        success: false,
        content: '',
        error: (error as Error).message,
      };
    }
  };

  // Map MCP input schema to tool parameters
  const parameters = mapInputSchemaToParameters(tool.inputSchema);

  // Create tool definition
  const toolDefinition: ToolDefinition = {
    name: fullName,
    description: tool.description,
    parameters,
    handler,
    metadata: {
      source: 'mcp',
      serverName,
      originalName: tool.name,
    },
  };

  // Register in tool registry
  toolRegistry.register(toolDefinition);

  return {
    fullName,
    tool,
    serverName,
    handler,
  };
}

/**
 * Unregister MCP tools from a server
 */
export function unregisterMCPTools(
  serverName: string,
  toolRegistry: ToolRegistry,
  prefix: string = 'mcp'
): number {
  const prefixStr = `${prefix}:${serverName}:`;
  let count = 0;

  // Find and remove all tools from this server
  const tools = toolRegistry.getAll();
  for (const tool of tools) {
    if (tool.name.startsWith(prefixStr)) {
      toolRegistry.unregister(tool.name);
      count++;
    }
  }

  return count;
}

/**
 * Format MCP tool result for Swarm CLI
 */
export function formatToolResult(result: MCPToolResult): ToolResult {
  if (result.isError) {
    return {
      success: false,
      content: extractTextContent(result.content),
      error: 'MCP tool returned an error',
    };
  }

  return {
    success: true,
    content: extractTextContent(result.content),
  };
}

/**
 * Extract text content from MCP content array
 */
function extractTextContent(content: MCPToolResult['content']): string {
  return content
    .map((item) => {
      if (item.type === 'text' && item.text) {
        return item.text;
      }
      if (item.type === 'image' && item.data) {
        return `[Image: ${item.mimeType || 'unknown'}]`;
      }
      if (item.type === 'resource' && item.resource) {
        return `[Resource: ${item.resource.uri}]`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Map MCP input schema to Swarm tool parameters
 */
export function mapInputSchemaToParameters(
  inputSchema: MCPTool['inputSchema']
): Record<string, unknown> {
  return {
    type: 'object',
    properties: inputSchema.properties || {},
    required: inputSchema.required || [],
  };
}

/**
 * Convert MCP tool to SkillMetadata for skill registry
 */
export function mcpToolToSkillMetadata(
  tool: MCPTool,
  serverName: string,
  prefix: string = 'mcp'
): SkillMetadata {
  return {
    name: `${prefix}:${serverName}:${tool.name}`,
    description: tool.description,
    version: '1.0.0',
    category: 'general',
    tags: ['mcp', serverName],
    schema: {
      input: tool.inputSchema as unknown as Record<string, unknown>,
      output: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          content: { type: 'string' },
          error: { type: 'string' },
        },
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * List all registered MCP tools
 */
export function listMCPTools(
  toolRegistry: ToolRegistry,
  prefix: string = 'mcp'
): ToolDefinition[] {
  return toolRegistry
    .getAll()
    .filter((tool) => tool.name.startsWith(`${prefix}:`));
}

/**
 * Check if a tool is an MCP tool
 */
export function isMCPTool(
  toolName: string,
  prefix: string = 'mcp'
): boolean {
  return toolName.startsWith(`${prefix}:`);
}

/**
 * Parse MCP tool name into components
 */
export function parseMCPToolName(
  toolName: string,
  prefix: string = 'mcp'
): { serverName: string; toolName: string } | null {
  const parts = toolName.split(':');
  if (parts.length !== 3 || parts[0] !== prefix) {
    return null;
  }
  return {
    serverName: parts[1],
    toolName: parts[2],
  };
}

/**
 * Create a tool registry wrapper that automatically handles MCP tools
 */
export function createMCPAwareToolRegistry(
  baseRegistry: ToolRegistry,
  mcpClients: Map<string, MCPClient>,
  prefix: string = 'mcp'
): ToolRegistry {
  return {
    register(tool: ToolDefinition): void {
      baseRegistry.register(tool);
    },

    unregister(name: string): void {
      baseRegistry.unregister(name);
    },

    get(name: string): ToolDefinition | undefined {
      // First check base registry
      const tool = baseRegistry.get(name);
      if (tool) {
        return tool;
      }

      // If it's an MCP tool, try to create it on-the-fly
      const parsed = parseMCPToolName(name, prefix);
      if (parsed) {
        const client = mcpClients.get(parsed.serverName);
        if (client) {
          // This is a lazy registration - would need async discovery
          // For now, return undefined
        }
      }

      return undefined;
    },

    getAll(): ToolDefinition[] {
      return baseRegistry.getAll();
    },

    has(name: string): boolean {
      return baseRegistry.has(name);
    },
  };
}
