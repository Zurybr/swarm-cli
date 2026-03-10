/**
 * Type tests for wave execution system
 */

import {
  TaskStatus,
  Wave,
  WaveTask,
  ExecutionPlan,
  DependencyGraph,
  CreateTaskOptions,
  SchedulerOptions,
  ExecutionOptions,
} from '../types';

describe('Wave Types', () => {
  describe('TaskStatus', () => {
    it('should have all expected statuses', () => {
      const statuses: TaskStatus[] = [
        'pending',
        'ready',
        'running',
        'completed',
        'failed',
        'skipped',
        'cancelled',
      ];

      for (const status of statuses) {
        expect(typeof status).toBe('string');
      }
    });
  });

  describe('WaveTask interface', () => {
    it('should create a valid WaveTask', () => {
      const task: WaveTask = {
        id: 'test-task',
        name: 'Test Task',
        description: 'A test task',
        dependencies: [],
        dependents: [],
        status: 'pending',
        waveNumber: 0,
        execute: async () => ({
          success: true,
          durationMs: 100,
        }),
        priority: 1,
        maxRetries: 0,
        retryCount: 0,
        timeoutMs: 30000,
      };

      expect(task.id).toBe('test-task');
      expect(task.name).toBe('Test Task');
      expect(task.status).toBe('pending');
      expect(typeof task.execute).toBe('function');
    });
  });

  describe('Wave interface', () => {
    it('should create a valid Wave', () => {
      const task: WaveTask = {
        id: 'task-1',
        name: 'Task 1',
        dependencies: [],
        dependents: [],
        status: 'pending',
        waveNumber: 0,
        execute: async () => ({ success: true, durationMs: 100 }),
        priority: 0,
        maxRetries: 0,
        retryCount: 0,
        timeoutMs: 30000,
      };

      const wave: Wave = {
        number: 0,
        tasks: [task],
        status: 'pending',
      };

      expect(wave.number).toBe(0);
      expect(wave.tasks).toHaveLength(1);
      expect(wave.status).toBe('pending');
    });
  });

  describe('ExecutionPlan interface', () => {
    it('should create a valid ExecutionPlan', () => {
      const plan: ExecutionPlan = {
        id: 'plan-1',
        waves: [],
        totalTasks: 0,
        taskToWave: new Map(),
        createdAt: new Date(),
        status: 'pending',
      };

      expect(plan.id).toBe('plan-1');
      expect(plan.totalTasks).toBe(0);
      expect(plan.status).toBe('pending');
    });
  });

  describe('DependencyGraph interface', () => {
    it('should create a valid DependencyGraph', () => {
      const graph: DependencyGraph = {
        nodes: new Map(),
        roots: new Set(),
        leaves: new Set(),
        validated: false,
        isAcyclic: false,
      };

      expect(graph.nodes.size).toBe(0);
      expect(graph.validated).toBe(false);
    });
  });

  describe('CreateTaskOptions interface', () => {
    it('should accept valid task options', () => {
      const options: CreateTaskOptions = {
        id: 'custom-id',
        name: 'Custom Task',
        description: 'A custom task',
        dependencies: ['dep-1', 'dep-2'],
        priority: 5,
        maxRetries: 3,
        timeoutMs: 5000,
        metadata: { key: 'value' },
        execute: async () => ({ success: true, durationMs: 100 }),
      };

      expect(options.id).toBe('custom-id');
      expect(options.priority).toBe(5);
      expect(options.metadata).toEqual({ key: 'value' });
    });
  });

  describe('SchedulerOptions interface', () => {
    it('should accept valid scheduler options', () => {
      const options: SchedulerOptions = {
        maxParallelTasks: 5,
        respectPriority: true,
        minTasksPerWave: 2,
      };

      expect(options.maxParallelTasks).toBe(5);
      expect(options.respectPriority).toBe(true);
    });
  });

  describe('ExecutionOptions interface', () => {
    it('should accept valid execution options', () => {
      const onTaskComplete = jest.fn();
      const onTaskFailed = jest.fn();
      const onWaveComplete = jest.fn();
      const onWaveStart = jest.fn();

      const options: ExecutionOptions = {
        continueOnFailure: true,
        maxConcurrency: 10,
        globalTimeoutMs: 60000,
        waveDelayMs: 1000,
        onTaskComplete,
        onTaskFailed,
        onWaveComplete,
        onWaveStart,
      };

      expect(options.continueOnFailure).toBe(true);
      expect(options.maxConcurrency).toBe(10);
      expect(options.onTaskComplete).toBe(onTaskComplete);
    });
  });
});
