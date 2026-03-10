/**
 * Wave-Based Parallel Execution System
 *
 * Main entry point for the wave execution system.
 * Provides a high-level API for scheduling and executing tasks with dependencies.
 */

import {
  TaskId,
  WaveTask,
  Wave,
  ExecutionPlan,
  ExecutionOptions,
  ExecutionResult,
  CreateTaskOptions,
  SchedulerOptions,
  TaskResult,
  TaskStatus,
  ExecutionState,
  DependencyGraph,
} from './types';
import {
  createTask,
  scheduleIntoWaves,
  optimizePlan,
  getReadyTasks,
  calculatePlanMetrics,
  validatePlan,
  serializePlan,
} from './scheduler';
import {
  executePlan,
  executePartial,
  cancelExecution,
  getExecutionProgress,
  retryTask,
  exportExecutionState,
  importExecutionState,
} from './executor';
import {
  buildDependencyGraph,
  validateGraph,
  detectCycles,
  topologicalSort,
  getAncestors,
  getDescendants,
  getLongestPathFromRoots,
  getCriticalPath,
  cloneGraph,
} from './dag';
import { Logger } from '../utils/logger';

const logger = new Logger('WaveExecution');

/**
 * Main class for wave-based parallel execution
 */
export class WaveExecution {
  private tasks: Map<TaskId, WaveTask> = new Map();
  private currentPlan?: ExecutionPlan;
  private executionState?: ExecutionState;
  private logger: Logger;

  constructor(name: string = 'WaveExecution') {
    this.logger = new Logger(name);
  }

  /**
   * Add a task to the execution
   */
  addTask(options: CreateTaskOptions): WaveTask {
    const task = createTask(options);
    this.tasks.set(task.id, task);
    return task;
  }

  /**
   * Add multiple tasks
   */
  addTasks(options: CreateTaskOptions[]): WaveTask[] {
    return options.map((opt) => this.addTask(opt));
  }

