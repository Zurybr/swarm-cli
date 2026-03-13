#!/usr/bin/env node

/**
 * Swarm MCP Server
 *
 * MCP server providing Swarm CLI tools for opencode integration.
 * This enables the /swarm command in opencode.
 *
 * Run standalone: npx ts-node src/mcp/servers/swarm/index.ts
 */

import { runServer } from '../base.js';
import { swarmTools } from './tools.js';

const config = {
  name: 'opencode-swarm-plugin',
  version: '0.1.0',
  description: 'MCP server providing Swarm CLI orchestration tools for opencode',
};

async function main() {
  await runServer({
    config,
    tools: swarmTools,
  });
}

main().catch((error) => {
  console.error('Swarm MCP server error:', error);
  process.exit(1);
});
