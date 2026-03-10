/**
 * WaveExecution class integration tests
 */

import WaveExecution from '../index';
import { CreateTaskOptions } from '../types';

describe('WaveExecution', () => {
  let execution: WaveExecution;

  beforeEach(() => {
    execution = new WaveExecution('TestExecution');
  });

  describe('constructor', () => {
    it('should create instance with default name', () => {
      const defaultExecution = new WaveExecution();
      expect(defaultExecution).toBeInstanceOf(WaveExecution);
    });

    it('should create instance with custom name', () => {
      const namedExecution = new WaveExecution('CustomName');
      expect(namedExecution).toBeInstanceOf(WaveExecution);
    });
  });

  describe('addTask', () => {
    it('should add a task', () => {
      const task = execution.addTask({
        name: 'Test Task',
        execute: async () => ({ success: true, durationMs: 100 }),
      });

      expect(task.id).toBeDefined();
      expect(task.name).toBe('Test Task');
      expect(execution.getAllTasks()).toHaveLength(1);
    });

    it('should use custom ID if provided', () => {
      const task = execution.addTask({
        id: 'custom-id',
        name: 'Custom Task',
        execute: async () => ({ success: true, durationMs: 100 }),
      });

      expect(task.id).toBe('custom-id');
    });
  });

  describe('addTasks', () => {
    it('should add multiple tasks', () => {
      const tasks = execution.addTasks([
        { name: 'Task 1', execute: async () => ({ success: true, durationMs: 100 }) },
        { name: 'Task 2', execute: async () => ({ success: true, durationMs: 100 }) },
        { name: 'Task 3', execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      expect(tasks).toHaveLength(3);
      expect(execution.getAllTasks()).toHaveLength(3);
    });
  });

  describe('getTask', () => {
    it('should return task by ID', () => {
      execution.addTask({
        id: 'task-1',
        name: 'Task 1',
        execute: async () => ({ success: true, durationMs: 100 }),
      });

      const task = execution.getTask('task-1');
      expect(task).toBeDefined();
      expect(task?.name).toBe('Task 1');
    });

    it('should return undefined for non-existent task', () => {
      const task = execution.getTask('non-existent');
      expect(task).toBeUndefined();
    });
  });

  describe('removeTask', () => {
    it('should remove task', () => {
      execution.addTask({
        id: 'task-1',
        name: 'Task 1',
        execute: async () => ({ success: true, durationMs: 100 }),
      });

      const removed = execution.removeTask('task-1');
      expect(removed).toBe(true);
      expect(execution.getTask('task-1')).toBeUndefined();
    });

    it('should return false for non-existent task', () => {
      const removed = execution.removeTask('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('clearTasks', () => {
    it('should clear all tasks', () => {
      execution.addTasks([
        { name: 'Task 1', execute: async () => ({ success: true, durationMs: 100 }) },
        { name: 'Task 2', execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      execution.clearTasks();

      expect(execution.getAllTasks()).toHaveLength(0);
      expect(execution.getPlan()).toBeUndefined();
    });
  });

  describe('validateDependencies', () => {
    it('should return valid for acyclic dependencies', () => {
      execution.addTasks([
        { id: 'a', name: 'Task A', execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'b', name: 'Task B', dependencies: ['a'], execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      const validation = execution.validateDependencies();
      expect(validation.valid).toBe(true);
    });

    it('should return invalid for cyclic dependencies', () => {
      execution.addTasks([
        { id: 'a', name: 'Task A', dependencies: ['c'], execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'b', name: 'Task B', dependencies: ['a'], execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'c', name: 'Task C', dependencies: ['b'], execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      const validation = execution.validateDependencies();
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Cycle');
    });
  });

  describe('createPlan', () => {
    it('should create execution plan', () => {
      execution.addTasks([
        { id: 'a', name: 'Task A', execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'b', name: 'Task B', dependencies: ['a'], execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      const plan = execution.createPlan();

      expect(plan).toBeDefined();
      expect(plan.waves).toHaveLength(2);
      expect(plan.totalTasks).toBe(2);
    });

    it('should throw for empty tasks', () => {
      expect(() => execution.createPlan()).toThrow('No tasks');
    });

    it('should throw for cyclic dependencies', () => {
      execution.addTasks([
        { id: 'a', name: 'Task A', dependencies: ['b'], execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'b', name: 'Task B', dependencies: ['a'], execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      expect(() => execution.createPlan()).toThrow(/cyclic|Cycle/i);
    });
  });

  describe('getPlan', () => {
    it('should return undefined before creating plan', () => {
      expect(execution.getPlan()).toBeUndefined();
    });

    it('should return plan after creation', () => {
      execution.addTask({
        name: 'Task',
        execute: async () => ({ success: true, durationMs: 100 }),
      });

      execution.createPlan();

      expect(execution.getPlan()).toBeDefined();
    });
  });

  describe('optimizePlan', () => {
    it('should throw if no plan exists', () => {
      expect(() => execution.optimizePlan()).toThrow('No plan');
    });

    it('should optimize existing plan', () => {
      execution.addTasks([
        { id: 'a', name: 'Task A', execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'b', name: 'Task B', dependencies: ['a'], execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      execution.createPlan();
      const optimized = execution.optimizePlan(1);

      expect(optimized).toBeDefined();
    });
  });

  describe('validatePlan', () => {
    it('should return invalid if no plan exists', () => {
      const validation = execution.validatePlan();
      expect(validation.valid).toBe(false);
    });

    it('should validate existing plan', () => {
      execution.addTasks([
        { id: 'a', name: 'Task A', execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      execution.createPlan();
      const validation = execution.validatePlan();

      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should throw if no plan exists', async () => {
      await expect(execution.execute()).rejects.toThrow('No plan');
    });

    it('should execute plan successfully', async () => {
      execution.addTasks([
        { id: 'a', name: 'Task A', execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'b', name: 'Task B', dependencies: ['a'], execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      execution.createPlan();
      const result = await execution.execute();

      expect(result.success).toBe(true);
    });
  });

  describe('executePartial', () => {
    it('should throw if no plan exists', async () => {
      await expect(execution.executePartial(['a'])).rejects.toThrow('No plan');
    });

    it('should execute subset of tasks', async () => {
      execution.addTasks([
        { id: 'a', name: 'Task A', execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'b', name: 'Task B', execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'c', name: 'Task C', execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      execution.createPlan();
      const result = await execution.executePartial(['a', 'c']);

      expect(result.taskResults.has('a')).toBe(true);
      expect(result.taskResults.has('b')).toBe(false);
      expect(result.taskResults.has('c')).toBe(true);
    });
  });

  describe('getProgress', () => {
    it('should return zero progress before execution', () => {
      execution.addTasks([
        { id: 'a', name: 'Task A', execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'b', name: 'Task B', execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      const progress = execution.getProgress();

      expect(progress.totalTasks).toBe(2);
      expect(progress.completedTasks).toBe(0);
      expect(progress.percentage).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should return zero metrics before plan creation', () => {
      const metrics = execution.getMetrics();

      expect(metrics.totalWaves).toBe(0);
      expect(metrics.maxParallelism).toBe(0);
    });

    it('should return metrics after plan creation', () => {
      execution.addTasks([
        { id: 'a', name: 'Task A', execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'b', name: 'Task B', dependencies: ['a'], execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      execution.createPlan();
      const metrics = execution.getMetrics();

      expect(metrics.totalWaves).toBe(2);
      expect(metrics.maxParallelism).toBe(1);
    });
  });

  describe('getCriticalPath', () => {
    it('should return critical path', () => {
      execution.addTasks([
        { id: 'a', name: 'Task A', execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'b', name: 'Task B', dependencies: ['a'], execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'c', name: 'Task C', dependencies: ['b'], execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      const criticalPath = execution.getCriticalPath();

      expect(criticalPath).toHaveLength(3);
      expect(criticalPath[0]).toBe('a');
    });
  });

  describe('getReadyTasks', () => {
    it('should return tasks with all dependencies met', () => {
      execution.addTasks([
        { id: 'a', name: 'Task A', execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'b', name: 'Task B', dependencies: ['a'], execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      const ready = execution.getReadyTasks(['a']);

      expect(ready.map(t => t.id)).toContain('b');
    });
  });

  describe('getTaskAncestors', () => {
    it('should return all ancestors', () => {
      execution.addTasks([
        { id: 'a', name: 'Task A', execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'b', name: 'Task B', dependencies: ['a'], execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'c', name: 'Task C', dependencies: ['b'], execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      const ancestors = execution.getTaskAncestors('c');

      expect(ancestors).toContain('a');
      expect(ancestors).toContain('b');
      expect(ancestors).not.toContain('c');
    });
  });

  describe('getTaskDescendants', () => {
    it('should return all descendants', () => {
      execution.addTasks([
        { id: 'a', name: 'Task A', execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'b', name: 'Task B', dependencies: ['a'], execute: async () => ({ success: true, durationMs: 100 }) },
        { id: 'c', name: 'Task C', dependencies: ['b'], execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      const descendants = execution.getTaskDescendants('a');

      expect(descendants).toContain('b');
      expect(descendants).toContain('c');
      expect(descendants).not.toContain('a');
    });
  });

  describe('serializePlan', () => {
    it('should throw if no plan exists', () => {
      expect(() => execution.serializePlan()).toThrow('No plan');
    });

    it('should serialize plan to JSON', () => {
      execution.addTasks([
        { id: 'a', name: 'Task A', execute: async () => ({ success: true, durationMs: 100 }) },
      ]);

      execution.createPlan();
      const json = execution.serializePlan();

      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.id).toBeDefined();
    });
  });

  describe('integration', () => {
    it('should execute a complete workflow', async () => {
      const results: string[] = [];

      execution.addTasks([
        {
          id: 'setup',
          name: 'Setup',
          execute: async () => {
            results.push('setup');
            return { success: true, durationMs: 10 };
          },
        },
        {
          id: 'build',
          name: 'Build',
          dependencies: ['setup'],
          execute: async () => {
            results.push('build');
            return { success: true, durationMs: 10 };
          },
        },
        {
          id: 'test',
          name: 'Test',
          dependencies: ['build'],
          execute: async () => {
            results.push('test');
            return { success: true, durationMs: 10 };
          },
        },
      ]);

      // Validate dependencies
      const validation = execution.validateDependencies();
      expect(validation.valid).toBe(true);

      // Create plan
      const plan = execution.createPlan();
      expect(plan.waves).toHaveLength(3);

      // Execute
      const result = await execution.execute();
      expect(result.success).toBe(true);

      // Verify order
      expect(results).toEqual(['setup', 'build', 'test']);
    });

    it('should handle parallel execution', async () => {
      const startTimes: Map<string, number> = new Map();

      execution.addTasks([
        {
          id: 'parallel-1',
          name: 'Parallel 1',
          execute: async () => {
            startTimes.set('parallel-1', Date.now());
            await delay(50);
            return { success: true, durationMs: 50 };
          },
        },
        {
          id: 'parallel-2',
          name: 'Parallel 2',
          execute: async () => {
            startTimes.set('parallel-2', Date.now());
            await delay(50);
            return { success: true, durationMs: 50 };
          },
        },
      ]);

      execution.createPlan();
      await execution.execute();

      // Both should start around the same time
      const time1 = startTimes.get('parallel-1')!;
      const time2 = startTimes.get('parallel-2')!;
      const diff = Math.abs(time1 - time2);

      expect(diff).toBeLessThan(20); // Should start within 20ms of each other
    });
  });
});

// Helper function
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
