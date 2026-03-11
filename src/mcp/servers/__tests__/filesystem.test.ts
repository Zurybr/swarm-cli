/**
 * Tests for Filesystem MCP Server
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { filesystemTools } from '../filesystem/tools.js';

// Helper to call a tool
async function callTool(name: string, args: Record<string, unknown>) {
  const tool = filesystemTools.find(t => t.definition.name === name);
  if (!tool) throw new Error(`Tool ${name} not found`);
  return tool.handler(args);
}

describe('Filesystem MCP Server', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-fs-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('filesystem:write', () => {
    it('should write content to a file', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const result = await callTool('filesystem:write', {
        path: filePath,
        content: 'Hello, World!',
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0]).toHaveProperty('text');
      if ('text' in result.content[0]) {
        expect(result.content[0].text).toContain('Successfully wrote');
      }

      // Verify file was created
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('Hello, World!');
    });

    it('should create parent directories if needed', async () => {
      const filePath = path.join(tempDir, 'subdir', 'nested', 'test.txt');
      const result = await callTool('filesystem:write', {
        path: filePath,
        content: 'Nested content',
      });

      expect(result.isError).toBeFalsy();
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('Nested content');
    });

    it('should error when path is missing', async () => {
      const result = await callTool('filesystem:write', {
        content: 'No path',
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('filesystem:read', () => {
    it('should read file contents', async () => {
      const filePath = path.join(tempDir, 'read-test.txt');
      await fs.writeFile(filePath, 'Test content');

      const result = await callTool('filesystem:read', {
        path: filePath,
      });

      expect(result.isError).toBeFalsy();
      if ('text' in result.content[0]) {
        expect(result.content[0].text).toBe('Test content');
      }
    });

    it('should error for non-existent file', async () => {
      const result = await callTool('filesystem:read', {
        path: path.join(tempDir, 'nonexistent.txt'),
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('filesystem:list', () => {
    it('should list directory contents', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(tempDir, 'subdir'));

      const result = await callTool('filesystem:list', {
        path: tempDir,
      });

      expect(result.isError).toBeFalsy();
      if ('text' in result.content[0]) {
        const entries = JSON.parse(result.content[0].text);
        expect(entries).toHaveLength(3);
        expect(entries.map((e: { name: string }) => e.name).sort()).toEqual([
          'file1.txt',
          'file2.txt',
          'subdir',
        ]);
      }
    });

    it('should error for non-directory path', async () => {
      const filePath = path.join(tempDir, 'file.txt');
      await fs.writeFile(filePath, 'content');

      const result = await callTool('filesystem:list', {
        path: filePath,
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('filesystem:exists', () => {
    it('should return true for existing file', async () => {
      const filePath = path.join(tempDir, 'exists.txt');
      await fs.writeFile(filePath, 'content');

      const result = await callTool('filesystem:exists', {
        path: filePath,
      });

      expect(result.isError).toBeFalsy();
      if ('text' in result.content[0]) {
        const info = JSON.parse(result.content[0].text);
        expect(info.exists).toBe(true);
        expect(info.type).toBe('file');
      }
    });

    it('should return false for non-existent file', async () => {
      const result = await callTool('filesystem:exists', {
        path: path.join(tempDir, 'nonexistent.txt'),
      });

      expect(result.isError).toBeFalsy();
      if ('text' in result.content[0]) {
        const info = JSON.parse(result.content[0].text);
        expect(info.exists).toBe(false);
      }
    });
  });

  describe('filesystem:search', () => {
    it('should find files matching pattern', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'ts content');
      await fs.writeFile(path.join(tempDir, 'test.js'), 'js content');
      await fs.writeFile(path.join(tempDir, 'readme.md'), 'readme');

      const result = await callTool('filesystem:search', {
        path: tempDir,
        pattern: '\\.ts$',
      });

      expect(result.isError).toBeFalsy();
      if ('text' in result.content[0]) {
        const matches = JSON.parse(result.content[0].text);
        expect(matches).toHaveLength(1);
        expect(matches[0]).toContain('test.ts');
      }
    });
  });

  describe('filesystem:delete', () => {
    it('should delete a file', async () => {
      const filePath = path.join(tempDir, 'to-delete.txt');
      await fs.writeFile(filePath, 'content');

      const result = await callTool('filesystem:delete', {
        path: filePath,
      });

      expect(result.isError).toBeFalsy();

      // Verify file is gone
      await expect(fs.stat(filePath)).rejects.toThrow();
    });

    it('should delete directory recursively', async () => {
      const dirPath = path.join(tempDir, 'to-delete-dir');
      await fs.mkdir(dirPath);
      await fs.writeFile(path.join(dirPath, 'file.txt'), 'content');

      const result = await callTool('filesystem:delete', {
        path: dirPath,
        recursive: true,
      });

      expect(result.isError).toBeFalsy();
      await expect(fs.stat(dirPath)).rejects.toThrow();
    });
  });
});
