/**
 * Skill CLI Integration Tests
 *
 * Tests the skill command-line interface commands:
 * - register: Register a new skill
 * - list: List all registered skills
 * - search: Search skills by query
 * - get: Get detailed skill information
 */

import sqlite3 from 'sqlite3';
import { SkillRegistry } from '../../src/skills';
import { SkillMetadata } from '../../src/skills/types/skill';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

describe('Skill CLI Integration', () => {
  let db: sqlite3.Database;
  let registry: SkillRegistry;

  beforeEach(async () => {
    // Create in-memory database for each test
    db = new sqlite3.Database(':memory:');
    registry = new SkillRegistry(db);
    await registry.initialize();

    // Clear mocks
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('CLI register command', () => {
    it('should register a skill via CLI action', async () => {
      const metadata: SkillMetadata = {
        name: 'test-skill',
        description: 'A test skill for integration testing',
        version: '1.0.0',
        category: 'testing',
        tags: ['test', 'integration'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Simulate the CLI register action
      await registry.register(metadata);

      // Verify skill was registered
      const retrieved = registry.getMetadata('test-skill');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-skill');
      expect(retrieved?.version).toBe('1.0.0');
    });

    it('should handle duplicate skill registration', async () => {
      const metadata: SkillMetadata = {
        name: 'duplicate-skill',
        description: 'A test skill for duplicate testing',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await registry.register(metadata);

      // Try to register again - should throw
      await expect(registry.register(metadata)).rejects.toThrow('already exists');
    });
  });

  describe('CLI list command', () => {
    it('should list all registered skills', async () => {
      // Register multiple skills
      const skills: SkillMetadata[] = [
        {
          name: 'skill-one',
          description: 'First test skill for listing',
          version: '1.0.0',
          category: 'testing',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'skill-two',
          description: 'Second test skill for listing',
          version: '2.0.0',
          category: 'security',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      for (const skill of skills) {
        await registry.register(skill);
      }

      // Get all metadata (simulating list command)
      const allSkills = registry.getAllMetadata();

      expect(allSkills).toHaveLength(2);
      expect(allSkills.map(s => s.name)).toContain('skill-one');
      expect(allSkills.map(s => s.name)).toContain('skill-two');
    });

    it('should filter skills by category', async () => {
      // Register skills in different categories
      await registry.register({
        name: 'security-skill',
        description: 'A security focused skill',
        version: '1.0.0',
        category: 'security',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await registry.register({
        name: 'testing-skill',
        description: 'A testing focused skill',
        version: '1.0.0',
        category: 'testing',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Filter by category (simulating --category option)
      const allSkills = registry.getAllMetadata();
      const securitySkills = allSkills.filter(s => s.category === 'security');

      expect(securitySkills).toHaveLength(1);
      expect(securitySkills[0].name).toBe('security-skill');
    });
  });

  describe('CLI search command', () => {
    it('should search skills by description', async () => {
      // Register skills with different descriptions
      await registry.register({
        name: 'security-scanner',
        description: 'Scans code for security vulnerabilities and issues',
        version: '1.0.0',
        category: 'security',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await registry.register({
        name: 'performance-monitor',
        description: 'Monitors application performance metrics',
        version: '1.0.0',
        category: 'performance',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Search for "security" (simulating search command)
      const results = await registry.search('security');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(s => s.name === 'security-scanner')).toBe(true);
    });

    it('should respect search limit option', async () => {
      // Register multiple skills
      for (let i = 1; i <= 5; i++) {
        await registry.register({
          name: `test-skill-${i}`,
          description: `Test skill number ${i} for search limit testing`,
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Search with limit
      const results = await registry.search('test', 3);

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('CLI get command', () => {
    it('should get skill details by name', async () => {
      const metadata: SkillMetadata = {
        name: 'detailed-skill',
        description: 'A skill with full details for get command testing',
        version: '1.5.0',
        category: 'documentation',
        tags: ['docs', 'detailed', 'test'],
        author: 'Test Author',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-03-01'),
      };

      await registry.register(metadata);

      // Get skill (simulating get command)
      const skill = registry.getMetadata('detailed-skill');

      expect(skill).toBeDefined();
      expect(skill?.name).toBe('detailed-skill');
      expect(skill?.version).toBe('1.5.0');
      expect(skill?.category).toBe('documentation');
      expect(skill?.tags).toEqual(['docs', 'detailed', 'test']);
      expect(skill?.author).toBe('Test Author');
    });

    it('should handle missing skill', async () => {
      // Try to get non-existent skill
      const skill = registry.getMetadata('non-existent-skill');

      expect(skill).toBeUndefined();
    });
  });

  describe('CLI error handling', () => {
    it('should validate skill metadata on register', async () => {
      const invalidMetadata = {
        name: 'Invalid Name With Spaces', // Invalid: spaces
        description: 'Short', // Invalid: too short
        version: 'not-a-version', // Invalid: not semver
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(registry.register(invalidMetadata as any)).rejects.toThrow();
    });

    it('should handle empty skill list gracefully', async () => {
      const allSkills = registry.getAllMetadata();

      expect(allSkills).toHaveLength(0);
    });

    it('should handle search with no results', async () => {
      const results = await registry.search('nonexistentquery12345');

      expect(results).toHaveLength(0);
    });
  });
});
