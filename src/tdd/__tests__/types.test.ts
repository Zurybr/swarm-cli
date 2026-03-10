/**
 * Type tests for TDD module
 */

import type {
  TDDCyclePhase,
  TDDCycleStatus,
  TestCaseStatus,
  TestCaseType,
  CoverageReporter,
  TDDEventType,
} from '../types';

describe('TDD Types', () => {
  describe('TDDCyclePhase', () => {
    it('should have correct phase values', () => {
      const red: TDDCyclePhase = 'red';
      const green: TDDCyclePhase = 'green';
      const refactor: TDDCyclePhase = 'refactor';

      expect(red).toBe('red');
      expect(green).toBe('green');
      expect(refactor).toBe('refactor');
    });
  });

  describe('TDDCycleStatus', () => {
    it('should have correct status values', () => {
      const statuses: TDDCycleStatus[] = [
        'pending',
        'in_progress',
        'completed',
        'failed',
        'skipped',
      ];

      expect(statuses).toContain('pending');
      expect(statuses).toContain('in_progress');
      expect(statuses).toContain('completed');
    });
  });

  describe('TestCaseStatus', () => {
    it('should have correct test case statuses', () => {
      const statuses: TestCaseStatus[] = [
        'draft',
        'pending',
        'running',
        'passed',
        'failed',
        'skipped',
        'error',
      ];

      expect(statuses).toContain('draft');
      expect(statuses).toContain('passed');
      expect(statuses).toContain('failed');
    });
  });

  describe('TestCaseType', () => {
    it('should have correct test case types', () => {
      const types: TestCaseType[] = [
        'unit',
        'integration',
        'e2e',
        'property',
        'benchmark',
      ];

      expect(types).toContain('unit');
      expect(types).toContain('integration');
      expect(types).toContain('e2e');
    });
  });

  describe('CoverageReporter', () => {
    it('should have correct reporter types', () => {
      const reporters: CoverageReporter[] = [
        'text',
        'text-summary',
        'json',
        'html',
        'lcov',
        'clover',
      ];

      expect(reporters).toContain('text');
      expect(reporters).toContain('json');
      expect(reporters).toContain('html');
    });
  });

  describe('TDDEventType', () => {
    it('should have correct event types', () => {
      const events: TDDEventType[] = [
        'plan-created',
        'plan-started',
        'plan-completed',
        'plan-failed',
        'cycle-started',
        'phase-changed',
        'cycle-completed',
        'test-added',
        'test-running',
        'test-completed',
        'test-failed',
        'coverage-updated',
        'threshold-violated',
      ];

      expect(events).toContain('plan-created');
      expect(events).toContain('cycle-started');
      expect(events).toContain('test-completed');
    });
  });
});
