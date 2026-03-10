/**
 * Scheduler tests
 */

import {
  createTask,
  scheduleIntoWaves,
  optimizePlan,
  getReadyTasks,
  calculatePlanMetrics,
  validatePlan,
  serializePlan,
  DEFAULT_SCHEDULER_OPTIONS,
} from '../scheduler';
import { WaveTask, CreateTaskOptions } from '../types';

function createMockTaskOptions(
  id: string,
  dependencies: string[] = [],
  priority: number = 0
): CreateTaskOptions {
  return {
    id,
    name: `Task ${id}`,
    dependencies,
    priority,
    execute: async () => ({ success: true, durationMs: 100 }),
  };
}

describe('Scheduler', () => {
  describe('createTask', () => {
    it('should create task with defaults', () => {
      const task = createTask({
        name: 'Test Task',
        execute: async () => ({ success: true, durationMs: 100 }),
      });

      expect(task.name).toBe('Test Task');
      expect(task.id).toBeDefined();
      expect(task.dependencies).toEqual([]);
      expect(task.dependents).toEqual([]);
      expect(task.status).toBe('pending');
      expect(task.waveNumber).toBe(-1);
      expect(task.priority).toBe(0);
      expect(task.maxRetries).toBe(0);
      expect(task.retryCount).toBe(0);
      expect(task.timeoutMs).toBe(30000);
    });

    it('should use provided values', () => {
      const task = createTask({
        id: 'custom-id',
        name: 'Custom Task',
        description: 'A description',
        dependencies: ['dep-1'],
        priority: 5,
        maxRetries: 3,
        timeoutMs: 5000,
        metadata: { key: 'value' },
        execute: async () => ({ success: true, durationMs: 100 }),
      });

      expect(task.id).toBe('custom-id');
      expect(task.description).toBe('A description');
      expect(task.dependencies).toEqual(['dep-1']);
      expect(task.priority).toBe(5);
      expect(task.maxRetries).toBe(3);
      expect(task.timeoutMs).toBe(5000);
      expect(task.metadata).toEqual({ key: 'value' });
    });

    it('should generate unique IDs', () => {
      const task1 = createTask({
        name: 'Task 1',
        execute: async () => ({ success: true, durationMs: 100 }),
      });
      const task2 = createTask({
        name: 'Task 2',
        execute: async () => ({ success: true, durationMs: 100 }),
      });

      expect(task1.id).not.toBe(task2.id);
    });
  });

  describe('scheduleIntoWaves', () => {
    it('should schedule independent tasks in same wave', () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask(createMockTaskOptions('b')),
        createTask(createMockTaskOptions('c')),
      ];

      const plan = scheduleIntoWaves(tasks);

      expect(plan.waves).toHaveLength(1);
      expect(plan.waves[0].tasks).toHaveLength(3);
      expect(plan.totalTasks).toBe(3);
    });

    it('should schedule linear dependencies in separate waves', () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask(createMockTaskOptions('b', ['a'])),
        createTask(createMockTaskOptions('c', ['b'])),
      ];

      const plan = scheduleIntoWaves(tasks);

      expect(plan.waves).toHaveLength(3);
      expect(plan.waves[0].tasks[0].id).toBe('a');
      expect(plan.waves[1].tasks[0].id).toBe('b');
      expect(plan.waves[2].tasks[0].id).toBe('c');
    });

    it('should schedule diamond pattern correctly', () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask(createMockTaskOptions('b', ['a'])),
        createTask(createMockTaskOptions('c', ['a'])),
        createTask(createMockTaskOptions('d', ['b', 'c'])),
      ];

      const plan = scheduleIntoWaves(tasks);

      expect(plan.waves).toHaveLength(3);
      expect(plan.waves[0].tasks.map(t => t.id)).toContain('a');
      expect(plan.waves[1].tasks.map(t => t.id)).toContain('b');
      expect(plan.waves[1].tasks.map(t => t.id)).toContain('c');
      expect(plan.waves[2].tasks.map(t => t.id)).toContain('d');
    });

    it('should detect cycles and throw', () => {
      const tasks = [
        createTask(createMockTaskOptions('a', ['c'])),
        createTask(createMockTaskOptions('b', ['a'])),
        createTask(createMockTaskOptions('c', ['b'])),
      ];

      expect(() => scheduleIntoWaves(tasks)).toThrow('cyclic dependencies');
    });

    it('should respect maxParallelTasks option', () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask(createMockTaskOptions('b')),
        createTask(createMockTaskOptions('c')),
        createTask(createMockTaskOptions('d')),
      ];

      const plan = scheduleIntoWaves(tasks, { maxParallelTasks: 2 });

      // Should split into 2 waves of 2 tasks each
      expect(plan.waves.length).toBeGreaterThanOrEqual(2);
    });

    it('should sort by priority when respectPriority is true', () => {
      const tasks = [
        createTask(createMockTaskOptions('low', [], 1)),
        createTask(createMockTaskOptions('high', [], 10)),
        createTask(createMockTaskOptions('medium', [], 5)),
      ];

      const plan = scheduleIntoWaves(tasks, { respectPriority: true });

      expect(plan.waves[0].tasks[0].id).toBe('high');
      expect(plan.waves[0].tasks[1].id).toBe('medium');
      expect(plan.waves[0].tasks[2].id).toBe('low');
    });

    it('should map tasks to correct wave numbers', () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask(createMockTaskOptions('b', ['a'])),
      ];

      const plan = scheduleIntoWaves(tasks);

      expect(plan.taskToWave.get('a')).toBe(0);
      expect(plan.taskToWave.get('b')).toBe(1);
      expect(tasks[0].waveNumber).toBe(0);
      expect(tasks[1].waveNumber).toBe(1);
    });

    it('should throw for empty tasks', () => {
      expect(() => scheduleIntoWaves([])).toThrow('No tasks to schedule');
    });
  });

  describe('optimizePlan', () => {
    it('should merge small waves', () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask(createMockTaskOptions('b', ['a'])),
      ];

      const plan = scheduleIntoWaves(tasks);
      const optimized = optimizePlan(plan, 2);

      expect(optimized.waves.length).toBeLessThanOrEqual(plan.waves.length);
    });

    it('should not modify single wave plan', () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask(createMockTaskOptions('b')),
      ];

      const plan = scheduleIntoWaves(tasks);
      const optimized = optimizePlan(plan, 2);

      expect(optimized.waves).toHaveLength(1);
    });
  });

  describe('getReadyTasks', () => {
    it('should return tasks with all dependencies met', () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask(createMockTaskOptions('b', ['a'])),
        createTask(createMockTaskOptions('c', ['a'])),
        createTask(createMockTaskOptions('d', ['b', 'c'])),
      ];

      // Mark a, b, c as completed so they are not returned
      tasks[0].status = 'completed';
      tasks[1].status = 'completed';
      tasks[2].status = 'completed';

      const ready = getReadyTasks(tasks, new Set(['a', 'b', 'c']));

      expect(ready.map(t => t.id)).toContain('d');
      expect(ready.map(t => t.id)).not.toContain('b');
      expect(ready.map(t => t.id)).not.toContain('c');
    });

    it('should return root tasks when no completed tasks', () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask(createMockTaskOptions('b')),
        createTask(createMockTaskOptions('c', ['a'])),
      ];

      const ready = getReadyTasks(tasks, new Set());

      expect(ready).toHaveLength(2);
      expect(ready.map(t => t.id)).toContain('a');
      expect(ready.map(t => t.id)).toContain('b');
    });

    it('should not return already completed tasks', () => {
      const task = createTask(createMockTaskOptions('a'));
      task.status = 'completed';

      const ready = getReadyTasks([task], new Set());

      expect(ready).toHaveLength(0);
    });
  });

  describe('calculatePlanMetrics', () => {
    it('should calculate correct metrics', () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask(createMockTaskOptions('b', ['a'])),
        createTask(createMockTaskOptions('c', ['a'])),
      ];

      const plan = scheduleIntoWaves(tasks);
      const metrics = calculatePlanMetrics(plan);

      expect(metrics.totalWaves).toBe(2);
      expect(metrics.maxParallelism).toBe(2);
      expect(metrics.averageTasksPerWave).toBe(1.5);
      expect(metrics.criticalPathLength).toBeGreaterThanOrEqual(2);
    });
  });

  describe('validatePlan', () => {
    it('should validate correct plan', () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask(createMockTaskOptions('b', ['a'])),
      ];

      const plan = scheduleIntoWaves(tasks);
      const validation = validatePlan(plan);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect duplicate task IDs', () => {
      const tasks = [
        createTask({ id: 'dup', name: 'Task 1', execute: async () => ({ success: true, durationMs: 100 }) }),
        createTask({ id: 'dup', name: 'Task 2', execute: async () => ({ success: true, durationMs: 100 }) }),
      ];

      const plan = scheduleIntoWaves(tasks);
      const validation = validatePlan(plan);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Duplicate'))).toBe(true);
    });
  });

  describe('serializePlan', () => {
    it('should serialize plan to JSON', () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask(createMockTaskOptions('b', ['a'])),
      ];

      const plan = scheduleIntoWaves(tasks);
      const json = serializePlan(plan);

      const parsed = JSON.parse(json);
      expect(parsed.id).toBe(plan.id);
      expect(parsed.totalTasks).toBe(2);
      expect(parsed.waves).toHaveLength(2);
    });
  });

  describe('DEFAULT_SCHEDULER_OPTIONS', () => {
    it('should have expected defaults', () => {
      expect(DEFAULT_SCHEDULER_OPTIONS.maxParallelTasks).toBe(Infinity);
      expect(DEFAULT_SCHEDULER_OPTIONS.respectPriority).toBe(true);
      expect(DEFAULT_SCHEDULER_OPTIONS.minTasksPerWave).toBe(1);
    });
  });
});
