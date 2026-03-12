/**
 * Model Registry - Issue #22.5
 * Tracks available models and their capabilities
 */

import { ProviderName } from '../types';
import {
  ModelCapabilities,
  CapabilitiesDatabase,
  getCapabilitiesDatabase
} from './capabilities';

/**
 * Model entry in the registry
 */
export interface RegistryModel {
  id: string;
  provider: ProviderName | string;
  capabilities: ModelCapabilities;
  available: boolean;
  lastChecked?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Options for listing models
 */
export interface ListOptions {
  provider?: ProviderName | string;
  available?: boolean;
  supportsTools?: boolean;
  supportsVision?: boolean;
  supportsStreaming?: boolean;
  supportsJsonMode?: boolean;
}

/**
 * Options for finding the best model
 */
export interface FindBestOptions {
  provider?: ProviderName | string;
  requiresTools?: boolean;
  requiresVision?: boolean;
  requiresStreaming?: boolean;
  requiresJsonMode?: boolean;
  maxTokensRequired?: number;
  optimizeFor?: 'cost' | 'performance' | 'tokens';
}

/**
 * ModelRegistry - Central registry for tracking available models
 */
export class ModelRegistry {
  private models: Map<string, RegistryModel> = new Map();
  private capabilitiesDb: CapabilitiesDatabase;

  constructor(capabilitiesDb?: CapabilitiesDatabase) {
    this.capabilitiesDb = capabilitiesDb || getCapabilitiesDatabase();
  }

  /**
   * Register a model in the registry
   */
  register(model: RegistryModel): void {
    this.models.set(model.id, { ...model });
  }

  /**
   * Get a model by ID
   */
  get(id: string): RegistryModel | undefined {
    return this.models.get(id);
  }

  /**
   * Remove a model from the registry
   */
  unregister(id: string): void {
    this.models.delete(id);
  }

  /**
   * List models with optional filtering
   */
  list(options: ListOptions = {}): RegistryModel[] {
    let models = Array.from(this.models.values());

    if (options.provider !== undefined) {
      models = models.filter(m => m.provider === options.provider);
    }

    if (options.available !== undefined) {
      models = models.filter(m => m.available === options.available);
    }

    if (options.supportsTools !== undefined) {
      models = models.filter(m => m.capabilities.supportsTools === options.supportsTools);
    }

    if (options.supportsVision !== undefined) {
      models = models.filter(m => m.capabilities.supportsVision === options.supportsVision);
    }

    if (options.supportsStreaming !== undefined) {
      models = models.filter(m => m.capabilities.supportsStreaming === options.supportsStreaming);
    }

    if (options.supportsJsonMode !== undefined) {
      models = models.filter(m => m.capabilities.supportsJsonMode === options.supportsJsonMode);
    }

    return models;
  }

  /**
   * Set availability for a model
   */
  setAvailability(id: string, available: boolean): void {
    const model = this.models.get(id);
    if (!model) {
      throw new Error(`Model "${id}" not found in registry`);
    }
    model.available = available;
    model.lastChecked = new Date();
  }

  /**
   * Get all available models
   */
  getAvailableModels(): RegistryModel[] {
    return this.list({ available: true });
  }

  /**
   * Find the best model for given requirements
   */
  findBestModel(options: FindBestOptions = {}): RegistryModel | undefined {
    let candidates = this.getAvailableModels();

    // Filter by provider if specified
    if (options.provider) {
      candidates = candidates.filter(m => m.provider === options.provider);
    }

    // Filter by capability requirements
    if (options.requiresTools) {
      candidates = candidates.filter(m => m.capabilities.supportsTools);
    }

    if (options.requiresVision) {
      candidates = candidates.filter(m => m.capabilities.supportsVision);
    }

    if (options.requiresStreaming) {
      candidates = candidates.filter(m => m.capabilities.supportsStreaming);
    }

    if (options.requiresJsonMode) {
      candidates = candidates.filter(m => m.capabilities.supportsJsonMode);
    }

    if (options.maxTokensRequired) {
      candidates = candidates.filter(m => m.capabilities.maxTokens >= options.maxTokensRequired!);
    }

    if (candidates.length === 0) {
      return undefined;
    }

    // Sort based on optimization criteria
    const optimizeFor = options.optimizeFor || 'cost';

    if (optimizeFor === 'cost') {
      // Sort by total cost (input + output) ascending
      candidates.sort((a, b) => {
        const costA = a.capabilities.costPer1KInput + a.capabilities.costPer1KOutput;
        const costB = b.capabilities.costPer1KInput + b.capabilities.costPer1KOutput;
        return costA - costB;
      });
    } else if (optimizeFor === 'performance') {
      // Sort by number of supported capabilities descending (more features = "better" performance)
      candidates.sort((a, b) => {
        const scoreA = this.countCapabilities(a.capabilities);
        const scoreB = this.countCapabilities(b.capabilities);
        return scoreB - scoreA;
      });
    } else if (optimizeFor === 'tokens') {
      // Sort by max tokens descending
      candidates.sort((a, b) => b.capabilities.maxTokens - a.capabilities.maxTokens);
    }

    return candidates[0];
  }

  /**
   * Count number of true capability flags
   */
  private countCapabilities(cap: ModelCapabilities): number {
    let count = 0;
    if (cap.supportsTools) count++;
    if (cap.supportsVision) count++;
    if (cap.supportsStreaming) count++;
    if (cap.supportsJsonMode) count++;
    return count;
  }

  /**
   * Import all models from the capabilities database
   */
  importFromCapabilitiesDatabase(): void {
    const allCapabilities = this.capabilitiesDb.listModels();

    for (const cap of allCapabilities) {
      this.register({
        id: cap.model,
        provider: cap.provider,
        capabilities: cap,
        available: true
      });
    }
  }

  /**
   * Export registry as JSON string
   */
  export(): string {
    const models = Array.from(this.models.values());
    return JSON.stringify(models, null, 2);
  }

  /**
   * Import registry from JSON string
   */
  import(json: string): void {
    const models: RegistryModel[] = JSON.parse(json);
    for (const model of models) {
      this.register(model);
    }
  }

  /**
   * Clear all models from the registry
   */
  clear(): void {
    this.models.clear();
  }

  /**
   * Get count of registered models
   */
  get size(): number {
    return this.models.size;
  }
}

// Singleton instance
let registryInstance: ModelRegistry | null = null;

/**
 * Get the singleton model registry instance
 */
export function getModelRegistry(): ModelRegistry {
  if (!registryInstance) {
    registryInstance = new ModelRegistry();
  }
  return registryInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetModelRegistry(): void {
  registryInstance = null;
}
