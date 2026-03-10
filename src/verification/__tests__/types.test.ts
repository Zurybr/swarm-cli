/**
 * Type tests for the verification system
 */

import type {
  Goal,
  MustHave,
  Gap,
  VerificationResult,
  VerificationStats,
  BackwardVerificationContext,
} from '../types';

describe('Verification Types', () => {
  describe('Goal type', () => {
    it('should accept valid goal objects', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        description: 'A test goal',
        status: 'pending',
        mustHaves: [],
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(goal.id).toBe('goal-1');
      expect(goal.title).toBe('Test Goal');
    });

    it('should accept all valid status values', () => {
      const statuses: Goal['status'][] = ['pending', 'in_progress', 'verified', 'failed', 'partial'];

      for (const status of statuses) {
        const goal: Goal = {
          id: `goal-${status}`,
          title: 'Test',
          description: 'Test',
          status,
          mustHaves: [],
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        expect(goal.status).toBe(status);
      }
    });

    it('should support hierarchical goals', () => {
      const parent: Goal = {
        id: 'parent',
        title: 'Parent',
        description: 'Parent goal',
        status: 'pending',
        mustHaves: [],
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        children: ['child'],
      };

      const child: Goal = {
        id: 'child',
        title: 'Child',
        description: 'Child goal',
        status: 'pending',
        mustHaves: [],
        priority: 1,
        parentId: 'parent',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(child.parentId).toBe(parent.id);
      expect(parent.children).toContain(child.id);
    });
  });

  describe('MustHave type', () => {
    it('should accept valid must-have objects', () => {
      const mustHave: MustHave = {
        id: 'mh-1',
        description: 'File must exist',
        type: 'existence',
        status: 'pending',
        target: 'src/index.ts',
        required: true,
        weight: 1.0,
        createdAt: new Date(),
      };

      expect(mustHave.type).toBe('existence');
      expect(mustHave.required).toBe(true);
    });

    it('should accept all must-have types', () => {
      const types: MustHave['type'][] = ['existence', 'value', 'structure', 'relation'];

      for (const type of types) {
        const mustHave: MustHave = {
          id: `mh-${type}`,
          description: `Test ${type}`,
          type,
          status: 'pending',
          target: 'test',
          required: true,
          weight: 1.0,
          createdAt: new Date(),
        };
        expect(mustHave.type).toBe(type);
      }
    });

    it('should support value operators', () => {
      const operators = ['equals', 'contains', 'greater_than', 'matches_regex'] as const;

      for (const operator of operators) {
        const mustHave: MustHave = {
          id: `mh-${operator}`,
          description: 'Value check',
          type: 'value',
          status: 'pending',
          target: 'config.json',
          expected: 'test',
          operator,
          required: true,
          weight: 1.0,
          createdAt: new Date(),
        };
        expect(mustHave.operator).toBe(operator);
      }
    });
  });

  describe('Gap type', () => {
    it('should accept valid gap objects', () => {
      const gap: Gap = {
        id: 'gap-1',
        description: 'Missing file',
        severity: 'critical',
        mustHaveId: 'mh-1',
        goalId: 'goal-1',
        expected: 'src/index.ts',
        actual: null,
        blocking: true,
        identifiedAt: new Date(),
      };

      expect(gap.severity).toBe('critical');
      expect(gap.blocking).toBe(true);
    });

    it('should accept all severity levels', () => {
      const severities: Gap['severity'][] = ['critical', 'major', 'minor', 'info'];

      for (const severity of severities) {
        const gap: Gap = {
          id: `gap-${severity}`,
          description: 'Test gap',
          severity,
          mustHaveId: 'mh-1',
          goalId: 'goal-1',
          expected: 'test',
          blocking: severity === 'critical',
          identifiedAt: new Date(),
        };
        expect(gap.severity).toBe(severity);
      }
    });
  });

  describe('VerificationResult type', () => {
    it('should accept valid verification results', () => {
      const result: VerificationResult = {
        goalId: 'goal-1',
        achieved: false,
        completionPercentage: 50,
        mustHaveResults: [],
        gaps: [],
        stats: {
          totalMustHaves: 2,
          satisfied: 1,
          failed: 1,
          pending: 0,
          criticalGaps: 0,
          majorGaps: 1,
          minorGaps: 0,
          weightedSatisfaction: 50,
        },
        verifiedAt: new Date(),
        duration: 100,
        method: 'backward',
      };

      expect(result.achieved).toBe(false);
      expect(result.completionPercentage).toBe(50);
    });
  });

  describe('BackwardVerificationContext type', () => {
    it('should accept valid context objects', () => {
      const context: BackwardVerificationContext = {
        workingDir: '/tmp',
        env: { NODE_ENV: 'test' },
        stopOnFailure: false,
        checkTimeout: 30000,
        maxDepth: 10,
        currentDepth: 0,
        gaps: [],
      };

      expect(context.workingDir).toBe('/tmp');
      expect(context.stopOnFailure).toBe(false);
    });
  });
});
