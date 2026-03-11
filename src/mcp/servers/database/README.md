# Database MCP Server

A built-in MCP server providing database access tools for Swarm CLI.

## Installation

```bash
npm install @swarm-cli/mcp-database
```

## Configuration

Set environment variables:

```bash
# For SQLite (default)
export DATABASE_TYPE=sqlite
export DATABASE_PATH=/path/to/database.db

# For PostgreSQL (future support)
export DATABASE_TYPE=postgres
export DATABASE_HOST=localhost
export DATABASE_PORT=5432
export DATABASE_NAME=mydb
export DATABASE_USER=user
export DATABASE_PASSWORD=password
```

## Usage

### Standalone

```bash
# Run with SQLite
DATABASE_PATH=./mydb.db npx ts-node src/mcp/servers/database/index.ts

# Or after building
DATABASE_PATH=./mydb.db node dist/database/index.js
```

### With Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "database": {
      "command": "node",
      "args": ["/path/to/swarm-cli/dist/mcp/servers/database/index.js"],
      "env": {
        "DATABASE_PATH": "/path/to/database.db"
      }
    }
  }
}
```

## Available Tools

### `db:query`

Execute a SQL query on the database.

**Parameters:**
- `sql` (string, required): SQL query to execute
- `params` (array, optional): Parameters for prepared statements

**Example:**
```json
{
  "name": "db:query",
  "arguments": {
    "sql": "SELECT * FROM users WHERE active = ?",
    "params": [true]
  }
}
```

### `db:schema`

Get the database schema (DDL statements).

**Parameters:** None

**Example:**
```json
{
  "name": "db:schema",
  "arguments": {}
}
```

### `db:tables:list`

List all tables and views in the database.

**Parameters:** None

**Example:**
```json
{
  "name": "db:tables:list",
  "arguments": {}
}
```

### `db:table:info`

Get detailed information about a table's columns.

**Parameters:**
- `table` (string, required): Name of the table

**Example:**
```json
{
  "name": "db:table:info",
  "arguments": {
    "table": "users"
  }
}
```

### `db:migrate:list`

List database migrations and their status.

**Parameters:** None

**Example:**
```json
{
  "name": "db:migrate:list",
  "arguments": {}
}
```

## Supported Databases

### SQLite (Fully Supported)
- File-based or in-memory databases
- Full schema introspection
- All query operations supported

### PostgreSQL (Planned)
- Requires additional dependencies (pg)
- Connection pooling
- Full schema introspection

### MySQL (Planned)
- Requires additional dependencies (mysql2)
- Connection pooling
- Full schema introspection

## Security Considerations

- The database server has full access to the configured database
- Use read-only database users when possible
- Never expose the server to untrusted clients
- Consider using prepared statements to prevent SQL injection