  /**
   * Get a task by ID
   */
  getTask(id: TaskId): WaveTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): WaveTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Remove a task
   */
  removeTask(id: TaskId): boolean {
    return this.tasks.delete(id);
  }

  /**
   * Clear all tasks
   */
  clearTasks(): void {
    this.tasks.clear();
    this.currentPlan = undefined;
    this.executionState = undefined;
  }

  /**
   * Build dependency graph from current tasks
   */
  buildDependencyGraph(): DependencyGraph {
    return buildDependencyGraph(this.getAllTasks());
  }

  /**
   * Validate dependencies (check for cycles)
   */
  validateDependencies(): { valid: boolean; error?: string } {
    const graph = this.buildDependencyGraph();
    const cycleResult = detectCycles(graph);

    if (cycleResult.hasCycle) {
      return {
        valid: false,
        error: cycleResult.description,
      };
    }

    return { valid: true };
  }

  /**
   * Create an execution plan by scheduling tasks into waves
   */
  createPlan(options: SchedulerOptions = {}): ExecutionPlan {
    const tasks = this.getAllTasks();

    if (tasks.length === 0) {
      throw new Error('No tasks to schedule');
    }

    // Validate first
    const validation = this.validateDependencies();
    if (!validation.valid) {
      throw new Error(`Invalid dependencies: ${validation.error}`);
    }

    this.currentPlan = scheduleIntoWaves(tasks, options);
    this.logger.info(
      `Created plan with ${this.currentPlan.waves.length} waves for ${tasks.length} tasks`
    );

    return this.currentPlan;
  }

  /**
   * Get the current plan
   */
  getPlan(): ExecutionPlan | undefined {
    return this.currentPlan;
  }

  /**
   * Optimize the current plan
   */
  optimizePlan(minTasksPerWave: number = 2): ExecutionPlan {
    if (!this.currentPlan) {
      throw new Error('No plan to optimize');
    }

    this.currentPlan = optimizePlan(this.currentPlan, minTasksPerWave);
    return this.currentPlan;
  }

  /**
   * Validate the current plan
   */
  validatePlan(): { valid: boolean; errors: string[] } {
    if (!this.currentPlan) {
      return { valid: false, errors: ['No plan created'] };
    }

    return validatePlan(this.currentPlan);
  }

  /**
   * Execute the current plan
   */
  async execute(options: ExecutionOptions = {}): Promise<ExecutionResult> {
    if (!this.currentPlan) {
      throw new Error('No plan to execute. Call createPlan() first.');
    }

    const result = await executePlan(this.currentPlan, options);
    return result;
  }

  /**
   * Execute a subset of tasks
   */
  async executePartial(
    taskIds: TaskId[],
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    if (!this.currentPlan) {
      throw new Error('No plan to execute. Call createPlan() first.');
    }

    return executePartial(this.currentPlan, taskIds, options);
  }

  /**
   * Get execution progress
   */
  getProgress(): {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    runningTasks: number;
    pendingTasks: number;
    percentage: number;
    currentWave: number;
    totalWaves: number;
  } {
    if (!this.currentPlan || !this.executionState) {
      return {
        totalTasks: this.tasks.size,
        completedTasks: 0,
        failedTasks: 0,
        runningTasks: 0,
        pendingTasks: this.tasks.size,
        percentage: 0,
        currentWave: 0,
        totalWaves: 0,
      };
    }

    return getExecutionProgress(this.currentPlan, this.executionState);
  }

  /**
   * Cancel the current execution
   */
  cancel(): void {
    if (this.currentPlan && this.executionState) {
      cancelExecution(this.currentPlan, this.executionState);
    }
  }

  /**
   * Retry a failed task
   */
  async retryTask(taskId: TaskId, options: ExecutionOptions = {}): Promise<TaskResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    return retryTask(task, options);
  }

  /**
   * Get plan metrics
   */
  getMetrics(): {
    totalWaves: number;
    maxParallelism: number;
    averageTasksPerWave: number;
    criticalPathLength: number;
  } {
    if (!this.currentPlan) {
      return {
        totalWaves: 0,
        maxParallelism: 0,
        averageTasksPerWave: 0,
        criticalPathLength: 0,
      };
    }

    return calculatePlanMetrics(this.currentPlan);
  }

  /**
   * Serialize the current plan to JSON
   */
  serializePlan(): string {
    if (!this.currentPlan) {
      throw new Error('No plan to serialize');
    }

    return serializePlan(this.currentPlan);
  }

  /**
   * Get the critical path (longest dependency chain)
   */
  getCriticalPath(): TaskId[] {
    const graph = this.buildDependencyGraph();
    return getCriticalPath(graph);
  }

  /**
   * Get tasks ready to execute (all dependencies met)
   */
  getReadyTasks(completedTasks: TaskId[]): WaveTask[] {
    return getReadyTasks(this.getAllTasks(), new Set(completedTasks));
  }

  /**
   * Get all ancestors of a task
   */
  getTaskAncestors(taskId: TaskId): TaskId[] {
    const graph = this.buildDependencyGraph();
    return Array.from(getAncestors(graph, taskId));
  }

  /**
   * Get all descendants of a task
   */
  getTaskDescendants(taskId: TaskId): TaskId[] {
    const graph = this.buildDependencyGraph();
    return Array.from(getDescendants(graph, taskId));
  }

  /**
   * Export execution state for persistence
   */
  exportState(): Record<string, unknown> {
    if (!this.executionState) {
      throw new Error('No execution state to export');
    }

    return exportExecutionState(this.executionState);
  }

  /**
   * Import execution state from persisted data
   */
  importState(data: Record<string, unknown>): void {
    this.executionState = importExecutionState(data);
  }
}

// Re-export types
export * from './types';

// Re-export functions
export {
  createTask,
  scheduleIntoWaves,
  optimizePlan,
  getReadyTasks,
  calculatePlanMetrics,
  validatePlan,
  serializePlan,
  executePlan,
  executePartial,
  cancelExecution,
  getExecutionProgress,
  retryTask,
  exportExecutionState,
  importExecutionState,
  buildDependencyGraph,
  validateGraph,
  detectCycles,
  topologicalSort,
  getAncestors,
  getDescendants,
  getLongestPathFromRoots,
  getCriticalPath,
  cloneGraph,
};

// Default export
export default WaveExecution;
