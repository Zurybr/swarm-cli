# MCP Marketplace

A marketplace system for discovering, installing, and managing MCP (Model Context Protocol) servers in Swarm CLI.

## Overview

The MCP Marketplace provides a centralized way to:
- **Discover** MCP servers from a curated registry
- **Install** servers with a single command
- **Configure** servers interactively
- **Manage** installed servers (update, uninstall, test)

## Features

### 🔍 Server Discovery
- Fuzzy search by name, description, or tags
- Filter by category, runtime, or installation status
- Browse the full registry or by tags

### 📦 Installation Management
- Install from npm registry
- Support for Node.js, Python, and binary runtimes
- Automatic dependency installation
- Version pinning and updates

### ⚙️ Interactive Configuration
- Guided setup wizard
- Environment variable management
- Configuration schema validation
- Connection testing

### 📊 Registry Management
- Local registry caching
- Remote registry updates
- Custom server additions
- Statistics and insights

## Usage

### Search for Servers

```bash
# Search by name or description
swarm-cli mcp search filesystem

# Filter by tag
swarm-cli mcp search --tag database

# Show only installed servers
swarm-cli mcp search --installed

# Output as JSON
swarm-cli mcp search github --json
```

### Install Servers

```bash
# Install a server
swarm-cli mcp install filesystem

# Install specific version
swarm-cli mcp install github --version 2.0.0

# Install globally
swarm-cli mcp install postgres --global

# Install with initial config
swarm-cli mcp install github --config '{"token":"xxx"}'

# Development mode (link local path)
swarm-cli mcp install ./my-server --dev
```

### Configure Servers

```bash
# Interactive configuration
swarm-cli mcp config github

# The wizard will guide you through:
# 1. Installation (if not installed)
# 2. Required environment variables
# 3. Optional configuration
# 4. Connection testing
```

### List Installed Servers

```bash
# List all installed servers
swarm-cli mcp list

# Output as JSON
swarm-cli mcp list --json
```

### Show Server Details

```bash
# View detailed information
swarm-cli mcp info filesystem
```

### Update Servers

```bash
# Update a specific server
swarm-cli mcp update filesystem

# Update all servers
swarm-cli mcp update --all

# Check for updates without installing
swarm-cli mcp update --check
```

### Remove Servers

```bash
# Uninstall a server
swarm-cli mcp remove filesystem
```

### Test Connections

```bash
# Test if a server is working
swarm-cli mcp test github
```

### Interactive Marketplace

```bash
# Browse servers interactively
swarm-cli mcp marketplace
```

### Registry Management

```bash
# Update registry from remote
swarm-cli mcp registry update

# Show registry statistics
swarm-cli mcp registry stats

# List available tags
swarm-cli mcp registry tags
```

### Version Management

```bash
# View changelog
swarm-cli mcp changelog filesystem

# Pin to specific version
swarm-cli mcp pin github 1.5.0
```

## Configuration

### Registry Location

The registry is stored at:
```
~/.config/swarm-cli/mcp-registry.json
```

### Server Configuration

Servers are configured in:
```
~/.config/swarm-cli/config.yaml
```

Example configuration:
```yaml
mcp:
  servers:
    filesystem:
      name: filesystem
      command: npx
      args:
        - "-y"
        - "@modelcontextprotocol/server-filesystem"
        - "/home/user/projects"
    
    github:
      name: github
      command: npx
      args:
        - "-y"
        - "@modelcontextprotocol/server-github"
      env:
        GITHUB_PERSONAL_ACCESS_TOKEN: ${GITHUB_TOKEN}
```

## Architecture

### Components

1. **Registry Manager** (`registry.ts`)
   - Manages the server registry
   - Provides search and filtering
   - Handles caching and updates

2. **Installer** (`installer.ts`)
   - Installs/uninstalls servers
   - Manages package dependencies
   - Runs security scans

3. **Config Wizard** (`wizard.ts`)
   - Interactive configuration
   - Environment variable setup
   - Connection testing

4. **Version Manager** (`version.ts`)
   - Version checking
   - Changelog retrieval
   - Version pinning

### Registry Structure

```typescript
interface MCPRegistryEntry {
  name: string;              // Unique identifier
  displayName: string;       // Human-readable name
  description: string;       // What it does
  version: string;           // Current version
  author: string;            // Author/organization
  package: string;           // npm package or URL
  tags: string[];            // Categories
  runtime: 'node' | 'python' | 'binary';
  configSchema?: JSONSchema; // Configuration schema
  requiredEnv?: string[];    // Required env vars
  installed?: boolean;       // Installation status
  installedVersion?: string; // Installed version
}
```

## Adding Custom Servers

### Via CLI

```bash
# Install directly from npm
swarm-cli mcp install @my-org/mcp-custom-server
```

### Programmatically

```typescript
import { MCPRegistryManager } from './mcp/marketplace';

const registry = new MCPRegistryManager();

await registry.add({
  name: 'my-custom-server',
  displayName: 'My Custom Server',
  description: 'A custom MCP server',
  version: '1.0.0',
  author: 'Me',
  package: '@me/mcp-custom',
  tags: ['custom'],
  runtime: 'node',
});
```

## Available Servers

The default registry includes:

- **filesystem** - File system access
- **github** - GitHub API integration
- **postgres** - PostgreSQL database
- **sqlite** - SQLite database
- **puppeteer** - Browser automation
- **fetch** - HTTP requests
- **brave-search** - Web search
- **google-maps** - Location services
- **slack** - Slack integration
- **memory** - Knowledge graph storage

## Extending the Registry

### Adding New Servers

1. Add entry to `resources/mcp-registry.json`
2. Include all required fields
3. Provide config schema if applicable
4. List required environment variables

Example:
```json
{
  "name": "my-server",
  "displayName": "My Server",
  "description": "Does something useful",
  "version": "1.0.0",
  "author": "Your Name",
  "package": "@org/mcp-server",
  "tags": ["utility", "custom"],
  "runtime": "node",
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": {
        "type": "string",
        "description": "API key for service"
      }
    },
    "required": ["apiKey"]
  }
}
```

## Security

### Security Scans

The installer automatically runs:
- Dependency vulnerability checks (npm audit)
- Environment variable validation
- Configuration schema validation

### Best Practices

1. **Review before installing** - Check the server's repository
2. **Use environment variables** - Never hardcode secrets
3. **Limit permissions** - Only grant necessary access
4. **Keep updated** - Regularly update servers
5. **Test connections** - Verify servers work after configuration

## Troubleshooting

### Server Won't Start

```bash
# Test the connection
swarm-cli mcp test server-name

# Check configuration
swarm-cli mcp info server-name

# View logs
# Check the server's own logs for errors
```

### Installation Fails

```bash
# Try with verbose output
npm install -g @package/name --verbose

# Check npm registry
npm view @package/name

# Clear npm cache
npm cache clean --force
```

### Configuration Issues

```bash
# Reconfigure
swarm-cli mcp config server-name

# Check config file
cat ~/.config/swarm-cli/config.yaml

# Validate environment variables
echo $GITHUB_TOKEN
```

## Development

### Running Tests

```bash
# Run all marketplace tests
npm test -- mcp/marketplace

# Run specific test file
npm test -- registry.test.ts
```

### Building

```bash
# Build the project
npm run build
```

### Adding Tests

Tests are located in `src/mcp/marketplace/__tests__/`:
- `registry.test.ts` - Registry manager tests
- `installer.test.ts` - Installation tests
- `wizard.test.ts` - Configuration wizard tests

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add your changes
4. Write tests
5. Submit a pull request

## License

MIT
