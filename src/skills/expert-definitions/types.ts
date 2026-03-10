/**
 * Expert Definitions - Shared Types
 *
 * Core types for domain expert agents providing dual-format output (JSON + Markdown)
 */

/**
 * Finding severity levels
 */
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Base finding interface shared across all expert types
 */
export interface BaseFinding {
  /** Unique identifier for the finding */
  id: string;
  /** File path where the finding was detected */
  filePath: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column?: number;
  /** Severity level */
  severity: SeverityLevel;
  /** Short title/description */
  title: string;
  /** Detailed description */
  description: string;
  /** Suggested fix or remediation */
  suggestion?: string;
}

/**
 * Expert output with dual format (JSON + Markdown)
 */
export interface ExpertOutput<T extends BaseFinding = BaseFinding> {
  /** Structured data for programmatic use */
  json: {
    /** Individual findings */
    findings: T[];
    /** Summary statistics */
    summary: {
      totalIssues: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
      filesScanned: number;
    };
    /** Execution metadata */
    metadata: {
      durationMs: number;
      expertVersion: string;
      scannedAt: string;
    };
    /** Any errors that occurred during scanning */
    errors?: string[];
  };
  /** Human-readable report */
  markdown: string;
}

/**
 * Base input for all expert tasks
 */
export interface ExpertTaskInput {
  /** Target path to analyze */
  targetPath: string;
  /** Output format preference */
  outputFormat: 'json' | 'markdown' | 'both';
  /** Severity threshold (only return findings at or above this level) */
  severityThreshold?: SeverityLevel;
  /** File patterns to include */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
}

/**
 * Base interface that all expert skills must implement
 */
export interface BaseExpertSkill<TInput extends ExpertTaskInput, TOutput extends ExpertOutput> {
  /** Expert skill identifier */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Version of the expert skill */
  readonly version: string;
  /** Execute the expert analysis */
  execute(input: TInput): Promise<TOutput>;
}

/**
 * Security task input
 */
export interface SecurityTaskInput extends ExpertTaskInput {
  /** Types of security scans to perform */
  scanTypes: ('secrets' | 'dependencies' | 'patterns')[];
}

/**
 * Security finding types
 */
export type SecurityFindingType = 'api-key' | 'password' | 'token' | 'private-key' | 'vulnerability' | 'pattern';

/**
 * Security-specific finding
 */
export interface SecurityFinding extends BaseFinding {
  /** Type of security issue */
  type: SecurityFindingType;
  /** The matched text (truncated for security) */
  match: string;
  /** Entropy score (for secrets) */
  entropy?: number;
  /** CVE identifier (for vulnerabilities) */
  cveId?: string;
  /** Package name (for vulnerabilities) */
  packageName?: string;
  /** Vulnerable version range */
  vulnerableRange?: string;
}

/**
 * Performance task input
 */
export interface PerformanceTaskInput extends ExpertTaskInput {
  /** Complexity threshold for cyclomatic complexity */
  cyclomaticThreshold?: number;
  /** Function length threshold in lines */
  functionLengthThreshold?: number;
  /** Maintainability index threshold */
  maintainabilityThreshold?: number;
}

/**
 * Function complexity metrics
 */
export interface FunctionMetrics {
  /** Function name */
  name: string;
  /** Line number */
  line: number;
  /** Cyclomatic complexity */
  cyclomatic: number;
  /** Number of parameters */
  params: number;
  /** Source lines of code */
  sloc: number;
  /** Halstead metrics */
  halstead: {
    bugs: number;
    difficulty: number;
    effort: number;
  };
}

/**
 * Complexity report for a single file
 */
export interface ComplexityReport {
  /** File path */
  filePath: string;
  /** Maintainability index (0-171, higher is better) */
  maintainability: number;
  /** Aggregate cyclomatic complexity */
  cyclomatic: number;
  /** Aggregate Halstead metrics */
  halstead: {
    bugs: number;
    difficulty: number;
    effort: number;
  };
  /** Per-function metrics */
  functions: FunctionMetrics[];
}

/**
 * Performance-specific finding
 */
export interface PerformanceFinding extends BaseFinding {
  /** Type of performance issue */
  type: 'high-complexity' | 'long-function' | 'low-maintainability' | 'bottleneck';
  /** Complexity metrics for the finding */
  metrics?: Partial<FunctionMetrics>;
  /** Full complexity report for the file */
  report?: ComplexityReport;
}

/**
 * Documentation task input
 */
export interface DocumentationTaskInput extends ExpertTaskInput {
  /** Path to tsconfig.json */
  tsConfigPath?: string;
  /** Check for missing JSDoc */
  checkMissingJsDoc?: boolean;
  /** Check for parameter mismatches */
  checkParamMismatch?: boolean;
  /** Check for return type mismatches */
  checkReturnMismatch?: boolean;
  /** Generate JSDoc templates for undocumented functions */
  generateTemplates?: boolean;
}

/**
 * Drift finding types
 */
export type DriftType = 'missing-doc' | 'param-mismatch' | 'return-mismatch' | 'deprecated-param' | 'type-mismatch';

/**
 * Documentation drift finding
 */
export interface DriftFinding extends BaseFinding {
  /** Type of documentation drift */
  driftType: DriftType;
  /** Expected value from code */
  expected: string;
  /** Actual value from documentation */
  actual: string;
  /** Suggested JSDoc template (for missing docs) */
  suggestedJsDoc?: string;
}
