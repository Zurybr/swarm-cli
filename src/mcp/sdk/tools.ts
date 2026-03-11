/**
 * MCP Tool Helpers - Issue #24.6
 * Helper functions for creating MCP tools
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  MCPToolHandler,
  MCPToolInputSchema,
  MCPToolResult,
  MCPContent,
  CreateToolConfig,
  MCPValidationError,
} from './types.js';

/**
 * Convert Zod schema to MCP input schema
 */
export function zodToMCPInputSchema<T extends z.ZodRawShape>(
  zodSchema: z.ZodObject<T>
): MCPToolInputSchema {
  // Use any cast to work around complex Zod type inference
  const jsonSchema = zodToJsonSchema(zodSchema as any, { target: 'openApi3' }) as {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };

  return {
    type: 'object',
    properties: jsonSchema.properties as Record<string, import('./types.js').MCPPropertySchema>,
    required: jsonSchema.required,
  };
}

/**
 * Create a tool with Zod validation
 * 
 * @example
 * ```typescript
 * const greetTool = createTool({
 *   name: 'greet',
 *   description: 'Greet someone by name',
 *   parameters: {
 *     name: z.string().describe('The name to greet'),
 *   },
 *   handler: async ({ name }) => ({
 *     content: [{ type: 'text', text: `Hello, ${name}!` }],
 *   }),
 * });
 * ```
 */
export function createTool<T extends z.ZodRawShape>(
  config: CreateToolConfig<T>
): MCPToolHandler {
  const schema = z.object(config.parameters);
  const inputSchema = zodToMCPInputSchema(schema);

  return {
    name: config.name,
    description: config.description,
    inputSchema,
    handler: async (args: Record<string, unknown>): Promise<MCPToolResult> => {
      const result = schema.safeParse(args);

      if (!result.success) {
        throw new MCPValidationError('Invalid tool arguments', result.error);
      }

      return config.handler(result.data);
    },
  };
}

/**
 * Create a simple text tool that returns a string
 */
export function createTextTool(
  name: string,
  description: string,
  inputSchema: MCPToolInputSchema,
  handler: (args: Record<string, unknown>) => Promise<string>
): MCPToolHandler {
  return {
    name,
    description,
    inputSchema,
    handler: async (args: Record<string, unknown>): Promise<MCPToolResult> => {
      const text = await handler(args);
      return {
        content: [{ type: 'text', text }],
      };
    },
  };
}

// ============================================================================
// Common Tool Patterns
// ============================================================================

export interface FetchToolOptions {
  /** Base URL for API */
  baseUrl: string;
  /** Default headers */
  headers?: Record<string, string>;
  /** Allowed methods */
  methods?: ('GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH')[];
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * Create a tool that fetches data from an API
 * 
 * @example
 * ```typescript
 * const apiTool = createFetchTool('api', 'https://api.example.com', {
 *   headers: { 'Authorization': 'Bearer token' },
 * });
 * ```
 */
export function createFetchTool(
  name: string,
  baseUrl: string,
  options?: FetchToolOptions
): MCPToolHandler {
  const methods = options?.methods || ['GET', 'POST', 'PUT', 'DELETE'];

  return {
    name,
    description: `Fetch data from ${baseUrl}`,
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'API endpoint path',
        },
        method: {
          type: 'string',
          enum: methods,
          description: 'HTTP method',
        },
        body: {
          type: 'object',
          description: 'Request body (for POST/PUT/PATCH)',
        },
        headers: {
          type: 'object',
          description: 'Additional headers',
        },
      },
      required: ['path'],
    },
    handler: async (args: Record<string, unknown>): Promise<MCPToolResult> => {
      const { path, method = 'GET', body, headers } = args;

      try {
        const url = new URL(path as string, baseUrl);
        const fetchOptions: RequestInit = {
          method: method as string,
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
            ...(headers as Record<string, string>),
          },
        };

        if (body && ['POST', 'PUT', 'PATCH'].includes(method as string)) {
          fetchOptions.body = JSON.stringify(body);
        }

        const controller = new AbortController();
        const timeout = options?.timeout || 30000;
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url.toString(), {
          ...fetchOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type') || '';
        let content: MCPContent;

        if (contentType.includes('application/json')) {
          const data = await response.json();
          content = {
            type: 'text',
            text: JSON.stringify(data, null, 2),
          };
        } else {
          const text = await response.text();
          content = { type: 'text', text };
        }

        return {
          content: [content],
          isError: !response.ok,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Fetch failed: ${message}` }],
          isError: true,
        };
      }
    },
  };
}

export interface DatabaseConnection {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
}

/**
 * Create a tool that queries a database
 * 
 * @example
 * ```typescript
 * const dbTool = createQueryTool('db', {
 *   query: async (sql, params) => {
 *     // Execute query
 *     return results;
 *   },
 * });
 * ```
 */
export function createQueryTool(
  name: string,
  connection: DatabaseConnection
): MCPToolHandler {
  return {
    name,
    description: 'Execute database queries',
    inputSchema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'SQL query',
        },
        params: {
          type: 'array',
          items: { type: 'any' },
          description: 'Query parameters',
        },
      },
      required: ['sql'],
    },
    handler: async (args: Record<string, unknown>): Promise<MCPToolResult> => {
      const { sql, params } = args;

      try {
        const results = await connection.query(
          sql as string,
          (params as unknown[]) || []
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Query failed: ${message}` }],
          isError: true,
        };
      }
    },
  };
}

