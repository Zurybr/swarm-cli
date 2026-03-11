# MCP SDK

High-level SDK for building custom MCP (Model Context Protocol) servers with Swarm CLI.

## Installation

```bash
npm install @swarm-cli/mcp-sdk
```

## Quick Start

```typescript
import { MCPServerBuilder, createTool } from '@swarm-cli/mcp-sdk';
import { z } from 'zod';

const server = new MCPServerBuilder({
  name: 'my-server',
  version: '1.0.0',
  description: 'My custom MCP server',
});

// Add a tool with Zod validation
server.addTool(createTool({
  name: 'greet',
  description: 'Greet someone by name',
  parameters: {
    name: z.string().describe('The name to greet'),
  },
  handler: async ({ name }) => ({
    content: [{ type: 'text', text: `Hello, ${name}!` }],
  }),
}));

// Start the server
await server.start();
```

## Features

- 🛠️ **Easy Tool Creation** - Use Zod for type-safe parameter validation
- 📦 **Resource Support** - Serve static and dynamic resources
- 💬 **Prompt Templates** - Create reusable prompt templates
- 🧪 **Testing Utilities** - Built-in testing helpers for your servers
- 🔧 **Development Mode** - Hot reload during development
- 📝 **TypeScript First** - Full TypeScript support with type inference

## Creating Tools

### Basic Tool

```typescript
import { createTool } from '@swarm-cli/mcp-sdk';
import { z } from 'zod';

const echoTool = createTool({
  name: 'echo',
  description: 'Echo back the input',
  parameters: {
    message: z.string().describe('Message to echo'),
  },
  handler: async ({ message }) => ({
    content: [{ type: 'text', text: message }],
  }),
});
```

### Common Tool Patterns

The SDK provides helpers for common tool patterns:

#### Fetch Tool (API Calls)

```typescript
import { createFetchTool } from '@swarm-cli/mcp-sdk';

const apiTool = createFetchTool('api', 'https://api.example.com', {
  headers: { 'Authorization': 'Bearer token' },
  methods: ['GET', 'POST'],
});
```

#### Command Tool (Shell Commands)

```typescript
import { createCommandTool } from '@swarm-cli/mcp-sdk';

const shellTool = createCommandTool('shell', ['ls', 'cat', 'echo']);
```

#### Database Query Tool

```typescript
import { createQueryTool } from '@swarm-cli/mcp-sdk';

const dbTool = createQueryTool('db', {
  query: async (sql, params) => {
    // Execute query and return results
    return results;
  },
});
```

#### File Read Tool

```typescript
import { createFileReadTool } from '@swarm-cli/mcp-sdk';

const fileTool = createFileReadTool(
  'read-file',
  '/safe/base/path',
  ['.txt', '.json', '.md']
);
```

## Creating Resources

### Static Resource

```typescript
import { createStaticResource } from '@swarm-cli/mcp-sdk';

const readmeResource = createStaticResource(
  'file://readme',
  'README',
  '# Documentation\n\nThis is my server...',
  'text/markdown'
);
```

### Dynamic Resource

```typescript
import { createDynamicResource } from '@swarm-cli/mcp-sdk';

const timeResource = createDynamicResource(
  'time://now',
  'Current Time',
  async () => ({
    text: new Date().toISOString(),
    mimeType: 'text/plain',
  }),
  'text/plain',
  'Returns the current time'
);
```

### JSON Resource

```typescript
import { createJSONResource } from '@swarm-cli/mcp-sdk';

const configResource = createJSONResource(
  'config://settings',
  'Server Configuration',
  { version: '1.0.0', debug: false }
);
```

## Creating Prompts

### Basic Prompt

```typescript
import { createPrompt } from '@swarm-cli/mcp-sdk';

const codeReviewPrompt = createPrompt(
  'code-review',
  'Review code for issues',
  [
    { name: 'code', description: 'Code to review', required: true },
    { name: 'language', description: 'Programming language' },
  ],
  async ({ code, language }) => ({
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: `Review this ${language || ''} code:\n\n${code}` },
      },
    ],
  })
);
```

### Built-in Prompts

