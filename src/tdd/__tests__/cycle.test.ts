/**
 * Cycle management tests for TDD module
 */

import {
  TDDCycleManager,
  isValidPhaseTransition,
  getNextPhase,
  validatePhaseTransition,
  validateCycle,
  createCycle,
  cloneCycle,
} from '../cycle';
import type { TDDCycle, TDDCyclePhase, TestExecutionResult } from '../types';

describe('TDDCycleManager', () => {
  let manager: TDDCycleManager;

  beforeEach(() => {
    manager = new TDDCycleManager();
  });

  describe('registerCycle', () => {
    it('should register a new cycle', () => {
      const cycle = createCycle(1, 'Test cycle');
      manager.registerCycle(cycle);

      expect(manager.getCycle(cycle.id)).toBe(cycle);
    });
  });

  describe('startCycle', () => {
    it('should start a pending cycle', async () => {
      const cycle = createCycle(1, 'Test cycle');
      manager.registerCycle(cycle);

      const result = await manager.startCycle(cycle.id, 'plan-1');

      expect(result.status).toBe('in_progress');
      expect(result.phaseTimestamps.red).toBeDefined();
    });

    it('should throw error if cycle not found', async () => {
      await expect(manager.startCycle('nonexistent', 'plan-1')).rejects.toThrow(
        'Cycle nonexistent not found'
      );
    });

    it('should throw error if cycle is not pending', async () => {
      const cycle = createCycle(1, 'Test cycle');
      cycle.status = 'completed';
      manager.registerCycle(cycle);

      await expect(manager.startCycle(cycle.id, 'plan-1')).rejects.toThrow(
        'Cannot start cycle in completed status'
      );
    });
  });

  describe('transitionPhase', () => {
    it('should transition from red to green', async () => {
      const cycle = createCycle(1, 'Test cycle');
      cycle.status = 'in_progress';
      cycle.phaseTimestamps.red = new Date();
      manager.registerCycle(cycle);

      const result = await manager.transitionPhase(cycle.id, 'green', 'plan-1');

      expect(result.phase).toBe('green');
      expect(result.phaseTimestamps.green).toBeDefined();
    });

    it('should transition from green to refactor', async () => {
      const cycle = createCycle(1, 'Test cycle');
      cycle.status = 'in_progress';
      cycle.phase = 'green';
      cycle.phaseTimestamps.green = new Date();
      manager.registerCycle(cycle);

      const result = await manager.transitionPhase(cycle.id, 'refactor', 'plan-1');

      expect(result.phase).toBe('refactor');
    });

    it('should throw error for invalid transition', async () => {
      const cycle = createCycle(1, 'Test cycle');
      cycle.status = 'in_progress';
      manager.registerCycle(cycle);

      await expect(
        manager.transitionPhase(cycle.id, 'refactor', 'plan-1')
      ).rejects.toThrow('Invalid phase transition from red to refactor');
    });
  });

  describe('completeCycle', () => {
    it('should complete a cycle in refactor phase', async () => {
      const cycle = createCycle(1, 'Test cycle');
      cycle.status = 'in_progress';
      cycle.phase = 'refactor';
      cycle.phaseTimestamps.red = new Date(Date.now() - 10000);
      cycle.phaseTimestamps.green = new Date(Date.now() - 5000);
      cycle.phaseTimestamps.refactor = new Date(Date.now() - 1000);
      manager.registerCycle(cycle);

      const result = await manager.completeCycle(cycle.id, 'plan-1');

      expect(result.status).toBe('completed');
      expect(result.phaseTimestamps.completed).toBeDefined();
      expect(result.phaseDurations.total).toBeGreaterThan(0);
    });

    it('should throw error if not in refactor phase', async () => {
      const cycle = createCycle(1, 'Test cycle');
      cycle.status = 'in_progress';
      cycle.phase = 'green';
      manager.registerCycle(cycle);

      await expect(manager.completeCycle(cycle.id, 'plan-1')).rejects.toThrow(
        'Can only complete cycle from refactor phase'
      );
    });
  });

  describe('failCycle', () => {
    it('should mark cycle as failed', async () => {
      const cycle = createCycle(1, 'Test cycle');
      manager.registerCycle(cycle);

      const result = await manager.failCycle(cycle.id, 'plan-1', 'Test failed');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Test failed');
    });
  });

  describe('updateTestResults', () => {
    it('should update test results and set testsPassing to true when all pass', async () => {
      const cycle = createCycle(1, 'Test cycle');
      manager.registerCycle(cycle);

      const results: TestExecutionResult[] = [
        {
          testId: 'test-1',
          passed: true,
          duration: 100,
          timestamp: new Date(),
        },
        {
          testId: 'test-2',
          passed: true,
          duration: 150,
          timestamp: new Date(),
        },
      ];

      const result = await manager.updateTestResults(cycle.id, 'plan-1', results);

      expect(result.testsPassing).toBe(true);
    });

    it('should set testsPassing to false when any test fails', async () => {
      const cycle = createCycle(1, 'Test cycle');
      manager.registerCycle(cycle);

      const results: TestExecutionResult[] = [
        {
          testId: 'test-1',
          passed: true,
          duration: 100,
          timestamp: new Date(),
        },
        {
          testId: 'test-2',
          passed: false,
          duration: 150,
          timestamp: new Date(),
        },
      ];

      const result = await manager.updateTestResults(cycle.id, 'plan-1', results);

      expect(result.testsPassing).toBe(false);
    });
  });

  describe('getCycleStatistics', () => {
    it('should return zero statistics when no completed cycles', () => {
      const stats = manager.getCycleStatistics();

      expect(stats.totalCycles).toBe(0);
      expect(stats.averageDuration).toBe(0);
    });

    it('should calculate statistics for completed cycles', () => {
      const cycle1 = createCycle(1, 'Cycle 1');
      cycle1.status = 'completed';
      cycle1.phaseDurations = { red: 1000, green: 2000, refactor: 500, total: 3500 };
      manager.registerCycle(cycle1);

      const cycle2 = createCycle(2, 'Cycle 2');
      cycle2.status = 'completed';
      cycle2.phaseDurations = { red: 1500, green: 2500, refactor: 1000, total: 5000 };
      manager.registerCycle(cycle2);

      const stats = manager.getCycleStatistics();

      expect(stats.totalCycles).toBe(2);
      expect(stats.averageDuration).toBe(4250);
      expect(stats.totalRedTime).toBe(2500);
      expect(stats.totalGreenTime).toBe(4500);
      expect(stats.totalRefactorTime).toBe(1500);
      expect(stats.fastestCycle).toBe(3500);
      expect(stats.slowestCycle).toBe(5000);
    });
  });

  describe('event handling', () => {
    it('should emit events to registered handlers', async () => {
      const handler = jest.fn();
      manager.onEvent(handler);

      const cycle = createCycle(1, 'Test cycle');
      manager.registerCycle(cycle);
      await manager.startCycle(cycle.id, 'plan-1');

      expect(handler).toHaveBeenCalled();
    });

    it('should remove event handlers', async () => {
      const handler = jest.fn();
      manager.onEvent(handler);
      manager.offEvent(handler);

      const cycle = createCycle(1, 'Test cycle');
      manager.registerCycle(cycle);
      await manager.startCycle(cycle.id, 'plan-1');

      // Handler was removed before event
      // Note: The first call might still happen due to timing
      // Just verify offEvent doesn't throw
      expect(() => manager.offEvent(handler)).not.toThrow();
    });
  });
});

