/**
 * Unit tests for PLAN.md Validator
 */

import { validatePlan, PlanValidator } from '@/plan/validator';
import type { Plan, PlanTask } from '@/plan/types';

function createValidPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    metadata: {
      phase: '01-test',
      plan: '01',
      type: 'execute',
      wave: 1,
      depends_on: [],
      files_modified: ['src/test.ts'],
      autonomous: false,
      requirements: ['REQ-01'],
    },
    mustHaves: {
      truths: ['Test truth'],
      artifacts: [
        { path: 'src/test.ts', provides: 'Test file', exports: [] },
      ],
      key_links: [],
    },
    objective: 'Test objective',
    executionContext: '@test.md',
    context: [],
    tasks: [
      {
        id: 'task-1',
        type: 'auto',
        name: 'Test task',
        files: ['src/test.ts'],
        action: 'Do something',
        done: 'Task done',
      },
    ],
    verification: [],
    successCriteria: 'Success',
    output: 'Output',
    ...overrides,
  };
}

describe('PlanValidator', () => {
  describe('validatePlan', () => {
    it('should validate a correct plan', () => {
      const plan = createValidPlan();
      const result = validatePlan(plan);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when phase is missing', () => {
      const plan = createValidPlan();
      plan.metadata.phase = '';
      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
    });

    it('should fail when plan is missing', () => {
      const plan = createValidPlan();
      plan.metadata.plan = '';
      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
    });

    it('should fail with invalid plan type', () => {
      const plan = createValidPlan();
      (plan.metadata.type as string) = 'invalid';
      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_PLAN_TYPE')).toBe(true);
    });

    it('should fail with invalid wave number', () => {
      const plan = createValidPlan();
      plan.metadata.wave = 0;
      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_WAVE_NUMBER')).toBe(true);
    });

    it('should warn on invalid dependency format', () => {
      const plan = createValidPlan();
      plan.metadata.depends_on = ['invalid-dep'];
      const result = validatePlan(plan);

      expect(result.warnings.some(w => w.code === 'INVALID_DEPENDENCY_FORMAT')).toBe(true);
    });

    it('should warn on invalid requirement format', () => {
      const plan = createValidPlan();
      plan.metadata.requirements = ['invalid-req'];
      const result = validatePlan(plan);

      expect(result.warnings.some(w => w.code === 'INVALID_REQUIREMENT_FORMAT')).toBe(true);
    });

    it('should fail when task name is missing', () => {
      const plan = createValidPlan();
      plan.tasks[0].name = '';
      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_TASK_NAME')).toBe(true);
    });

    it('should fail when task action is missing', () => {
      const plan = createValidPlan();
      plan.tasks[0].action = '';
      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_TASK_ACTION')).toBe(true);
    });

    it('should warn when task done condition is missing', () => {
      const plan = createValidPlan();
      plan.tasks[0].done = '';
      const result = validatePlan(plan);

      expect(result.warnings.some(w => w.code === 'MISSING_TASK_DONE')).toBe(true);
    });

    it('should fail with invalid task type', () => {
      const plan = createValidPlan();
      (plan.tasks[0].type as string) = 'invalid';
      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_TASK_TYPE')).toBe(true);
    });

    it('should fail when file path contains parent directory reference', () => {
      const plan = createValidPlan();
      plan.tasks[0].files = ['../dangerous.ts'];
      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_FILE_PATH')).toBe(true);
    });

    it('should warn when TDD task has no behavior', () => {
      const plan = createValidPlan();
      plan.tasks[0].tdd = true;
      const result = validatePlan(plan);

      expect(result.warnings.some(w => w.code === 'TDD_MISSING_BEHAVIOR')).toBe(true);
    });

    it('should warn when no truths are defined', () => {
      const plan = createValidPlan();
      plan.mustHaves.truths = [];
      const result = validatePlan(plan);

      expect(result.warnings.some(w => w.code === 'NO_TRUTHS')).toBe(true);
    });

    it('should detect duplicate task IDs', () => {
      const plan = createValidPlan();
      plan.tasks = [
        { id: 'task-1', type: 'auto', name: 'Task 1', files: [], action: 'A1', done: 'D1' },
        { id: 'task-1', type: 'auto', name: 'Task 2', files: [], action: 'A2', done: 'D2' },
      ];
      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'DUPLICATE_TASK_ID')).toBe(true);
    });

    it('should build dependency graph', () => {
      const plan = createValidPlan();
      plan.tasks = [
        { id: 'task-1', type: 'auto', name: 'Task 1', files: [], action: 'Action', done: 'Done' },
        { id: 'task-2', type: 'auto', name: 'Task 2', files: [], action: 'See task-1', done: 'Done' },
      ];
      const result = validatePlan(plan);

      expect(result.dependencies.ordered).toContain('task-1');
      expect(result.dependencies.ordered).toContain('task-2');
    });

    it('should detect orphaned tasks', () => {
      const plan = createValidPlan();
      plan.tasks = [
        { id: 'task-1', type: 'auto', name: 'Task 1', files: [], action: 'Action', done: 'Done' },
        { id: 'task-2', type: 'auto', name: 'Task 2', files: [], action: 'Action', done: 'Done' },
      ];
      const result = validatePlan(plan);

      // Both tasks are orphaned (no dependencies between them)
      expect(result.dependencies.orphaned.length).toBeGreaterThan(0);
    });
  });

  describe('PlanValidator class', () => {
    it('should validate a single plan', () => {
      const validator = new PlanValidator();
      const plan = createValidPlan();

      const result = validator.validate(plan);

      expect(result.valid).toBe(true);
    });

    it('should validate multiple plans with cross-dependencies', () => {
      const validator = new PlanValidator();

      const baseMetadata = createValidPlan().metadata;

      const plan1 = createValidPlan({
        metadata: {
          ...baseMetadata,
          phase: '01-test',
          plan: '01',
          depends_on: [],
          files_modified: [],
          requirements: [],
        },
      });

      const plan2 = createValidPlan({
        metadata: {
          ...baseMetadata,
          phase: '01-test',
          plan: '02',
          depends_on: ['01-test-01'], // Full key format
          files_modified: [],
          requirements: [],
        },
      });

      const results = validator.validateAll([plan1, plan2]);

      expect(results.get('01-test-01')?.valid).toBe(true);
      expect(results.get('01-test-02')?.valid).toBe(true);
    });

    it('should detect missing cross-plan dependencies', () => {
      const validator = new PlanValidator();

      const baseMetadata = createValidPlan().metadata;

      const plan = createValidPlan({
        metadata: {
          ...baseMetadata,
          phase: '01-test',
          plan: '02',
          depends_on: ['99-99'], // Non-existent
          files_modified: [],
          requirements: [],
        },
      });

      const results = validator.validateAll([plan]);

      expect(results.get('01-test-02')?.errors.some(
        e => e.code === 'MISSING_DEPENDENCY'
      )).toBe(true);
    });
  });
});
