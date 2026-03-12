/**
 * Config Loader - Issue #22.4
 * Parse provider config from ~/.swarm/config.yaml
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { ProviderName } from '../types';
import { ApiKeyManager, getApiKeyManager } from './api-key-manager';

/**
 * Provider configuration
 */
export interface ProviderConfig {
  api_key?: string;
  base_url?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  [key: string]: any;
}

/**
 * Default configuration
 */
export interface DefaultsConfig {
  provider: ProviderName | string;
  model: string;
}

/**
 * Full swarm configuration
 */
export interface SwarmConfig {
  providers: Record<string, ProviderConfig>;
  defaults: DefaultsConfig;
}

/**
 * Validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Config Loader
 * 
 * Loads and parses provider configuration from ~/.swarm/config.yaml
 * Supports environment variable interpolation in values
 */
export class ConfigLoader {
  private configPath: string;
  private config: SwarmConfig | null = null;
  private keyManager: ApiKeyManager;

  /**
   * Create a new ConfigLoader
   * @param configPath Optional custom config path
   */
  constructor(configPath?: string) {
    this.configPath = configPath || path.join(os.homedir(), '.swarm', 'config.yaml');
    this.keyManager = getApiKeyManager();
  }

  /**
   * Load configuration from file
   */
  load(): SwarmConfig {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.config = this.getDefaultConfig();
        return this.config;
      }

      const content = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = yaml.parse(content);

      if (!parsed || typeof parsed !== 'object') {
        this.config = this.getDefaultConfig();
        return this.config;
      }

      // Interpolate env vars in all string values
      this.config = this.interpolateConfig(parsed as SwarmConfig);
      
      return this.config;
    } catch (error) {
      // On any error, return default config
      this.config = this.getDefaultConfig();
      return this.config;
    }
  }

  /**
   * Get configuration for a specific provider
   */
  getProviderConfig(provider: string): ProviderConfig | undefined {
    if (!this.config) {
      this.load();
    }
    return this.config?.providers[provider];
  }

  /**
   * Get API key for a provider
   */
  getApiKey(provider: string): string | undefined {
    const providerConfig = this.getProviderConfig(provider);
    return providerConfig?.api_key;
  }

  /**
   * Get base URL for a provider (useful for local/Ollama)
   */
  getBaseUrl(provider: string): string | undefined {
    const providerConfig = this.getProviderConfig(provider);
    return providerConfig?.base_url;
  }

  /**
   * Get the default provider
   */
  getDefaultProvider(): string {
    if (!this.config) {
      this.load();
    }
    return this.config?.defaults?.provider || 'anthropic';
  }

  /**
   * Get the default model
   */
  getDefaultModel(): string {
    if (!this.config) {
      this.load();
    }
    return this.config?.defaults?.model || 'claude-3-sonnet-20240229';
  }

  /**
   * Save configuration to file
   */
  save(config: SwarmConfig): void {
    const dir = path.dirname(this.configPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = yaml.stringify(config, {
      defaultStringType: 'QUOTE_DOUBLE',
      defaultKeyType: 'PLAIN'
    });

    fs.writeFileSync(this.configPath, content, 'utf-8');
    this.config = config;
  }

  /**
   * Set configuration for a specific provider
   */
  setProviderConfig(provider: string, config: ProviderConfig): void {
    if (!this.config) {
      this.load();
    }

    this.config!.providers[provider] = config;
    this.save(this.config!);
  }

  /**
   * List all configured providers
   */
  listProviders(): string[] {
    if (!this.config) {
      this.load();
    }
    return Object.keys(this.config?.providers || {});
  }

  /**
   * Validate the current configuration
   */
  validate(): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.config) {
      this.load();
    }

    // Validate API key formats
    for (const [provider, config] of Object.entries(this.config?.providers || {})) {
      if (config.api_key) {
        const result = this.validateKeyFormat(provider, config.api_key);
        if (!result.valid && result.error) {
          errors.push(`${provider}: ${result.error}`);
        }
      }
    }

    // Check if default provider is configured
    const defaultProvider = this.config?.defaults?.provider;
    if (defaultProvider && !this.config?.providers[defaultProvider]) {
      warnings.push(`Default provider '${defaultProvider}' is not configured`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get the config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Check if config file exists
   */
  exists(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): SwarmConfig {
    return {
      providers: {},
      defaults: {
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229'
      }
    };
  }

  /**
   * Interpolate environment variables in config values
   */
  private interpolateConfig(config: SwarmConfig): SwarmConfig {
    const interpolated = JSON.parse(JSON.stringify(config));

    // Interpolate providers
    for (const provider of Object.keys(interpolated.providers || {})) {
      const providerConfig = interpolated.providers[provider];
      for (const key of Object.keys(providerConfig)) {
        if (typeof providerConfig[key] === 'string') {
          providerConfig[key] = this.keyManager.interpolateEnvVars(providerConfig[key]);
        }
      }
    }

    // Interpolate defaults
    if (interpolated.defaults) {
      for (const key of Object.keys(interpolated.defaults)) {
        if (typeof interpolated.defaults[key] === 'string') {
          interpolated.defaults[key] = this.keyManager.interpolateEnvVars(interpolated.defaults[key]);
        }
      }
    }

    return interpolated;
  }

  /**
   * Validate key format for a provider
   */
  private validateKeyFormat(provider: string, key: string): { valid: boolean; error?: string } {
    const patterns: Record<string, RegExp> = {
      anthropic: /^sk-ant-(api03-)?[a-zA-Z0-9_-]{20,}$/,
      openai: /^sk-(proj-)?[a-zA-Z0-9_-]{20,}$/,
      google: /^AIzaSy[a-zA-Z0-9_-]{33}$/
    };

    const pattern = patterns[provider];
    
    if (!pattern) {
      // Unknown provider, accept any key
      return { valid: true };
    }

    if (pattern.test(key)) {
      return { valid: true };
    }

    return {
      valid: false,
      error: `Invalid API key format for ${provider}. Expected format matching: ${pattern.source}`
    };
  }

  /**
   * Reload configuration from file
   */
  reload(): SwarmConfig {
    this.config = null;
    return this.load();
  }
}

// Singleton instance
let defaultLoader: ConfigLoader | null = null;

/**
 * Get the default config loader instance
 */
export function getConfigLoader(): ConfigLoader {
  if (!defaultLoader) {
    defaultLoader = new ConfigLoader();
  }
  return defaultLoader;
}

/**
 * Reset the default loader (for testing)
 */
export function resetConfigLoader(): void {
  defaultLoader = null;
}
