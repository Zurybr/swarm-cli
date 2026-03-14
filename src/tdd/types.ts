/**
 * TDD (Test-Driven Development) Plan Type Support
 *
 * This module defines the core types for TDD plan execution,
 * including the red-green-refactor cycle, test case tracking,
 * and coverage monitoring.
 */

// ============================================================================
// TDD Plan Types
// ============================================================================

/**
 * TDD cycle phase - the three stages of TDD
 */
export type TDDCyclePhase = 'red' | 'green' | 'refactor';

/**
 * Status of a TDD cycle
 */
export type TDDCycleStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * Status of a test case
 */
export type TestCaseStatus =
  | 'draft'
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'skipped'
  | 'error';

/**
 * Type of test case
 */
export type TestCaseType =
  | 'unit'
  | 'integration'
  | 'e2e'
  | 'property'
  | 'benchmark';

/**
 * Complete TDD Plan structure
 */
export interface TDDPlan {
  /** Unique identifier for the plan */
  id: string;
  /** Plan name/title */
  name: string;
  /** Plan description */
  description: string;
  /** Target file(s) being developed */
  targetFiles: string[];
  /** Test file(s) */
  testFiles: string[];
  /** Current active cycle */
  currentCycle?: TDDCycle;
  /** All cycles in this plan */
  cycles: TDDCycle[];
  /** Test cases */
  testCases: TestCase[];
  /** Coverage configuration */
  coverageConfig: CoverageConfig;
  /** Coverage reports */
  coverageReports: CoverageReport[];
  /** Plan metadata */
  metadata: TDDPlanMetadata;
  /** Creation timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * TDD Plan metadata
 */
export interface TDDPlanMetadata {
  /** Plan version */
  version: string;
  /** Author */
  author?: string;
  /** Associated task or feature */
  taskId?: string;
  /** Parent epic or story */
  epicId?: string;
  /** Tags for categorization */
  tags: string[];
  /** Whether to enforce coverage thresholds */
  enforceCoverage: boolean;
  /** Target coverage percentage (0-100) */
  targetCoverage: number;
}

// ============================================================================
// TDD Cycle Types
// ============================================================================

/**
 * A single red-green-refactor cycle
 */
export interface TDDCycle {
  /** Unique identifier */
  id: string;
  /** Cycle number (1-based) */
  number: number;
  /** Current phase */
  phase: TDDCyclePhase;
  /** Cycle status */
  status: TDDCycleStatus;
  /** Test cases associated with this cycle */
  testCases: string[];
  /** Description of what this cycle implements */
  description: string;
  /** Phase timestamps */
  phaseTimestamps: PhaseTimestamps;
  /** Duration in milliseconds for each phase */
  phaseDurations: PhaseDurations;
  /** Whether all tests pass */
  testsPassing: boolean;
  /** Error message if cycle failed */
  error?: string;
}

/**
 * Timestamps for each phase
 */
export interface PhaseTimestamps {
  red?: Date;
  green?: Date;
  refactor?: Date;
  completed?: Date;
}

/**
 * Durations for each phase in milliseconds
 */
export interface PhaseDurations {
  red: number;
  green: number;
  refactor: number;
  total: number;
}

// ============================================================================
// Test Case Types
// ============================================================================

/**
 * Individual test case
 */
export interface TestCase {
  /** Unique identifier */
  id: string;
  /** Test name/description */
  name: string;
  /** Test type */
  type: TestCaseType;
  /** Current status */
  status: TestCaseStatus;
  /** Test code or description */
  code: string;
  /** File containing this test */
  file: string;
  /** Line number */
  line?: number;
  /** Associated cycle ID */
  cycleId?: string;
  /** Expected behavior */
  expectedBehavior: string;
  /** Actual behavior (for failing tests) */
  actualBehavior?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** Stack trace if failed */
  stackTrace?: string;
  /** Duration in milliseconds */
  duration?: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last run timestamp */
  lastRunAt?: Date;
}

/**
 * Test suite - collection of related test cases
 */
export interface TestSuite {
  /** Unique identifier */
  id: string;
  /** Suite name */
  name: string;
  /** Suite description */
  description: string;
  /** Test cases in this suite */
  testCases: TestCase[];
  /** File pattern for this suite */
  filePattern: string;
  /** Setup code */
  setup?: string;
  /** Teardown code */
  teardown?: string;
}

/**
 * Test execution result
 */
export interface TestExecutionResult {
  /** Test case ID */
  testId: string;
  /** Whether test passed */
  passed: boolean;
  /** Duration in milliseconds */
  duration: number;
  /** Output/stdout */
  output?: string;
  /** Error message */
  errorMessage?: string;
  /** Stack trace */
  stackTrace?: string;
  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// Coverage Types
// ============================================================================

/**
 * Coverage configuration
 */
export interface CoverageConfig {
  /** Enable coverage tracking */
  enabled: boolean;
  /** Coverage thresholds by metric */
  thresholds: CoverageThresholds;
  /** Files to include */
  include: string[];
  /** Files to exclude */
  exclude: string[];
  /** Coverage reporter format */
  reporter: CoverageReporter[];
  /** Output directory for reports */
  outputDir: string;
}

/**
 * Coverage thresholds
 */
export interface CoverageThresholds {
  /** Statement coverage threshold (0-100) */
  statements: number;
  /** Branch coverage threshold (0-100) */
  branches: number;
  /** Function coverage threshold (0-100) */
  functions: number;
  /** Line coverage threshold (0-100) */
  lines: number;
}

/**
 * Coverage reporter type
 */
export type CoverageReporter =
  | 'text'
  | 'text-summary'
  | 'json'
  | 'html'
  | 'lcov'
  | 'clover';

/**
 * Coverage report for a single file
 */
export interface FileCoverage {
  /** File path */
  path: string;
  /** Statement coverage percentage (0-100) */
  statements: CoverageMetric;
  /** Branch coverage percentage (0-100) */
  branches: CoverageMetric;
  /** Function coverage percentage (0-100) */
  functions: CoverageMetric;
  /** Line coverage percentage (0-100) */
  lines: CoverageMetric;
}

/**
 * Coverage metric details
 */
export interface CoverageMetric {
  /** Total count */
  total: number;
  /** Covered count */
  covered: number;
  /** Skipped count */
  skipped: number;
  /** Percentage (0-100) */
  pct: number;
}

/**
 * Complete coverage report
 */
export interface CoverageReport {
  /** Report ID */
  id: string;
  /** Associated cycle ID */
  cycleId?: string;
  /** Timestamp */
  timestamp: Date;
  /** Overall coverage summary */
  summary: CoverageSummary;
  /** Per-file coverage */
  files: FileCoverage[];
  /** Whether thresholds are met */
  thresholdsMet: boolean;
  /** Threshold violations */
  violations: ThresholdViolation[];
}

/**
 * Coverage summary
 */
export interface CoverageSummary {
  /** Statement coverage */
  statements: CoverageMetric;
  /** Branch coverage */
  branches: CoverageMetric;
  /** Function coverage */
  functions: CoverageMetric;
  /** Line coverage */
  lines: CoverageMetric;
}

/**
 * Threshold violation
 */
export interface ThresholdViolation {
  /** File path (or 'global') */
  path: string;
  /** Metric type */
  metric: keyof CoverageThresholds;
  /** Expected threshold */
  expected: number;
  /** Actual value */
  actual: number;
  /** Difference */
  diff: number;
}

// ============================================================================
// TDD Progress Types
// ============================================================================

/**
 * TDD progress report
 */
export interface TDDProgressReport {
  /** Plan ID */
  planId: string;
  /** Plan name */
  planName: string;
  /** Overall progress percentage (0-100) */
  overallProgress: number;
  /** Current cycle number */
  currentCycle: number;
  /** Total cycles */
  totalCycles: number;
  /** Completed cycles */
  completedCycles: number;
  /** Test statistics */
  testStats: TestStatistics;
  /** Coverage statistics */
  coverageStats: CoverageStatistics;
  /** Cycle statistics */
  cycleStats: CycleStatistics;
  /** Generated timestamp */
  generatedAt: Date;
}

/**
 * Test statistics
 */
export interface TestStatistics {
  /** Total test cases */
  total: number;
  /** Passed tests */
  passed: number;
  /** Failed tests */
  failed: number;
  /** Pending tests */
  pending: number;
  /** Skipped tests */
  skipped: number;
  /** Average test duration (ms) */
  averageDuration: number;
}

/**
 * Coverage statistics
 */
export interface CoverageStatistics {
  /** Current statement coverage */
  statements: number;
  /** Current branch coverage */
  branches: number;
  /** Current function coverage */
  functions: number;
  /** Current line coverage */
  lines: number;
  /** Target coverage */
  target: number;
  /** Whether target is met */
  targetMet: boolean;
}

/**
 * Cycle statistics
 */
export interface CycleStatistics {
  /** Average cycle duration (ms) */
  averageDuration: number;
  /** Total time in red phase (ms) */
  totalRedTime: number;
  /** Total time in green phase (ms) */
  totalGreenTime: number;
  /** Total time in refactor phase (ms) */
  totalRefactorTime: number;
  /** Fastest cycle (ms) */
  fastestCycle: number;
  /** Slowest cycle (ms) */
  slowestCycle: number;
  /** Average red phase duration (ms) */
  averageRedTime: number;
  /** Average green phase duration (ms) */
  averageGreenTime: number;
  /** Average refactor phase duration (ms) */
  averageRefactorTime: number;
  /** Total number of cycles analyzed */
  totalCycles: number;
}

// ============================================================================
// TDD Template Types
// ============================================================================

/**
 * TDD plan template
 */
export interface TDDTemplate {
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Default plan structure */
  plan: Partial<TDDPlan>;
  /** Default test case templates */
  testCaseTemplates: TestCaseTemplate[];
  /** Default coverage configuration */
  coverageConfig: CoverageConfig;
}

/**
 * Test case template
 */
export interface TestCaseTemplate {
  /** Template name */
  name: string;
  /** Test type */
  type: TestCaseType;
  /** Template code with placeholders */
  template: string;
  /** Description of what this template tests */
  description: string;
  /** Placeholders in the template */
  placeholders: string[];
}

// ============================================================================
// TDD System Types
// ============================================================================

/**
 * TDD system configuration
 */
export interface TDDSystemConfig {
  /** Default coverage thresholds */
  defaultThresholds: CoverageThresholds;
  /** Whether to auto-generate tests */
  autoGenerateTests: boolean;
  /** Whether to run tests on file change */
  watchMode: boolean;
  /** Test command to execute */
  testCommand: string;
  /** Coverage command to execute */
  coverageCommand: string;
  /** Working directory */
  workingDir: string;
}

/**
 * TDD system state
 */
export interface TDDSystemState {
  /** Active plans */
  activePlans: Map<string, TDDPlan>;
  /** Current plan ID */
  currentPlanId?: string;
  /** Whether a cycle is in progress */
  cycleInProgress: boolean;
  /** System configuration */
  config: TDDSystemConfig;
}

/**
 * TDD event types
 */
export type TDDEventType =
  | 'plan-created'
  | 'plan-started'
  | 'plan-completed'
  | 'plan-failed'
  | 'cycle-started'
  | 'phase-changed'
  | 'cycle-completed'
  | 'test-added'
  | 'test-running'
  | 'test-completed'
  | 'test-failed'
  | 'coverage-updated'
  | 'threshold-violated';

/**
 * TDD event
 */
export interface TDDEvent {
  /** Event type */
  type: TDDEventType;
  /** Plan ID */
  planId: string;
  /** Cycle ID (if applicable) */
  cycleId?: string;
  /** Test ID (if applicable) */
  testId?: string;
  /** Event timestamp */
  timestamp: Date;
  /** Event data */
  data?: Record<string, unknown>;
}

/**
 * Event handler function
 */
export type TDDEventHandler = (event: TDDEvent) => void | Promise<void>;

// ============================================================================
// TDD Executor Types (Issue #10)
// ============================================================================

/**
 * Individual test result from a test run
 */
export interface TestResult {
  /** Test name */
  name: string;
  /** Whether the test passed */
  passed: boolean;
  /** Duration in milliseconds */
  duration: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Test case for TDD executor
 */
export interface TDDExecutorTestCase {
  /** Test name */
  name: string;
  /** Test description */
  description: string;
  /** Input for the test */
  input: unknown;
  /** Expected output */
  expectedOutput: unknown;
}

/**
 * Task for TDD executor to process
 */
export interface TDDTask {
  /** Task name */
  name: string;
  /** Task description */
  description?: string;
  /** Files involved (test file and implementation file) */
  files: string[];
  /** Test cases to implement */
  testCases: TDDExecutorTestCase[];
  /** Command to verify tests */
  verifyCommand: string;
}

/**
 * Result from TDD executor
 */
export interface TDDResult {
  /** Current phase */
  phase: 'red' | 'green' | 'refactor';
  /** Test results */
  testResults: TestResult[];
  /** Coverage percentage */
  coverage: number;
  /** Commit messages made */
  commits: string[];
  /** Total duration in milliseconds */
  duration: number;
  /** Error message if failed */
  error?: string;
}
