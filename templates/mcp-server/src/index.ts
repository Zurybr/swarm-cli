#!/usr/bin/env node

import { MCPServerBuilder, createTool } from '@swarm-cli/mcp-sdk';
import { z } from 'zod';

const server = new MCPServerBuilder({
  name: '{{name}}',
  version: '1.0.0',
  description: '{{description}}',
});

// Example tool: greet
server.addTool(
  createTool({
    name: 'greet',
    description: 'Greet someone by name',
    parameters: {
      name: z.string().describe('The name to greet'),
      formal: z.boolean().optional().describe('Use formal greeting'),
    },
    handler: async ({ name, formal }) => {
      const greeting = formal ? 'Good day' : 'Hello';
      return {
        content: [
          {
            type: 'text',
            text: `${greeting}, ${name}!`,
          },
        ],
      };
    },
  })
);

// Add more tools here...

// Start the server
server.start().catch((error) => {
  console.error('Server failed:', error);
  process.exit(1);
});
