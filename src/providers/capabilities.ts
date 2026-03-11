/**
 * Model Capabilities Database and Detection - Issue #22.5
 * Provides a centralized database of known model capabilities and auto-detection
 */

import { ProviderName, Model } from '../types';

/**
 * Extended model capabilities interface with all supported features
 */
export interface ModelCapabilities {
  provider: ProviderName | string;
  model: string;
  maxTokens: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsJsonMode: boolean;
  costPer1KInput: number;
  costPer1KOutput: number;
}

/**
 * Requirements for a task to check against model capabilities
 */
export interface CapabilityRequirements {
  requiresTools?: boolean;
  requiresVision?: boolean;
  requiresStreaming?: boolean;
  requiresJsonMode?: boolean;
  maxTokensRequired?: number;
}

/**
 * Options for detectCapabilities function
 */
export interface DetectOptions {
  providerHint?: ProviderName | string;
}

/**
 * Known model capabilities database
 * Aggregated from existing provider definitions
 */
const KNOWN_CAPABILITIES: ModelCapabilities[] = [
  // ========================================
  // Anthropic Claude Models
  // ========================================
  {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    maxTokens: 4096,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    costPer1KInput: 0.015,
    costPer1KOutput: 0.075
  },
  {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    maxTokens: 4096,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    costPer1KInput: 0.003,
    costPer1KOutput: 0.015
  },
  {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    maxTokens: 4096,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    costPer1KInput: 0.00025,
    costPer1KOutput: 0.00125
  },
  {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 8192,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    costPer1KInput: 0.003,
    costPer1KOutput: 0.015
  },
  {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    maxTokens: 8192,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    costPer1KInput: 0.001,
    costPer1KOutput: 0.005
  },

  // ========================================
  // OpenAI GPT Models
  // ========================================
  {
    provider: 'openai',
    model: 'gpt-4o',
    maxTokens: 4096,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    costPer1KInput: 0.005,
    costPer1KOutput: 0.015
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    maxTokens: 4096,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    costPer1KInput: 0.00015,
    costPer1KOutput: 0.0006
  },
  {
    provider: 'openai',
    model: 'gpt-4-turbo',
    maxTokens: 4096,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    costPer1KInput: 0.01,
    costPer1KOutput: 0.03
  },
  {
    provider: 'openai',
    model: 'gpt-4',
    maxTokens: 4096,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    costPer1KInput: 0.03,
    costPer1KOutput: 0.06
  },
  {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    maxTokens: 4096,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    costPer1KInput: 0.0005,
    costPer1KOutput: 0.0015
  },
  {
    provider: 'openai',
    model: 'o1-preview',
    maxTokens: 32768,
    supportsTools: false,
    supportsVision: false,
    supportsStreaming: false,
    supportsJsonMode: false,
    costPer1KInput: 0.015,
    costPer1KOutput: 0.06
  },
  {
    provider: 'openai',
    model: 'o1-mini',
    maxTokens: 65536,
    supportsTools: false,
    supportsVision: false,
    supportsStreaming: false,
    supportsJsonMode: false,
    costPer1KInput: 0.003,
    costPer1KOutput: 0.012
  },

  // ========================================
  // Google Gemini Models
  // ========================================
  {
    provider: 'google',
    model: 'gemini-1.5-pro',
    maxTokens: 8192,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    costPer1KInput: 0.00125,
    costPer1KOutput: 0.005
  },
  {
    provider: 'google',
    model: 'gemini-1.5-flash',
    maxTokens: 8192,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    costPer1KInput: 0.000075,
    costPer1KOutput: 0.0003
  },
  {
    provider: 'google',
    model: 'gemini-1.0-pro',
    maxTokens: 2048,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    costPer1KInput: 0.00025,
    costPer1KOutput: 0.0005
  },
  {
    provider: 'google',
    model: 'gemini-2.0-flash-exp',
    maxTokens: 8192,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    costPer1KInput: 0,
    costPer1KOutput: 0
  },

  // ========================================
  // Ollama Local Models
  // ========================================
  {
    provider: 'ollama',
    model: 'llama3',
    maxTokens: 4096,
    supportsTools: false,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: false,
    costPer1KInput: 0,
    costPer1KOutput: 0
  },
  {
    provider: 'ollama',
    model: 'llama3.1',
    maxTokens: 4096,
    supportsTools: false,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: false,
    costPer1KInput: 0,
    costPer1KOutput: 0
  },
  {
    provider: 'ollama',
    model: 'mistral',
    maxTokens: 4096,
    supportsTools: false,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: false,
    costPer1KInput: 0,
    costPer1KOutput: 0
  },
  {
    provider: 'ollama',
    model: 'codellama',
    maxTokens: 4096,
    supportsTools: false,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: false,
    costPer1KInput: 0,
    costPer1KOutput: 0
  },
  {
    provider: 'ollama',
    model: 'mixtral',
    maxTokens: 4096,
    supportsTools: false,
    supportsVision: false,
    supportsStreaming: true,
    supportsJsonMode: false,
    costPer1KInput: 0,
    costPer1KOutput: 0
  },
  {
    provider: 'ollama',
    model: 'llava',
    maxTokens: 4096,
    supportsTools: false,
    supportsVision: true,
    supportsStreaming: true,
    supportsJsonMode: false,
    costPer1KInput: 0,
    costPer1KOutput: 0
  }
];

