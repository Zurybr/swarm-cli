/**
 * Tests for state/types.ts
 */

import {
  DEFAULT_STATE_CONFIG,
  CellStatus,
  CellType,
  StateSectionType,
  StatePriority,
  StateVersion,
} from '../../src/state/types';

describe('State Types', () => {
  describe('DEFAULT_STATE_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_STATE_CONFIG.stateFilePath).toBe('./STATE.md');
      expect(DEFAULT_STATE_CONFIG.hiveConfig).toEqual({
        baseDir: '.hive',
        enableGit: true,
        autoCommit: true,
      });
      expect(DEFAULT_STATE_CONFIG.autoSync).toBe(false);
      expect(DEFAULT_STATE_CONFIG.validation).toEqual({
        requireAllFields: false,
        strictTypes: true,
      });
    });
  });

  describe('Type compatibility with Hive types', () => {
    it('should have compatible CellStatus values', () => {
      const statuses: CellStatus[] = ['open', 'in_progress', 'completed', 'blocked', 'cancelled'];
      expect(statuses).toContain('open');
      expect(statuses).toContain('in_progress');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('blocked');
      expect(statuses).toContain('cancelled');
    });

    it('should have compatible CellType values', () => {
      const types: CellType[] = ['epic', 'task', 'subtask', 'bug', 'feature', 'research'];
      expect(types).toContain('epic');
      expect(types).toContain('task');
      expect(types).toContain('subtask');
    });
  });

  describe('State-specific types', () => {
    it('should have valid StateSectionType values', () => {
      const sectionTypes: StateSectionType[] = [
        'overview', 'active', 'completed', 'blocked', 'backlog', 'metadata', 'custom'
      ];
      expect(sectionTypes).toHaveLength(7);
    });

    it('should have valid StatePriority values', () => {
      const priorities: StatePriority[] = ['critical', 'high', 'medium', 'low'];
      expect(priorities).toHaveLength(4);
    });

    it('should have valid StateVersion values', () => {
      const version: StateVersion = '1.0';
      expect(version).toBe('1.0');
    });
  });
});
