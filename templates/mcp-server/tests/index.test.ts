import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPTestClient, testTool } from '@swarm-cli/mcp-sdk/testing';

describe('{{name}}', () => {
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
    expect(tools.find((t) => t.name === 'greet')).toBeDefined();
  });

  it('should greet by name', async () => {
    const result = await testTool(client, 'greet', { name: 'World' }, {
      containsText: 'Hello, World!',
    });
    expect(result.isError).toBeFalsy();
  });

  it('should use formal greeting', async () => {
    const result = await testTool(client, 'greet', { 
      name: 'World', 
      formal: true 
    }, {
      containsText: 'Good day',
    });
    expect(result.isError).toBeFalsy();
  });
});
