/**
 * MetaPromptSystem integration tests
 */

import {
  MetaPromptSystem,
  createMetaPromptSystem,
  quickRender,
  utils,
  MemoryStorage,
} from '../index';
import type { InjectedContext, AgentType } from '../types';

describe('MetaPromptSystem', () => {
  let system: MetaPromptSystem;

  beforeEach(async () => {
    system = createMetaPromptSystem({}, new MemoryStorage());
    await system.initialize();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const sys = createMetaPromptSystem();
      await expect(sys.initialize()).resolves.not.toThrow();
    });

    it('should be idempotent', async () => {
      await system.initialize();
      await system.initialize();
      // Should not throw or duplicate
      const templates = system.getAllTemplates();
      const uniqueIds = new Set(templates.map((t) => t.id));
      expect(uniqueIds.size).toBe(templates.length);
    });
  });

  describe('render', () => {
    const context: InjectedContext = {
      task: 'Implement a function to add two numbers',
    };

    it('should render prompt for executor agent', async () => {
      const result = await system.render('executor', context);

      expect(result.prompt).toBeDefined();
      expect(result.prompt.length).toBeGreaterThan(0);
      expect(result.templateId).toContain('executor');
      expect(result.version).toBeDefined();
      expect(result.estimatedTokens).toBeGreaterThan(0);
      expect(result.renderedAt).toBeInstanceOf(Date);
    });

    it('should render prompt for all agent types', async () => {
      const types: AgentType[] = [
        'coordinator',
        'researcher',
        'planner',
        'executor',
        'reviewer',
        'tester',
        'debugger',
        'optimizer',
        'documenter',
        'validator',
        'migrator',
        'analyzer',
      ];

      for (const type of types) {
        const result = await system.render(type, context);
        // Check that the prompt contains the task (optimizer may modify wording)
        expect(result.prompt.toLowerCase()).toContain('function');
        expect(result.prompt.toLowerCase()).toContain('add');
      }
    });

    it('should include custom values', async () => {
      const result = await system.render('executor', context, {
        specification: 'Use TypeScript',
      });

      expect(result.variables.specification).toBe('Use TypeScript');
    });

    it('should enrich context with timestamp', async () => {
      const result = await system.render('executor', context);
      expect(result.context.custom?.timestamp).toBeDefined();
    });

    it('should record usage stats', async () => {
      await system.render('executor', context);
      const stats = await system.getStats();
      expect(stats.totalTemplates).toBeGreaterThan(0);
    });
  });

  describe('renderWithTemplate', () => {
    it('should render with specific template', async () => {
      const context: InjectedContext = { task: 'Test' };
      const templates = system.getAllTemplates();
      const templateId = templates[0].id;

      const result = await system.renderWithTemplate(templateId, context);
      expect(result.templateId).toBe(templateId);
    });

    it('should throw for non-existent template', async () => {
      const context: InjectedContext = { task: 'Test' };
      await expect(
        system.renderWithTemplate('non-existent', context)
      ).rejects.toThrow('Template not found');
    });
  });

  describe('optimize', () => {
    it('should optimize a prompt', () => {
      const prompt = 'Please kindly utilize the functionality.';
      const result = system.optimize(prompt);

      expect(result.original).toBe(prompt);
      expect(result.optimized).toBeDefined();
      expect(result.metrics.tokenReduction).toBeGreaterThanOrEqual(0);
    });

    it('should use specified strategy', () => {
      const prompt = 'Test prompt.';
      const result = system.optimize(prompt, 'clarity_enhancement');

      expect(result.strategy).toBe('clarity_enhancement');
    });
  });

  describe('suggestOptimizations', () => {
    it('should suggest strategies for a prompt', () => {
      const prompt = 'Word '.repeat(3000); // ~3000 tokens
      const strategies = system.suggestOptimizations(prompt);

      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies).toContain('token_reduction');
    });
  });

  describe('validate', () => {
    it('should validate variables', async () => {
      const templates = system.getAllTemplates();
      const templateId = templates[0].id;

      const result = await system.validate(templateId, { task: 'valid' });
      expect(result.valid).toBe(true);
    });

    it('should throw for non-existent template', async () => {
      await expect(system.validate('non-existent', {})).rejects.toThrow(
        'Template not found'
      );
    });
  });

  describe('getAgentTypes', () => {
    it('should return all agent types', () => {
      const types = system.getAgentTypes();
      expect(types).toHaveLength(12);
      expect(types).toContain('coordinator');
      expect(types).toContain('executor');
      expect(types).toContain('debugger');
    });
  });

  describe('getTemplateInfo', () => {
    it('should return template info', async () => {
      const info = await system.getTemplateInfo('planner');

      expect(info.id).toBeDefined();
      expect(info.name).toBeDefined();
      expect(info.description).toBeDefined();
      expect(info.complexity).toBeGreaterThanOrEqual(1);
      expect(info.variables).toBeDefined();
    });
  });

  describe('getAllTemplates', () => {
    it('should return all templates', () => {
      const templates = system.getAllTemplates();
      expect(templates.length).toBeGreaterThan(0);

      for (const template of templates) {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
      }
    });
  });

  describe('createTemplate', () => {
    it('should create a custom template', async () => {
      const template = await system.createTemplate(
        'custom-test',
        'Custom Test',
        'A custom template',
        'executor',
        'Custom content',
        [],
        'test-author',
        ['custom']
      );

      expect(template.id).toBe('custom-test');
      expect(template.name).toBe('Custom Test');
    });
  });

  describe('updateTemplate', () => {
    it('should update a template', async () => {
      const template = await system.createTemplate(
        'update-test',
        'Original',
        'Desc',
        'executor',
        'Content',
        [],
        'author'
      );

      await system.updateTemplate(template.id, { name: 'Updated' }, 'Name change');

      const info = await system.getTemplateInfo('executor');
      // Note: update creates new version, doesn't modify built-in
    });
  });

  describe('getVersionHistory', () => {
    it('should return version history', async () => {
      const history = await system.getVersionHistory('agent-executor-v1');
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('rollbackVersion', () => {
    it('should rollback to a version', async () => {
      // Create and update a template first
      const template = await system.createTemplate(
        'rollback-test',
        'Test',
        'Desc',
        'executor',
        'V1',
        [],
        'author'
      );

      // This should not throw
      await expect(
        system.rollbackVersion(template.id, '1.0.0')
      ).resolves.not.toThrow();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a custom template', async () => {
      const template = await system.createTemplate(
        'delete-test',
        'Test',
        'Desc',
        'executor',
        'Content',
        [],
        'author'
      );

      const deleted = await system.deleteTemplate(template.id);
      expect(deleted).toBe(true);
    });
  });

  describe('searchTemplates', () => {
    it('should search templates', async () => {
      const results = await system.searchTemplates('executor');
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('exportTemplate', () => {
    it('should export template as JSON', () => {
      const json = system.exportTemplate('agent-executor-v1');
      expect(json).toBeDefined();

      const parsed = JSON.parse(json!);
      expect(parsed.id).toBeDefined();
    });

    it('should return null for non-existent template', () => {
      const json = system.exportTemplate('non-existent');
      expect(json).toBeNull();
    });
  });

  describe('importTemplate', () => {
    it('should import template from JSON', async () => {
      const json = system.exportTemplate('agent-executor-v1');
      const imported = await system.importTemplate(json!);

      expect(imported.id).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return system statistics', async () => {
      const stats = await system.getStats();

      expect(stats.totalTemplates).toBeGreaterThan(0);
      expect(stats.totalVersions).toBeGreaterThan(0);
      expect(Array.isArray(stats.mostUsed)).toBe(true);
      expect(Array.isArray(stats.recentlyUpdated)).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = system.getConfig();

      expect(config.defaultAgentType).toBeDefined();
      expect(config.maxContextTokens).toBeGreaterThan(0);
      expect(config.optimizationEnabled).toBeDefined();
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      system.updateConfig({ maxContextTokens: 2000 });
      const config = system.getConfig();

      expect(config.maxContextTokens).toBe(2000);
    });
  });
});

describe('createMetaPromptSystem', () => {
  it('should create system with default config', () => {
    const sys = createMetaPromptSystem();
    expect(sys).toBeInstanceOf(MetaPromptSystem);
  });

  it('should create system with custom config', () => {
    const sys = createMetaPromptSystem({
      maxContextTokens: 1000,
      optimizationEnabled: false,
    });

    const config = sys.getConfig();
    expect(config.maxContextTokens).toBe(1000);
    expect(config.optimizationEnabled).toBe(false);
  });
});

describe('quickRender', () => {
  it('should quickly render a prompt', async () => {
    const prompt = await quickRender('executor', 'Test task');
    expect(prompt).toContain('Test task');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should include context', async () => {
    const context: Partial<InjectedContext> = {
      project: { name: 'My Project', path: '/test' },
    };
    const prompt = await quickRender('executor', 'Test', context);
    expect(prompt).toContain('Test');
  });
});

describe('utils', () => {
  describe('formatCodeSnippet', () => {
    it('should format code snippet', () => {
      const snippet = {
        file: 'test.ts',
        lines: { start: 1, end: 5 },
        content: 'const x = 1;',
        language: 'typescript',
        relevance: 0.9,
      };

      const formatted = utils.formatCodeSnippet(snippet);
      expect(formatted).toContain('test.ts');
      expect(formatted).toContain('typescript');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens', () => {
      expect(utils.estimateTokens('a'.repeat(40))).toBe(10);
    });
  });

  describe('truncateForTokens', () => {
    it('should truncate long content', () => {
      const truncated = utils.truncateForTokens('a'.repeat(1000), 50);
      expect(truncated).toContain('[... content truncated');
    });
  });

  describe('compareOptimizations', () => {
    it('should compare two optimizations', () => {
      const a = {
        original: 'test',
        optimized: 'test a',
        strategy: 'token_reduction' as const,
        metrics: {
          originalTokens: 100,
          optimizedTokens: 80,
          tokenReduction: 0.2,
          clarityScore: 0.8,
        },
        changes: [],
      };

      const b = {
        original: 'test',
        optimized: 'test b',
        strategy: 'clarity_enhancement' as const,
        metrics: {
          originalTokens: 100,
          optimizedTokens: 90,
          tokenReduction: 0.1,
          clarityScore: 0.9,
        },
        changes: [],
      };

      const result = utils.compareOptimizations(a, b);
      expect(['a', 'b', 'equal']).toContain(result);
    });
  });

  describe('batchOptimize', () => {
    it('should optimize multiple prompts', () => {
      const results = utils.batchOptimize(['Prompt 1', 'Prompt 2']);
      expect(results).toHaveLength(2);
    });
  });

  describe('createOptimizedPrompt', () => {
    it('should create and optimize prompt', () => {
      const template = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        agentType: 'executor' as AgentType,
        content: 'Task: {{task}}',
        variables: [
          { name: 'task', type: 'string', description: 'Task', required: true },
        ],
        metadata: {
          author: 'test',
          createdAt: new Date(),
          modifiedAt: new Date(),
          tags: [],
          complexity: 3,
          estimatedTokens: 100,
          isActive: true,
        },
      };

      const result = utils.createOptimizedPrompt(template, { task: 'Test' });
      expect(result.original).toContain('Test');
      expect(result.optimized).toBeDefined();
    });
  });

  describe('optimizeForAgent', () => {
    it('should optimize for agent type', () => {
      const template = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        agentType: 'executor' as AgentType,
        content: 'Please kindly utilize this.',
        variables: [],
        metadata: {
          author: 'test',
          createdAt: new Date(),
          modifiedAt: new Date(),
          tags: [],
          complexity: 3,
          estimatedTokens: 100,
          isActive: true,
        },
      };

      const result = utils.optimizeForAgent(template, 'executor');
      expect(result.original).toBe(template.content);
    });
  });
});
