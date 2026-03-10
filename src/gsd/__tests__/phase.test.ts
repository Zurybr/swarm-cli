/**
 * Tests for Phase Execution and Verification
 */

import {
  createPhase,
  updatePhaseStatus,
  addTask,
  createAndAddTask,
  removeTask,
  updateTaskStatus,
  validatePhase,
  getPhaseStats,
  isPhaseReady,
  canCompletePhase,
  blockPhase,
  unblockPhase,
  getNextTask,
  getTasksByPriority,
  getBlockedTasks,
  clonePhase,
  verifyExitCriteria,
} from '../phase';
import { Phase, Task, GSDPriority, GSDStatus } from '../types';

describe('Phase Execution', () => {
  describe('createPhase', () => {
    it('should create a phase with defaults', () => {
      const phase = createPhase('Test Phase');

      expect(phase.name).toBe('Test Phase');
      expect(phase.status).toBe('not_started');
      expect(phase.tasks).toEqual([]);
      expect(phase.order).toBe(0);
    });

    it('should accept description and order', () => {
      const phase = createPhase('Test', 'Description', 3);

      expect(phase.description).toBe('Description');
      expect(phase.order).toBe(3);
    });

    it('should generate unique IDs', () => {
      const p1 = createPhase('P1');
      const p2 = createPhase('P2');

      expect(p1.id).not.toBe(p2.id);
    });
  });

  describe('updatePhaseStatus', () => {
    it('should update status to completed when all tasks complete', () => {
      const phase = createPhase('Test');
      const task: Task = {
        id: 't1',
        name: 'Task 1',
        description: '',
        status: 'completed',
        priority: 'medium',
        dependencies: [],
        deliverables: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      phase.tasks.push(task);

      const update = updatePhaseStatus(phase);

      expect(update).toBeDefined();
      expect(update!.newStatus).toBe('completed');
      expect(phase.status).toBe('completed');
    });

    it('should update status to in_progress when some tasks complete', () => {
      const phase = createPhase('Test');
      const task1: Task = {
        id: 't1',
        name: 'Task 1',
        description: '',
        status: 'completed',
        priority: 'medium',
        dependencies: [],
        deliverables: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const task2: Task = {
        id: 't2',
        name: 'Task 2',
        description: '',
        status: 'not_started',
        priority: 'medium',
        dependencies: [],
        deliverables: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      phase.tasks.push(task1, task2);
      phase.status = 'not_started';

      const update = updatePhaseStatus(phase);

      expect(update).toBeDefined();
      expect(update!.newStatus).toBe('in_progress');
    });

    it('should return undefined when status unchanged', () => {
      const phase = createPhase('Test');

      const update = updatePhaseStatus(phase);

      expect(update).toBeUndefined();
    });

    it('should set completedAt when completed', () => {
      const phase = createPhase('Test');
      const task: Task = {
        id: 't1',
        name: 'Task 1',
        description: '',
        status: 'completed',
        priority: 'medium',
        dependencies: [],
        deliverables: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      phase.tasks.push(task);

      updatePhaseStatus(phase);

      expect(phase.completedAt).toBeDefined();
    });
  });

  describe('addTask', () => {
    it('should add a task to the phase', () => {
      const phase = createPhase('Test');
      const task: Task = {
        id: 't1',
        name: 'Task 1',
        description: '',
        status: 'not_started',
        priority: 'medium',
        dependencies: [],
        deliverables: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      addTask(phase, task);

      expect(phase.tasks).toHaveLength(1);
      expect(phase.tasks[0].name).toBe('Task 1');
    });
  });

  describe('createAndAddTask', () => {
    it('should create and add a task', () => {
      const phase = createPhase('Test');

      const task = createAndAddTask(phase, 'New Task', 'high');

      expect(phase.tasks).toHaveLength(1);
      expect(task.name).toBe('New Task');
      expect(task.priority).toBe('high');
    });

    it('should default to medium priority', () => {
      const phase = createPhase('Test');

      const task = createAndAddTask(phase, 'Task');

      expect(task.priority).toBe('medium');
    });
  });

  describe('removeTask', () => {
    it('should remove a task by ID', () => {
      const phase = createPhase('Test');
      const task = createAndAddTask(phase, 'Task 1');

      const result = removeTask(phase, task.id);

      expect(result).toBe(true);
      expect(phase.tasks).toHaveLength(0);
    });

    it('should return false for non-existent task', () => {
      const phase = createPhase('Test');

      const result = removeTask(phase, 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status', () => {
      const phase = createPhase('Test');
      const task = createAndAddTask(phase, 'Task 1');

      const update = updateTaskStatus(phase, task.id, 'in_progress');

      expect(update).toBeDefined();
      expect(task.status).toBe('in_progress');
      expect(update!.newStatus).toBe('in_progress');
    });

    it('should return undefined for non-existent task', () => {
      const phase = createPhase('Test');

      const update = updateTaskStatus(phase, 'nonexistent', 'completed');

      expect(update).toBeUndefined();
    });

    it('should return undefined when status unchanged', () => {
      const phase = createPhase('Test');
      const task = createAndAddTask(phase, 'Task 1');

      const update = updateTaskStatus(phase, task.id, 'not_started');

      expect(update).toBeUndefined();
    });

    it('should check dependencies before completing', () => {
      const phase = createPhase('Test');
      const task1 = createAndAddTask(phase, 'Task 1');
      const task2 = createAndAddTask(phase, 'Task 2');
      task2.dependencies.push(task1.id);

      expect(() => {
        updateTaskStatus(phase, task2.id, 'completed');
      }).toThrow('incomplete dependencies');
    });

    it('should allow completion when dependencies are satisfied', () => {
      const phase = createPhase('Test');
      const task1 = createAndAddTask(phase, 'Task 1');
      const task2 = createAndAddTask(phase, 'Task 2');
      task2.dependencies.push(task1.id);
      task1.status = 'completed';

      const update = updateTaskStatus(phase, task2.id, 'completed');

      expect(update).toBeDefined();
      expect(task2.status).toBe('completed');
    });

    it('should set completedAt when completed', () => {
      const phase = createPhase('Test');
      const task = createAndAddTask(phase, 'Task 1');

      updateTaskStatus(phase, task.id, 'completed');

      expect(task.completedAt).toBeDefined();
    });
  });

  describe('validatePhase', () => {
    it('should validate a valid phase', () => {
      const phase = createPhase('Valid Phase', 'Description');
      phase.entryCriteria.push('Criterion 1');
      phase.exitCriteria.push('Criterion 2');
      createAndAddTask(phase, 'Task 1');

      const result = validatePhase(phase);

      expect(result.valid).toBe(true);
    });

    it('should detect missing name', () => {
      const phase = createPhase('');
      phase.name = '';

      const result = validatePhase(phase);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
    });

    it('should warn about empty description', () => {
      const phase = createPhase('Test');
      phase.description = '';

      const result = validatePhase(phase);

      expect(result.warnings.some(w => w.field === 'description')).toBe(true);
    });

    it('should warn about missing tasks', () => {
      const phase = createPhase('Test');

      const result = validatePhase(phase);

      expect(result.warnings.some(w => w.field === 'tasks')).toBe(true);
    });

    it('should warn about missing entry criteria', () => {
      const phase = createPhase('Test');
      createAndAddTask(phase, 'Task 1');

      const result = validatePhase(phase);

      expect(result.warnings.some(w => w.field === 'entryCriteria')).toBe(true);
    });

    it('should warn about missing exit criteria', () => {
      const phase = createPhase('Test');
      createAndAddTask(phase, 'Task 1');

      const result = validatePhase(phase);

      expect(result.warnings.some(w => w.field === 'exitCriteria')).toBe(true);
    });

    it('should detect invalid dependencies', () => {
      const phase = createPhase('Test');
      const task = createAndAddTask(phase, 'Task 1');
      task.dependencies.push('nonexistent');

      const result = validatePhase(phase);

      expect(result.errors.some(e => e.code === 'INVALID_DEPENDENCY')).toBe(true);
    });
  });

  describe('getPhaseStats', () => {
    it('should calculate phase statistics', () => {
      const phase = createPhase('Test');
      const task1 = createAndAddTask(phase, 'Task 1');
      const task2 = createAndAddTask(phase, 'Task 2');
      const task3 = createAndAddTask(phase, 'Task 3');

      task1.status = 'completed';
      task2.status = 'in_progress';
      task3.status = 'blocked';
      task3.priority = 'critical';

      const stats = getPhaseStats(phase);

      expect(stats.totalTasks).toBe(3);
      expect(stats.completedTasks).toBe(1);
      expect(stats.inProgressTasks).toBe(1);
      expect(stats.blockedTasks).toBe(1);
      expect(stats.criticalTasks).toBe(1);
    });

    it('should calculate progress percentage', () => {
      const phase = createPhase('Test');
      createAndAddTask(phase, 'Task 1');
      createAndAddTask(phase, 'Task 2');
      phase.tasks[0].status = 'completed';

      const stats = getPhaseStats(phase);

      expect(stats.progressPercent).toBe(50);
    });

    it('should sum estimated and actual hours', () => {
      const phase = createPhase('Test');
      const task1 = createAndAddTask(phase, 'Task 1');
      const task2 = createAndAddTask(phase, 'Task 2');

      task1.estimatedHours = 4;
      task1.actualHours = 3;
      task2.estimatedHours = 6;
      task2.actualHours = 8;

      const stats = getPhaseStats(phase);

      expect(stats.totalEstimatedHours).toBe(10);
      expect(stats.totalActualHours).toBe(11);
    });
  });

  describe('isPhaseReady', () => {
    it('should return ready when no blockers', () => {
      const phase = createPhase('Test');
      phase.entryCriteria.push('Ready');
      createAndAddTask(phase, 'Task 1');

      const result = isPhaseReady(phase);

      expect(result.ready).toBe(true);
    });

    it('should detect incomplete previous phase', () => {
      const prevPhase = createPhase('Previous');
      prevPhase.status = 'in_progress';
      const phase = createPhase('Current');

      const result = isPhaseReady(phase, prevPhase);

      expect(result.ready).toBe(false);
      expect(result.reasons.some(r => r.includes('Previous'))).toBe(true);
    });

    it('should detect missing entry criteria', () => {
      const phase = createPhase('Test');

      const result = isPhaseReady(phase);

      expect(result.reasons.some(r => r.includes('entry criteria'))).toBe(true);
    });

    it('should detect missing tasks', () => {
      const phase = createPhase('Test');
      phase.entryCriteria.push('Ready');

      const result = isPhaseReady(phase);

      expect(result.reasons.some(r => r.includes('no tasks'))).toBe(true);
    });
  });

  describe('canCompletePhase', () => {
    it('should allow completion when all tasks complete', () => {
      const phase = createPhase('Test');
      const task = createAndAddTask(phase, 'Task 1');
      task.status = 'completed';
      phase.exitCriteria.push('Done');

      const result = canCompletePhase(phase);

      expect(result.canComplete).toBe(true);
    });

    it('should detect incomplete tasks', () => {
      const phase = createPhase('Test');
      createAndAddTask(phase, 'Task 1');
      phase.exitCriteria.push('Done');

      const result = canCompletePhase(phase);

      expect(result.canComplete).toBe(false);
      expect(result.reasons.some(r => r.includes('not completed'))).toBe(true);
    });

    it('should detect missing exit criteria', () => {
      const phase = createPhase('Test');
      const task = createAndAddTask(phase, 'Task 1');
      task.status = 'completed';

      const result = canCompletePhase(phase);

      expect(result.reasons.some(r => r.includes('exit criteria'))).toBe(true);
    });
  });

  describe('blockPhase', () => {
    it('should block a phase', () => {
      const phase = createPhase('Test');

      const update = blockPhase(phase, 'Waiting for API');

      expect(phase.status).toBe('blocked');
      expect(update.newStatus).toBe('blocked');
      expect(phase.notes).toContain('Waiting for API');
    });
  });

  describe('unblockPhase', () => {
    it('should unblock a phase', () => {
      const phase = createPhase('Test');
      phase.status = 'blocked';

      const update = unblockPhase(phase);

      expect(update).toBeDefined();
      expect(phase.status).toBe('not_started');
    });

    it('should return undefined if not blocked', () => {
      const phase = createPhase('Test');
      phase.status = 'in_progress';

      const update = unblockPhase(phase);

      expect(update).toBeUndefined();
    });
  });

  describe('getNextTask', () => {
    it('should return task with no incomplete dependencies', () => {
      const phase = createPhase('Test');
      const task1 = createAndAddTask(phase, 'Task 1');
      const task2 = createAndAddTask(phase, 'Task 2');
      task2.dependencies.push(task1.id);

      const next = getNextTask(phase);

      expect(next).toBeDefined();
      expect(next!.id).toBe(task1.id);
    });

    it('should return undefined when all tasks complete', () => {
      const phase = createPhase('Test');
      const task = createAndAddTask(phase, 'Task 1');
      task.status = 'completed';

      const next = getNextTask(phase);

      expect(next).toBeUndefined();
    });
  });

  describe('getTasksByPriority', () => {
    it('should filter tasks by priority', () => {
      const phase = createPhase('Test');
      createAndAddTask(phase, 'Task 1', 'critical');
      createAndAddTask(phase, 'Task 2', 'high');
      createAndAddTask(phase, 'Task 3', 'medium');

      const critical = getTasksByPriority(phase, 'critical');

      expect(critical).toHaveLength(1);
      expect(critical[0].name).toBe('Task 1');
    });
  });

  describe('getBlockedTasks', () => {
    it('should return tasks with incomplete dependencies', () => {
      const phase = createPhase('Test');
      const task1 = createAndAddTask(phase, 'Task 1');
      const task2 = createAndAddTask(phase, 'Task 2');
      task2.dependencies.push(task1.id);

      const blocked = getBlockedTasks(phase);

      expect(blocked).toHaveLength(1);
      expect(blocked[0].task.id).toBe(task2.id);
      expect(blocked[0].blockedBy).toContain(task1.id);
    });

    it('should not include completed tasks', () => {
      const phase = createPhase('Test');
      const task1 = createAndAddTask(phase, 'Task 1');
      const task2 = createAndAddTask(phase, 'Task 2');
      task2.dependencies.push(task1.id);
      task2.status = 'completed';

      const blocked = getBlockedTasks(phase);

      expect(blocked).toHaveLength(0);
    });
  });

  describe('clonePhase', () => {
    it('should create a copy of the phase', () => {
      const original = createPhase('Original', 'Description');
      createAndAddTask(original, 'Task 1');

      const clone = clonePhase(original);

      expect(clone.name).toBe('Original (Copy)');
      expect(clone.description).toBe('Description');
      expect(clone.id).not.toBe(original.id);
      expect(clone.status).toBe('not_started');
    });

    it('should accept a custom name', () => {
      const original = createPhase('Original');
      const clone = clonePhase(original, 'Custom Name');

      expect(clone.name).toBe('Custom Name');
    });

    it('should clone tasks with new IDs', () => {
      const original = createPhase('Original');
      const task = createAndAddTask(original, 'Task 1');

      const clone = clonePhase(original);

      expect(clone.tasks).toHaveLength(1);
      expect(clone.tasks[0].id).not.toBe(task.id);
      expect(clone.tasks[0].name).toBe('Task 1');
    });
  });

  describe('verifyExitCriteria', () => {
    it('should verify exit criteria', () => {
      const phase = createPhase('Test');
      phase.exitCriteria.push('All tests pass');
      const task = createAndAddTask(phase, 'Task 1');
      task.status = 'completed';

      const result = verifyExitCriteria(phase);

      expect(result.verified).toBe(true);
      expect(result.met).toContain('All tests pass');
    });

    it('should report missing criteria', () => {
      const phase = createPhase('Test');
      phase.exitCriteria.push('All tests pass');
      createAndAddTask(phase, 'Task 1');
      // Task not completed

      const result = verifyExitCriteria(phase);

      expect(result.verified).toBe(false);
      expect(result.missing).toContain('All tests pass');
    });
  });
});
