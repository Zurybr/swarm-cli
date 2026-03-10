/**
 * Performance Expert Skill
 *
 * Monolithic skill that analyzes code complexity and identifies bottlenecks.
 * Uses typhonjs-escomplex for programmatic analysis (not CLI).
 *
 * Features:
 * - Cyclomatic complexity calculation
 * - Halstead metrics (bugs, difficulty, effort)
 * - Maintainability index
 * - Bottleneck detection with configurable thresholds
 * - Respects .gitignore and excludes node_modules
 * - Filters files > 1000 lines (likely generated)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  BaseExpertSkill,
  ExpertOutput,
  PerformanceTaskInput,
  PerformanceFinding,
  ComplexityReport,
  SeverityLevel,
} from '../types';
import {
  analyzeComplexity,
  getAggregateMetrics,
} from './analyzers/complexity';
import {
  identifyBottlenecks,
  getBottleneckSummary,
  BottleneckThresholds,
} from './analyzers/bottlenecks';

/**
 * Performance Expert Skill implementation
 */
export class PerformanceExpertSkill implements BaseExpertSkill<PerformanceTaskInput, ExpertOutput<PerformanceFinding>> {
  readonly id = 'performance-expert';
  readonly name = 'Performance Expert';
  readonly version = '1.0.0';

  /**
   * Execute performance analysis
   */
  async execute(input: PerformanceTaskInput): Promise<ExpertOutput<PerformanceFinding>> {
    const startTime = Date.now();
    const errors: string[] = [];

    // Build thresholds from input
    const thresholds: BottleneckThresholds = {
      cyclomatic: input.cyclomaticThreshold,
      maintainability: input.maintainabilityThreshold,
      functionLength: input.functionLengthThreshold,
    };

    const severityThreshold = input.severityThreshold || 'low';

    try {
      // Analyze complexity for all files
      const complexityReports = await analyzeComplexity(input.targetPath);

      // Identify bottlenecks
      const allFindings = identifyBottlenecks(complexityReports, thresholds);

      // Filter by severity threshold
      const severityOrder: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];
      const thresholdIndex = severityOrder.indexOf(severityThreshold);
      const findings = allFindings.filter(f => {
        const severityIndex = severityOrder.indexOf(f.severity);
        return severityIndex >= thresholdIndex;
      });

      // Calculate summary statistics
      const aggregateMetrics = getAggregateMetrics(complexityReports);
      const bottleneckSummary = getBottleneckSummary(findings);

      // Build output
      const json = {
        findings,
        summary: {
          totalIssues: findings.length,
          criticalCount: bottleneckSummary.criticalCount,
          highCount: bottleneckSummary.highCount,
          mediumCount: bottleneckSummary.mediumCount,
          lowCount: bottleneckSummary.lowCount,
          filesScanned: aggregateMetrics.fileCount,
          metrics: {
            averageMaintainability: aggregateMetrics.averageMaintainability,
            averageCyclomatic: aggregateMetrics.averageCyclomatic,
            totalBugs: aggregateMetrics.totalBugs,
            totalEffort: aggregateMetrics.totalEffort,
          },
          bottlenecks: bottleneckSummary,
        },
        metadata: {
          durationMs: Date.now() - startTime,
          expertVersion: this.version,
          scannedAt: new Date().toISOString(),
        },
        errors: errors.length > 0 ? errors : undefined,
        // Include full complexity reports for detailed analysis
        complexityReports,
      };

      const markdown = this.buildMarkdownReport(json, input);

      // Return based on output format preference
      switch (input.outputFormat) {
        case 'json':
          return { json, markdown: '' };
        case 'markdown':
          return { json: json as any, markdown };
        case 'both':
        default:
          return { json, markdown };
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));

