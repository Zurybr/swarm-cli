/**
 * MCP Servers Index
 * 
 * Exports all built-in MCP servers for Swarm CLI
 */

// Base utilities
export { createServer, startServer, runServer } from './base.js';
export type { BaseServerOptions } from './base.js';

// Types
export type { 
  ServerConfig, 
  ToolDefinition, 
  ToolResult, 
  ServerTool,
  ToolHandler 
} from './types.js';
export { textResult, errorResult, McpServerError } from './types.js';

// Filesystem server
export { filesystemTools } from './filesystem/tools.js';

// GitHub server
export { githubTools } from './github/tools.js';
export { GitHubClient, getGitHubClient, resetGitHubClient } from './github/client.js';
export type { GitHubClientConfig } from './github/client.js';

// Database server
export { databaseTools } from './database/tools.js';
export { DatabaseConnection, getDatabaseConnection, resetDatabaseConnection } from './database/connection.js';
export type { DatabaseConfig, QueryResult, TableInfo, ColumnInfo } from './database/connection.js';

// Web Search server
export { webSearchTools } from './websearch/tools.js';
export { search, fetchUrl } from './websearch/search.js';
export { fetchAndExtract, summarizeContent } from './websearch/fetch.js';
