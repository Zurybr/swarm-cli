# Built-in MCP Servers

This directory contains built-in MCP (Model Context Protocol) servers that come bundled with Swarm CLI.

## Available Servers

### 1. Filesystem Server (`filesystem/`)

Provides filesystem access tools for reading, writing, and managing files.

**Tools:**
- `filesystem:read` - Read file contents
- `filesystem:write` - Write file contents
- `filesystem:list` - List directory contents
- `filesystem:search` - Search files by pattern
- `filesystem:exists` - Check if file/directory exists
- `filesystem:delete` - Delete file/directory

[→ Full Documentation](./filesystem/README.md)

### 2. GitHub Server (`github/`)

Provides GitHub API tools for repository management.

**Tools:**
- `github:issues:list` - List issues in a repo
- `github:issues:create` - Create a new issue
- `github:issues:update` - Update an existing issue
- `github:pr:list` - List pull requests
- `github:pr:review` - Review a PR
- `github:repo:info` - Get repository information

[→ Full Documentation](./github/README.md)

### 3. Database Server (`database/`)

Provides database access tools for SQLite (with planned PostgreSQL/MySQL support).

**Tools:**
- `db:query` - Execute SQL query
- `db:schema` - Get database schema
- `db:tables:list` - List tables
- `db:table:info` - Get table information
- `db:migrate:list` - List pending migrations

[→ Full Documentation](./database/README.md)

### 4. Web Search Server (`websearch/`)

Provides web search and content fetching tools.

**Tools:**
- `web:search` - Search the web (DuckDuckGo)
- `web:fetch` - Fetch and extract content from URL
- `web:summarize` - Summarize web page content

[→ Full Documentation](./websearch/README.md)

## Running Servers

### Standalone Mode

Each server can be run standalone using stdio transport:

```bash
# Filesystem server
npx ts-node src/mcp/servers/filesystem/index.ts

# GitHub server (requires GITHUB_TOKEN)
GITHUB_TOKEN=your_token npx ts-node src/mcp/servers/github/index.ts

# Database server
DATABASE_PATH=./mydb.db npx ts-node src/mcp/servers/database/index.ts

# Web search server
npx ts-node src/mcp/servers/websearch/index.ts
```

### With Claude Desktop

Add servers to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": ["/path/to/swarm-cli/dist/mcp/servers/filesystem/index.js"]
    },
    "github": {
      "command": "node",
      "args": ["/path/to/swarm-cli/dist/mcp/servers/github/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_token"
      }
    },
    "database": {
      "command": "node",
      "args": ["/path/to/swarm-cli/dist/mcp/servers/database/index.js"],
      "env": {
        "DATABASE_PATH": "/path/to/database.db"
      }
    },
    "websearch": {
      "command": "node",
      "args": ["/path/to/swarm-cli/dist/mcp/servers/websearch/index.js"]
    }
  }
}
```

## Architecture

```
src/mcp/servers/
├── base.ts          # Base server implementation
├── types.ts         # Shared types and utilities
├── package.json     # Workspace package
├── README.md        # This file
├── filesystem/      # Filesystem server
│   ├── index.ts
│   ├── tools.ts
│   ├── package.json
│   └── README.md
├── github/          # GitHub server
│   ├── index.ts
│   ├── client.ts
│   ├── tools.ts
│   ├── package.json
│   └── README.md
├── database/        # Database server
│   ├── index.ts
│   ├── connection.ts
│   ├── tools.ts
│   ├── package.json
│   └── README.md
└── websearch/       # Web search server
    ├── index.ts
    ├── search.ts
    ├── fetch.ts
    ├── tools.ts
    ├── package.json
    └── README.md
```

## Creating Custom Servers

Use the base server implementation to create custom MCP servers:

```typescript
import { runServer } from './base.js';
import type { ServerTool } from './types.js';
import { textResult } from './types.js';

const myTools: ServerTool[] = [
  {
    definition: {
      name: 'my:tool',
      description: 'My custom tool',
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string' },
        },
        required: ['input'],
      },
    },
    handler: async (args) => {
      return textResult(`You said: ${args.input}`);
    },
  },
];

await runServer({
  config: {
    name: 'my-custom-server',
    version: '1.0.0',
    description: 'My custom MCP server',
  },
  tools: myTools,
});
```

## Environment Variables

### GitHub Server
- `GITHUB_TOKEN` - GitHub personal access token (required)
- `GITHUB_OWNER` - Default repository owner (optional)
- `GITHUB_REPO` - Default repository name (optional)

### Database Server
- `DATABASE_TYPE` - Database type: sqlite, postgres, mysql (default: sqlite)
- `DATABASE_PATH` - SQLite database path (default: :memory:)
- `DATABASE_HOST` - Database host (for postgres/mysql)
- `DATABASE_PORT` - Database port
- `DATABASE_NAME` - Database name
- `DATABASE_USER` - Database user
- `DATABASE_PASSWORD` - Database password

## Testing

Run tests for all servers:

```bash
npm test
```

Run tests for a specific server:

```bash
npm test -- filesystem
npm test -- github
npm test -- database
npm test -- websearch
```

## License

MIT
