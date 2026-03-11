/**
 * Database Connection Management
 * 
 * Handles database connections for the MCP server
 */

import * as sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

export type DatabaseType = 'sqlite' | 'postgres' | 'mysql';

export interface DatabaseConfig {
  type: DatabaseType;
  path?: string; // For SQLite
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields?: string[];
}

export interface TableInfo {
  name: string;
  type: 'table' | 'view';
  schema?: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: unknown;
  primaryKey: boolean;
}

/**
 * Simple database wrapper supporting SQLite
 * Can be extended for PostgreSQL/MySQL
 */
export class DatabaseConnection {
  private db: Database | null = null;
  private config: DatabaseConfig;

  constructor(config?: DatabaseConfig) {
    // Default to SQLite with path from env or default
    this.config = config || {
      type: 'sqlite',
      path: process.env.DATABASE_PATH || ':memory:',
    };
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    if (this.config.type === 'sqlite') {
      this.db = await open({
        filename: this.config.path || ':memory:',
        driver: sqlite3.Database,
      });
    } else {
      throw new Error(`Database type ${this.config.type} not yet supported`);
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  /**
   * Execute a query
   */
  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    if (!this.db) {
      await this.connect();
    }

    const isSelect = sql.trim().toLowerCase().startsWith('select');
    
    if (isSelect) {
      const rows = await this.db!.all(sql, params);
      return {
        rows,
        rowCount: rows.length,
        fields: rows.length > 0 ? Object.keys(rows[0]) : [],
      };
    } else {
      const result = await this.db!.run(sql, params);
      return {
        rows: [],
        rowCount: result.changes || 0,
      };
    }
  }

  /**
   * Get list of tables
   */
  async listTables(): Promise<TableInfo[]> {
    if (!this.db) {
      await this.connect();
    }

    if (this.config.type === 'sqlite') {
      const rows = await this.db!.all(
        `SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name`
      );
      return rows.map(row => ({
        name: row.name as string,
        type: row.type as 'table' | 'view',
      }));
    }

    return [];
  }

  /**
   * Get table information
   */
  async getTableInfo(tableName: string): Promise<ColumnInfo[]> {
    if (!this.db) {
      await this.connect();
    }

    if (this.config.type === 'sqlite') {
      const rows = await this.db!.all(`PRAGMA table_info(${tableName})`);
      return rows.map(row => ({
        name: row.name as string,
        type: row.type as string,
        nullable: (row.notnull as number) === 0,
        defaultValue: row.dflt_value,
        primaryKey: (row.pk as number) === 1,
      }));
    }

    return [];
  }

  /**
   * Get database schema
   */
  async getSchema(): Promise<string> {
    if (!this.db) {
      await this.connect();
    }

    if (this.config.type === 'sqlite') {
      const rows = await this.db!.all(
        `SELECT sql FROM sqlite_master WHERE type IN ('table', 'view', 'index') AND sql IS NOT NULL ORDER BY type, name`
      );
      return rows.map(row => row.sql).join(';\n\n');
    }

    return '';
  }

  /**
   * Execute multiple statements (for migrations)
   */
  async executeScript(sql: string): Promise<void> {
    if (!this.db) {
      await this.connect();
    }

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await this.db!.exec(statement);
    }
  }
}

// Singleton instance
let connection: DatabaseConnection | null = null;

export function getDatabaseConnection(config?: DatabaseConfig): DatabaseConnection {
  if (!connection) {
    connection = new DatabaseConnection(config);
  }
  return connection;
}

export function resetDatabaseConnection(): void {
  if (connection) {
    connection.disconnect().catch(() => {});
    connection = null;
  }
}
