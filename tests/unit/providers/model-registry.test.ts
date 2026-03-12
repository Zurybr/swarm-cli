/**
 * Model Registry Unit Tests
 * Tests for ModelRegistry to track available models
 */

import { ModelRegistry, RegistryModel } from '@/providers/model-registry';

describe('ModelRegistry', () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    registry = new ModelRegistry();
  });

  describe('register', () => {
    it('should register a model with capabilities', () => {
      const model: RegistryModel = {
        id: 'claude-3-sonnet',
        provider: 'anthropic',
        capabilities: {
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
        available: true
      };

      registry.register(model);

      const retrieved = registry.get('claude-3-sonnet');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('claude-3-sonnet');
      expect(retrieved?.provider).toBe('anthropic');
      expect(retrieved?.available).toBe(true);
    });

    it('should update existing model registration', () => {
      const model: RegistryModel = {
        id: 'gpt-4',
        provider: 'openai',
        capabilities: {
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
        available: true
      };

      registry.register(model);
      
      // Update with new availability
      registry.register({
        ...model,
        available: false
      });

      const retrieved = registry.get('gpt-4');
      expect(retrieved?.available).toBe(false);
    });
  });

  describe('get', () => {
    it('should return undefined for unregistered model', () => {
      const model = registry.get('non-existent');
      expect(model).toBeUndefined();
    });

    it('should get model by ID', () => {
      registry.register({
        id: 'gemini-pro',
        provider: 'google',
        capabilities: {
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
        available: true
      });

      const model = registry.get('gemini-pro');
      expect(model?.id).toBe('gemini-pro');
    });
  });

  describe('unregister', () => {
    it('should remove model from registry', () => {
      registry.register({
        id: 'temp-model',
        provider: 'test',
        capabilities: {
          provider: 'test',
          model: 'temp-model',
          maxTokens: 1024,
          supportsTools: false,
          supportsVision: false,
          supportsStreaming: false,
          supportsJsonMode: false,
          costPer1KInput: 0,
          costPer1KOutput: 0
        },
        available: true
      });

      registry.unregister('temp-model');

      expect(registry.get('temp-model')).toBeUndefined();
    });

    it('should not throw when unregistering non-existent model', () => {
      expect(() => registry.unregister('non-existent')).not.toThrow();
    });
  });

  describe('list', () => {
    it('should list all registered models', () => {
      registry.register({
        id: 'model-1',
        provider: 'provider-a',
        capabilities: {
          provider: 'provider-a',
          model: 'model-1',
          maxTokens: 1024,
          supportsTools: false,
          supportsVision: false,
          supportsStreaming: true,
          supportsJsonMode: false,
          costPer1KInput: 0,
          costPer1KOutput: 0
        },
        available: true
      });

      registry.register({
        id: 'model-2',
        provider: 'provider-b',
        capabilities: {
          provider: 'provider-b',
          model: 'model-2',
          maxTokens: 2048,
          supportsTools: true,
          supportsVision: true,
          supportsStreaming: true,
          supportsJsonMode: true,
          costPer1KInput: 0.01,
          costPer1KOutput: 0.02
        },
        available: true
      });

      const models = registry.list();
      expect(models).toHaveLength(2);
      expect(models.map(m => m.id)).toContain('model-1');
      expect(models.map(m => m.id)).toContain('model-2');
    });

    it('should filter by provider', () => {
      registry.register({
        id: 'anthropic-model',
        provider: 'anthropic',
        capabilities: {
          provider: 'anthropic',
          model: 'anthropic-model',
          maxTokens: 1024,
          supportsTools: true,
          supportsVision: true,
          supportsStreaming: true,
          supportsJsonMode: true,
          costPer1KInput: 0.01,
          costPer1KOutput: 0.02
        },
        available: true
      });

      registry.register({
        id: 'openai-model',
        provider: 'openai',
        capabilities: {
          provider: 'openai',
          model: 'openai-model',
          maxTokens: 1024,
          supportsTools: true,
          supportsVision: true,
          supportsStreaming: true,
          supportsJsonMode: true,
          costPer1KInput: 0.01,
          costPer1KOutput: 0.02
        },
        available: true
      });

      const anthropicModels = registry.list({ provider: 'anthropic' });
      expect(anthropicModels).toHaveLength(1);
      expect(anthropicModels[0].provider).toBe('anthropic');
    });

    it('should filter by availability', () => {
      registry.register({
        id: 'available-model',
        provider: 'test',
        capabilities: {
          provider: 'test',
          model: 'available-model',
          maxTokens: 1024,
          supportsTools: false,
          supportsVision: false,
          supportsStreaming: true,
          supportsJsonMode: false,
          costPer1KInput: 0,
          costPer1KOutput: 0
        },
        available: true
      });

      registry.register({
        id: 'unavailable-model',
        provider: 'test',
        capabilities: {
          provider: 'test',
          model: 'unavailable-model',
          maxTokens: 1024,
          supportsTools: false,
          supportsVision: false,
          supportsStreaming: true,
          supportsJsonMode: false,
          costPer1KInput: 0,
          costPer1KOutput: 0
        },
        available: false
      });

      const availableModels = registry.list({ available: true });
      expect(availableModels).toHaveLength(1);
      expect(availableModels[0].id).toBe('available-model');
    });

    it('should filter by capability', () => {
      registry.register({
        id: 'vision-model',
        provider: 'test',
        capabilities: {
          provider: 'test',
          model: 'vision-model',
          maxTokens: 1024,
          supportsTools: false,
          supportsVision: true,
          supportsStreaming: true,
          supportsJsonMode: false,
          costPer1KInput: 0,
          costPer1KOutput: 0
        },
        available: true
      });

      registry.register({
        id: 'text-only-model',
        provider: 'test',
        capabilities: {
          provider: 'test',
          model: 'text-only-model',
          maxTokens: 1024,
          supportsTools: false,
          supportsVision: false,
          supportsStreaming: true,
          supportsJsonMode: false,
          costPer1KInput: 0,
          costPer1KOutput: 0
        },
        available: true
      });

      const visionModels = registry.list({ supportsVision: true });
      expect(visionModels).toHaveLength(1);
      expect(visionModels[0].id).toBe('vision-model');
    });
  });

  describe('setAvailability', () => {
    it('should update model availability', () => {
      registry.register({
        id: 'test-model',
        provider: 'test',
        capabilities: {
          provider: 'test',
          model: 'test-model',
          maxTokens: 1024,
          supportsTools: false,
          supportsVision: false,
          supportsStreaming: true,
          supportsJsonMode: false,
          costPer1KInput: 0,
          costPer1KOutput: 0
        },
        available: true
      });

      registry.setAvailability('test-model', false);

      const model = registry.get('test-model');
      expect(model?.available).toBe(false);
    });

    it('should throw for non-existent model', () => {
      expect(() => registry.setAvailability('non-existent', true)).toThrow();
    });
  });

  describe('getAvailableModels', () => {
    it('should return only available models', () => {
      registry.register({
        id: 'available-1',
        provider: 'test',
        capabilities: {
          provider: 'test',
          model: 'available-1',
          maxTokens: 1024,
          supportsTools: false,
          supportsVision: false,
          supportsStreaming: true,
          supportsJsonMode: false,
          costPer1KInput: 0,
          costPer1KOutput: 0
        },
        available: true
      });

      registry.register({
        id: 'unavailable-1',
        provider: 'test',
        capabilities: {
          provider: 'test',
          model: 'unavailable-1',
          maxTokens: 1024,
          supportsTools: false,
          supportsVision: false,
          supportsStreaming: true,
          supportsJsonMode: false,
          costPer1KInput: 0,
          costPer1KOutput: 0
        },
        available: false
      });

      const available = registry.getAvailableModels();
      expect(available).toHaveLength(1);
      expect(available[0].id).toBe('available-1');
    });
  });

  describe('findBestModel', () => {
    beforeEach(() => {
      registry.register({
        id: 'cheap-model',
        provider: 'test',
        capabilities: {
          provider: 'test',
          model: 'cheap-model',
          maxTokens: 2048,
          supportsTools: true,
          supportsVision: false,
          supportsStreaming: true,
          supportsJsonMode: true,
          costPer1KInput: 0.001,
          costPer1KOutput: 0.002
        },
        available: true
      });

      registry.register({
        id: 'expensive-model',
        provider: 'test',
        capabilities: {
          provider: 'test',
          model: 'expensive-model',
          maxTokens: 8192,
          supportsTools: true,
          supportsVision: true,
          supportsStreaming: true,
          supportsJsonMode: true,
          costPer1KInput: 0.01,
          costPer1KOutput: 0.02
        },
        available: true
      });
    });

    it('should find cheapest model meeting requirements', () => {
      const model = registry.findBestModel({
        requiresTools: true,
        optimizeFor: 'cost'
      });

      expect(model?.id).toBe('cheap-model');
    });

    it('should find model with most capabilities when optimizing for performance', () => {
      const model = registry.findBestModel({
        requiresTools: true,
        optimizeFor: 'performance'
      });

      expect(model?.id).toBe('expensive-model');
    });

    it('should return undefined when no model meets requirements', () => {
      const model = registry.findBestModel({
        requiresVision: true,
        requiresTools: true,
        requiresJsonMode: true,
        maxTokensRequired: 100000 // No model has this
      });

      expect(model).toBeUndefined();
    });

    it('should filter by provider', () => {
      registry.register({
        id: 'other-provider-model',
        provider: 'other',
        capabilities: {
          provider: 'other',
          model: 'other-provider-model',
          maxTokens: 4096,
          supportsTools: true,
          supportsVision: true,
          supportsStreaming: true,
          supportsJsonMode: true,
          costPer1KInput: 0.0001, // Cheapest
          costPer1KOutput: 0.0001
        },
        available: true
      });

      const model = registry.findBestModel({
        provider: 'test',
        optimizeFor: 'cost'
      });

      // Should not return other-provider-model
      expect(model?.provider).toBe('test');
    });
  });

  describe('importFromCapabilitiesDatabase', () => {
    it('should import all models from capabilities database', () => {
      registry.importFromCapabilitiesDatabase();

      const models = registry.list();
      expect(models.length).toBeGreaterThan(0);

      // Should have models from multiple providers
      const providers = new Set(models.map(m => m.provider));
      expect(providers.has('anthropic')).toBe(true);
      expect(providers.has('openai')).toBe(true);
    });

    it('should mark all imported models as available', () => {
      registry.importFromCapabilitiesDatabase();

      const models = registry.list();
      models.forEach(model => {
        expect(model.available).toBe(true);
      });
    });
  });

  describe('export', () => {
    it('should export registry as JSON', () => {
      registry.register({
        id: 'export-test',
        provider: 'test',
        capabilities: {
          provider: 'test',
          model: 'export-test',
          maxTokens: 1024,
          supportsTools: false,
          supportsVision: false,
          supportsStreaming: true,
          supportsJsonMode: false,
          costPer1KInput: 0,
          costPer1KOutput: 0
        },
        available: true
      });

      const exported = registry.export();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].id).toBe('export-test');
    });
  });
});
