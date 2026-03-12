/**
 * Routing Strategies - Issue #22.2
 * Intelligent routing strategies for model selection
 */

import { Provider, Model, ProviderName } from '../types';

/**
 * Result of a routing decision
 */
export interface RoutingSelection {
  provider: ProviderName | string;
  model: string;
  reason: string;
}

/**
 * Options for strategy selection
 */
export interface StrategyOptions {
  maxCostPer1K?: number;
  estimatedOutputTokens?: number;
  requireTools?: boolean;
  requireVision?: boolean;
  maxLatencyMs?: number;
}

/**
 * Base interface for routing strategies
 */
export interface RoutingStrategy {
  name: string;
  select(task: string, providers: Provider[], options?: StrategyOptions): RoutingSelection;
}

/**
 * Task routing configuration
 */
export interface TaskRoutingConfig {
  provider: ProviderName | string;
  model: string;
}

/**
 * Task-based routing strategy
 * Routes requests based on the type of task being performed
 */
export class TaskBasedStrategy implements RoutingStrategy {
  name = 'task-based';
  
  private taskConfig: Record<string, TaskRoutingConfig>;
  private defaultConfig: TaskRoutingConfig;

  constructor(config?: Record<string, TaskRoutingConfig>) {
    // Default task routing configuration
    this.taskConfig = config || {
      // Planning tasks - use high-capability models for complex reasoning
      planning: { provider: 'anthropic', model: 'claude-3-opus' },
      
      // Coding tasks - use models with good tool support
      coding: { provider: 'anthropic', model: 'claude-3-sonnet' },
      
      // Research tasks - use models with large context
      research: { provider: 'anthropic', model: 'claude-3-sonnet' },
      
      // Quick/simple tasks - use fast, cheap models
      quick: { provider: 'anthropic', model: 'claude-3-haiku' },
      
      // Complex reasoning - use best available
      'complex-reasoning': { provider: 'anthropic', model: 'claude-3-opus' },
      
      // General tasks - balanced choice
      general: { provider: 'anthropic', model: 'claude-3-sonnet' }
    };
    
    this.defaultConfig = { provider: 'anthropic', model: 'claude-3-sonnet' };
  }

  select(task: string, providers: Provider[], options?: StrategyOptions): RoutingSelection {
    // Normalize task name
    const normalizedTask = task.toLowerCase().trim();
    
    // Look up task configuration
    const config = this.taskConfig[normalizedTask] || this.defaultConfig;
    
    // Check if configured provider is available
    const provider = providers.find(p => p.name === config.provider);
    
    if (provider) {
      // Check if configured model exists
      if (provider.hasModel(config.model)) {
        // Check capability requirements
        if (options?.requireTools && !provider.supportsTools) {
          return this.findFallback(providers, options, 'tools');
        }
        if (options?.requireVision && !provider.supportsVision) {
          return this.findFallback(providers, options, 'vision');
        }
        
        return {
          provider: config.provider,
          model: config.model,
          reason: `Task '${task}' routed to ${config.model} via ${config.provider}`
        };
      }
      
      // Model not found, use first available from provider
      const fallbackModel = provider.models[0];
      if (fallbackModel) {
        return {
          provider: config.provider,
          model: fallbackModel.id,
          reason: `Configured model ${config.model} not found, using ${fallbackModel.id}`
        };
      }
    }
    
    // Provider not available, find fallback
    return this.findFallback(providers, options, 'default');
  }

  private findFallback(
    providers: Provider[], 
    options?: StrategyOptions,
    reason: string = 'fallback'
  ): RoutingSelection {
    // Try to find a provider that meets requirements
    for (const provider of providers) {
      if (options?.requireTools && !provider.supportsTools) continue;
      if (options?.requireVision && !provider.supportsVision) continue;
      
      const model = provider.models[0];
      if (model) {
        return {
          provider: provider.name,
          model: model.id,
          reason: `Fallback to ${model.id} via ${provider.name} (${reason})`
        };
      }
    }
    
    // Last resort - use first available
    const firstProvider = providers[0];
    if (firstProvider && firstProvider.models.length > 0) {
      return {
        provider: firstProvider.name,
        model: firstProvider.models[0].id,
        reason: `Last resort fallback to ${firstProvider.models[0].id}`
      };
    }
    
    throw new Error('No suitable provider found');
  }

  /**
   * Update task routing configuration
   */
  configure(config: Record<string, TaskRoutingConfig>): void {
    this.taskConfig = { ...this.taskConfig, ...config };
  }

  /**
   * Set default routing
   */
  setDefault(config: TaskRoutingConfig): void {
    this.defaultConfig = config;
  }
}

/**
 * Cost-based routing strategy
 * Selects models based on cost optimization
 */
export class CostBasedStrategy implements RoutingStrategy {
  name = 'cost-based';

  select(task: string, providers: Provider[], options?: StrategyOptions): RoutingSelection {
    const candidates: Array<{ provider: Provider; model: Model; totalCost: number }> = [];

    for (const provider of providers) {
      for (const model of provider.models) {
        // Check capability requirements
        if (options?.requireTools && !provider.supportsTools) continue;
        if (options?.requireVision && !provider.supportsVision) continue;
        
        // Calculate total cost
        const inputCost = model.costPer1KInput;
        const outputCost = model.costPer1KOutput;
        const estimatedOutput = options?.estimatedOutputTokens || 500;
        
        // Cost per 1K input + estimated output cost
        const totalCost = inputCost + (outputCost * estimatedOutput / 1000);
        
        // Check budget constraint
        if (options?.maxCostPer1K && inputCost > options.maxCostPer1K) continue;
        
        candidates.push({ provider, model, totalCost });
      }
    }

    if (candidates.length === 0) {
      throw new Error('No models found within budget constraints');
    }

    // Sort by total cost (cheapest first)
    candidates.sort((a, b) => a.totalCost - b.totalCost);

    const selected = candidates[0];
    return {
      provider: selected.provider.name,
      model: selected.model.id,
      reason: `Cost-optimized: ${selected.model.id} ($${selected.model.costPer1KInput.toFixed(5)}/1K input, $${selected.model.costPer1KOutput.toFixed(5)}/1K output)`
    };
  }
}

