/**
 * Model Router - Issue #22.2
 * Intelligent model routing with multiple strategies, fallback chains, and metrics
 */

import { Provider, ProviderName, CompletionOptions } from '../types';
import { ProviderManager } from './provider-manager';
import {
  RoutingStrategy,
  TaskBasedStrategy,
  CostBasedStrategy,
  LatencyBasedStrategy,
  QualityBasedStrategy,
  RoutingSelection,
  StrategyOptions,
  TaskRoutingConfig
} from './routing-strategies';

/**
 * Context for routing decisions
 */
export interface RoutingContext {
  task: string;
  messages: Array<{ role: string; content: string }>;
  strategy?: 'task-based' | 'cost-based' | 'latency-based' | 'quality-based' | string;
  constraints?: {
    maxCostPer1K?: number;
    maxLatencyMs?: number;
    requireTools?: boolean;
    requireVision?: boolean;
  };
  estimatedOutputTokens?: number;
  fallbackChain?: (ProviderName | string)[];
}

/**
 * Result of routing decision
 */
export interface RoutingResult {
  provider: ProviderName | string;
  model: string;
  strategy: string;
  reason: string;
  fallbackUsed?: boolean;
}

/**
 * Routing configuration
 */
export interface RoutingConfiguration {
  default: ProviderName | string;
  routing?: Record<string, TaskRoutingConfig>;
  fallbacks?: Record<string, (ProviderName | string)[]>;
}

/**
 * Routing metrics
 */
export interface RoutingMetrics {
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  byStrategy: Record<string, number>;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  latency: {
    min: number;
    max: number;
    avg: number;
  };
}

/**
 * ModelRouter class
 * 
 * Provides intelligent routing of requests to appropriate models
 * based on task type, cost, latency, or quality requirements.
 */
export class ModelRouter {
  private providerManager: ProviderManager;
  private strategies: Map<string, RoutingStrategy> = new Map();
  private fallbackChain: (ProviderName | string)[];
  private configuration: RoutingConfiguration;
  
  // Metrics tracking
  private metrics: {
    requests: number;
    successes: number;
    failures: number;
    latencies: number[];
    byStrategy: Map<string, number>;
    byProvider: Map<string, number>;
    byModel: Map<string, number>;
  };

  constructor(providerManager: ProviderManager, config?: Partial<RoutingConfiguration>) {
    this.providerManager = providerManager;
    
    // Default fallback chain
    this.fallbackChain = ['anthropic', 'openai', 'google', 'ollama'];
    
    // Default configuration
    this.configuration = {
      default: 'anthropic',
      ...config
    };
    
    // Initialize metrics
    this.metrics = {
      requests: 0,
      successes: 0,
      failures: 0,
      latencies: [],
      byStrategy: new Map(),
      byProvider: new Map(),
      byModel: new Map()
    };
    
    // Register default strategies
    this.registerDefaultStrategies();
  }

  /**
   * Register default routing strategies
   */
  private registerDefaultStrategies(): void {
    // Task-based strategy with configuration
    const taskStrategy = new TaskBasedStrategy(this.configuration.routing);
    
    this.registerStrategy(taskStrategy);
    this.registerStrategy(new CostBasedStrategy());
    this.registerStrategy(new LatencyBasedStrategy());
    this.registerStrategy(new QualityBasedStrategy());
  }

  /**
   * Get the provider manager
   */
  getProviderManager(): ProviderManager {
    return this.providerManager;
  }

