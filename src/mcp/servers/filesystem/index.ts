/**
 * Filesystem MCP Server
 * 
 * Provides filesystem access tools for MCP clients.
 * Run standalone: npx ts-node src/mcp/servers/filesystem/index.ts
 */

import { runServer } from '../base.js';
import { filesystemTools } from './tools.js';

const config = {
  name: 'swarm-filesystem-server',
  version: '1.0.0',
  description: 'MCP server providing filesystem access tools',
};

async function main() {
  await runServer({
    config,
    tools: filesystemTools,
  });
}

main().catch((error) => {
  console.error('Filesystem server error:', error);
  process.exit(1);
});
