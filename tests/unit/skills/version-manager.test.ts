/**
 * Skill Version Manager Tests
 *
 * Tests for semantic version management operations.
 */

import { SkillVersionManager } from '../../../src/skills/registry/version-manager';

describe('SkillVersionManager', () => {
  let versionManager: SkillVersionManager;

  beforeEach(() => {
    versionManager = new SkillVersionManager();
  });

  describe('isValid', () => {
    it('should return true for valid semver', () => {
      expect(versionManager.isValid('1.0.0')).toBe(true);
      expect(versionManager.isValid('0.0.1')).toBe(true);
      expect(versionManager.isValid('10.20.30')).toBe(true);
    });

    it('should return false for invalid semver', () => {
      expect(versionManager.isValid('invalid')).toBe(false);
      expect(versionManager.isValid('1.0')).toBe(false);
      expect(versionManager.isValid('v1.0.0')).toBe(false);
      expect(versionManager.isValid('')).toBe(false);
    });

    it('should return false for prerelease versions', () => {
      expect(versionManager.isValid('1.0.0-alpha')).toBe(false);
      expect(versionManager.isValid('1.0.0-beta.1')).toBe(false);
    });
  });

  describe('compare', () => {
    it('should return 0 for equal versions', () => {
      expect(versionManager.compare('1.0.0', '1.0.0')).toBe(0);
      expect(versionManager.compare('2.5.3', '2.5.3')).toBe(0);
    });

    it('should return -1 when first version is lower', () => {
      expect(versionManager.compare('1.0.0', '2.0.0')).toBe(-1);
      expect(versionManager.compare('1.0.0', '1.1.0')).toBe(-1);
      expect(versionManager.compare('1.0.0', '1.0.1')).toBe(-1);
    });

    it('should return 1 when first version is higher', () => {
      expect(versionManager.compare('2.0.0', '1.0.0')).toBe(1);
      expect(versionManager.compare('1.1.0', '1.0.0')).toBe(1);
      expect(versionManager.compare('1.0.1', '1.0.0')).toBe(1);
    });
  });

  describe('satisfies', () => {
    it('should match exact version', () => {
      expect(versionManager.satisfies('1.0.0', '1.0.0')).toBe(true);
      expect(versionManager.satisfies('1.0.0', '2.0.0')).toBe(false);
    });

    it('should match caret ranges', () => {
      expect(versionManager.satisfies('1.0.0', '^1.0.0')).toBe(true);
      expect(versionManager.satisfies('1.1.0', '^1.0.0')).toBe(true);
      expect(versionManager.satisfies('1.0.1', '^1.0.0')).toBe(true);
      expect(versionManager.satisfies('2.0.0', '^1.0.0')).toBe(false);
    });

    it('should match tilde ranges', () => {
      expect(versionManager.satisfies('1.0.0', '~1.0.0')).toBe(true);
      expect(versionManager.satisfies('1.0.5', '~1.0.0')).toBe(true);
      expect(versionManager.satisfies('1.1.0', '~1.0.0')).toBe(false);
    });

    it('should match wildcard', () => {
      expect(versionManager.satisfies('1.0.0', '*')).toBe(true);
      expect(versionManager.satisfies('2.5.3', '*')).toBe(true);
    });
  });

  describe('getLatest', () => {
    it('should return highest version', () => {
      const versions = ['1.0.0', '2.0.0', '1.5.0'];
      expect(versionManager.getLatest(versions)).toBe('2.0.0');
    });

    it('should return null for empty array', () => {
      expect(versionManager.getLatest([])).toBeNull();
    });

    it('should return only version', () => {
      expect(versionManager.getLatest(['1.0.0'])).toBe('1.0.0');
    });

    it('should handle unsorted input', () => {
      const versions = ['0.5.0', '2.0.0', '1.0.0', '1.5.0'];
      expect(versionManager.getLatest(versions)).toBe('2.0.0');
    });
  });

  describe('isCompatibleUpdate', () => {
    it('should return true for same major version and higher minor/patch', () => {
      expect(versionManager.isCompatibleUpdate('1.0.0', '1.1.0')).toBe(true);
      expect(versionManager.isCompatibleUpdate('1.0.0', '1.0.1')).toBe(true);
      expect(versionManager.isCompatibleUpdate('1.5.3', '1.6.0')).toBe(true);
    });

    it('should return false for major version change', () => {
      expect(versionManager.isCompatibleUpdate('1.0.0', '2.0.0')).toBe(false);
      expect(versionManager.isCompatibleUpdate('2.5.0', '3.0.0')).toBe(false);
    });

    it('should return false for lower version', () => {
      expect(versionManager.isCompatibleUpdate('2.0.0', '1.0.0')).toBe(false);
      expect(versionManager.isCompatibleUpdate('1.5.0', '1.4.0')).toBe(false);
    });

    it('should return false for same version', () => {
      expect(versionManager.isCompatibleUpdate('1.0.0', '1.0.0')).toBe(false);
    });
  });
});
