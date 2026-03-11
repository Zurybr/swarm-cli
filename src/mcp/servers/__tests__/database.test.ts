/**
 * Tests for Database MCP Server
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

import { databaseTools } from '../database/tools.js';
import { DatabaseConnection, resetDatabaseConnection } from '../database/connection.js';

// Helper to call a tool
async function callTool(name: string, args: Record<string, unknown>) {
  const tool = databaseTools.find(t => t.definition.name === name);
  if (!tool) throw new Error(`Tool ${name} not found`);
  return tool.handler(args);
}

describe('Database MCP Server', () => {
  let dbPath: string;
  let db: DatabaseConnection;

  beforeEach(async () => {
    // Create temp database file
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-db-test-'));
    dbPath = path.join(tempDir, 'test.db');
    
    // Create fresh connection
    resetDatabaseConnection();
    db = new DatabaseConnection({ type: 'sqlite', path: dbPath });
    await db.connect();
    
    // Create test table
    await db.query(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT
      )
    `);
    await db.query(`INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')`);
    await db.query(`INSERT INTO users (name, email) VALUES ('Bob', 'bob@example.com')`);
  });

  afterEach(async () => {
    await db.disconnect();
    resetDatabaseConnection();
    
    // Clean up temp file
    try {
      await fs.unlink(dbPath);
      await fs.rmdir(path.dirname(dbPath));
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Tool Definitions', () => {
    it('should have all required tools', () => {
      const toolNames = databaseTools.map(t => t.definition.name);
      
      expect(toolNames).toContain('db:query');
      expect(toolNames).toContain('db:schema');
      expect(toolNames).toContain('db:tables:list');
      expect(toolNames).toContain('db:table:info');
      expect(toolNames).toContain('db:migrate:list');
    });
  });

  describe('db:query', () => {
    it('should require SQL', async () => {
      const result = await callTool('db:query', {});

      expect(result.isError).toBe(true);
      if ('text' in result.content[0]) {
        expect(result.content[0].text).toContain('SQL query is required');
      }
    });

    it('should execute SELECT queries', async () => {
      const result = await callTool('db:query', {
        sql: 'SELECT * FROM users ORDER BY name',
      });

      expect(result.isError).toBeFalsy();
      if ('text' in result.content[0]) {
        const data = JSON.parse(result.content[0].text);
        expect(data.rowCount).toBe(2);
        expect(data.rows[0].name).toBe('Alice');
        expect(data.rows[1].name).toBe('Bob');
      }
    });

    it('should execute INSERT queries', async () => {
      const result = await callTool('db:query', {
        sql: 'INSERT INTO users (name, email) VALUES (?, ?)',
        params: ['Charlie', 'charlie@example.com'],
      });

      expect(result.isError).toBeFalsy();
      if ('text' in result.content[0]) {
        const data = JSON.parse(result.content[0].text);
        expect(data.rowCount).toBe(1);
      }
    });
  });

  describe('db:tables:list', () => {
    it('should list all tables', async () => {
      const result = await callTool('db:tables:list', {});

      expect(result.isError).toBeFalsy();
      if ('text' in result.content[0]) {
        const tables = JSON.parse(result.content[0].text);
        expect(tables).toContainEqual({ name: 'users', type: 'table' });
      }
    });
  });

  describe('db:table:info', () => {
    it('should require table name', async () => {
      const result = await callTool('db:table:info', {});

      expect(result.isError).toBe(true);
      if ('text' in result.content[0]) {
        expect(result.content[0].text).toContain('Table name is required');
      }
    });

    it('should return column information', async () => {
      const result = await callTool('db:table:info', {
        table: 'users',
      });

      expect(result.isError).toBeFalsy();
      if ('text' in result.content[0]) {
        const columns = JSON.parse(result.content[0].text);
        expect(columns).toHaveLength(3);
        expect(columns.map((c: { name: string }) => c.name)).toEqual(['id', 'name', 'email']);
      }
    });
  });

  describe('db:schema', () => {
    it('should return database schema', async () => {
      const result = await callTool('db:schema', {});

      expect(result.isError).toBeFalsy();
      if ('text' in result.content[0]) {
        expect(result.content[0].text).toContain('CREATE TABLE users');
      }
    });
  });
});
