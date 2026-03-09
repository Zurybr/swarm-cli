/**
 * SkillStore unit tests
 *
 * Tests the SQLite persistence layer for skill metadata.
 */

import sqlite3 from 'sqlite3';
import { SkillStore } from '../../../src/skills/registry/skill-store';
import { SkillMetadata } from '../../../src/skills/types/skill';

describe('SkillStore', () => {
  let db: sqlite3.Database;
  let store: SkillStore;

  beforeAll(async () => {
    // Create in-memory database for testing
    db = new sqlite3.Database(':memory:');
    store = new SkillStore(db);
    await store.initialize();
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  beforeEach(async () => {
    // Clear skills table before each test
    await new Promise<void>((resolve, reject) => {
      db.run('DELETE FROM skills', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  const createTestSkill = (
    name: string,
    version: string,
    overrides: Partial<SkillMetadata> = {}
  ): SkillMetadata => ({
    name,
    description: `Test description for ${name}`,
    version,
    category: 'general',
    tags: ['test', 'skill'],
    schema: {
      input: { type: 'object', properties: {} },
      output: { type: 'object', properties: {} },
    },
    author: 'test-author',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

  describe('save', () => {
    it('should save skill metadata to the database', async () => {
      const skill = createTestSkill('test-skill', '1.0.0');

      await store.save(skill);
      const loaded = await store.loadMetadata('test-skill');

      expect(loaded).toBeDefined();
      expect(loaded?.name).toBe('test-skill');
      expect(loaded?.version).toBe('1.0.0');
      expect(loaded?.description).toBe('Test description for test-skill');
    });

    it('should update existing skill with same name and version', async () => {
      const skill = createTestSkill('update-test', '1.0.0');
      await store.save(skill);

      const updatedSkill = createTestSkill('update-test', '1.0.0', {
        description: 'Updated description',
        updatedAt: new Date('2024-02-01'),
      });
      await store.save(updatedSkill);

      const loaded = await store.loadMetadata('update-test');
      expect(loaded?.description).toBe('Updated description');
    });
  });

  describe('loadMetadata', () => {
    it('should load skill metadata by name', async () => {
      const skill = createTestSkill('load-test', '1.0.0');
      await store.save(skill);

      const loaded = await store.loadMetadata('load-test');

      expect(loaded).toBeDefined();
      expect(loaded?.name).toBe('load-test');
      expect(loaded?.version).toBe('1.0.0');
      expect(loaded?.category).toBe('general');
      expect(loaded?.author).toBe('test-author');
    });

    it('should return undefined for non-existent skill', async () => {
      const loaded = await store.loadMetadata('non-existent-skill');
      expect(loaded).toBeUndefined();
    });

    it('should return the latest version when multiple exist', async () => {
      const skill1 = createTestSkill('version-test', '1.0.0');
      const skill2 = createTestSkill('version-test', '2.0.0');
      const skill3 = createTestSkill('version-test', '1.5.0');

      await store.save(skill1);
      await store.save(skill2);
      await store.save(skill3);

      const loaded = await store.loadMetadata('version-test');
      // Should return the lexicographically highest version
      expect(loaded?.version).toBe('2.0.0');
    });
  });

  describe('loadMetadataByVersion', () => {
    it('should load specific version of a skill', async () => {
      const skill1 = createTestSkill('specific-version', '1.0.0');
      const skill2 = createTestSkill('specific-version', '2.0.0');

      await store.save(skill1);
      await store.save(skill2);

      const loaded = await store.loadMetadataByVersion('specific-version', '1.0.0');
      expect(loaded?.version).toBe('1.0.0');
    });

    it('should return undefined for non-existent version', async () => {
      const loaded = await store.loadMetadataByVersion('skill', '9.9.9');
      expect(loaded).toBeUndefined();
    });
  });

  describe('loadAllMetadata', () => {
    it('should return all saved skills', async () => {
      const skill1 = createTestSkill('skill-a', '1.0.0');
      const skill2 = createTestSkill('skill-b', '1.0.0');

      await store.save(skill1);
      await store.save(skill2);

      const all = await store.loadAllMetadata();
      expect(all).toHaveLength(2);
      expect(all.map((s) => s.name)).toContain('skill-a');
      expect(all.map((s) => s.name)).toContain('skill-b');
    });

    it('should return empty array when no skills exist', async () => {
      const all = await store.loadAllMetadata();
      expect(all).toEqual([]);
    });

    it('should return skills ordered by name and version', async () => {
      const skill1 = createTestSkill('zebra', '1.0.0');
      const skill2 = createTestSkill('alpha', '2.0.0');
      const skill3 = createTestSkill('alpha', '1.0.0');

      await store.save(skill1);
      await store.save(skill2);
      await store.save(skill3);

      const all = await store.loadAllMetadata();
      expect(all[0].name).toBe('alpha');
      expect(all[0].version).toBe('1.0.0');
      expect(all[1].name).toBe('alpha');
      expect(all[1].version).toBe('2.0.0');
      expect(all[2].name).toBe('zebra');
    });
  });

  describe('JSON fields', () => {
    it('should round-trip tags array correctly', async () => {
      const skill = createTestSkill('json-test', '1.0.0', {
        tags: ['tag1', 'tag2', 'tag3'],
      });

      await store.save(skill);
      const loaded = await store.loadMetadata('json-test');

      expect(loaded?.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should round-trip schema object correctly', async () => {
      const skill = createTestSkill('schema-test', '1.0.0', {
        schema: {
          input: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              count: { type: 'number' },
            },
            required: ['name'],
          },
          output: {
            type: 'object',
            properties: {
              result: { type: 'boolean' },
            },
          },
        },
      });

      await store.save(skill);
      const loaded = await store.loadMetadata('schema-test');

      expect(loaded?.schema).toEqual(skill.schema);
    });

    it('should handle skills without optional fields', async () => {
      const skill: SkillMetadata = {
        name: 'minimal-skill',
        description: 'A minimal skill without optional fields',
        version: '1.0.0',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      await store.save(skill);
      const loaded = await store.loadMetadata('minimal-skill');

      expect(loaded?.name).toBe('minimal-skill');
      expect(loaded?.category).toBeFalsy();
      expect(loaded?.tags).toBeUndefined();
      expect(loaded?.schema).toBeUndefined();
      expect(loaded?.author).toBeFalsy();
    });
  });

  describe('delete', () => {
    it('should delete specific skill version', async () => {
      const skill = createTestSkill('delete-test', '1.0.0');
      await store.save(skill);

      const deleted = await store.delete('delete-test', '1.0.0');
      expect(deleted).toBe(true);

      const loaded = await store.loadMetadata('delete-test');
      expect(loaded).toBeUndefined();
    });

    it('should return false when deleting non-existent skill', async () => {
      const deleted = await store.delete('non-existent', '1.0.0');
      expect(deleted).toBe(false);
    });

    it('should only delete specified version', async () => {
      const skill1 = createTestSkill('multi-version', '1.0.0');
      const skill2 = createTestSkill('multi-version', '2.0.0');

      await store.save(skill1);
      await store.save(skill2);

      await store.delete('multi-version', '1.0.0');

      const v1 = await store.loadMetadataByVersion('multi-version', '1.0.0');
      const v2 = await store.loadMetadataByVersion('multi-version', '2.0.0');

      expect(v1).toBeUndefined();
      expect(v2).toBeDefined();
    });
  });

  describe('deleteAllVersions', () => {
    it('should delete all versions of a skill', async () => {
      const skill1 = createTestSkill('purge-test', '1.0.0');
      const skill2 = createTestSkill('purge-test', '2.0.0');
      const skill3 = createTestSkill('purge-test', '3.0.0');

      await store.save(skill1);
      await store.save(skill2);
      await store.save(skill3);

      const deletedCount = await store.deleteAllVersions('purge-test');
      expect(deletedCount).toBe(3);

      const all = await store.loadAllMetadata();
      expect(all).toHaveLength(0);
    });

    it('should return 0 when skill does not exist', async () => {
      const deletedCount = await store.deleteAllVersions('non-existent');
      expect(deletedCount).toBe(0);
    });
  });

  describe('date handling', () => {
    it('should preserve createdAt and updatedAt dates', async () => {
      const createdAt = new Date('2024-01-15T10:30:00.000Z');
      const updatedAt = new Date('2024-03-20T14:45:00.000Z');

      const skill = createTestSkill('date-test', '1.0.0', {
        createdAt,
        updatedAt,
      });

      await store.save(skill);
      const loaded = await store.loadMetadata('date-test');

      expect(loaded?.createdAt.toISOString()).toBe(createdAt.toISOString());
      expect(loaded?.updatedAt.toISOString()).toBe(updatedAt.toISOString());
    });
  });
});
