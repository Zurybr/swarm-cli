/**
 * Verification Report Generation
 *
 * Generates comprehensive reports in multiple formats (JSON, Markdown, HTML, Console)
 * from verification results.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  type VerificationResult,
  type VerificationReport,
  type ReportSummary,
  type ReportOptions,
  type ReportFormat,
  type Gap,
  type GapSeverity,
  type Goal,
} from './types';
import { analyzeGaps, estimateRemediationEffort } from './checker';

// ============================================================================
// ANSI Color Helpers (for console output)
// ============================================================================

const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

// Chained color helpers
const boldRed = (text: string) => colors.bold(colors.red(text));
const boldGreen = (text: string) => colors.bold(colors.green(text));
const boldYellow = (text: string) => colors.bold(colors.yellow(text));
const boldBlue = (text: string) => colors.bold(colors.blue(text));
const boldMagenta = (text: string) => colors.bold(colors.magenta(text));
const boldCyan = (text: string) => colors.bold(colors.cyan(text));

const severityColors: Record<GapSeverity, (text: string) => string> = {
  critical: colors.red,
  major: colors.magenta,
  minor: colors.yellow,
  info: colors.gray,
};

const severityIcons: Record<GapSeverity, string> = {
  critical: '🔴',
  major: '🟠',
  minor: '🟡',
  info: '🔵',
};

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate a summary from multiple verification results
 */
export function generateSummary(results: VerificationResult[]): ReportSummary {
  const achievedGoals = results.filter(r => r.achieved).length;
  const partialGoals = results.filter(
    r => !r.achieved && r.completionPercentage > 0
  ).length;
  const totalMustHaves = results.reduce(
    (sum, r) => sum + r.stats.totalMustHaves,
    0
  );
  const totalGaps = results.reduce((sum, r) => sum + r.gaps.length, 0);

  // Calculate overall completion as weighted average
  const overallCompletion =
    results.length > 0
      ? Math.round(
          results.reduce((sum, r) => sum + r.completionPercentage, 0) /
            results.length
        )
      : 0;

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  return {
    totalGoals: results.length,
    achievedGoals,
    partialGoals,
    failedGoals: results.length - achievedGoals - partialGoals,
    overallCompletion,
    totalMustHaves,
    totalGaps,
    criticalGaps: results.reduce((sum, r) => sum + r.stats.criticalGaps, 0),
    verifiedAt: new Date(),
    totalDuration,
  };
}

/**
 * Generate recommendations based on verification results
 */
export function generateRecommendations(
  results: VerificationResult[]
): string[] {
  const recommendations: string[] = [];
  const gapAnalysis = analyzeGaps(results);
  const effort = estimateRemediationEffort(results);

  // Overall status recommendation
  if (gapAnalysis.blockingGaps > 0) {
    recommendations.push(
      `Address ${gapAnalysis.blockingGaps} blocking gaps immediately to enable goal achievement.`
    );
  }

  // Critical gaps
  if (gapAnalysis.criticalGaps > 0) {
    recommendations.push(
      `Prioritize ${gapAnalysis.criticalGaps} critical gaps - these are required must-haves with high impact.`
    );
  }

  // Top remediation steps
  if (gapAnalysis.topRemediation.length > 0) {
    recommendations.push(
      `Most common remediation needed: ${gapAnalysis.topRemediation[0]}`
    );
  }

  // Effort estimate
  if (effort.total > 0) {
    recommendations.push(
      `Estimated total effort to resolve all gaps: ${effort.total} story points.`
    );
  }

  // Goal-specific recommendations
  const failedGoals = results.filter(r => !r.achieved);
  if (failedGoals.length > 0) {
    const lowestCompletion = Math.min(
      ...failedGoals.map(r => r.completionPercentage)
    );
    recommendations.push(
      `Focus on goals with lowest completion (${lowestCompletion}%) to maximize progress.`
    );
  }

  return recommendations;
}

/**
 * Create a complete verification report
 */
export function createReport(
  results: VerificationResult[],
  goals?: Map<string, Goal>
): VerificationReport {
  const allGaps = results.flatMap(r => r.gaps);

  return {
    summary: generateSummary(results),
    results,
    allGaps,
    recommendations: generateRecommendations(results),
    generatedAt: new Date(),
  };
}

