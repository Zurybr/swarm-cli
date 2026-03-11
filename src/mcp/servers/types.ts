/**
 * Shared types for MCP servers
 */

import type { Tool, TextContent, ImageContent, CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface ServerConfig {
  name: string;
  version: string;
  description: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Tool['inputSchema'];
}

export type ContentBlock = TextContent | ImageContent;

export type ToolResult = CallToolResult;

export interface ServerCapabilities {
  tools: boolean;
  resources?: boolean;
  prompts?: boolean;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

export interface ServerTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

/**
 * Base error class for MCP servers
 */
export class McpServerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'McpServerError';
  }
}

/**
 * Helper to create a text result
 */
export function textResult(text: string, isError = false): ToolResult {
  return {
    content: [{ type: 'text' as const, text }],
    isError,
  };
}

/**
 * Helper to create an error result
 */
export function errorResult(message: string, details?: unknown): ToolResult {
  return textResult(`Error: ${message}${details ? `\nDetails: ${JSON.stringify(details, null, 2)}` : ''}`, true);
}
