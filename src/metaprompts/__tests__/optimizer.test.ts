/**
 * Optimizer tests
 */

import {
  optimizePrompt,
  optimizeForAgent,
  batchOptimize,
  suggestStrategies,
  compareOptimizations,
  createOptimizedPrompt,
} from '../optimizer';
import type { OptimizationStrategy, PromptTemplate, AgentType } from '../types';

describe('Optimizer', () => {
  describe('optimizePrompt', () => {
    it('should optimize with token_reduction strategy', () => {
      const prompt = 'Please kindly utilize the functionality in order to make it efficient.';
      const result = optimizePrompt(prompt, { strategy: 'token_reduction' });

      expect(result.original).toBe(prompt);
      expect(result.strategy).toBe('token_reduction');
      expect(result.metrics.originalTokens).toBeGreaterThan(0);
      expect(result.metrics.optimizedTokens).toBeGreaterThan(0);
      expect(result.changes.length).toBeGreaterThan(0);
    });

    it('should optimize with clarity_enhancement strategy', () => {
      const prompt = '# section\n\ncontent here';
      const result = optimizePrompt(prompt, { strategy: 'clarity_enhancement' });

      expect(result.strategy).toBe('clarity_enhancement');
      expect(result.metrics.clarityScore).toBeGreaterThanOrEqual(0);
      expect(result.metrics.clarityScore).toBeLessThanOrEqual(1);
    });

    it('should optimize with context_compression strategy', () => {
      const prompt = '## Context\n' + 'Line\n'.repeat(20) + '## End';
      const result = optimizePrompt(prompt, { strategy: 'context_compression' });

      expect(result.strategy).toBe('context_compression');
    });

    it('should optimize with focus_narrowing strategy', () => {
      const prompt = '## Note\nImportant note\n## Main\nMain content';
      const result = optimizePrompt(prompt, { strategy: 'focus_narrowing' });

      expect(result.strategy).toBe('focus_narrowing');
    });

    it('should optimize with example_addition strategy', () => {
      const prompt = '## Output Format\nFormat description';
      const result = optimizePrompt(prompt, { strategy: 'example_addition' });

      expect(result.strategy).toBe('example_addition');
    });

    it('should optimize with constraint_tightening strategy', () => {
      const prompt = 'Make it fast if possible.';
      const result = optimizePrompt(prompt, { strategy: 'constraint_tightening' });

      expect(result.strategy).toBe('constraint_tightening');
    });

    it('should respect targetTokens', () => {
      const prompt = 'Word '.repeat(1000);
      const result = optimizePrompt(prompt, { targetTokens: 100 });

      expect(result.metrics.optimizedTokens).toBeLessThanOrEqual(150); // Allow some margin
    });

    it('should preserve code blocks when requested', () => {
      const prompt = '```typescript\n' + 'const x = 1;\n'.repeat(100) + '```';
      const result = optimizePrompt(prompt, {
        strategy: 'token_reduction',
        targetTokens: 50,
        preserveCodeBlocks: true,
      });

      expect(result.optimized).toContain('```typescript');
    });

    it('should calculate token reduction', () => {
      const prompt = 'Please kindly make use of the functionality.';
      const result = optimizePrompt(prompt, { strategy: 'token_reduction' });

      expect(result.metrics.tokenReduction).toBeGreaterThanOrEqual(0);
      expect(result.metrics.tokenReduction).toBeLessThanOrEqual(1);
    });
  });

  describe('optimizeForAgent', () => {
    const mockTemplate: PromptTemplate = {
      id: 'test',
      name: 'Test',
      description: 'Test template',
      agentType: 'executor',
      content: 'Please kindly utilize the functionality.',
      variables: [],
      metadata: {
        author: 'test',
        createdAt: new Date(),
        modifiedAt: new Date(),
        tags: [],
        complexity: 3,
        estimatedTokens: 100,
        isActive: true,
      },
    };

    it('should optimize for specific agent type', () => {
      const result = optimizeForAgent(mockTemplate, 'executor');

      expect(result.original).toBe(mockTemplate.content);
      expect(result.optimized).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    it('should use agent-specific strategy', () => {
      const result = optimizeForAgent(mockTemplate, 'coordinator');
      // Coordinator uses 'focus_narrowing' strategy
      expect(result.strategy).toBe('focus_narrowing');
    });

    it('should allow strategy override', () => {
      const result = optimizeForAgent(mockTemplate, 'executor', {
        strategy: 'clarity_enhancement',
      });

      expect(result.strategy).toBe('clarity_enhancement');
    });
  });

  describe('batchOptimize', () => {
    it('should optimize multiple prompts', () => {
      const prompts = [
        'Please kindly make use of this.',
        'In order to do this, utilize the functionality.',
      ];
      const results = batchOptimize(prompts, { strategy: 'token_reduction' });

      expect(results).toHaveLength(2);
      expect(results[0].original).toBe(prompts[0]);
      expect(results[1].original).toBe(prompts[1]);
    });

    it('should apply same options to all prompts', () => {
      const prompts = ['Test one', 'Test two'];
      const results = batchOptimize(prompts, { strategy: 'clarity_enhancement' });

      expect(results[0].strategy).toBe('clarity_enhancement');
      expect(results[1].strategy).toBe('clarity_enhancement');
    });
  });

  describe('suggestStrategies', () => {
    it('should suggest token_reduction for long prompts', () => {
      const prompt = 'Word '.repeat(3000); // ~3000 tokens
      const strategies = suggestStrategies(prompt);

      expect(strategies).toContain('token_reduction');
    });

    it('should suggest context_compression for prompts with context', () => {
      const prompt = '## Context\n' + 'Line\n'.repeat(3000) + '## End'; // ~3000 tokens
      const strategies = suggestStrategies(prompt);

      expect(strategies).toContain('context_compression');
    });

    it('should suggest clarity_enhancement for long sentences', () => {
      const prompt = 'This is a very long sentence with many words that goes on and on without any breaks or punctuation making it hard to read and understand what is being said';
      const strategies = suggestStrategies(prompt);

      expect(strategies).toContain('clarity_enhancement');
    });

    it('should suggest example_addition for prompts without examples', () => {
      const prompt = '## Output Format\nProvide output.';
      const strategies = suggestStrategies(prompt);

      expect(strategies).toContain('example_addition');
    });

    it('should suggest constraint_tightening for vague constraints', () => {
      const prompt = 'Make it good if possible.';
      const strategies = suggestStrategies(prompt);

      expect(strategies).toContain('constraint_tightening');
    });

    it('should suggest focus_narrowing for prompts with many sections', () => {
      const prompt = '## A\n## B\n## C\n## D\n## E\n## F\n## G';
      const strategies = suggestStrategies(prompt);

      expect(strategies).toContain('focus_narrowing');
    });

    it('should return default strategy for simple prompts', () => {
      const prompt = 'Simple prompt.';
      const strategies = suggestStrategies(prompt);

      expect(strategies.length).toBeGreaterThan(0);
    });
  });

  describe('compareOptimizations', () => {
    const mockResultA = {
      original: 'test',
      optimized: 'test a',
      strategy: 'token_reduction' as OptimizationStrategy,
      metrics: {
        originalTokens: 100,
        optimizedTokens: 80,
        tokenReduction: 0.2,
        clarityScore: 0.8,
      },
      changes: [],
    };

    const mockResultB = {
      original: 'test',
      optimized: 'test b',
      strategy: 'clarity_enhancement' as OptimizationStrategy,
      metrics: {
        originalTokens: 100,
        optimizedTokens: 90,
        tokenReduction: 0.1,
        clarityScore: 0.9,
      },
      changes: [],
    };

    it('should return a or b based on scores', () => {
      const result = compareOptimizations(mockResultA, mockResultB);
      expect(['a', 'b', 'equal']).toContain(result);
    });

    it('should return equal for similar scores', () => {
      const similarA = { ...mockResultA, metrics: { ...mockResultA.metrics, clarityScore: 0.85 } };
      const similarB = { ...mockResultB, metrics: { ...mockResultB.metrics, clarityScore: 0.86 } };
      const result = compareOptimizations(similarA, similarB);
      expect(result).toBe('equal');
    });
  });

  describe('createOptimizedPrompt', () => {
    const mockTemplate: PromptTemplate = {
      id: 'test',
      name: 'Test',
      description: 'Test template',
      agentType: 'executor',
      content: 'Task: {{task}}',
      variables: [
        { name: 'task', type: 'string', description: 'Task', required: true },
      ],
      metadata: {
        author: 'test',
        createdAt: new Date(),
        modifiedAt: new Date(),
        tags: [],
        complexity: 3,
        estimatedTokens: 100,
        isActive: true,
      },
    };

    it('should render and optimize template', () => {
      const result = createOptimizedPrompt(mockTemplate, { task: 'Test task' });

      expect(result.original).toContain('Test task');
      expect(result.optimized).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    it('should apply specified options', () => {
      const result = createOptimizedPrompt(
        mockTemplate,
        { task: 'Test' },
        { strategy: 'clarity_enhancement' }
      );

      expect(result.strategy).toBe('clarity_enhancement');
    });
  });
});
