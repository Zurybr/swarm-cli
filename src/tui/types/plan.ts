/**
 * TypeScript types for Plan Execution data
 * Defines the structure for plans, tasks, waves, and execution state
 */

import type { ThemeColors } from '../theme/types';

/**
 * Task execution status
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';

/**
 * Individual task within a plan
 */
export interface Task {
  /** Unique task identifier */
  id: string;
  /** Task display number (1, 2, 3...) */
  number: number;
  /** Task title/description */
  title: string;
  /** Current execution status */
  status: TaskStatus;
  /** Duration in milliseconds (0 if not started) */
  duration: number;
  /** Formatted duration string (e.g., "2m 15s") */
  durationFormatted?: string;
  /** Error message if failed */
  error?: string;
  /** Dependencies (task IDs this task depends on) */
  dependencies?: string[];
}

/**
 * Wave of tasks that can execute in parallel
 */
export interface Wave {
  /** Wave number (1, 2, 3...) */
  number: number;
  /** Tasks in this wave */
  tasks: Task[];
}

/**
 * Plan execution phase
 */
export interface Phase {
  /** Phase identifier */
  id: string;
  /** Phase name (e.g., "03-features") */
  name: string;
  /** Display title */
  title: string;
}

/**
 * Complete plan structure
 */
export interface Plan {
  /** Unique plan identifier */
  id: string;
  /** Plan display number (e.g., "03-02") */
  number: string;
  /** Plan title */
  title: string;
  /** Phase this plan belongs to */
  phase: Phase;
  /** All waves in the plan */
  waves: Wave[];
  /** Total number of tasks */
  totalTasks: number;
  /** Number of completed tasks */
  completedTasks: number;
  /** Overall progress percentage (0-100) */
  progress: number;
  /** Estimated time remaining in milliseconds */
  eta: number;
  /** Formatted ETA string (e.g., "3m 45s") */
  etaFormatted?: string;
  /** Plan start time */
  startTime?: number;
  /** Plan end time (if completed) */
  endTime?: number;
}

/**
 * Plan execution state for hooks
 */
export interface PlanExecutionState {
  /** Current plan being executed */
  plan: Plan | null;
  /** Whether execution is active */
  isExecuting: boolean;
  /** Whether execution is paused */
  isPaused: boolean;
  /** Current wave being executed */
  currentWave: number;
  /** Current task being executed (if any) */
  currentTask: Task | null;
  /** Last update timestamp */
  lastUpdate: number;
  /** Any execution error */
  error: string | null;
}

/**
 * Plan execution actions
 */
export interface PlanExecutionActions {
  /** Start plan execution */
  start: () => void;
  /** Pause execution */
  pause: () => void;
  /** Resume execution */
  resume: () => void;
  /** Cancel execution */
  cancel: () => void;
  /** Update task status */
  updateTaskStatus: (taskId: string, status: TaskStatus, duration?: number) => void;
  /** Set the current plan */
  setPlan: (plan: Plan) => void;
  /** Reset execution state */
  reset: () => void;
}

/**
 * Combined hook return type
 */
export type UsePlanExecutionReturn = PlanExecutionState & PlanExecutionActions;

/**
 * Status icon mapping
 */
export const STATUS_ICONS: Record<TaskStatus, string> = {
  pending: '⏸️',
  running: '⏳',
  completed: '✅',
  failed: '❌',
  blocked: '🔒',
};

/**
 * Status color mapping (for theme colors)
 */
export const STATUS_COLORS: Record<TaskStatus, keyof ThemeColors> = {
  pending: 'muted',
  running: 'warning',
  completed: 'success',
  failed: 'error',
  blocked: 'info',
};

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '0s';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  return `${seconds}s`;
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Calculate ETA based on average task duration
 */
export function calculateETA(
  completedTasks: number,
  totalTasks: number,
  elapsedMs: number
): number {
  if (completedTasks === 0) return 0;
  
  const avgTaskTime = elapsedMs / completedTasks;
  const remainingTasks = totalTasks - completedTasks;
  return Math.round(avgTaskTime * remainingTasks);
}
