/**
 * Goal-Backward Verification System - Type Definitions
 *
 * This module defines the core types for goal-backward verification,
 * which validates whether a goal has been achieved by checking "must-haves".
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Unique identifier for a goal
 */
export type GoalId = string;

/**
 * Unique identifier for a must-have criterion
 */
export type MustHaveId = string;

/**
 * Status of a goal in the verification lifecycle
 */
export type GoalStatus =
  | 'pending'
  | 'in_progress'
  | 'verified'
  | 'failed'
  | 'partial';

/**
 * Status of an individual must-have criterion
 */
export type MustHaveStatus =
  | 'pending'
  | 'checking'
  | 'satisfied'
  | 'failed'
  | 'skipped';

/**
 * Severity level for verification gaps
 */
export type GapSeverity = 'critical' | 'major' | 'minor' | 'info';

// ============================================================================
// Goal Types
// ============================================================================

/**
 * A goal represents what needs to be achieved
 */
export interface Goal {
  /** Unique identifier */
  id: GoalId;
  /** Human-readable title */
  title: string;
  /** Detailed description of what should be achieved */
  description: string;
  /** Current status */
  status: GoalStatus;
  /** Must-have criteria that define success */
  mustHaves: MustHave[];
  /** Optional parent goal for hierarchical goals */
  parentId?: GoalId;
  /** Child goal IDs */
  children?: GoalId[];
  /** Priority level (higher = more important) */
  priority: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Tags for categorization */
  tags?: string[];
  /** Owner/agent responsible */
  owner?: string;
  /** Deadline for completion */
  deadline?: Date;
}

/**
 * Options for creating a new goal
 */
export interface CreateGoalOptions {
  title: string;
  description: string;
  mustHaves?: MustHave[];
  parentId?: GoalId;
  priority?: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
  owner?: string;
  deadline?: Date;
}

/**
 * Options for updating a goal
 */
export interface UpdateGoalOptions {
  title?: string;
  description?: string;
  status?: GoalStatus;
  priority?: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
  owner?: string;
  deadline?: Date;
}

// ============================================================================
// Must-Have Types
// ============================================================================

/**
 * Type of must-have criterion - defines what aspect to verify
 */
export type MustHaveType =
  | 'existence'      // File, function, or entity exists
  | 'value'          // Value matches expected (equality, range, etc.)
  | 'structure'      // Structure matches schema/pattern
  | 'relation';      // Relationship between entities exists

/**
 * Operator for value-based must-haves
 */
export type ValueOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'matches_regex'
  | 'greater_than'
  | 'less_than'
  | 'in_range'
  | 'one_of';

/**
 * A must-have criterion defines a requirement that must be satisfied
 */
export interface MustHave {
  /** Unique identifier */
  id: MustHaveId;
  /** Human-readable description of the requirement */
  description: string;
  /** Type of criterion */
  type: MustHaveType;
  /** Current status */
  status: MustHaveStatus;
  /** Target to verify (file path, API endpoint, etc.) */
  target: string;
  /** Expected value or pattern (for value/structure types) */
  expected?: unknown;
  /** Operator for comparison (for value type) */
  operator?: ValueOperator;
  /** Related target for relation type */
  relatedTarget?: string;
  /** Relation type for relation must-haves */
  relationType?: 'depends_on' | 'references' | 'contains' | 'extends';
  /** Whether this must-have is required (false = optional) */
  required: boolean;
  /** Weight for partial fulfillment calculation (0-1) */
  weight: number;
  /** Custom validation function (optional) */
  validator?: (actual: unknown) => boolean;
  /** Error message template for failures */
  errorMessage?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last check timestamp */
  lastCheckedAt?: Date;
  /** Result of last check */
  lastResult?: MustHaveResult;
}

/**
 * Options for creating a must-have criterion
 */
export interface CreateMustHaveOptions {
  description: string;
  type: MustHaveType;
  target: string;
  expected?: unknown;
  operator?: ValueOperator;
  relatedTarget?: string;
  relationType?: MustHave['relationType'];
  required?: boolean;
  weight?: number;
  validator?: (actual: unknown) => boolean;
  errorMessage?: string;
}

/**
 * Result of checking a single must-have
 */