  /**
   * Register a custom strategy
   */
  registerStrategy(strategy: RoutingStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Get all registered strategies
   */
  getStrategies(): RoutingStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Set fallback chain
   */
  setFallbackChain(chain: (ProviderName | string)[]): void {
    this.fallbackChain = chain;
  }

  /**
   * Get fallback chain
   */
  getFallbackChain(): (ProviderName | string)[] {
    return [...this.fallbackChain];
  }

  /**
   * Configure routing
   */
  configure(config: Partial<RoutingConfiguration>): void {
    this.configuration = { ...this.configuration, ...config };
    
    // Update task-based strategy if routing config provided
    if (config.routing) {
      const taskStrategy = this.strategies.get('task-based') as TaskBasedStrategy;
      if (taskStrategy) {
        taskStrategy.configure(config.routing);
      }
    }
    
    // Update fallbacks
    if (config.fallbacks && config.default) {
      const defaultFallbacks = config.fallbacks[config.default as string];
      if (defaultFallbacks) {
        this.fallbackChain = [config.default, ...defaultFallbacks];
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): RoutingConfiguration {
    return { ...this.configuration };
  }

  /**
   * Route a request to the appropriate model
   */
  async route(context: RoutingContext): Promise<RoutingResult> {
    const startTime = Date.now();
    this.metrics.requests++;
    
    try {
      // Determine which strategy to use
      const strategyName = context.strategy || 'task-based';
      const strategy = this.strategies.get(strategyName);
      
      if (!strategy) {
        throw new Error(`Unknown routing strategy: ${strategyName}`);
      }
      
      // Get available providers
      const providers = this.getAvailableProviders();
      
      if (providers.length === 0) {
        throw new Error('No providers available');
      }
      
      // Build strategy options
      const options: StrategyOptions = {
        maxCostPer1K: context.constraints?.maxCostPer1K,
        maxLatencyMs: context.constraints?.maxLatencyMs,
        requireTools: context.constraints?.requireTools,
        requireVision: context.constraints?.requireVision,
        estimatedOutputTokens: context.estimatedOutputTokens
      };
      
      // Get routing selection from strategy
      let selection: RoutingSelection;
      
      try {
        selection = strategy.select(context.task, providers, options);
      } catch (error) {
        // Strategy failed, try fallback chain
        selection = this.selectFromFallbackChain(providers, context.fallbackChain);
        selection.reason = `Fallback: ${selection.reason}`;
      }
      
      // Track metrics
      this.trackSuccess(selection, strategyName, Date.now() - startTime);
      
      return {
        provider: selection.provider,
        model: selection.model,
        strategy: strategyName,
        reason: selection.reason
      };
      
    } catch (error) {
      this.metrics.failures++;
      throw error;
    }
  }

  /**
   * Select from fallback chain
   */
  private selectFromFallbackChain(
    providers: Provider[],
    customChain?: (ProviderName | string)[]
  ): RoutingSelection {
    const chain = customChain || this.fallbackChain;
    
    for (const providerName of chain) {
      const provider = providers.find(p => p.name === providerName);
      if (provider && provider.models.length > 0) {
        return {
          provider: provider.name,
          model: provider.models[0].id,
          reason: `Selected ${provider.models[0].id} via ${provider.name} from fallback chain`
        };
      }
    }
    
    // Last resort: first available provider
    const firstProvider = providers[0];
    if (firstProvider && firstProvider.models.length > 0) {
      return {
        provider: firstProvider.name,
        model: firstProvider.models[0].id,
        reason: 'Last resort: first available provider'
      };
    }
    
    throw new Error('No providers available in fallback chain');
  }

  /**
   * Track successful routing
   */
  private trackSuccess(
    selection: RoutingSelection, 
    strategyName: string, 
    latencyMs: number
  ): void {
    this.metrics.successes++;
    this.metrics.latencies.push(latencyMs);
    
    // Track by strategy
    const strategyCount = this.metrics.byStrategy.get(strategyName) || 0;
    this.metrics.byStrategy.set(strategyName, strategyCount + 1);
    
    // Track by provider
    const providerCount = this.metrics.byProvider.get(selection.provider as string) || 0;
    this.metrics.byProvider.set(selection.provider as string, providerCount + 1);
    
    // Track by model
    const modelKey = `${selection.provider}:${selection.model}`;
    const modelCount = this.metrics.byModel.get(modelKey) || 0;
    this.metrics.byModel.set(modelKey, modelCount + 1);
    
    // Update latency strategy with new data
    const latencyStrategy = this.strategies.get('latency-based') as LatencyBasedStrategy;
    if (latencyStrategy) {
      latencyStrategy.recordLatency(selection.provider, selection.model, latencyMs);
    }
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): Provider[] {
    return this.providerManager.listProviders();
  }

  /**
   * Get routing metrics
   */
  getMetrics(): RoutingMetrics {
    const latencies = this.metrics.latencies;
    
    return {
      totalRequests: this.metrics.requests,
      successRate: this.metrics.requests > 0 
        ? this.metrics.successes / this.metrics.requests 
        : 0,
      avgLatencyMs: latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0,
      byStrategy: this.mapToObject(this.metrics.byStrategy),
      byProvider: this.mapToObject(this.metrics.byProvider),
      byModel: this.mapToObject(this.metrics.byModel),
      latency: {
        min: latencies.length > 0 ? Math.min(...latencies) : 0,
        max: latencies.length > 0 ? Math.max(...latencies) : 0,
        avg: latencies.length > 0 
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
          : 0
      }
    };
  }

  /**
   * Convert Map to object for metrics
   */
  private mapToObject(map: Map<string, number>): Record<string, number> {
    const obj: Record<string, number> = {};
    map.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      requests: 0,
      successes: 0,
      failures: 0,
      latencies: [],
      byStrategy: new Map(),
      byProvider: new Map(),
      byModel: new Map()
    };
    
    // Also clear latency history
    const latencyStrategy = this.strategies.get('latency-based') as LatencyBasedStrategy;
    if (latencyStrategy) {
      latencyStrategy.clearHistory();
    }
  }

  /**
   * Get best provider for a given task
   * Convenience method for quick routing decisions
   */
  getBestProviderForTask(task: string): Provider | undefined {
    const providers = this.getAvailableProviders();
    if (providers.length === 0) return undefined;
    
    const taskStrategy = this.strategies.get('task-based');
    if (!taskStrategy) return providers[0];
    
    try {
      const selection = taskStrategy.select(task, providers);
      return providers.find(p => p.name === selection.provider);
    } catch {
      return providers[0];
    }
  }

  /**
   * Get cheapest available model
   */
  getCheapestModel(): { provider: Provider; model: import('../types').Model } | undefined {
    const costStrategy = this.strategies.get('cost-based') as CostBasedStrategy;
    if (!costStrategy) return undefined;
    
    const providers = this.getAvailableProviders();
    if (providers.length === 0) return undefined;
    
    try {
      const selection = costStrategy.select('general', providers);
      const provider = providers.find(p => p.name === selection.provider);
      const model = provider?.models.find(m => m.id === selection.model);
      
      if (provider && model) {
        return { provider, model };
      }
    } catch {
      // Fall through
    }
    
    return undefined;
  }

  /**
   * Get fastest available model (based on latency history)
   */
  getFastestModel(): { provider: Provider; model: import('../types').Model } | undefined {
    const latencyStrategy = this.strategies.get('latency-based') as LatencyBasedStrategy;
    if (!latencyStrategy) return undefined;
    
    const providers = this.getAvailableProviders();
    if (providers.length === 0) return undefined;
    
    try {
      const selection = latencyStrategy.select('general', providers);
      const provider = providers.find(p => p.name === selection.provider);
      const model = provider?.models.find(m => m.id === selection.model);
      
      if (provider && model) {
        return { provider, model };
      }
    } catch {
      // Fall through
    }
    
    return undefined;
  }
}

/**
 * Create a model router with default configuration
 */
export function createModelRouter(
  providerManager: ProviderManager,
  config?: Partial<RoutingConfiguration>
): ModelRouter {
  return new ModelRouter(providerManager, config);
}