// ============================================================================
// Format-Specific Generators
// ============================================================================

/**
 * Generate JSON format report
 */
export function generateJSON(
  report: VerificationReport,
  pretty = true
): string {
  return JSON.stringify(report, null, pretty ? 2 : undefined);
}

/**
 * Generate Markdown format report
 */
export function generateMarkdown(report: VerificationReport): string {
  const lines: string[] = [];

  // Header
  lines.push('# Verification Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt.toISOString()}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Goals**: ${report.summary.totalGoals}`);
  lines.push(`- **Achieved**: ${report.summary.achievedGoals} ✅`);
  lines.push(`- **Partial**: ${report.summary.partialGoals} ⚠️`);
  lines.push(`- **Failed**: ${report.summary.failedGoals} ❌`);
  lines.push(`- **Overall Completion**: ${report.summary.overallCompletion}%`);
  lines.push(`- **Total Must-Haves**: ${report.summary.totalMustHaves}`);
  lines.push(`- **Total Gaps**: ${report.summary.totalGaps}`);
  lines.push(`- **Critical Gaps**: ${report.summary.criticalGaps} 🔴`);
  lines.push(`- **Verification Time**: ${report.summary.totalDuration}ms`);
  lines.push('');

  // Individual Results
  lines.push('## Goal Results');
  lines.push('');

  for (const result of report.results) {
    const status = result.achieved ? '✅ ACHIEVED' : result.completionPercentage > 0 ? '⚠️ PARTIAL' : '❌ FAILED';
    lines.push(`### ${result.goalId}`);
    lines.push('');
    lines.push(`- **Status**: ${status}`);
    lines.push(`- **Completion**: ${result.completionPercentage}%`);
    lines.push(`- **Must-Haves**: ${result.stats.satisfied}/${result.stats.totalMustHaves} satisfied`);
    lines.push(`- **Gaps**: ${result.gaps.length} identified`);
    lines.push(`- **Duration**: ${result.duration}ms`);
    lines.push('');

    if (result.gaps.length > 0) {
      lines.push('#### Gaps');
      lines.push('');
      for (const gap of result.gaps) {
        const icon = severityIcons[gap.severity];
        lines.push(`##### ${icon} ${gap.description}`);
        lines.push(`- **Severity**: ${gap.severity}`);
        lines.push(`- **Blocking**: ${gap.blocking ? 'Yes' : 'No'}`);
        if (gap.estimatedEffort) {
          lines.push(`- **Estimated Effort**: ${gap.estimatedEffort} points`);
        }
        if (gap.remediation && gap.remediation.length > 0) {
          lines.push('- **Remediation**:');
          for (const step of gap.remediation) {
            lines.push(`  - ${step}`);
          }
        }
        lines.push('');
      }
    }
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');
    for (let i = 0; i < report.recommendations.length; i++) {
      lines.push(`${i + 1}. ${report.recommendations[i]}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate HTML format report
 */
export function generateHTML(report: VerificationReport): string {
  const summary = report.summary;

  const gapRows = report.allGaps
    .map(
      gap => `
    <tr class="gap-${gap.severity}">
      <td>${severityIcons[gap.severity]}</td>
      <td>${escapeHtml(gap.description)}</td>
      <td>${gap.severity}</td>
      <td>${gap.blocking ? 'Yes' : 'No'}</td>
      <td>${gap.estimatedEffort || '-'}</td>
    </tr>
  `
    )
    .join('');

  const resultCards = report.results
    .map(
      result => `
    <div class="result-card ${result.achieved ? 'achieved' : 'failed'}">
      <h3>${escapeHtml(result.goalId)}</h3>
      <div class="stats">
        <span class="completion">${result.completionPercentage}%</span>
        <span class="must-haves">${result.stats.satisfied}/${result.stats.totalMustHaves}</span>
        <span class="gaps">${result.gaps.length} gaps</span>
      </div>
    </div>
  `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1, h2, h3 { margin-bottom: 16px; }
    .header {
      background: white;
      padding: 24px;
      border-radius: 8px;
      margin-bottom: 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .summary-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }
    .summary-card .value {
      font-size: 32px;
      font-weight: bold;
      color: #2563eb;
    }
    .summary-card .label {
      color: #666;
      font-size: 14px;
    }
    .results-section {
      background: white;
      padding: 24px;
      border-radius: 8px;
      margin-bottom: 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .result-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .result-card.achieved { border-left: 4px solid #22c55e; }
    .result-card.failed { border-left: 4px solid #ef4444; }
    .result-card .stats {
      display: flex;
      gap: 24px;
      color: #666;
      font-size: 14px;
    }
    .gaps-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    .gaps-table th,
    .gaps-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    .gaps-table th {
      background: #f9fafb;
      font-weight: 600;
    }
    .gap-critical { background: #fef2f2; }
    .gap-major { background: #fff7ed; }
    .gap-minor { background: #fefce8; }
    .gap-info { background: #f0f9ff; }
    .recommendations {
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .recommendations ul {
      margin-left: 24px;
    }
    .recommendations li {
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Verification Report</h1>
    <p>Generated: ${report.generatedAt.toISOString()}</p>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="value">${summary.totalGoals}</div>
      <div class="label">Total Goals</div>
    </div>
    <div class="summary-card">
      <div class="value" style="color: #22c55e">${summary.achievedGoals}</div>
      <div class="label">Achieved</div>
    </div>
    <div class="summary-card">
      <div class="value" style="color: #f59e0b">${summary.partialGoals}</div>
      <div class="label">Partial</div>
    </div>
    <div class="summary-card">
      <div class="value" style="color: #ef4444">${summary.criticalGaps}</div>
      <div class="label">Critical Gaps</div>
    </div>
    <div class="summary-card">
      <div class="value">${summary.overallCompletion}%</div>
      <div class="label">Overall Completion</div>
    </div>
  </div>

  <div class="results-section">
    <h2>Goal Results</h2>
    ${resultCards}
  </div>

  <div class="results-section">
    <h2>All Gaps</h2>
    <table class="gaps-table">
      <thead>
        <tr>
          <th></th>
          <th>Description</th>
          <th>Severity</th>
          <th>Blocking</th>
          <th>Effort</th>
        </tr>
      </thead>
      <tbody>
        ${gapRows}
      </tbody>
    </table>
  </div>

  <div class="recommendations">
    <h2>Recommendations</h2>
    <ul>
      ${report.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
    </ul>
  </div>
</body>
</html>`;
}

/**
 * Generate Console format report
 */
export function generateConsole(report: VerificationReport, verbose = false): string {
  const lines: string[] = [];

  // Header
  lines.push(boldBlue('╔══════════════════════════════════════════╗'));
  lines.push(boldBlue('║        VERIFICATION REPORT               ║'));
  lines.push(boldBlue('╚══════════════════════════════════════════╝'));
  lines.push('');

  // Summary
  lines.push(boldYellow('📊 Summary'));
  lines.push(colors.gray('─'.repeat(40)));
  lines.push(`  Total Goals:    ${report.summary.totalGoals}`);
  lines.push(`  ${colors.green('✓ Achieved')}:     ${report.summary.achievedGoals}`);
  lines.push(`  ${colors.yellow('⚠ Partial')}:      ${report.summary.partialGoals}`);
  lines.push(`  ${colors.red('✗ Failed')}:       ${report.summary.failedGoals}`);
  lines.push(`  Completion:     ${report.summary.overallCompletion}%`);
  lines.push(`  Must-Haves:     ${report.summary.totalMustHaves}`);
  lines.push(`  Gaps:           ${report.summary.totalGaps} (${colors.red(String(report.summary.criticalGaps))} critical)`);
  lines.push('');

  // Individual Results
  if (verbose) {
    lines.push(boldYellow('📋 Goal Details'));
    lines.push(colors.gray('─'.repeat(40)));

    for (const result of report.results) {
      const statusColor = result.achieved
        ? colors.green
        : result.completionPercentage > 0
        ? colors.yellow
        : colors.red;
      const statusIcon = result.achieved ? '✓' : result.completionPercentage > 0 ? '⚠' : '✗';

      lines.push(`\n  ${statusColor(statusIcon)} ${colors.bold(result.goalId)}`);
      lines.push(`     Completion: ${result.completionPercentage}%`);
      lines.push(`     Must-Haves: ${result.stats.satisfied}/${result.stats.totalMustHaves}`);
      lines.push(`     Gaps: ${result.gaps.length}`);

      if (result.gaps.length > 0) {
        lines.push(`     ${colors.gray('Gaps:')}`);
        for (const gap of result.gaps.slice(0, 5)) {
          const colorFn = severityColors[gap.severity];
          lines.push(
            `       ${severityIcons[gap.severity]} ${colorFn(gap.severity)}: ${gap.description.substring(0, 60)}${
              gap.description.length > 60 ? '...' : ''
            }`
          );
        }
        if (result.gaps.length > 5) {
          lines.push(`       ${colors.gray(`... and ${result.gaps.length - 5} more`)}`);
        }
      }
    }
    lines.push('');
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push(boldYellow('💡 Recommendations'));
    lines.push(colors.gray('─'.repeat(40)));
    for (let i = 0; i < report.recommendations.length; i++) {
      lines.push(`  ${i + 1}. ${report.recommendations[i]}`);
    }
    lines.push('');
  }

  // Footer
  const allAchieved = report.summary.achievedGoals === report.summary.totalGoals;
  if (allAchieved) {
    lines.push(boldGreen('✅ All goals achieved!'));
  } else {
    lines.push(boldYellow(`⚠️ ${report.summary.totalGoals - report.summary.achievedGoals} goal(s) need attention`));
  }

  return lines.join('\n');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// Report Writer
// ============================================================================

/**
 * Generate report in the specified format
 */
export function generateReport(
  report: VerificationReport,
  format: ReportFormat,
  verbose = false
): string {
  switch (format) {
    case 'json':
      return generateJSON(report);
    case 'markdown':
      return generateMarkdown(report);
    case 'html':
      return generateHTML(report);
    case 'console':
      return generateConsole(report, verbose);
    default:
      throw new Error(`Unknown report format: ${format}`);
  }
}

/**
 * Write report to file or stdout
 */
export async function writeReport(
  report: VerificationReport,
  options: ReportOptions
): Promise<void> {
  const content = generateReport(report, options.format, options.includeDetails);

  if (options.outputPath) {
    // Ensure directory exists
    const dir = path.dirname(options.outputPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(options.outputPath, content, 'utf-8');
  } else {
    // Write to stdout
    console.log(content);
  }
}

/**
 * Filter gaps by severity for reporting
 */
export function filterGapsBySeverity(
  gaps: Gap[],
  minSeverity: GapSeverity
): Gap[] {
  const severityOrder: GapSeverity[] = ['info', 'minor', 'major', 'critical'];
  const minIndex = severityOrder.indexOf(minSeverity);

  return gaps.filter(gap => {
    const gapIndex = severityOrder.indexOf(gap.severity);
    return gapIndex >= minIndex;
  });
}

// ============================================================================
// Report Builder Class
// ============================================================================

/**
 * Builder for creating verification reports
 */
export class ReportBuilder {
  private results: VerificationResult[] = [];
  private goals: Map<string, Goal> = new Map();

  /**
   * Add a verification result
   */
  addResult(result: VerificationResult): this {
    this.results.push(result);
    return this;
  }

  /**
   * Add multiple verification results
   */
  addResults(results: VerificationResult[]): this {
    this.results.push(...results);
    return this;
  }

  /**
   * Associate a goal with its ID for richer reports
   */
  addGoal(goal: Goal): this {
    this.goals.set(goal.id, goal);
    return this;
  }

  /**
   * Build the verification report
   */
  build(): VerificationReport {
    return createReport(this.results, this.goals);
  }

  /**
   * Generate and return report in specified format
   */
  generate(format: ReportFormat, verbose = false): string {
    const report = this.build();
    return generateReport(report, format, verbose);
  }

  /**
   * Write report to file
   */
  async write(options: ReportOptions): Promise<void> {
    const report = this.build();
    await writeReport(report, options);
  }

  /**
   * Clear all results
   */
  clear(): void {
    this.results = [];
    this.goals.clear();
  }

  /**
   * Get the number of results
   */
  get resultCount(): number {
    return this.results.length;
  }
}

// ============================================================================
// Utility Exports
// ============================================================================

export { severityColors, severityIcons };
