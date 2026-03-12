/**
 * Agent Model Configuration - Issue #22.3
 * Per-agent model configuration with dynamic switching support
 */

import { ProviderManager } from './provider-manager';
import { Model, ProviderName } from '../types';

/**
 * Supported agent types for model configuration
 */
export type AgentType = 'build' | 'plan' | 'researcher' | 'triage';

/**
 * Model mapping for an agent
 */
export interface AgentModelMapping {
  /** Model ID (e.g., 'claude-3-opus') */
  model: string;
  /** Provider name (e.g., 'anthropic') */
  provider: ProviderName | string;
  /** Optional temperature override for this agent */
  temperature?: number;
  /** Optional max tokens override for this agent */
  maxTokens?: number;
}

/**
 * Full agent model configuration
 */
export type AgentModelConfigMap = Record<AgentType, AgentModelMapping>;

/**
 * Options for AgentModelConfig
 */
export interface AgentModelConfigOptions {
  /** Initial configuration */
  config?: Partial<AgentModelConfigMap>;
  /** Default provider when not specified */
  defaultProvider?: ProviderName | string;
  /** Whether to validate models by default */
  validateByDefault?: boolean;
}

/**
 * Options for setModelForAgent
 */
export interface SetModelOptions {
  /** Override validation setting */
  validate?: boolean;
}

/**
 * Options for CLI override
 */
export interface CliOverrideOptions extends SetModelOptions {
  /** Whether to apply to all agents */
  applyToAll?: boolean;
}

/**
 * Error thrown when model validation fails
 */
export class ModelValidationError extends Error {
  public readonly provider: string;
  public readonly model: string;
  public readonly availableModels: string[];

  constructor(provider: string, model: string, availableModels: string[]) {
    super(
      `Model '${model}' not found for provider '${provider}'. ` +
      `Available models: ${availableModels.join(', ')}`
    );
    this.name = 'ModelValidationError';
    this.provider = provider;
    this.model = model;
    this.availableModels = availableModels;
  }
}

/**
 * Default model configurations for each agent type
 */
const DEFAULT_CONFIG: AgentModelConfigMap = {
  build: {
    model: 'claude-3-sonnet',
    provider: 'anthropic',
    temperature: 0.7,
    maxTokens: 4096
  },
  plan: {
    model: 'claude-3-opus',
    provider: 'anthropic',
    temperature: 0.3,
    maxTokens: 8192
  },
  researcher: {
    model: 'claude-3-sonnet',
    provider: 'anthropic',
    temperature: 0.5,
    maxTokens: 4096
  },
  triage: {
    model: 'claude-3-haiku',
    provider: 'anthropic',
    temperature: 0.3,
    maxTokens: 2048
  }
};

/**
 * AgentModelConfig class
 * 
 * Manages per-agent model configuration with:
 * - Different models per agent type (build, plan, researcher, triage)
 * - Dynamic model switching via CLI flags
 * - Model availability validation
 * - Graceful error handling
 */
export class AgentModelConfig {
  private providerManager: ProviderManager;
  private config: AgentModelConfigMap;
  private defaultProvider: ProviderName | string;
  private validateByDefault: boolean;

  constructor(providerManager: ProviderManager, options: AgentModelConfigOptions = {}) {
    this.providerManager = providerManager;
    this.defaultProvider = options.defaultProvider || 'anthropic';
    this.validateByDefault = options.validateByDefault ?? true;
    
    // Initialize with defaults, override with provided config
    this.config = {
      ...DEFAULT_CONFIG,
      ...options.config
    };
  }

  /**
   * Get the provider manager
   */
  getProviderManager(): ProviderManager {
    return this.providerManager;
  }

  /**
   * Get model configuration for a specific agent type
   */
  getModelForAgent(agentType: AgentType): AgentModelMapping {
    this.validateAgentType(agentType);
    return { ...this.config[agentType] };
  }

  /**
   * Set model for a specific agent type
   */
  async setModelForAgent(
    agentType: AgentType, 
    mapping: AgentModelMapping,
    options: SetModelOptions = {}
  ): Promise<void> {
    this.validateAgentType(agentType);
    
    const shouldValidate = options.validate ?? this.validateByDefault;
    
    if (shouldValidate) {
      const isValid = await this.validateModel(mapping.provider, mapping.model);
      if (!isValid) {
        const availableModels = this.getAvailableModelsForProvider(mapping.provider);
        throw new ModelValidationError(mapping.provider, mapping.model, availableModels);
      }
    }
    
    this.config[agentType] = { ...mapping };
  }

  /**
   * Get the full configuration
   */
  getConfig(): AgentModelConfigMap {
    return {
      build: { ...this.config.build },
      plan: { ...this.config.plan },
      researcher: { ...this.config.researcher },
      triage: { ...this.config.triage }
    };
  }

  /**
   * Set the full configuration
   */
  setConfig(config: Partial<AgentModelConfigMap>): void {
    if (config.build) this.config.build = { ...config.build };
    if (config.plan) this.config.plan = { ...config.plan };
    if (config.researcher) this.config.researcher = { ...config.researcher };
    if (config.triage) this.config.triage = { ...config.triage };
  }

