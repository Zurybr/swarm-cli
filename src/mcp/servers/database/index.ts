/**
 * Database MCP Server
 * 
 * Provides database access tools for MCP clients.
 * Run standalone: npx ts-node src/mcp/servers/database/index.ts
 * 
 * Environment variables:
 * - DATABASE_TYPE: Database type (sqlite, postgres, mysql) - default: sqlite
 * - DATABASE_PATH: Path for SQLite database - default: :memory:
 * - DATABASE_HOST: Database host (for postgres/mysql)
 * - DATABASE_PORT: Database port
 * - DATABASE_NAME: Database name
 * - DATABASE_USER: Database user
 * - DATABASE_PASSWORD: Database password
 */

import { runServer } from '../base.js';
import { databaseTools } from './tools.js';
import { getDatabaseConnection, resetDatabaseConnection } from './connection.js';

const config = {
  name: 'swarm-database-server',
  version: '1.0.0',
  description: 'MCP server providing database access tools',
};

async function main() {
  // Initialize database connection
  const db = getDatabaseConnection();
  await db.connect();
  
  console.error('Database server started');
  console.error(`Database type: ${process.env.DATABASE_TYPE || 'sqlite'}`);
  
  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.error('\nShutting down database server...');
    await resetDatabaseConnection();
    process.exit(0);
  });

  await runServer({
    config,
    tools: databaseTools,
  });
}

main().catch((error) => {
  console.error('Database server error:', error);
  process.exit(1);
});
