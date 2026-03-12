/**
 * Model Router Unit Tests - Issue #22.2
 * Tests for intelligent model routing with multiple strategies
 */

import { ModelRouter, RoutingContext, RoutingResult } from '@/providers/model-router';
import { 
  TaskBasedStrategy, 
  CostBasedStrategy, 
  LatencyBasedStrategy,
  QualityBasedStrategy 
} from '@/providers/routing-strategies';
import { ProviderManager } from '@/providers/provider-manager';
import { Provider, Model, CompletionOptions, Completion, Chunk } from '@/types';

// Mock provider for testing
class MockProvider implements Provider {
  name: any;
  models: Model[];
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  maxContextTokens: number;
  private latency: number;

  constructor(
    name: any, 
    models: Model[], 
    options: { 
      supportsTools?: boolean; 
      supportsVision?: boolean;
      latency?: number;
    } = {}
  ) {
    this.name = name;
    this.models = models;
    this.supportsTools = options.supportsTools ?? true;
    this.supportsVision = options.supportsVision ?? false;
    this.supportsStreaming = true;
    this.maxContextTokens = 128000;
    this.latency = options.latency ?? 100;
  }

  async complete(options: CompletionOptions): Promise<Completion> {
    // Simulate latency
    await new Promise(resolve => setTimeout(resolve, this.latency));
    return {
      content: 'Mock response',
      usage: { input: 10, output: 5, total: 15 }
    };
  }

  async *stream(options: CompletionOptions): AsyncIterable<Chunk> {
    yield { content: 'Mock', isComplete: false };
    yield { content: ' response', isComplete: true };
  }

  hasModel(modelId: string): boolean {
    return this.models.some(m => m.id === modelId);
  }
}

// Helper to create test models
function createModel(overrides: Partial<Model>): Model {
  return {
    id: 'test-model',
    name: 'Test Model',
    provider: 'anthropic',
    maxTokens: 4096,
    supportsTools: true,
    supportsVision: false,
    costPer1KInput: 0.01,
    costPer1KOutput: 0.03,
    ...overrides
  };
}

