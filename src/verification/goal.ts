/**
 * Goal Definition and Management
 *
 * Provides classes and utilities for creating, managing, and manipulating goals
 * within the goal-backward verification system.
 */

import {
  type Goal,
  type GoalId,
  type GoalStatus,
  type CreateGoalOptions,
  type UpdateGoalOptions,
  type MustHave,
  type CreateMustHaveOptions,
  type MustHaveType,
  type ValueOperator,
} from './types';

// ============================================================================
// ID Generation
// ============================================================================

let goalIdCounter = 0;
let mustHaveIdCounter = 0;

/**
 * Generate a unique goal ID
 */
export function generateGoalId(): GoalId {
  return `goal-${Date.now()}-${++goalIdCounter}`;
}

/**
 * Generate a unique must-have ID
 */
export function generateMustHaveId(): string {
  return `mh-${Date.now()}-${++mustHaveIdCounter}`;
}

// ============================================================================
// Goal Builder
// ============================================================================

/**
 * Fluent builder for creating goals with must-have criteria
 *
 * @example
 * ```typescript
 * const goal = new GoalBuilder()
 *   .withTitle('Implement User Authentication')
 *   .withDescription('Add secure login functionality')
 *   .withMustHave()
 *     .existence('auth/login.ts', 'Login endpoint exists')
 *     .value('auth/config.ts', 'JWT_SECRET', 'is defined')
 *   .withPriority(1)
 *   .build();
 * ```
 */
export class GoalBuilder {
  private options: Partial<CreateGoalOptions> = {};
  private mustHaves: MustHave[] = [];

  /**
   * Set the goal title
   */
  withTitle(title: string): this {
    this.options.title = title;
    return this;
  }

  /**
   * Set the goal description
   */
  withDescription(description: string): this {
    this.options.description = description;
    return this;
  }

  /**
   * Set the parent goal ID
   */
  withParent(parentId: GoalId): this {
    this.options.parentId = parentId;
    return this;
  }

  /**
   * Set the priority level
   */
  withPriority(priority: number): this {
    this.options.priority = priority;
    return this;
  }

  /**
   * Set the owner
   */
  withOwner(owner: string): this {
    this.options.owner = owner;
    return this;
  }

  /**
   * Add tags
   */
  withTags(...tags: string[]): this {
    this.options.tags = [...(this.options.tags || []), ...tags];
    return this;
  }

  /**
   * Set the deadline
   */
  withDeadline(deadline: Date): this {
    this.options.deadline = deadline;
    return this;
  }

  /**
   * Add metadata
   */
  withMetadata(key: string, value: unknown): this {
    if (!this.options.metadata) {
      this.options.metadata = {};
    }
    this.options.metadata[key] = value;
    return this;
  }

  /**
   * Add a must-have criterion using the MustHaveBuilder
   */
  withMustHave(builderFn: (builder: MustHaveBuilder) => MustHaveBuilder): this {
    const builder = new MustHaveBuilder();
    const mustHave = builderFn(builder).build();
    this.mustHaves.push(mustHave);
    return this;
  }

  /**
   * Add a pre-built must-have
   */
  addMustHave(mustHave: MustHave): this {
    this.mustHaves.push(mustHave);
    return this;
  }

  /**
   * Build the goal
   */
  build(): Goal {
    if (!this.options.title) {
      throw new Error('Goal title is required');
    }
    if (!this.options.description) {
      throw new Error('Goal description is required');
    }

    const now = new Date();
    return {
      id: generateGoalId(),
      title: this.options.title,
      description: this.options.description,
      status: 'pending',
      mustHaves: this.mustHaves,
      parentId: this.options.parentId,
      priority: this.options.priority ?? 0,
      createdAt: now,
      updatedAt: now,
      metadata: this.options.metadata,
      tags: this.options.tags,
      owner: this.options.owner,
      deadline: this.options.deadline,
    };
  }
}

// ============================================================================
// Must-Have Builder
// ============================================================================

/**
 * Fluent builder for creating must-have criteria
 *
 * @example
 * ```typescript
 * const mustHave = new MustHaveBuilder()
 *   .existence('src/auth.ts', 'Auth module exists')
 *   .build();
 * ```
 */
export class MustHaveBuilder {
  private options: Partial<CreateMustHaveOptions> = {};

  /**
   * Create an existence-type must-have
   */
  existence(target: string, description: string): this {
    this.options = {
      type: 'existence',
      target,
      description,
    };
    return this;
  }

  /**
   * Create a value-type must-have
   */
  value(
    target: string,
    description: string,
    expected: unknown,
    operator: ValueOperator = 'equals'
  ): this {
    this.options = {
      type: 'value',
      target,
      description,
      expected,
      operator,
    };
    return this;
  }

  /**
   * Create a structure-type must-have
   */
  structure(target: string, description: string, expected: unknown): this {
    this.options = {
      type: 'structure',
      target,
      description,
      expected,
    };
    return this;
  }

