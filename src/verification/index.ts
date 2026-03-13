/**
 * Goal-Backward Verification System
 *
 * Main entry point for the verification system. Provides a high-level API
 * for defining goals, verifying them using backward chaining, and generating reports.
 *
 * @example
 * ```typescript
 * import { VerificationSystem } from './verification';
 *
 * const system = new VerificationSystem();
 *
 * const goal = system.createGoal({
 *   title: 'Implement Feature X',
 *   description: 'Add feature X to the codebase',
 *   mustHaves: [
 *     existenceMustHave('src/feature.ts', 'Feature file exists'),
 *     valueMustHave('package.json', 'Feature is listed in dependencies', 'feature-x', 'contains')
 *   ]
 * });
 *
 * const result = await system.verify(goal.id);
 * console.log(result.achieved); // true/false
 * ```
 */

// ============================================================================
// Re-exports from submodules
// ============================================================================

// Types
export type {
  Goal,
  GoalId,
  GoalStatus,
  MustHave,
  MustHaveId,
  MustHaveType,
  MustHaveStatus,
  MustHaveResult,
  Gap,
  GapSeverity,
  VerificationResult,
  VerificationStats,
  VerificationReport,
  ReportSummary,
  ReportFormat,
  ReportOptions,
  CreateGoalOptions,
  UpdateGoalOptions,
  CreateMustHaveOptions,
  ValueOperator,
  BackwardVerificationContext,
  CheckerOptions,
  VerificationStep,
  VerificationStorage,
  VerifyCommandOptions,
  GoalsCommandOptions,
  CreateGoalCommandOptions,
} from './types';

// Goal management
export {
  GoalBuilder,
  GoalManager,
  MustHaveBuilder,
  generateGoalId,
  generateMustHaveId,
  isGoalSatisfied,
  calculateCompletion,
  deriveGoalStatus,
  serializeGoal,
  deserializeGoal,
} from './goal';

// Must-have validation
export {
  createMustHave,
  existenceMustHave,
  valueMustHave,
  structureMustHave,
  relationMustHave,
  validateMustHave,
  validateMustHaves,
  applyOperator,
  filterByType,
  getRequiredMustHaves,
  getOptionalMustHaves,
  calculateWeightedSatisfaction,
  resetMustHaves,
} from './must-have';

// Backward verification
export {
  VerificationChecker,
  verifyGoalBackward,
  verifyGoalsBackward,
  verifyWithSteps,
  analyzeGaps,
  getBlockingGaps,
  estimateRemediationEffort,
} from './checker';

// Report generation
export {
  ReportBuilder,
  generateReport,
  generateJSON,
  generateMarkdown,
  generateHTML,
  generateConsole,
  generateSummary,
  generateRecommendations,
  createReport,
  writeReport,
  filterGapsBySeverity,
  severityColors,
  severityIcons,
} from './report';

// Fix plan generation (Issue #18)
export {
  FixPlanGenerator,
  createFixPlanGenerator,
  generateFixPlansFromResults,
} from './fix-plan';

export type {
  FixPlan,
  FixEntry,
  FixPlanGeneratorOptions,
} from './fix-plan';

// ============================================================================
// Main VerificationSystem Class
// ============================================================================

import { GoalManager, calculateCompletion } from './goal';
import { VerificationChecker } from './checker';
import { ReportBuilder } from './report';
import type {
  Goal,
  GoalId,
  CreateGoalOptions,
  UpdateGoalOptions,
  MustHave,
  VerificationResult,
  VerificationReport,
  ReportOptions,
  ReportFormat,
  CheckerOptions,
  VerificationStorage,
} from './types';

/**
 * Configuration options for VerificationSystem
 */
export interface VerificationSystemOptions {
  /** Working directory for verification checks */
  workingDir?: string;
  /** Whether to persist results to storage */
  persistResults?: boolean;
  /** Storage adapter for persistence */
  storage?: VerificationStorage;
  /** Default checker options */
  checkerOptions?: CheckerOptions;
}