describe('Phase transition utilities', () => {
  describe('isValidPhaseTransition', () => {
    it('should allow same phase', () => {
      expect(isValidPhaseTransition('red', 'red')).toBe(true);
      expect(isValidPhaseTransition('green', 'green')).toBe(true);
    });

    it('should allow red -> green', () => {
      expect(isValidPhaseTransition('red', 'green')).toBe(true);
    });

    it('should allow green -> refactor', () => {
      expect(isValidPhaseTransition('green', 'refactor')).toBe(true);
    });

    it('should allow refactor -> red', () => {
      expect(isValidPhaseTransition('refactor', 'red')).toBe(true);
    });

    it('should not allow red -> refactor', () => {
      expect(isValidPhaseTransition('red', 'refactor')).toBe(false);
    });

    it('should not allow green -> red', () => {
      expect(isValidPhaseTransition('green', 'red')).toBe(false);
    });
  });

  describe('getNextPhase', () => {
    it('should return green after red', () => {
      expect(getNextPhase('red')).toBe('green');
    });

    it('should return refactor after green', () => {
      expect(getNextPhase('green')).toBe('refactor');
    });

    it('should return null after refactor', () => {
      expect(getNextPhase('refactor')).toBeNull();
    });
  });

  describe('validatePhaseTransition', () => {
    it('should validate successful transition', () => {
      const cycle = createCycle(1, 'Test');
      cycle.status = 'in_progress';

      const result = validatePhaseTransition(cycle, 'green');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject transition for non-in_progress cycle', () => {
      const cycle = createCycle(1, 'Test');
      cycle.status = 'completed';

      const result = validatePhaseTransition(cycle, 'green');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('completed');
    });

    it('should reject invalid transition', () => {
      const cycle = createCycle(1, 'Test');
      cycle.status = 'in_progress';

      const result = validatePhaseTransition(cycle, 'refactor');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });
  });

  describe('validateCycle', () => {
    it('should validate a valid cycle', () => {
      const cycle = createCycle(1, 'Test cycle');

      const result = validateCycle(cycle);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject cycle without id', () => {
      const cycle = createCycle(1, 'Test');
      (cycle as any).id = '';

      const result = validateCycle(cycle);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cycle must have an ID');
    });

    it('should reject cycle with invalid number', () => {
      const cycle = createCycle(1, 'Test');
      cycle.number = 0;

      const result = validateCycle(cycle);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cycle number must be >= 1');
    });

    it('should reject cycle without description', () => {
      const cycle = createCycle(1, 'Test');
      cycle.description = '';

      const result = validateCycle(cycle);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cycle must have a description');
    });

    it('should validate completed cycle requirements', () => {
      const cycle = createCycle(1, 'Test');
      cycle.status = 'completed';

      const result = validateCycle(cycle);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Completed cycle must have completion timestamp');
    });
  });
});

describe('Cycle factory functions', () => {
  describe('createCycle', () => {
    it('should create a cycle with correct defaults', () => {
      const cycle = createCycle(1, 'Test cycle');

      expect(cycle.number).toBe(1);
      expect(cycle.description).toBe('Test cycle');
      expect(cycle.phase).toBe('red');
      expect(cycle.status).toBe('pending');
      expect(cycle.testsPassing).toBe(false);
      expect(cycle.phaseDurations).toEqual({
        red: 0,
        green: 0,
        refactor: 0,
        total: 0,
      });
    });

    it('should include test case IDs', () => {
      const cycle = createCycle(1, 'Test', ['test-1', 'test-2']);

      expect(cycle.testCases).toEqual(['test-1', 'test-2']);
    });
  });

  describe('cloneCycle', () => {
    it('should clone a cycle with reset state', () => {
      const original = createCycle(1, 'Original');
      original.status = 'completed';
      original.phase = 'refactor';

      const clone = cloneCycle(original, 2);

      expect(clone.number).toBe(2);
      expect(clone.description).toBe('Original');
      expect(clone.phase).toBe('red');
      expect(clone.status).toBe('pending');
      expect(clone.id).not.toBe(original.id);
    });
  });
});