/**
 * Latency-based routing strategy
 * Selects models based on response latency
 */
export class LatencyBasedStrategy implements RoutingStrategy {
  name = 'latency-based';
  
  private latencyHistory: Map<string, number[]> = new Map();
  private readonly maxSamples = 10;

  select(task: string, providers: Provider[], options?: StrategyOptions): RoutingSelection {
    const candidates: Array<{ 
      provider: Provider; 
      model: Model; 
      avgLatency: number 
    }> = [];

    for (const provider of providers) {
      for (const model of provider.models) {
        // Check capability requirements
        if (options?.requireTools && !provider.supportsTools) continue;
        if (options?.requireVision && !provider.supportsVision) continue;
        
        // Check latency constraint
        const avgLatency = this.getAverageLatency(provider.name, model.id);
        
        if (options?.maxLatencyMs && avgLatency > options.maxLatencyMs) continue;
        
        candidates.push({ provider, model, avgLatency });
      }
    }

    if (candidates.length === 0) {
      // Fall back to first available if no latency data
      const firstProvider = providers[0];
      if (firstProvider && firstProvider.models.length > 0) {
        return {
          provider: firstProvider.name,
          model: firstProvider.models[0].id,
          reason: 'No latency data available, using first available'
        };
      }
      throw new Error('No providers available');
    }

    // Sort by average latency (fastest first)
    // Models without latency data get lower priority
    candidates.sort((a, b) => {
      if (a.avgLatency === 0 && b.avgLatency === 0) return 0;
      if (a.avgLatency === 0) return 1;
      if (b.avgLatency === 0) return -1;
      return a.avgLatency - b.avgLatency;
    });

    const selected = candidates[0];
    const latencyInfo = selected.avgLatency > 0 
      ? ` (${selected.avgLatency.toFixed(0)}ms avg)` 
      : '';
    
    return {
      provider: selected.provider.name,
      model: selected.model.id,
      reason: `Latency-optimized: ${selected.model.id}${latencyInfo}`
    };
  }

  /**
   * Record a latency sample
   */
  recordLatency(provider: ProviderName | string, model: string, latencyMs: number): void {
    const key = `${provider}:${model}`;
    const history = this.latencyHistory.get(key) || [];
    
    history.push(latencyMs);
    
    // Keep only recent samples
    if (history.length > this.maxSamples) {
      history.shift();
    }
    
    this.latencyHistory.set(key, history);
  }

  /**
   * Get average latency for a model
   */
  getAverageLatency(provider: ProviderName | string, model: string): number {
    const key = `${provider}:${model}`;
    const history = this.latencyHistory.get(key);
    
    if (!history || history.length === 0) return 0;
    
    return history.reduce((sum, l) => sum + l, 0) / history.length;
  }

  /**
   * Clear latency history
   */
  clearHistory(): void {
    this.latencyHistory.clear();
  }
}

/**
 * Quality-based routing strategy
 * Selects models based on quality scores
 */
export class QualityBasedStrategy implements RoutingStrategy {
  name = 'quality-based';
  
  private qualityScores: Map<string, number>;

  constructor(scores?: Record<string, number>) {
    // Default quality scores (0-100)
    this.qualityScores = new Map(Object.entries({
      'claude-3-opus': 95,
      'claude-3-sonnet': 85,
      'claude-3-haiku': 75,
      'gpt-4-turbo': 90,
      'gpt-4': 88,
      'gpt-3.5-turbo': 70,
      'gemini-pro': 80,
      'gemini-ultra': 92,
      ...scores
    }));
  }

  select(task: string, providers: Provider[], options?: StrategyOptions): RoutingSelection {
    const candidates: Array<{ 
      provider: Provider; 
      model: Model; 
      score: number 
    }> = [];

    for (const provider of providers) {
      for (const model of provider.models) {
        // Check capability requirements
        if (options?.requireTools && !provider.supportsTools) continue;
        if (options?.requireVision && !provider.supportsVision) continue;
        
        const score = this.qualityScores.get(model.id) || 50; // Default score
        candidates.push({ provider, model, score });
      }
    }

    if (candidates.length === 0) {
      throw new Error('No suitable models found');
    }

    // Sort by quality score (highest first)
    candidates.sort((a, b) => b.score - a.score);

    const selected = candidates[0];
    return {
      provider: selected.provider.name,
      model: selected.model.id,
      reason: `Quality-optimized: ${selected.model.id} (quality score: ${selected.score})`
    };
  }

  /**
   * Set quality score for a model
   */
  setScore(modelId: string, score: number): void {
    this.qualityScores.set(modelId, score);
  }

  /**
   * Get quality score for a model
   */
  getScore(modelId: string): number {
    return this.qualityScores.get(modelId) || 50;
  }
}

/**
 * Create default strategies
 */
export function createDefaultStrategies(): RoutingStrategy[] {
  return [
    new TaskBasedStrategy(),
    new CostBasedStrategy(),
    new LatencyBasedStrategy(),
    new QualityBasedStrategy()
  ];
}