/**
 * Main class for the goal-backward verification system
 *
 * Provides a unified API for:
 * - Creating and managing goals
 * - Defining must-have criteria
 * - Running backward verification
 * - Generating reports
 * - Persisting results (optional)
 */
export class VerificationSystem {
  private goalManager: GoalManager;
  private checker: VerificationChecker;
  private reportBuilder: ReportBuilder;
  private storage?: VerificationStorage;
  private persistResults: boolean;

  /**
   * Create a new VerificationSystem instance
   */
  constructor(options: VerificationSystemOptions = {}) {
    this.goalManager = new GoalManager();
    // Merge workingDir into checkerOptions if provided
    const checkerOptions: CheckerOptions = {
      workingDir: options.workingDir,
      ...options.checkerOptions,
    };
    this.checker = new VerificationChecker(checkerOptions);
    this.reportBuilder = new ReportBuilder();
    this.storage = options.storage;
    this.persistResults = options.persistResults ?? false;
  }

  // ========================================================================
  // Goal Management
  // ========================================================================

  /**
   * Create a new goal
   */
  createGoal(options: CreateGoalOptions): Goal {
    return this.goalManager.createGoal(options);
  }

  /**
   * Get a goal by ID
   */
  getGoal(id: GoalId): Goal | undefined {
    return this.goalManager.getGoal(id);
  }

  /**
   * Update a goal
   */
  updateGoal(id: GoalId, updates: UpdateGoalOptions): Goal | undefined {
    return this.goalManager.updateGoal(id, updates);
  }

  /**
   * Delete a goal
   */
  deleteGoal(id: GoalId): boolean {
    return this.goalManager.deleteGoal(id);
  }

  /**
   * List all goals
   */
  listGoals(): Goal[] {
    return this.goalManager.listGoals();
  }

  /**
   * Find goals by status
   */
  findGoalsByStatus(status: Goal['status']): Goal[] {
    return this.goalManager.findByStatus(status);
  }

  /**
   * Find goals by tag
   */
  findGoalsByTag(tag: string): Goal[] {
    return this.goalManager.findByTag(tag);
  }

  /**
   * Get child goals
   */
  getChildGoals(parentId: GoalId): Goal[] {
    return this.goalManager.getChildren(parentId);
  }

  /**
   * Get parent goal
   */
  getParentGoal(childId: GoalId): Goal | undefined {
    return this.goalManager.getParent(childId);
  }

  // ========================================================================
  // Must-Have Management
  // ========================================================================

  /**
   * Add a must-have to an existing goal
   */
  addMustHave(goalId: GoalId, mustHave: MustHave): Goal | undefined {
    return this.goalManager.addMustHaveToGoal(goalId, mustHave);
  }

  /**
   * Remove a must-have from a goal
   */
  removeMustHave(goalId: GoalId, mustHaveId: string): Goal | undefined {
    return this.goalManager.removeMustHaveFromGoal(goalId, mustHaveId);
  }

  // ========================================================================
  // Verification
  // ========================================================================

