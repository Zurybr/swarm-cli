/**
 * MCP Resource Helpers - Issue #24.6
 * Helper functions for creating MCP resources
 */

import {
  MCPResourceHandler,
  MCPResourceContent,
} from './types.js';

/**
 * Create a simple static resource
 * 
 * @example
 * ```typescript
 * const readmeResource = createStaticResource(
 *   'file://readme',
 *   'README',
 *   '# My Server\n\nDocumentation...',
 *   'text/markdown'
 * );
 * ```
 */
export function createStaticResource(
  uri: string,
  name: string,
  content: string,
  mimeType?: string,
  description?: string
): MCPResourceHandler {
  return {
    uri,
    name,
    description,
    mimeType,
    handler: async (): Promise<MCPResourceContent> => ({
      uri,
      mimeType,
      text: content,
    }),
  };
}

/**
 * Create a resource from a file
 * 
 * @example
 * ```typescript
 * const configFile = createFileResource(
 *   'file://config',
 *   'Configuration',
 *   './config.json',
 *   'application/json'
 * );
 * ```
 */
export function createFileResource(
  uri: string,
  name: string,
  filePath: string,
  mimeType?: string,
  description?: string
): MCPResourceHandler {
  const fs = require('fs');

  return {
    uri,
    name,
    description,
    mimeType,
    handler: async (): Promise<MCPResourceContent> => {
      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        uri,
        mimeType,
        text: content,
      };
    },
  };
}

/**
 * Create a dynamic resource with a custom handler
 * 
 * @example
 * ```typescript
 * const timeResource = createDynamicResource(
 *   'time://now',
 *   'Current Time',
 *   async () => ({
 *     text: new Date().toISOString(),
 *     mimeType: 'text/plain',
 *   }),
 *   'text/plain',
 *   'Returns the current time'
 * );
 * ```
 */
export function createDynamicResource(
  uri: string,
  name: string,
  handler: () => Promise<{ text?: string; blob?: string; mimeType?: string }>,
  mimeType?: string,
  description?: string
): MCPResourceHandler {
  return {
    uri,
    name,
    description,
    mimeType,
    handler: async (): Promise<MCPResourceContent> => {
      const result = await handler();
      return {
        uri,
        mimeType: result.mimeType || mimeType,
        text: result.text,
        blob: result.blob,
      };
    },
  };
}

/**
 * Create a JSON resource
 */
export function createJSONResource(
  uri: string,
  name: string,
  data: unknown,
  description?: string
): MCPResourceHandler {
  return createStaticResource(
    uri,
    name,
    JSON.stringify(data, null, 2),
    'application/json',
    description
  );
}

/**
 * Create a directory listing resource
 */
export function createDirectoryResource(
  uri: string,
  name: string,
  dirPath: string,
  description?: string
): MCPResourceHandler {
  const fs = require('fs');
  const path = require('path');

  return {
    uri,
    name,
    description,
    mimeType: 'application/json',
    handler: async (): Promise<MCPResourceContent> => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const listing = entries.map((entry: any) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: path.join(dirPath, entry.name),
      }));

      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(listing, null, 2),
      };
    },
  };
}

/**
 * Create a template resource that supports URI templates
 * 
 * @example
 * ```typescript
 * const userResource = createTemplateResource(
 *   'user://{userId}',
 *   'User Profile',
 *   async (params) => {
 *     const user = await getUser(params.userId);
 *     return { text: JSON.stringify(user) };
 *   }
 * );
 * ```
 */
export function createTemplateResource(
  uriTemplate: string,
  name: string,
  handler: (params: Record<string, string>) => Promise<{ text?: string; blob?: string; mimeType?: string }>,
  description?: string
): MCPResourceHandler & { template: string } {
  return {
    uri: uriTemplate,
    name,
    description,
    template: uriTemplate,
    handler: async (): Promise<MCPResourceContent> => {
      // This is a template - actual URI matching happens in the server
      throw new Error('Template resource requires URI parameter matching');
    },
  };
}