/**
 * Model name patterns for auto-detection
 */
const MODEL_PATTERNS: Array<{
  pattern: RegExp;
  provider: ProviderName | string;
}> = [
  // Anthropic Claude patterns
  { pattern: /^claude-3/i, provider: 'anthropic' },
  { pattern: /^claude-3\.5/i, provider: 'anthropic' },
  { pattern: /^claude-/i, provider: 'anthropic' },

  // OpenAI GPT patterns
  { pattern: /^gpt-4o/i, provider: 'openai' },
  { pattern: /^gpt-4-turbo/i, provider: 'openai' },
  { pattern: /^gpt-4-/i, provider: 'openai' },
  { pattern: /^gpt-4$/i, provider: 'openai' },
  { pattern: /^gpt-3\.5/i, provider: 'openai' },
  { pattern: /^o1-preview/i, provider: 'openai' },
  { pattern: /^o1-mini/i, provider: 'openai' },
  { pattern: /^o1-/i, provider: 'openai' },

  // Google Gemini patterns
  { pattern: /^gemini-1\.5/i, provider: 'google' },
  { pattern: /^gemini-2/i, provider: 'google' },
  { pattern: /^gemini-1\.0/i, provider: 'google' },
  { pattern: /^gemini-/i, provider: 'google' },

  // Ollama patterns (local models)
  { pattern: /^llama3/i, provider: 'ollama' },
  { pattern: /^llava/i, provider: 'ollama' },
  { pattern: /^mistral/i, provider: 'ollama' },
  { pattern: /^mixtral/i, provider: 'ollama' },
  { pattern: /^codellama/i, provider: 'ollama' },
  { pattern: /^phi/i, provider: 'ollama' },
  { pattern: /^deepseek/i, provider: 'ollama' }
];

/**
 * CapabilitiesDatabase - Centralized database for model capabilities
 */
export class CapabilitiesDatabase {
  private capabilities: Map<string, ModelCapabilities> = new Map();

  constructor() {
    // Initialize with known capabilities
    for (const cap of KNOWN_CAPABILITIES) {
      const key = this.makeKey(cap.provider, cap.model);
      this.capabilities.set(key, { ...cap });
    }
  }

  /**
   * Creates a unique key for provider/model combination
   */
  private makeKey(provider: string, model: string): string {
    return `${provider}:${model}`;
  }

  /**
   * Get capabilities for a specific model
   */
  getCapabilities(provider: ProviderName | string, model: string): ModelCapabilities | undefined {
    const key = this.makeKey(provider, model);
    return this.capabilities.get(key);
  }

  /**
   * Register new model capabilities (supports custom models)
   */
  registerCapabilities(capabilities: ModelCapabilities): void {
    const key = this.makeKey(capabilities.provider, capabilities.model);
    this.capabilities.set(key, { ...capabilities });
  }

  /**
   * Remove capabilities for a model
   */
  unregisterCapabilities(provider: string, model: string): boolean {
    const key = this.makeKey(provider, model);
    return this.capabilities.delete(key);
  }

  /**
   * List all models, optionally filtered by provider
   */
  listModels(provider?: ProviderName | string): ModelCapabilities[] {
    const all = Array.from(this.capabilities.values());
    if (provider) {
      return all.filter(cap => cap.provider === provider);
    }
    return all;
  }

  /**
   * Get all known providers
   */
  getProviders(): string[] {
    const providers = new Set<string>();
    for (const cap of this.capabilities.values()) {
      providers.add(cap.provider);
    }
    return Array.from(providers);
  }

