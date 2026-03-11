# Filesystem MCP Server

A built-in MCP server providing filesystem access tools for Swarm CLI.

## Installation

```bash
npm install @swarm-cli/mcp-filesystem
```

## Usage

### Standalone

```bash
# Run directly with ts-node
npx ts-node src/mcp/servers/filesystem/index.ts

# Or after building
node dist/filesystem/index.js
```

### With Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": ["/path/to/swarm-cli/dist/mcp/servers/filesystem/index.js"]
    }
  }
}
```

## Available Tools

### `filesystem:read`

Read the contents of a file.

**Parameters:**
- `path` (string, required): Path to the file to read

**Example:**
```json
{
  "name": "filesystem:read",
  "arguments": {
    "path": "/home/user/project/src/index.ts"
  }
}
```

### `filesystem:write`

Write content to a file. Creates parent directories if needed.

**Parameters:**
- `path` (string, required): Path to the file to write
- `content` (string, required): Content to write

**Example:**
```json
{
  "name": "filesystem:write",
  "arguments": {
    "path": "/home/user/project/src/new-file.ts",
    "content": "export const hello = 'world';"
  }
}
```

### `filesystem:list`

List contents of a directory.

**Parameters:**
- `path` (string, optional): Path to the directory (default: current directory)
- `recursive` (boolean, optional): List recursively (default: false)

**Example:**
```json
{
  "name": "filesystem:list",
  "arguments": {
    "path": "/home/user/project/src",
    "recursive": true
  }
}
```

### `filesystem:search`

Search for files matching a regex pattern.

**Parameters:**
- `pattern` (string, required): Regex pattern to match file names
- `path` (string, optional): Starting directory (default: current directory)
- `recursive` (boolean, optional): Search recursively (default: true)

**Example:**
```json
{
  "name": "filesystem:search",
  "arguments": {
    "pattern": "\\.test\\.ts$",
    "path": "/home/user/project"
  }
}
```

### `filesystem:exists`

Check if a file or directory exists.

**Parameters:**
- `path` (string, required): Path to check

**Example:**
```json
{
  "name": "filesystem:exists",
  "arguments": {
    "path": "/home/user/project/package.json"
  }
}
```

### `filesystem:delete`

Delete a file or directory.

**Parameters:**
- `path` (string, required): Path to delete
- `recursive` (boolean, optional): For directories, delete recursively (default: false)

**Example:**
```json
{
  "name": "filesystem:delete",
  "arguments": {
    "path": "/home/user/project/old-file.ts"
  }
}
```

## Security Considerations

- The filesystem server has full access to the filesystem
- Consider restricting access using containerization or permissions
- Never expose the server to untrusted clients
