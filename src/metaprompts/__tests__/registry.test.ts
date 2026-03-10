/**
 * Template registry tests
 */

import {
  TemplateRegistry,
  MemoryStorage,
  createTemplate,
  getGlobalRegistry,
  resetGlobalRegistry,
} from '../registry';
import type { PromptTemplate, TemplateVariable } from '../types';

describe('TemplateRegistry', () => {
  let registry: TemplateRegistry;

  beforeEach(() => {
    registry = new TemplateRegistry(new MemoryStorage());
  });

  describe('initialize', () => {
    it('should initialize with built-in templates', async () => {
      await registry.initialize();
      const templates = await registry.getAllTemplates();
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should not duplicate templates on multiple initializes', async () => {
      await registry.initialize();
      await registry.initialize();
      const templates = await registry.getAllTemplates();
      const uniqueIds = new Set(templates.map((t) => t.id));
      expect(uniqueIds.size).toBe(templates.length);
    });
  });

  describe('registerTemplate', () => {
    it('should register a new template', async () => {
      const template = createTemplate(
        'test-template',
        'Test Template',
        'A test template',
        'executor',
        'Test content',
        [],
        'test-author',
        ['test']
      );

      const entry = await registry.registerTemplate(template);
      expect(entry.template.id).toBe('test-template');
      expect(entry.versions).toHaveLength(1);
      expect(entry.currentVersion).toBe('1.0.0');
    });

    it('should create initial version', async () => {
      const template = createTemplate(
        'test-template',
        'Test',
        'Test',
        'executor',
        'Content',
        [],
        'author'
      );

      const entry = await registry.registerTemplate(template);
      expect(entry.versions[0].version).toBe('1.0.0');
      expect(entry.versions[0].isCurrent).toBe(true);
    });
  });

  describe('getTemplate', () => {
    it('should return template by id', async () => {
      const template = createTemplate('test', 'Test', 'Test', 'executor', 'Content', [], 'author');
      await registry.registerTemplate(template);

      const retrieved = await registry.getTemplate('test');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test');
    });

    it('should return null for non-existent template', async () => {
      const retrieved = await registry.getTemplate('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getTemplateByAgentType', () => {
    it('should return template for valid agent type', async () => {
      await registry.initialize();
      const template = await registry.getTemplateByAgentType('executor');
      expect(template).toBeDefined();
      expect(template.agentType).toBe('executor');
    });
  });

  describe('getAllTemplates', () => {
    it('should return all registered templates', async () => {
      const beforeCount = (await registry.getAllTemplates()).length;

      await registry.registerTemplate(
        createTemplate('test1', 'Test 1', 'Test', 'executor', 'Content', [], 'author')
      );
      await registry.registerTemplate(
        createTemplate('test2', 'Test 2', 'Test', 'planner', 'Content', [], 'author')
      );

      const templates = await registry.getAllTemplates();
      expect(templates).toHaveLength(beforeCount + 2);
    });
  });

  describe('getTemplatesByTag', () => {
    it('should return templates matching tag', async () => {
      await registry.registerTemplate(
        createTemplate('test1', 'Test 1', 'Test', 'executor', 'Content', [], 'author', ['tag-a'])
      );
      await registry.registerTemplate(
        createTemplate('test2', 'Test 2', 'Test', 'planner', 'Content', [], 'author', ['tag-b'])
      );

      const templates = await registry.getTemplatesByTag('tag-a');
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('test1');
    });

    it('should return empty array for non-matching tag', async () => {
      await registry.registerTemplate(
        createTemplate('test', 'Test', 'Test', 'executor', 'Content', [], 'author', ['tag'])
      );

      const templates = await registry.getTemplatesByTag('non-existent');
      expect(templates).toHaveLength(0);
    });
  });

  describe('updateTemplate', () => {
    it('should update template and create new version', async () => {
      const template = createTemplate('test', 'Test', 'Test', 'executor', 'Content', [], 'author');
      await registry.registerTemplate(template);

      const updated = await registry.updateTemplate(
        'test',
        { name: 'Updated Test' },
        'Updated name'
      );

      expect(updated).toBeDefined();
      expect(updated?.template.name).toBe('Updated Test');
      expect(updated?.currentVersion).toBe('1.0.1');
      expect(updated?.versions).toHaveLength(2);
    });

    it('should return null for non-existent template', async () => {
      const result = await registry.updateTemplate('non-existent', { name: 'New' }, 'Change');
      expect(result).toBeNull();
    });
  });

  describe('createVersion', () => {
    it('should create a new version', async () => {
      const template = createTemplate('test', 'Test', 'Test', 'executor', 'Content', [], 'author');
      await registry.registerTemplate(template);

      const version = await registry.createVersion('test', 'New content', 'Updated content', 'author');

      expect(version).toBeDefined();
      expect(version?.version).toBe('1.0.1');
      expect(version?.content).toBe('New content');
    });

    it('should mark new version as current', async () => {
      const template = createTemplate('test', 'Test', 'Test', 'executor', 'Content', [], 'author');
      await registry.registerTemplate(template);

      await registry.createVersion('test', 'New content', 'Update', 'author');
      const versions = await registry.getVersionHistory('test');

      const current = versions.find((v) => v.isCurrent);
      expect(current?.version).toBe('1.0.1');
    });
  });

  describe('getVersionHistory', () => {
    it('should return version history', async () => {
      const template = createTemplate('test', 'Test', 'Test', 'executor', 'Content', [], 'author');
      await registry.registerTemplate(template);
      await registry.createVersion('test', 'V2', 'Second version', 'author');

      const history = await registry.getVersionHistory('test');
      expect(history).toHaveLength(2);
    });

    it('should return empty array for non-existent template', async () => {
      const history = await registry.getVersionHistory('non-existent');
      expect(history).toHaveLength(0);
    });
  });

  describe('getVersion', () => {
    it('should return specific version', async () => {
      const template = createTemplate('test', 'Test', 'Test', 'executor', 'Content', [], 'author');
      await registry.registerTemplate(template);

      const version = await registry.getVersion('test', '1.0.0');
      expect(version).toBeDefined();
      expect(version?.version).toBe('1.0.0');
    });

    it('should return null for non-existent version', async () => {
      const template = createTemplate('test', 'Test', 'Test', 'executor', 'Content', [], 'author');
      await registry.registerTemplate(template);

      const version = await registry.getVersion('test', '9.9.9');
      expect(version).toBeNull();
    });
  });

  describe('rollbackVersion', () => {
    it('should rollback to specified version', async () => {
      const template = createTemplate('test', 'Test', 'Test', 'executor', 'V1', [], 'author');
      await registry.registerTemplate(template);
      await registry.createVersion('test', 'V2', 'Second version', 'author');

      const rolled = await registry.rollbackVersion('test', '1.0.0');
      expect(rolled).toBeDefined();
      expect(rolled?.currentVersion).toBe('1.0.0');
      expect(rolled?.template.content).toBe('V1');
    });

    it('should return null for non-existent template', async () => {
      const result = await registry.rollbackVersion('non-existent', '1.0.0');
      expect(result).toBeNull();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template', async () => {
      const template = createTemplate('test', 'Test', 'Test', 'executor', 'Content', [], 'author');
      await registry.registerTemplate(template);

      const deleted = await registry.deleteTemplate('test');
      expect(deleted).toBe(true);

      const retrieved = await registry.getTemplate('test');
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent template', async () => {
      const deleted = await registry.deleteTemplate('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('recordUsage', () => {
    it('should update usage stats', async () => {
      const template = createTemplate('test', 'Test', 'Test', 'executor', 'Content', [], 'author');
      await registry.registerTemplate(template);

      await registry.recordUsage('test', 100, true);
      const stats = await registry.getStats('test');

      expect(stats?.usageCount).toBe(1);
      expect(stats?.avgTokens).toBe(100);
      expect(stats?.successRate).toBe(1);
      expect(stats?.lastUsed).toBeDefined();
    });

    it('should calculate average tokens', async () => {
      const template = createTemplate('test', 'Test', 'Test', 'executor', 'Content', [], 'author');
      await registry.registerTemplate(template);

      await registry.recordUsage('test', 100, true);
      await registry.recordUsage('test', 200, true);

      const stats = await registry.getStats('test');
      expect(stats?.avgTokens).toBe(150);
    });

    it('should calculate success rate', async () => {
      const template = createTemplate('test', 'Test', 'Test', 'executor', 'Content', [], 'author');
      await registry.registerTemplate(template);

      await registry.recordUsage('test', 100, true);
      await registry.recordUsage('test', 100, false);

      const stats = await registry.getStats('test');
      expect(stats?.successRate).toBe(0.5);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await registry.registerTemplate(
        createTemplate('test1', 'Alpha Template', 'First test', 'executor', 'Content', [], 'author')
      );
      await registry.registerTemplate(
        createTemplate('test2', 'Beta Template', 'Second test', 'planner', 'Content', [], 'author')
      );
    });

    it('should search by name', async () => {
      const results = await registry.search('Alpha');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Alpha Template');
    });

    it('should search by description', async () => {
      const results = await registry.search('Second');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('test2');
    });

    it('should search case-insensitively', async () => {
      const results = await registry.search('alpha');
      expect(results).toHaveLength(1);
    });

    it('should return empty array for no matches', async () => {
      const results = await registry.search('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('cloneTemplate', () => {
    it('should clone a template', async () => {
      const template = createTemplate('source', 'Source', 'Source desc', 'executor', 'Content', [], 'author');
      await registry.registerTemplate(template);

      const cloned = await registry.cloneTemplate('source', 'clone', 'Cloned Template');
      expect(cloned).toBeDefined();
      expect(cloned?.template.id).toBe('clone');
      expect(cloned?.template.name).toBe('Cloned Template');
      expect(cloned?.template.content).toBe('Content');
    });

    it('should return null for non-existent source', async () => {
      const cloned = await registry.cloneTemplate('non-existent', 'clone', 'Clone');
      expect(cloned).toBeNull();
    });
  });

  describe('exportTemplate', () => {
    it('should export template as JSON', async () => {
      const template = createTemplate('test', 'Test', 'Test', 'executor', 'Content', [], 'author');
      await registry.registerTemplate(template);

      const exported = registry.exportTemplate('test');
      expect(exported).toBeDefined();

      const parsed = JSON.parse(exported!);
      expect(parsed.id).toBe('test');
      expect(parsed.name).toBe('Test');
    });

    it('should return null for non-existent template', () => {
      const exported = registry.exportTemplate('non-existent');
      expect(exported).toBeNull();
    });
  });

  describe('importTemplate', () => {
    it('should import template from JSON', async () => {
      const template = createTemplate('test', 'Test', 'Test', 'executor', 'Content', [], 'author');
      await registry.registerTemplate(template);

      const exported = registry.exportTemplate('test');
      await registry.deleteTemplate('test');

      const imported = await registry.importTemplate(exported!);
      expect(imported.template.id).toBe('test');
    });

    it('should throw for invalid JSON', async () => {
      await expect(registry.importTemplate('invalid json')).rejects.toThrow();
    });

    it('should throw for missing required fields', async () => {
      await expect(registry.importTemplate('{"name": "Test"}')).rejects.toThrow();
    });
  });

  describe('getSummary', () => {
    it('should return registry summary', async () => {
      await registry.initialize();
      const summary = await registry.getSummary();

      expect(summary.totalTemplates).toBeGreaterThan(0);
      expect(summary.totalVersions).toBeGreaterThan(0);
      expect(Array.isArray(summary.mostUsed)).toBe(true);
      expect(Array.isArray(summary.recentlyUpdated)).toBe(true);
    });
  });
});

describe('createTemplate', () => {
  it('should create template with correct structure', () => {
    const variables: TemplateVariable[] = [
      { name: 'var1', type: 'string', description: 'Var 1', required: true },
    ];

    const template = createTemplate(
      'test',
      'Test Template',
      'A test',
      'executor',
      'Content',
      variables,
      'author',
      ['tag1', 'tag2']
    );

    expect(template.id).toBe('test');
    expect(template.name).toBe('Test Template');
    expect(template.agentType).toBe('executor');
    expect(template.variables).toHaveLength(1);
    expect(template.metadata.tags).toEqual(['tag1', 'tag2']);
    expect(template.metadata.author).toBe('author');
    expect(template.metadata.isActive).toBe(true);
  });

  it('should estimate tokens based on content length', () => {
    const template = createTemplate('test', 'Test', 'Test', 'executor', 'a'.repeat(40), [], 'author');
    expect(template.metadata.estimatedTokens).toBe(10);
  });
});

describe('Global registry', () => {
  beforeEach(() => {
    resetGlobalRegistry();
  });

  afterEach(() => {
    resetGlobalRegistry();
  });

  it('should create global registry', () => {
    const registry1 = getGlobalRegistry();
    const registry2 = getGlobalRegistry();
    expect(registry1).toBe(registry2);
  });

  it('should reset global registry', () => {
    const registry1 = getGlobalRegistry();
    resetGlobalRegistry();
    const registry2 = getGlobalRegistry();
    expect(registry1).not.toBe(registry2);
  });
});
