/**
 * Context Engineering - Types Tests
 */

import {
  ContextChunk,
  ContextType,
  PriorityLevel,
  RelevanceScore,
  TaskContext,
  FilterConfig,
  CompressionConfig,
  InjectionPayload,
  ContextEngineConfig,
  DEFAULT_RELEVANCE_CONFIG,
  DEFAULT_FILTER_CONFIG,
  DEFAULT_COMPRESSION_CONFIG,
  DEFAULT_CONTEXT_ENGINE_CONFIG,
} from '../types';

describe('Context Types', () => {
  describe('Default Configurations', () => {
    it('should have sensible relevance config defaults', () => {
      expect(DEFAULT_RELEVANCE_CONFIG.weights.keywordMatch).toBe(0.25);
      expect(DEFAULT_RELEVANCE_CONFIG.weights.semanticSimilarity).toBe(0.25);
      expect(DEFAULT_RELEVANCE_CONFIG.weights.taskContext).toBe(0.30);
      expect(DEFAULT_RELEVANCE_CONFIG.weights.recency).toBe(0.10);
      expect(DEFAULT_RELEVANCE_CONFIG.weights.priority).toBe(0.10);
      expect(DEFAULT_RELEVANCE_CONFIG.threshold).toBe(0.3);
      expect(DEFAULT_RELEVANCE_CONFIG.timeDecayFactor).toBe(0.1);
    });

    it('should have sensible filter config defaults', () => {
      expect(DEFAULT_FILTER_CONFIG.strategy).toBe('retention');
      expect(DEFAULT_FILTER_CONFIG.threshold).toBe(0.3);
      expect(DEFAULT_FILTER_CONFIG.maxChunks).toBe(100);
      expect(DEFAULT_FILTER_CONFIG.maxTokens).toBe(8000);
      expect(DEFAULT_FILTER_CONFIG.alwaysKeepTypes).toContain('instruction');
      expect(DEFAULT_FILTER_CONFIG.alwaysKeepTypes).toContain('error');
    });

    it('should have sensible compression config defaults', () => {
      expect(DEFAULT_COMPRESSION_CONFIG.strategy).toBe('selective');
      expect(DEFAULT_COMPRESSION_CONFIG.targetTokens).toBe(6000);
      expect(DEFAULT_COMPRESSION_CONFIG.maxTokens).toBe(8000);
      expect(DEFAULT_COMPRESSION_CONFIG.preserveCode).toBe(true);
      expect(DEFAULT_COMPRESSION_CONFIG.preserveStructure).toBe(true);
      expect(DEFAULT_COMPRESSION_CONFIG.minChunkSize).toBe(50);
      expect(DEFAULT_COMPRESSION_CONFIG.level).toBe(5);
    });

    it('should have sensible context engine defaults', () => {
      expect(DEFAULT_CONTEXT_ENGINE_CONFIG.maxContextTokens).toBe(8000);
      expect(DEFAULT_CONTEXT_ENGINE_CONFIG.targetContextTokens).toBe(6000);
      expect(DEFAULT_CONTEXT_ENGINE_CONFIG.debug).toBe(false);
      expect(DEFAULT_CONTEXT_ENGINE_CONFIG.relevance).toBe(DEFAULT_RELEVANCE_CONFIG);
      expect(DEFAULT_CONTEXT_ENGINE_CONFIG.filter).toBe(DEFAULT_FILTER_CONFIG);
      expect(DEFAULT_CONTEXT_ENGINE_CONFIG.compression).toBe(DEFAULT_COMPRESSION_CONFIG);
    });
  });

  describe('ContextChunk Interface', () => {
    it('should create a valid context chunk', () => {
      const chunk: ContextChunk = {
        id: 'chunk-1',
        content: 'Test content',
        type: 'code',
        source: 'test.ts',
        timestamp: Date.now(),
        tokenCount: 10,
        priority: 'high',
        metadata: { key: 'value' },
      };

      expect(chunk.id).toBe('chunk-1');
      expect(chunk.content).toBe('Test content');
      expect(chunk.type).toBe('code');
      expect(chunk.source).toBe('test.ts');
      expect(chunk.tokenCount).toBe(10);
      expect(chunk.priority).toBe('high');
      expect(chunk.metadata).toEqual({ key: 'value' });
    });

    it('should support all context types', () => {
      const types: ContextType[] = [
        'code',
        'documentation',
        'conversation',
        'memory',
        'task',
        'error',
        'output',
        'instruction',
        'reference',
      ];

      for (const type of types) {
        const chunk: ContextChunk = {
          id: `chunk-${type}`,
          content: 'Test',
          type,
          source: 'test',
          timestamp: Date.now(),
          tokenCount: 5,
          priority: 'medium',
        };
        expect(chunk.type).toBe(type);
      }
    });

    it('should support all priority levels', () => {
      const priorities: PriorityLevel[] = [
        'critical',
        'high',
        'medium',
        'low',
        'discardable',
      ];

      for (const priority of priorities) {
        const chunk: ContextChunk = {
          id: `chunk-${priority}`,
          content: 'Test',
          type: 'reference',
          source: 'test',
          timestamp: Date.now(),
          tokenCount: 5,
          priority,
        };
        expect(chunk.priority).toBe(priority);
      }
    });
  });

  describe('RelevanceScore Interface', () => {
    it('should create a valid relevance score', () => {
      const score: RelevanceScore = {
        score: 0.75,
        components: {
          keywordMatch: 0.8,
          semanticSimilarity: 0.7,
          taskContext: 0.9,
          recency: 0.6,
          priority: 0.5,
        },
        matchedKeywords: ['test', 'context'],
        reasoning: 'Good keyword match and task relevance',
      };

      expect(score.score).toBe(0.75);
      expect(score.components.keywordMatch).toBe(0.8);
      expect(score.matchedKeywords).toContain('test');
      expect(score.reasoning).toContain('keyword');
    });
  });

  describe('TaskContext Interface', () => {
    it('should create a valid task context', () => {
      const context: TaskContext = {
        task: 'Implement feature X',
        currentFile: 'src/feature.ts',
        keywords: ['implement', 'feature', 'x'],
        concepts: ['feature x', 'implementation'],
        stack: ['typescript', 'node'],
        actionHistory: ['created file', 'added imports'],
      };

      expect(context.task).toBe('Implement feature X');
      expect(context.currentFile).toBe('src/feature.ts');
      expect(context.keywords).toContain('implement');
      expect(context.stack).toContain('typescript');
    });
  });

  describe('FilterConfig Interface', () => {
    it('should create a valid filter config', () => {
      const config: FilterConfig = {
        strategy: 'summarization',
        threshold: 0.5,
        maxChunks: 50,
        maxTokens: 4000,
        keepIds: ['chunk-1'],
        removeIds: ['chunk-2'],
        alwaysKeepTypes: ['instruction'],
        alwaysRemoveTypes: ['output'],
      };

      expect(config.strategy).toBe('summarization');
      expect(config.threshold).toBe(0.5);
      expect(config.keepIds).toContain('chunk-1');
      expect(config.removeIds).toContain('chunk-2');
    });
  });

  describe('CompressionConfig Interface', () => {
    it('should create a valid compression config', () => {
      const config: CompressionConfig = {
        strategy: 'hierarchical',
        targetTokens: 3000,
        maxTokens: 4000,
        preserveCode: true,
        preserveStructure: false,
        minChunkSize: 100,
        level: 7,
      };

      expect(config.strategy).toBe('hierarchical');
      expect(config.targetTokens).toBe(3000);
      expect(config.preserveCode).toBe(true);
      expect(config.level).toBe(7);
    });
  });

  describe('InjectionPayload Interface', () => {
    it('should create a valid injection payload', () => {
      const payload: InjectionPayload = {
        id: 'inject-1',
        content: 'Critical information',
        trigger: {
          point: 'start',
          priority: 100,
        },
        critical: true,
        maxInjections: 1,
      };

      expect(payload.id).toBe('inject-1');
      expect(payload.content).toBe('Critical information');
      expect(payload.trigger.point).toBe('start');
      expect(payload.critical).toBe(true);
    });

    it('should create injection with condition', () => {
      const payload: InjectionPayload = {
        id: 'inject-2',
        content: 'Conditional info',
        trigger: {
          point: 'before_related',
          condition: {
            keywords: ['test'],
            contextType: 'code',
          },
          priority: 50,
        },
        critical: false,
      };

      expect(payload.trigger.condition?.keywords).toContain('test');
      expect(payload.trigger.condition?.contextType).toBe('code');
    });
  });

  describe('ContextEngineConfig Interface', () => {
    it('should create a valid engine config', () => {
      const config: ContextEngineConfig = {
        relevance: DEFAULT_RELEVANCE_CONFIG,
        filter: DEFAULT_FILTER_CONFIG,
        compression: DEFAULT_COMPRESSION_CONFIG,
        maxContextTokens: 10000,
        targetContextTokens: 8000,
        debug: true,
      };

      expect(config.maxContextTokens).toBe(10000);
      expect(config.targetContextTokens).toBe(8000);
      expect(config.debug).toBe(true);
    });
  });
});