export interface MustHaveResult {
  /** The must-have that was checked */
  mustHaveId: MustHaveId;
  /** Whether the must-have is satisfied */
  satisfied: boolean;
  /** Actual value found (if applicable) */
  actual?: unknown;
  /** Error or failure message */
  message?: string;
  /** Timestamp of the check */
  checkedAt: Date;
  /** Duration of the check in ms */
  duration: number;
  /** Additional details */
  details?: Record<string, unknown>;
}

// ============================================================================
// Gap Types
// ============================================================================

/**
 * A gap represents the difference between current state and goal requirements
 */
export interface Gap {
  /** Unique identifier */
  id: string;
  /** Human-readable description of the gap */
  description: string;
  /** Severity level */
  severity: GapSeverity;
  /** Related must-have ID */
  mustHaveId: MustHaveId;
  /** Related goal ID */
  goalId: GoalId;
  /** What is missing or incorrect */
  expected: unknown;
  /** What was actually found */
  actual?: unknown;
  /** Suggested remediation steps */
  remediation?: string[];
  /** Estimated effort to fix (story points or hours) */
  estimatedEffort?: number;
  /** Whether this gap blocks goal achievement */
  blocking: boolean;
  /** Timestamp when gap was identified */
  identifiedAt: Date;
}

/**
 * Options for creating a gap
 */
export interface CreateGapOptions {
  description: string;
  severity: GapSeverity;
  mustHaveId: MustHaveId;
  goalId: GoalId;
  expected: unknown;
  actual?: unknown;
  remediation?: string[];
  estimatedEffort?: number;
  blocking?: boolean;
}

// ============================================================================
// Verification Result Types
// ============================================================================

/**
 * Overall result of verifying a goal
 */
