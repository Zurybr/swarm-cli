/**
 * Filesystem MCP Server Tools
 * 
 * Provides filesystem access tools for MCP clients
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ServerTool } from '../types.js';
import { textResult, errorResult } from '../types.js';

/**
 * Read file contents
 */
async function readFileHandler(args: Record<string, unknown>) {
  const filePath = args.path as string;
  
  if (!filePath) {
    return errorResult('Path is required');
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return textResult(content);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to read file: ${errorMessage}`);
  }
}

/**
 * Write file contents
 */
async function writeFileHandler(args: Record<string, unknown>) {
  const filePath = args.path as string;
  const content = args.content as string;
  
  if (!filePath) {
    return errorResult('Path is required');
  }
  
  if (content === undefined) {
    return errorResult('Content is required');
  }

  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(filePath, content, 'utf-8');
    return textResult(`Successfully wrote to ${filePath}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to write file: ${errorMessage}`);
  }
}

/**
 * List directory contents
 */
async function listDirHandler(args: Record<string, unknown>) {
  const dirPath = (args.path as string) || '.';
  const recursive = (args.recursive as boolean) ?? false;

  try {
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      return errorResult(`${dirPath} is not a directory`);
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    const result = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      path: path.join(dirPath, entry.name),
    }));

    if (recursive) {
      const subdirs = entries.filter(e => e.isDirectory());
      for (const subdir of subdirs) {
        const subResult = await listDirHandler({ path: path.join(dirPath, subdir.name), recursive: true });
        if (!subResult.isError && subResult.content[0] && 'text' in subResult.content[0]) {
          const subEntries = JSON.parse(subResult.content[0].text);
          result.push(...subEntries);
        }
      }
    }

    return textResult(JSON.stringify(result, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to list directory: ${errorMessage}`);
  }
}

/**
 * Search files by pattern
 */
async function searchFilesHandler(args: Record<string, unknown>) {
  const dirPath = (args.path as string) || '.';
  const pattern = args.pattern as string;
  const recursive = (args.recursive as boolean) ?? true;

  if (!pattern) {
    return errorResult('Pattern is required');
  }

  try {
    const results: string[] = [];
    const regex = new RegExp(pattern, 'i');

    const searchDir = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (regex.test(entry.name)) {
          results.push(fullPath);
        }
        
        if (recursive && entry.isDirectory()) {
          await searchDir(fullPath);
        }
      }
    };

    await searchDir(dirPath);
    return textResult(JSON.stringify(results, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to search files: ${errorMessage}`);
  }
}

/**
 * Check if file/directory exists
 */
async function existsHandler(args: Record<string, unknown>) {
  const filePath = args.path as string;
  
  if (!filePath) {
    return errorResult('Path is required');
  }

  try {
    const stats = await fs.stat(filePath);
    return textResult(JSON.stringify({
      exists: true,
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      modified: stats.mtime,
      created: stats.birthtime,
    }, null, 2));
  } catch {
    return textResult(JSON.stringify({ exists: false }, null, 2));
  }
}

/**
 * Delete file/directory
 */
async function deleteHandler(args: Record<string, unknown>) {
  const filePath = args.path as string;
  const recursive = (args.recursive as boolean) ?? false;
  
  if (!filePath) {
    return errorResult('Path is required');
  }

  try {
    const stats = await fs.stat(filePath);
    
    if (stats.isDirectory()) {
      await fs.rm(filePath, { recursive, force: true });
    } else {
      await fs.unlink(filePath);
    }
    
    return textResult(`Successfully deleted ${filePath}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to delete: ${errorMessage}`);
  }
}

/**
 * All filesystem tools
 */
export const filesystemTools: ServerTool[] = [
  {
    definition: {
      name: 'filesystem:read',
      description: 'Read the contents of a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to read',
          },
        },
        required: ['path'],
      },
    },
    handler: readFileHandler,
  },
  {
    definition: {
      name: 'filesystem:write',
      description: 'Write content to a file (creates directories if needed)',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to write',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file',
          },
        },
        required: ['path', 'content'],
      },
    },
    handler: writeFileHandler,
  },
  {
    definition: {
      name: 'filesystem:list',
      description: 'List contents of a directory',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the directory (default: current directory)',
          },
          recursive: {
            type: 'boolean',
            description: 'Whether to list recursively (default: false)',
          },
        },
      },
    },
    handler: listDirHandler,
  },
  {
    definition: {
      name: 'filesystem:search',
      description: 'Search for files matching a pattern',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Starting directory for search (default: current directory)',
          },
          pattern: {
            type: 'string',
            description: 'Regex pattern to match file names',
          },
          recursive: {
            type: 'boolean',
            description: 'Whether to search recursively (default: true)',
          },
        },
        required: ['pattern'],
      },
    },
    handler: searchFilesHandler,
  },
  {
    definition: {
      name: 'filesystem:exists',
      description: 'Check if a file or directory exists',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to check',
          },
        },
        required: ['path'],
      },
    },
    handler: existsHandler,
  },
  {
    definition: {
      name: 'filesystem:delete',
      description: 'Delete a file or directory',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to delete',
          },
          recursive: {
            type: 'boolean',
            description: 'For directories, delete recursively (default: false)',
          },
        },
        required: ['path'],
      },
    },
    handler: deleteHandler,
  },
];
