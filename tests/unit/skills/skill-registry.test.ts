/**
 * Skill Registry Tests
 *
 * Tests for the main SkillRegistry class that integrates store, search, and version management.
 */

import sqlite3 from 'sqlite3';
import { SkillRegistry } from '../../../src/skills/registry/skill-registry';
import { SkillMetadata } from '../../../src/skills/types/skill';

describe('SkillRegistry', () => {
  let db: sqlite3.Database;
  let registry: SkillRegistry;

  beforeEach(async () => {
    db = new sqlite3.Database(':memory:');
    registry = new SkillRegistry(db);
    await registry.initialize();
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  const createSkill = (name: string, version = '1.0.0', overrides: Partial<SkillMetadata> = {}): SkillMetadata => ({
    name,
    description: `Description for ${name}`,
    version,
    category: 'general',
    tags: ['test'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('register', () => {
    it('should register and get skill metadata', async () => {
      const skill = createSkill('test-skill');
      await registry.register(skill);

      const retrieved = registry.getMetadata('test-skill');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-skill');
      expect(retrieved?.version).toBe('1.0.0');
    });

    it('should reject invalid version format', async () => {
      const skill = createSkill('test-skill', 'invalid');

      await expect(registry.register(skill)).rejects.toThrow();
    });

    it('should reject duplicate registration with same version', async () => {
      const skill = createSkill('test-skill', '1.0.0');
      await registry.register(skill);

      await expect(registry.register(skill)).rejects.toThrow('already exists');
    });

    it('should allow registration of different versions', async () => {
      const skill1 = createSkill('test-skill', '1.0.0');
      const skill2 = createSkill('test-skill', '2.0.0');
      await registry.register(skill1);
      await registry.register(skill2);

      const allSkills = registry.getAllMetadata();
      expect(allSkills).toHaveLength(2);
    });
  });

  describe('getMetadata', () => {
    it('should return undefined for non-existent skill', () => {
      const result = registry.getMetadata('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return latest version when multiple exist', async () => {
      const skill1 = createSkill('test-skill', '1.0.0');
      const skill2 = createSkill('test-skill', '2.0.0');
      await registry.register(skill1);
      await registry.register(skill2);

      const retrieved = registry.getMetadata('test-skill');
      expect(retrieved?.version).toBe('2.0.0');
    });
  });

  describe('getAllMetadata', () => {
    it('should return empty array when no skills', () => {
      const result = registry.getAllMetadata();
      expect(result).toEqual([]);
    });

    it('should get all registered skills', async () => {
      await registry.register(createSkill('skill-a'));
      await registry.register(createSkill('skill-b'));
      await registry.register(createSkill('skill-c'));

      const allSkills = registry.getAllMetadata();

      expect(allSkills).toHaveLength(3);
      const names = allSkills.map(s => s.name).sort();
      expect(names).toEqual(['skill-a', 'skill-b', 'skill-c']);
    });
  });

  describe('delete', () => {
    it('should delete skill', async () => {
      const skill = createSkill('test-skill');
      await registry.register(skill);

      await registry.delete('test-skill', '1.0.0');

      const retrieved = registry.getMetadata('test-skill');
      expect(retrieved).toBeUndefined();
    });

    it('should delete specific version only', async () => {
      const skill1 = createSkill('test-skill', '1.0.0');
      const skill2 = createSkill('test-skill', '2.0.0');
      await registry.register(skill1);
      await registry.register(skill2);

      await registry.delete('test-skill', '1.0.0');

      const remaining = registry.getMetadata('test-skill');
      expect(remaining?.version).toBe('2.0.0');
    });
  });

  describe('search', () => {
    it('should find skill by name', async () => {
      await registry.register(createSkill('code-review', '1.0.0', { description: 'Reviews code' }));

      const results = await registry.search('code');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('code-review');
    });

    it('should find skill by description', async () => {
      await registry.register(createSkill('security-scan', '1.0.0', {
        description: 'Analyzes security vulnerabilities'
      }));

      const results = await registry.search('security');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('security-scan');
    });

    it('should return empty for no matches', async () => {
      const results = await registry.search('nonexistent');
      expect(results).toEqual([]);
    });

    it('should respect search limit', async () => {
      for (let i = 0; i < 10; i++) {
        await registry.register(createSkill(`skill-${i}`, '1.0.0'));
      }

      const results = await registry.search('skill', 5);

      expect(results).toHaveLength(5);
    });
  });

  describe('version compatibility', () => {
    it('should check if version satisfies range', async () => {
      const skill = createSkill('test-skill', '1.5.0');
      await registry.register(skill);

      expect(registry.satisfiesVersion('test-skill', '^1.0.0')).toBe(true);
      expect(registry.satisfiesVersion('test-skill', '^2.0.0')).toBe(false);
    });

    it('should return false for non-existent skill version check', () => {
      expect(registry.satisfiesVersion('non-existent', '^1.0.0')).toBe(false);
    });
  });
});