export interface VerificationResult {
  /** The goal that was verified */
  goalId: GoalId;
  /** Whether the goal is fully achieved */
  achieved: boolean;
  /** Percentage of must-haves satisfied (0-100) */
  completionPercentage: number;
  /** Results for each must-have */
  mustHaveResults: MustHaveResult[];
  /** Gaps identified during verification */
  gaps: Gap[];
  /** Summary statistics */
  stats: VerificationStats;
  /** Timestamp of verification */
  verifiedAt: Date;
  /** Duration of verification in ms */
  duration: number;
  /** Verification method used */
  method: 'backward' | 'forward' | 'hybrid';
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Statistics for a verification run
 */
export interface VerificationStats {
  /** Total number of must-haves */
  totalMustHaves: number;
  /** Number of satisfied must-haves */
  satisfied: number;
  /** Number of failed must-haves */
  failed: number;
  /** Number of pending/skipped must-haves */
  pending: number;
  /** Number of critical gaps */
  criticalGaps: number;
  /** Number of major gaps */
  majorGaps: number;
  /** Number of minor gaps */
  minorGaps: number;
  /** Total weight of satisfied must-haves */
  weightedSatisfaction: number;
}

// ============================================================================
// Checker Types
// ============================================================================

/**
 * Context for the backward verification algorithm
 */
export interface BackwardVerificationContext {
  /** Working directory for file-based checks */
  workingDir: string;
  /** Environment variables */
  env: Record<string, string>;
  /** Whether to stop on first failure */
  stopOnFailure: boolean;
  /** Timeout per check in ms */
  checkTimeout: number;
  /** Maximum depth for recursive checks */
  maxDepth: number;
  /** Current depth (used internally) */
  currentDepth?: number;
  /** Collected gaps (used internally) */
  gaps?: Gap[];
  /** Parent verification context (for nested goals) */
  parentContext?: BackwardVerificationContext;
}

/**
 * Options for configuring the verification checker
 */
export interface CheckerOptions {
  /** Working directory */
  workingDir?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Stop on first failure */
  stopOnFailure?: boolean;
  /** Timeout per check in ms */
  checkTimeout?: number;
  /** Maximum recursion depth */
  maxDepth?: number;
}

/**
 * Result of a single verification step in backward chaining
 */
export interface VerificationStep {
  /** Step number */
  step: number;
  /** Must-have being checked */
  mustHaveId: MustHaveId;
  /** Description of the step */
  description: string;
  /** Whether this step passed */
  passed: boolean;
  /** Sub-steps for complex verifications */
  subSteps?: VerificationStep[];
  /** Dependencies checked before this step */
  dependencies?: VerificationStep[];
  /** Timestamp */
  timestamp: Date;
  /** Duration in ms */
  duration: number;
}

// ============================================================================
// Report Types
// ============================================================================

/**
 * Format for verification reports
 */
export type ReportFormat = 'json' | 'markdown' | 'html' | 'console';

/**
 * Options for generating a report
 */
export interface ReportOptions {
  /** Output format */
  format: ReportFormat;
  /** Output file path (undefined = stdout) */
  outputPath?: string;
  /** Include detailed must-have results */
  includeDetails: boolean;
  /** Include remediation suggestions */
  includeRemediation: boolean;
  /** Minimum severity to include in report */
  minSeverity?: GapSeverity;
  /** Maximum number of gaps to include */
  maxGaps?: number;
  /** Custom template for formatting */
  template?: string;
}

/**
 * Summary section of a verification report
 */
export interface ReportSummary {
  /** Total goals verified */
  totalGoals: number;
  /** Goals fully achieved */
  achievedGoals: number;
  /** Goals partially achieved */
  partialGoals: number;
  /** Goals failed */
  failedGoals: number;
  /** Overall completion percentage */
  overallCompletion: number;
  /** Total must-haves across all goals */
  totalMustHaves: number;
  /** Total gaps found */
  totalGaps: number;
  /** Critical gaps count */
  criticalGaps: number;
  /** Verification timestamp */
  verifiedAt: Date;
  /** Total duration */
  totalDuration: number;
}

/**
 * Complete verification report
 */
export interface VerificationReport {
  /** Report metadata */
  summary: ReportSummary;
  /** Individual goal results */
  results: VerificationResult[];
  /** All identified gaps */
  allGaps: Gap[];
  /** Recommended next steps */
  recommendations: string[];
  /** Report generation timestamp */
  generatedAt: Date;
}

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Storage adapter for persisting verification results
 */
export interface VerificationStorage {
  /** Save a verification result */
  saveResult(result: VerificationResult): Promise<void>;
  /** Load a verification result by goal ID */
  loadResult(goalId: GoalId): Promise<VerificationResult | null>;
  /** List all verification results */
  listResults(options?: { limit?: number; offset?: number }): Promise<VerificationResult[]>;
  /** Save a goal definition */
  saveGoal(goal: Goal): Promise<void>;
  /** Load a goal by ID */
  loadGoal(goalId: GoalId): Promise<Goal | null>;
  /** List all goals */
  listGoals(options?: { status?: GoalStatus; tags?: string[] }): Promise<Goal[]>;
  /** Delete a goal and its results */
  deleteGoal(goalId: GoalId): Promise<void>;
}

// ============================================================================
// CLI Types
// ============================================================================

/**
 * Options for the verify CLI command
 */
export interface VerifyCommandOptions {
  /** Goal ID or file path to verify */
  target: string;
  /** Output format */
  format?: ReportFormat;
  /** Output file path */
  output?: string;
  /** Stop on first failure */
  stopOnFailure?: boolean;
  /** Include detailed output */
  verbose?: boolean;
  /** Check timeout in seconds */
  timeout?: number;
  /** Tags to filter goals */
  tags?: string[];
  /** Minimum severity to report */
  minSeverity?: GapSeverity;
}

/**
 * Options for the goals CLI command
 */
export interface GoalsCommandOptions {
  /** Filter by status */
  status?: GoalStatus;
  /** Filter by tags */
  tags?: string[];
  /** Output format */
  format?: ReportFormat;
  /** Show detailed information */
  verbose?: boolean;
}

/**
 * Options for creating a goal via CLI
 */
export interface CreateGoalCommandOptions {
  /** Goal title */
  title: string;
  /** Goal description */
  description: string;
  /** Must-have criteria (JSON string or file path) */
  mustHaves?: string;
  /** Parent goal ID */
  parent?: string;
  /** Priority level */
  priority?: number;
  /** Tags */
  tags?: string[];
  /** Owner */
  owner?: string;
  /** Output file path */
  output?: string;
}
