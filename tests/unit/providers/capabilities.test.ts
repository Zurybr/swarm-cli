/**
 * Model Capabilities Unit Tests
 * Tests for CapabilitiesDatabase and detectCapabilities function
 */

import {
  CapabilitiesDatabase,
  detectCapabilities,
  getCapabilitiesWarning,
  ModelCapabilities
} from '@/providers/capabilities';

describe('CapabilitiesDatabase', () => {
  let db: CapabilitiesDatabase;

  beforeEach(() => {
    db = new CapabilitiesDatabase();
  });

  describe('getCapabilities', () => {
    it('should return capabilities for known Anthropic models', () => {
      const capabilities = db.getCapabilities('anthropic', 'claude-3-sonnet-20240229');

      expect(capabilities).toBeDefined();
      expect(capabilities?.provider).toBe('anthropic');
      expect(capabilities?.model).toBe('claude-3-sonnet-20240229');
      expect(capabilities?.maxTokens).toBe(4096);
      expect(capabilities?.supportsTools).toBe(true);
      expect(capabilities?.supportsVision).toBe(true);
      expect(capabilities?.supportsStreaming).toBe(true);
      expect(capabilities?.supportsJsonMode).toBe(true);
      expect(capabilities?.costPer1KInput).toBe(0.003);
      expect(capabilities?.costPer1KOutput).toBe(0.015);
    });

    it('should return capabilities for known OpenAI models', () => {
      const capabilities = db.getCapabilities('openai', 'gpt-4o');

      expect(capabilities).toBeDefined();
      expect(capabilities?.provider).toBe('openai');
      expect(capabilities?.supportsTools).toBe(true);
      expect(capabilities?.supportsVision).toBe(true);
      expect(capabilities?.supportsJsonMode).toBe(true);
      expect(capabilities?.costPer1KInput).toBe(0.005);
    });

    it('should return capabilities for known Google models', () => {
      const capabilities = db.getCapabilities('google', 'gemini-1.5-pro');

      expect(capabilities).toBeDefined();
      expect(capabilities?.provider).toBe('google');
      expect(capabilities?.supportsTools).toBe(true);
      expect(capabilities?.supportsVision).toBe(true);
      expect(capabilities?.maxTokens).toBe(8192);
    });

    it('should return capabilities for Ollama models', () => {
      const capabilities = db.getCapabilities('ollama', 'llama3');

      expect(capabilities).toBeDefined();
      expect(capabilities?.provider).toBe('ollama');
      expect(capabilities?.supportsTools).toBe(false);
      expect(capabilities?.supportsVision).toBe(false);
      expect(capabilities?.costPer1KInput).toBe(0);
      expect(capabilities?.costPer1KOutput).toBe(0);
    });

    it('should return undefined for unknown model', () => {
      const capabilities = db.getCapabilities('anthropic', 'unknown-model');
      expect(capabilities).toBeUndefined();
    });
  });

  describe('registerCapabilities', () => {
    it('should register custom model capabilities', () => {
      const customCapabilities: ModelCapabilities = {
        provider: 'custom',
        model: 'custom-model-v1',
        maxTokens: 8192,
        supportsTools: true,
        supportsVision: false,
        supportsStreaming: true,
        supportsJsonMode: false,
        costPer1KInput: 0.001,
        costPer1KOutput: 0.002
      };

      db.registerCapabilities(customCapabilities);

      const retrieved = db.getCapabilities('custom', 'custom-model-v1');
      expect(retrieved).toEqual(customCapabilities);
    });

    it('should update existing capabilities', () => {
      // First get original
      const original = db.getCapabilities('anthropic', 'claude-3-sonnet-20240229');
      expect(original?.maxTokens).toBe(4096);

      // Update with new value
      db.registerCapabilities({
        ...original!,
        maxTokens: 8192
      });

      const updated = db.getCapabilities('anthropic', 'claude-3-sonnet-20240229');
      expect(updated?.maxTokens).toBe(8192);
    });
  });

  describe('listModels', () => {
    it('should list all models for a provider', () => {
      const anthropicModels = db.listModels('anthropic');

      expect(anthropicModels.length).toBeGreaterThan(0);
      expect(anthropicModels.map(m => m.model)).toContain('claude-3-sonnet-20240229');
      expect(anthropicModels.map(m => m.model)).toContain('claude-3-opus-20240229');
    });

    it('should return empty array for unknown provider', () => {
      const models = db.listModels('unknown-provider');
      expect(models).toEqual([]);
    });

    it('should list all models across all providers', () => {
      const allModels = db.listModels();

      expect(allModels.length).toBeGreaterThan(0);
      // Should include models from multiple providers
      const providers = new Set(allModels.map(m => m.provider));
      expect(providers.size).toBeGreaterThan(1);
    });
  });

  describe('getProviders', () => {
    it('should return all known providers', () => {
      const providers = db.getProviders();

      expect(providers).toContain('anthropic');
      expect(providers).toContain('openai');
      expect(providers).toContain('google');
      expect(providers).toContain('ollama');
    });
  });
});

