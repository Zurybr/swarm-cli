/**
 * Milestone Tracking and Validation
 *
 * Manages milestone lifecycle, dependencies, and progress tracking.
 */

import {
  Milestone,
  Phase,
  Task,
  GSDStatus,
  ValidationResult,
  ProgressUpdate,
} from './types';

/**
 * Create a new milestone
 * @param name - Milestone name
 * @param description - Milestone description
 * @param order - Order in the project (0-indexed)
 * @returns A new milestone instance
 */
export function createMilestone(
  name: string,
  description: string = '',
  order: number = 0
): Milestone {
  const now = new Date();
  return {
    id: generateId(),
    name,
    description,
    status: 'not_started',
    order,
    phases: [],
    deliverables: [],
    successCriteria: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update milestone status based on phase statuses
 * @param milestone - The milestone to update
 * @returns ProgressUpdate if status changed, undefined otherwise
 */
export function updateMilestoneStatus(milestone: Milestone): ProgressUpdate | undefined {
  const oldStatus = milestone.status;
  const newStatus = calculateMilestoneStatus(milestone.phases);

  if (oldStatus !== newStatus) {
    milestone.status = newStatus;
    milestone.updatedAt = new Date();

    if (newStatus === 'completed') {
      milestone.completedAt = new Date();
    }

    return {
      entityId: milestone.id,
      entityType: 'milestone',
      oldStatus,
      newStatus,
      updatedAt: new Date(),
    };
  }

  return undefined;
}

/**
 * Add a phase to a milestone
 * @param milestone - The milestone to add to
 * @param phase - The phase to add
 */
export function addPhase(milestone: Milestone, phase: Phase): void {
  phase.order = milestone.phases.length;
  milestone.phases.push(phase);
  milestone.updatedAt = new Date();
  updateMilestoneStatus(milestone);
}

/**
 * Remove a phase from a milestone
 * @param milestone - The milestone to remove from
 * @param phaseId - The ID of the phase to remove
 * @returns True if removed, false if not found
 */
export function removePhase(milestone: Milestone, phaseId: string): boolean {
  const index = milestone.phases.findIndex(p => p.id === phaseId);
  if (index === -1) return false;

  milestone.phases.splice(index, 1);

  // Reorder remaining phases
  milestone.phases.forEach((p, i) => {
    p.order = i;
  });

  milestone.updatedAt = new Date();
  updateMilestoneStatus(milestone);
  return true;
}

/**
 * Reorder phases within a milestone
 * @param milestone - The milestone to reorder
 * @param phaseId - The ID of the phase to move
 * @param newOrder - The new order position (0-indexed)
 * @returns True if reordered, false if phase not found
 */
export function reorderPhase(
  milestone: Milestone,
  phaseId: string,
  newOrder: number
): boolean {
  const index = milestone.phases.findIndex(p => p.id === phaseId);
  if (index === -1) return false;

  const phase = milestone.phases[index];
  milestone.phases.splice(index, 1);

  // Clamp new order to valid range
  newOrder = Math.max(0, Math.min(newOrder, milestone.phases.length));
  milestone.phases.splice(newOrder, 0, phase);

  // Update order properties
  milestone.phases.forEach((p, i) => {
    p.order = i;
  });

  milestone.updatedAt = new Date();
  return true;
}

/**
 * Validate a milestone
 * @param milestone - The milestone to validate
 * @returns ValidationResult with errors and warnings
 */
export function validateMilestone(milestone: Milestone): ValidationResult {
  const errors: { field: string; message: string; code: string }[] = [];
  const warnings: { field: string; message: string; suggestion?: string }[] = [];

  // Required fields
  if (!milestone.id) {
    errors.push({ field: 'id', message: 'Milestone ID is required', code: 'MISSING_ID' });
  }

  if (!milestone.name || milestone.name.trim() === '') {
    errors.push({ field: 'name', message: 'Milestone name is required', code: 'MISSING_NAME' });
  }

  if (!milestone.description || milestone.description.trim() === '') {
    warnings.push({
      field: 'description',
      message: 'Milestone description is empty',
      suggestion: 'Add a description to clarify the milestone objective',
    });
  }

  // Validate phases exist
  if (milestone.phases.length === 0) {
    warnings.push({
      field: 'phases',
      message: 'Milestone has no phases',
      suggestion: 'Add at least one phase to track progress',
    });
  }

  // Check for duplicate phase names
  const phaseNames = milestone.phases.map(p => p.name);
  const duplicates = phaseNames.filter((item, index) => phaseNames.indexOf(item) !== index);
  if (duplicates.length > 0) {
    warnings.push({
      field: 'phases',
      message: `Duplicate phase names found: ${duplicates.join(', ')}`,
      suggestion: 'Use unique names for phases to avoid confusion',
    });
  }

  // Validate success criteria
  if (milestone.successCriteria.length === 0) {
    warnings.push({
      field: 'successCriteria',
      message: 'No success criteria defined',
      suggestion: 'Define clear success criteria to know when the milestone is complete',
    });
  }

  // Validate dates
  if (milestone.targetDate && milestone.startDate && milestone.targetDate < milestone.startDate) {
    errors.push({
      field: 'targetDate',
      message: 'Target date cannot be before start date',
      code: 'INVALID_DATE_RANGE',
    });
  }

  // Validate status consistency
  const calculatedStatus = calculateMilestoneStatus(milestone.phases);
  if (calculatedStatus !== milestone.status) {
    warnings.push({
      field: 'status',
      message: `Status mismatch: stored "${milestone.status}" but calculated "${calculatedStatus}"`,
      suggestion: 'Run status update to synchronize',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get milestone statistics
 * @param milestone - The milestone to analyze
 * @returns Statistics object
 */
export function getMilestoneStats(milestone: Milestone): {
  totalPhases: number;
  completedPhases: number;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
  blockedPhases: number;
  inProgressPhases: number;
} {
  const totalPhases = milestone.phases.length;
  const completedPhases = milestone.phases.filter(p => p.status === 'completed').length;
  const blockedPhases = milestone.phases.filter(p => p.status === 'blocked').length;
  const inProgressPhases = milestone.phases.filter(p => p.status === 'in_progress').length;

  const totalTasks = milestone.phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const completedTasks = milestone.phases.reduce(
    (sum, p) => sum + p.tasks.filter(t => t.status === 'completed').length,
    0
  );

  const totalItems = totalPhases + totalTasks;
  const completedItems = completedPhases + completedTasks;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return {
    totalPhases,
    completedPhases,
    totalTasks,
    completedTasks,
    progressPercent,
    blockedPhases,
    inProgressPhases,
  };
}

/**
 * Check if a milestone is ready to start
 * @param milestone - The milestone to check
 * @param previousMilestone - The previous milestone (if any)
 * @returns Object with ready status and reasons
 */
export function isMilestoneReady(
  milestone: Milestone,
  previousMilestone?: Milestone
): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check if previous milestone is completed
  if (previousMilestone && previousMilestone.status !== 'completed') {
    reasons.push(`Previous milestone "${previousMilestone.name}" is not completed`);
  }

  // Check if milestone has phases
  if (milestone.phases.length === 0) {
    reasons.push('Milestone has no phases defined');
  }

  // Check if all entry criteria are met (if any defined)
  // Note: Milestones don't have entry criteria in current model, but this is for future extension

  // Check if milestone is already completed or cancelled
  if (milestone.status === 'completed') {
    reasons.push('Milestone is already completed');
  }

  if (milestone.status === 'cancelled') {
    reasons.push('Milestone has been cancelled');
  }

  return {
    ready: reasons.length === 0,
    reasons,
  };
}

/**
 * Check if a milestone can be marked as complete
 * @param milestone - The milestone to check
 * @returns Object with canComplete status and reasons
 */
export function canCompleteMilestone(milestone: Milestone): { canComplete: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check if all phases are completed
  const incompletePhases = milestone.phases.filter(p => p.status !== 'completed');
  if (incompletePhases.length > 0) {
    reasons.push(`${incompletePhases.length} phase(s) are not completed`);
  }

  // Check success criteria
  if (milestone.successCriteria.length === 0) {
    reasons.push('No success criteria defined');
  }

  // Check if already completed or cancelled
  if (milestone.status === 'completed') {
    reasons.push('Milestone is already completed');
  }

  if (milestone.status === 'cancelled') {
    reasons.push('Milestone has been cancelled');
  }

  return {
    canComplete: reasons.length === 0,
    reasons,
  };
}

/**
 * Mark a milestone as blocked
 * @param milestone - The milestone to block
 * @param reason - Reason for blocking
 * @returns ProgressUpdate
 */
export function blockMilestone(
  milestone: Milestone,
  reason: string
): ProgressUpdate {
  const oldStatus = milestone.status;
  milestone.status = 'blocked';
  milestone.updatedAt = new Date();
  milestone.notes = milestone.notes
    ? `${milestone.notes}\n\nBlocked: ${reason}`
    : `Blocked: ${reason}`;

  return {
    entityId: milestone.id,
    entityType: 'milestone',
    oldStatus,
    newStatus: 'blocked',
    updatedAt: new Date(),
    note: reason,
  };
}

/**
 * Unblock a milestone
 * @param milestone - The milestone to unblock
 * @returns ProgressUpdate if status changed, undefined otherwise
 */
export function unblockMilestone(milestone: Milestone): ProgressUpdate | undefined {
  if (milestone.status !== 'blocked') {
    return undefined;
  }

  const oldStatus = milestone.status;
  const newStatus = calculateMilestoneStatus(milestone.phases);
  milestone.status = newStatus;
  milestone.updatedAt = new Date();

  return {
    entityId: milestone.id,
    entityType: 'milestone',
    oldStatus,
    newStatus,
    updatedAt: new Date(),
    note: 'Milestone unblocked',
  };
}

/**
 * Get the next incomplete phase in a milestone
 * @param milestone - The milestone to search
 * @returns The next incomplete phase or undefined
 */
export function getNextPhase(milestone: Milestone): Phase | undefined {
  return milestone.phases
    .sort((a, b) => a.order - b.order)
    .find(p => p.status !== 'completed');
}

/**
 * Clone a milestone (useful for templates)
 * @param milestone - The milestone to clone
 * @param newName - Optional new name for the cloned milestone
 * @returns A new milestone instance
 */
export function cloneMilestone(milestone: Milestone, newName?: string): Milestone {
  const now = new Date();
  return {
    ...milestone,
    id: generateId(),
    name: newName || `${milestone.name} (Copy)`,
    status: 'not_started',
    phases: milestone.phases.map(p => ({
      ...p,
      id: generateId(),
      status: 'not_started',
      tasks: p.tasks.map(t => ({
        ...t,
        id: generateId(),
        status: 'not_started',
        createdAt: now,
        updatedAt: now,
      })),
      createdAt: now,
      updatedAt: now,
    })),
    createdAt: now,
    updatedAt: now,
    completedAt: undefined,
  };
}

// Helper functions

function calculateMilestoneStatus(phases: Phase[]): GSDStatus {
  if (phases.length === 0) return 'not_started';
  if (phases.every(p => p.status === 'completed')) return 'completed';
  if (phases.some(p => p.status === 'blocked')) return 'blocked';
  if (phases.some(p => p.status === 'in_progress')) return 'in_progress';
  if (phases.some(p => p.status === 'completed')) return 'in_progress';
  return 'not_started';
}

function generateId(): string {
  return `gsd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Re-export types
export * from './types';
