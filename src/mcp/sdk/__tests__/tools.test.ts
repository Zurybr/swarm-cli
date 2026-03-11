/**
 * SDK Tools Tests - Issue #24.6
 * Tests for tool creation helpers
 */

import { describe, it, expect } from '@jest/globals';
import {
  createTool,
  createTextTool,
  textContent,
  imageContent,
  resourceContent,
} from '../tools.js';
import { z } from 'zod';

describe('createTool', () => {
  it('should create a tool with Zod validation', async () => {
    const tool = createTool({
      name: 'greet',
      description: 'Greet someone',
      parameters: {
        name: z.string().describe('Name to greet'),
      },
      handler: async ({ name }) => ({
        content: [{ type: 'text', text: `Hello, ${name}!` }],
      }),
    });

    expect(tool.name).toBe('greet');
    expect(tool.description).toBe('Greet someone');
    expect(tool.inputSchema.type).toBe('object');
    expect(tool.inputSchema.properties.name).toBeDefined();

    const result = await tool.handler({ name: 'World' });
    expect(result.content[0].text).toBe('Hello, World!');
    expect(result.isError).toBeFalsy();
  });

  it('should validate input with Zod schema', async () => {
    const tool = createTool({
      name: 'add',
      description: 'Add two numbers',
      parameters: {
        a: z.number(),
        b: z.number(),
      },
      handler: async ({ a, b }) => ({
        content: [{ type: 'text', text: String(a + b) }],
      }),
    });

    // Valid input
    const result = await tool.handler({ a: 1, b: 2 });
    expect(result.content[0].text).toBe('3');

    // Invalid input should throw
    await expect(tool.handler({ a: 'not a number', b: 2 })).rejects.toThrow();
  });

  it('should handle optional parameters', async () => {
    const tool = createTool({
      name: 'optional',
      description: 'Test optional params',
      parameters: {
        required: z.string(),
        optional: z.string().optional(),
      },
      handler: async ({ required, optional }) => ({
        content: [{
          type: 'text',
          text: `required: ${required}, optional: ${optional ?? 'none'}`,
        }],
      }),
    });

    const result = await tool.handler({ required: 'test' });
    expect(result.content[0].text).toBe('required: test, optional: none');
  });

  it('should handle default values', async () => {
    const tool = createTool({
      name: 'default',
      description: 'Test default values',
      parameters: {
        value: z.string().default('default'),
      },
      handler: async ({ value }) => ({
        content: [{ type: 'text', text: value }],
      }),
    });

    const result = await tool.handler({});
    expect(result.content[0].text).toBe('default');
  });
});

describe('createTextTool', () => {
  it('should create a simple text-returning tool', async () => {
    const tool = createTextTool(
      'echo',
      'Echo the input',
      {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
        required: ['message'],
      },
      async (args) => `Echo: ${args.message}`
    );

    expect(tool.name).toBe('echo');
    const result = await tool.handler({ message: 'hello' });
    expect(result.content[0].text).toBe('Echo: hello');
  });
});

describe('content helpers', () => {
  it('should create text content', () => {
    const content = textContent('Hello');
    expect(content.type).toBe('text');
    expect(content.text).toBe('Hello');
  });

  it('should create image content', () => {
    const content = imageContent('base64data', 'image/png');
    expect(content.type).toBe('image');
    expect(content.data).toBe('base64data');
    expect(content.mimeType).toBe('image/png');
  });

  it('should create resource content', () => {
    const content = resourceContent('file://test', 'content', 'text/plain');
    expect(content.type).toBe('resource');
    expect(content.resource?.uri).toBe('file://test');
  });
});
