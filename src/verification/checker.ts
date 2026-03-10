/**
 * Backward Verification Algorithm
 *
 * Implements goal-backward verification that starts from the goal and works
 * backwards through must-have criteria to verify achievement.
 *
 * The backward approach:
 * 1. Start with the end goal
 * 2. Identify all must-have criteria
 * 3. Check each must-have (working backwards from most critical)
 * 4. Identify gaps between current state and requirements
 * 5. Report on what remains to achieve the goal
 */

import {
  type Goal,
  type GoalId,
  type MustHave,
  type MustHaveResult,
  type Gap,
  type GapSeverity,
  type VerificationResult,
  type VerificationStats,
  type BackwardVerificationContext,
  type CheckerOptions,
  type VerificationStep,
} from './types';
import { validateMustHave, calculateWeightedSatisfaction } from './must-have';
import { calculateCompletion, deriveGoalStatus } from './goal';

// ============================================================================
// Gap Detection
// ============================================================================

let gapIdCounter = 0;

/**
 * Generate a unique gap ID
 */
function generateGapId(): string {
  return `gap-${Date.now()}-${++gapIdCounter}`;
}

/**
 * Determine gap severity based on must-have properties
 */
function determineGapSeverity(
  mustHave: MustHave,
  result: MustHaveResult
): GapSeverity {
  if (!mustHave.required) return 'info';

  // Critical: required must-have with high weight
  if (mustHave.weight >= 0.8) return 'critical';

  // Major: required must-have with medium weight
  if (mustHave.weight >= 0.5) return 'major';

  // Minor: required must-have with low weight
  return 'minor';
}

/**
 * Generate remediation suggestions for a gap
 */
function generateRemediation(
  mustHave: MustHave,
  result: MustHaveResult
): string[] {
  const remediation: string[] = [];

  switch (mustHave.type) {
    case 'existence':
      remediation.push(`Create the missing file/directory: ${mustHave.target}`);
      remediation.push(`Ensure the path is correct: ${mustHave.target}`);
      break;

    case 'value':
      if (result.actual === null || result.actual === undefined) {
        remediation.push(`Set the value for: ${mustHave.target}`);
      } else {
        remediation.push(
          `Update ${mustHave.target} to match expected value: ${JSON.stringify(mustHave.expected)}`
        );
      }
      if (mustHave.operator) {
        remediation.push(`Ensure the value satisfies operator: ${mustHave.operator}`);
      }
      break;

    case 'structure':
      remediation.push(`Restructure ${mustHave.target} to match expected format`);
      if (typeof mustHave.expected === 'object') {
        remediation.push(`Add missing properties/fields as defined in the expected structure`);
      }
      break;

    case 'relation':
      if (mustHave.relatedTarget) {
        remediation.push(
          `Establish ${mustHave.relationType} relationship between ${mustHave.target} and ${mustHave.relatedTarget}`
        );
        remediation.push(`Ensure ${mustHave.relatedTarget} exists and is properly referenced`);
      }
      break;
  }

  return remediation;
}

/**
 * Create a gap from a failed must-have result
 */
function createGap(
  mustHave: MustHave,
  goalId: GoalId,
  result: MustHaveResult
): Gap {
  const severity = determineGapSeverity(mustHave, result);
  const blocking = mustHave.required && severity === 'critical';

  return {
    id: generateGapId(),
    description: result.message || `Failed: ${mustHave.description}`,
    severity,
    mustHaveId: mustHave.id,
    goalId,
    expected: mustHave.expected ?? mustHave.target,
    actual: result.actual,
    remediation: generateRemediation(mustHave, result),
    estimatedEffort: blocking ? 8 : severity === 'major' ? 5 : severity === 'minor' ? 2 : 1,
    blocking,
    identifiedAt: new Date(),
  };
}

// ============================================================================
// Backward Verification Algorithm
// ============================================================================

/**
 * Default verification context
 */
function createDefaultContext(
  options: CheckerOptions = {}
): BackwardVerificationContext {
  return {
    workingDir: options.workingDir ?? process.cwd(),
    env: options.env ?? {},
    stopOnFailure: options.stopOnFailure ?? false,
    checkTimeout: options.checkTimeout ?? 30000,
    maxDepth: options.maxDepth ?? 10,
    currentDepth: 0,
    gaps: [],
  };
}

/**
 * Verify a single must-have with timeout handling
 */
