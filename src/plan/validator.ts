/**
 * PLAN.md Validator
 *
 * Validates parsed Plan structures for correctness and completeness.
 * Checks required sections, step dependencies, and structural integrity.
 */

import type {
  Plan,
  PlanTask,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  DependencyGraph,
} from './types.js';

// ============================================================================
// Validation Configuration
// ============================================================================

const REQUIRED_METADATA_FIELDS = ['phase', 'plan'];
const VALID_PLAN_TYPES = ['execute', 'research', 'design'];
const VALID_TASK_TYPES = ['auto', 'manual', 'decision'];

// ============================================================================
// Main Validator
// ============================================================================

/**
 * Validate a parsed Plan structure
 */
export function validatePlan(plan: Plan): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate metadata
  validateMetadata(plan, errors, warnings);

  // Validate tasks
  validateTasks(plan.tasks, errors, warnings);

  // Validate must-haves
  validateMustHaves(plan, errors, warnings);

  // Build and validate dependency graph
  const dependencies = buildDependencyGraph(plan, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    dependencies,
  };
}

// ============================================================================
// Metadata Validation
// ============================================================================

function validateMetadata(
  plan: Plan,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const { metadata } = plan;

  // Check required fields
  for (const field of REQUIRED_METADATA_FIELDS) {
    const value = metadata[field as keyof typeof metadata];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      errors.push({
        code: 'MISSING_REQUIRED_FIELD',
        message: `Required metadata field '${field}' is missing or empty`,
        field,
      });
    }
  }

  // Validate plan type
  if (!VALID_PLAN_TYPES.includes(metadata.type)) {
    errors.push({
      code: 'INVALID_PLAN_TYPE',
      message: `Invalid plan type '${metadata.type}'. Must be one of: ${VALID_PLAN_TYPES.join(', ')}`,
      field: 'type',
    });
  }

  // Validate wave number
  if (metadata.wave < 1) {
    errors.push({
      code: 'INVALID_WAVE_NUMBER',
      message: `Wave number must be >= 1, got ${metadata.wave}`,
      field: 'wave',
    });
  }

  // Validate dependencies format
  for (const dep of metadata.depends_on) {
    if (!isValidDependencyFormat(dep)) {
      warnings.push({
        code: 'INVALID_DEPENDENCY_FORMAT',
        message: `Dependency '${dep}' should follow format 'XX-YY' (e.g., '01-02')`,
      });
    }
  }

  // Validate requirements format (REQ-XX)
  for (const req of metadata.requirements) {
    if (!/^REQ-\d+$/i.test(req)) {
      warnings.push({
        code: 'INVALID_REQUIREMENT_FORMAT',
        message: `Requirement '${req}' should follow format 'REQ-XX' (e.g., 'REQ-04')`,
      });
    }
  }
}

function isValidDependencyFormat(dep: string): boolean {
  // Format: XX-YY (e.g., 01-02)
  return /^\d{2}-\d{2}$/.test(dep);
}

// ============================================================================
// Task Validation
// ============================================================================

function validateTasks(
  tasks: PlanTask[],
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const taskIds = new Set<string>();

  for (const task of tasks) {
    // Check for duplicate IDs
    if (taskIds.has(task.id)) {
      errors.push({
        code: 'DUPLICATE_TASK_ID',
        message: `Duplicate task ID '${task.id}'`,
        taskId: task.id,
      });
    }
    taskIds.add(task.id);

    // Validate task type
    if (!VALID_TASK_TYPES.includes(task.type)) {
      errors.push({
        code: 'INVALID_TASK_TYPE',
        message: `Invalid task type '${task.type}' for task '${task.id}'`,
        taskId: task.id,
      });
    }

    // Check for task name
    if (!task.name || task.name.trim() === '') {
      errors.push({
        code: 'MISSING_TASK_NAME',
        message: `Task '${task.id}' is missing a name`,
        taskId: task.id,
      });
    }

    // Check for action
    if (!task.action || task.action.trim() === '') {
      errors.push({
        code: 'MISSING_TASK_ACTION',
        message: `Task '${task.id}' is missing an action`,
        taskId: task.id,
      });
    }

    // Check for done condition
    if (!task.done || task.done.trim() === '') {
      warnings.push({
        code: 'MISSING_TASK_DONE',
        message: `Task '${task.id}' is missing a done condition`,
        taskId: task.id,
      });
    }

    // Validate TDD tasks have behavior
    if (task.tdd && (!task.behavior || task.behavior.length === 0)) {
      warnings.push({
        code: 'TDD_MISSING_BEHAVIOR',
        message: `TDD task '${task.id}' should have behavior specifications`,
        taskId: task.id,
      });
    }

    // Validate file paths don't contain dangerous patterns
    for (const file of task.files) {
      if (file.includes('..')) {
        errors.push({
          code: 'INVALID_FILE_PATH',
          message: `Task '${task.id}' has file path with parent directory reference: ${file}`,
          taskId: task.id,
        });
      }
    }
  }
}

// ============================================================================
// Must-Haves Validation
// ============================================================================

