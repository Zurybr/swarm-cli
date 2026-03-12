/**
 * Agent Model Config Unit Tests - Issue #22.3
 * Tests for per-agent model configuration with dynamic switching
 */

import { 
  AgentModelConfig, 
  AgentType,
  AgentModelMapping,
  AgentModelConfigOptions,
  ModelValidationError,
  createAgentModelConfig
} from '@/providers/agent-model-config';
import { ProviderManager } from '@/providers/provider-manager';
import { Provider, Model, CompletionOptions, Completion, Chunk } from '@/types';

// Mock provider for testing
class MockProvider implements Provider {
  name: any;
  models: Model[];
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  maxContextTokens: number;

  constructor(
    name: any, 
    models: Model[], 
    options: { 
      supportsTools?: boolean; 
      supportsVision?: boolean;
    } = {}
  ) {
    this.name = name;
    this.models = models;
    this.supportsTools = options.supportsTools ?? true;
    this.supportsVision = options.supportsVision ?? false;
    this.supportsStreaming = true;
    this.maxContextTokens = 128000;
  }

  async complete(options: CompletionOptions): Promise<Completion> {
    return {
      content: 'Mock response',
      usage: { input: 10, output: 5, total: 15 }
    };
  }

  async *stream(options: CompletionOptions): AsyncIterable<Chunk> {
    yield { content: 'Mock', isComplete: false };
    yield { content: ' response', isComplete: true };
  }

  hasModel(modelId: string): boolean {
    return this.models.some(m => m.id === modelId);
  }
}

// Helper to create test models
function createModel(overrides: Partial<Model>): Model {
  return {
    id: 'test-model',
    name: 'Test Model',
    provider: 'anthropic',
    maxTokens: 4096,
    supportsTools: true,
    supportsVision: false,
    costPer1KInput: 0.01,
    costPer1KOutput: 0.03,
    ...overrides
  };
}

// Helper to create a populated provider manager
function createTestProviderManager(): ProviderManager {
  const providerManager = new ProviderManager();
  
  const anthropicProvider = new MockProvider('anthropic', [
    createModel({ 
      id: 'claude-3-opus', 
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      costPer1KInput: 0.015, 
      costPer1KOutput: 0.075,
      supportsTools: true,
      supportsVision: true
    }),
    createModel({ 
      id: 'claude-3-sonnet', 
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      costPer1KInput: 0.003, 
      costPer1KOutput: 0.015
    }),
    createModel({ 
      id: 'claude-3-haiku', 
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      costPer1KInput: 0.00025, 
      costPer1KOutput: 0.00125
    })
  ], { supportsTools: true, supportsVision: true });

  const openaiProvider = new MockProvider('openai', [
    createModel({ 
      id: 'gpt-4-turbo', 
      name: 'GPT-4 Turbo',
      provider: 'openai',
      costPer1KInput: 0.01, 
      costPer1KOutput: 0.03,
      supportsTools: true,
      supportsVision: true
    }),
    createModel({ 
      id: 'gpt-3.5-turbo', 
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      costPer1KInput: 0.0005, 
      costPer1KOutput: 0.0015
    })
  ], { supportsTools: true, supportsVision: true });

  const googleProvider = new MockProvider('google', [
    createModel({ 
      id: 'gemini-pro', 
      name: 'Gemini Pro',
      provider: 'google',
      costPer1KInput: 0.00025, 
      costPer1KOutput: 0.0005,
      supportsTools: true,
      supportsVision: true
    })
  ], { supportsTools: true, supportsVision: true });

  providerManager.registerProvider(anthropicProvider);
  providerManager.registerProvider(openaiProvider);
  providerManager.registerProvider(googleProvider);

  return providerManager;
}

