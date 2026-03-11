/**
 * Tests for Web Search MCP Server
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { webSearchTools } from '../websearch/tools.js';

// Mock fetch functions
jest.mock('../websearch/search.js', () => ({
  search: jest.fn(),
  fetchUrl: jest.fn(),
}));

jest.mock('../websearch/fetch.js', () => ({
  fetchAndExtract: jest.fn(),
  summarizeContent: jest.fn(),
}));

import { search } from '../websearch/search.js';
import { fetchAndExtract, summarizeContent } from '../websearch/fetch.js';

const mockSearch = search as jest.MockedFunction<typeof search>;
const mockFetchAndExtract = fetchAndExtract as jest.MockedFunction<typeof fetchAndExtract>;
const mockSummarizeContent = summarizeContent as jest.MockedFunction<typeof summarizeContent>;

// Helper to call a tool
async function callTool(name: string, args: Record<string, unknown>) {
  const tool = webSearchTools.find(t => t.definition.name === name);
  if (!tool) throw new Error(`Tool ${name} not found`);
  return tool.handler(args);
}

describe('Web Search MCP Server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Tool Definitions', () => {
    it('should have all required tools', () => {
      const toolNames = webSearchTools.map(t => t.definition.name);
      
      expect(toolNames).toContain('web:search');
      expect(toolNames).toContain('web:fetch');
      expect(toolNames).toContain('web:summarize');
    });

    it('should have valid input schemas', () => {
      for (const tool of webSearchTools) {
        expect(tool.definition.inputSchema).toHaveProperty('type', 'object');
        expect(tool.definition.inputSchema).toHaveProperty('properties');
      }
    });
  });

  describe('web:search', () => {
    it('should require query', async () => {
      const result = await callTool('web:search', {});

      expect(result.isError).toBe(true);
      if ('text' in result.content[0]) {
        expect(result.content[0].text).toContain('Search query is required');
      }
    });

    it('should return search results', async () => {
      mockSearch.mockResolvedValueOnce([
        { title: 'Result 1', url: 'https://example.com/1', description: 'Description 1' },
        { title: 'Result 2', url: 'https://example.com/2', description: 'Description 2' },
      ]);

      const result = await callTool('web:search', {
        query: 'test query',
      });

      expect(result.isError).toBeFalsy();
      expect(mockSearch).toHaveBeenCalledWith('test query', { maxResults: 10 });
      
      if ('text' in result.content[0]) {
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveLength(2);
        expect(data[0].title).toBe('Result 1');
      }
    });

    it('should respect maxResults parameter', async () => {
      mockSearch.mockResolvedValueOnce([]);

      await callTool('web:search', {
        query: 'test',
        maxResults: 5,
      });

      expect(mockSearch).toHaveBeenCalledWith('test', { maxResults: 5 });
    });
  });

  describe('web:fetch', () => {
    it('should require URL', async () => {
      const result = await callTool('web:fetch', {});

      expect(result.isError).toBe(true);
      if ('text' in result.content[0]) {
        expect(result.content[0].text).toContain('URL is required');
      }
    });

    it('should validate URL format', async () => {
      const result = await callTool('web:fetch', {
        url: 'not-a-valid-url',
      });

      expect(result.isError).toBe(true);
      if ('text' in result.content[0]) {
        expect(result.content[0].text).toContain('Fetch failed');
      }
    });

    it('should return fetched content', async () => {
      mockFetchAndExtract.mockResolvedValueOnce({
        url: 'https://example.com',
        title: 'Example Page',
        content: 'Page content here',
        links: ['https://example.com/link'],
        metadata: {
          description: 'Example description',
          keywords: ['example'],
          author: 'Author',
        },
      });

      const result = await callTool('web:fetch', {
        url: 'https://example.com',
      });

      expect(result.isError).toBeFalsy();
      expect(mockFetchAndExtract).toHaveBeenCalledWith('https://example.com');
      
      if ('text' in result.content[0]) {
        const data = JSON.parse(result.content[0].text);
        expect(data.title).toBe('Example Page');
        expect(data.content).toBe('Page content here');
      }
    });
  });

  describe('web:summarize', () => {
    it('should require URL', async () => {
      const result = await callTool('web:summarize', {});

      expect(result.isError).toBe(true);
      if ('text' in result.content[0]) {
        expect(result.content[0].text).toContain('URL is required');
      }
    });

    it('should return summarized content', async () => {
      mockSummarizeContent.mockResolvedValueOnce({
        url: 'https://example.com',
        title: 'Example Page',
        summary: 'This is a summary of the page.',
        keyPoints: ['Point 1', 'Point 2'],
      });

      const result = await callTool('web:summarize', {
        url: 'https://example.com',
      });

      expect(result.isError).toBeFalsy();
      expect(mockSummarizeContent).toHaveBeenCalledWith('https://example.com', 500);
      
      if ('text' in result.content[0]) {
        const data = JSON.parse(result.content[0].text);
        expect(data.summary).toBe('This is a summary of the page.');
        expect(data.keyPoints).toHaveLength(2);
      }
    });

    it('should respect maxLength parameter', async () => {
      mockSummarizeContent.mockResolvedValueOnce({
        url: 'https://example.com',
        title: 'Test',
        summary: 'Summary',
        keyPoints: [],
      });

      await callTool('web:summarize', {
        url: 'https://example.com',
        maxLength: 300,
      });

      expect(mockSummarizeContent).toHaveBeenCalledWith('https://example.com', 300);
    });
  });
});