  /**
   * Find model by partial match on model ID
   */
  findByModelId(modelId: string): ModelCapabilities | undefined {
    // Try exact match first
    for (const cap of this.capabilities.values()) {
      if (cap.model === modelId) {
        return cap;
      }
    }

    // Try partial match
    const lowerModelId = modelId.toLowerCase();
    for (const cap of this.capabilities.values()) {
      if (cap.model.toLowerCase().includes(lowerModelId) ||
          lowerModelId.includes(cap.model.toLowerCase())) {
        return cap;
      }
    }

    return undefined;
  }
}

// Singleton instance
let databaseInstance: CapabilitiesDatabase | null = null;

/**
 * Get the singleton capabilities database instance
 */
export function getCapabilitiesDatabase(): CapabilitiesDatabase {
  if (!databaseInstance) {
    databaseInstance = new CapabilitiesDatabase();
  }
  return databaseInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetCapabilitiesDatabase(): void {
  databaseInstance = null;
}

/**
 * Detect provider from model name pattern
 */
function detectProviderFromModelName(modelId: string): ProviderName | string | undefined {
  for (const { pattern, provider } of MODEL_PATTERNS) {
    if (pattern.test(modelId)) {
      return provider;
    }
  }
  return undefined;
}

/**
 * Auto-detect capabilities for a model
 * 
 * @param modelId - The model ID to detect capabilities for
 * @param options - Optional detection options
 * @returns Model capabilities if found, undefined otherwise
 */
export function detectCapabilities(
  modelId: string,
  options: DetectOptions = {}
): ModelCapabilities | undefined {
  const db = getCapabilitiesDatabase();

  // If provider hint is given, try exact lookup first
  if (options.providerHint) {
    const caps = db.getCapabilities(options.providerHint, modelId);
    if (caps) return caps;
  }

  // Try to find by model ID directly
  const found = db.findByModelId(modelId);
  if (found) return found;

  // Try to detect provider from model name
  const detectedProvider = detectProviderFromModelName(modelId);
  if (detectedProvider) {
    const caps = db.getCapabilities(detectedProvider, modelId);
    if (caps) return caps;
  }

  return undefined;
}

/**
 * Get a warning message if the model doesn't support required capabilities
 * 
 * @param capabilities - The model capabilities to check
 * @param requirements - The required capabilities for the task
 * @returns Warning message if capabilities are missing, null if all requirements are met
 */
export function getCapabilitiesWarning(
  capabilities: ModelCapabilities,
  requirements: CapabilityRequirements
): string | null {
  const missing: string[] = [];

  if (requirements.requiresTools && !capabilities.supportsTools) {
    missing.push('tool calling');
  }

  if (requirements.requiresVision && !capabilities.supportsVision) {
    missing.push('vision/image processing');
  }

  if (requirements.requiresStreaming && !capabilities.supportsStreaming) {
    missing.push('streaming responses');
  }

  if (requirements.requiresJsonMode && !capabilities.supportsJsonMode) {
    missing.push('JSON mode');
  }

  if (requirements.maxTokensRequired && capabilities.maxTokens < requirements.maxTokensRequired) {
    missing.push(`sufficient token limit (needs ${requirements.maxTokensRequired}, has ${capabilities.maxTokens})`);
  }

  if (missing.length === 0) {
    return null;
  }

  const missingStr = missing.join(', ');
  return `Model "${capabilities.model}" (${capabilities.provider}) does not support: ${missingStr}. ` +
         `Consider using a model with these capabilities.`;
}

/**
 * Convert ModelCapabilities to legacy Model format
 */
export function toModelFormat(capabilities: ModelCapabilities): Model {
  return {
    id: capabilities.model,
    name: capabilities.model, // Use model ID as name
    provider: capabilities.provider as ProviderName,
    maxTokens: capabilities.maxTokens,
    supportsTools: capabilities.supportsTools,
    supportsVision: capabilities.supportsVision,
    costPer1KInput: capabilities.costPer1KInput,
    costPer1KOutput: capabilities.costPer1KOutput
  };
}

/**
 * Check if a model meets all requirements
 */
export function meetsRequirements(
  capabilities: ModelCapabilities,
  requirements: CapabilityRequirements
): boolean {
  return getCapabilitiesWarning(capabilities, requirements) === null;
}
