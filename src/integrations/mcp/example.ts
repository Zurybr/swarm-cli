/**
 * MCP Example - Issue #24
 * Example usage of the MCP client and integration
 */

import { MCPClientImpl, MCPServerManager, InMemoryToolRegistry, registerMCPTools } from './index';
import { MCPServerConfig } from './types';

async function main() {
  console.log('=== MCP Client Example ===\n');

  // Example 1: Single server connection
  console.log('Example 1: Single Server Connection\n');
  await example1();

  // Example 2: Multiple servers with manager
  console.log('\nExample 2: Multiple Servers with Manager\n');
  await example2();

  // Example 3: Tool registry integration
  console.log('\nExample 3: Tool Registry Integration\n');
  await example3();
}

/**
 * Example 1: Connect to a single MCP server
 */
async function example1() {
  const client = new MCPClientImpl({ debug: true });

  // Configure the server
  const serverConfig: MCPServerConfig = {
    name: 'filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    transport: 'stdio',
  };

  try {
    console.log('Connecting to MCP server...');
    await client.connect(serverConfig);
    console.log('Connected!');

    // Get server info
    const serverInfo = client.getServerInfo();
    console.log('Server info:', serverInfo);

    // List tools
    const tools = await client.listTools();
    console.log(`Found ${tools.length} tools:`);
    tools.forEach((tool) => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    // List resources
    const resources = await client.listResources();
    console.log(`Found ${resources.length} resources:`);
    resources.forEach((resource) => {
      console.log(`  - ${resource.uri} (${resource.name})`);
    });

    // Call a tool (if available)
    if (tools.length > 0) {
      const firstTool = tools[0];
      console.log(`\nCalling tool: ${firstTool.name}...`);
      try {
        const result = await client.callTool(firstTool.name, {});
        console.log('Result:', result);
      } catch (error) {
        console.log('Tool call error (expected for invalid args):', (error as Error).message);
      }
    }

  } catch (error) {
    console.error('Error:', (error as Error).message);
  } finally {
    client.disconnect();
    console.log('Disconnected.');
  }
}

/**
 * Example 2: Manage multiple MCP servers
 */
async function example2() {
  const manager = new MCPServerManager({
    autoRefresh: false,
    clientOptions: { debug: false },
  });

  // Configure multiple servers
  const servers: MCPServerConfig[] = [
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    },
    // Add more servers as needed
    // {
    //   name: 'github',
    //   command: 'npx',
    //   args: ['-y', '@modelcontextprotocol/server-github'],
    //   env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN },
    // },
  ];

  try {
    console.log('Adding servers...');
    for (const config of servers) {
      try {
        await manager.addServer(config);
        console.log(`  Added: ${config.name}`);
      } catch (error) {
        console.log(`  Failed to add ${config.name}: ${(error as Error).message}`);
      }
    }

    // List all servers
    console.log('\nServer status:');
    const serverList = manager.listServers();
    serverList.forEach((server) => {
      console.log(
        `  ${server.name}: ${server.connected ? 'connected' : 'disconnected'} ` +
        `(${server.toolCount} tools, ${server.resourceCount} resources)`
      );
    });

    // Get all tools
    const allTools = await manager.listAllTools();
    console.log('\nAll tools:');
    for (const [serverName, tools] of Array.from(allTools.entries())) {
      console.log(`  ${serverName}:`);
      tools.forEach((tool) => {
        console.log(`    - ${tool.name}`);
      });
    }

    // Get stats
    const stats = manager.getStats();
    console.log('\nStats:', stats);

  } finally {
    await manager.clear();
    console.log('Manager cleared.');
  }
}

/**
 * Example 3: Integrate MCP tools with Swarm tool registry
 */
async function example3() {
  // Create a tool registry
  const registry = new InMemoryToolRegistry();

  // Create MCP client
  const client = new MCPClientImpl({ debug: false });

  const serverConfig: MCPServerConfig = {
    name: 'filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  };

  try {
    console.log('Connecting and registering tools...');
    await client.connect(serverConfig);

    // Register MCP tools in the registry
    const registrations = registerMCPTools(client, 'filesystem', registry);
    console.log(`Registered ${registrations.length} tools:`);
    registrations.forEach((reg) => {
      console.log(`  - ${reg.fullName}`);
    });

    // List all tools in registry
    console.log('\nAll tools in registry:');
    registry.getAll().forEach((tool) => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    // Call a tool through the registry
    const echoTool = registry.get('mcp:filesystem:list_directory');
    if (echoTool) {
      console.log('\nCalling list_directory tool...');
      const result = await echoTool.handler({ path: '/tmp' });
      console.log('Result:', result.success ? 'Success' : 'Failed');
      if (result.content) {
        console.log('Content preview:', result.content.substring(0, 200));
      }
    }

  } catch (error) {
    console.error('Error:', (error as Error).message);
  } finally {
    client.disconnect();
    console.log('Done.');
  }
}

// Run the examples
main().catch(console.error);
