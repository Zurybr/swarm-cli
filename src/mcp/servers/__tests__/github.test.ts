/**
 * Tests for GitHub MCP Server
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { githubTools } from '../github/tools.js';
import { getGitHubClient, resetGitHubClient } from '../github/client.js';

// Mock Octokit
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    issues: {
      listForRepo: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    pulls: {
      list: jest.fn(),
      get: jest.fn(),
      createReview: jest.fn(),
    },
    repos: {
      get: jest.fn(),
    },
  })),
}));

// Helper to call a tool
async function callTool(name: string, args: Record<string, unknown>) {
  const tool = githubTools.find(t => t.definition.name === name);
  if (!tool) throw new Error(`Tool ${name} not found`);
  return tool.handler(args);
}

describe('GitHub MCP Server', () => {
  beforeEach(() => {
    resetGitHubClient();
    jest.clearAllMocks();
  });

  describe('Tool Definitions', () => {
    it('should have all required tools', () => {
      const toolNames = githubTools.map(t => t.definition.name);
      
      expect(toolNames).toContain('github:issues:list');
      expect(toolNames).toContain('github:issues:create');
      expect(toolNames).toContain('github:issues:update');
      expect(toolNames).toContain('github:pr:list');
      expect(toolNames).toContain('github:pr:review');
      expect(toolNames).toContain('github:repo:info');
    });

    it('should have valid input schemas', () => {
      for (const tool of githubTools) {
        expect(tool.definition.inputSchema).toHaveProperty('type', 'object');
        expect(tool.definition.inputSchema).toHaveProperty('properties');
      }
    });
  });

  describe('github:issues:create', () => {
    it('should require title', async () => {
      const result = await callTool('github:issues:create', {
        repo: 'owner/repo',
        body: 'Issue body without title',
      });

      expect(result.isError).toBe(true);
      if ('text' in result.content[0]) {
        expect(result.content[0].text).toContain('Title is required');
      }
    });
  });

  describe('github:issues:update', () => {
    it('should require issueNumber', async () => {
      const result = await callTool('github:issues:update', {
        repo: 'owner/repo',
        title: 'New title',
      });

      expect(result.isError).toBe(true);
      if ('text' in result.content[0]) {
        expect(result.content[0].text).toContain('Issue number is required');
      }
    });
  });

  describe('github:pr:review', () => {
    it('should require prNumber', async () => {
      const result = await callTool('github:pr:review', {
        repo: 'owner/repo',
      });

      expect(result.isError).toBe(true);
      if ('text' in result.content[0]) {
        expect(result.content[0].text).toContain('PR number is required');
      }
    });
  });
});
