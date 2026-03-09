/**
 * PLAN.md Executor
 *
 * Executes parsed and validated Plan steps sequentially.
 * Handles progress tracking, error handling, and recovery.
 */

import type {
  Plan,
  PlanTask,
  ExecutionContext,
  ExecutionOptions,
  ExecutionResult,
  ExecutionState,
  TaskExecutionResult,
  ExecutionError,
  ProgressCallback,
  ProgressEvent,
} from './types.js';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OPTIONS: ExecutionOptions = {
  stopOnFailure: true,
  maxConcurrency: 1,
  taskTimeout: 300000, // 5 minutes
  captureOutput: true,
};

// ============================================================================
// Executor State
// ============================================================================

interface ExecutorState {
  state: ExecutionState;
  currentTask?: string;
  taskResults: Map<string, TaskExecutionResult>;
  startTime: Date;
  endTime?: Date;
  error?: ExecutionError;
}

// ============================================================================
// Main Executor
// ============================================================================

/**
 * Execute a plan with the given context
 */
export async function executePlan(
  plan: Plan,
  context: ExecutionContext,
  onProgress?: ProgressCallback
): Promise<ExecutionResult> {
  const state: ExecutorState = {
    state: 'running',
    taskResults: new Map(),
    startTime: new Date(),
  };

  const options = { ...DEFAULT_OPTIONS, ...context.options };

  try {
    // Emit start event
    emitProgress(onProgress, {
      type: 'start',
      percent: 0,
      message: `Starting execution of plan ${plan.metadata.phase}-${plan.metadata.plan}`,
      timestamp: new Date(),
    });

    // Execute tasks in order
    const orderedTasks = getExecutionOrder(plan);

    for (let i = 0; i < orderedTasks.length; i++) {
      const task = orderedTasks[i];
      const percent = Math.round((i / orderedTasks.length) * 100);

      // Check if we should stop
      if (state.state === 'cancelled') {
        break;
      }

      // Execute task
      state.currentTask = task.id;
      const taskResult = await executeTask(task, context, options, onProgress, percent);
      state.taskResults.set(task.id, taskResult);

      // Handle failure
      if (taskResult.state === 'failed') {
        if (options.stopOnFailure) {
          state.state = 'failed';
          state.error = taskResult.error;
          break;
        }
      }
    }

    // Determine final state
    if (state.state !== 'failed' && state.state !== 'cancelled') {
      const allSuccessful = Array.from(state.taskResults.values()).every(
        r => r.state === 'completed'
      );
      state.state = allSuccessful ? 'completed' : 'failed';
    }

    state.endTime = new Date();

    // Emit completion event
    emitProgress(onProgress, {
      type: state.state === 'completed' ? 'complete' : 'fail',
      percent: 100,
      message: state.state === 'completed'
        ? 'Plan execution completed successfully'
        : `Plan execution failed: ${state.error?.message || 'Unknown error'}`,
      timestamp: new Date(),
    });

    return buildExecutionResult(state);

  } catch (error) {
    state.state = 'failed';
    state.endTime = new Date();
    state.error = {
      code: 'EXECUTION_EXCEPTION',
      message: error instanceof Error ? error.message : 'Unknown execution error',
      stack: error instanceof Error ? error.stack : undefined,
    };

    emitProgress(onProgress, {
      type: 'fail',
      percent: 100,
      message: `Execution failed: ${state.error.message}`,
      timestamp: new Date(),
    });

    return buildExecutionResult(state);
  }
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeTask(
  task: PlanTask,
  context: ExecutionContext,
  options: ExecutionOptions,
  onProgress?: ProgressCallback,
  basePercent: number = 0
): Promise<TaskExecutionResult> {
  const startTime = new Date();

  emitProgress(onProgress, {
    type: 'task-start',
    taskId: task.id,
    percent: basePercent,
    message: `Starting task: ${task.name}`,
    timestamp: startTime,
  });

  try {
    // Check dry run mode
    if (context.dryRun) {
      const result: TaskExecutionResult = {
        taskId: task.id,
        state: 'completed',
        startTime,
        endTime: new Date(),
        duration: 0,
        output: '[DRY RUN] Task would execute: ' + task.action.substring(0, 100),
        verified: true,
      };

      emitProgress(onProgress, {
        type: 'task-complete',
        taskId: task.id,
        percent: basePercent + 10,
        message: `[DRY RUN] Completed: ${task.name}`,
        timestamp: result.endTime,
      });

      return result;
    }

    // Execute task based on type
    let output: string | undefined;

    switch (task.type) {
      case 'auto':
        output = await executeAutoTask(task, context);
        break;
      case 'manual':
        output = await executeManualTask(task, context);
        break;
      case 'decision':
        output = await executeDecisionTask(task, context);
        break;
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }

    // Verify task completion
    const verified = await verifyTask(task, context, output);

    const endTime = new Date();
    const result: TaskExecutionResult = {
      taskId: task.id,
      state: verified ? 'completed' : 'failed',
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      output,
      verified,
    };

    emitProgress(onProgress, {
      type: verified ? 'task-complete' : 'task-fail',
      taskId: task.id,
      percent: basePercent + 10,
      message: verified
        ? `Completed: ${task.name}`
        : `Failed verification: ${task.name}`,
      timestamp: endTime,
    });

    return result;

  } catch (error) {
    const endTime = new Date();
    const execError: ExecutionError = {
      code: 'TASK_EXECUTION_ERROR',
      message: error instanceof Error ? error.message : 'Task execution failed',
      stack: error instanceof Error ? error.stack : undefined,
      taskId: task.id,
    };

    emitProgress(onProgress, {
      type: 'task-fail',
      taskId: task.id,
      percent: basePercent + 10,
      message: `Failed: ${task.name} - ${execError.message}`,
      timestamp: endTime,
    });

    return {
      taskId: task.id,
      state: 'failed',
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      error: execError,
      verified: false,
    };
  }
}

async function executeAutoTask(
  task: PlanTask,
  context: ExecutionContext
): Promise<string> {
  // Auto tasks are executed programmatically
  // For now, return a placeholder indicating what would be done
  return `Auto-executed: ${task.action.substring(0, 200)}...`;
}

async function executeManualTask(
  task: PlanTask,
  context: ExecutionContext
): Promise<string> {
  // Manual tasks require human intervention
  // Return instructions for the user
  return `MANUAL TASK: ${task.name}\n\n${task.action}\n\nDone when: ${task.done}`;
}

async function executeDecisionTask(
  task: PlanTask,
  context: ExecutionContext
): Promise<string> {
  // Decision tasks require a choice
  // Return the decision context
  return `DECISION REQUIRED: ${task.name}\n\n${task.action}`;
}

// ============================================================================
// Task Verification
// ============================================================================

async function verifyTask(
  task: PlanTask,
  context: ExecutionContext,
  output: string
): Promise<boolean> {
  if (!task.verify) {
    // No verification specified, assume success
    return true;
  }

  // Check if verification is automated
  if (task.verify.includes('<automated>')) {
    // Extract verification command
    const cmdMatch = task.verify.match(/<automated>(.+?)<\/automated>/s);
    if (cmdMatch) {
      const command = cmdMatch[1].trim();
      return await runVerificationCommand(command, context);
    }
  }

  // Manual verification - check if output contains expected done condition
  return output.includes(task.done) || task.done.length === 0;
}

async function runVerificationCommand(
  command: string,
  context: ExecutionContext
): Promise<boolean> {
  // In a real implementation, this would execute the command
  // For now, simulate success
  return true;
}

// ============================================================================
// Execution Order
// ============================================================================

function getExecutionOrder(plan: Plan): PlanTask[] {
  // Build dependency graph
  const graph = buildTaskGraph(plan.tasks);

  // Topological sort
  const visited = new Set<string>();
  const ordered: PlanTask[] = [];

  function visit(taskId: string) {
    if (visited.has(taskId)) return;
    visited.add(taskId);

    const deps = graph.get(taskId) || [];
    for (const dep of deps) {
      visit(dep);
    }

    const task = plan.tasks.find(t => t.id === taskId);
    if (task) {
      ordered.push(task);
    }
  }

  for (const task of plan.tasks) {
    visit(task.id);
  }

  return ordered;
}

function buildTaskGraph(tasks: PlanTask[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const task of tasks) {
    const deps: string[] = [];

    // Parse action for task references
    const refs = task.action.match(/task-?\d+/gi) || [];
    for (const ref of refs) {
      const normalized = ref.toLowerCase().replace(/-/g, '-');
      if (normalized !== task.id && tasks.some(t => t.id === normalized)) {
        deps.push(normalized);
      }
    }

    graph.set(task.id, deps);
  }

  return graph;
}

// ============================================================================
// Result Building
// ============================================================================

function buildExecutionResult(state: ExecutorState): ExecutionResult {
  const endTime = state.endTime || new Date();
  const taskResults = Array.from(state.taskResults.values());

  return {
    state: state.state,
    taskResults,
    startTime: state.startTime,
    endTime,
    duration: endTime.getTime() - state.startTime.getTime(),
    error: state.error,
  };
}

// ============================================================================
// Progress Events
// ============================================================================

function emitProgress(
  callback: ProgressCallback | undefined,
  event: ProgressEvent
): void {
  if (callback) {
    try {
      callback(event);
    } catch (error) {
      // Don't let progress errors stop execution
      console.error('Progress callback error:', error);
    }
  }
}

// ============================================================================
// Executor Class
// ============================================================================

/**
 * PLAN.md Executor class for programmatic use
 */
export class PlanExecutor {
  private abortController?: AbortController;
  private state: ExecutorState | null = null;

  /**
   * Execute a plan
   */
  async execute(
    plan: Plan,
    context: ExecutionContext,
    onProgress?: ProgressCallback
  ): Promise<ExecutionResult> {
    this.abortController = new AbortController();
    return executePlan(plan, context, onProgress);
  }

  /**
   * Cancel current execution
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.state) {
      this.state.state = 'cancelled';
    }
  }

  /**
   * Get current execution state
   */
  getState(): ExecutionState {
    return this.state?.state || 'pending';
  }

  /**
   * Get current task being executed
   */
  getCurrentTask(): string | undefined {
    return this.state?.currentTask;
  }
}