```typescript
import {
  createCodeAnalysisPrompt,
  createDocGenerationPrompt,
  createCodeReviewPrompt,
} from '@swarm-cli/mcp-sdk';

server.addPrompt(createCodeAnalysisPrompt());
server.addPrompt(createDocGenerationPrompt());
server.addPrompt(createCodeReviewPrompt());
```

## Server Lifecycle

### Events

```typescript
server.on('server:start', () => {
  console.log('Server started');
});

server.on('tool:call', (name, args) => {
  console.log(`Tool called: ${name}`);
});

server.on('tool:error', (name, error) => {
  console.error(`Tool error: ${name}`, error);
});
```

### Statistics

```typescript
const stats = server.getStats();
console.log(`Tools: ${stats.tools}`);
console.log(`Resources: ${stats.resources}`);
console.log(`Prompts: ${stats.prompts}`);
console.log(`Running: ${stats.running}`);
```

## Testing

### Using the Test Client

```typescript
import { MCPTestClient, testTool } from '@swarm-cli/mcp-sdk/testing';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('My MCP Server', () => {
  const client = new MCPTestClient('./dist/index.js');

  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
  });

  it('should list tools', async () => {
    const tools = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should call greet tool', async () => {
    const result = await testTool(client, 'greet', { name: 'World' }, {
      containsText: 'Hello, World!',
    });
    expect(result.isError).toBeFalsy();
  });
});
```

### Test Fixture Helper

```typescript
import { createMCPTestFixture } from '@swarm-cli/mcp-sdk/testing';

describe('My Server', () => {
  const fixture = createMCPTestFixture('./dist/index.js');

  beforeAll(async () => {
    await fixture.setup();
  });

  afterAll(async () => {
    await fixture.teardown();
  });

  it('should work', async () => {
    const tools = await fixture.client.listTools();
    expect(tools).toBeDefined();
  });
});
```

## CLI Commands

### Create New Project

```bash
swarm-cli mcp init my-server
cd my-server
npm install
npm run build
npm start
```

### Development Mode

```bash
swarm-cli mcp dev
# Watches for changes and rebuilds/restarts
```

## Configuration

Add your server to Swarm CLI config:

```yaml
# ~/.config/swarm-cli/config.yaml
mcp:
  servers:
    my-server:
      command: node
      args: ["/path/to/my-server/dist/index.js"]
```

## API Reference

### MCPServerBuilder

| Method | Description |
|--------|-------------|
| `addTool(tool)` | Add a tool to the server |
| `addTools(tools)` | Add multiple tools |
| `removeTool(name)` | Remove a tool |
| `addResource(resource)` | Add a resource |
| `addResources(resources)` | Add multiple resources |
| `removeResource(uri)` | Remove a resource |
| `addPrompt(prompt)` | Add a prompt |
| `addPrompts(prompts)` | Add multiple prompts |
| `removePrompt(name)` | Remove a prompt |
| `start(transport?)` | Start the server |
| `stop()` | Stop the server |
| `getTools()` | Get registered tools |
| `getResources()` | Get registered resources |
| `getPrompts()` | Get registered prompts |
| `getStats()` | Get server statistics |
| `isRunning()` | Check if server is running |
| `on(event, handler)` | Listen for events |

### Tool Helpers

| Function | Description |
|----------|-------------|
| `createTool(config)` | Create tool with Zod validation |
| `createTextTool(...)` | Create simple text-returning tool |
| `createFetchTool(...)` | Create API fetch tool |
| `createCommandTool(...)` | Create shell command tool |
| `createQueryTool(...)` | Create database query tool |
| `createFileReadTool(...)` | Create file reading tool |
| `createTransformTool(...)` | Create data transformation tool |

### Resource Helpers

| Function | Description |
|----------|-------------|
| `createStaticResource(...)` | Create static resource |
| `createDynamicResource(...)` | Create dynamic resource |
| `createFileResource(...)` | Create file-based resource |
| `createJSONResource(...)` | Create JSON resource |
| `createDirectoryResource(...)` | Create directory listing |

### Prompt Helpers

| Function | Description |
|----------|-------------|
| `createStaticPrompt(...)` | Create static prompt |
| `createPrompt(...)` | Create parameterized prompt |
| `createConversationPrompt(...)` | Create multi-turn prompt |
| `createSystemPrompt(...)` | Create system instruction |
| `createTemplatePrompt(...)` | Create template-based prompt |

## License

MIT