  /**
   * Create a relation-type must-have
   */
  relation(
    target: string,
    relatedTarget: string,
    relationType: MustHave['relationType'],
    description: string
  ): this {
    this.options = {
      type: 'relation',
      target,
      relatedTarget,
      relationType,
      description,
    };
    return this;
  }

  /**
   * Set whether this must-have is required
   */
  required(isRequired: boolean = true): this {
    this.options.required = isRequired;
    return this;
  }

  /**
   * Set the weight for this must-have (0-1)
   */
  withWeight(weight: number): this {
    this.options.weight = weight;
    return this;
  }

  /**
   * Set a custom validator function
   */
  withValidator(validator: (actual: unknown) => boolean): this {
    this.options.validator = validator;
    return this;
  }

  /**
   * Set a custom error message
   */
  withErrorMessage(message: string): this {
    this.options.errorMessage = message;
    return this;
  }

  /**
   * Build the must-have
   */
  build(): MustHave {
    if (!this.options.description) {
      throw new Error('Must-have description is required');
    }
    if (!this.options.type) {
      throw new Error('Must-have type is required');
    }
    if (!this.options.target) {
      throw new Error('Must-have target is required');
    }

    return {
      id: generateMustHaveId(),
      description: this.options.description,
      type: this.options.type,
      status: 'pending',
      target: this.options.target,
      expected: this.options.expected,
      operator: this.options.operator,
      relatedTarget: this.options.relatedTarget,
      relationType: this.options.relationType,
      required: this.options.required ?? true,
      weight: this.options.weight ?? 1.0,
      validator: this.options.validator,
      errorMessage: this.options.errorMessage,
      createdAt: new Date(),
    };
  }
}

// ============================================================================
// Goal Manager
// ============================================================================

/**
 * Manages a collection of goals with CRUD operations and hierarchical relationships
 */
export class GoalManager {
  private goals: Map<GoalId, Goal> = new Map();

  /**
   * Create a new goal
   */
  createGoal(options: CreateGoalOptions): Goal {
    const builder = new GoalBuilder()
      .withTitle(options.title)
      .withDescription(options.description);

    if (options.parentId) builder.withParent(options.parentId);
    if (options.priority !== undefined) builder.withPriority(options.priority);
    if (options.metadata) {
      Object.entries(options.metadata).forEach(([key, value]) => {
        builder.withMetadata(key, value);
      });
    }
    if (options.tags) builder.withTags(...options.tags);
    if (options.owner) builder.withOwner(options.owner);
    if (options.deadline) builder.withDeadline(options.deadline);

    // Add must-haves if provided
    if (options.mustHaves) {
      options.mustHaves.forEach(mh => builder.addMustHave(mh));
    }

    const goal = builder.build();
    this.goals.set(goal.id, goal);

    // Update parent's children list if parent exists
    if (goal.parentId) {
      const parent = this.goals.get(goal.parentId);
      if (parent) {
        parent.children = [...(parent.children || []), goal.id];
      }
    }

    return goal;
  }

  /**
   * Get a goal by ID
   */
  getGoal(id: GoalId): Goal | undefined {
    return this.goals.get(id);
  }

  /**
   * Update a goal
   */
  updateGoal(id: GoalId, updates: UpdateGoalOptions): Goal | undefined {
    const goal = this.goals.get(id);
    if (!goal) return undefined;

    const updated: Goal = {
      ...goal,
      ...updates,
      id: goal.id, // Prevent ID change
      createdAt: goal.createdAt, // Prevent creation time change
      updatedAt: new Date(),
    };

    this.goals.set(id, updated);
    return updated;
  }

  /**
   * Delete a goal
   */
  deleteGoal(id: GoalId): boolean {
    const goal = this.goals.get(id);
    if (!goal) return false;

    // Remove from parent's children list
    if (goal.parentId) {
      const parent = this.goals.get(goal.parentId);
      if (parent && parent.children) {
        parent.children = parent.children.filter(childId => childId !== id);
      }
    }

    // Orphan children
    if (goal.children) {
      for (const childId of goal.children) {
        const child = this.goals.get(childId);
        if (child) {
          child.parentId = undefined;
        }
      }
    }

    return this.goals.delete(id);
  }

  /**
   * List all goals
   */
  listGoals(): Goal[] {
    return Array.from(this.goals.values());
  }

  /**
   * Find goals by status
   */
  findByStatus(status: GoalStatus): Goal[] {
    return this.listGoals().filter(g => g.status === status);
  }

  /**
   * Find goals by tag
   */
  findByTag(tag: string): Goal[] {
    return this.listGoals().filter(g => g.tags?.includes(tag));
  }

  /**
   * Find goals by owner
   */
  findByOwner(owner: string): Goal[] {
    return this.listGoals().filter(g => g.owner === owner);
  }

