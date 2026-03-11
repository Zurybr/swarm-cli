/**
 * Web Search MCP Server
 * 
 * Provides web search and content fetching tools for MCP clients.
 * Run standalone: npx ts-node src/mcp/servers/websearch/index.ts
 */

import { runServer } from '../base.js';
import { webSearchTools } from './tools.js';

const config = {
  name: 'swarm-websearch-server',
  version: '1.0.0',
  description: 'MCP server providing web search and content fetching tools',
};

async function main() {
  await runServer({
    config,
    tools: webSearchTools,
  });
}

main().catch((error) => {
  console.error('Web search server error:', error);
  process.exit(1);
});