  /**
   * Verify a single goal using backward verification
   */
  async verify(goalId: GoalId): Promise<VerificationResult> {
    const goal = this.goalManager.getGoal(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const result = await this.checker.verify(goal);

    // Add to report builder
    this.reportBuilder.addResult(result);

    // Persist if enabled
    if (this.persistResults && this.storage) {
      await this.storage.saveResult(result);
    }

    return result;
  }

  /**
   * Verify multiple goals
   */
  async verifyAll(goalIds?: GoalId[]): Promise<VerificationResult[]> {
    const goals = goalIds
      ? goalIds.map(id => this.goalManager.getGoal(id)).filter((g): g is Goal => g !== undefined)
      : this.goalManager.listGoals();

    const results = await this.checker.verifyAll(goals);

    // Add to report builder
    this.reportBuilder.addResults(results);

    // Persist if enabled
    if (this.persistResults && this.storage) {
      for (const result of results) {
        await this.storage.saveResult(result);
      }
    }

    return results;
  }

  /**
   * Verify all goals with a specific tag
   */
  async verifyByTag(tag: string): Promise<VerificationResult[]> {
    const goals = this.goalManager.findByTag(tag);
    return this.checker.verifyAll(goals);
  }

  /**
   * Verify goals and return detailed step information
   */
  async verifyWithSteps(goalId: GoalId): Promise<{
    result: VerificationResult;
    steps: import('./types').VerificationStep[];
  }> {
    const goal = this.goalManager.getGoal(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    return this.checker.verifyWithSteps(goal);
  }

  // ========================================================================
  // Reporting
  // ========================================================================

  /**
   * Generate a report from all verification results
   */
  generateReport(format: ReportFormat = 'console', verbose = false): string {
    return this.reportBuilder.generate(format, verbose);
  }

  /**
   * Build a verification report object
   */
  buildReport(): VerificationReport {
    return this.reportBuilder.build();
  }

  /**
   * Write report to file
   */
  async writeReport(options: ReportOptions): Promise<void> {
    await this.reportBuilder.write(options);
  }

  /**
   * Clear all verification results from the report builder
   */
  clearReport(): void {
    this.reportBuilder.clear();
  }

  // ========================================================================
  // Configuration
  // ========================================================================

  /**
   * Update checker options
   */
  setCheckerOptions(options: CheckerOptions): void {
    this.checker.setOptions(options);
  }

  /**
   * Set the working directory for verification
   */
  setWorkingDir(workingDir: string): void {
    this.checker.setOptions({ workingDir });
  }

  /**
   * Enable or disable result persistence
   */
  setPersistence(enabled: boolean): void {
    this.persistResults = enabled;
  }

  /**
   * Set the storage adapter
   */
  setStorage(storage: VerificationStorage): void {
    this.storage = storage;
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  /**
   * Get overall verification statistics
   */
  getStatistics(): {
    totalGoals: number;
    verifiedGoals: number;
    failedGoals: number;
    partialGoals: number;
    overallCompletion: number;
  } {
    const goals = this.goalManager.listGoals();
    const verified = goals.filter(g => g.status === 'verified').length;
    const failed = goals.filter(g => g.status === 'failed').length;
    const partial = goals.filter(g => g.status === 'partial').length;

    const overallCompletion = goals.length > 0
      ? goals.reduce((sum, g) => sum + calculateCompletion(g), 0) / goals.length
      : 0;

    return {
      totalGoals: goals.length,
      verifiedGoals: verified,
      failedGoals: failed,
      partialGoals: partial,
      overallCompletion: Math.round(overallCompletion),
    };
  }

  /**
   * Get the goal manager instance (for advanced usage)
   */
  getGoalManager(): GoalManager {
    return this.goalManager;
  }

  /**
   * Get the verification checker instance (for advanced usage)
   */
  getChecker(): VerificationChecker {
    return this.checker;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new VerificationSystem with default configuration
 */
export function createVerificationSystem(
  options: VerificationSystemOptions = {}
): VerificationSystem {
  return new VerificationSystem(options);
}

/**
 * Quick verification of a single goal
 *
 * @example
 * ```typescript
 * const result = await quickVerify({
 *   title: 'Test Goal',
 *   description: 'A test goal',
 *   mustHaves: [
 *     existenceMustHave('src/index.ts', 'Entry point exists')
 *   ]
 * });
 * ```
 */
export async function quickVerify(
  goalOptions: CreateGoalOptions,
  checkerOptions?: CheckerOptions
): Promise<VerificationResult> {
  const system = new VerificationSystem({ checkerOptions });
  const goal = system.createGoal(goalOptions);
  return system.verify(goal.id);
}

// ============================================================================
// Default Export
// ============================================================================

export default VerificationSystem;