  /**
   * Validate that a model exists for a provider
   */
  async validateModel(provider: ProviderName | string, model: string): Promise<boolean> {
    const providerInstance = this.providerManager.getProvider(provider as ProviderName);
    
    if (!providerInstance) {
      return false;
    }
    
    return providerInstance.hasModel(model);
  }

  /**
   * Parse a CLI flag string into provider and model
   * 
   * Supports formats:
   * - "provider:model" (e.g., "anthropic:claude-3-opus")
   * - "provider/model" (e.g., "openai/gpt-4-turbo")
   * - "model" (uses default provider)
   */
  parseCliFlag(flag: string): { provider: ProviderName | string; model: string } {
    if (!flag || flag.trim() === '') {
      throw new Error('Invalid model flag: empty string');
    }

    const trimmed = flag.trim();

    // Check for colon separator (provider:model)
    if (trimmed.includes(':')) {
      const [provider, model] = trimmed.split(':');
      if (!provider || !model) {
        throw new Error(`Invalid model flag format: '${flag}'. Expected 'provider:model'`);
      }
      return { provider, model };
    }

    // Check for slash separator (provider/model)
    if (trimmed.includes('/')) {
      const [provider, model] = trimmed.split('/');
      if (!provider || !model) {
        throw new Error(`Invalid model flag format: '${flag}'. Expected 'provider/model'`);
      }
      return { provider, model };
    }

    // Just model ID - use default provider
    return { provider: this.defaultProvider, model: trimmed };
  }

  /**
   * Apply a CLI override to an agent type
   * 
   * @param agentType - Agent type or 'all' to apply to all agents
   * @param flag - CLI flag in format 'provider:model' or just 'model'
   * @param options - Override options
   */
  async applyCliOverride(
    agentType: AgentType | 'all',
    flag: string,
    options: CliOverrideOptions = {}
  ): Promise<void> {
    const { provider, model } = this.parseCliFlag(flag);
    
    const shouldValidate = options.validate ?? this.validateByDefault;
    
    if (shouldValidate) {
      const isValid = await this.validateModel(provider, model);
      if (!isValid) {
        const availableModels = this.getAvailableModelsForProvider(provider);
        throw new ModelValidationError(provider, model, availableModels);
      }
    }

    const mapping: AgentModelMapping = { provider, model };

    if (agentType === 'all') {
      // Apply to all agent types
      this.config.build = { ...mapping };
      this.config.plan = { ...mapping };
      this.config.researcher = { ...mapping };
      this.config.triage = { ...mapping };
    } else {
      this.validateAgentType(agentType);
      this.config[agentType] = { ...mapping };
    }
  }

  /**
   * List all available models
   */
  listAvailableModels(): Model[] {
    return this.providerManager.listAllModels();
  }

  /**
   * Get recommended model for an agent type based on requirements
   */
  getRecommendedModel(agentType: AgentType): Model | undefined {
    const mapping = this.getModelForAgent(agentType);
    const providers = this.providerManager.listProviders();
    
    // Find the provider
    const provider = providers.find(p => p.name === mapping.provider);
    if (!provider) {
      // Fallback to first available provider
      const firstProvider = providers[0];
      return firstProvider?.models[0];
    }
    
    // Find the model
    const model = provider.models.find(m => m.id === mapping.model);
    if (model) {
      return model;
    }
    
    // Fallback to first available model from provider
    return provider.models[0];
  }

  /**
   * Serialize configuration to JSON
   */
  toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Load configuration from JSON
   */
  loadFromJSON(json: string): void {
    try {
      const parsed = JSON.parse(json);
      
      if (parsed.build) this.config.build = parsed.build;
      if (parsed.plan) this.config.plan = parsed.plan;
      if (parsed.researcher) this.config.researcher = parsed.researcher;
      if (parsed.triage) this.config.triage = parsed.triage;
    } catch (error) {
      throw new Error(`Failed to parse agent model config JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = {
      build: { ...DEFAULT_CONFIG.build },
      plan: { ...DEFAULT_CONFIG.plan },
      researcher: { ...DEFAULT_CONFIG.researcher },
      triage: { ...DEFAULT_CONFIG.triage }
    };
  }

  /**
   * Validate an agent type
   */
  private validateAgentType(agentType: string): void {
    const validTypes: AgentType[] = ['build', 'plan', 'researcher', 'triage'];
    if (!validTypes.includes(agentType as AgentType)) {
      throw new Error(
        `Invalid agent type: '${agentType}'. ` +
        `Valid types are: ${validTypes.join(', ')}`
      );
    }
  }

  /**
   * Get available models for a provider
   */
  private getAvailableModelsForProvider(provider: ProviderName | string): string[] {
    const providerInstance = this.providerManager.getProvider(provider as ProviderName);
    if (!providerInstance) {
      return [];
    }
    return providerInstance.models.map(m => m.id);
  }
}

/**
 * Create an AgentModelConfig instance
 */
export function createAgentModelConfig(
  providerManager: ProviderManager,
  options: AgentModelConfigOptions = {}
): AgentModelConfig {
  return new AgentModelConfig(providerManager, options);
}
