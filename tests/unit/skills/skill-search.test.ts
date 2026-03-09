/**
 * Skill Search Index Tests
 *
 * Tests for FTS5 search functionality on skill metadata.
 */

import sqlite3 from 'sqlite3';
import { SkillSearchIndex } from '../../../src/skills/registry/search-index';
import { SkillStore } from '../../../src/skills/registry/skill-store';
import { SkillMetadata } from '../../../src/skills/types/skill';

describe('SkillSearchIndex', () => {
  let db: sqlite3.Database;
  let searchIndex: SkillSearchIndex;
  let store: SkillStore;

  beforeEach(async () => {
    db = new sqlite3.Database(':memory:');
    store = new SkillStore(db);
    searchIndex = new SkillSearchIndex(db);
    await store.initialize();
    await searchIndex.initialize();
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  const createSkill = (name: string, description: string, version = '1.0.0'): SkillMetadata => ({
    name,
    description,
    version,
    category: 'general',
    tags: ['test'],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe('search', () => {
    it('should find skill by name', async () => {
      const skill = createSkill('code-review', 'Reviews code for issues');
      await store.save(skill);

      const results = await searchIndex.search('code');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('code-review');
    });

    it('should find skill by description', async () => {
      const skill = createSkill('security-scan', 'Analyzes security vulnerabilities in code');
      await store.save(skill);

      const results = await searchIndex.search('security');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('security-scan');
    });

    it('should rank exact matches higher', async () => {
      // FTS5 prefix search: "test*" matches both "test" and "testing"
      const skill1 = createSkill('test', 'A simple test skill');
      const skill2 = createSkill('testing', 'A comprehensive testing framework');
      await store.save(skill1);
      await store.save(skill2);

      const results = await searchIndex.search('test*');

      expect(results).toHaveLength(2);
      // Exact match "test" should rank higher than "testing"
      expect(results[0].name).toBe('test');
    });

    it('should return empty for no matches', async () => {
      const results = await searchIndex.search('xyznonexistent');

      expect(results).toEqual([]);
    });

    it('should limit results', async () => {
      for (let i = 0; i < 10; i++) {
        await store.save(createSkill(`skill-${i}`, `Description for skill ${i}`));
      }

      const results = await searchIndex.search('skill', 5);

      expect(results).toHaveLength(5);
    });

    it('should sanitize query with quotes', async () => {
      const skill = createSkill('test-skill', 'Test with "quotes"');
      await store.save(skill);

      const results = await searchIndex.search('test "skill"');

      expect(results).toHaveLength(1);
    });
  });

  describe('searchPrefix', () => {
    it('should support prefix search for autocomplete', async () => {
      const skill = createSkill('documentation', 'Generates documentation');
      await store.save(skill);

      const results = await searchIndex.searchPrefix('doc');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('documentation');
    });

    it('should return multiple matches for prefix', async () => {
      await store.save(createSkill('document', 'Document something'));
      await store.save(createSkill('documentation', 'Generate docs'));
      await store.save(createSkill('docstring', 'Python docstrings'));

      const results = await searchIndex.searchPrefix('doc');

      expect(results.length).toBeGreaterThanOrEqual(3);
    });

    it('should respect limit in prefix search', async () => {
      for (let i = 0; i < 10; i++) {
        await store.save(createSkill(`doc-${i}`, `Description ${i}`));
      }

      const results = await searchIndex.searchPrefix('doc', 5);

      expect(results).toHaveLength(5);
    });
  });

  describe('search result format', () => {
    it('should return complete skill metadata in results', async () => {
      const skill: SkillMetadata = {
        name: 'complete-skill',
        description: 'A complete skill for testing',
        version: '2.0.0',
        category: 'testing',
        tags: ['test', 'complete'],
        author: 'test-author',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await store.save(skill);

      const results = await searchIndex.search('complete');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        name: 'complete-skill',
        description: 'A complete skill for testing',
        version: '2.0.0',
        category: 'testing',
        tags: ['test', 'complete'],
        author: 'test-author',
      });
      expect(results[0].rank).toBeDefined();
    });
  });
});