  /**
   * Get child goals
   */
  getChildren(parentId: GoalId): Goal[] {
    const parent = this.goals.get(parentId);
    if (!parent || !parent.children) return [];
    return parent.children
      .map(id => this.goals.get(id))
      .filter((g): g is Goal => g !== undefined);
  }

  /**
   * Get parent goal
   */
  getParent(childId: GoalId): Goal | undefined {
    const child = this.goals.get(childId);
    if (!child || !child.parentId) return undefined;
    return this.goals.get(child.parentId);
  }

  /**
   * Get the root goal (top of hierarchy)
   */
  getRootGoal(goalId: GoalId): Goal {
    let current = this.goals.get(goalId);
    if (!current) throw new Error(`Goal not found: ${goalId}`);

    while (current.parentId) {
      const parent = this.goals.get(current.parentId);
      if (!parent) break;
      current = parent;
    }

    return current;
  }

  /**
   * Get all ancestors of a goal
   */
  getAncestors(goalId: GoalId): Goal[] {
    const ancestors: Goal[] = [];
    let current = this.goals.get(goalId);

    while (current?.parentId) {
      const parent = this.goals.get(current.parentId);
      if (!parent) break;
      ancestors.push(parent);
      current = parent;
    }

    return ancestors.reverse();
  }

  /**
   * Get all descendants of a goal (children, grandchildren, etc.)
   */
  getDescendants(goalId: GoalId): Goal[] {
    const descendants: Goal[] = [];
    const goal = this.goals.get(goalId);
    if (!goal || !goal.children) return descendants;

    const queue = [...goal.children];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const child = this.goals.get(id);
      if (child) {
        descendants.push(child);
        if (child.children) {
          queue.push(...child.children);
        }
      }
    }

    return descendants;
  }

  /**
   * Add a must-have to an existing goal
   */
  addMustHaveToGoal(goalId: GoalId, mustHave: MustHave): Goal | undefined {
    const goal = this.goals.get(goalId);
    if (!goal) return undefined;

    goal.mustHaves.push(mustHave);
    goal.updatedAt = new Date();
    return goal;
  }

  /**
   * Remove a must-have from a goal
   */
  removeMustHaveFromGoal(goalId: GoalId, mustHaveId: string): Goal | undefined {
    const goal = this.goals.get(goalId);
    if (!goal) return undefined;

    goal.mustHaves = goal.mustHaves.filter(mh => mh.id !== mustHaveId);
    goal.updatedAt = new Date();
    return goal;
  }

  /**
   * Clear all goals
   */
  clear(): void {
    this.goals.clear();
  }

  /**
   * Get the number of goals
   */
  get size(): number {
    return this.goals.size;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a goal is fully satisfied (all required must-haves satisfied)
 */
export function isGoalSatisfied(goal: Goal): boolean {
  const requiredMustHaves = goal.mustHaves.filter(mh => mh.required);
  if (requiredMustHaves.length === 0) return true;

  return requiredMustHaves.every(mh => mh.status === 'satisfied');
}

/**
 * Calculate the completion percentage of a goal
 */
export function calculateCompletion(goal: Goal): number {
  if (goal.mustHaves.length === 0) return 100;

  const totalWeight = goal.mustHaves.reduce((sum, mh) => sum + mh.weight, 0);
  if (totalWeight === 0) return 100;

  const satisfiedWeight = goal.mustHaves
    .filter(mh => mh.status === 'satisfied')
    .reduce((sum, mh) => sum + mh.weight, 0);

  return Math.round((satisfiedWeight / totalWeight) * 100);
}

/**
 * Get the next status for a goal based on must-have states
 */
export function deriveGoalStatus(goal: Goal): GoalStatus {
  const completion = calculateCompletion(goal);

  if (completion === 100) return 'verified';
  if (completion === 0) return 'pending';

  const hasFailures = goal.mustHaves.some(
    mh => mh.required && mh.status === 'failed'
  );
  if (hasFailures) return 'failed';

  return 'partial';
}

/**
 * Serialize a goal to JSON
 */
export function serializeGoal(goal: Goal): string {
  return JSON.stringify(goal, null, 2);
}

/**
 * Deserialize a goal from JSON
 */
export function deserializeGoal(json: string): Goal {
  const parsed = JSON.parse(json);

  // Convert date strings back to Date objects
  if (parsed.createdAt) parsed.createdAt = new Date(parsed.createdAt);
  if (parsed.updatedAt) parsed.updatedAt = new Date(parsed.updatedAt);
  if (parsed.deadline) parsed.deadline = new Date(parsed.deadline);

  // Convert must-have dates
  if (parsed.mustHaves) {
    parsed.mustHaves = parsed.mustHaves.map((mh: Record<string, unknown>) => ({
      ...mh,
      createdAt: new Date(mh.createdAt as string),
      lastCheckedAt: mh.lastCheckedAt ? new Date(mh.lastCheckedAt as string) : undefined,
    }));
  }

  return parsed as Goal;
}
