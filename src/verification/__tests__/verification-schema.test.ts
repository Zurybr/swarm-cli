/**
 * Tests for Verification Schema Engines (Issue #18)
 */

import {
  verifyTruths,
  TruthVerificationEngine,
  generateTruthReport,
} from '../truth-engine';

import {
  verifyArtifacts,
  ArtifactVerificationEngine,
  generateArtifactReport,
} from '../artifact-engine';

import {
  verifyKeyLinks,
  LinksVerificationEngine,
  analyzeImports,
  buildConnectionGraph,
  generateKeyLinksReport,
} from '../links-engine';

import type {
  MustHaves,
  Truth,
  Artifact,
  KeyLink,
} from '../../types/verification-schema';

import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

describe('Verification Schema Engines (Issue #18)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'verification-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('TruthVerificationEngine', () => {
    const mockMustHaves: MustHaves = {
      truths: [
        { description: 'User can send a message' },
        { description: 'User can see existing messages' },
        { description: 'Messages persist across refresh' },
      ],
      artifacts: [],
      key_links: [],
    };

    it('should verify truths and generate manual prompts', async () => {
      const results = await verifyTruths(mockMustHaves);

      expect(results).toHaveLength(3);
      expect(results[0].truth.description).toBe('User can send a message');
      expect(results[0].method).toBe('manual');
      expect(results[0].passed).toBe(true);
      expect(results[0].message).toContain('Verificación manual');
    });

    it('should generate truth report', async () => {
      const results = await verifyTruths(mockMustHaves);
      const report = generateTruthReport(results);

      expect(report).toContain('Truth Verification Report');
      expect(report).toContain('User can send a message');
      expect(report).toContain('3/3 truths passed');
    });

    it('should work with TruthVerificationEngine class', async () => {
      const engine = new TruthVerificationEngine();
      const results = await engine.verify(mockMustHaves);

      expect(results).toHaveLength(3);
    });
  });

  describe('ArtifactVerificationEngine', () => {
    it('should verify that files exist', async () => {
      // Create a test file
      const testFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(testFile, 'export const test = "hello";\n');

      const mustHaves: MustHaves = {
        truths: [],
        artifacts: [
          {
            path: testFile,
            provides: 'Test file',
          },
        ],
        key_links: [],
      };

      const results = await verifyArtifacts(mustHaves, { workingDir: '' });

      expect(results).toHaveLength(1);
      expect(results[0].exists).toBe(true);
      expect(results[0].passed).toBe(true);
    });

    it('should fail for non-existent files', async () => {
      const mustHaves: MustHaves = {
        truths: [],
        artifacts: [
          {
            path: 'non-existent.ts',
            provides: 'Non-existent file',
          },
        ],
        key_links: [],
      };

      const results = await verifyArtifacts(mustHaves);

      expect(results[0].exists).toBe(false);
      expect(results[0].passed).toBe(false);
      expect(results[0].errors[0]).toContain('File not found');
    });

    it('should verify min_lines requirement', async () => {
      const testFile = path.join(tempDir, 'long-file.ts');
      const content = Array(100).fill('console.log("line");').join('\n');
      await fs.writeFile(testFile, content);

      const mustHaves: MustHaves = {
        truths: [],
        artifacts: [
          {
            path: testFile,
            provides: 'Long file',
            min_lines: 50,
          },
        ],
        key_links: [],
      };

      const results = await verifyArtifacts(mustHaves, { workingDir: '' });

      expect(results[0].lineCount).toBe(100);
      expect(results[0].meetsMinLines).toBe(true);
    });

    it('should verify exports', async () => {
      const testFile = path.join(tempDir, 'exports.ts');
      await fs.writeFile(testFile, 'export const foo = 1;\nexport function bar() {}\n');

      const mustHaves: MustHaves = {
        truths: [],
        artifacts: [
          {
            path: testFile,
            provides: 'File with exports',
            exports: ['foo', 'bar'],
          },
        ],
        key_links: [],
      };

      const results = await verifyArtifacts(mustHaves, { workingDir: '' });

      expect(results[0].foundExports).toContain('foo');
      expect(results[0].foundExports).toContain('bar');
      expect(results[0].hasExpectedExports).toBe(true);
    });

    it('should verify contains pattern', async () => {
      const testFile = path.join(tempDir, 'pattern.ts');
      await fs.writeFile(testFile, 'export function Chat() {}\n');

      const mustHaves: MustHaves = {
        truths: [],
        artifacts: [
          {
            path: testFile,
            provides: 'File with pattern',
            contains: 'export function Chat',
          },
        ],
        key_links: [],
      };

      const results = await verifyArtifacts(mustHaves, { workingDir: '' });

      expect(results[0].containsPattern).toBe(true);
    });
  });

  describe('LinksVerificationEngine', () => {
    it('should verify key links by pattern', async () => {
      const fromFile = path.join(tempDir, 'from.ts');
      await fs.writeFile(fromFile, 'const response = await fetch("/api/chat");\n');

      const mustHaves: MustHaves = {
        truths: [],
        artifacts: [],
        key_links: [
          {
            from: fromFile,
            to: '/api/chat',
            via: 'fetch',
            pattern: 'fetch.*api/chat',
          },
        ],
      };

      const results = await verifyKeyLinks(mustHaves, { workingDir: '' });

      expect(results).toHaveLength(1);
      expect(results[0].connected).toBe(true);
      expect(results[0].passed).toBe(true);
      expect(results[0].foundPattern).toContain('fetch');
    });

    it('should fail when pattern not found', async () => {
      const fromFile = path.join(tempDir, 'no-link.ts');
      await fs.writeFile(fromFile, 'console.log("no connections here");\n');

      const mustHaves: MustHaves = {
        truths: [],
        artifacts: [],
        key_links: [
          {
            from: fromFile,
            to: '/api/chat',
            via: 'fetch',
            pattern: 'fetch.*api/chat',
          },
        ],
      };

      const results = await verifyKeyLinks(mustHaves, { workingDir: '' });

      expect(results[0].connected).toBe(false);
      expect(results[0].passed).toBe(false);
    });

    it('should generate key links report', async () => {
      const fromFile = path.join(tempDir, 'report-test.ts');
      await fs.writeFile(fromFile, 'fetch("/api");\n');

      const mustHaves: MustHaves = {
        truths: [],
        artifacts: [],
        key_links: [
          {
            from: fromFile,
            to: '/api',
            via: 'fetch',
            pattern: 'fetch',
          },
        ],
      };

      const results = await verifyKeyLinks(mustHaves, { workingDir: '' });
      const report = generateKeyLinksReport(results);

      expect(report).toContain('Key Links Verification Report');
      expect(report).toContain('1/1 links passed');
    });

    it('should build connection graph', () => {
      const mustHaves: MustHaves = {
        truths: [],
        artifacts: [
          { path: 'a.ts', provides: 'A' },
          { path: 'b.ts', provides: 'B' },
          { path: 'c.ts', provides: 'C' },
        ],
        key_links: [
          { from: 'a.ts', to: 'b.ts', via: 'import', pattern: 'import' },
          { from: 'b.ts', to: 'c.ts', via: 'import', pattern: 'import' },
        ],
      };

      const graph = buildConnectionGraph(mustHaves);

      expect(graph.has('a.ts')).toBe(true);
      expect(graph.has('b.ts')).toBe(true);
      expect(graph.has('c.ts')).toBe(true);
      expect(graph.get('a.ts')?.has('b.ts')).toBe(true);
      expect(graph.get('b.ts')?.has('c.ts')).toBe(true);
    });

    it('should analyze imports', async () => {
      const file = path.join(tempDir, 'imports.ts');
      await fs.writeFile(
        file,
        'import { foo } from "./foo";\nconst x = require("./bar");\nfetch("/api");\n'
      );

      const mustHaves: MustHaves = {
        truths: [],
        artifacts: [
          { path: file, provides: 'File with imports' },
        ],
        key_links: [],
      };

      const connections = await analyzeImports(mustHaves, { workingDir: '' });

      expect(connections.has(file)).toBe(true);
      const imports = connections.get(file);
      expect(imports).toContain('./foo');
      expect(imports).toContain('./bar');
      expect(imports?.some(i => i.startsWith('fetch:'))).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should verify complete must_haves schema', async () => {
      // Create test files
      const chatFile = path.join(tempDir, 'Chat.tsx');
      await fs.writeFile(
        chatFile,
        'export function Chat() { return null; }\nexport interface ChatProps {}\n'
      );

      const apiFile = path.join(tempDir, 'api.ts');
      await fs.writeFile(
        apiFile,
        'export async function GET() { return fetch("/data"); }\nexport async function POST() {}\n'
      );

      const mustHaves: MustHaves = {
        truths: [
          { description: 'User can see chat' },
        ],
        artifacts: [
          {
            path: 'Chat.tsx',
            provides: 'Chat component',
            exports: ['Chat', 'ChatProps'],
            contains: 'export function Chat',
          },
          {
            path: 'api.ts',
            provides: 'API routes',
            exports: ['GET', 'POST'],
          },
        ],
        key_links: [
          {
            from: 'api.ts',
            to: '/data',
            via: 'fetch',
            pattern: 'fetch.*"/data"',
          },
        ],
      };

      // Verify all components
      const truthResults = await verifyTruths(mustHaves);
      const artifactResults = await verifyArtifacts(mustHaves, { workingDir: tempDir });
      const linkResults = await verifyKeyLinks(mustHaves, { workingDir: tempDir });

      expect(truthResults).toHaveLength(1);
      expect(artifactResults).toHaveLength(2);
      expect(linkResults).toHaveLength(1);

      // Debug: log failed artifacts
      artifactResults.forEach(r => {
        if (!r.passed) {
          console.log('Failed artifact:', r.artifact.path, 'Errors:', r.errors);
        }
      });

      expect(artifactResults.every(r => r.passed)).toBe(true);
      expect(linkResults.every(r => r.passed)).toBe(true);
    });
  });
});
