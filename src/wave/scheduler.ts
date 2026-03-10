/**
 * Wave Scheduling Algorithm
 *
 * Schedules tasks into waves based on their dependencies.
 * Tasks in the same wave have no dependencies on each other and can run in parallel.
 */

import {
  TaskId,
  WaveTask,
  Wave,
  ExecutionPlan,
  SchedulerOptions,
  DependencyGraph,
} from './types';
import {
  buildDependencyGraph,
  validateGraph,
  getLongestPathFromRoots,
  topologicalSort,
} from './dag';

/**
 * Default scheduler options
 */
export const DEFAULT_SCHEDULER_OPTIONS: Required<SchedulerOptions> = {
  maxParallelTasks: Infinity,
  respectPriority: true,
  minTasksPerWave: 1,
};

/**
 * Create a task from options
 */
export function createTask(
  options: {
    id?: TaskId;
    name: string;
    description?: string;
    dependencies?: TaskId[];
    priority?: number;
    maxRetries?: number;
    timeoutMs?: number;
    metadata?: Record<string, unknown>;
    execute: () => Promise<{ success: boolean; data?: unknown; error?: string; durationMs: number }>;
  }
): WaveTask {
  return {
    id: options.id || generateTaskId(),
    name: options.name,
    description: options.description,
    dependencies: options.dependencies || [],
    dependents: [],
    status: 'pending',
    waveNumber: -1,
    execute: options.execute,
    priority: options.priority ?? 0,
    maxRetries: options.maxRetries ?? 0,
    retryCount: 0,
    timeoutMs: options.timeoutMs ?? 30000,
    metadata: options.metadata,
  };
}

/**
 * Generate a unique task ID
 */
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Schedule tasks into waves using the longest-path algorithm.
 *
 * Each task is assigned to the earliest possible wave where all its dependencies
 * have been completed. This maximizes parallelism while respecting dependencies.
 */
export function scheduleIntoWaves(
  tasks: WaveTask[],
  options: SchedulerOptions = {}
): ExecutionPlan {
  if (tasks.length === 0) {
    throw new Error('No tasks to schedule');
  }

  const opts = { ...DEFAULT_SCHEDULER_OPTIONS, ...options };

  // Build dependency graph
  const graph = buildDependencyGraph(tasks);

  // Validate no cycles
  const isValid = validateGraph(graph);
  if (!isValid) {
    const sortResult = topologicalSort(graph);
    throw new Error(`Cannot schedule tasks with cyclic dependencies: ${sortResult.error}`);
  }

  // Calculate wave number for each task based on longest path from roots
  const taskToWave = new Map<TaskId, number>();

  for (const task of tasks) {
    const waveNumber = getLongestPathFromRoots(graph, task.id);
    taskToWave.set(task.id, waveNumber);
    task.waveNumber = waveNumber;
  }

  // Group tasks by wave
  const waveMap = new Map<number, WaveTask[]>();
  for (const task of tasks) {
    const waveNum = taskToWave.get(task.id)!;
    if (!waveMap.has(waveNum)) {
      waveMap.set(waveNum, []);
    }
    waveMap.get(waveNum)!.push(task);
  }

  // Sort waves by number
  const sortedWaveNumbers = Array.from(waveMap.keys()).sort((a, b) => a - b);

  // Create wave objects
  const waves: Wave[] = [];
  for (const num of sortedWaveNumbers) {
    let waveTasks = waveMap.get(num)!;

    // Sort by priority if enabled
    if (opts.respectPriority) {
      waveTasks = waveTasks.sort((a, b) => b.priority - a.priority);
    }

    // Limit parallel tasks if needed
    if (opts.maxParallelTasks !== Infinity && waveTasks.length > opts.maxParallelTasks) {
      // Split into multiple waves
      let splitIndex = 0;
      for (let i = 0; i < waveTasks.length; i += opts.maxParallelTasks) {
        waves.push({
          number: num + splitIndex * 0.001, // Use fractional numbers for split waves
          tasks: waveTasks.slice(i, i + opts.maxParallelTasks),
          status: 'pending',
        });
        splitIndex++;
      }
    } else {
      waves.push({
        number: num,
        tasks: waveTasks,
        status: 'pending',
      });
    }
  }

  // Flatten in case we split waves
  const flattenedWaves = waves.flat();

  // Re-number waves to be sequential integers
  flattenedWaves.forEach((wave, index) => {
    wave.number = index;
    for (const task of wave.tasks) {
      task.waveNumber = index;
    }
  });

  return {
    id: generatePlanId(),
    waves: flattenedWaves,
    totalTasks: tasks.length,
    taskToWave,
    createdAt: new Date(),
    status: 'pending',
  };
}

/**
 * Generate a unique plan ID
 */
function generatePlanId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Optimize the execution plan by merging small waves
 */
