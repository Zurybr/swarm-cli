/**
 * Providers Module - Issue #22
 * Multi-model provider abstraction layer
 */

export { BaseProvider } from './base-provider';
export { AnthropicProvider } from './anthropic-provider';
export { OpenAIProvider } from './openai-provider';
export { OllamaProvider } from './ollama-provider';
export { GoogleProvider } from './google-provider';
export { ProviderManager } from './provider-manager';

// API Key Management - Issue #22.4
export { 
  ApiKeyManager, 
  KeySource, 
  getApiKeyManager, 
  resetApiKeyManager 
} from './api-key-manager';
export type { 
  KeyMetadata, 
  KeyHistoryEntry, 
  KeyValidationResult, 
  ResolveKeyOptions 
} from './api-key-manager';

// Config Loader - Issue #22.4
export { 
  ConfigLoader, 
  getConfigLoader, 
  resetConfigLoader 
} from './config-loader';
export type { 
  ProviderConfig, 
  DefaultsConfig, 
  SwarmConfig, 
  ConfigValidationResult 
} from './config-loader';

// Model Capabilities - Issue #22.5
export {
  CapabilitiesDatabase,
  detectCapabilities,
  getCapabilitiesWarning,
  getCapabilitiesDatabase,
  resetCapabilitiesDatabase,
  toModelFormat,
  meetsRequirements
} from './capabilities';
export type {
  ModelCapabilities,
  CapabilityRequirements,
  DetectOptions
} from './capabilities';

// Model Registry - Issue #22.5
export {
  ModelRegistry,
  getModelRegistry,
  resetModelRegistry
} from './model-registry';
export type {
  RegistryModel,
  ListOptions,
  FindBestOptions
} from './model-registry';

// Model Router - Issue #22.2
export { 
  ModelRouter, 
  createModelRouter 
} from './model-router';
export type { 
  RoutingContext, 
  RoutingResult, 
  RoutingConfiguration, 
  RoutingMetrics 
} from './model-router';

// Routing Strategies - Issue #22.2
export {
  TaskBasedStrategy,
  CostBasedStrategy,
  LatencyBasedStrategy,
  QualityBasedStrategy,
  createDefaultStrategies
} from './routing-strategies';
export type {
  RoutingStrategy,
  RoutingSelection,
  StrategyOptions,
  TaskRoutingConfig
} from './routing-strategies';
