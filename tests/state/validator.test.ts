/**
 * Tests for state/validator.ts
 */

import {
  validateState,
  isValid,
  validateOrThrow,
  formatValidationResult,
} from '../../src/state/validator';
import { State, StateItem } from '../../src/state/types';

describe('State Validator', () => {
  const validState: State = {
    frontmatter: {
      version: '1.0',
      project: 'test-project',
      lastSync: new Date().toISOString(),
    },
    sections: [
      {
        type: 'backlog',
        items: [
          {
            id: 'task-1',
            title: 'Test task',
            status: 'open',
            type: 'task',
            priority: 'medium',
          },
        ],
        order: 0,
      },
    ],
  };

  describe('validateState', () => {
    it('should validate a correct state', () => {
      const result = validateState(validState);

      expect(result.valid).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should detect missing version', () => {
      const state = {
        ...validState,
        frontmatter: { ...validState.frontmatter, version: undefined as any },
      };

      const result = validateState(state);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.path === 'frontmatter.version')).toBe(true);
    });

    it('should detect invalid version', () => {
      const state = {
        ...validState,
        frontmatter: { ...validState.frontmatter, version: '2.0' as any },
      };

      const result = validateState(state);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.message.includes('Invalid version'))).toBe(true);
    });

    it('should detect missing project', () => {
      const state = {
        ...validState,
        frontmatter: { ...validState.frontmatter, project: '' },
      };

      const result = validateState(state);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.path === 'frontmatter.project')).toBe(true);
    });

    it('should detect invalid lastSync timestamp', () => {
      const state = {
        ...validState,
        frontmatter: { ...validState.frontmatter, lastSync: 'invalid-date' },
      };

      const result = validateState(state);

      expect(result.warningCount).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('Invalid lastSync'))).toBe(true);
    });

    it('should detect missing item ID', () => {
      const state = {
        ...validState,
        sections: [{
          ...validState.sections[0],
          items: [{ title: 'No ID', status: 'open' } as StateItem],
        }],
      };

      const result = validateState(state);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.message.includes('missing ID'))).toBe(true);
    });

    it('should detect missing item title', () => {
      const state = {
        ...validState,
        sections: [{
          ...validState.sections[0],
          items: [{ id: 'task-1', status: 'open' } as StateItem],
        }],
      };

      const result = validateState(state);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.message.includes('missing title'))).toBe(true);
    });

    it('should detect missing item status', () => {
      const state = {
        ...validState,
        sections: [{
          ...validState.sections[0],
          items: [{ id: 'task-1', title: 'Test' } as StateItem],
        }],
      };

      const result = validateState(state);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.message.includes('missing status'))).toBe(true);
    });

    it('should detect invalid status', () => {
      const state = {
        ...validState,
        sections: [{
          ...validState.sections[0],
          items: [{ id: 'task-1', title: 'Test', status: 'invalid' as any }],
        }],
      };

      const result = validateState(state);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.message.includes('Invalid status'))).toBe(true);
    });

    it('should detect invalid type', () => {
      const state: State = {
        ...validState,
        sections: [{
          ...validState.sections[0],
          items: [{
            id: 'task-1',
            title: 'Test',
            status: 'open',
            type: 'invalid' as any,
          }],
        }],
      };

      const result = validateState(state);

      expect(result.warningCount).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('Invalid type'))).toBe(true);
    });

    it('should detect invalid priority', () => {
      const state: State = {
        ...validState,
        sections: [{
          ...validState.sections[0],
          items: [{
            id: 'task-1',
            title: 'Test',
            status: 'open',
            priority: 'invalid' as any,
          }],
        }],
      };

      const result = validateState(state);

      expect(result.warningCount).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('Invalid priority'))).toBe(true);
    });

    it('should detect duplicate IDs', () => {
      const state: State = {
        ...validState,
        sections: [
          {
            type: 'backlog',
            items: [
              { id: 'task-1', title: 'Task 1', status: 'open' },
              { id: 'task-1', title: 'Task 1 duplicate', status: 'open' },
            ],
            order: 0,
          },
        ],
      };

      const result = validateState(state);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.message.includes('Duplicate ID'))).toBe(true);
    });

    it('should detect short title warning', () => {
      const state: State = {
        ...validState,
        sections: [{
          ...validState.sections[0],
          items: [{ id: 'task-1', title: 'AB', status: 'open' }],
        }],
      };

      const result = validateState(state);

      expect(result.warningCount).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('very short'))).toBe(true);
    });

    it('should detect completedAt without completed status', () => {
      const state: State = {
        ...validState,
        sections: [{
          ...validState.sections[0],
          items: [{
            id: 'task-1',
            title: 'Test',
            status: 'open',
            completedAt: new Date().toISOString(),
          }],
        }],
      };

      const result = validateState(state);

      expect(result.warningCount).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('completedAt but status'))).toBe(true);
    });

    it('should detect blockedReason without blocked status', () => {
      const state: State = {
        ...validState,
        sections: [{
          ...validState.sections[0],
          items: [{
            id: 'task-1',
            title: 'Test',
            status: 'open',
            blockedReason: 'Waiting for something',
          }],
        }],
      };

      const result = validateState(state);

      expect(result.infoCount).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('blockedReason but status'))).toBe(true);
    });

    it('should validate tags as array', () => {
      const state: State = {
        ...validState,
        sections: [{
          ...validState.sections[0],
          items: [{
            id: 'task-1',
            title: 'Test',
            status: 'open',
            tags: 'not-an-array' as any,
          }],
        }],
      };

      const result = validateState(state);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.message.includes('Tags must be an array'))).toBe(true);
    });

    it('should validate notes as array', () => {
      const state: State = {
        ...validState,
        sections: [{
          ...validState.sections[0],
          items: [{
            id: 'task-1',
            title: 'Test',
            status: 'open',
            notes: 'not-an-array' as any,
          }],
        }],
      };

      const result = validateState(state);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.message.includes('Notes must be an array'))).toBe(true);
    });

    it('should warn on empty sections', () => {
      const state: State = {
        ...validState,
        sections: [],
      };

      const result = validateState(state);

      expect(result.warningCount).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('No sections'))).toBe(true);
    });

    it('should support strict mode', () => {
      const state: State = {
        ...validState,
        sections: [{
          ...validState.sections[0],
          items: [{
            id: 'task-1',
            title: 'Test',
            status: 'open',
            // Missing type, priority, createdAt
          }],
        }],
      };

      const result = validateState(state, { strict: true });

      expect(result.warningCount).toBeGreaterThanOrEqual(3); // type, priority, createdAt
    });
  });

  describe('isValid', () => {
    it('should return true for valid state', () => {
      expect(isValid(validState)).toBe(true);
    });

    it('should return false for invalid state', () => {
      const state = {
        ...validState,
        frontmatter: { ...validState.frontmatter, version: undefined as any },
      };

      expect(isValid(state)).toBe(false);
    });
  });

  describe('validateOrThrow', () => {
    it('should not throw for valid state', () => {
      expect(() => validateOrThrow(validState)).not.toThrow();
    });

    it('should throw for invalid state', () => {
      const state = {
        ...validState,
        frontmatter: { ...validState.frontmatter, version: undefined as any },
      };

      expect(() => validateOrThrow(state)).toThrow('State validation failed');
    });
  });

  describe('formatValidationResult', () => {
    it('should format valid result', () => {
      const result = validateState(validState);
      const formatted = formatValidationResult(result);

      expect(formatted).toContain('Validation passed');
    });

    it('should format invalid result with errors', () => {
      const state = {
        ...validState,
        frontmatter: { ...validState.frontmatter, version: undefined as any },
      };
      const result = validateState(state);
      const formatted = formatValidationResult(result);

      expect(formatted).toContain('Validation failed');
      expect(formatted).toContain('error(s)');
      expect(formatted).toContain('ERROR');
    });

    it('should include suggestions', () => {
      const state = {
        ...validState,
        frontmatter: { ...validState.frontmatter, version: undefined as any },
      };
      const result = validateState(state);
      const formatted = formatValidationResult(result);

      expect(formatted).toContain('→');
    });
  });
});