export function optimizePlan(
  plan: ExecutionPlan,
  minTasksPerWave: number = 2
): ExecutionPlan {
  if (plan.waves.length <= 1) return plan;

  const optimizedWaves: Wave[] = [];
  let currentWave: Wave = { ...plan.waves[0], tasks: [...plan.waves[0].tasks] };

  for (let i = 1; i < plan.waves.length; i++) {
    const nextWave = plan.waves[i];

    // Check if we can merge (no dependencies between waves)
    const canMerge = currentWave.tasks.length < minTasksPerWave;

    if (canMerge) {
      // Merge tasks
      currentWave.tasks.push(...nextWave.tasks);
    } else {
      optimizedWaves.push(currentWave);
      currentWave = { ...nextWave, tasks: [...nextWave.tasks] };
    }
  }

  optimizedWaves.push(currentWave);

  // Re-number waves
  optimizedWaves.forEach((wave, index) => {
    wave.number = index;
    for (const task of wave.tasks) {
      task.waveNumber = index;
      plan.taskToWave.set(task.id, index);
    }
  });

  return {
    ...plan,
    waves: optimizedWaves,
  };
}

/**
 * Get tasks that are ready to execute (all dependencies met)
 */
export function getReadyTasks(
  tasks: WaveTask[],
  completedTasks: Set<TaskId>
): WaveTask[] {
  return tasks.filter((task) => {
    if (task.status !== 'pending') return false;
    return task.dependencies.every((depId) => completedTasks.has(depId));
  });
}

/**
 * Calculate execution metrics for a plan
 */
export function calculatePlanMetrics(plan: ExecutionPlan): {
  totalWaves: number;
  maxParallelism: number;
  averageTasksPerWave: number;
  criticalPathLength: number;
} {
  const totalWaves = plan.waves.length;
  const maxParallelism = Math.max(...plan.waves.map((w) => w.tasks.length));
  const averageTasksPerWave = plan.totalTasks / totalWaves;

  // Critical path is the longest chain of dependent tasks
  let criticalPathLength = 0;
  for (const task of plan.waves.flatMap((w) => w.tasks)) {
    const pathLength = calculatePathLength(task, plan);
    criticalPathLength = Math.max(criticalPathLength, pathLength);
  }

  return {
    totalWaves,
    maxParallelism,
    averageTasksPerWave,
    criticalPathLength,
  };
}

/**
 * Calculate the length of the dependency chain ending at this task
 */
function calculatePathLength(task: WaveTask, plan: ExecutionPlan): number {
  if (task.dependencies.length === 0) return 1;

  let maxLength = 0;
  for (const depId of task.dependencies) {
    // Find the dependency task
    for (const wave of plan.waves) {
      const depTask = wave.tasks.find((t) => t.id === depId);
      if (depTask) {
        maxLength = Math.max(maxLength, calculatePathLength(depTask, plan));
        break;
      }
    }
  }

  return maxLength + 1;
}

/**
 * Check if a plan can be executed (all dependencies are satisfied)
 */
export function validatePlan(plan: ExecutionPlan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const taskIds = new Set<TaskId>();

  // Collect all task IDs
  for (const wave of plan.waves) {
    for (const task of wave.tasks) {
      if (taskIds.has(task.id)) {
        errors.push(`Duplicate task ID: ${task.id}`);
      }
      taskIds.add(task.id);
    }
  }

  // Check all dependencies exist
  for (const wave of plan.waves) {
    for (const task of wave.tasks) {
      for (const depId of task.dependencies) {
        if (!taskIds.has(depId)) {
          errors.push(`Task ${task.id} depends on unknown task: ${depId}`);
        }
      }
    }
  }

  // Check wave assignments are correct
  for (const wave of plan.waves) {
    for (const task of wave.tasks) {
      const expectedWave = plan.taskToWave.get(task.id);
      if (expectedWave !== wave.number) {
        errors.push(
          `Task ${task.id} is in wave ${wave.number} but mapped to wave ${expectedWave}`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Serialize a plan to JSON
 */
export function serializePlan(plan: ExecutionPlan): string {
  const serialized = {
    id: plan.id,
    waves: plan.waves.map((wave) => ({
      number: wave.number,
      tasks: wave.tasks.map((task) => ({
        id: task.id,
        name: task.name,
        description: task.description,
        dependencies: task.dependencies,
        priority: task.priority,
        waveNumber: task.waveNumber,
        status: task.status,
        maxRetries: task.maxRetries,
        timeoutMs: task.timeoutMs,
        metadata: task.metadata,
      })),
      status: wave.status,
    })),
    totalTasks: plan.totalTasks,
    taskToWave: Array.from(plan.taskToWave.entries()),
    createdAt: plan.createdAt.toISOString(),
    status: plan.status,
  };

  return JSON.stringify(serialized, null, 2);
}
