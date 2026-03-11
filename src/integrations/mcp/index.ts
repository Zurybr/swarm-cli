/**
 * MCP Integration Module - Issue #24
 * Model Context Protocol integration for Swarm CLI
 */

// Client
export { MCPClientImpl, MCPClientOptions } from './mcp-client';

// Manager
export { MCPServerManager, MCPServerManagerOptions } from './mcp-manager';

// Types
export * from './types';

// Transports
export * from './transports';

// Configuration
export {
  loadMCPConfig,
  loadSwarmConfig,
  getServerConfig,
  getAllServerConfigs,
  validateServerConfig,
  createDefaultConfig,
  mergeConfigs,
  getConfigDir,
  configExists,
} from './config';

// Tool Integration
export {
  registerMCPTools,
  registerMCPToolsAsync,
  unregisterMCPTools,
  formatToolResult,
  mapInputSchemaToParameters,
  mcpToolToSkillMetadata,
  listMCPTools,
  isMCPTool,
  parseMCPToolName,
  createMCPAwareToolRegistry,
  InMemoryToolRegistry,
  ToolRegistry,
  ToolDefinition,
  ToolResult,
} from './integration';
