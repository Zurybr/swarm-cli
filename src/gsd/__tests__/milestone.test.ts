/**
 * Tests for Milestone Tracking and Validation
 */

import {
  createMilestone,
  updateMilestoneStatus,
  addPhase,
  removePhase,
  reorderPhase,
  validateMilestone,
  getMilestoneStats,
  isMilestoneReady,
  canCompleteMilestone,
  blockMilestone,
  unblockMilestone,
  getNextPhase,
  cloneMilestone,
} from '../milestone';
import { createPhase, createAndAddTask } from '../phase';
import { Milestone, Phase, Task, GSDStatus } from '../types';

describe('Milestone Tracking', () => {
  describe('createMilestone', () => {
    it('should create a milestone with defaults', () => {
      const milestone = createMilestone('Test Milestone');

      expect(milestone.name).toBe('Test Milestone');
      expect(milestone.status).toBe('not_started');
      expect(milestone.phases).toEqual([]);
      expect(milestone.order).toBe(0);
    });

    it('should accept description and order', () => {
      const milestone = createMilestone('Test', 'Description', 5);

      expect(milestone.description).toBe('Description');
      expect(milestone.order).toBe(5);
    });

    it('should generate unique IDs', () => {
      const m1 = createMilestone('M1');
      const m2 = createMilestone('M2');

      expect(m1.id).not.toBe(m2.id);
    });
  });

  describe('updateMilestoneStatus', () => {
    it('should update status to completed when all phases complete', () => {
      const milestone = createMilestone('Test');
      const phase = createPhase('Phase 1');
      createAndAddTask(phase, 'Task 1');
      phase.tasks[0].status = 'completed';
      phase.status = 'completed';
      milestone.phases.push(phase);

      const update = updateMilestoneStatus(milestone);

      expect(update).toBeDefined();
      expect(update!.newStatus).toBe('completed');
      expect(milestone.status).toBe('completed');
    });

    it('should update status to in_progress when some phases complete', () => {
      const milestone = createMilestone('Test');
      const phase1 = createPhase('Phase 1');
      const phase2 = createPhase('Phase 2');

      createAndAddTask(phase1, 'Task 1');
      phase1.tasks[0].status = 'completed';
      phase1.status = 'completed';

      createAndAddTask(phase2, 'Task 2');
      // phase2 not started

      milestone.phases.push(phase1, phase2);
      milestone.status = 'not_started';

      const update = updateMilestoneStatus(milestone);

      expect(update).toBeDefined();
      expect(update!.newStatus).toBe('in_progress');
    });

    it('should return undefined when status unchanged', () => {
      const milestone = createMilestone('Test');
      milestone.status = 'not_started';

      const update = updateMilestoneStatus(milestone);

      expect(update).toBeUndefined();
    });

    it('should set completedAt when completed', () => {
      const milestone = createMilestone('Test');
      const phase = createPhase('Phase 1');
      phase.status = 'completed';
      milestone.phases.push(phase);

      updateMilestoneStatus(milestone);

      expect(milestone.completedAt).toBeDefined();
    });
  });

  describe('addPhase', () => {
    it('should add a phase to the milestone', () => {
      const milestone = createMilestone('Test');
      const phase = createPhase('New Phase');

      addPhase(milestone, phase);

      expect(milestone.phases).toHaveLength(1);
      expect(milestone.phases[0].name).toBe('New Phase');
      expect(phase.order).toBe(0);
    });

    it('should auto-assign order', () => {
      const milestone = createMilestone('Test');
      const phase1 = createPhase('Phase 1');
      const phase2 = createPhase('Phase 2');

      addPhase(milestone, phase1);
      addPhase(milestone, phase2);

      expect(phase1.order).toBe(0);
      expect(phase2.order).toBe(1);
    });
  });

  describe('removePhase', () => {
    it('should remove a phase by ID', () => {
      const milestone = createMilestone('Test');
      const phase = createPhase('Phase 1');
      addPhase(milestone, phase);

      const result = removePhase(milestone, phase.id);

      expect(result).toBe(true);
      expect(milestone.phases).toHaveLength(0);
    });

    it('should return false for non-existent phase', () => {
      const milestone = createMilestone('Test');

      const result = removePhase(milestone, 'nonexistent');

      expect(result).toBe(false);
    });

    it('should reorder remaining phases', () => {
      const milestone = createMilestone('Test');
      const phase1 = createPhase('Phase 1');
      const phase2 = createPhase('Phase 2');
      const phase3 = createPhase('Phase 3');

      addPhase(milestone, phase1);
      addPhase(milestone, phase2);
      addPhase(milestone, phase3);

      removePhase(milestone, phase2.id);

      expect(phase1.order).toBe(0);
      expect(phase3.order).toBe(1);
    });
  });

  describe('reorderPhase', () => {
    it('should reorder a phase', () => {
      const milestone = createMilestone('Test');
      const phase1 = createPhase('Phase 1');
      const phase2 = createPhase('Phase 2');
      const phase3 = createPhase('Phase 3');

      addPhase(milestone, phase1);
      addPhase(milestone, phase2);
      addPhase(milestone, phase3);

      reorderPhase(milestone, phase3.id, 0);

      expect(milestone.phases[0].id).toBe(phase3.id);
      expect(milestone.phases[1].id).toBe(phase1.id);
      expect(milestone.phases[2].id).toBe(phase2.id);
    });

    it('should return false for non-existent phase', () => {
      const milestone = createMilestone('Test');

      const result = reorderPhase(milestone, 'nonexistent', 0);

      expect(result).toBe(false);
    });
  });

  describe('validateMilestone', () => {
    it('should validate a valid milestone', () => {
      const milestone = createMilestone('Valid Milestone', 'Description');
      const phase = createPhase('Phase 1');
      addPhase(milestone, phase);

      const result = validateMilestone(milestone);

      expect(result.valid).toBe(true);
    });

    it('should detect missing name', () => {
      const milestone = createMilestone('');
      milestone.name = '';

      const result = validateMilestone(milestone);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
    });

    it('should warn about empty description', () => {
      const milestone = createMilestone('Test');
      milestone.description = '';

      const result = validateMilestone(milestone);

      expect(result.warnings.some(w => w.field === 'description')).toBe(true);
    });

    it('should warn about missing phases', () => {
      const milestone = createMilestone('Test');

      const result = validateMilestone(milestone);

      expect(result.warnings.some(w => w.field === 'phases')).toBe(true);
    });

    it('should warn about missing success criteria', () => {
      const milestone = createMilestone('Test');
      const phase = createPhase('Phase 1');
      addPhase(milestone, phase);

      const result = validateMilestone(milestone);

      expect(result.warnings.some(w => w.field === 'successCriteria')).toBe(true);
    });

    it('should detect duplicate phase names', () => {
      const milestone = createMilestone('Test');
      const phase1 = createPhase('Same Name');
      const phase2 = createPhase('Same Name');
      addPhase(milestone, phase1);
      addPhase(milestone, phase2);

      const result = validateMilestone(milestone);

      expect(result.warnings.some(w => w.message.includes('Duplicate'))).toBe(true);
    });
  });

  describe('getMilestoneStats', () => {
    it('should calculate milestone statistics', () => {
      const milestone = createMilestone('Test');
      const phase1 = createPhase('Phase 1');
      const phase2 = createPhase('Phase 2');

      createAndAddTask(phase1, 'Task 1');
      phase1.tasks[0].status = 'completed';
      phase1.status = 'completed';

      createAndAddTask(phase2, 'Task 2');
      phase2.status = 'blocked';

      addPhase(milestone, phase1);
      addPhase(milestone, phase2);

      const stats = getMilestoneStats(milestone);

      expect(stats.totalPhases).toBe(2);
      expect(stats.completedPhases).toBe(1);
      expect(stats.blockedPhases).toBe(1);
      expect(stats.totalTasks).toBe(2);
      expect(stats.completedTasks).toBe(1);
    });

    it('should calculate progress percentage', () => {
      const milestone = createMilestone('Test');
      const phase1 = createPhase('Phase 1');
      const phase2 = createPhase('Phase 2');

      createAndAddTask(phase1, 'Task 1');
      phase1.tasks[0].status = 'completed';
      phase1.status = 'completed';

      createAndAddTask(phase2, 'Task 2');
      // phase2 not started

      addPhase(milestone, phase1);
      addPhase(milestone, phase2);

      const stats = getMilestoneStats(milestone);

      // (1 completed phase + 1 completed task) / (2 phases + 2 tasks) = 2/4 = 50%
      expect(stats.progressPercent).toBe(50);
    });
  });

  describe('isMilestoneReady', () => {
    it('should return ready when no blockers', () => {
      const milestone = createMilestone('Test');
      const phase = createPhase('Phase 1');
      addPhase(milestone, phase);

      const result = isMilestoneReady(milestone);

      expect(result.ready).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should detect incomplete previous milestone', () => {
      const prevMilestone = createMilestone('Previous');
      prevMilestone.status = 'in_progress';
      const milestone = createMilestone('Current');

      const result = isMilestoneReady(milestone, prevMilestone);

      expect(result.ready).toBe(false);
      expect(result.reasons.some(r => r.includes('Previous'))).toBe(true);
    });

    it('should detect already completed milestone', () => {
      const milestone = createMilestone('Test');
      milestone.status = 'completed';

      const result = isMilestoneReady(milestone);

      expect(result.ready).toBe(false);
      expect(result.reasons.some(r => r.includes('already completed'))).toBe(true);
    });

    it('should detect cancelled milestone', () => {
      const milestone = createMilestone('Test');
      milestone.status = 'cancelled';

      const result = isMilestoneReady(milestone);

      expect(result.ready).toBe(false);
      expect(result.reasons.some(r => r.includes('cancelled'))).toBe(true);
    });
  });

  describe('canCompleteMilestone', () => {
    it('should allow completion when all phases complete', () => {
      const milestone = createMilestone('Test');
      milestone.successCriteria = ['Criterion 1'];
      const phase = createPhase('Phase 1');
      // Mark phase as completed directly
      phase.status = 'completed';
      addPhase(milestone, phase);

      const result = canCompleteMilestone(milestone);

      expect(result.canComplete).toBe(true);
    });

    it('should detect incomplete phases', () => {
      const milestone = createMilestone('Test');
      const phase = createPhase('Phase 1');
      addPhase(milestone, phase);

      const result = canCompleteMilestone(milestone);

      expect(result.canComplete).toBe(false);
      expect(result.reasons.some(r => r.includes('not completed'))).toBe(true);
    });

    it('should detect missing success criteria', () => {
      const milestone = createMilestone('Test');
      const phase = createPhase('Phase 1');
      phase.status = 'completed';
      addPhase(milestone, phase);

      const result = canCompleteMilestone(milestone);

      expect(result.reasons.some(r => r.includes('success criteria'))).toBe(true);
    });
  });

  describe('blockMilestone', () => {
    it('should block a milestone', () => {
      const milestone = createMilestone('Test');

      const update = blockMilestone(milestone, 'Waiting for dependencies');

      expect(milestone.status).toBe('blocked');
      expect(update.newStatus).toBe('blocked');
      expect(milestone.notes).toContain('Waiting for dependencies');
    });
  });

  describe('unblockMilestone', () => {
    it('should unblock a milestone', () => {
      const milestone = createMilestone('Test');
      milestone.status = 'blocked';
      // No phases needed - unblock just resets from blocked to calculated status
      // With no phases, calculated status is 'not_started'

      const update = unblockMilestone(milestone);

      expect(update).toBeDefined();
      expect(milestone.status).toBe('not_started');
    });

    it('should return undefined if not blocked', () => {
      const milestone = createMilestone('Test');
      milestone.status = 'in_progress';

      const update = unblockMilestone(milestone);

      expect(update).toBeUndefined();
    });
  });

  describe('getNextPhase', () => {
    it('should return the first incomplete phase', () => {
      const milestone = createMilestone('Test');
      const phase1 = createPhase('Phase 1');
      const phase2 = createPhase('Phase 2');
      phase1.status = 'completed';

      addPhase(milestone, phase1);
      addPhase(milestone, phase2);

      const next = getNextPhase(milestone);

      expect(next).toBeDefined();
      expect(next!.id).toBe(phase2.id);
    });

    it('should return undefined when all phases complete', () => {
      const milestone = createMilestone('Test');
      const phase = createPhase('Phase 1');
      phase.status = 'completed';
      addPhase(milestone, phase);

      const next = getNextPhase(milestone);

      expect(next).toBeUndefined();
    });
  });

  describe('cloneMilestone', () => {
    it('should create a copy of the milestone', () => {
      const original = createMilestone('Original', 'Description');
      const phase = createPhase('Phase 1');
      addPhase(original, phase);

      const clone = cloneMilestone(original);

      expect(clone.name).toBe('Original (Copy)');
      expect(clone.description).toBe('Description');
      expect(clone.id).not.toBe(original.id);
      expect(clone.status).toBe('not_started');
    });

    it('should accept a custom name', () => {
      const original = createMilestone('Original');
      const clone = cloneMilestone(original, 'Custom Name');

      expect(clone.name).toBe('Custom Name');
    });

    it('should clone phases with new IDs', () => {
      const original = createMilestone('Original');
      const phase = createPhase('Phase 1');
      addPhase(original, phase);

      const clone = cloneMilestone(original);

      expect(clone.phases).toHaveLength(1);
      expect(clone.phases[0].id).not.toBe(phase.id);
      expect(clone.phases[0].name).toBe('Phase 1');
    });
  });
});
