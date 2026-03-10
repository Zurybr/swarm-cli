/**
 * Documentation Expert Skill
 *
 * Monolithic skill that analyzes documentation quality and generates JSDoc.
 * Uses ts-morph for AST-based signature comparison.
 *
 * Features:
 * - Detect missing JSDoc on exported functions
 * - Compare JSDoc params with actual function parameters
 * - Detect return type mismatches
 * - Generate JSDoc templates for undocumented functions
 * - Preserve existing JSDoc when adding missing params
 * - Handle complex types (generics, unions)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Project } from 'ts-morph';
import {
  BaseExpertSkill,
  ExpertOutput,
  DocumentationTaskInput,
  DriftFinding,
  SeverityLevel,
} from '../types';
import {
  detectDrift,
  getDriftSummary,
  DriftDetectionOptions,
} from './analyzers/drift';
import {
  generateJsDocForProject,
  getGenerationSummary,
} from './analyzers/generator';

/**
 * Documentation Expert Skill implementation
 */
export class DocumentationExpertSkill implements BaseExpertSkill<DocumentationTaskInput, ExpertOutput<DriftFinding>> {
  readonly id = 'documentation-expert';
  readonly name = 'Documentation Expert';
  readonly version = '1.0.0';

  /**
   * Execute documentation analysis
   */
  async execute(input: DocumentationTaskInput): Promise<ExpertOutput<DriftFinding>> {
    const startTime = Date.now();
    const errors: string[] = [];

    const severityThreshold = input.severityThreshold || 'low';

    // Build drift detection options
    const driftOptions: DriftDetectionOptions = {
      checkMissingJsDoc: input.checkMissingJsDoc ?? true,
      checkParamMismatch: input.checkParamMismatch ?? true,
      checkReturnMismatch: input.checkReturnMismatch ?? true,
    };

    try {
      // Detect documentation drift
      const findings = await detectDrift(
        input.targetPath,
        input.tsConfigPath,
        driftOptions
      );

      // Filter by severity threshold
      const severityOrder: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];
      const thresholdIndex = severityOrder.indexOf(severityThreshold);
      const filteredFindings = findings.filter(f => {
        const severityIndex = severityOrder.indexOf(f.severity);
        return severityIndex >= thresholdIndex;
      });

      // Generate JSDoc templates if requested
      let generatedJsDocs: Array<{ functionName: string; filePath: string; jsDoc: string }> = [];
      if (input.generateTemplates) {
        const templates = await generateJsDocForProject(
          input.targetPath,
          input.tsConfigPath,
          false // Only undocumented functions
        );
        generatedJsDocs = templates.map(t => ({
          functionName: t.functionName,
          filePath: t.filePath,
          jsDoc: t.jsDoc,
        }));
      }

      // Calculate summary statistics
      const driftSummary = getDriftSummary(filteredFindings);
      const filesScanned = await this.countFilesScanned(input.targetPath);

      // Build output
      const json = {
        findings: filteredFindings,
        summary: {
          totalIssues: filteredFindings.length,
          criticalCount: filteredFindings.filter(f => f.severity === 'critical').length,
          highCount: filteredFindings.filter(f => f.severity === 'high').length,
          mediumCount: filteredFindings.filter(f => f.severity === 'medium').length,
          lowCount: filteredFindings.filter(f => f.severity === 'low').length,
          filesScanned,
          drift: driftSummary,
          generatedTemplates: generatedJsDocs.length,
        },
        metadata: {
          durationMs: Date.now() - startTime,
          expertVersion: this.version,
          scannedAt: new Date().toISOString(),
        },
        errors: errors.length > 0 ? errors : undefined,
        generatedJsDocs: input.generateTemplates ? generatedJsDocs : undefined,
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
            drift: {
              missingDocCount: 0,
              paramMismatchCount: 0,
              returnMismatchCount: 0,
              deprecatedParamCount: 0,
            },
            generatedTemplates: 0,
          },
          metadata: {
            durationMs: Date.now() - startTime,
            expertVersion: this.version,
            scannedAt: new Date().toISOString(),
          },
          errors,
        },
        markdown: this.buildErrorReport(error, input),
      };
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

      // Count TypeScript files
      const project = new Project({
        skipAddingFilesFromTsConfig: true,
      });
      project.addSourceFilesAtPaths(`${targetPath}/**/*.ts`);
      return project.getSourceFiles().length;
    } catch {
      return 0;
    }
  }

  /**
   * Build human-readable Markdown report
   */
  private buildMarkdownReport(
    json: {
      findings: DriftFinding[];
      summary: {
        totalIssues: number;
        criticalCount: number;
        highCount: number;
        mediumCount: number;
        lowCount: number;
        filesScanned: number;
        drift: {
          missingDocCount: number;
          paramMismatchCount: number;
          returnMismatchCount: number;
          deprecatedParamCount: number;
        };
        generatedTemplates: number;
      };
      metadata: { durationMs: number; expertVersion: string; scannedAt: string };
      errors?: string[];
      generatedJsDocs?: Array<{ functionName: string; filePath: string; jsDoc: string }>;
    },
    input: DocumentationTaskInput
  ): string {
    const lines: string[] = [];

    // Header
    lines.push('# Documentation Analysis Report');
    lines.push('');
    lines.push(`**Target:** ${input.targetPath}`);
    lines.push(`**Generated:** ${json.metadata.scannedAt}`);
    lines.push(`**Duration:** ${json.metadata.durationMs}ms`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total Issues:** ${json.summary.totalIssues}`);
    lines.push(`- **Missing Documentation:** ${json.summary.drift.missingDocCount}`);
    lines.push(`- **Parameter Mismatches:** ${json.summary.drift.paramMismatchCount}`);
    lines.push(`- **Return Type Mismatches:** ${json.summary.drift.returnMismatchCount}`);
    lines.push(`- **Deprecated Parameters:** ${json.summary.drift.deprecatedParamCount}`);
    lines.push(`- **Files Scanned:** ${json.summary.filesScanned}`);
    if (input.generateTemplates) {
      lines.push(`- **Generated Templates:** ${json.summary.generatedTemplates}`);
    }
    lines.push('');

    // Findings by severity
    const criticalFindings = json.findings.filter(f => f.severity === 'critical' || f.severity === 'high');
    if (criticalFindings.length > 0) {
      lines.push('## High Priority Issues');
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

    // Generated templates
    if (json.generatedJsDocs && json.generatedJsDocs.length > 0) {
      lines.push('## Generated JSDoc Templates');
      lines.push('');
      for (const template of json.generatedJsDocs.slice(0, 10)) { // Show first 10
        lines.push(`### ${template.functionName}`);
        lines.push(`**File:** ${template.filePath}`);
        lines.push('');
        lines.push('```typescript');
        lines.push(template.jsDoc);
        lines.push('```');
        lines.push('');
      }
      if (json.generatedJsDocs.length > 10) {
        lines.push(`*... and ${json.generatedJsDocs.length - 10} more*`);
        lines.push('');
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
      lines.push('All scanned functions have proper documentation.');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format a single finding as markdown
   */
  private formatFinding(finding: DriftFinding): string {
    const lines: string[] = [];

    lines.push(`### ${finding.title}`);
    lines.push('');
    lines.push(`- **Severity:** ${finding.severity.toUpperCase()}`);
    lines.push(`- **Type:** ${finding.driftType}`);
    lines.push(`- **File:** ${finding.filePath}:${finding.line}`);
    lines.push('');
    lines.push(finding.description);
    lines.push('');

    if (finding.expected || finding.actual) {
      lines.push('**Expected:**');
      lines.push(finding.expected);
      lines.push('');
      lines.push('**Actual:**');
      lines.push(finding.actual);
      lines.push('');
    }

    if (finding.suggestedJsDoc) {
      lines.push('**Suggested JSDoc:**');
      lines.push('```typescript');
      lines.push(finding.suggestedJsDoc);
      lines.push('```');
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
  private buildErrorReport(error: unknown, input: DocumentationTaskInput): string {
    const lines: string[] = [];

    lines.push('# Documentation Analysis Report');
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
export { DriftFinding, GeneratedJsDoc } from './analyzers/generator';
