/**
 * Database MCP Server Tools
 * 
 * Provides database access tools for MCP clients
 */

import type { ServerTool } from '../types.js';
import { textResult, errorResult } from '../types.js';
import { getDatabaseConnection } from './connection.js';

/**
 * Execute SQL query
 */
async function queryHandler(args: Record<string, unknown>) {
  const sql = args.sql as string;
  
  if (!sql) {
    return errorResult('SQL query is required');
  }

  try {
    const db = getDatabaseConnection();
    const params = args.params as unknown[] || [];
    const result = await db.query(sql, params);
    return textResult(JSON.stringify(result, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Query failed: ${errorMessage}`);
  }
}

/**
 * Get database schema
 */
async function schemaHandler(args: Record<string, unknown>) {
  try {
    const db = getDatabaseConnection();
    const schema = await db.getSchema();
    return textResult(schema || 'No schema information available');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to get schema: ${errorMessage}`);
  }
}

/**
 * List tables
 */
async function listTablesHandler(args: Record<string, unknown>) {
  try {
    const db = getDatabaseConnection();
    const tables = await db.listTables();
    return textResult(JSON.stringify(tables, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to list tables: ${errorMessage}`);
  }
}

/**
 * Get table information
 */
async function tableInfoHandler(args: Record<string, unknown>) {
  const tableName = args.table as string;
  
  if (!tableName) {
    return errorResult('Table name is required');
  }

  try {
    const db = getDatabaseConnection();
    const columns = await db.getTableInfo(tableName);
    return textResult(JSON.stringify(columns, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to get table info: ${errorMessage}`);
  }
}

/**
 * List pending migrations
 * Note: This is a placeholder - actual migration tracking depends on your setup
 */
async function listMigrationsHandler(args: Record<string, unknown>) {
  try {
    const db = getDatabaseConnection();
    
    // Check if migrations table exists
    const tables = await db.listTables();
    const migrationsTable = tables.find(t => t.name === 'migrations' || t.name === '_migrations');
    
    if (!migrationsTable) {
      return textResult(JSON.stringify({
        message: 'No migrations table found',
        pending: [],
      }, null, 2));
    }
    
    // Get applied migrations
    const result = await db.query(
      'SELECT * FROM migrations ORDER BY id DESC'
    );
    
    return textResult(JSON.stringify({
      applied: result.rows,
      pending: [], // Would need access to migration files to determine pending
    }, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to list migrations: ${errorMessage}`);
  }
}

/**
 * All database tools
 */
export const databaseTools: ServerTool[] = [
  {
    definition: {
      name: 'db:query',
      description: 'Execute a SQL query on the database',
      inputSchema: {
        type: 'object',
        properties: {
          sql: {
            type: 'string',
            description: 'SQL query to execute',
          },
          params: {
            type: 'array',
            items: {},
            description: 'Query parameters for prepared statements',
          },
        },
        required: ['sql'],
      },
    },
    handler: queryHandler,
  },
  {
    definition: {
      name: 'db:schema',
      description: 'Get the database schema (DDL statements)',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: schemaHandler,
  },
  {
    definition: {
      name: 'db:tables:list',
      description: 'List all tables and views in the database',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: listTablesHandler,
  },
  {
    definition: {
      name: 'db:table:info',
      description: 'Get detailed information about a table\'s columns',
      inputSchema: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            description: 'Name of the table',
          },
        },
        required: ['table'],
      },
    },
    handler: tableInfoHandler,
  },
  {
    definition: {
      name: 'db:migrate:list',
      description: 'List database migrations and their status',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: listMigrationsHandler,
  },
];
