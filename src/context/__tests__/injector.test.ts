/**
 * Context Injector Tests
 */

import {
  ContextInjector,
  createTrigger,
  createCondition,
  createInjection,
  InjectionPatterns,
  registerInjections,
  createContextAwareInjections,
} from '../injector';
import {
  InjectionPayload,
  InjectionPoint,
  ContextChunk,
} from '../types';

describe('Context Injector', () => {
  const createTestChunk = (
    id: string,
    content: string,
    type: ContextChunk['type'] = 'code'
  ): ContextChunk => ({
    id,
    content,
    type,
    source: 'test.ts',
    timestamp: Date.now(),
    tokenCount: 10,
    priority: 'medium',
  });

  describe('ContextInjector class', () => {
    it('should register an injection', () => {
      const injector = new ContextInjector();
      const payload: InjectionPayload = {
        id: 'test-1',
        content: 'Test content',
        trigger: createTrigger('start', 50),
        critical: false,
      };

      injector.register(payload);

      expect(injector.getInjection('test-1')).toBeDefined();
      expect(injector.getInjection('test-1')?.content).toBe('Test content');
    });

    it('should unregister an injection', () => {
      const injector = new ContextInjector();
      const payload: InjectionPayload = {
        id: 'test-1',
        content: 'Test content',
        trigger: createTrigger('start', 50),
        critical: false,
      };

      injector.register(payload);
      const result = injector.unregister('test-1');

      expect(result).toBe(true);
      expect(injector.getInjection('test-1')).toBeUndefined();
    });

    it('should process injections at matching point', () => {
      const injector = new ContextInjector();
      const payload: InjectionPayload = {
        id: 'test-1',
        content: 'Injected content',
        trigger: createTrigger('start', 50),
        critical: false,
      };

      injector.register(payload);

      const chunks: ContextChunk[] = [];
      const context = 'Original context';
      const results = injector.processInjections('start', chunks, context);

      expect(results.length).toBe(1);
      expect(results[0].injected).toBe(true);
      expect(results[0].content).toBe('Injected content');
    });

    it('should not inject at non-matching point', () => {
      const injector = new ContextInjector();
      const payload: InjectionPayload = {
        id: 'test-1',
        content: 'Injected content',
        trigger: createTrigger('start', 50),
        critical: false,
      };

      injector.register(payload);

      const chunks: ContextChunk[] = [];
      const context = 'Original context';
      const results = injector.processInjections('end', chunks, context);

      expect(results.length).toBe(1);
      expect(results[0].injected).toBe(false);
      expect(results[0].reason).toContain('Point mismatch');
    });

    it('should respect max injections limit', () => {
      const injector = new ContextInjector();
      const payload: InjectionPayload = {
        id: 'test-1',
        content: 'Injected content',
        trigger: createTrigger('start', 50),
        critical: false,
        maxInjections: 2,
      };

      injector.register(payload);

      const chunks: ContextChunk[] = [];
      const context = 'Original context';

      // First injection
      let results = injector.processInjections('start', chunks, context);
      expect(results[0].injected).toBe(true);

      // Second injection
      results = injector.processInjections('start', chunks, context);
      expect(results[0].injected).toBe(true);

      // Third injection - should be blocked
      results = injector.processInjections('start', chunks, context);
      expect(results[0].injected).toBe(false);
      expect(results[0].reason).toBe('Max injections reached');
    });

    it('should evaluate keyword conditions', () => {
      const injector = new ContextInjector();
      const payload: InjectionPayload = {
        id: 'test-1',
        content: 'Injected content',
        trigger: createTrigger('before_related', 50, createCondition({ keywords: ['test'] })),
        critical: false,
      };

      injector.register(payload);

      const chunks: ContextChunk[] = [];
      const contextWithKeyword = 'This is a test context';
      const contextWithoutKeyword = 'This is another context';

      const results1 = injector.processInjections('before_related', chunks, contextWithKeyword);
      expect(results1[0].injected).toBe(true);

      const results2 = injector.processInjections('before_related', chunks, contextWithoutKeyword);
      expect(results2[0].injected).toBe(false);
      expect(results2[0].reason).toBe('Condition not met');
    });

    it('should evaluate context type conditions', () => {
      const injector = new ContextInjector();
      const payload: InjectionPayload = {
        id: 'test-1',
        content: 'Injected content',
        trigger: createTrigger('before_related', 50, createCondition({ contextType: 'error' })),
        critical: false,
      };

      injector.register(payload);

      const chunksWithError: ContextChunk[] = [
        createTestChunk('1', 'Error message', 'error'),
      ];
      const chunksWithoutError: ContextChunk[] = [
        createTestChunk('1', 'Code', 'code'),
      ];
      const context = 'Context';

      const results1 = injector.processInjections('before_related', chunksWithError, context);
      expect(results1[0].injected).toBe(true);

      const results2 = injector.processInjections('before_related', chunksWithoutError, context);
      expect(results2[0].injected).toBe(false);
    });

    it('should inject at start position', () => {
      const injector = new ContextInjector();
      const payload: InjectionPayload = {
        id: 'test-1',
        content: 'Injected',
        trigger: createTrigger('start', 50),
        critical: false,
      };

      injector.register(payload);

      const chunks: ContextChunk[] = [];
      const context = 'Original';
      const results = injector.processInjections('start', chunks, context);

      expect(results[0].injected).toBe(true);
      expect(results[0].position).toBe(0);
    });

    it('should inject at end position', () => {
      const injector = new ContextInjector();
      const payload: InjectionPayload = {
        id: 'test-1',
        content: 'Injected',
        trigger: createTrigger('end', 50),
        critical: false,
      };

      injector.register(payload);

      const chunks: ContextChunk[] = [];
      const context = 'Original context';
      const results = injector.processInjections('end', chunks, context);

      expect(results[0].injected).toBe(true);
      expect(results[0].position).toBe(context.length);
    });

    it('should inject content at position', () => {
      const injector = new ContextInjector();

      const context = 'Hello World';
      const content = 'Injected';
      const position = 5;

      const result = injector.injectAtPosition(context, content, position);

      expect(result).toContain('Hello');
      expect(result).toContain('Injected');
      expect(result).toContain('World');
    });

    it('should apply injections to context', () => {
      const injector = new ContextInjector();
      const payload: InjectionPayload = {
        id: 'test-1',
        content: 'Injected content',
        trigger: createTrigger('start', 50),
        critical: false,
      };

      injector.register(payload);

      const chunks: ContextChunk[] = [];
      const context = 'Original context';
      const { context: result, results } = injector.applyInjections(context, chunks, 'start');

      expect(results.length).toBe(1);
      expect(results[0].injected).toBe(true);
      expect(result).toContain('Injected content');
      expect(result).toContain('Original context');
    });

    it('should inject critical information', () => {
      const injector = new ContextInjector();

      const result = injector.injectCritical('Critical info', 'start');

      expect(result.injected).toBe(true);
      expect(injector.getInjections().length).toBe(1);
      expect(injector.getInjections()[0].critical).toBe(true);
    });

    it('should create milestone injection', () => {
      const injector = new ContextInjector();

      const payload = injector.injectAtMilestone('Milestone info', 'phase-1');

      expect(payload.trigger.point).toBe('milestone');
      expect(payload.trigger.condition?.keywords).toContain('phase-1');
    });

    it('should track injection history', () => {
      const injector = new ContextInjector();
      const payload: InjectionPayload = {
        id: 'test-1',
        content: 'Test',
        trigger: createTrigger('start', 50),
        critical: false,
      };

      injector.register(payload);
      injector.processInjections('start', [], 'context');

      const stats = injector.getStats();
      expect(stats.totalRegistered).toBe(1);
      expect(stats.totalInjected).toBe(1);
      expect(stats.injectionHistory.length).toBe(1);
    });

    it('should clear all injections', () => {
      const injector = new ContextInjector();
      injector.register(createInjection('Test', createTrigger('start')));

      injector.clear();

      expect(injector.getInjections().length).toBe(0);
      expect(injector.getStats().totalInjected).toBe(0);
    });
  });

  describe('InjectionPatterns', () => {
    it('should create atStart pattern', () => {
      const payload = InjectionPatterns.atStart('Start content', 100);

      expect(payload.trigger.point).toBe('start');
      expect(payload.trigger.priority).toBe(100);
      expect(payload.critical).toBe(true);
    });

    it('should create atEnd pattern', () => {
      const payload = InjectionPatterns.atEnd('End content', 10);

      expect(payload.trigger.point).toBe('end');
      expect(payload.trigger.priority).toBe(10);
    });

    it('should create whenKeywords pattern', () => {
      const payload = InjectionPatterns.whenKeywords('Keyword content', ['test', 'implement'], 50);

      expect(payload.trigger.point).toBe('before_related');
      expect(payload.trigger.condition?.keywords).toContain('test');
    });

    it('should create whenFileType pattern', () => {
      const payload = InjectionPatterns.whenFileType('File content', 'ts', 50);

      expect(payload.trigger.point).toBe('before_related');
      expect(payload.trigger.condition?.sourcePattern?.test('.ts')).toBe(true);
    });

    it('should create atMilestone pattern', () => {
      const payload = InjectionPatterns.atMilestone('Milestone content', 'milestone-1', 50);

      expect(payload.trigger.point).toBe('milestone');
      expect(payload.trigger.condition?.keywords).toContain('milestone-1');
    });

    it('should create onDemand pattern', () => {
      const payload = InjectionPatterns.onDemand('On demand content', 75);

      expect(payload.trigger.point).toBe('on_demand');
      expect(payload.trigger.priority).toBe(75);
      expect(payload.maxInjections).toBe(1);
    });
  });

  describe('Utility functions', () => {
    it('should create trigger', () => {
      const trigger = createTrigger('start', 100);

      expect(trigger.point).toBe('start');
      expect(trigger.priority).toBe(100);
    });

    it('should create trigger with condition', () => {
      const trigger = createTrigger('before_related', 50, createCondition({ keywords: ['test'] }));

      expect(trigger.point).toBe('before_related');
      expect(trigger.condition?.keywords).toContain('test');
    });

    it('should create condition', () => {
      const condition = createCondition({
        keywords: ['test'],
        contextType: 'code',
        sourcePattern: /\.ts$/,
      });

      expect(condition.keywords).toContain('test');
      expect(condition.contextType).toBe('code');
      expect(condition.sourcePattern).toBeDefined();
    });

    it('should create injection', () => {
      const injection = createInjection(
        'Content',
        createTrigger('start', 50),
        { id: 'custom-id', critical: true, maxInjections: 3 }
      );

      expect(injection.id).toBe('custom-id');
      expect(injection.content).toBe('Content');
      expect(injection.critical).toBe(true);
      expect(injection.maxInjections).toBe(3);
    });

    it('should create injection with defaults', () => {
      const injection = createInjection('Content', createTrigger('start'));

      expect(injection.id).toMatch(/^injection-/);
      expect(injection.critical).toBe(false);
    });

    it('should register multiple injections', () => {
      const injector = new ContextInjector();
      const injections = [
        createInjection('Content 1', createTrigger('start'), { id: 'inject-1' }),
        createInjection('Content 2', createTrigger('end'), { id: 'inject-2' }),
      ];

      registerInjections(injector, injections);

      expect(injector.getInjections().length).toBe(2);
    });

    it('should create context-aware injections', () => {
      const injections = createContextAwareInjections('Implement feature', 'feature.ts');

      expect(injections.length).toBeGreaterThan(0);
      expect(injections[0].content).toContain('Current Task');
      expect(injections[0].trigger.point).toBe('start');
    });

    it('should create file-specific injections', () => {
      const injections = createContextAwareInjections('Task', 'test.ts');

      const fileInjection = injections.find(i => i.content.includes('Working with file'));
      expect(fileInjection).toBeDefined();
    });
  });
});
