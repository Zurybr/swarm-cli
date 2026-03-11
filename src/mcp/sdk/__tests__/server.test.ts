/**
 * SDK Server Tests - Issue #24.6
 * Tests for MCPServerBuilder
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MCPServerBuilder } from '../server.js';
import { createTool } from '../tools.js';
import { z } from 'zod';

describe('MCPServerBuilder', () => {
  let builder: MCPServerBuilder;

  beforeEach(() => {
    builder = new MCPServerBuilder({
      name: 'test-server',
      version: '1.0.0',
      description: 'Test server for SDK tests',
    });
  });

  describe('constructor', () => {
    it('should create a server builder with options', () => {
      expect(builder).toBeDefined();
      expect(builder.getInfo().name).toBe('test-server');
      expect(builder.getInfo().version).toBe('1.0.0');
    });
  });

  describe('addTool', () => {
    it('should add a tool', () => {
      const tool = createTool({
        name: 'test',
        description: 'Test tool',
        parameters: {
          input: z.string(),
        },
        handler: async () => ({
          content: [{ type: 'text', text: 'ok' }],
        }),
      });

      builder.addTool(tool);
      const tools = builder.getTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test');
    });

    it('should allow method chaining', () => {
      const tool = createTool({
        name: 'test',
        description: 'Test tool',
        parameters: {},
        handler: async () => ({
          content: [{ type: 'text', text: 'ok' }],
        }),
      });

      const result = builder.addTool(tool);
      expect(result).toBe(builder);
    });
  });

  describe('addTools', () => {
    it('should add multiple tools', () => {
      const tools = [
        createTool({
          name: 'tool1',
          description: 'Tool 1',
          parameters: {},
          handler: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
        }),
        createTool({
          name: 'tool2',
          description: 'Tool 2',
          parameters: {},
          handler: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
        }),
      ];

      builder.addTools(tools);
      expect(builder.getTools()).toHaveLength(2);
    });
  });

  describe('removeTool', () => {
    it('should remove a tool', () => {
      const tool = createTool({
        name: 'test',
        description: 'Test tool',
        parameters: {},
        handler: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
      });

      builder.addTool(tool);
      expect(builder.getTools()).toHaveLength(1);

      builder.removeTool('test');
      expect(builder.getTools()).toHaveLength(0);
    });
  });

  describe('addResource', () => {
    it('should add a resource', () => {
      builder.addResource({
        uri: 'test://resource',
        name: 'Test Resource',
        handler: async () => ({
          uri: 'test://resource',
          text: 'content',
        }),
      });

      const resources = builder.getResources();
      expect(resources).toHaveLength(1);
      expect(resources[0].uri).toBe('test://resource');
    });
  });

  describe('addPrompt', () => {
    it('should add a prompt', () => {
      builder.addPrompt({
        name: 'test-prompt',
        description: 'Test prompt',
        handler: async () => ({
          messages: [{ role: 'user', content: { type: 'text', text: 'test' } }],
        }),
      });

      const prompts = builder.getPrompts();
      expect(prompts).toHaveLength(1);
      expect(prompts[0].name).toBe('test-prompt');
    });
  });

  describe('getStats', () => {
    it('should return server statistics', () => {
      builder.addTool(createTool({
        name: 'tool1',
        description: 'Tool 1',
        parameters: {},
        handler: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
      }));

      builder.addResource({
        uri: 'test://resource',
        name: 'Resource',
        handler: async () => ({ uri: 'test://resource', text: 'content' }),
      });

      builder.addPrompt({
        name: 'prompt1',
        handler: async () => ({ messages: [] }),
      });

      const stats = builder.getStats();

      expect(stats.tools).toBe(1);
      expect(stats.resources).toBe(1);
      expect(stats.prompts).toBe(1);
      expect(stats.running).toBe(false);
    });
  });

  describe('isRunning', () => {
    it('should return false when not started', () => {
      expect(builder.isRunning()).toBe(false);
    });
  });
});
