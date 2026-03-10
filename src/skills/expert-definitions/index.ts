/**
 * Expert Definitions
 *
 * Domain expert agents providing specialized analysis capabilities:
 * - Security Review: Secret detection, vulnerability scanning, pattern analysis
 * - Performance: Complexity analysis, bottleneck detection
 * - Documentation: Drift detection, JSDoc generation
 *
 * All experts provide dual output format (JSON + Markdown) for both
 * programmatic consumption and human-readable reports.
 */

// Core types
export {
  // Base types
  ExpertOutput,
  ExpertTaskInput,
  BaseExpertSkill,
  SeverityLevel,
  BaseFinding,

  // Security types
  SecurityTaskInput,
  SecurityFinding,
  SecurityFindingType,

  // Performance types
  PerformanceTaskInput,
  PerformanceFinding,
  ComplexityReport,
  FunctionMetrics,

  // Documentation types
  DocumentationTaskInput,
  DriftFinding,
  DriftType,
} from './types';

// Security Expert
export {
  SecurityReviewSkill,
  SecurityFinding as SecurityFindingType,
  SecretFinding,
  VulnerabilityFinding,
  PatternFinding,
} from './security/skill';

export {
  detectSecrets,
  calculateEntropy,
  SecretFinding as SecretFindingInterface,
} from './security/analyzers/secrets';

export {
  scanVulnerabilities,
  VulnerabilityFinding as VulnerabilityFindingInterface,
} from './security/analyzers/vulnerabilities';

export {
  analyzePatterns,
  PatternFinding as PatternFindingInterface,
} from './security/analyzers/patterns';

// Performance Expert
export {
  PerformanceExpertSkill,
  ComplexityReport as ComplexityReportType,
  FunctionMetrics as FunctionMetricsType,
  BottleneckThresholds,
} from './performance/skill';

export {
  analyzeComplexity,
  analyzeFile,
  getAggregateMetrics,
  FileComplexityResult,
} from './performance/analyzers/complexity';

export {
  identifyBottlenecks,
  getBottleneckSummary,
  BottleneckThresholds as BottleneckThresholdsType,
} from './performance/analyzers/bottlenecks';

// Documentation Expert
export {
  DocumentationExpertSkill,
  DriftFinding as DriftFindingType,
  GeneratedJsDoc,
} from './documentation/skill';

export {
  detectDrift,
  detectDriftInFile,
  getDriftSummary,
  DriftDetectionOptions,
} from './documentation/analyzers/drift';

export {
  generateJsDocTemplates,
  generateJsDocForProject,
  getGenerationSummary,
  GeneratedJsDoc as GeneratedJsDocType,
} from './documentation/analyzers/generator';
