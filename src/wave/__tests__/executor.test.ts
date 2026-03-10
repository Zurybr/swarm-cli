/**
 * Executor tests
 */

import {
  executePlan,
  executePartial,
  getExecutionProgress,
  retryTask,
  exportExecutionState,
  importExecutionState,
  DEFAULT_EXECUTION_OPTIONS,
} from '../executor';
import { createTask, scheduleIntoWaves } from '../scheduler';
import { CreateTaskOptions, ExecutionPlan, ExecutionState } from '../types';

function createMockTaskOptions(
  id: string,
  dependencies: string[] = [],
  execute?: () => Promise<{ success: boolean; durationMs: number }>
): CreateTaskOptions {
  return {
    id,
    name: `Task ${id}`,
    dependencies,
    execute: execute || (async () => ({ success: true, durationMs: 10 })),
  };
}

describe('Executor', () => {
  describe('executePlan', () => {
    it('should execute simple plan successfully', async () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask(createMockTaskOptions('b', ['a'])),
      ];

      const plan = scheduleIntoWaves(tasks);
      const result = await executePlan(plan);

      expect(result.success).toBe(true);
      expect(result.taskResults.size).toBe(2);
      expect(result.failedTasks).toHaveLength(0);
    });

    it('should execute tasks in parallel within waves', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const tasks = [
        createTask({
          ...createMockTaskOptions('a'),
          execute: async () => {
            concurrentCount++;
            maxConcurrent = Math.max(maxConcurrent, concurrentCount);
            await delay(50);
            concurrentCount--;
            return { success: true, durationMs: 50 };
          },
        }),
        createTask({
          ...createMockTaskOptions('b'),
          execute: async () => {
            concurrentCount++;
            maxConcurrent = Math.max(maxConcurrent, concurrentCount);
            await delay(50);
            concurrentCount--;
            return { success: true, durationMs: 50 };
          },
        }),
      ];

      const plan = scheduleIntoWaves(tasks);
      await executePlan(plan);

      expect(maxConcurrent).toBe(2);
    });

    it('should handle task failure', async () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask({
          ...createMockTaskOptions('b'),
          execute: async () => ({ success: false, error: 'Task failed', durationMs: 10 }),
        }),
      ];

      const plan = scheduleIntoWaves(tasks);
      const result = await executePlan(plan);

      expect(result.success).toBe(false);
      expect(result.failedTasks).toContain('b');
    });

    it('should stop on failure when continueOnFailure is false', async () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask({
          ...createMockTaskOptions('b'),
          execute: async () => ({ success: false, error: 'Failed', durationMs: 10 }),
        }),
        createTask(createMockTaskOptions('c', ['b'])),
      ];

      const plan = scheduleIntoWaves(tasks);
      const result = await executePlan(plan, { continueOnFailure: false });

      expect(result.success).toBe(false);
      // Task c should be skipped since b failed
      expect(result.skippedTasks.length).toBeGreaterThan(0);
    });

    it('should continue on failure when option is true', async () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask({
          ...createMockTaskOptions('b'),
          execute: async () => ({ success: false, error: 'Failed', durationMs: 10 }),
        }),
        createTask(createMockTaskOptions('c')), // Independent task
      ];

      const plan = scheduleIntoWaves(tasks);
      const result = await executePlan(plan, { continueOnFailure: true });

      // Task c should still execute
      expect(result.taskResults.has('c')).toBe(true);
    });

    it('should respect maxConcurrency', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const tasks = Array.from({ length: 5 }, (_, i) =>
        createTask({
          ...createMockTaskOptions(`task-${i}`),
          execute: async () => {
            concurrentCount++;
            maxConcurrent = Math.max(maxConcurrent, concurrentCount);
            await delay(50);
            concurrentCount--;
            return { success: true, durationMs: 50 };
          },
        })
      );

      const plan = scheduleIntoWaves(tasks);
      await executePlan(plan, { maxConcurrency: 2 });

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should handle task timeout', async () => {
      const tasks = [
        createTask({
          ...createMockTaskOptions('slow'),
          timeoutMs: 50,
          execute: async () => {
            await delay(100);
            return { success: true, durationMs: 100 };
          },
        }),
      ];

      const plan = scheduleIntoWaves(tasks);
      const result = await executePlan(plan);

      expect(result.success).toBe(false);
      expect(result.failedTasks).toContain('slow');
    });

    it('should retry failed tasks', async () => {
      let attempts = 0;
      const tasks = [
        createTask({
          ...createMockTaskOptions('flaky'),
          maxRetries: 2,
          execute: async () => {
            attempts++;
            if (attempts < 3) {
              throw new Error('Temporary failure');
            }
            return { success: true, durationMs: 10 };
          },
        }),
      ];

      const plan = scheduleIntoWaves(tasks);
      const result = await executePlan(plan);

      expect(result.success).toBe(true);
      expect(attempts).toBe(3); // Initial + 2 retries
    });

    it('should call callbacks', async () => {
      const onTaskComplete = jest.fn();
      const onTaskFailed = jest.fn();
      const onWaveStart = jest.fn();
      const onWaveComplete = jest.fn();

      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask({
          ...createMockTaskOptions('b'),
          execute: async () => ({ success: false, error: 'Failed', durationMs: 10 }),
        }),
      ];

      const plan = scheduleIntoWaves(tasks);
      await executePlan(plan, {
        onTaskComplete,
        onTaskFailed,
        onWaveStart,
        onWaveComplete,
      });

      expect(onWaveStart).toHaveBeenCalled();
      expect(onWaveComplete).toHaveBeenCalled();
      expect(onTaskComplete).toHaveBeenCalled();
      expect(onTaskFailed).toHaveBeenCalled();
    });

    it('should track execution duration', async () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
      ];

      const plan = scheduleIntoWaves(tasks);
      const result = await executePlan(plan);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('executePartial', () => {
    it('should execute only specified tasks', async () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask(createMockTaskOptions('b')),
        createTask(createMockTaskOptions('c')),
      ];

      const plan = scheduleIntoWaves(tasks);
      const result = await executePartial(plan, ['a', 'c']);

      expect(result.success).toBe(true);
      expect(result.taskResults.has('a')).toBe(true);
      expect(result.taskResults.has('b')).toBe(false);
      expect(result.taskResults.has('c')).toBe(true);
    });

    it('should return error for empty task list', async () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
      ];

      const plan = scheduleIntoWaves(tasks);
      const result = await executePartial(plan, []);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No tasks');
    });
  });

  describe('getExecutionProgress', () => {
    it('should calculate progress correctly', () => {
      const tasks = [
        createTask(createMockTaskOptions('a')),
        createTask(createMockTaskOptions('b')),
        createTask(createMockTaskOptions('c')),
      ];

      const plan = scheduleIntoWaves(tasks);

      // Simulate progress
      tasks[0].status = 'completed';
      tasks[1].status = 'running';
      tasks[2].status = 'pending';

      const executionState: ExecutionState = {
        planId: plan.id,
        currentWave: 0,
        taskStatuses: new Map([
          ['a', 'completed'],
          ['b', 'running'],
          ['c', 'pending'],
        ]),
        taskResults: new Map(),
        startedAt: new Date(),
        updatedAt: new Date(),
      };

      const progress = getExecutionProgress(plan, executionState);

      expect(progress.totalTasks).toBe(3);
      expect(progress.completedTasks).toBe(1);
      expect(progress.runningTasks).toBe(1);
      expect(progress.pendingTasks).toBe(1);
      expect(progress.percentage).toBeCloseTo(33.33, 0);
    });
  });

  describe('retryTask', () => {
    it('should reset task state and retry', async () => {
      let attempts = 0;
      const task = createTask({
        ...createMockTaskOptions('retry-test'),
        execute: async () => {
          attempts++;
          return { success: true, durationMs: 10 };
        },
      });

      task.status = 'failed';
      task.error = 'Previous error';
      task.retryCount = 2;

      await retryTask(task);

      expect(task.status).toBe('completed');
      expect(task.error).toBeUndefined();
      expect(attempts).toBe(1);
    });
  });

  describe('exportExecutionState', () => {
    it('should serialize state correctly', () => {
      const state: ExecutionState = {
        planId: 'plan-123',
        currentWave: 2,
        taskStatuses: new Map([
          ['a', 'completed'],
          ['b', 'running'],
        ]),
        taskResults: new Map([
          ['a', { success: true, durationMs: 100 }],
        ]),
        startedAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      const exported = exportExecutionState(state);

      expect(exported.planId).toBe('plan-123');
      expect(exported.currentWave).toBe(2);
      expect(Array.isArray(exported.taskStatuses)).toBe(true);
      expect(Array.isArray(exported.taskResults)).toBe(true);
    });
  });

  describe('importExecutionState', () => {
    it('should deserialize state correctly', () => {
      const data = {
        planId: 'plan-123',
        currentWave: 2,
        taskStatuses: [['a', 'completed']],
        taskResults: [['a', { success: true, durationMs: 100 }]],
        startedAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      const state = importExecutionState(data);

      expect(state.planId).toBe('plan-123');
      expect(state.currentWave).toBe(2);
      expect(state.taskStatuses).toBeInstanceOf(Map);
      expect(state.taskResults).toBeInstanceOf(Map);
      expect(state.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('DEFAULT_EXECUTION_OPTIONS', () => {
    it('should have expected defaults', () => {
      expect(DEFAULT_EXECUTION_OPTIONS.continueOnFailure).toBe(false);
      expect(DEFAULT_EXECUTION_OPTIONS.maxConcurrency).toBe(Infinity);
      expect(DEFAULT_EXECUTION_OPTIONS.globalTimeoutMs).toBe(0);
      expect(DEFAULT_EXECUTION_OPTIONS.waveDelayMs).toBe(0);
      expect(typeof DEFAULT_EXECUTION_OPTIONS.onTaskComplete).toBe('function');
    });
  });
});

// Helper function
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
