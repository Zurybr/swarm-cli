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
 * User setup requirement for external services
 */
export interface UserSetup {
  service: string;
  why: string;
  envVars?: Array<{
    name: string;
    source: string;
  }>;
  dashboardConfig?: Array<{
    task: string;
    location: string;
  }>;
}

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
  userSetup?: UserSetup[];
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
  exports?: string[];
  minLines?: number;
  contains?: string;
}

/**
 * Link between artifacts showing dependencies
 */
export interface KeyLink {
  from: string;
  to: string;
  via: string;
  pattern?: string;
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
  /** Resolved context content (for @-references) */
  contextResolved?: Record<string, string>;
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
export type TaskType = 'auto' | 'manual' | 'decision' | 'checkpoint:human-verify' | 'checkpoint:decision' | 'checkpoint:human-action';

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
  /** Checkpoint-specific data */
  checkpointData?: {
    whatBuilt?: string;
    howToVerify?: string;
    resumeSignal?: string;
    gate?: string;
    decision?: string;
    context?: string;
    options?: Array<{
      id: string;
      name: string;
      pros?: string;
      cons?: string;
    }>;
    actionRequired?: string;
    why?: string;
    steps?: string[];
    provideSecrets?: Record<string, string>;
  };
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

// ============================================================================
// JSON Schema Types
// ============================================================================

/**
 * JSON Schema for PLAN.md frontmatter validation
 */
export const PLAN_FRONTMATTER_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['phase', 'plan', 'type'],
  properties: {
    phase: {
      type: 'string',
      pattern: '^[0-9]{2}-[a-z]+$',
      description: 'Phase identifier (e.g., 01-foundation)',
    },
    plan: {
      type: 'string',
      pattern: '^[0-9]{2}$',
      description: 'Plan number within phase (01, 02, etc.)',
    },
    type: {
      type: 'string',
      enum: ['execute', 'research', 'design', 'tdd'],
      description: 'Plan execution type',
    },
    wave: {
      type: 'number',
      minimum: 1,
      description: 'Execution wave (1, 2, 3...)',
    },
    depends_on: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^[0-9]{2}-[0-9]{2}$',
      },
      description: 'Plan IDs this depends on',
    },
    files_modified: {
      type: 'array',
      items: { type: 'string' },
      description: 'Files this plan will modify',
    },
    autonomous: {
      type: 'boolean',
      description: 'false if contains checkpoints',
    },
    requirements: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^REQ-[0-9]+$',
      },
      description: 'Requirement IDs from ROADMAP',
    },
    user_setup: {
      type: 'array',
      items: {
        type: 'object',
        required: ['service', 'why'],
        properties: {
          service: { type: 'string' },
          why: { type: 'string' },
          env_vars: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                source: { type: 'string' },
              },
            },
          },
          dashboard_config: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                task: { type: 'string' },
                location: { type: 'string' },
              },
            },
          },
        },
      },
    },
    must_haves: {
      type: 'object',
      properties: {
        truths: {
          type: 'array',
          items: { type: 'string' },
        },
        artifacts: {
          type: 'array',
          items: {
            type: 'object',
            required: ['path', 'provides'],
            properties: {
              path: { type: 'string' },
              provides: { type: 'string' },
              exports: { type: 'array', items: { type: 'string' } },
              min_lines: { type: 'number' },
              contains: { type: 'string' },
            },
          },
        },
        key_links: {
          type: 'array',
          items: {
            type: 'object',
            required: ['from', 'to', 'via'],
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              via: { type: 'string' },
              pattern: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const;

/**
 * JSON Schema for task validation
 */
export const PLAN_TASK_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['name', 'action'],
  properties: {
    type: {
      type: 'string',
      enum: ['auto', 'manual', 'decision', 'checkpoint:human-verify', 'checkpoint:decision', 'checkpoint:human-action'],
    },
    tdd: { type: 'boolean' },
    name: { type: 'string', minLength: 1 },
    files: { type: 'array', items: { type: 'string' } },
    action: { type: 'string', minLength: 1 },
    verify: { type: 'string' },
    done: { type: 'string' },
    behavior: { type: 'array', items: { type: 'string' } },
  },
} as const;