async function verifyMustHaveWithTimeout(
  mustHave: MustHave,
  context: BackwardVerificationContext
): Promise<MustHaveResult> {
  const timeoutPromise = new Promise<MustHaveResult>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Verification timeout for must-have: ${mustHave.id}`));
    }, context.checkTimeout);
  });

  try {
    const result = await Promise.race([
      validateMustHave(mustHave, context.workingDir),
      timeoutPromise,
    ]);
    return result;
  } catch (error) {
    return {
      mustHaveId: mustHave.id,
      satisfied: false,
      message: error instanceof Error ? error.message : String(error),
      checkedAt: new Date(),
      duration: context.checkTimeout,
    };
  }
}

/**
 * Perform backward verification on a goal
 *
 * The algorithm works as follows:
 * 1. Start with the goal
 * 2. Sort must-haves by criticality (required first, then by weight)
 * 3. Check each must-have, working backwards from most critical
 * 4. For each failure, create a gap
 * 5. Calculate completion percentage
 * 6. Return comprehensive result
 */
export async function verifyGoalBackward(
  goal: Goal,
  context: BackwardVerificationContext
): Promise<VerificationResult> {
  const startTime = Date.now();
  const mustHaveResults: MustHaveResult[] = [];
  const gaps: Gap[] = [];

  // Sort must-haves: required first, then by weight (descending)
  const sortedMustHaves = [...goal.mustHaves].sort((a, b) => {
    if (a.required !== b.required) {
      return a.required ? -1 : 1;
    }
    return b.weight - a.weight;
  });

  // Check each must-have
  for (const mustHave of sortedMustHaves) {
    const result = await verifyMustHaveWithTimeout(mustHave, context);
    mustHaveResults.push(result);

    if (!result.satisfied) {
      const gap = createGap(mustHave, goal.id, result);
      gaps.push(gap);

      if (context.stopOnFailure && mustHave.required) {
        break;
      }
    }
  }

  // Calculate statistics
  const satisfied = mustHaveResults.filter(r => r.satisfied).length;
  const failed = mustHaveResults.filter(r => !r.satisfied).length;
  const weighted = calculateWeightedSatisfaction(goal.mustHaves);

  const stats: VerificationStats = {
    totalMustHaves: goal.mustHaves.length,
    satisfied,
    failed,
    pending: goal.mustHaves.length - satisfied - failed,
    criticalGaps: gaps.filter(g => g.severity === 'critical').length,
    majorGaps: gaps.filter(g => g.severity === 'major').length,
    minorGaps: gaps.filter(g => g.severity === 'minor').length,
    weightedSatisfaction: weighted.percentage,
  };

  // Determine if goal is achieved
  const requiredMustHaves = goal.mustHaves.filter(mh => mh.required);
  const requiredSatisfied = requiredMustHaves.every(
    mh => mh.status === 'satisfied'
  );

  // Update goal status
  goal.status = deriveGoalStatus(goal);
  goal.updatedAt = new Date();

  const duration = Date.now() - startTime;

  return {
    goalId: goal.id,
    achieved: requiredSatisfied,
    completionPercentage: calculateCompletion(goal),
    mustHaveResults,
    gaps,
    stats,
    verifiedAt: new Date(),
    duration,
    method: 'backward',
  };
}

/**
 * Verify multiple goals with dependency resolution
 *
 * If goals have parent-child relationships, verify children first
 * then verify parents (bottom-up within backward approach).
 */
export async function verifyGoalsBackward(
  goals: Goal[],
  options: CheckerOptions = {}
): Promise<VerificationResult[]> {
  const context = createDefaultContext(options);
  const results: VerificationResult[] = [];

  // Sort goals: leaf goals (no children) first, then parents
  const goalMap = new Map(goals.map(g => [g.id, g]));
  const sortedGoals = [...goals].sort((a, b) => {
    const aIsLeaf = !a.children || a.children.length === 0;
    const bIsLeaf = !b.children || b.children.length === 0;
    if (aIsLeaf !== bIsLeaf) {
      return aIsLeaf ? -1 : 1;
    }
    return (b.priority || 0) - (a.priority || 0);
  });

  for (const goal of sortedGoals) {
    const result = await verifyGoalBackward(goal, context);
    results.push(result);

    if (context.stopOnFailure && !result.achieved) {
      break;
    }
  }

  return results;
}

// ============================================================================
// Verification Steps Tracking
// ============================================================================

/**
 * Track detailed verification steps for debugging/analysis
 */
export async function verifyWithSteps(
  goal: Goal,
  options: CheckerOptions = {}
): Promise<{ result: VerificationResult; steps: VerificationStep[] }> {
  const steps: VerificationStep[] = [];
  let stepNumber = 0;

  // Create a wrapper context that tracks steps
  const context = createDefaultContext(options);
  const originalWorkingDir = context.workingDir;

  // Sort must-haves by criticality
  const sortedMustHaves = [...goal.mustHaves].sort((a, b) => {
    if (a.required !== b.required) {
      return a.required ? -1 : 1;
    }
    return b.weight - a.weight;
  });

  // Check each must-have with step tracking
  for (const mustHave of sortedMustHaves) {
    const stepStart = Date.now();
    stepNumber++;

    const result = await verifyMustHaveWithTimeout(mustHave, context);

    const step: VerificationStep = {
      step: stepNumber,
      mustHaveId: mustHave.id,
      description: `Check: ${mustHave.description}`,
      passed: result.satisfied,
      timestamp: new Date(),
      duration: Date.now() - stepStart,
    };

    steps.push(step);

    if (!result.satisfied && context.stopOnFailure && mustHave.required) {
      break;
    }
  }

  // Now run the full verification to get the complete result
  const result = await verifyGoalBackward(goal, context);

  return { result, steps };
}

// ============================================================================
// Gap Analysis
// ============================================================================

/**
 * Analyze gaps across multiple verification results
 */
export function analyzeGaps(results: VerificationResult[]): {
  totalGaps: number;
  criticalGaps: number;
  blockingGaps: number;
  gapsByGoal: Map<GoalId, Gap[]>;
  topRemediation: string[];
} {
  const allGaps = results.flatMap(r => r.gaps);
  const gapsByGoal = new Map<GoalId, Gap[]>();

  for (const result of results) {
    gapsByGoal.set(result.goalId, result.gaps);
  }

  // Collect all remediation steps and count occurrences
  const remediationCount = new Map<string, number>();
  for (const gap of allGaps) {
    for (const step of gap.remediation || []) {
      remediationCount.set(step, (remediationCount.get(step) || 0) + 1);
    }
  }

  // Sort by frequency
  const topRemediation = Array.from(remediationCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([step]) => step);

  return {
    totalGaps: allGaps.length,
    criticalGaps: allGaps.filter(g => g.severity === 'critical').length,
    blockingGaps: allGaps.filter(g => g.blocking).length,
    gapsByGoal,
    topRemediation,
  };
}

/**
 * Get blocking gaps that prevent goal achievement
 */
export function getBlockingGaps(results: VerificationResult[]): Gap[] {
  return results.flatMap(r => r.gaps.filter(g => g.blocking));
}

/**
 * Estimate total effort to resolve all gaps
 */
export function estimateRemediationEffort(results: VerificationResult[]): {
  total: number;
  bySeverity: Record<GapSeverity, number>;
} {
  const allGaps = results.flatMap(r => r.gaps);

  const bySeverity: Record<GapSeverity, number> = {
    critical: 0,
    major: 0,
    minor: 0,
    info: 0,
  };

  let total = 0;

  for (const gap of allGaps) {
    const effort = gap.estimatedEffort || 0;
    total += effort;
    bySeverity[gap.severity] += effort;
  }

  return { total, bySeverity };
}

// ============================================================================
// Verification Checker Class
// ============================================================================

/**
 * Main checker class for goal-backward verification
 */
export class VerificationChecker {
  private context: BackwardVerificationContext;

  constructor(options: CheckerOptions = {}) {
    this.context = createDefaultContext(options);
  }

  /**
   * Verify a single goal
   */
  async verify(goal: Goal): Promise<VerificationResult> {
    return verifyGoalBackward(goal, this.context);
  }

  /**
   * Verify multiple goals
   */
  async verifyAll(goals: Goal[]): Promise<VerificationResult[]> {
    return verifyGoalsBackward(goals, {
      workingDir: this.context.workingDir,
      env: this.context.env,
      stopOnFailure: this.context.stopOnFailure,
      checkTimeout: this.context.checkTimeout,
      maxDepth: this.context.maxDepth,
    });
  }

  /**
   * Verify with detailed step tracking
   */
  async verifyWithSteps(
    goal: Goal
  ): Promise<{ result: VerificationResult; steps: VerificationStep[] }> {
    return verifyWithSteps(goal, {
      workingDir: this.context.workingDir,
      env: this.context.env,
      stopOnFailure: this.context.stopOnFailure,
      checkTimeout: this.context.checkTimeout,
      maxDepth: this.context.maxDepth,
    });
  }

  /**
   * Update checker options
   */
  setOptions(options: Partial<CheckerOptions>): void {
    if (options.workingDir !== undefined) {
      this.context.workingDir = options.workingDir;
    }
    if (options.env !== undefined) {
      this.context.env = options.env;
    }
    if (options.stopOnFailure !== undefined) {
      this.context.stopOnFailure = options.stopOnFailure;
    }
    if (options.checkTimeout !== undefined) {
      this.context.checkTimeout = options.checkTimeout;
    }
    if (options.maxDepth !== undefined) {
      this.context.maxDepth = options.maxDepth;
    }
  }

  /**
   * Get current context
   */
  getContext(): Readonly<BackwardVerificationContext> {
    return { ...this.context };
  }
}

// ============================================================================
// Utility Exports
// ============================================================================

export {
  createGap,
  determineGapSeverity,
  generateRemediation,
  createDefaultContext,
  verifyMustHaveWithTimeout,
};
