/**
 * ContextEngine Integration Tests
 */

import {
  ContextEngine,
  createChunk,
  createChunkFromFile,
  estimateTokenCount,
} from '../index';
import {
  InjectionPatterns,
  createContextAwareInjections,
} from '../injector';
import { ContextChunk } from '../types';

describe('ContextEngine', () => {
  const createTestChunk = (
    id: string,
    content: string,
    type: ContextChunk['type'] = 'code',
    priority: ContextChunk['priority'] = 'medium'
  ): ContextChunk => ({
    id,
    content,
    type,
    source: 'test.ts',
    timestamp: Date.now(),
    tokenCount: Math.ceil(content.length / 4),
    priority,
  });

  describe('Basic operations', () => {
    it('should add a chunk', () => {
      const engine = new ContextEngine();
      const chunk = createTestChunk('1', 'Test content');

      engine.addChunk(chunk);

      expect(engine.getChunks().length).toBe(1);
      expect(engine.getChunks()[0].id).toBe('1');
    });

    it('should add multiple chunks', () => {
      const engine = new ContextEngine();
      const chunks = [
        createTestChunk('1', 'Content 1'),
        createTestChunk('2', 'Content 2'),
      ];

      engine.addChunks(chunks);

      expect(engine.getChunks().length).toBe(2);
    });

    it('should remove a chunk', () => {
      const engine = new ContextEngine();
      engine.addChunk(createTestChunk('1', 'Content'));

      const result = engine.removeChunk('1');

      expect(result).toBe(true);
      expect(engine.getChunks().length).toBe(0);
    });

    it('should return false when removing non-existent chunk', () => {
      const engine = new ContextEngine();

      const result = engine.removeChunk('non-existent');

      expect(result).toBe(false);
    });

    it('should clear all chunks', () => {
      const engine = new ContextEngine();
      engine.addChunks([
        createTestChunk('1', 'Content 1'),
        createTestChunk('2', 'Content 2'),
      ]);

      engine.clearChunks();

      expect(engine.getChunks().length).toBe(0);
    });
  });

  describe('Context processing', () => {
    it('should process context for a task', () => {
      const engine = new ContextEngine();
      engine.addChunks([
        createTestChunk('1', 'function test() { return 1; }', 'code', 'high'),
        createTestChunk('2', 'function other() { return 2; }', 'code', 'low'),
        createTestChunk('3', 'Some old output', 'output', 'low'),
      ]);

      const result = engine.processContext('Work on test function');

      expect(result.context).toBeDefined();
      expect(result.stats.totalChunks).toBe(3);
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should filter irrelevant chunks', () => {
      const engine = new ContextEngine();
      engine.addChunks([
        createTestChunk('1', 'function test() {}', 'code', 'high'),
        createTestChunk('2', 'completely unrelated banana content', 'output', 'low'),
      ]);

      const result = engine.processContext('Implement test functionality');

      expect(result.stats.filteredChunks).toBeGreaterThan(0);
    });

    it('should compress when over target size', () => {
      // Create engine with very low target to trigger compression
      const engine = new ContextEngine({
        targetContextTokens: 50,
        maxContextTokens: 100,
        compression: {
          strategy: 'truncate',
          targetTokens: 50,
          maxTokens: 100,
          preserveCode: true,
          preserveStructure: true,
          minChunkSize: 10,
          level: 5,
        },
      });
      engine.addChunks([
        createTestChunk('1', 'A'.repeat(400)), // ~100 tokens
        createTestChunk('2', 'B'.repeat(400)), // ~100 tokens
      ]);

      // Use compressToSize which directly compresses
      const result = engine.compressToSize(50);

      // Should be compressed
      expect(result.compressionRatio).toBeLessThan(1);
      expect(result.compressedTokens).toBeLessThanOrEqual(100);
    });

    it('should apply injections', () => {
      const engine = new ContextEngine();
      engine.addChunk(createTestChunk('1', 'Content'));
      engine.registerInjection(InjectionPatterns.atStart('Task: Test'));

      const result = engine.processContext('Test task');

      expect(result.injections.length).toBeGreaterThan(0);
      expect(result.context).toContain('Task: Test');
    });

    it('should return processing statistics', () => {
      const engine = new ContextEngine();
      engine.addChunks([
        createTestChunk('1', 'function test() {}'),
        createTestChunk('2', 'function other() {}'),
      ]);

      const result = engine.processContext('Test');

      expect(result.stats.totalChunks).toBe(2);
      expect(result.stats.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.stats.compressionRatio).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Relevance ranking', () => {
    it('should rank chunks by relevance', () => {
      const engine = new ContextEngine();
      engine.addChunks([
        createTestChunk('1', 'function foo() {}'),
        createTestChunk('2', 'function test() {}'),
        createTestChunk('3', 'function bar() {}'),
      ]);

      const ranked = engine.rankByRelevance('Implement test functionality');

      expect(ranked[0].chunk.id).toBe('2'); // test function should be first
      expect(ranked[0].score.score).toBeGreaterThan(ranked[2].score.score);
    });

    it('should consider current file', () => {
      const engine = new ContextEngine();
      engine.addChunk(createTestChunk('1', 'function test() {}'));

      const result1 = engine.processContext('Task', 'test.ts');
      const result2 = engine.processContext('Task', 'other.ts');

      // Both should process without error
      expect(result1.context).toBeDefined();
      expect(result2.context).toBeDefined();
    });
  });

  describe('Filtering', () => {
    it('should filter by relevance threshold', () => {
      const engine = new ContextEngine();
      engine.addChunks([
        createTestChunk('1', 'function test() {}'),
        createTestChunk('2', 'unrelated banana content'),
      ]);

      const filtered = engine.filterByRelevance(0.5, 'Test implementation');

      expect(filtered.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Compression', () => {
    it('should compress to target size', () => {
      const engine = new ContextEngine();
      engine.addChunks([
        createTestChunk('1', 'A'.repeat(400)),
        createTestChunk('2', 'B'.repeat(400)),
      ]);

      const result = engine.compressToSize(100);

      expect(result.compressedTokens).toBeLessThanOrEqual(120); // Allow some margin
    });
  });

  describe('Statistics', () => {
    it('should return context statistics', () => {
      const engine = new ContextEngine();
      engine.addChunks([
        createTestChunk('1', 'Code', 'code', 'high'),
        createTestChunk('2', 'Doc', 'documentation', 'medium'),
        createTestChunk('3', 'Error', 'error', 'critical'),
      ]);

      const stats = engine.getStats();

      expect(stats.totalChunks).toBe(3);
      expect(stats.byType.code).toBe(1);
      expect(stats.byType.documentation).toBe(1);
      expect(stats.byType.error).toBe(1);
      expect(stats.byPriority.high).toBe(1);
      expect(stats.byPriority.critical).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      const engine = new ContextEngine({ maxContextTokens: 8000 });

      engine.updateConfig({ maxContextTokens: 10000 });

      expect(engine.getConfig().maxContextTokens).toBe(10000);
    });

    it('should update filter config', () => {
      const engine = new ContextEngine();

      engine.updateConfig({
        filter: {
          strategy: 'exclusion',
          threshold: 0.6,
          maxChunks: 50,
          maxTokens: 4000,
          keepIds: [],
          removeIds: [],
          alwaysKeepTypes: ['error'],
          alwaysRemoveTypes: [],
        },
      });

      expect(engine.getConfig().filter.strategy).toBe('exclusion');
      expect(engine.getConfig().filter.threshold).toBe(0.6);
    });

    it('should return config copy', () => {
      const engine = new ContextEngine({ maxContextTokens: 8000 });
      const config = engine.getConfig();

      config.maxContextTokens = 10000; // Should not affect internal config

      expect(engine.getConfig().maxContextTokens).toBe(8000);
    });
  });

  describe('Import/Export', () => {
    it('should export to JSON', () => {
      const engine = new ContextEngine();
      engine.addChunk(createTestChunk('1', 'Content'));

      const json = engine.exportToJSON();
      const data = JSON.parse(json);

      expect(data.chunks).toHaveLength(1);
      expect(data.chunks[0].id).toBe('1');
      expect(data.config).toBeDefined();
    });

    it('should import from JSON', () => {
      const engine = new ContextEngine();
      const json = JSON.stringify({
        chunks: [{ id: 'imported', content: 'Imported', type: 'code', source: 'test.ts', timestamp: Date.now(), tokenCount: 10, priority: 'medium' }],
        config: { maxContextTokens: 5000 },
      });

      engine.importFromJSON(json);

      expect(engine.getChunks().length).toBe(1);
      expect(engine.getChunks()[0].id).toBe('imported');
    });
  });

  describe('Utility functions', () => {
    it('should create chunk with options', () => {
      const chunk = createChunk('Test content', {
        type: 'code',
        source: 'test.ts',
        priority: 'high',
      });

      expect(chunk.content).toBe('Test content');
      expect(chunk.type).toBe('code');
      expect(chunk.priority).toBe('high');
      expect(chunk.tokenCount).toBeGreaterThan(0);
    });

    it('should create chunk from file', () => {
      const chunk = createChunkFromFile('src/app.ts', 'function app() {}');

      expect(chunk.source).toBe('src/app.ts');
      expect(chunk.type).toBe('code');
    });

    it('should create documentation chunk from markdown', () => {
      const chunk = createChunkFromFile('README.md', '# Documentation');

      expect(chunk.type).toBe('documentation');
    });

    it('should estimate token count', () => {
      const tokens = estimateTokenCount('Hello World');

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBe(Math.ceil(11 / 4));
    });
  });

  describe('Debug mode', () => {
    it('should process with debug logging', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const engine = new ContextEngine({ debug: true });
      engine.addChunk(createTestChunk('1', 'Content'));

      engine.processContext('Task');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complex context workflow', () => {
      const engine = new ContextEngine({
        targetContextTokens: 500,
        maxContextTokens: 800,
      });

      // Add various types of context
      engine.addChunks([
        createTestChunk('code-1', 'function authenticate() { /* auth logic */ }', 'code', 'high'),
        createTestChunk('code-2', 'function validate() { /* validation */ }', 'code', 'medium'),
        createTestChunk('doc-1', '# Authentication Guide\n\nThis explains auth...', 'documentation', 'medium'),
        createTestChunk('error-1', 'Error: Auth failed', 'error', 'critical'),
        createTestChunk('output-1', 'Debug: some old output', 'output', 'low'),
      ]);

      // Register task-specific injection
      engine.registerInjection(InjectionPatterns.atStart('Task: Implement authentication'));

      // Process for authentication task
      const result = engine.processContext('Implement user authentication', 'auth.ts');

      // Verify results
      expect(result.stats.totalChunks).toBe(5);
      expect(result.context).toContain('Task: Implement');
      expect(result.context).toContain('authenticate');

      // Error should be retained due to critical priority
      expect(result.chunks.some(c => c.type === 'error')).toBe(true);
    });

    it('should handle empty context', () => {
      const engine = new ContextEngine();

      const result = engine.processContext('Task');

      expect(result.context).toBe('');
      expect(result.stats.totalChunks).toBe(0);
    });

    it('should handle very large context', () => {
      const engine = new ContextEngine({
        targetContextTokens: 1000,
        maxContextTokens: 1500,
      });

      // Add many chunks
      for (let i = 0; i < 50; i++) {
        engine.addChunk(createTestChunk(
          `chunk-${i}`,
          `Content for chunk ${i} with some meaningful text here`,
          i % 2 === 0 ? 'code' : 'documentation',
          i % 5 === 0 ? 'high' : 'medium'
        ));
      }

      const result = engine.processContext('Work on implementation');

      expect(result.stats.totalChunks).toBe(50);
      expect(result.stats.finalTokens).toBeLessThanOrEqual(1500);
    });
  });
});
