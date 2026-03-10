/**
 * Security Review Skill
 *
 * Monolithic skill that internally composes three analyzers:
 * - Secret detection (entropy + regex patterns)
 * - Vulnerability scanning (dependency CVEs)
 * - Pattern analysis (SQL injection, XSS, etc.)
 *
 * Returns dual format: JSON findings + Markdown report
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  BaseExpertSkill,
  ExpertOutput,
  SecurityTaskInput,
  SecurityFinding,
  SeverityLevel,
} from '../types';
import { detectSecrets, SecretFinding } from './analyzers/secrets';
import { scanVulnerabilities, VulnerabilityFinding } from './analyzers/vulnerabilities';
import { analyzePatterns, PatternFinding } from './analyzers/patterns';

/**
 * Security Review Skill implementation
 */
export class SecurityReviewSkill implements BaseExpertSkill<SecurityTaskInput, ExpertOutput<SecurityFinding>> {
  readonly id = 'security-review';
  readonly name = 'Security Review Expert';
  readonly version = '1.0.0';

  /**
   * Execute security review based on task input
   * Internally composes analyzers based on scanTypes parameter
   */
  async execute(input: SecurityTaskInput): Promise<ExpertOutput<SecurityFinding>> {
    const startTime = Date.now();
    const findings: SecurityFinding[] = [];
    const errors: string[] = [];

    const severityThreshold = input.severityThreshold || 'low';

    // Internal composition: run analyzers based on scanTypes
    for (const scanType of input.scanTypes) {
      try {
        switch (scanType) {
          case 'secrets': {
            const secretFindings = await detectSecrets(input.targetPath, severityThreshold);
            findings.push(...secretFindings);
            break;
          }
          case 'dependencies': {
            const vulnFindings = await scanVulnerabilities(input.targetPath, severityThreshold);
            findings.push(...vulnFindings);
            break;
          }
          case 'patterns': {
            const patternFindings = await analyzePatterns(input.targetPath, severityThreshold);
            findings.push(...patternFindings);
            break;
          }
        }
      } catch (error) {
        errors.push(`Error in ${scanType} scan: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Count files scanned
    const filesScanned = await this.countFilesScanned(input.targetPath);

    // Calculate summary statistics
    const summary = this.calculateSummary(findings, filesScanned);

    // Build output based on requested format
    const json = {
      findings,
      summary,
      metadata: {
        durationMs: Date.now() - startTime,
        expertVersion: this.version,
        scannedAt: new Date().toISOString(),
      },
      errors: errors.length > 0 ? errors : undefined,
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
  }

  /**
   * Count files that were scanned
   */
  private async countFilesScanned(targetPath: string): Promise<number> {
    try {
      const stats = await fs.stat(targetPath);
      if (stats.isFile()) {
        return 1;
      }

      let count = 0;
      const excludedDirs = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);

      async function walk(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!excludedDirs.has(entry.name)) {
              await walk(fullPath);
            }
          } else {
            count++;
          }
        }
      }

      await walk(targetPath);
      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Calculate summary statistics from findings
   */
  private calculateSummary(findings: SecurityFinding[], filesScanned: number) {
    return {
      totalIssues: findings.length,
      criticalCount: findings.filter(f => f.severity === 'critical').length,
      highCount: findings.filter(f => f.severity === 'high').length,
      mediumCount: findings.filter(f => f.severity === 'medium').length,
      lowCount: findings.filter(f => f.severity === 'low').length,
      filesScanned,
    };
  }

  /**
   * Build human-readable Markdown report
   */
  private buildMarkdownReport(
    json: {
      findings: SecurityFinding[];
      summary: { totalIssues: number; criticalCount: number; highCount: number; mediumCount: number; lowCount: number; filesScanned: number };
      metadata: { durationMs: number; expertVersion: string; scannedAt: string };
      errors?: string[];
    },
    input: SecurityTaskInput
  ): string {
    const lines: string[] = [];

    // Header
    lines.push('# Security Review Report');
    lines.push('');
    lines.push(`**Target:** ${input.targetPath}`);
    lines.push(`**Scan Types:** ${input.scanTypes.join(', ')}`);
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

    // Critical and High findings first
    const criticalFindings = json.findings.filter(f => f.severity === 'critical' || f.severity === 'high');
    if (criticalFindings.length > 0) {
      lines.push('## Critical & High Priority Findings');
      lines.push('');
      for (const finding of criticalFindings) {
        lines.push(this.formatFinding(finding));
      }
    }

    // Other findings
    const otherFindings = json.findings.filter(f => f.severity === 'medium' || f.severity === 'low');
    if (otherFindings.length > 0) {
      lines.push('## Other Findings');
      lines.push('');
      for (const finding of otherFindings) {
        lines.push(this.formatFinding(finding));
      }
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
      lines.push('No security issues were detected in the scanned files.');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format a single finding as markdown
   */
  private formatFinding(finding: SecurityFinding): string {
    const lines: string[] = [];

    lines.push(`### ${finding.title}`);
    lines.push('');
    lines.push(`- **Severity:** ${finding.severity.toUpperCase()}`);
    lines.push(`- **Type:** ${finding.type}`);
    lines.push(`- **File:** ${finding.filePath}:${finding.line}`);
    if (finding.column) {
      lines.push(`- **Column:** ${finding.column}`);
    }
    lines.push('');
    lines.push(finding.description);
    lines.push('');

    if (finding.match) {
      lines.push(`**Match:** \`${finding.match}\``);
      lines.push('');
    }

    if (finding.suggestion) {
      lines.push('**Suggestion:**');
      lines.push(finding.suggestion);
      lines.push('');
    }

    // Type-specific details
    if (finding.type === 'vulnerability') {
      const vuln = finding as VulnerabilityFinding;
      if (vuln.cveId) {
        lines.push(`**CVE:** ${vuln.cveId}`);
      }
      if (vuln.packageName) {
        lines.push(`**Package:** ${vuln.packageName}`);
      }
      if (vuln.vulnerableRange) {
        lines.push(`**Vulnerable Range:** ${vuln.vulnerableRange}`);
      }
      lines.push('');
    }

    if (finding.type === 'api-key' || finding.type === 'token' || finding.type === 'password') {
      const secret = finding as SecretFinding;
      if (secret.entropy !== undefined) {
        lines.push(`**Entropy:** ${secret.entropy.toFixed(2)}`);
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');

    return lines.join('\n');
  }
}

// Re-export types for consumers
export { SecurityFinding, SecretFinding, VulnerabilityFinding, PatternFinding };
