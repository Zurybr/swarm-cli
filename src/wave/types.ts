/**
 * Wave-Based Parallel Execution System
 *
 * Types for dependency graphs, wave scheduling, and parallel execution.
 */

/**
 * Unique identifier for a task
 */
export type TaskId = string;

/**
 * Status of a task in the execution lifecycle
 */
export type TaskStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

/**
 * A task to be executed in the wave system
 */
export interface WaveTask {
  /** Unique task identifier */
  id: TaskId;
  /** Human-readable task name */
  name: string;
  /** Task description */
  description?: string;
  /** IDs of tasks that must complete before this task can start */
  dependencies: TaskId[];
  /** IDs of tasks that depend on this task */
  dependents: TaskId[];
  /** Current execution status */
  status: TaskStatus;
  /** The wave number this task is scheduled for (assigned by scheduler) */
  waveNumber: number;
  /** Function to execute for this task */
  execute: () => Promise<TaskResult>;
  /** Task priority (higher = more important) */
  priority: number;
  /** Maximum retry attempts on failure */
  maxRetries: number;
  /** Current retry count */
  retryCount: number;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Task metadata */
  metadata?: Record<string, unknown>;
  /** When the task started executing */
  startedAt?: Date;
  /** When the task completed */
  completedAt?: Date;
  /** Error message if task failed */
  error?: string;
}

/**
 * Result of executing a task
 */
export interface TaskResult {
  /** Whether the task succeeded */
  success: boolean;
  /** Task output data */
  data?: unknown;
  /** Error message if task failed */
  error?: string;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Whether the result should be cached */
  cacheable?: boolean;
}

/**
 * A wave is a collection of tasks that can run in parallel
 */
export interface Wave {
  /** Wave number (0-indexed) */
  number: number;
  /** Tasks in this wave */
  tasks: WaveTask[];
  /** Status of the wave */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** When the wave started executing */
  startedAt?: Date;
  /** When the wave completed */
  completedAt?: Date;
}

/**
 * Node in the dependency graph
 */
export interface DependencyNode {
  /** Task ID */
  id: TaskId;
  /** Direct dependencies */
  dependencies: Set<TaskId>;
  /** Tasks that depend on this node */
  dependents: Set<TaskId>;
  /** In-degree (number of unmet dependencies) */
  inDegree: number;
  /** Out-degree (number of dependents) */
  outDegree: number;
}

/**
 * Directed Acyclic Graph representing task dependencies
 */
export interface DependencyGraph {
  /** All nodes in the graph */
  nodes: Map<TaskId, DependencyNode>;
  /** Root nodes (no dependencies) */
  roots: Set<TaskId>;
  /** Leaf nodes (no dependents) */
  leaves: Set<TaskId>;
  /** Whether the graph has been validated */
  validated: boolean;
  /** True if graph contains no cycles */
  isAcyclic: boolean;
}

/**
 * Execution plan containing scheduled waves
 */
export interface ExecutionPlan {
  /** Unique plan identifier */
  id: string;
  /** All waves in execution order */
  waves: Wave[];
  /** Total number of tasks */
  totalTasks: number;
  /** Map of task ID to wave number */
  taskToWave: Map<TaskId, number>;
  /** When the plan was created */
  createdAt: Date;
  /** Plan status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

/**
 * Options for creating a task
 */
export interface CreateTaskOptions {
  id?: TaskId;
  name: string;
  description?: string;
  dependencies?: TaskId[];
  priority?: number;
  maxRetries?: number;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
  execute: () => Promise<TaskResult>;
}

/**
 * Options for scheduling
 */
export interface SchedulerOptions {
  /** Maximum number of parallel tasks per wave */
  maxParallelTasks?: number;
  /** Whether to respect task priorities when scheduling */
  respectPriority?: boolean;
  /** Minimum tasks per wave (may create smaller initial waves) */
  minTasksPerWave?: number;
}

/**
 * Options for execution
 */
export interface ExecutionOptions {
  /** Continue execution even if a task fails */
  continueOnFailure?: boolean;
  /** Maximum concurrent tasks within a wave */
  maxConcurrency?: number;
  /** Global timeout for entire execution */
  globalTimeoutMs?: number;
  /** Delay between waves in milliseconds */
  waveDelayMs?: number;
  /** Callback for task completion */
  onTaskComplete?: (task: WaveTask, result: TaskResult) => void;
  /** Callback for task failure */
  onTaskFailed?: (task: WaveTask, error: Error) => void;
  /** Callback for wave completion */
  onWaveComplete?: (wave: Wave) => void;
  /** Callback for wave start */
  onWaveStart?: (wave: Wave) => void;
}

/**
 * Result of executing a plan
 */
export interface ExecutionResult {
  /** Whether the entire execution succeeded */
  success: boolean;
  /** Results by task ID */
  taskResults: Map<TaskId, TaskResult>;
  /** Tasks that failed */
  failedTasks: TaskId[];
  /** Tasks that were skipped */
  skippedTasks: TaskId[];
  /** Execution duration in milliseconds */
  durationMs: number;
  /** When execution started */
  startedAt: Date;
  /** When execution completed */
  completedAt: Date;
  /** Error message if execution failed */
  error?: string;
}

/**
 * Execution state for persistence
 */
export interface ExecutionState {
  /** Plan ID */
  planId: string;
  /** Current wave number */
  currentWave: number;
  /** Task statuses */
  taskStatuses: Map<TaskId, TaskStatus>;
  /** Task results */
  taskResults: Map<TaskId, TaskResult>;
  /** When execution started */
  startedAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Cycle detection result
 */
export interface CycleDetectionResult {
  /** Whether a cycle was detected */
  hasCycle: boolean;
  /** The cycle path if one exists */
  cycle?: TaskId[];
  /** Description of the cycle */
  description?: string;
}

/**
 * Topological sort result
 */
export interface TopologicalSortResult {
  /** Whether sorting succeeded */
  success: boolean;
  /** Sorted task IDs if successful */
  order?: TaskId[];
  /** Error message if failed */
  error?: string;
}
