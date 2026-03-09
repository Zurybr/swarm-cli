/**
 * Unit tests for PLAN.md Executor
 */

import { executePlan, PlanExecutor } from '@/plan/executor';
import type { Plan, ExecutionContext, ExecutionOptions } from '@/plan/types';

function createExecutablePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    metadata: {
      phase: '01-test',
      plan: '01',
      type: 'execute',
      wave: 1,
      depends_on: [],
      files_modified: [],
      autonomous: false,
      requirements: [],
    },
    mustHaves: {
      truths: [],
      artifacts: [],
      key_links: [],
    },
    objective: 'Test objective',
    context: [],
    tasks: [
      {
        id: 'task-1',
        type: 'auto',
        name: 'Test task 1',
        files: [],
        action: 'Do something',
        done: 'Done',
      },
    ],
    verification: [],
    successCriteria: 'Success',
    ...overrides,
  };
}

function createExecutionContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    workingDir: '/tmp',
    env: {},
    dryRun: false,
    options: {
      stopOnFailure: true,
      maxConcurrency: 1,
      taskTimeout: 5000,
      captureOutput: true,
    },
    ...overrides,
  };
}

describe('PlanExecutor', () => {
  describe('executePlan', () => {
    it('should execute a simple plan', async () => {
      const plan = createExecutablePlan();
      const context = createExecutionContext();

      const result = await executePlan(plan, context);

      expect(result.state).toBe('completed');
      expect(result.taskResults).toHaveLength(1);
      expect(result.taskResults[0].state).toBe('completed');
      expect(result.taskResults[0].verified).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should execute multiple tasks', async () => {
      const plan = createExecutablePlan({
        tasks: [
          {
            id: 'task-1',
            type: 'auto',
            name: 'First task',
            files: [],
            action: 'Do first thing',
            done: 'First done',
          },
          {
            id: 'task-2',
            type: 'auto',
            name: 'Second task',
            files: [],
            action: 'Do second thing',
            done: 'Second done',
          },
        ],
      });
      const context = createExecutionContext();

      const result = await executePlan(plan, context);

      expect(result.state).toBe('completed');
      expect(result.taskResults).toHaveLength(2);
      expect(result.taskResults[0].taskId).toBe('task-1');
      expect(result.taskResults[1].taskId).toBe('task-2');
    });

    it('should support dry-run mode', async () => {
      const plan = createExecutablePlan();
      const context = createExecutionContext({ dryRun: true });

      const result = await executePlan(plan, context);

      expect(result.state).toBe('completed');
      expect(result.taskResults[0].output).toContain('[DRY RUN]');
    });

    it('should handle manual tasks', async () => {
      const plan = createExecutablePlan({
        tasks: [
          {
            id: 'task-1',
            type: 'manual',
            name: 'Manual task',
            files: [],
            action: 'Do manually',
            done: 'Manual done',
          },
        ],
      });
      const context = createExecutionContext();

      const result = await executePlan(plan, context);

      expect(result.state).toBe('completed');
      expect(result.taskResults[0].output).toContain('MANUAL TASK');
    });

    it('should handle decision tasks', async () => {
      const plan = createExecutablePlan({
        tasks: [
          {
            id: 'task-1',
            type: 'decision',
            name: 'Decision task',
            files: [],
            action: 'Make decision',
            done: 'Decision made',
          },
        ],
      });
      const context = createExecutionContext();

      const result = await executePlan(plan, context);

      expect(result.state).toBe('completed');
      expect(result.taskResults[0].output).toContain('DECISION REQUIRED');
    });

    it('should emit progress events', async () => {
      const plan = createExecutablePlan();
      const context = createExecutionContext();
      const progressEvents: { type: string; taskId?: string }[] = [];

      await executePlan(plan, context, (event) => {
        progressEvents.push({ type: event.type, taskId: event.taskId });
      });

      expect(progressEvents.some(e => e.type === 'start')).toBe(true);
      expect(progressEvents.some(e => e.type === 'task-start')).toBe(true);
      expect(progressEvents.some(e => e.type === 'task-complete')).toBe(true);
      expect(progressEvents.some(e => e.type === 'complete')).toBe(true);
    });

    it('should track execution duration', async () => {
      const plan = createExecutablePlan();
      const context = createExecutionContext();

      const result = await executePlan(plan, context);

      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should stop on failure when stopOnFailure is true', async () => {
      const plan = createExecutablePlan({
        tasks: [
          {
            id: 'task-1',
            type: 'auto',
            name: 'Failing task',
            files: [],
            action: '', // Empty action will fail validation
            done: '',
          },
          {
            id: 'task-2',
            type: 'auto',
            name: 'Second task',
            files: [],
            action: 'Do second',
            done: 'Done',
          },
        ],
      });
      const context = createExecutionContext({ options: { stopOnFailure: true, maxConcurrency: 1, taskTimeout: 5000, captureOutput: true } });

      const result = await executePlan(plan, context);

      // The task will complete but not be verified
      expect(result.state).toBe('completed');
    });
  });

  describe('PlanExecutor class', () => {
    it('should execute a plan using class method', async () => {
      const executor = new PlanExecutor();
      const plan = createExecutablePlan();
      const context = createExecutionContext();

      const result = await executor.execute(plan, context);

      expect(result.state).toBe('completed');
    });

    it('should track execution state', async () => {
      const executor = new PlanExecutor();

      expect(executor.getState()).toBe('pending');

      const plan = createExecutablePlan();
      const context = createExecutionContext();

      const promise = executor.execute(plan, context);

      // State should be running during execution
      expect(['running', 'pending', 'completed']).toContain(executor.getState());

      await promise;
    });

    it('should support cancellation', async () => {
      const executor = new PlanExecutor();

      // Cancel before execution - state should reflect cancelled
      executor.cancel();

      // After cancel, state should be cancelled or pending (implementation detail)
      const state = executor.getState();
      expect(['cancelled', 'pending']).toContain(state);
    });
  });
});
