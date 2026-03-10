/**
 * Parallel Execution Engine
 *
 * Executes waves of tasks in parallel while respecting dependencies.
 */

import {
  TaskId,
  WaveTask,
  Wave,
  ExecutionPlan,
  ExecutionOptions,
  ExecutionResult,
  TaskResult,
  TaskStatus,
  ExecutionState,
} from './types';
import { Logger } from '../utils/logger';

const logger = new Logger('WaveExecutor');

/**
 * Default execution options
 */
export const DEFAULT_EXECUTION_OPTIONS: Required<ExecutionOptions> = {
  continueOnFailure: false,
  maxConcurrency: Infinity,
  globalTimeoutMs: 0,
  waveDelayMs: 0,
  onTaskComplete: () => {},
  onTaskFailed: () => {},
  onWaveComplete: () => {},
  onWaveStart: () => {},
};

/**
 * Execute a single task with timeout and retry logic
 */
async function executeTask(
  task: WaveTask,
  options: ExecutionOptions
): Promise<TaskResult> {
  const startTime = Date.now();
  task.status = 'running';
  task.startedAt = new Date();

  const executeWithTimeout = async (): Promise<TaskResult> => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out after ${task.timeoutMs}ms`));
      }, task.timeoutMs);

      task
        .execute()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= task.maxRetries; attempt++) {
    try {
      const result = await executeWithTimeout();
      task.status = result.success ? 'completed' : 'failed';
      task.completedAt = new Date();
      task.retryCount = attempt;

      return {
        ...result,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      task.error = lastError.message;

      if (attempt < task.maxRetries) {
        logger.warn(`Task ${task.id} failed (attempt ${attempt + 1}), retrying...`);
        // Exponential backoff
        const delayMs = Math.pow(2, attempt) * 100;
        await sleep(delayMs);
      }
    }
  }

  task.status = 'failed';
  task.completedAt = new Date();
  task.retryCount = task.maxRetries;

  return {
    success: false,
    error: lastError?.message || 'Task failed after all retries',
    durationMs: Date.now() - startTime,
  };
}

/**
 * Execute a wave of tasks in parallel
 */
async function executeWave(
  wave: Wave,
  options: Required<ExecutionOptions>,
  executionState: ExecutionState
): Promise<{ success: boolean; results: Map<TaskId, TaskResult> }> {
  logger.info(`Executing wave ${wave.number} with ${wave.tasks.length} tasks`);

  wave.status = 'running';
  wave.startedAt = new Date();
  options.onWaveStart(wave);

  const results = new Map<TaskId, TaskResult>();

  // Determine concurrency limit
  const concurrencyLimit = Math.min(
    options.maxConcurrency,
    wave.tasks.length
  );

  if (concurrencyLimit >= wave.tasks.length) {
    // Run all tasks in parallel
    const taskPromises = wave.tasks.map(async (task) => {
      const result = await executeTask(task, options);
      results.set(task.id, result);
      executionState.taskResults.set(task.id, result);
      executionState.taskStatuses.set(task.id, task.status);

      if (result.success) {
        options.onTaskComplete(task, result);
      } else {
        options.onTaskFailed(task, new Error(result.error || 'Task failed'));
      }

      return { task, result };
    });

    await Promise.all(taskPromises);
  } else {
    // Run with limited concurrency using a pool
    const taskQueue = [...wave.tasks];
    const runningTasks: Promise<void>[] = [];

    while (taskQueue.length > 0 || runningTasks.length > 0) {
      // Start new tasks up to the concurrency limit
      while (runningTasks.length < concurrencyLimit && taskQueue.length > 0) {
        const task = taskQueue.shift()!;
        const taskPromise = executeTask(task, options).then((result) => {
          results.set(task.id, result);
          executionState.taskResults.set(task.id, result);
          executionState.taskStatuses.set(task.id, task.status);

          if (result.success) {
            options.onTaskComplete(task, result);
          } else {
            options.onTaskFailed(task, new Error(result.error || 'Task failed'));
          }
        });
        runningTasks.push(taskPromise);
      }

      // Wait for at least one task to complete
      if (runningTasks.length > 0) {
        await Promise.race(runningTasks);
        // Remove completed tasks from running list
        for (let i = runningTasks.length - 1; i >= 0; i--) {
          const promise = runningTasks[i];
          // Check if completed by seeing if we have a result
          // This is a bit hacky but works for our purposes
        }
        // Actually, let's just use Promise.allSettled on a batch
        const batch = runningTasks.splice(0, runningTasks.length);
        await Promise.allSettled(batch);
      }
    }
  }

  // Check if all tasks succeeded
  const allSucceeded = Array.from(results.values()).every((r) => r.success);
  wave.status = allSucceeded ? 'completed' : 'failed';
  wave.completedAt = new Date();
  options.onWaveComplete(wave);

  return { success: allSucceeded, results };
}

/**
 * Execute an entire execution plan
 */
export async function executePlan(
  plan: ExecutionPlan,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> {
  const opts = { ...DEFAULT_EXECUTION_OPTIONS, ...options };
  const startTime = Date.now();
  const startedAt = new Date();

  logger.info(`Starting execution of plan ${plan.id} with ${plan.totalTasks} tasks`);

  plan.status = 'running';

  // Initialize execution state
  const executionState: ExecutionState = {
    planId: plan.id,
    currentWave: 0,
    taskStatuses: new Map(),
    taskResults: new Map(),
    startedAt,
    updatedAt: startedAt,
  };

  const taskResults = new Map<TaskId, TaskResult>();
  const failedTasks: TaskId[] = [];
  const skippedTasks: TaskId[] = [];

  // Set up global timeout if specified
  let timeoutId: NodeJS.Timeout | undefined;
  let timedOut = false;

  if (opts.globalTimeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      logger.error(`Plan ${plan.id} timed out after ${opts.globalTimeoutMs}ms`);
    }, opts.globalTimeoutMs);
  }

  try {
    // Execute waves sequentially
    for (const wave of plan.waves) {
      if (timedOut) {
        // Mark remaining tasks as skipped
        for (const task of wave.tasks) {
          task.status = 'skipped';
          skippedTasks.push(task.id);
        }
        continue;
      }

      executionState.currentWave = wave.number;

      // Check if any dependencies failed in previous waves
      const shouldSkipWave = wave.tasks.some((task) =>
        task.dependencies.some((depId) => failedTasks.includes(depId))
      );

      if (shouldSkipWave && !opts.continueOnFailure) {
        logger.warn(`Skipping wave ${wave.number} due to failed dependencies`);
        for (const task of wave.tasks) {
          task.status = 'skipped';
          skippedTasks.push(task.id);
        }
        continue;
      }

      // Execute the wave
      const { success, results } = await executeWave(wave, opts, executionState);

      // Collect results
      for (const [taskId, result] of results) {
        taskResults.set(taskId, result);
        if (!result.success) {
          failedTasks.push(taskId);
        }
      }

      // Handle wave failure
      if (!success && !opts.continueOnFailure) {
        logger.error(`Wave ${wave.number} failed, aborting execution`);
        // Mark remaining tasks in future waves as skipped
        const currentWaveIndex = plan.waves.indexOf(wave);
        for (let i = currentWaveIndex + 1; i < plan.waves.length; i++) {
          for (const task of plan.waves[i].tasks) {
            task.status = 'skipped';
            skippedTasks.push(task.id);
          }
        }
        break;
      }

      // Delay between waves if specified
      if (opts.waveDelayMs > 0 && wave.number < plan.waves.length - 1) {
        await sleep(opts.waveDelayMs);
      }

      executionState.updatedAt = new Date();
    }
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  const completedAt = new Date();
  const durationMs = Date.now() - startTime;

  // Determine overall success
  const success = failedTasks.length === 0 && !timedOut;
  plan.status = success ? 'completed' : timedOut ? 'cancelled' : 'failed';

  logger.info(
    `Execution of plan ${plan.id} ${success ? 'completed' : 'failed'} in ${durationMs}ms`
  );

  return {
    success,
    taskResults,
    failedTasks,
    skippedTasks,
    durationMs,
    startedAt,
    completedAt,
    error: timedOut
      ? `Execution timed out after ${opts.globalTimeoutMs}ms`
      : failedTasks.length > 0
        ? `${failedTasks.length} task(s) failed`
        : undefined,
  };
}

/**
 * Execute a subset of tasks from a plan
 */
export async function executePartial(
  plan: ExecutionPlan,
  taskIds: TaskId[],
  options: ExecutionOptions = {}
): Promise<ExecutionResult> {
  const opts = { ...DEFAULT_EXECUTION_OPTIONS, ...options };
  const startTime = Date.now();
  const startedAt = new Date();

  // Filter to only specified tasks
  const allowedTasks = new Set(taskIds);
  const filteredWaves = plan.waves
    .map((wave) => ({
      ...wave,
      tasks: wave.tasks.filter((t) => allowedTasks.has(t.id)),
    }))
    .filter((wave) => wave.tasks.length > 0);

  if (filteredWaves.length === 0) {
    return {
      success: false,
      taskResults: new Map(),
      failedTasks: [],
      skippedTasks: [],
      durationMs: 0,
      startedAt,
      completedAt: new Date(),
      error: 'No tasks to execute',
    };
  }

  // Create a modified plan
  const partialPlan: ExecutionPlan = {
    ...plan,
    waves: filteredWaves,
    totalTasks: filteredWaves.reduce((sum, w) => sum + w.tasks.length, 0),
  };

  return executePlan(partialPlan, opts);
}

/**
 * Cancel a running execution
 */
export function cancelExecution(
  plan: ExecutionPlan,
  executionState: ExecutionState
): void {
  logger.info(`Cancelling execution of plan ${plan.id}`);
  plan.status = 'cancelled';

  // Mark pending tasks as cancelled
  for (const wave of plan.waves) {
    for (const task of wave.tasks) {
      if (task.status === 'pending' || task.status === 'ready') {
        task.status = 'cancelled';
        executionState.taskStatuses.set(task.id, 'cancelled');
      }
    }
  }
}

/**
 * Get execution progress
 */
export function getExecutionProgress(
  plan: ExecutionPlan,
  executionState: ExecutionState
): {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  pendingTasks: number;
  percentage: number;
  currentWave: number;
  totalWaves: number;
} {
  let completedTasks = 0;
  let failedTasks = 0;
  let runningTasks = 0;
  let pendingTasks = 0;

  for (const wave of plan.waves) {
    for (const task of wave.tasks) {
      switch (task.status) {
        case 'completed':
          completedTasks++;
          break;
        case 'failed':
          failedTasks++;
          break;
        case 'running':
          runningTasks++;
          break;
        case 'pending':
        case 'ready':
          pendingTasks++;
          break;
      }
    }
  }

  const totalTasks = plan.totalTasks;
  const percentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return {
    totalTasks,
    completedTasks,
    failedTasks,
    runningTasks,
    pendingTasks,
    percentage,
    currentWave: executionState.currentWave,
    totalWaves: plan.waves.length,
  };
}

/**
 * Utility function to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a failed task
 */
export async function retryTask(
  task: WaveTask,
  options: ExecutionOptions = {}
): Promise<TaskResult> {
  // Reset task state
  task.status = 'pending';
  task.error = undefined;
  task.startedAt = undefined;
  task.completedAt = undefined;

  return executeTask(task, options);
}

/**
 * Export execution state for persistence
 */
export function exportExecutionState(
  executionState: ExecutionState
): Record<string, unknown> {
  return {
    planId: executionState.planId,
    currentWave: executionState.currentWave,
    taskStatuses: Array.from(executionState.taskStatuses.entries()),
    taskResults: Array.from(executionState.taskResults.entries()),
    startedAt: executionState.startedAt.toISOString(),
    updatedAt: executionState.updatedAt.toISOString(),
  };
}

/**
 * Import execution state from persisted data
 */
export function importExecutionState(
  data: Record<string, unknown>
): ExecutionState {
  return {
    planId: data.planId as string,
    currentWave: data.currentWave as number,
    taskStatuses: new Map(data.taskStatuses as [TaskId, TaskStatus][]),
    taskResults: new Map(data.taskResults as [TaskId, TaskResult][]),
    startedAt: new Date(data.startedAt as string),
    updatedAt: new Date(data.updatedAt as string),
  };
}