      return {
        json: {
          findings: [],
          summary: {
            totalIssues: 0,
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0,
            filesScanned: 0,
          },
          metadata: {
            durationMs: Date.now() - startTime,
            expertVersion: this.version,
            scannedAt: new Date().toISOString(),
          },
          errors,
          complexityReports: [],
        },
        markdown: this.buildErrorReport(error, input),
      };
    }
  }

  /**
   * Build human-readable Markdown report
   */
  private buildMarkdownReport(
    json: {
      findings: PerformanceFinding[];
      summary: {
        totalIssues: number;
        criticalCount: number;
        highCount: number;
        mediumCount: number;
        lowCount: number;
        filesScanned: number;
        metrics: {
          averageMaintainability: number;
          averageCyclomatic: number;
          totalBugs: number;
          totalEffort: number;
        };
        bottlenecks: {
          highComplexityCount: number;
          longFunctionCount: number;
          lowMaintainabilityCount: number;
        };
      };
      metadata: { durationMs: number; expertVersion: string; scannedAt: string };
      errors?: string[];
      complexityReports: ComplexityReport[];
    },
    input: PerformanceTaskInput
  ): string {
    const lines: string[] = [];

    // Header
    lines.push('# Performance Analysis Report');
    lines.push('');
    lines.push(`**Target:** ${input.targetPath}`);
    lines.push(`**Generated:** ${json.metadata.scannedAt}`);
    lines.push(`**Duration:** ${json.metadata.durationMs}ms`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total Issues:** ${json.summary.totalIssues}`);
    lines.push(`- **Critical:** ${json.summary.criticalCount}`);
    lines.push(`- **High:** ${json.summary.highCount}`);
    lines.push(`- **Medium:** ${json.summary.mediumCount}`);
    lines.push(`- **Low:** ${json.summary.lowCount}`);
    lines.push(`- **Files Scanned:** ${json.summary.filesScanned}`);
    lines.push('');

    // Metrics
    lines.push('## Complexity Metrics');
    lines.push('');
    lines.push(`- **Average Maintainability:** ${json.summary.metrics.averageMaintainability.toFixed(2)}`);
    lines.push(`- **Average Cyclomatic Complexity:** ${json.summary.metrics.averageCyclomatic.toFixed(2)}`);
    lines.push(`- **Estimated Bugs:** ${json.summary.metrics.totalBugs.toFixed(2)}`);
    lines.push(`- **Total Effort:** ${json.summary.metrics.totalEffort.toFixed(0)} seconds`);
    lines.push('');

    // Bottleneck breakdown
    lines.push('## Bottleneck Breakdown');
    lines.push('');
    lines.push(`- **High Complexity Functions:** ${json.summary.bottlenecks.highComplexityCount}`);
    lines.push(`- **Long Functions:** ${json.summary.bottlenecks.longFunctionCount}`);
    lines.push(`- **Low Maintainability Files:** ${json.summary.bottlenecks.lowMaintainabilityCount}`);
    lines.push('');

    // Critical and High findings
    const criticalFindings = json.findings.filter(f => f.severity === 'critical' || f.severity === 'high');
    if (criticalFindings.length > 0) {
      lines.push('## Critical & High Priority Issues');
      lines.push('');
      for (const finding of criticalFindings) {
        lines.push(this.formatFinding(finding));
      }
    }

    // Other findings
    const otherFindings = json.findings.filter(f => f.severity === 'medium' || f.severity === 'low');
    if (otherFindings.length > 0) {
      lines.push('## Other Issues');
      lines.push('');
      for (const finding of otherFindings) {
        lines.push(this.formatFinding(finding));
      }
    }

    // Complexity details
    if (json.complexityReports.length > 0) {
      lines.push('## File Complexity Details');
      lines.push('');
      lines.push('| File | Maintainability | Cyclomatic | Functions |');
      lines.push('|------|----------------|------------|-----------|');

      // Sort by maintainability (ascending - lowest first)
      const sortedReports = [...json.complexityReports]
        .sort((a, b) => a.maintainability - b.maintainability)
        .slice(0, 20); // Show top 20

      for (const report of sortedReports) {
        const fileName = path.basename(report.filePath);
        lines.push(`| ${fileName} | ${report.maintainability.toFixed(2)} | ${report.cyclomatic} | ${report.functions.length} |`);
      }
      lines.push('');
    }

    // Errors
    if (json.errors && json.errors.length > 0) {
      lines.push('## Errors');
      lines.push('');
      for (const error of json.errors) {
        lines.push(`- ${error}`);
      }
      lines.push('');
    }

    // No findings message
    if (json.findings.length === 0) {
      lines.push('## No Issues Found');
      lines.push('');
      lines.push('No performance issues were detected in the scanned files.');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format a single finding as markdown
   */
  private formatFinding(finding: PerformanceFinding): string {
    const lines: string[] = [];

    lines.push(`### ${finding.title}`);
    lines.push('');
    lines.push(`- **Severity:** ${finding.severity.toUpperCase()}`);
    lines.push(`- **Type:** ${finding.type}`);
    lines.push(`- **File:** ${finding.filePath}:${finding.line}`);
    lines.push('');
    lines.push(finding.description);
    lines.push('');

    if (finding.metrics) {
      lines.push('**Metrics:**');
      lines.push(`- Cyclomatic Complexity: ${finding.metrics.cyclomatic}`);
      lines.push(`- Lines of Code: ${finding.metrics.sloc}`);
      lines.push(`- Parameters: ${finding.metrics.params}`);
      if (finding.metrics.halstead) {
        lines.push(`- Estimated Bugs: ${finding.metrics.halstead.bugs.toFixed(2)}`);
      }
      lines.push('');
    }

    if (finding.suggestion) {
      lines.push('**Suggestion:**');
      lines.push(finding.suggestion);
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Build error report
   */
  private buildErrorReport(error: unknown, input: PerformanceTaskInput): string {
    const lines: string[] = [];

    lines.push('# Performance Analysis Report');
    lines.push('');
    lines.push(`**Target:** ${input.targetPath}`);
    lines.push(`**Status:** ERROR`);
    lines.push('');
    lines.push('## Error');
    lines.push('');
    lines.push(error instanceof Error ? error.message : String(error));
    lines.push('');

    return lines.join('\n');
  }
}

// Re-export types
export { ComplexityReport, FunctionMetrics, BottleneckThresholds };
