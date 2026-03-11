/**
 * MCP SDK - Issue #24.6
 * High-level SDK for building custom MCP servers
 * 
 * @example
 * ```typescript
 * import { MCPServerBuilder, createTool } from '@swarm-cli/mcp-sdk';
 * import { z } from 'zod';
 * 
 * const server = new MCPServerBuilder({
 *   name: 'my-server',
 *   version: '1.0.0',
 * });
 * 
 * server.addTool(createTool({
 *   name: 'greet',
 *   description: 'Greet someone',
 *   parameters: {
 *     name: z.string().describe('Name to greet'),
 *   },
 *   handler: async ({ name }) => ({
 *     content: [{ type: 'text', text: `Hello, ${name}!` }],
 *   }),
 * }));
 * 
 * server.start();
 * ```
 */

// Core server builder
export { MCPServerBuilder } from './server.js';

// Tool helpers
export {
  createTool,
  createTextTool,
  createFetchTool,
  createQueryTool,
  createCommandTool,
  createTransformTool,
  createFileReadTool,
  zodToMCPInputSchema,
  textContent,
  imageContent,
  resourceContent,
} from './tools.js';

// Resource helpers
export {
  createStaticResource,
  createFileResource,
  createDynamicResource,
  createJSONResource,
  createDirectoryResource,
  createTemplateResource,
} from './resources.js';

// Prompt helpers
export {
  createStaticPrompt,
  createPrompt,
  createConversationPrompt,
  createSystemPrompt,
  createTemplatePrompt,
  createCodeAnalysisPrompt,
  createDocGenerationPrompt,
  createCodeReviewPrompt,
  userMessage,
  assistantMessage,
} from './prompts.js';

// Development mode
export { MCPDevServer, runDevMode } from './dev.js';

// Testing utilities
export {
  MCPTestClient,
  createMCPTestFixture,
  testTool,
  mockToolResult,
  mockTool,
} from './testing.js';

// Types
export type {
  MCPServerOptions,
  MCPCapabilities,
  MCPToolInputSchema,
  MCPPropertySchema,
  MCPToolDefinition,
  MCPToolHandler,
  MCPToolResult,
  MCPContent,
  MCPResourceReference,
  CreateToolConfig,
  MCPResourceDefinition,
  MCPResourceHandler,
  MCPResourceContent,
  MCPPromptDefinition,
  MCPPromptArgument,
  MCPPromptHandler,
  MCPPromptResult,
  MCPPromptMessage,
  ServerTransport,
  MCPServerEvents,
  MCPTestClientOptions,
  MCPTestResult,
  MCPDevServerOptions,
} from './types.js';

// Tool-specific types (exported from tools.ts)
export type { FetchToolOptions, DatabaseConnection } from './tools.js';

// Error classes
export {
  MCPSDKError,
  MCPValidationError,
  MCPToolExecutionError,
} from './types.js';
