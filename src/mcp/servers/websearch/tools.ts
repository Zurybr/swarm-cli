/**
 * Web Search MCP Server Tools
 * 
 * Provides web search and content fetching tools for MCP clients
 */

import type { ServerTool } from '../types.js';
import { textResult, errorResult } from '../types.js';
import { search } from './search.js';
import { fetchAndExtract, summarizeContent } from './fetch.js';

/**
 * Search the web
 */
async function searchHandler(args: Record<string, unknown>) {
  const query = args.query as string;
  
  if (!query) {
    return errorResult('Search query is required');
  }

  try {
    const maxResults = (args.maxResults as number) || 10;
    const results = await search(query, { maxResults });
    return textResult(JSON.stringify(results, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Search failed: ${errorMessage}`);
  }
}

/**
 * Fetch and extract content from URL
 */
async function fetchHandler(args: Record<string, unknown>) {
  const url = args.url as string;
  
  if (!url) {
    return errorResult('URL is required');
  }

  try {
    // Validate URL
    new URL(url);
    
    const result = await fetchAndExtract(url);
    return textResult(JSON.stringify(result, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Fetch failed: ${errorMessage}`);
  }
}

/**
 * Summarize web page content
 */
async function summarizeHandler(args: Record<string, unknown>) {
  const url = args.url as string;
  
  if (!url) {
    return errorResult('URL is required');
  }

  try {
    // Validate URL
    new URL(url);
    
    const maxLength = (args.maxLength as number) || 500;
    const result = await summarizeContent(url, maxLength);
    return textResult(JSON.stringify(result, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Summarize failed: ${errorMessage}`);
  }
}

/**
 * All web search tools
 */
export const webSearchTools: ServerTool[] = [
  {
    definition: {
      name: 'web:search',
      description: 'Search the web using DuckDuckGo',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results (default: 10)',
          },
        },
        required: ['query'],
      },
    },
    handler: searchHandler,
  },
  {
    definition: {
      name: 'web:fetch',
      description: 'Fetch and extract content from a URL',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to fetch',
          },
        },
        required: ['url'],
      },
    },
    handler: fetchHandler,
  },
  {
    definition: {
      name: 'web:summarize',
      description: 'Summarize web page content',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to summarize',
          },
          maxLength: {
            type: 'number',
            description: 'Maximum summary length in characters (default: 500)',
          },
        },
        required: ['url'],
      },
    },
    handler: summarizeHandler,
  },
];
