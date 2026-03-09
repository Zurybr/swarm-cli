/**
 * PLAN.md Executable Prompt Format - Type Definitions
 *
 * This module defines the core types for parsing, validating, and executing
 * PLAN.md files as executable instruction sequences.
 */

// ============================================================================
// Plan Structure Types
// ============================================================================

/**
 * Frontmatter metadata parsed from PLAN.md YAML header
 */
export interface PlanMetadata {
  phase: string;
  plan: string;
  type: 'execute' | 'research' | 'design';
  wave: number;
  depends_on: string[];
  files_modified: string[];
  autonomous: boolean;
  requirements: string[];
}

/**
 * Must-haves section from frontmatter
 */
export interface PlanMustHaves {
  truths: string[];
  artifacts: ArtifactDefinition[];
  key_links: KeyLink[];
}

/**
 * Definition of an artifact that the plan produces
 */
export interface ArtifactDefinition {
  path: string;
  provides: string;
  exports: string[];
}

/**
 * Link between artifacts showing dependencies
 */
export interface KeyLink {
  from: string;
  to: string;
  via: string;
}

/**
 * Complete parsed plan structure
 */
export interface Plan {
  /** Parsed frontmatter metadata */
  metadata: PlanMetadata;
  /** Must-haves section */
  mustHaves: PlanMustHaves;
  /** Plan objective/description */
  objective: string;
  /** Execution context reference */
  executionContext?: string;
  /** Context file references */
  context: string[];
  /** Parsed tasks */
  tasks: PlanTask[];
  /** Verification checklist */
  verification: string[];
  /** Success criteria */
  successCriteria: string;
  /** Output specification */
  output?: string;
}

// ============================================================================
// Task Types
// ============================================================================

/**
 * Task execution type
 */
export type TaskType = 'auto' | 'manual' | 'decision';

/**
 * Individual task within a plan
 */
export interface PlanTask {
  /** Unique identifier for the task */
  id: string;
  /** Task type */
  type: TaskType;
  /** Task name/title */
  name: string;
  /** Files affected by this task */
  files: string[];
  /** Task action description */
  action: string;
  /** Verification command or criteria */
  verify?: string;
  /** Done condition description */
  done: string;
  /** Whether this task uses TDD */
  tdd?: boolean;
  /** Expected behavior for TDD tasks */
  behavior?: string[];
}

// ============================================================================
// Parser Types
// ============================================================================

/**
 * Result of parsing a PLAN.md file
 */
export interface ParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed plan (if success) */
  plan?: Plan;
  /** Parse errors (if failed) */
  errors: ParseError[];
  /** Parse warnings */
  warnings: ParseWarning[];
}

/**
 * Parse error with location information
 */
export interface ParseError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Line number (1-based) */
  line?: number;
  /** Column number (1-based) */
  column?: number;
  /** Context snippet */
  context?: string;
}

/**
 * Parse warning with location information
 */
export interface ParseWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Line number (1-based) */
  line?: number;
  /** Context snippet */
  context?: string;
}

// ============================================================================
// Validator Types
// ============================================================================

/**
 * Validation result for a plan
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
  /** Dependency graph analysis */
  dependencies: DependencyGraph;
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Related task ID (if applicable) */
  taskId?: string;
  /** Field path (for metadata errors) */
  field?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Related task ID (if applicable) */
  taskId?: string;
}

/**
 * Dependency graph for plan tasks
 */
export interface DependencyGraph {
  /** Tasks in dependency order */
  ordered: string[];
  /** Circular dependencies detected */
  cycles: string[][];
  /** Orphaned tasks (no dependencies, not depended on) */
  orphaned: string[];
  /** Task dependency map */
  dependencies: Map<string, string[]>;
}

// ============================================================================
// Executor Types
// ============================================================================

/**
 * Execution state for a plan
 */
export type ExecutionState =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Execution context passed to executor
 */
export interface ExecutionContext {
  /** Working directory for execution */
  workingDir: string;
  /** Environment variables */
  env: Record<string, string>;
  /** Whether to dry-run (validate only) */
  dryRun: boolean;
  /** Execution options */
  options: ExecutionOptions;
}

/**
 * Execution options
 */
export interface ExecutionOptions {
  /** Stop on first failure */
  stopOnFailure: boolean;
  /** Maximum concurrent tasks */
  maxConcurrency: number;
  /** Timeout per task (ms) */
  taskTimeout: number;
  /** Whether to capture output */
  captureOutput: boolean;
}

/**
 * Result of executing a plan
 */
export interface ExecutionResult {
  /** Final execution state */
  state: ExecutionState;
  /** Task execution results */
  taskResults: TaskExecutionResult[];
  /** Execution start time */
  startTime: Date;
  /** Execution end time */
  endTime?: Date;
  /** Total duration (ms) */
  duration: number;
  /** Error if execution failed */
  error?: ExecutionError;
}

/**
 * Result of executing a single task
 */
export interface TaskExecutionResult {
  /** Task ID */
  taskId: string;
  /** Execution state */
  state: ExecutionState;
  /** Start time */
  startTime?: Date;
  /** End time */
  endTime?: Date;
  /** Duration (ms) */
  duration: number;
  /** Task output */
  output?: string;
  /** Task error */
  error?: ExecutionError;
  /** Verification result */
  verified: boolean;
}

/**
 * Execution error
 */
export interface ExecutionError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Stack trace */
  stack?: string;
  /** Task that failed (if applicable) */
  taskId?: string;
}

// ============================================================================
// Progress Tracking Types
// ============================================================================

/**
 * Progress callback function
 */
export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Progress event during execution
 */
export interface ProgressEvent {
  /** Event type */
  type: ProgressEventType;
  /** Current task (if applicable) */
  taskId?: string;
  /** Progress percentage (0-100) */
  percent: number;
  /** Event message */
  message: string;
  /** Timestamp */
  timestamp: Date;
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Progress event types
 */
export type ProgressEventType =
  | 'start'
  | 'task-start'
  | 'task-progress'
  | 'task-complete'
  | 'task-fail'
  | 'verify'
  | 'complete'
  | 'fail'
  | 'cancel';

// ============================================================================
// CLI Types
// ============================================================================

/**
 * CLI command options for plan execution
 */
export interface PlanExecuteOptions {
  /** Plan file path */
  file: string;
  /** Dry run mode */
  dryRun?: boolean;
  /** Stop on failure */
  stopOnFailure?: boolean;
  /** Task timeout in seconds */
  timeout?: number;
  /** Output format */
  format?: 'human' | 'json';
  /** Verbose output */
  verbose?: boolean;
}

/**
 * CLI command options for plan validation
 */
export interface PlanValidateOptions {
  /** Plan file path */
  file: string;
  /** Output format */
  format?: 'human' | 'json';
  /** Strict mode (warnings as errors) */
  strict?: boolean;
}