describe('ModelRouter', () => {
  let router: ModelRouter;
  let providerManager: ProviderManager;
  let mockProviders: Map<string, Provider>;

  beforeEach(() => {
    mockProviders = new Map();
    
    // Create mock providers with different characteristics
    const anthropicProvider = new MockProvider('anthropic', [
      createModel({ 
        id: 'claude-3-opus', 
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        costPer1KInput: 0.015, 
        costPer1KOutput: 0.075,
        supportsTools: true,
        supportsVision: true
      }),
      createModel({ 
        id: 'claude-3-sonnet', 
        name: 'Claude 3 Sonnet',
        provider: 'anthropic',
        costPer1KInput: 0.003, 
        costPer1KOutput: 0.015
      }),
      createModel({ 
        id: 'claude-3-haiku', 
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        costPer1KInput: 0.00025, 
        costPer1KOutput: 0.00125
      })
    ], { supportsTools: true, supportsVision: true, latency: 200 });

    const openaiProvider = new MockProvider('openai', [
      createModel({ 
        id: 'gpt-4-turbo', 
        name: 'GPT-4 Turbo',
        provider: 'openai',
        costPer1KInput: 0.01, 
        costPer1KOutput: 0.03,
        supportsTools: true,
        supportsVision: true
      }),
      createModel({ 
        id: 'gpt-3.5-turbo', 
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        costPer1KInput: 0.0005, 
        costPer1KOutput: 0.0015
      })
    ], { supportsTools: true, supportsVision: true, latency: 150 });

    const googleProvider = new MockProvider('google', [
      createModel({ 
        id: 'gemini-pro', 
        name: 'Gemini Pro',
        provider: 'google',
        costPer1KInput: 0.00025, 
        costPer1KOutput: 0.0005,
        supportsTools: true,
        supportsVision: true
      })
    ], { supportsTools: true, supportsVision: true, latency: 100 });

    mockProviders.set('anthropic', anthropicProvider);
    mockProviders.set('openai', openaiProvider);
    mockProviders.set('google', googleProvider);

    providerManager = new ProviderManager();
    mockProviders.forEach(p => providerManager.registerProvider(p));
    
    router = new ModelRouter(providerManager);
  });

  describe('constructor', () => {
    it('should initialize with provider manager', () => {
      expect(router).toBeDefined();
      expect(router.getProviderManager()).toBe(providerManager);
    });

    it('should register default strategies', () => {
      const strategies = router.getStrategies();
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.map(s => s.name)).toContain('task-based');
      expect(strategies.map(s => s.name)).toContain('cost-based');
      expect(strategies.map(s => s.name)).toContain('latency-based');
    });
  });

  describe('route()', () => {
    it('should route using task-based strategy by default', async () => {
      const context: RoutingContext = {
        task: 'planning',
        messages: [{ role: 'user', content: 'Plan a project' }]
      };

      const result = await router.route(context);
      
      expect(result).toBeDefined();
      expect(result.provider).toBeDefined();
      expect(result.model).toBeDefined();
      expect(result.strategy).toBe('task-based');
    });

    it('should use specified strategy', async () => {
      const context: RoutingContext = {
        task: 'coding',
        messages: [{ role: 'user', content: 'Write code' }],
        strategy: 'cost-based'
      };

      const result = await router.route(context);
      
      expect(result.strategy).toBe('cost-based');
    });

    it('should return routing reason', async () => {
      const context: RoutingContext = {
        task: 'quick',
        messages: [{ role: 'user', content: 'Hi' }]
      };

      const result = await router.route(context);
      
      expect(result.reason).toBeDefined();
      expect(result.reason.length).toBeGreaterThan(0);
    });
  });

  describe('Task-Based Routing', () => {
    it('should route planning tasks to high-capability models', async () => {
      const context: RoutingContext = {
        task: 'planning',
        messages: [{ role: 'user', content: 'Create a project plan' }]
      };

      const result = await router.route(context);
      
      // Planning should use more capable models
      expect(['claude-3-opus', 'gpt-4-turbo']).toContain(result.model);
    });

    it('should route coding tasks to models with tool support', async () => {
      const context: RoutingContext = {
        task: 'coding',
        messages: [{ role: 'user', content: 'Write a function' }]
      };

      const result = await router.route(context);
      
      // Coding tasks should use models that support tools
      const provider = mockProviders.get(result.provider);
      const model = provider?.models.find(m => m.id === result.model);
      expect(model?.supportsTools).toBe(true);
    });

    it('should route research tasks to models with large context', async () => {
      const context: RoutingContext = {
        task: 'research',
        messages: [{ role: 'user', content: 'Analyze this document' }]
      };

      const result = await router.route(context);
      
      expect(result).toBeDefined();
      expect(result.provider).toBeDefined();
    });

    it('should route quick tasks to fast, cheap models', async () => {
      const context: RoutingContext = {
        task: 'quick',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const result = await router.route(context);
      
      // Quick tasks should prefer faster/cheaper models
      expect(['claude-3-haiku', 'gpt-3.5-turbo', 'gemini-pro']).toContain(result.model);
    });
  });

  describe('Cost-Based Routing', () => {
    it('should select cheapest model for budget-constrained requests', async () => {
      const context: RoutingContext = {
        task: 'general',
        messages: [{ role: 'user', content: 'Summarize this' }],
        strategy: 'cost-based',
        constraints: {
          maxCostPer1K: 0.001
        }
      };

      const result = await router.route(context);
      
      const provider = mockProviders.get(result.provider);
      const model = provider?.models.find(m => m.id === result.model);
      expect(model?.costPer1KInput).toBeLessThanOrEqual(0.001);
    });

    it('should consider both input and output costs', async () => {
      const context: RoutingContext = {
        task: 'general',
        messages: [{ role: 'user', content: 'Write a long response' }],
        strategy: 'cost-based',
        estimatedOutputTokens: 2000
      };

      const result = await router.route(context);
      
      expect(result).toBeDefined();
      // Reason contains cost info (case-insensitive check)
      expect(result.reason.toLowerCase()).toContain('cost');
    });
  });

  describe('Latency-Based Routing', () => {
    it('should prefer lower latency models for time-sensitive requests', async () => {
      // First, record some latency data by making requests
      // This populates the latency history for the strategy
      const latencyStrategy = router.getStrategies().find(s => s.name === 'latency-based') as LatencyBasedStrategy;
      
      // Record lower latency for Google provider
      latencyStrategy.recordLatency('google', 'gemini-pro', 50);
      latencyStrategy.recordLatency('anthropic', 'claude-3-haiku', 150);
      latencyStrategy.recordLatency('openai', 'gpt-3.5-turbo', 100);
      
      const context: RoutingContext = {
        task: 'general',
        messages: [{ role: 'user', content: 'Quick question' }],
        strategy: 'latency-based'
      };

      const result = await router.route(context);
      
      expect(result).toBeDefined();
      // Google provider has lowest latency after recording
      expect(result.provider).toBe('google');
    });

    it('should track latency metrics', async () => {
      // First request
      await router.route({ 
        task: 'quick', 
        messages: [{ role: 'user', content: 'Test' }] 
      });
      
      const metrics = router.getMetrics();
      expect(metrics.latency).toBeDefined();
    });
  });

  describe('Quality-Based Routing', () => {
    it('should select highest quality model for complex tasks', async () => {
      const context: RoutingContext = {
        task: 'complex-reasoning',
        messages: [{ role: 'user', content: 'Solve this complex problem' }],
        strategy: 'quality-based'
      };

      const result = await router.route(context);
      
      // Quality-based should prefer opus/4 models
      expect(['claude-3-opus', 'gpt-4-turbo']).toContain(result.model);
    });
  });

  describe('Fallback Chains', () => {
    it('should follow fallback chain on failure', async () => {
      // Configure fallback chain
      router.setFallbackChain(['anthropic', 'openai', 'google']);
      
      const context: RoutingContext = {
        task: 'general',
        messages: [{ role: 'user', content: 'Test' }],
        fallbackChain: ['google', 'openai']
      };

      const result = await router.route(context);
      
      expect(result).toBeDefined();
    });

    it('should try next provider in chain if first fails', async () => {
      router.setFallbackChain(['anthropic', 'openai', 'google']);
      
      const context: RoutingContext = {
        task: 'general',
        messages: [{ role: 'user', content: 'Test' }]
      };

      const result = await router.route(context);
      expect(result.provider).toBeDefined();
    });

    it('should throw error if all fallbacks fail', async () => {
      // Create router with no providers
      const emptyManager = new ProviderManager();
      const emptyRouter = new ModelRouter(emptyManager);
      
      const context: RoutingContext = {
        task: 'general',
        messages: [{ role: 'user', content: 'Test' }]
      };

      await expect(emptyRouter.route(context)).rejects.toThrow('No providers');
    });
  });

  describe('Routing Metrics', () => {
    it('should track routing decisions', async () => {
      await router.route({ 
        task: 'planning', 
        messages: [{ role: 'user', content: 'Plan' }] 
      });
      await router.route({ 
        task: 'coding', 
        messages: [{ role: 'user', content: 'Code' }] 
      });
      
      const metrics = router.getMetrics();
      
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.byStrategy).toBeDefined();
      expect(metrics.byProvider).toBeDefined();
    });

    it('should track success rates', async () => {
      await router.route({ 
        task: 'quick', 
        messages: [{ role: 'user', content: 'Hi' }] 
      });
      
      const metrics = router.getMetrics();
      expect(metrics.successRate).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average latency', async () => {
      await router.route({ 
        task: 'quick', 
        messages: [{ role: 'user', content: 'Test 1' }] 
      });
      await router.route({ 
        task: 'quick', 
        messages: [{ role: 'user', content: 'Test 2' }] 
      });
      
      const metrics = router.getMetrics();
      expect(metrics.avgLatencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration with ProviderManager', () => {
    it('should use ProviderManager providers', () => {
      const providers = router.getAvailableProviders();
      expect(providers.length).toBe(3);
    });

    it('should update when providers change', () => {
      const newProvider = new MockProvider('ollama', [
        createModel({ id: 'llama2', name: 'Llama 2', provider: 'ollama' })
      ]);
      
      providerManager.registerProvider(newProvider);
      
      const providers = router.getAvailableProviders();
      expect(providers.length).toBe(4);
    });
  });

  describe('Custom Strategies', () => {
    it('should allow registering custom strategies', () => {
      const customStrategy = {
        name: 'custom-test',
        select: jest.fn().mockReturnValue({
          provider: 'anthropic',
          model: 'claude-3-haiku',
          reason: 'Custom selection'
        })
      };

      router.registerStrategy(customStrategy);
      
      expect(router.getStrategies().map(s => s.name)).toContain('custom-test');
    });

    it('should use custom strategy when specified', async () => {
      const customStrategy = {
        name: 'priority-test',
        select: jest.fn().mockReturnValue({
          provider: 'google',
          model: 'gemini-pro',
          reason: 'Priority routing'
        })
      };

      router.registerStrategy(customStrategy);
      
      const result = await router.route({
        task: 'general',
        messages: [{ role: 'user', content: 'Test' }],
        strategy: 'priority-test'
      });

      expect(result.provider).toBe('google');
      expect(result.model).toBe('gemini-pro');
      expect(customStrategy.select).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should accept routing configuration', () => {
      router.configure({
        default: 'anthropic',
        routing: {
          planning: { provider: 'anthropic', model: 'claude-3-opus' },
          coding: { provider: 'anthropic', model: 'claude-3-sonnet' },
          research: { provider: 'openai', model: 'gpt-4-turbo' },
          quick: { provider: 'google', model: 'gemini-pro' }
        },
        fallbacks: {
          'anthropic': ['openai', 'google'],
          'openai': ['anthropic', 'google']
        }
      });

      const config = router.getConfiguration();
      expect(config.default).toBe('anthropic');
      expect(config.routing?.planning?.model).toBe('claude-3-opus');
    });

    it('should use configuration for routing decisions', async () => {
      router.configure({
        default: 'openai',
        routing: {
          quick: { provider: 'google', model: 'gemini-pro' }
        }
      });

      const result = await router.route({
        task: 'quick',
        messages: [{ role: 'user', content: 'Hi' }]
      });

      expect(result.provider).toBe('google');
      expect(result.model).toBe('gemini-pro');
    });
  });
});

describe('Routing Strategies', () => {
  let mockProviders: Provider[];

  beforeEach(() => {
    mockProviders = [
      new MockProvider('anthropic', [
        createModel({ 
          id: 'claude-3-opus', 
          provider: 'anthropic',
          costPer1KInput: 0.015, 
          costPer1KOutput: 0.075 
        }),
        createModel({ 
          id: 'claude-3-haiku', 
          provider: 'anthropic',
          costPer1KInput: 0.00025, 
          costPer1KOutput: 0.00125 
        })
      ]),
      new MockProvider('openai', [
        createModel({ 
          id: 'gpt-4-turbo', 
          provider: 'openai',
          costPer1KInput: 0.01, 
          costPer1KOutput: 0.03 
        })
      ])
    ];
  });

  describe('TaskBasedStrategy', () => {
    let strategy: TaskBasedStrategy;

    beforeEach(() => {
      strategy = new TaskBasedStrategy({
        planning: { provider: 'anthropic', model: 'claude-3-opus' },
        coding: { provider: 'anthropic', model: 'claude-3-sonnet' },
        quick: { provider: 'anthropic', model: 'claude-3-haiku' }
      });
    });

    it('should select model based on task type', () => {
      const result = strategy.select('planning', mockProviders);
      expect(result.model).toBe('claude-3-opus');
    });

    it('should fall back to default for unknown tasks', () => {
      const result = strategy.select('unknown-task', mockProviders);
      expect(result).toBeDefined();
    });
  });

  describe('CostBasedStrategy', () => {
    let strategy: CostBasedStrategy;

    beforeEach(() => {
      strategy = new CostBasedStrategy();
    });

    it('should select cheapest model', () => {
      const result = strategy.select('general', mockProviders);
      expect(result.model).toBe('claude-3-haiku');
    });

    it('should respect budget constraint', () => {
      const result = strategy.select('general', mockProviders, {
        maxCostPer1K: 0.001
      });
      expect(result.model).toBe('claude-3-haiku');
    });

    it('should consider output token costs', () => {
      const result = strategy.select('general', mockProviders, {
        estimatedOutputTokens: 1000
      });
      expect(result).toBeDefined();
    });
  });

  describe('LatencyBasedStrategy', () => {
    let strategy: LatencyBasedStrategy;

    beforeEach(() => {
      strategy = new LatencyBasedStrategy();
      // Record some latency samples
      strategy.recordLatency('anthropic', 'claude-3-opus', 200);
      strategy.recordLatency('anthropic', 'claude-3-haiku', 50);
      strategy.recordLatency('openai', 'gpt-4-turbo', 150);
    });

    it('should select fastest model', () => {
      const result = strategy.select('general', mockProviders);
      expect(result.model).toBe('claude-3-haiku');
    });

    it('should track latency history', () => {
      const latency = strategy.getAverageLatency('anthropic', 'claude-3-haiku');
      expect(latency).toBe(50);
    });
  });

  describe('QualityBasedStrategy', () => {
    let strategy: QualityBasedStrategy;

    beforeEach(() => {
      strategy = new QualityBasedStrategy({
        'claude-3-opus': 95,
        'claude-3-haiku': 75,
        'gpt-4-turbo': 90
      });
    });

    it('should select highest quality model', () => {
      const result = strategy.select('general', mockProviders);
      expect(result.model).toBe('claude-3-opus');
    });

    it('should provide quality score in reason', () => {
      const result = strategy.select('general', mockProviders);
      expect(result.reason).toContain('95');
    });
  });
});
