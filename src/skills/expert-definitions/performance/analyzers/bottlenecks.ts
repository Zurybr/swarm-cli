/**
 * Bottleneck Analyzer
 *
 * Identifies functions exceeding complexity thresholds:
 * - Cyclomatic complexity > threshold
 * - Function length > threshold
 * - Maintainability index < threshold
 */

import { ComplexityReport, FunctionMetrics, PerformanceFinding, SeverityLevel } from '../../types';

/**
 * Threshold configuration
 */
export interface BottleneckThresholds {
  /** Cyclomatic complexity threshold (default: 10) */
  cyclomatic?: number;
  /** Maintainability index threshold (default: 80) */
  maintainability?: number;
  /** Function length threshold in lines (default: 50) */
  functionLength?: number;
}

/**
 * Default thresholds based on industry standards
 */
const DEFAULT_THRESHOLDS: Required<BottleneckThresholds> = {
  cyclomatic: 10,
  maintainability: 80,
  functionLength: 50,
};

/**
 * Determine severity based on how much the threshold is exceeded
 */
function determineSeverity(
  value: number,
  threshold: number,
  type: 'max' | 'min'
): SeverityLevel {
  const ratio = type === 'max' ? value / threshold : threshold / value;

  if (ratio >= 3) return 'critical';
  if (ratio >= 2) return 'high';
  if (ratio >= 1.5) return 'medium';
  return 'low';
}

/**
 * Generate a unique finding ID
 */
function generateFindingId(filePath: string, functionName: string, type: string): string {
  const hash = Buffer.from(`${filePath}:${functionName}:${type}`).toString('base64').slice(0, 12);
  return `PERF-${hash}`;
}

/**
 * Identify bottlenecks from complexity reports
 */
export function identifyBottlenecks(
  reports: ComplexityReport[],
  thresholds: BottleneckThresholds = {}
): PerformanceFinding[] {
  const findings: PerformanceFinding[] = [];
  const mergedThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };

  for (const report of reports) {
    // Check file-level maintainability
    if (report.maintainability < mergedThresholds.maintainability) {
      findings.push({
        id: generateFindingId(report.filePath, 'file', 'maintainability'),
        filePath: report.filePath,
        line: 1,
        severity: determineSeverity(
          mergedThresholds.maintainability,
          report.maintainability,
          'min'
        ),
        type: 'low-maintainability',
        title: 'Low Maintainability Index',
        description: `File has a maintainability index of ${report.maintainability.toFixed(2)}, which is below the threshold of ${mergedThresholds.maintainability}. Lower values indicate code that is harder to maintain.`,
        suggestion: 'Consider refactoring to reduce complexity and improve code readability.',
        report,
      });
    }

    // Check file-level cyclomatic complexity
    if (report.cyclomatic > mergedThresholds.cyclomatic) {
      findings.push({
        id: generateFindingId(report.filePath, 'file', 'cyclomatic'),
        filePath: report.filePath,
        line: 1,
        severity: determineSeverity(report.cyclomatic, mergedThresholds.cyclomatic, 'max'),
        type: 'high-complexity',
        title: 'High Cyclomatic Complexity',
        description: `File has a cyclomatic complexity of ${report.cyclomatic}, which exceeds the threshold of ${mergedThresholds.cyclomatic}. Higher complexity indicates more paths through the code, making it harder to test and maintain.`,
        suggestion: 'Consider breaking down complex functions into smaller, more focused functions.',
        report,
      });
    }

    // Check individual functions
    for (const fn of report.functions) {
      // Check function cyclomatic complexity
      if (fn.cyclomatic > mergedThresholds.cyclomatic) {
        findings.push({
          id: generateFindingId(report.filePath, fn.name, 'complexity'),
          filePath: report.filePath,
          line: fn.line,
          severity: determineSeverity(fn.cyclomatic, mergedThresholds.cyclomatic, 'max'),
          type: 'high-complexity',
          title: `High Complexity: ${fn.name}()`,
          description: `Function "${fn.name}" has a cyclomatic complexity of ${fn.cyclomatic}, which exceeds the threshold of ${mergedThresholds.cyclomatic}.`,
          suggestion: 'Consider refactoring this function to reduce branching logic. Extract complex conditions into separate functions.',
          metrics: fn,
          report,
        });
      }

      // Check function length
      if (fn.sloc > mergedThresholds.functionLength) {
        findings.push({
          id: generateFindingId(report.filePath, fn.name, 'length'),
          filePath: report.filePath,
          line: fn.line,
          severity: determineSeverity(fn.sloc, mergedThresholds.functionLength, 'max'),
          type: 'long-function',
          title: `Long Function: ${fn.name}()`,
          description: `Function "${fn.name}" has ${fn.sloc} lines of code, which exceeds the threshold of ${mergedThresholds.functionLength}.`,
          suggestion: 'Consider breaking this function into smaller, more focused functions. Each function should do one thing well.',
          metrics: fn,
          report,
        });
      }
    }
  }

  return findings;
}

/**
 * Get bottleneck summary statistics
 */
export function getBottleneckSummary(findings: PerformanceFinding[]): {
  highComplexityCount: number;
  longFunctionCount: number;
  lowMaintainabilityCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
} {
  return {
    highComplexityCount: findings.filter(f => f.type === 'high-complexity').length,
    longFunctionCount: findings.filter(f => f.type === 'long-function').length,
    lowMaintainabilityCount: findings.filter(f => f.type === 'low-maintainability').length,
    criticalCount: findings.filter(f => f.severity === 'critical').length,
    highCount: findings.filter(f => f.severity === 'high').length,
    mediumCount: findings.filter(f => f.severity === 'medium').length,
    lowCount: findings.filter(f => f.severity === 'low').length,
  };
}
