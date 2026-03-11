/**
 * GitHub MCP Server
 * 
 * Provides GitHub API tools for MCP clients.
 * Run standalone: npx ts-node src/mcp/servers/github/index.ts
 * 
 * Environment variables:
 * - GITHUB_TOKEN: GitHub personal access token (required for most operations)
 * - GITHUB_OWNER: Default repository owner
 * - GITHUB_REPO: Default repository name
 */

import { runServer } from '../base.js';
import { githubTools } from './tools.js';

const config = {
  name: 'swarm-github-server',
  version: '1.0.0',
  description: 'MCP server providing GitHub API tools',
};

async function main() {
  // Check for token
  if (!process.env.GITHUB_TOKEN) {
    console.error('Warning: GITHUB_TOKEN environment variable not set.');
    console.error('Most GitHub operations will fail without authentication.');
  }

  await runServer({
    config,
    tools: githubTools,
  });
}

main().catch((error) => {
  console.error('GitHub server error:', error);
  process.exit(1);
});