function validateMustHaves(
  plan: Plan,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const { mustHaves } = plan;

  // Check for truths
  if (mustHaves.truths.length === 0) {
    warnings.push({
      code: 'NO_TRUTHS',
      message: 'Plan has no defined truths in must_haves',
    });
  }

  // Validate artifacts
  for (const artifact of mustHaves.artifacts) {
    if (!artifact.path) {
      errors.push({
        code: 'ARTIFACT_MISSING_PATH',
        message: 'Artifact is missing path',
      });
    }
    if (!artifact.provides) {
      warnings.push({
        code: 'ARTIFACT_MISSING_PROVIDES',
        message: `Artifact '${artifact.path}' is missing provides description`,
      });
    }
  }

  // Validate key links
  for (const link of mustHaves.key_links) {
    if (!link.from || !link.to || !link.via) {
      errors.push({
        code: 'INVALID_KEY_LINK',
        message: 'Key link must have from, to, and via properties',
      });
    }
  }
}

// ============================================================================
// Dependency Graph
// ============================================================================

function buildDependencyGraph(
  plan: Plan,
  errors: ValidationError[]
): DependencyGraph {
  const dependencies = new Map<string, string[]>();
  const ordered: string[] = [];
  const cycles: string[][] = [];
  const orphaned: string[] = [];

  // Build dependency map from task references
  // Tasks can depend on other tasks through naming conventions or explicit refs
  for (const task of plan.tasks) {
    const deps: string[] = [];

    // Parse action for task references (e.g., "See Task 1", "depends on task-2")
    const taskRefs = task.action.match(/task-?\d+/gi) || [];
    for (const ref of taskRefs) {
      const normalizedRef = ref.toLowerCase().replace(/-/g, '-');
      if (normalizedRef !== task.id) {
        deps.push(normalizedRef);
      }
    }

    dependencies.set(task.id, deps);
  }

  // Detect cycles using DFS
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function detectCycle(taskId: string, path: string[]): boolean {
    visited.add(taskId);
    recStack.add(taskId);
    path.push(taskId);

    const deps = dependencies.get(taskId) || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        if (detectCycle(dep, path)) {
          return true;
        }
      } else if (recStack.has(dep)) {
        // Found cycle
        const cycleStart = path.indexOf(dep);
        cycles.push(path.slice(cycleStart));
        return true;
      }
    }

    path.pop();
    recStack.delete(taskId);
    return false;
  }

  for (const task of plan.tasks) {
    if (!visited.has(task.id)) {
      detectCycle(task.id, []);
    }
  }

  // Topological sort for execution order
  const inDegree = new Map<string, number>();
  for (const task of plan.tasks) {
    inDegree.set(task.id, 0);
  }

  for (const [taskId, deps] of dependencies) {
    for (const dep of deps) {
      if (inDegree.has(dep)) {
        inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [taskId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(taskId);
    }
  }

  while (queue.length > 0) {
    const taskId = queue.shift()!;
    ordered.push(taskId);

    const deps = dependencies.get(taskId) || [];
    for (const dep of deps) {
      const newDegree = (inDegree.get(dep) || 0) - 1;
      inDegree.set(dep, newDegree);
      if (newDegree === 0) {
        queue.push(dep);
      }
    }
  }

  // Find orphaned tasks (no deps, not depended on)
  for (const task of plan.tasks) {
    const taskDeps = dependencies.get(task.id) || [];
    const isDependedOn = Array.from(dependencies.values()).some(deps =>
      deps.includes(task.id)
    );

    if (taskDeps.length === 0 && !isDependedOn && plan.tasks.length > 1) {
      orphaned.push(task.id);
    }
  }

  // Report cycles as errors
  for (const cycle of cycles) {
    errors.push({
      code: 'CYCLIC_DEPENDENCY',
      message: `Circular dependency detected: ${cycle.join(' -> ')}`,
    });
  }

  return {
    ordered,
    cycles,
    orphaned,
    dependencies,
  };
}

// ============================================================================
// Cross-Plan Validation
// ============================================================================

/**
 * Validate dependencies against other plans
 */
export function validateCrossPlanDependencies(
  plan: Plan,
  availablePlans: Map<string, Plan>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const dep of plan.metadata.depends_on) {
    if (!availablePlans.has(dep)) {
      errors.push({
        code: 'MISSING_DEPENDENCY',
        message: `Plan depends on '${dep}' which is not available`,
        field: 'depends_on',
      });
    }
  }

  return errors;
}

// ============================================================================
// Validator Class
// ============================================================================

/**
 * PLAN.md Validator class for programmatic use
 */
export class PlanValidator {
  /**
   * Validate a parsed Plan
   */
  validate(plan: Plan): ValidationResult {
    return validatePlan(plan);
  }

  /**
   * Validate multiple plans for cross-dependencies
   */
  validateAll(plans: Plan[]): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();
    const planMap = new Map<string, Plan>();

    // Build plan map by plan identifier (phase-plan)
    for (const plan of plans) {
      const key = `${plan.metadata.phase}-${plan.metadata.plan}`;
      planMap.set(key, plan);
    }

    // Validate each plan
    for (const plan of plans) {
      const result = this.validate(plan);

      // Check cross-plan dependencies
      const crossPlanErrors = validateCrossPlanDependencies(plan, planMap);
      result.errors.push(...crossPlanErrors);
      result.valid = result.errors.length === 0;

      const key = `${plan.metadata.phase}-${plan.metadata.plan}`;
      results.set(key, result);
    }

    return results;
  }
}
