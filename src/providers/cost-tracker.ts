/**
 * CostTracker - Issue #22.6
 * Track token usage and costs per request
 */

import { TokenUsage, ProviderName } from '../types';
import { getCapabilitiesDatabase, ModelCapabilities } from './capabilities';

/**
 * A single cost record for a request
 */
export interface CostRecord {
  id: string;
  timestamp: Date;
  provider: ProviderName | string;
  model: string;
  usage: TokenUsage;
  cost: number;
  agentId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

/**
 * Options for tracking a request
 */
export interface TrackRequestOptions {
  provider: ProviderName | string;
  model: string;
  usage: TokenUsage;
  agentId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

/**
 * Summary of costs
 */
export interface CostSummary {
  totalCost: number;
  totalRequests: number;
  totalTokens: {
    input: number;
    output: number;
    total: number;
  };
  byProvider?: Record<string, ProviderCostSummary>;
  byAgent?: Record<string, AgentCostSummary>;
}

/**
 * Cost summary for a provider
 */
export interface ProviderCostSummary {
  provider: string;
  totalCost: number;
  totalRequests: number;
  totalTokens: TokenUsage;
  models: Record<string, ModelCostSummary>;
}

/**
 * Cost summary for a model
 */
export interface ModelCostSummary {
  model: string;
  totalCost: number;
  totalRequests: number;
  totalTokens: TokenUsage;
}

/**
 * Cost summary for an agent
 */
export interface AgentCostSummary {
  agentId: string;
  totalCost: number;
  totalRequests: number;
  totalTokens: TokenUsage;
}

/**
 * Options for filtering cost summaries
 */
export interface CostFilterOptions {
  startDate?: Date;
  endDate?: Date;
  provider?: ProviderName | string;
  model?: string;
  agentId?: string;
}

/**
 * Calculate cost based on model capabilities
 */
function calculateCost(
  provider: ProviderName | string,
  model: string,
  usage: TokenUsage
): number {
  const capabilitiesDb = getCapabilitiesDatabase();
  const capabilities = capabilitiesDb.getCapabilities(provider, model);
  
  if (!capabilities) {
    // If we don't know the model, return 0 cost
    // This handles local models and unknown models
    return 0;
  }

  const inputCost = (usage.input / 1000) * capabilities.costPer1KInput;
  const outputCost = (usage.output / 1000) * capabilities.costPer1KOutput;
  
  return inputCost + outputCost;
}

/**
 * Generate a unique ID for a cost record
 */
function generateId(): string {
  return `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * CostTracker class
 * 
 * Tracks token usage and calculates costs for LLM API requests.
 * Integrates with the model capabilities database for pricing information.
 */
export class CostTracker {
  private records: CostRecord[] = [];

  /**
   * Track a new request with its token usage
   */
  trackRequest(options: TrackRequestOptions): CostRecord {
    const cost = calculateCost(options.provider, options.model, options.usage);
    
    const record: CostRecord = {
      id: generateId(),
      timestamp: new Date(),
      provider: options.provider,
      model: options.model,
      usage: { ...options.usage },
      cost,
      agentId: options.agentId,
      requestId: options.requestId,
      metadata: options.metadata
    };

    this.records.push(record);
    return record;
  }

  /**
   * Get a summary of costs with optional filtering
   */
  getCostSummary(options: CostFilterOptions = {}): CostSummary {
    const filtered = this.filterRecords(options);
    
    const summary: CostSummary = {
      totalCost: 0,
      totalRequests: filtered.length,
      totalTokens: { input: 0, output: 0, total: 0 }
    };

    for (const record of filtered) {
      summary.totalCost += record.cost;
      summary.totalTokens.input += record.usage.input;
      summary.totalTokens.output += record.usage.output;
      summary.totalTokens.total += record.usage.total;
    }

    return summary;
  }

  /**
   * Get costs grouped by provider
   */
  getCostsByProvider(options: CostFilterOptions = {}): Record<string, ProviderCostSummary> {
    const filtered = this.filterRecords(options);
    const byProvider: Record<string, ProviderCostSummary> = {};

    for (const record of filtered) {
      const providerKey = record.provider as string;
      
      if (!byProvider[providerKey]) {
        byProvider[providerKey] = {
          provider: providerKey,
          totalCost: 0,
          totalRequests: 0,
          totalTokens: { input: 0, output: 0, total: 0 },
          models: {}
        };
      }

      const providerSummary = byProvider[providerKey];
      providerSummary.totalCost += record.cost;
      providerSummary.totalRequests++;
      providerSummary.totalTokens.input += record.usage.input;
      providerSummary.totalTokens.output += record.usage.output;
      providerSummary.totalTokens.total += record.usage.total;

      // Track by model within provider
      if (!providerSummary.models[record.model]) {
        providerSummary.models[record.model] = {
          model: record.model,
          totalCost: 0,
          totalRequests: 0,
          totalTokens: { input: 0, output: 0, total: 0 }
        };
      }

      const modelSummary = providerSummary.models[record.model];
      modelSummary.totalCost += record.cost;
      modelSummary.totalRequests++;
      modelSummary.totalTokens.input += record.usage.input;
      modelSummary.totalTokens.output += record.usage.output;
      modelSummary.totalTokens.total += record.usage.total;
    }

    return byProvider;
  }

  /**
   * Get costs grouped by agent
   */
  getCostsByAgent(options: CostFilterOptions = {}): Record<string, AgentCostSummary> {
    const filtered = this.filterRecords(options);
    const byAgent: Record<string, AgentCostSummary> = {};

    for (const record of filtered) {
      const agentKey = record.agentId || 'unknown';
      
      if (!byAgent[agentKey]) {
        byAgent[agentKey] = {
          agentId: agentKey,
          totalCost: 0,
          totalRequests: 0,
          totalTokens: { input: 0, output: 0, total: 0 }
        };
      }

      const agentSummary = byAgent[agentKey];
      agentSummary.totalCost += record.cost;
      agentSummary.totalRequests++;
      agentSummary.totalTokens.input += record.usage.input;
      agentSummary.totalTokens.output += record.usage.output;
      agentSummary.totalTokens.total += record.usage.total;
    }

    return byAgent;
  }

  /**
   * Get costs for today
   */
  getTodayCosts(): CostSummary {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.getCostSummary({ startDate: today });
  }

  /**
   * Get costs for this month
   */
  getThisMonthCosts(): CostSummary {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return this.getCostSummary({ startDate: startOfMonth });
  }

  /**
   * Get all cost records with optional filtering
   */
  getRecords(options: CostFilterOptions = {}): CostRecord[] {
    return this.filterRecords(options);
  }

  /**
   * Clear all records
   */
  clearRecords(): void {
    this.records = [];
  }

  /**
   * Filter records based on options
   */
  private filterRecords(options: CostFilterOptions): CostRecord[] {
    return this.records.filter(record => {
      if (options.startDate && record.timestamp < options.startDate) {
        return false;
      }
      
      if (options.endDate && record.timestamp > options.endDate) {
        return false;
      }
      
      if (options.provider && record.provider !== options.provider) {
        return false;
      }
      
      if (options.model && record.model !== options.model) {
        return false;
      }
      
      if (options.agentId && record.agentId !== options.agentId) {
        return false;
      }
      
      return true;
    });
  }
}

// Singleton instance
let trackerInstance: CostTracker | null = null;

/**
 * Get the singleton cost tracker instance
 */
export function getCostTracker(): CostTracker {
  if (!trackerInstance) {
    trackerInstance = new CostTracker();
  }
  return trackerInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetCostTracker(): void {
  trackerInstance = null;
}
