/**
 * MCP Types - Issue #24
 * TypeScript interfaces for Model Context Protocol
 */

// ============================================================================
// Server Configuration
// ============================================================================

export interface MCPServerConfig {
  /** Unique server name */
  name: string;
  /** Command to execute (for stdio transport) */
  command: string;
  /** Command arguments */
  args: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Transport type */
  transport?: 'stdio' | 'http' | 'sse';
  /** HTTP URL (for http/sse transport) */
  url?: string;
  /** Connection timeout in ms */
  timeout?: number;
}

// ============================================================================
// JSON-RPC Types
// ============================================================================

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: JSONRPCError;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

// ============================================================================
// MCP Protocol Types
// ============================================================================

export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  clientInfo: MCPClientInfo;
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  serverInfo: MCPServerInfo;
}

export interface MCPCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
  logging?: {};
}

export interface MCPClientInfo {
  name: string;
  version: string;
}

export interface MCPServerInfo {
  name: string;
  version: string;
}

// ============================================================================
// Tool Types
// ============================================================================

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPInputSchema;
}

export interface MCPInputSchema {
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
}

export interface MCPToolCallParams {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
}

export interface MCPContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  resource?: MCPResourceReference;
}

export interface MCPResourceReference {
  uri: string;
  mimeType?: string;
  text?: string;
}

// ============================================================================
// Resource Types
// ============================================================================

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export interface MCPResourceReadParams {
  uri: string;
}

// ============================================================================
// Prompt Types
// ============================================================================

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface MCPPromptGetParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface MCPPromptResult {
  description?: string;
  messages: MCPPromptMessage[];
}

export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: MCPContent;
}

// ============================================================================
// Client Interface
// ============================================================================

export interface MCPClient {
  connect(server: MCPServerConfig): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  initialize(): Promise<MCPInitializeResult>;
  listTools(): Promise<MCPTool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult>;
  listResources(): Promise<MCPResource[]>;
  readResource(uri: string): Promise<MCPResourceContent>;
  listPrompts?(): Promise<MCPPrompt[]>;
  getPrompt?(name: string, args?: Record<string, unknown>): Promise<MCPPromptResult>;
}

// ============================================================================
// Transport Interface
// ============================================================================

export interface MCPTransport {
  connect(): Promise<void>;
  disconnect(): void;
  send(request: JSONRPCRequest): Promise<JSONRPCResponse>;
  isConnected(): boolean;
  onNotification?(handler: (notification: JSONRPCNotification) => void): void;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface MCPConfig {
  servers: Record<string, MCPServerConfig>;
}

export interface SwarmConfig {
  mcp?: MCPConfig;
}

// ============================================================================
// Integration Types
// ============================================================================

export interface MCPToolRegistration {
  /** Full tool name: mcp:${serverName}:${toolName} */
  fullName: string;
  /** Original MCP tool */
  tool: MCPTool;
  /** Server name */
  serverName: string;
  /** Handler function */
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface MCPIntegrationOptions {
  /** Prefix for registered tools */
  toolPrefix?: string;
  /** Auto-discover tools on connection */
  autoDiscover?: boolean;
  /** Cache tools after discovery */
  cacheTools?: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export class MCPError extends Error {
  constructor(
    message: string,
    public code: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class MCPConnectionError extends MCPError {
  constructor(message: string) {
    super(message, -32000);
    this.name = 'MCPConnectionError';
  }
}

export class MCPTimeoutError extends MCPError {
  constructor(message: string) {
    super(message, -32001);
    this.name = 'MCPTimeoutError';
  }
}

export class MCPToolNotFoundError extends MCPError {
  constructor(toolName: string) {
    super(`Tool not found: ${toolName}`, -32601);
    this.name = 'MCPToolNotFoundError';
  }
}

export class MCPResourceNotFoundError extends MCPError {
  constructor(uri: string) {
    super(`Resource not found: ${uri}`, -32601);
    this.name = 'MCPResourceNotFoundError';
  }
}