describe('detectCapabilities', () => {
  it('should auto-detect capabilities for known model ID', () => {
    const capabilities = detectCapabilities('claude-3-sonnet-20240229');

    expect(capabilities).toBeDefined();
    expect(capabilities?.provider).toBe('anthropic');
    expect(capabilities?.supportsTools).toBe(true);
  });

  it('should auto-detect capabilities with provider hint', () => {
    const capabilities = detectCapabilities('gpt-4o', { providerHint: 'openai' });

    expect(capabilities).toBeDefined();
    expect(capabilities?.provider).toBe('openai');
  });

  it('should return undefined for completely unknown model', () => {
    const capabilities = detectCapabilities('totally-unknown-model-xyz');
    expect(capabilities).toBeUndefined();
  });

  it('should detect provider from model name pattern', () => {
    // Claude models
    expect(detectCapabilities('claude-3-opus-20240229')?.provider).toBe('anthropic');
    expect(detectCapabilities('claude-3-haiku-20240307')?.provider).toBe('anthropic');

    // GPT models
    expect(detectCapabilities('gpt-4-turbo')?.provider).toBe('openai');
    expect(detectCapabilities('gpt-3.5-turbo')?.provider).toBe('openai');

    // Gemini models
    expect(detectCapabilities('gemini-1.5-pro')?.provider).toBe('google');
    expect(detectCapabilities('gemini-2.0-flash-exp')?.provider).toBe('google');
  });
});

describe('getCapabilitiesWarning', () => {
  it('should return null when all capabilities are supported', () => {
    const capabilities: ModelCapabilities = {
      provider: 'anthropic',
      model: 'claude-3-sonnet-20240229',
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: true,
      supportsStreaming: true,
      supportsJsonMode: true,
      costPer1KInput: 0.003,
      costPer1KOutput: 0.015
    };

    const warning = getCapabilitiesWarning(capabilities, {
      requiresTools: true,
      requiresVision: true,
      requiresStreaming: true,
      requiresJsonMode: true
    });

    expect(warning).toBeNull();
  });

  it('should return warning when tools are required but not supported', () => {
    const capabilities: ModelCapabilities = {
      provider: 'ollama',
      model: 'llama3',
      maxTokens: 4096,
      supportsTools: false,
      supportsVision: false,
      supportsStreaming: true,
      supportsJsonMode: false,
      costPer1KInput: 0,
      costPer1KOutput: 0
    };

    const warning = getCapabilitiesWarning(capabilities, {
      requiresTools: true
    });

    expect(warning).not.toBeNull();
    expect(warning).toContain('tool calling');
    expect(warning).toContain('llama3');
  });

  it('should return warning when vision is required but not supported', () => {
    const capabilities: ModelCapabilities = {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: false,
      supportsStreaming: true,
      supportsJsonMode: true,
      costPer1KInput: 0.0005,
      costPer1KOutput: 0.0015
    };

    const warning = getCapabilitiesWarning(capabilities, {
      requiresVision: true
    });

    expect(warning).not.toBeNull();
    expect(warning).toContain('vision');
  });

  it('should return warning when jsonMode is required but not supported', () => {
    const capabilities: ModelCapabilities = {
      provider: 'ollama',
      model: 'mistral',
      maxTokens: 4096,
      supportsTools: false,
      supportsVision: false,
      supportsStreaming: true,
      supportsJsonMode: false,
      costPer1KInput: 0,
      costPer1KOutput: 0
    };

    const warning = getCapabilitiesWarning(capabilities, {
      requiresJsonMode: true
    });

    expect(warning).not.toBeNull();
    expect(warning).toContain('JSON');
  });

  it('should list multiple missing capabilities', () => {
    const capabilities: ModelCapabilities = {
      provider: 'ollama',
      model: 'llama3',
      maxTokens: 4096,
      supportsTools: false,
      supportsVision: false,
      supportsStreaming: true,
      supportsJsonMode: false,
      costPer1KInput: 0,
      costPer1KOutput: 0
    };

    const warning = getCapabilitiesWarning(capabilities, {
      requiresTools: true,
      requiresVision: true,
      requiresJsonMode: true
    });

    expect(warning).toContain('tool calling');
    expect(warning).toContain('vision');
    expect(warning).toContain('JSON');
  });
});
