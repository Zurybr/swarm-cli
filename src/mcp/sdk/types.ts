/**
 * MCP SDK Types - Issue #24.6
 * TypeScript types for building custom MCP servers
 */

import { z } from 'zod';

// ============================================================================
// Server Types
// ============================================================================

export interface MCPServerOptions {
  /** Unique server name */
  name: string;
  /** Server version */
  version: string;
  /** Optional description */
  description?: string;
  /** Server capabilities */
  capabilities?: MCPCapabilities;
}

export interface MCPCapabilities {
  /** Tool support */
  tools?: { listChanged?: boolean };
  /** Resource support */
  resources?: { subscribe?: boolean; listChanged?: boolean };
  /** Prompt support */
  prompts?: { listChanged?: boolean };
  /** Logging support */
  logging?: {};
}

// ============================================================================
// Tool Types
// ============================================================================

export interface MCPToolInputSchema {
  type: 'object';
  properties: Record<string, MCPPropertySchema>;
  required?: string[];
}

export interface MCPPropertySchema {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: MCPPropertySchema;
  properties?: Record<string, MCPPropertySchema>;
  required?: string[];
  anyOf?: MCPPropertySchema[];
  oneOf?: MCPPropertySchema[];
}

export interface MCPToolDefinition {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Input schema (JSON Schema format) */
  inputSchema: MCPToolInputSchema;
}

export interface MCPToolHandler {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Input schema */
  inputSchema: MCPToolInputSchema;
  /** Handler function */
  handler: (args: Record<string, unknown>) => Promise<MCPToolResult>;
}

export interface MCPToolResult {
  /** Content array */
  content: MCPContent[];
  /** Is this an error result? */
  isError?: boolean;
}

export interface MCPContent {
  /** Content type */
  type: 'text' | 'image' | 'resource';
  /** Text content (for type='text') */
  text?: string;
  /** Base64 data (for type='image') */
  data?: string;
  /** MIME type */
  mimeType?: string;
  /** Resource reference (for type='resource') */
  resource?: MCPResourceReference;
}

export interface MCPResourceReference {
  uri: string;
  mimeType?: string;
  text?: string;
}

// ============================================================================
// Zod Tool Helper Types
// ============================================================================

export interface CreateToolConfig<T extends z.ZodRawShape> {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Zod schema for parameters */
  parameters: T;
  /** Handler function with validated input */
  handler: (args: z.infer<z.ZodObject<T>>) => Promise<MCPToolResult>;
}

// ============================================================================
// Resource Types
// ============================================================================

export interface MCPResourceDefinition {
  /** Resource URI */
  uri: string;
  /** Resource name */
  name: string;
  /** Resource description */
  description?: string;
  /** MIME type */
  mimeType?: string;
}

export interface MCPResourceHandler {
  /** Resource URI */
  uri: string;
  /** Resource name */
  name: string;
  /** Resource description */
  description?: string;
  /** MIME type */
  mimeType?: string;
  /** Handler function */
  handler: () => Promise<MCPResourceContent>;
}

export interface MCPResourceContent {
  /** Resource URI */
  uri: string;
  /** MIME type */
  mimeType?: string;
  /** Text content */
  text?: string;
  /** Base64 binary content */
  blob?: string;
}

// ============================================================================
// Prompt Types
// ============================================================================

export interface MCPPromptDefinition {
  /** Prompt name */
  name: string;
  /** Prompt description */
  description?: string;
  /** Prompt arguments */
  arguments?: MCPPromptArgument[];
}

export interface MCPPromptArgument {
  /** Argument name */
  name: string;
  /** Argument description */
  description?: string;
  /** Is this argument required? */
  required?: boolean;
}

export interface MCPPromptHandler {
  /** Prompt name */
  name: string;
  /** Prompt description */
  description?: string;
  /** Prompt arguments */
  arguments?: MCPPromptArgument[];
  /** Handler function */
  handler: (args?: Record<string, unknown>) => Promise<MCPPromptResult>;
}

export interface MCPPromptResult {
  /** Description */
  description?: string;
  /** Messages */
  messages: MCPPromptMessage[];
}

export interface MCPPromptMessage {
  /** Role (user or assistant) */
  role: 'user' | 'assistant';
  /** Content */
  content: MCPContent;
}

// ============================================================================
// Transport Types
// ============================================================================

export type ServerTransport = import('@modelcontextprotocol/sdk/server/stdio.js').StdioServerTransport;

// ============================================================================
// Error Types
// ============================================================================

export class MCPSDKError extends Error {
  constructor(
    message: string,
    public code: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'MCPSDKError';
  }
}

export class MCPValidationError extends MCPSDKError {
  constructor(message: string, public errors: z.ZodError) {
    super(message, -32602, errors);
    this.name = 'MCPValidationError';
  }
}

export class MCPToolExecutionError extends MCPSDKError {
  constructor(toolName: string, cause: Error) {
    super(`Tool execution failed: ${toolName}`, -32603, { cause });
    this.name = 'MCPToolExecutionError';
  }
}

// ============================================================================
// Event Types
// ============================================================================

export interface MCPServerEvents {
  'server:start': () => void;
  'server:stop': () => void;
  'tool:call': (name: string, args: Record<string, unknown>) => void;
  'tool:result': (name: string, result: MCPToolResult) => void;
  'tool:error': (name: string, error: Error) => void;
  'resource:read': (uri: string) => void;
  'prompt:get': (name: string, args?: Record<string, unknown>) => void;
}

// ============================================================================
// Test Utilities Types
// ============================================================================

export interface MCPTestClientOptions {
  /** Server path */
  serverPath: string;
  /** Timeout for operations (ms) */
  timeout?: number;
  /** Environment variables */
  env?: Record<string, string>;
}

export interface MCPTestResult {
  /** Whether the test passed */
  success: boolean;
  /** Test duration (ms) */
  duration: number;
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// Development Mode Types
// ============================================================================

export interface MCPDevServerOptions {
  /** Entry point file */
  entryPoint: string;
  /** Watch directories */
  watchDirs?: string[];
  /** Build command */
  buildCommand?: string;
  /** Output directory */
  outDir?: string;
}