/**
 * Create a tool that runs allowed shell commands
 * 
 * @example
 * ```typescript
 * const cmdTool = createCommandTool('shell', ['ls', 'cat', 'echo']);
 * ```
 */
export function createCommandTool(
  name: string,
  allowedCommands: string[]
): MCPToolHandler {
  const { exec } = require('child_process');

  return {
    name,
    description: `Run allowed shell commands: ${allowedCommands.join(', ')}`,
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          enum: allowedCommands,
          description: 'Command to run',
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Command arguments',
        },
      },
      required: ['command'],
    },
    handler: async (args: Record<string, unknown>): Promise<MCPToolResult> => {
      const { command, args: cmdArgs = [] } = args;

      return new Promise((resolve) => {
        const fullCommand = `${command} ${(cmdArgs as string[]).join(' ')}`;

        exec(
          fullCommand,
          { timeout: 30000 },
          (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
              resolve({
                content: [
                  { type: 'text', text: stderr || error.message },
                ],
                isError: true,
              });
              return;
            }

            resolve({
              content: [{ type: 'text', text: stdout }],
            });
          }
        );
      });
    },
  };
}

/**
 * Create a tool that transforms data
 */
export function createTransformTool<TInput, TOutput>(
  name: string,
  description: string,
  inputSchema: MCPToolInputSchema,
  transform: (input: TInput) => TOutput | Promise<TOutput>
): MCPToolHandler {
  return {
    name,
    description,
    inputSchema,
    handler: async (args: Record<string, unknown>): Promise<MCPToolResult> => {
      try {
        const result = await transform(args as TInput);
        return {
          content: [
            {
              type: 'text',
              text:
                typeof result === 'string'
                  ? result
                  : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Transform failed: ${message}` }],
          isError: true,
        };
      }
    },
  };
}

/**
 * Create a tool that reads files
 */
export function createFileReadTool(
  name: string,
  basePath: string,
  allowedExtensions?: string[]
): MCPToolHandler {
  const fs = require('fs');
  const path = require('path');

  return {
    name,
    description: 'Read file contents',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative file path',
        },
        encoding: {
          type: 'string',
          enum: ['utf-8', 'base64'],
          description: 'File encoding',
        },
      },
      required: ['path'],
    },
    handler: async (args: Record<string, unknown>): Promise<MCPToolResult> => {
      const { path: filePath, encoding = 'utf-8' } = args;

      try {
        // Validate path is within base directory
        const resolvedPath = path.resolve(basePath, filePath as string);
        if (!resolvedPath.startsWith(path.resolve(basePath))) {
          return {
            content: [{ type: 'text', text: 'Access denied: path outside base directory' }],
            isError: true,
          };
        }

        // Check extension if allowed
        if (allowedExtensions && allowedExtensions.length > 0) {
          const ext = path.extname(resolvedPath);
          if (!allowedExtensions.includes(ext)) {
            return {
              content: [{ type: 'text', text: `File extension not allowed: ${ext}` }],
              isError: true,
            };
          }
        }

        const content = fs.readFileSync(resolvedPath, encoding);
        return {
          content: [{ type: 'text', text: content }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Read failed: ${message}` }],
          isError: true,
        };
      }
    },
  };
}

/**
 * Helper to create text content
 */
export function textContent(text: string): MCPContent {
  return { type: 'text', text };
}

/**
 * Helper to create image content
 */
export function imageContent(data: string, mimeType: string = 'image/png'): MCPContent {
  return { type: 'image', data, mimeType };
}

/**
 * Helper to create resource content
 */
export function resourceContent(uri: string, text?: string, mimeType?: string): MCPContent {
  return { type: 'resource', resource: { uri, text, mimeType } };
}
