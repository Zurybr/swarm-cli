/**
 * Context Filter Tests
 */

import {
  filterContext,
  ContextFilter,
} from '../filter';
import {
  ContextChunk,
  RelevanceScore,
  FilterConfig,
} from '../types';

describe('Context Filter', () => {
  const createTestChunk = (
    id: string,
    content: string,
    type: ContextChunk['type'] = 'code',
    priority: ContextChunk['priority'] = 'medium',
    tokenCount: number = 100
  ): ContextChunk => ({
    id,
    content,
    type,
    source: 'test.ts',
    timestamp: Date.now(),
    tokenCount,
    priority,
  });

  const createRelevanceScore = (score: number): RelevanceScore => ({
    score,
    components: {
      keywordMatch: score * 0.8,
      semanticSimilarity: score * 0.7,
      taskContext: score * 0.9,
      recency: 0.8,
      priority: 0.5,
    },
    matchedKeywords: ['test'],
    reasoning: 'Test score',
  });

  describe('filterContext', () => {
    it('should filter chunks by relevance threshold', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'High relevance content'),
        createTestChunk('2', 'Low relevance content'),
      ];
      const scores = new Map<string, RelevanceScore>([
        ['1', createRelevanceScore(0.8)],
        ['2', createRelevanceScore(0.2)],
      ]);
      const config: FilterConfig = {
        strategy: 'retention',
        threshold: 0.5,
        maxChunks: 100,
        maxTokens: 8000,
        keepIds: [],
        removeIds: [],
        alwaysKeepTypes: [],
        alwaysRemoveTypes: [],
      };

      const result = filterContext(chunks, scores, config);

      expect(result.retained.length).toBe(1);
      expect(result.retained[0].id).toBe('1');
      expect(result.removed.length).toBe(1);
      expect(result.removed[0].id).toBe('2');
    });

    it('should always keep specified types', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'Error message', 'error', 'high'),
        createTestChunk('2', 'Normal content', 'code', 'medium'),
      ];
      const scores = new Map<string, RelevanceScore>([
        ['1', createRelevanceScore(0.1)], // Low score but should be kept
        ['2', createRelevanceScore(0.8)],
      ]);
      const config: FilterConfig = {
        strategy: 'retention',
        threshold: 0.5,
        maxChunks: 100,
        maxTokens: 8000,
        keepIds: [],
        removeIds: [],
        alwaysKeepTypes: ['error'],
        alwaysRemoveTypes: [],
      };

      const result = filterContext(chunks, scores, config);

      expect(result.retained.some(c => c.id === '1')).toBe(true);
    });

    it('should always remove specified types', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'Debug output', 'output', 'low'),
        createTestChunk('2', 'Normal content', 'code', 'medium'),
      ];
      const scores = new Map<string, RelevanceScore>([
        ['1', createRelevanceScore(0.9)], // High score but should be removed
        ['2', createRelevanceScore(0.8)],
      ]);
      const config: FilterConfig = {
        strategy: 'retention',
        threshold: 0.5,
        maxChunks: 100,
        maxTokens: 8000,
        keepIds: [],
        removeIds: [],
        alwaysKeepTypes: [],
        alwaysRemoveTypes: ['output'],
      };

      const result = filterContext(chunks, scores, config);

      expect(result.removed.some(c => c.id === '1')).toBe(true);
    });

    it('should always keep specified IDs', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('keep-me', 'Content'),
        createTestChunk('2', 'Other content'),
      ];
      const scores = new Map<string, RelevanceScore>([
        ['keep-me', createRelevanceScore(0.1)], // Low score
        ['2', createRelevanceScore(0.8)],
      ]);
      const config: FilterConfig = {
        strategy: 'retention',
        threshold: 0.5,
        maxChunks: 100,
        maxTokens: 8000,
        keepIds: ['keep-me'],
        removeIds: [],
        alwaysKeepTypes: [],
        alwaysRemoveTypes: [],
      };

      const result = filterContext(chunks, scores, config);

      expect(result.retained.some(c => c.id === 'keep-me')).toBe(true);
    });

    it('should always remove specified IDs', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('remove-me', 'Content'),
        createTestChunk('2', 'Other content'),
      ];
      const scores = new Map<string, RelevanceScore>([
        ['remove-me', createRelevanceScore(0.9)], // High score
        ['2', createRelevanceScore(0.8)],
      ]);
      const config: FilterConfig = {
        strategy: 'retention',
        threshold: 0.5,
        maxChunks: 100,
        maxTokens: 8000,
        keepIds: [],
        removeIds: ['remove-me'],
        alwaysKeepTypes: [],
        alwaysRemoveTypes: [],
      };

      const result = filterContext(chunks, scores, config);

      expect(result.removed.some(c => c.id === 'remove-me')).toBe(true);
    });

    it('should respect max chunks limit', () => {
      const chunks: ContextChunk[] = Array.from({ length: 10 }, (_, i) =>
        createTestChunk(`${i}`, `Content ${i}`)
      );
      const scores = new Map<string, RelevanceScore>(
        chunks.map((c, i) => [c.id, createRelevanceScore(0.9 - i * 0.05)])
      );
      const config: FilterConfig = {
        strategy: 'retention',
        threshold: 0.3,
        maxChunks: 5,
        maxTokens: 8000,
        keepIds: [],
        removeIds: [],
        alwaysKeepTypes: [],
        alwaysRemoveTypes: [],
      };

      const result = filterContext(chunks, scores, config);

      expect(result.retained.length).toBeLessThanOrEqual(5);
    });

    it('should respect max tokens limit', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'Content 1', 'code', 'medium', 3000),
        createTestChunk('2', 'Content 2', 'code', 'medium', 3000),
        createTestChunk('3', 'Content 3', 'code', 'medium', 3000),
      ];
      const scores = new Map<string, RelevanceScore>([
        ['1', createRelevanceScore(0.9)],
        ['2', createRelevanceScore(0.8)],
        ['3', createRelevanceScore(0.7)],
      ]);
      const config: FilterConfig = {
        strategy: 'retention',
        threshold: 0.3,
        maxChunks: 100,
        maxTokens: 5000,
        keepIds: [],
        removeIds: [],
        alwaysKeepTypes: [],
        alwaysRemoveTypes: [],
      };

      const result = filterContext(chunks, scores, config);

      const totalTokens = result.retained.reduce((sum, c) => sum + c.tokenCount, 0);
      expect(totalTokens).toBeLessThanOrEqual(5000);
    });

    it('should use exclusion strategy correctly', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'High relevance'),
        createTestChunk('2', 'Medium relevance'),
        createTestChunk('3', 'Low relevance'),
      ];
      const scores = new Map<string, RelevanceScore>([
        ['1', createRelevanceScore(0.8)],
        ['2', createRelevanceScore(0.5)],
        ['3', createRelevanceScore(0.2)],
      ]);
      const config: FilterConfig = {
        strategy: 'exclusion',
        threshold: 0.4,
        maxChunks: 100,
        maxTokens: 8000,
        keepIds: [],
        removeIds: [],
        alwaysKeepTypes: [],
        alwaysRemoveTypes: [],
      };

      const result = filterContext(chunks, scores, config);

      expect(result.retained.length).toBe(2); // 0.8 and 0.5
      expect(result.removed.length).toBe(1); // 0.2
    });

    it('should use summarization strategy', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'High relevance content that is quite long and detailed'),
        createTestChunk('2', 'Medium relevance content that is also quite long'),
        createTestChunk('3', 'Low relevance content'),
      ];
      const scores = new Map<string, RelevanceScore>([
        ['1', createRelevanceScore(0.8)],
        ['2', createRelevanceScore(0.5)],
        ['3', createRelevanceScore(0.2)],
      ]);
      const config: FilterConfig = {
        strategy: 'summarization',
        threshold: 0.6,
        maxChunks: 10,
        maxTokens: 8000,
        keepIds: [],
        removeIds: [],
        alwaysKeepTypes: [],
        alwaysRemoveTypes: [],
      };

      const result = filterContext(chunks, scores, config);

      // Should have some retained, some summarized, some removed
      expect(result.retained.length + result.summarized.length + result.removed.length).toBe(3);
    });

    it('should calculate correct statistics', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'Content 1', 'code', 'medium', 100),
        createTestChunk('2', 'Content 2', 'code', 'medium', 100),
      ];
      const scores = new Map<string, RelevanceScore>([
        ['1', createRelevanceScore(0.8)],
        ['2', createRelevanceScore(0.2)],
      ]);
      const config: FilterConfig = {
        strategy: 'retention',
        threshold: 0.5,
        maxChunks: 100,
        maxTokens: 8000,
        keepIds: [],
        removeIds: [],
        alwaysKeepTypes: [],
        alwaysRemoveTypes: [],
      };

      const result = filterContext(chunks, scores, config);

      expect(result.stats.totalBefore).toBe(2);
      expect(result.stats.tokensBefore).toBe(200);
      expect(result.stats.removedCount).toBe(1);
    });
  });

  describe('ContextFilter class', () => {
    it('should filter with default config', () => {
      const filter = new ContextFilter();
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'High relevance'),
        createTestChunk('2', 'Low relevance'),
      ];
      const scores = new Map<string, RelevanceScore>([
        ['1', createRelevanceScore(0.8)],
        ['2', createRelevanceScore(0.1)],
      ]);

      const result = filter.filter(chunks, scores);

      expect(result.retained.length).toBe(1);
      expect(result.retained[0].id).toBe('1');
    });

    it('should filter by threshold', () => {
      const filter = new ContextFilter({ threshold: 0.6 });
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'High relevance'),
        createTestChunk('2', 'Medium relevance'),
      ];
      const scores = new Map<string, RelevanceScore>([
        ['1', createRelevanceScore(0.8)],
        ['2', createRelevanceScore(0.5)],
      ]);

      const result = filter.filterByThreshold(chunks, scores);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
    });

    it('should filter by type', () => {
      const filter = new ContextFilter();
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'Code content', 'code'),
        createTestChunk('2', 'Documentation', 'documentation'),
        createTestChunk('3', 'Error message', 'error'),
      ];

      const result = filter.filterByType(chunks, ['code', 'error']);

      expect(result.length).toBe(2);
      expect(result.some(c => c.id === '1')).toBe(true);
      expect(result.some(c => c.id === '3')).toBe(true);
    });

    it('should update config', () => {
      const filter = new ContextFilter({ threshold: 0.3 });
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'Content'),
      ];
      const scores = new Map<string, RelevanceScore>([
        ['1', createRelevanceScore(0.4)],
      ]);

      // With threshold 0.3, should be retained
      let result = filter.filterByThreshold(chunks, scores);
      expect(result.length).toBe(1);

      // Update threshold to 0.5
      filter.updateConfig({ threshold: 0.5 });

      // Now should be filtered out
      result = filter.filterByThreshold(chunks, scores, 0.5);
      expect(result.length).toBe(0);
    });

    it('should return config copy', () => {
      const filter = new ContextFilter({ threshold: 0.5 });
      const config = filter.getConfig();

      config.threshold = 0.9; // Should not affect internal config

      expect(filter.getConfig().threshold).toBe(0.5);
    });
  });

  describe('Summarization', () => {
    it('should summarize code chunks', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', `
function calculateSum(a: number, b: number): number {
  // Add two numbers
  const result = a + b;
  return result;
}

function calculateProduct(a: number, b: number): number {
  // Multiply two numbers
  return a * b;
}
        `.trim(), 'code'),
      ];
      const scores = new Map<string, RelevanceScore>([
        ['1', createRelevanceScore(0.5)],
      ]);
      const config: FilterConfig = {
        strategy: 'summarization',
        threshold: 0.6,
        maxChunks: 10,
        maxTokens: 8000,
        keepIds: [],
        removeIds: [],
        alwaysKeepTypes: [],
        alwaysRemoveTypes: [],
      };

      const result = filterContext(chunks, scores, config);

      // Code should be summarized
      expect(result.summarized.length).toBeGreaterThan(0);
    });

    it('should summarize documentation chunks', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', `
# Project Documentation

This is a comprehensive guide.

## Section 1
Important details here.

## Section 2
More details here.
        `.trim(), 'documentation'),
      ];
      const scores = new Map<string, RelevanceScore>([
        ['1', createRelevanceScore(0.5)],
      ]);
      const config: FilterConfig = {
        strategy: 'summarization',
        threshold: 0.6,
        maxChunks: 10,
        maxTokens: 8000,
        keepIds: [],
        removeIds: [],
        alwaysKeepTypes: [],
        alwaysRemoveTypes: [],
      };

      const result = filterContext(chunks, scores, config);

      expect(result.summarized.length).toBeGreaterThan(0);
    });
  });
});
