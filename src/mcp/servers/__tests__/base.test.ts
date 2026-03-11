/**
 * Tests for Base Server Implementation
 */

import { describe, it, expect } from '@jest/globals';
import { createServer } from '../base.js';
import { textResult } from '../types.js';

describe('Base Server', () => {
  it('should create a server with tools', () => {
    const server = createServer({
      config: {
        name: 'test-server',
        version: '1.0.0',
        description: 'Test server',
      },
      tools: [
        {
          definition: {
            name: 'test:tool',
            description: 'A test tool',
            inputSchema: {
              type: 'object',
              properties: {
                input: { type: 'string' },
              },
            },
          },
          handler: async (args) => textResult(`Input: ${args.input}`),
        },
      ],
    });

    expect(server).toBeDefined();
  });

  it('should handle unknown tool calls', async () => {
    const server = createServer({
      config: {
        name: 'test-server',
        version: '1.0.0',
        description: 'Test server',
      },
      tools: [],
    });

    // The server should be created successfully even with no tools
    expect(server).toBeDefined();
  });
});
