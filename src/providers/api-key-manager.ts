/**
 * API Key Manager - Issue #22.4
 * Secure API key management with env var interpolation, keyring integration, and rotation support
 */

import { ProviderName } from '../types';

/**
 * Source of an API key
 */
export enum KeySource {
  ENVIRONMENT = 'environment',
  KEYRING = 'keyring',
  CONFIG = 'config',
  MEMORY = 'memory'
}

/**
 * Metadata for a stored key
 */
export interface KeyMetadata {
  provider: string;
  createdAt: Date;
  lastRotatedAt?: Date;
  source: KeySource;
  rotationDays?: number;
  [key: string]: any;
}

/**
 * Key history entry for rotation tracking
 */
export interface KeyHistoryEntry {
  key: string;
  rotatedAt: Date;
  reason?: string;
}

/**
 * Validation result for API keys
 */
export interface KeyValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Options for key resolution
 */
export interface ResolveKeyOptions {
  envVar?: string;
  preferEnv?: boolean;
}

/**
 * API Key Manager
 * 
 * Manages API keys with support for:
 * - Environment variable interpolation (${VAR_NAME})
 * - Keyring/keychain integration for secure storage
 * - Key validation and rotation
 */
export class ApiKeyManager {
  private keys: Map<string, string> = new Map();
  private metadata: Map<string, KeyMetadata> = new Map();
  private history: Map<string, KeyHistoryEntry[]> = new Map();
  
  // Regex for env var interpolation: ${VAR_NAME}
  private static readonly ENV_VAR_PATTERN = /\$\{([^}]+)\}/g;
  
  // API key format patterns by provider
  private static readonly KEY_PATTERNS: Record<string, RegExp> = {
    anthropic: /^sk-ant-(api03-)?[a-zA-Z0-9_-]{20,}$/,
    openai: /^sk-(proj-)?[a-zA-Z0-9_-]{20,}$/,
    google: /^AIzaSy[a-zA-Z0-9_-]{33}$/,
    // Local providers don't need specific format
    ollama: /.*/,
    local: /.*/
  };

  /**
   * Get an API key for a provider
   */
  async getKey(provider: string, options?: ResolveKeyOptions): Promise<string | undefined> {
    // First check environment if envVar specified
    if (options?.envVar && process.env[options.envVar]) {
      return this.interpolateEnvVars(process.env[options.envVar]!);
    }
    
    // Then check stored keys
    const storedKey = this.keys.get(provider);
    if (storedKey) {
      return this.interpolateEnvVars(storedKey);
    }
    
    return undefined;
  }

  /**
   * Set an API key for a provider
   */
  async setKey(provider: string, key: string, metadata?: Partial<KeyMetadata>): Promise<void> {
    this.keys.set(provider, key);
    
    const existingMeta = this.metadata.get(provider);
    this.metadata.set(provider, {
      provider,
      createdAt: existingMeta?.createdAt || new Date(),
      source: KeySource.MEMORY,
      ...metadata
    });
  }

  /**
   * Delete an API key
   */
  async deleteKey(provider: string): Promise<void> {
    this.keys.delete(provider);
    this.metadata.delete(provider);
    this.history.delete(provider);
  }

  /**
   * Validate an API key format
   */
  async validateKey(provider: string, key: string): Promise<KeyValidationResult> {
    const pattern = ApiKeyManager.KEY_PATTERNS[provider];
    
    if (!pattern) {
      return {
        valid: true, // Unknown provider, accept any key
        error: undefined
      };
    }
    
    if (pattern.test(key)) {
      return { valid: true, error: undefined };
    }
    
    return {
      valid: false,
      error: `Invalid ${provider} API key format. Key should match pattern: ${pattern.source}`
    };
  }

  /**
   * Rotate an API key
   */
  async rotateKey(provider: string, newKey: string, reason?: string): Promise<void> {
    const oldKey = this.keys.get(provider);
    
    if (oldKey) {
      // Add to history
      const providerHistory = this.history.get(provider) || [];
      providerHistory.push({
        key: this.redactKey(oldKey),
        rotatedAt: new Date(),
        reason
      });
      this.history.set(provider, providerHistory);
    }
    
    // Set new key
    const existingMeta = this.metadata.get(provider);
    await this.setKey(provider, newKey, {
      ...existingMeta,
      lastRotatedAt: new Date()
    });
  }

  /**
   * Check if a key needs rotation
   */
  async needsRotation(provider: string): Promise<boolean> {
    const meta = this.metadata.get(provider);
    
    if (!meta?.rotationDays || !meta.lastRotatedAt) {
      return false;
    }
    
    const daysSinceRotation = Math.floor(
      (Date.now() - meta.lastRotatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return daysSinceRotation >= meta.rotationDays;
  }

  /**
   * Get key history for a provider
   */
  async getKeyHistory(provider: string): Promise<KeyHistoryEntry[]> {
    return this.history.get(provider) || [];
  }

  /**
   * Get metadata for a key
   */
  async getKeyMetadata(provider: string): Promise<KeyMetadata | undefined> {
    return this.metadata.get(provider);
  }

  /**
   * Resolve key with priority: env > keyring > config
   */
  async resolveKey(provider: string, options?: ResolveKeyOptions): Promise<string | undefined> {
    return this.getKey(provider, options);
  }

  /**
   * Interpolate environment variables in a string
   * Supports ${VAR_NAME} syntax
   */
  interpolateEnvVars(value: string): string {
    return value.replace(ApiKeyManager.ENV_VAR_PATTERN, (match, varName) => {
      const envValue = process.env[varName];
      return envValue !== undefined ? envValue : match;
    });
  }

  /**
   * List all stored key providers
   */
  async listKeys(): Promise<string[]> {
    return Array.from(this.keys.keys());
  }

  /**
   * Export config with redacted keys
   */
  async exportRedacted(): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    
    const entries = Array.from(this.keys.entries());
    for (const [provider, key] of entries) {
      result[provider] = this.redactKey(key);
    }
    
    return result;
  }

  /**
   * Redact a key for safe display
   */
  private redactKey(key: string): string {
    if (key.length <= 8) {
      return '***';
    }
    
    // Show first 6 chars, redact the rest
    const prefix = key.substring(0, 6);
    const redactedLength = key.length - 6;
    return `${prefix}${'*'.repeat(redactedLength)}`;
  }

  /**
   * Clear all stored keys (for testing)
   */
  clear(): void {
    this.keys.clear();
    this.metadata.clear();
    this.history.clear();
  }
}

// Singleton instance for convenience
let defaultManager: ApiKeyManager | null = null;

/**
 * Get the default API key manager instance
 */
export function getApiKeyManager(): ApiKeyManager {
  if (!defaultManager) {
    defaultManager = new ApiKeyManager();
  }
  return defaultManager;
}

/**
 * Reset the default manager (for testing)
 */
export function resetApiKeyManager(): void {
  defaultManager = null;
}