describe('AgentModelConfig', () => {
  let agentModelConfig: AgentModelConfig;
  let providerManager: ProviderManager;

  beforeEach(() => {
    providerManager = createTestProviderManager();
    agentModelConfig = new AgentModelConfig(providerManager);
  });

  describe('constructor', () => {
    it('should initialize with provider manager', () => {
      expect(agentModelConfig).toBeDefined();
      expect(agentModelConfig.getProviderManager()).toBe(providerManager);
    });

    it('should initialize with default agent configurations', () => {
      const config = agentModelConfig.getConfig();
      
      expect(config.build).toBeDefined();
      expect(config.plan).toBeDefined();
      expect(config.researcher).toBeDefined();
      expect(config.triage).toBeDefined();
    });

    it('should accept custom initial configuration', () => {
      const customConfig: Partial<Record<AgentType, AgentModelMapping>> = {
        build: { model: 'claude-3-opus', provider: 'anthropic' },
        plan: { model: 'gpt-4-turbo', provider: 'openai' }
      };
      
      const amc = new AgentModelConfig(providerManager, { config: customConfig });
      const config = amc.getConfig();
      
      expect(config.build?.model).toBe('claude-3-opus');
      expect(config.plan?.model).toBe('gpt-4-turbo');
    });
  });

  describe('getModelForAgent()', () => {
    it('should return model configuration for build agent', () => {
      const mapping = agentModelConfig.getModelForAgent('build');
      
      expect(mapping).toBeDefined();
      expect(mapping.model).toBeDefined();
      expect(mapping.provider).toBeDefined();
    });

    it('should return model configuration for plan agent', () => {
      const mapping = agentModelConfig.getModelForAgent('plan');
      
      expect(mapping).toBeDefined();
      expect(mapping.model).toBeDefined();
      expect(mapping.provider).toBeDefined();
    });

    it('should return model configuration for researcher agent', () => {
      const mapping = agentModelConfig.getModelForAgent('researcher');
      
      expect(mapping).toBeDefined();
      expect(mapping.model).toBeDefined();
      expect(mapping.provider).toBeDefined();
    });

    it('should return model configuration for triage agent', () => {
      const mapping = agentModelConfig.getModelForAgent('triage');
      
      expect(mapping).toBeDefined();
      expect(mapping.model).toBeDefined();
      expect(mapping.provider).toBeDefined();
    });

    it('should throw error for invalid agent type', () => {
      expect(() => {
        agentModelConfig.getModelForAgent('invalid' as AgentType);
      }).toThrow();
    });
  });

  describe('setModelForAgent()', () => {
    it('should set model for specific agent type', async () => {
      await agentModelConfig.setModelForAgent('build', {
        model: 'gpt-4-turbo',
        provider: 'openai'
      });
      
      const mapping = agentModelConfig.getModelForAgent('build');
      expect(mapping.model).toBe('gpt-4-turbo');
      expect(mapping.provider).toBe('openai');
    });

    it('should validate model exists before setting', async () => {
      await expect(
        agentModelConfig.setModelForAgent('build', {
          model: 'non-existent-model',
          provider: 'anthropic'
        }, { validate: true })
      ).rejects.toThrow(ModelValidationError);
    });

    it('should allow setting without validation when validate option is false', async () => {
      await agentModelConfig.setModelForAgent('build', {
        model: 'future-model',
        provider: 'anthropic'
      }, { validate: false });
      
      const mapping = agentModelConfig.getModelForAgent('build');
      expect(mapping.model).toBe('future-model');
    });
  });

  describe('validateModel()', () => {
    it('should return true for valid model', async () => {
      const isValid = await agentModelConfig.validateModel('anthropic', 'claude-3-opus');
      expect(isValid).toBe(true);
    });

    it('should return false for invalid model', async () => {
      const isValid = await agentModelConfig.validateModel('anthropic', 'non-existent');
      expect(isValid).toBe(false);
    });

    it('should return false for invalid provider', async () => {
      const isValid = await agentModelConfig.validateModel('non-existent-provider', 'some-model');
      expect(isValid).toBe(false);
    });
  });

  describe('Dynamic Model Switching', () => {
    it('should support switching models via setModelForAgent', async () => {
      // Initial state
      const initial = agentModelConfig.getModelForAgent('build');
      
      // Switch model
      await agentModelConfig.setModelForAgent('build', {
        model: 'gpt-3.5-turbo',
        provider: 'openai'
      });
      
      const updated = agentModelConfig.getModelForAgent('build');
      
      expect(updated.model).toBe('gpt-3.5-turbo');
      expect(updated.model).not.toBe(initial.model);
    });

    it('should support switching all models at once', () => {
      const newConfig: Record<AgentType, AgentModelMapping> = {
        build: { model: 'gpt-4-turbo', provider: 'openai' },
        plan: { model: 'gpt-4-turbo', provider: 'openai' },
        researcher: { model: 'claude-3-sonnet', provider: 'anthropic' },
        triage: { model: 'gemini-pro', provider: 'google' }
      };
      
      agentModelConfig.setConfig(newConfig);
      
      expect(agentModelConfig.getModelForAgent('build').model).toBe('gpt-4-turbo');
      expect(agentModelConfig.getModelForAgent('triage').model).toBe('gemini-pro');
    });
  });

  describe('parseCliFlag()', () => {
    it('should parse provider:model format', () => {
      const result = agentModelConfig.parseCliFlag('anthropic:claude-3-opus');
      
      expect(result.provider).toBe('anthropic');
      expect(result.model).toBe('claude-3-opus');
    });

    it('should parse just model ID (default provider)', () => {
      const result = agentModelConfig.parseCliFlag('claude-3-opus');
      
      expect(result.model).toBe('claude-3-opus');
      expect(result.provider).toBeDefined(); // Should use default provider
    });

    it('should parse full model name with provider prefix', () => {
      const result = agentModelConfig.parseCliFlag('openai/gpt-4-turbo');
      
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4-turbo');
    });

    it('should throw error for invalid format', () => {
      expect(() => {
        agentModelConfig.parseCliFlag('');
      }).toThrow();
    });
  });

  describe('applyCliOverride()', () => {
    it('should apply CLI override to specific agent', async () => {
      await agentModelConfig.applyCliOverride('build', 'openai:gpt-4-turbo');
      
      const mapping = agentModelConfig.getModelForAgent('build');
      expect(mapping.provider).toBe('openai');
      expect(mapping.model).toBe('gpt-4-turbo');
    });

    it('should apply CLI override to all agents when agent is "all"', async () => {
      await agentModelConfig.applyCliOverride('all', 'google:gemini-pro');
      
      expect(agentModelConfig.getModelForAgent('build').model).toBe('gemini-pro');
      expect(agentModelConfig.getModelForAgent('plan').model).toBe('gemini-pro');
      expect(agentModelConfig.getModelForAgent('researcher').model).toBe('gemini-pro');
      expect(agentModelConfig.getModelForAgent('triage').model).toBe('gemini-pro');
    });

    it('should validate model before applying override', async () => {
      await expect(
        agentModelConfig.applyCliOverride('build', 'invalid:model')
      ).rejects.toThrow(ModelValidationError);
    });

    it('should skip validation when validate option is false', async () => {
      await agentModelConfig.applyCliOverride('build', 'invalid:model', { validate: false });
      
      const mapping = agentModelConfig.getModelForAgent('build');
      expect(mapping.model).toBe('model');
      expect(mapping.provider).toBe('invalid');
    });
  });

  describe('listAvailableModels()', () => {
    it('should return all available models', () => {
      const models = agentModelConfig.listAvailableModels();
      
      expect(models.length).toBeGreaterThan(0);
      expect(models.some(m => m.id === 'claude-3-opus')).toBe(true);
      expect(models.some(m => m.id === 'gpt-4-turbo')).toBe(true);
      expect(models.some(m => m.id === 'gemini-pro')).toBe(true);
    });

    it('should return models grouped by provider', () => {
      const models = agentModelConfig.listAvailableModels();
      const anthropicModels = models.filter(m => m.provider === 'anthropic');
      
      expect(anthropicModels.length).toBe(3); // opus, sonnet, haiku
    });
  });

  describe('getRecommendedModel()', () => {
    it('should recommend appropriate model for build agent', () => {
      const recommended = agentModelConfig.getRecommendedModel('build');
      
      expect(recommended).toBeDefined();
      expect(recommended.supportsTools).toBe(true);
    });

    it('should recommend appropriate model for plan agent', () => {
      const recommended = agentModelConfig.getRecommendedModel('plan');
      
      expect(recommended).toBeDefined();
    });

    it('should recommend appropriate model for researcher agent', () => {
      const recommended = agentModelConfig.getRecommendedModel('researcher');
      
      expect(recommended).toBeDefined();
    });

    it('should recommend fast model for triage agent', () => {
      const recommended = agentModelConfig.getRecommendedModel('triage');
      
      expect(recommended).toBeDefined();
      // Triage should use cheaper/faster models
    });
  });

  describe('Error Handling', () => {
    it('should provide helpful error message for invalid model', async () => {
      try {
        await agentModelConfig.setModelForAgent('build', {
          model: 'invalid-model',
          provider: 'anthropic'
        }, { validate: true });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ModelValidationError);
        expect((error as ModelValidationError).message).toContain('invalid-model');
        expect((error as ModelValidationError).availableModels).toBeDefined();
      }
    });

    it('should handle provider not found gracefully', async () => {
      const isValid = await agentModelConfig.validateModel('nonexistent', 'some-model');
      expect(isValid).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('should serialize config to JSON', () => {
      const json = agentModelConfig.toJSON();
      
      expect(json).toBeDefined();
      expect(typeof json).toBe('string');
      
      const parsed = JSON.parse(json);
      expect(parsed.build).toBeDefined();
      expect(parsed.plan).toBeDefined();
    });

    it('should load config from JSON', () => {
      const json = JSON.stringify({
        build: { model: 'claude-3-opus', provider: 'anthropic' },
        plan: { model: 'gpt-4-turbo', provider: 'openai' },
        researcher: { model: 'claude-3-sonnet', provider: 'anthropic' },
        triage: { model: 'claude-3-haiku', provider: 'anthropic' }
      });
      
      agentModelConfig.loadFromJSON(json);
      
      expect(agentModelConfig.getModelForAgent('build').model).toBe('claude-3-opus');
      expect(agentModelConfig.getModelForAgent('plan').model).toBe('gpt-4-turbo');
    });
  });
});

describe('createAgentModelConfig factory', () => {
  it('should create AgentModelConfig with default options', () => {
    const providerManager = createTestProviderManager();
    const config = createAgentModelConfig(providerManager);
    
    expect(config).toBeInstanceOf(AgentModelConfig);
  });

  it('should create AgentModelConfig with custom config', () => {
    const providerManager = createTestProviderManager();
    const config = createAgentModelConfig(providerManager, {
      config: {
        build: { model: 'gpt-4-turbo', provider: 'openai' }
      }
    });
    
    expect(config.getModelForAgent('build').model).toBe('gpt-4-turbo');
  });
});

describe('ModelValidationError', () => {
  it('should contain validation details', () => {
    const error = new ModelValidationError('anthropic', 'invalid-model', ['claude-3-opus', 'claude-3-sonnet']);
    
    expect(error.message).toContain('invalid-model');
    expect(error.message).toContain('anthropic');
    expect(error.provider).toBe('anthropic');
    expect(error.model).toBe('invalid-model');
    expect(error.availableModels).toEqual(['claude-3-opus', 'claude-3-sonnet']);
  });
});
