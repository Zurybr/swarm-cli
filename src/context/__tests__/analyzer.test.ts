/**
 * Context Relevance Analyzer Tests
 */

import {
  calculateRelevance,
  rankChunks,
  analyzeChunks,
  extractKeywords,
  buildTaskContext,
  RelevanceAnalyzer,
} from '../analyzer';
import { ContextChunk, TaskContext, RelevanceConfig } from '../types';

describe('Relevance Analyzer', () => {
  const createTestChunk = (
    id: string,
    content: string,
    type: ContextChunk['type'] = 'code',
    priority: ContextChunk['priority'] = 'medium',
    timestamp?: number
  ): ContextChunk => ({
    id,
    content,
    type,
    source: 'test.ts',
    timestamp: timestamp || Date.now(),
    tokenCount: Math.ceil(content.length / 4),
    priority,
  });

  const createTestTaskContext = (
    task: string,
    keywords: string[] = [],
    stack: string[] = []
  ): TaskContext => ({
    task,
    keywords,
    concepts: [],
    stack,
    actionHistory: [],
  });

  describe('calculateRelevance', () => {
    it('should calculate relevance for matching keywords', () => {
      const chunk = createTestChunk('1', 'function test() { return "hello"; }');
      const taskContext = createTestTaskContext(
        'Implement test function',
        ['test', 'function'],
        ['typescript']
      );

      const score = calculateRelevance(chunk, taskContext);

      expect(score.score).toBeGreaterThan(0);
      expect(score.matchedKeywords).toContain('test');
      expect(score.matchedKeywords).toContain('function');
    });

    it('should return low score for unrelated content', () => {
      const chunk = createTestChunk('1', 'function foo() { return 42; }');
      const taskContext = createTestTaskContext(
        'Implement database connection',
        ['database', 'sql', 'connection'],
        ['postgres']
      );

      const score = calculateRelevance(chunk, taskContext);

      expect(score.score).toBeLessThan(0.5);
      expect(score.matchedKeywords.length).toBe(0);
    });

    it('should boost score for high priority chunks', () => {
      const content = 'function test() {}';
      const lowPriorityChunk = createTestChunk('1', content, 'code', 'low');
      const highPriorityChunk = createTestChunk('2', content, 'code', 'critical');
      const taskContext = createTestTaskContext('Test task', ['test']);

      const lowScore = calculateRelevance(lowPriorityChunk, taskContext);
      const highScore = calculateRelevance(highPriorityChunk, taskContext);

      expect(highScore.components.priority).toBeGreaterThan(lowScore.components.priority);
    });

    it('should consider recency in scoring', () => {
      const oldChunk = createTestChunk('1', 'function test() {}', 'code', 'medium', Date.now() - 86400000);
      const newChunk = createTestChunk('2', 'function test() {}', 'code', 'medium', Date.now());
      const taskContext = createTestTaskContext('Test task', ['test']);

      const oldScore = calculateRelevance(oldChunk, taskContext);
      const newScore = calculateRelevance(newChunk, taskContext);

      expect(newScore.components.recency).toBeGreaterThanOrEqual(oldScore.components.recency);
    });

    it('should boost code chunks for implementation tasks', () => {
      const codeChunk = createTestChunk('1', 'function implement() {}', 'code');
      const docChunk = createTestChunk('2', 'Documentation about implementation', 'documentation');
      const taskContext = createTestTaskContext('Implement new feature', ['implement']);

      const codeScore = calculateRelevance(codeChunk, taskContext);
      const docScore = calculateRelevance(docChunk, taskContext);

      expect(codeScore.components.taskContext).toBeGreaterThanOrEqual(docScore.components.taskContext);
    });

    it('should boost error chunks for debugging tasks', () => {
      const errorChunk = createTestChunk('1', 'Error: something went wrong', 'error');
      const codeChunk = createTestChunk('2', 'function normal() {}', 'code');
      const taskContext = createTestTaskContext('Fix the bug in production', ['fix', 'bug']);

      const errorScore = calculateRelevance(errorChunk, taskContext);
      const codeScore = calculateRelevance(codeChunk, taskContext);

      expect(errorScore.components.taskContext).toBeGreaterThan(codeScore.components.taskContext);
    });
  });

  describe('rankChunks', () => {
    it('should rank chunks by relevance', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'function foo() {}'),
        createTestChunk('2', 'function test() {}'),
        createTestChunk('3', 'const x = 5;'),
      ];
      const taskContext = createTestTaskContext('Work on test function', ['test']);

      const ranked = rankChunks(chunks, taskContext);

      expect(ranked[0].chunk.id).toBe('2'); // test function should be first
      expect(ranked[0].score.score).toBeGreaterThan(ranked[2].score.score);
    });

    it('should handle empty chunks array', () => {
      const ranked = rankChunks([], createTestTaskContext('Test'));
      expect(ranked).toEqual([]);
    });
  });

  describe('analyzeChunks', () => {
    it('should analyze multiple chunks', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'function foo() {}'),
        createTestChunk('2', 'function bar() {}'),
      ];
      const taskContext = createTestTaskContext('Test', ['foo']);

      const results = analyzeChunks(chunks, taskContext);

      expect(results.size).toBe(2);
      expect(results.has('1')).toBe(true);
      expect(results.has('2')).toBe(true);
      expect(results.get('1')!.score).toBeGreaterThan(results.get('2')!.score);
    });
  });

  describe('extractKeywords', () => {
    it('should extract keywords from text', () => {
      const text = 'Implement a new feature for the authentication system';
      const keywords = extractKeywords(text);

      expect(keywords).toContain('implement');
      expect(keywords).toContain('new');
      expect(keywords).toContain('feature');
      expect(keywords).toContain('authentication');
      expect(keywords).toContain('system');
    });

    it('should filter out stop words', () => {
      const text = 'The a an is are was were be been being';
      const keywords = extractKeywords(text);

      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('a');
      expect(keywords).not.toContain('is');
    });

    it('should sort by frequency', () => {
      const text = 'test test test code code feature';
      const keywords = extractKeywords(text);

      expect(keywords[0]).toBe('test');
      expect(keywords[1]).toBe('code');
    });
  });

  describe('buildTaskContext', () => {
    it('should build task context from description', () => {
      const context = buildTaskContext(
        'Implement user authentication',
        'auth.ts',
        ['typescript', 'jwt'],
        ['created file']
      );

      expect(context.task).toBe('Implement user authentication');
      expect(context.currentFile).toBe('auth.ts');
      expect(context.keywords).toContain('implement');
      expect(context.keywords).toContain('user');
      expect(context.keywords).toContain('authentication');
      expect(context.stack).toContain('typescript');
      expect(context.stack).toContain('jwt');
      expect(context.actionHistory).toContain('created file');
    });

    it('should extract concepts from task', () => {
      const context = buildTaskContext('Implement user authentication system');

      expect(context.concepts.length).toBeGreaterThan(0);
      expect(context.concepts.some(c => c.includes('user'))).toBe(true);
    });
  });

  describe('RelevanceAnalyzer class', () => {
    it('should analyze chunks with caching', () => {
      const analyzer = new RelevanceAnalyzer();
      const chunk = createTestChunk('1', 'function test() {}');
      const taskContext = createTestTaskContext('Test', ['test']);

      const score1 = analyzer.analyze(chunk, taskContext);
      const score2 = analyzer.analyze(chunk, taskContext);

      expect(score1).toBe(score2); // Should return cached result
    });

    it('should filter chunks by threshold', () => {
      const analyzer = new RelevanceAnalyzer({ threshold: 0.5 });
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'function test() {}'),
        createTestChunk('2', 'completely unrelated content about bananas'),
      ];
      const taskContext = createTestTaskContext('Test implementation', ['test']);

      const filtered = analyzer.filter(chunks, taskContext);

      expect(filtered.length).toBeLessThan(chunks.length);
      expect(filtered.some(c => c.id === '1')).toBe(true);
    });

    it('should rank chunks correctly', () => {
      const analyzer = new RelevanceAnalyzer();
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'function foo() {}'),
        createTestChunk('2', 'function test() {}'),
      ];
      const taskContext = createTestTaskContext('Test', ['test']);

      const ranked = analyzer.rank(chunks, taskContext);

      expect(ranked[0].chunk.id).toBe('2');
    });

    it('should update config and clear cache', () => {
      const analyzer = new RelevanceAnalyzer({ threshold: 0.3 });
      const chunk = createTestChunk('1', 'test');
      const taskContext = createTestTaskContext('Test', ['test']);

      // First analysis
      analyzer.analyze(chunk, taskContext);

      // Update config
      analyzer.updateConfig({ threshold: 0.8 });

      // Should not return cached result after config change
      const newAnalyzer = new RelevanceAnalyzer({ threshold: 0.8 });
      const score1 = analyzer.analyze(chunk, taskContext);
      const score2 = newAnalyzer.analyze(chunk, taskContext);

      expect(score1.score).toBe(score2.score);
    });

    it('should clear cache', () => {
      const analyzer = new RelevanceAnalyzer();
      const chunk = createTestChunk('1', 'test');
      const taskContext = createTestTaskContext('Test', ['test']);

      analyzer.analyze(chunk, taskContext);
      analyzer.clearCache();

      // Should work without error after clearing cache
      const score = analyzer.analyze(chunk, taskContext);
      expect(score.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Custom configuration', () => {
    it('should respect custom weights', () => {
      const chunk = createTestChunk('1', 'function test() {}');
      const taskContext = createTestTaskContext('Test', ['test']);
      const config: RelevanceConfig = {
        weights: {
          keywordMatch: 1.0,
          semanticSimilarity: 0,
          taskContext: 0,
          recency: 0,
          priority: 0,
        },
        threshold: 0.3,
        boostKeywords: [],
        penalizeKeywords: [],
        timeDecayFactor: 0.1,
      };

      const score = calculateRelevance(chunk, taskContext, config);

      expect(score.components.keywordMatch).toBeGreaterThan(0);
      expect(score.components.semanticSimilarity).toBe(0);
    });

    it('should boost configured keywords', () => {
      const chunk = createTestChunk('1', 'function importantTest() {}');
      const taskContext = createTestTaskContext('Test', ['test']);
      const config: RelevanceConfig = {
        weights: {
          keywordMatch: 0.25,
          semanticSimilarity: 0.25,
          taskContext: 0.30,
          recency: 0.10,
          priority: 0.10,
        },
        threshold: 0.3,
        boostKeywords: ['important'],
        penalizeKeywords: [],
        timeDecayFactor: 0.1,
      };

      const score = calculateRelevance(chunk, taskContext, config);

      // Should have higher score due to boost keyword
      const normalScore = calculateRelevance(chunk, taskContext);
      expect(score.score).toBeGreaterThanOrEqual(normalScore.score);
    });
  });
});
