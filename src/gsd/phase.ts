/**
 * Phase Execution and Verification
 *
 * Manages phase lifecycle, task execution, and verification criteria.
 */

import {
  Phase,
  Task,
  GSDStatus,
  GSDPriority,
  ValidationResult,
  ProgressUpdate,
} from './types';

/**
 * Create a new phase
 * @param name - Phase name
 * @param description - Phase description
 * @param order - Order in the milestone (0-indexed)
 * @returns A new phase instance
 */
export function createPhase(
  name: string,
  description: string = '',
  order: number = 0
): Phase {
  const now = new Date();
  return {
    id: generateId(),
    name,
    description,
    status: 'not_started',
    order,
    tasks: [],
    deliverables: [],
    entryCriteria: [],
    exitCriteria: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update phase status based on task statuses
 * @param phase - The phase to update
 * @returns ProgressUpdate if status changed, undefined otherwise
 */
export function updatePhaseStatus(phase: Phase): ProgressUpdate | undefined {
  const oldStatus = phase.status;
  const newStatus = calculatePhaseStatus(phase.tasks);

  if (oldStatus !== newStatus) {
    phase.status = newStatus;
    phase.updatedAt = new Date();

    if (newStatus === 'completed') {
      phase.completedAt = new Date();
    }

    return {
      entityId: phase.id,
      entityType: 'phase',
      oldStatus,
      newStatus,
      updatedAt: new Date(),
    };
  }

  return undefined;
}

/**
 * Add a task to a phase
 * @param phase - The phase to add to
 * @param task - The task to add
 */
export function addTask(phase: Phase, task: Task): void {
  phase.tasks.push(task);
  phase.updatedAt = new Date();
  updatePhaseStatus(phase);
}

/**
 * Create and add a new task to a phase
 * @param phase - The phase to add to
 * @param name - Task name
 * @param priority - Task priority
 * @returns The created task
 */
export function createAndAddTask(
  phase: Phase,
  name: string,
  priority: GSDPriority = 'medium'
): Task {
  const now = new Date();
  const task: Task = {
    id: generateId(),
    name,
    description: '',
    status: 'not_started',
    priority,
    dependencies: [],
    deliverables: [],
    createdAt: now,
    updatedAt: now,
  };

  addTask(phase, task);
  return task;
}

/**
 * Remove a task from a phase
 * @param phase - The phase to remove from
 * @param taskId - The ID of the task to remove
 * @returns True if removed, false if not found
 */
export function removeTask(phase: Phase, taskId: string): boolean {
  const index = phase.tasks.findIndex(t => t.id === taskId);
  if (index === -1) return false;

  phase.tasks.splice(index, 1);
  phase.updatedAt = new Date();
  updatePhaseStatus(phase);
  return true;
}

/**
 * Update task status
 * @param phase - The phase containing the task
 * @param taskId - The ID of the task to update
 * @param newStatus - The new status
 * @param updatedBy - Who made the update
 * @returns ProgressUpdate if status changed, undefined otherwise
 */
export function updateTaskStatus(
  phase: Phase,
  taskId: string,
  newStatus: GSDStatus,
  updatedBy?: string
): ProgressUpdate | undefined {
  const task = phase.tasks.find(t => t.id === taskId);
  if (!task) return undefined;

  const oldStatus = task.status;
  if (oldStatus === newStatus) return undefined;

  // Check dependencies if marking as completed
  if (newStatus === 'completed' && task.dependencies.length > 0) {
    const incompleteDeps = task.dependencies.filter(depId => {
      const depTask = phase.tasks.find(t => t.id === depId);
      return depTask && depTask.status !== 'completed';
    });

    if (incompleteDeps.length > 0) {
      throw new Error(
        `Cannot complete task: incomplete dependencies (${incompleteDeps.join(', ')})`
      );
    }
  }

  task.status = newStatus;
  task.updatedAt = new Date();

  if (newStatus === 'completed') {
    task.completedAt = new Date();
  }

  // Update phase status
  updatePhaseStatus(phase);

  return {
    entityId: task.id,
    entityType: 'task',
    oldStatus,
    newStatus,
    updatedBy,
    updatedAt: new Date(),
  };
}

/**
 * Validate a phase
 * @param phase - The phase to validate
 * @returns ValidationResult with errors and warnings
 */
export function validatePhase(phase: Phase): ValidationResult {
  const errors: { field: string; message: string; code: string }[] = [];
  const warnings: { field: string; message: string; suggestion?: string }[] = [];

  // Required fields
  if (!phase.id) {
    errors.push({ field: 'id', message: 'Phase ID is required', code: 'MISSING_ID' });
  }

  if (!phase.name || phase.name.trim() === '') {
    errors.push({ field: 'name', message: 'Phase name is required', code: 'MISSING_NAME' });
  }

  if (!phase.description || phase.description.trim() === '') {
    warnings.push({
      field: 'description',
      message: 'Phase description is empty',
      suggestion: 'Add a description to clarify phase objectives',
    });
  }

  // Validate tasks
  if (phase.tasks.length === 0) {
    warnings.push({
      field: 'tasks',
      message: 'Phase has no tasks',
      suggestion: 'Add tasks to track phase progress',
    });
  }

  // Check for duplicate task names
  const taskNames = phase.tasks.map(t => t.name);
  const duplicates = taskNames.filter((item, index) => taskNames.indexOf(item) !== index);
  if (duplicates.length > 0) {
    warnings.push({
      field: 'tasks',
      message: `Duplicate task names found: ${duplicates.join(', ')}`,
      suggestion: 'Use unique names for tasks to avoid confusion',
    });
  }

  // Validate entry/exit criteria
  if (phase.entryCriteria.length === 0) {
    warnings.push({
      field: 'entryCriteria',
      message: 'No entry criteria defined',
      suggestion: 'Define what must be true before starting this phase',
    });
  }

  if (phase.exitCriteria.length === 0) {
    warnings.push({
      field: 'exitCriteria',
      message: 'No exit criteria defined',
      suggestion: 'Define what must be true to complete this phase',
    });
  }

  // Validate dates
  if (phase.targetDate && phase.startDate && phase.targetDate < phase.startDate) {
    errors.push({
      field: 'targetDate',
      message: 'Target date cannot be before start date',
      code: 'INVALID_DATE_RANGE',
    });
  }

  // Validate status consistency
  const calculatedStatus = calculatePhaseStatus(phase.tasks);
  if (calculatedStatus !== phase.status) {
    warnings.push({
      field: 'status',
      message: `Status mismatch: stored "${phase.status}" but calculated "${calculatedStatus}"`,
      suggestion: 'Run status update to synchronize',
    });
  }

  // Validate task dependencies
  const taskIds = new Set(phase.tasks.map(t => t.id));
  for (const task of phase.tasks) {
    for (const depId of task.dependencies) {
      if (!taskIds.has(depId)) {
        errors.push({
          field: `tasks.${task.id}.dependencies`,
          message: `Task "${task.name}" has invalid dependency: ${depId}`,
          code: 'INVALID_DEPENDENCY',
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get phase statistics
 * @param phase - The phase to analyze
 * @returns Statistics object
 */
export function getPhaseStats(phase: Phase): {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  notStartedTasks: number;
  progressPercent: number;
  criticalTasks: number;
  highPriorityTasks: number;
  totalEstimatedHours: number;
  totalActualHours: number;
} {
  const totalTasks = phase.tasks.length;
  const completedTasks = phase.tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = phase.tasks.filter(t => t.status === 'in_progress').length;
  const blockedTasks = phase.tasks.filter(t => t.status === 'blocked').length;
  const notStartedTasks = phase.tasks.filter(t => t.status === 'not_started').length;
  const criticalTasks = phase.tasks.filter(t => t.priority === 'critical').length;
  const highPriorityTasks = phase.tasks.filter(t => t.priority === 'high').length;

  const totalEstimatedHours = phase.tasks.reduce(
    (sum, t) => sum + (t.estimatedHours || 0),
    0
  );
  const totalActualHours = phase.tasks.reduce(
    (sum, t) => sum + (t.actualHours || 0),
    0
  );

  const progressPercent = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    blockedTasks,
    notStartedTasks,
    progressPercent,
    criticalTasks,
    highPriorityTasks,
    totalEstimatedHours,
    totalActualHours,
  };
}

/**
 * Check if a phase is ready to start
 * @param phase - The phase to check
 * @param previousPhase - The previous phase (if any)
 * @returns Object with ready status and reasons
 */
export function isPhaseReady(
  phase: Phase,
  previousPhase?: Phase
): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check if previous phase is completed
  if (previousPhase && previousPhase.status !== 'completed') {
    reasons.push(`Previous phase "${previousPhase.name}" is not completed`);
  }

  // Check entry criteria
  if (phase.entryCriteria.length === 0) {
    reasons.push('No entry criteria defined');
  }

  // Check if phase has tasks
  if (phase.tasks.length === 0) {
    reasons.push('Phase has no tasks defined');
  }

  // Check if already completed or cancelled
  if (phase.status === 'completed') {
    reasons.push('Phase is already completed');
  }

  if (phase.status === 'cancelled') {
    reasons.push('Phase has been cancelled');
  }

  return {
    ready: reasons.length === 0,
    reasons,
  };
}

/**
 * Check if a phase can be marked as complete
 * @param phase - The phase to check
 * @returns Object with canComplete status and reasons
 */
export function canCompletePhase(phase: Phase): { canComplete: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check if all tasks are completed
  const incompleteTasks = phase.tasks.filter(t => t.status !== 'completed');
  if (incompleteTasks.length > 0) {
    reasons.push(`${incompleteTasks.length} task(s) are not completed`);
  }

  // Check exit criteria
  if (phase.exitCriteria.length === 0) {
    reasons.push('No exit criteria defined');
  }

  // Check if already completed or cancelled
  if (phase.status === 'completed') {
    reasons.push('Phase is already completed');
  }

  if (phase.status === 'cancelled') {
    reasons.push('Phase has been cancelled');
  }

  return {
    canComplete: reasons.length === 0,
    reasons,
  };
}

/**
 * Mark a phase as blocked
 * @param phase - The phase to block
 * @param reason - Reason for blocking
 * @returns ProgressUpdate
 */
export function blockPhase(
  phase: Phase,
  reason: string
): ProgressUpdate {
  const oldStatus = phase.status;
  phase.status = 'blocked';
  phase.updatedAt = new Date();
  phase.notes = phase.notes
    ? `${phase.notes}\n\nBlocked: ${reason}`
    : `Blocked: ${reason}`;

  return {
    entityId: phase.id,
    entityType: 'phase',
    oldStatus,
    newStatus: 'blocked',
    updatedAt: new Date(),
    note: reason,
  };
}

/**
 * Unblock a phase
 * @param phase - The phase to unblock
 * @returns ProgressUpdate if status changed, undefined otherwise
 */
export function unblockPhase(phase: Phase): ProgressUpdate | undefined {
  if (phase.status !== 'blocked') {
    return undefined;
  }

  const oldStatus = phase.status;
  const newStatus = calculatePhaseStatus(phase.tasks);
  phase.status = newStatus;
  phase.updatedAt = new Date();

  return {
    entityId: phase.id,
    entityType: 'phase',
    oldStatus,
    newStatus,
    updatedAt: new Date(),
    note: 'Phase unblocked',
  };
}

/**
 * Get the next incomplete task in a phase
 * @param phase - The phase to search
 * @returns The next incomplete task or undefined
 */
export function getNextTask(phase: Phase): Task | undefined {
  // First, try to find a task with no incomplete dependencies
  return phase.tasks.find(t => {
    if (t.status === 'completed') return false;

    const incompleteDeps = t.dependencies.filter(depId => {
      const depTask = phase.tasks.find(task => task.id === depId);
      return depTask && depTask.status !== 'completed';
    });

    return incompleteDeps.length === 0;
  });
}

/**
 * Get tasks by priority
 * @param phase - The phase to search
 * @param priority - The priority to filter by
 * @returns Array of matching tasks
 */
export function getTasksByPriority(phase: Phase, priority: GSDPriority): Task[] {
  return phase.tasks.filter(t => t.priority === priority);
}

/**
 * Get blocked tasks (tasks with incomplete dependencies)
 * @param phase - The phase to search
 * @returns Array of blocked tasks with their blocking dependencies
 */
export function getBlockedTasks(phase: Phase): { task: Task; blockedBy: string[] }[] {
  return phase.tasks
    .filter(t => t.dependencies.length > 0 && t.status !== 'completed')
    .map(t => {
      const blockedBy = t.dependencies.filter(depId => {
        const depTask = phase.tasks.find(task => task.id === depId);
        return depTask && depTask.status !== 'completed';
      });
      return { task: t, blockedBy };
    })
    .filter(item => item.blockedBy.length > 0);
}

/**
 * Clone a phase (useful for templates)
 * @param phase - The phase to clone
 * @param newName - Optional new name for the cloned phase
 * @returns A new phase instance
 */
export function clonePhase(phase: Phase, newName?: string): Phase {
  const now = new Date();
  return {
    ...phase,
    id: generateId(),
    name: newName || `${phase.name} (Copy)`,
    status: 'not_started',
    tasks: phase.tasks.map(t => ({
      ...t,
      id: generateId(),
      status: 'not_started',
      createdAt: now,
      updatedAt: now,
      completedAt: undefined,
    })),
    createdAt: now,
    updatedAt: now,
    completedAt: undefined,
  };
}

/**
 * Verify phase exit criteria
 * @param phase - The phase to verify
 * @returns Object with verified status and missing criteria
 */
export function verifyExitCriteria(phase: Phase): {
  verified: boolean;
  missing: string[];
  met: string[];
} {
  // This is a placeholder for actual verification logic
  // In a real implementation, this would check actual deliverables,
  // run tests, verify documentation, etc.

  const met: string[] = [];
  const missing: string[] = [];

  for (const criterion of phase.exitCriteria) {
    // Placeholder: assume criteria are met if all tasks are completed
    const allTasksCompleted = phase.tasks.every(t => t.status === 'completed');
    if (allTasksCompleted) {
      met.push(criterion);
    } else {
      missing.push(criterion);
    }
  }

  return {
    verified: missing.length === 0,
    missing,
    met,
  };
}

// Helper functions

function calculatePhaseStatus(tasks: Task[]): GSDStatus {
  if (tasks.length === 0) return 'not_started';
  if (tasks.every(t => t.status === 'completed')) return 'completed';
  if (tasks.some(t => t.status === 'blocked')) return 'blocked';
  if (tasks.some(t => t.status === 'in_progress')) return 'in_progress';
  if (tasks.some(t => t.status === 'completed')) return 'in_progress';
  return 'not_started';
}

function generateId(): string {
  return `gsd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Re-export types
export * from './types';
