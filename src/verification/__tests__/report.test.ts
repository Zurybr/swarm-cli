/**
 * Tests for report generation
 */

import {
  ReportBuilder,
  generateSummary,
  generateRecommendations,
  createReport,
  generateJSON,
  generateMarkdown,
  generateHTML,
  generateConsole,
  filterGapsBySeverity,
  severityColors,
  severityIcons,
} from '../report';
import type { VerificationResult, VerificationReport, Gap } from '../types';

describe('Report Generation', () => {
  const mockResults: VerificationResult[] = [
    {
      goalId: 'goal-1',
      achieved: true,
      completionPercentage: 100,
      mustHaveResults: [],
      gaps: [],
      stats: {
        totalMustHaves: 2,
        satisfied: 2,
        failed: 0,
        pending: 0,
        criticalGaps: 0,
        majorGaps: 0,
        minorGaps: 0,
        weightedSatisfaction: 100,
      },
      verifiedAt: new Date('2024-01-01'),
      duration: 100,
      method: 'backward',
    },
    {
      goalId: 'goal-2',
      achieved: false,
      completionPercentage: 50,
      mustHaveResults: [],
      gaps: [
        {
          id: 'gap-1',
          description: 'Missing file',
          severity: 'critical',
          mustHaveId: 'mh-1',
          goalId: 'goal-2',
          expected: 'file.txt',
          actual: null,
          blocking: true,
          remediation: ['Create file', 'Add content'],
          estimatedEffort: 8,
          identifiedAt: new Date('2024-01-01'),
        },
        {
          id: 'gap-2',
          description: 'Wrong value',
          severity: 'minor',
          mustHaveId: 'mh-2',
          goalId: 'goal-2',
          expected: 'correct',
          actual: 'wrong',
          blocking: false,
          remediation: ['Update value'],
          estimatedEffort: 2,
          identifiedAt: new Date('2024-01-01'),
        },
      ],
      stats: {
        totalMustHaves: 2,
        satisfied: 1,
        failed: 1,
        pending: 0,
        criticalGaps: 1,
        majorGaps: 0,
        minorGaps: 1,
        weightedSatisfaction: 50,
      },
      verifiedAt: new Date('2024-01-01'),
      duration: 150,
      method: 'backward',
    },
  ];

  describe('generateSummary', () => {
    it('should generate correct summary statistics', () => {
      const summary = generateSummary(mockResults);

      expect(summary.totalGoals).toBe(2);
      expect(summary.achievedGoals).toBe(1);
      expect(summary.partialGoals).toBe(1);  // 50% completion = partial
      expect(summary.failedGoals).toBe(0);   // No goals with 0% completion
      expect(summary.totalMustHaves).toBe(4);
      expect(summary.totalGaps).toBe(2);
      expect(summary.criticalGaps).toBe(1);
    });

    it('should calculate overall completion', () => {
      const summary = generateSummary(mockResults);

      // (100 + 50) / 2 = 75
      expect(summary.overallCompletion).toBe(75);
    });

    it('should calculate total duration', () => {
      const summary = generateSummary(mockResults);

      expect(summary.totalDuration).toBe(250);
    });

    it('should handle empty results', () => {
      const summary = generateSummary([]);

      expect(summary.totalGoals).toBe(0);
      expect(summary.overallCompletion).toBe(0);
    });
  });

  describe('generateRecommendations', () => {
    it('should recommend addressing blocking gaps', () => {
      const recommendations = generateRecommendations(mockResults);

      expect(recommendations.some((r) => r.includes('blocking'))).toBe(true);
    });

    it('should recommend prioritizing critical gaps', () => {
      const recommendations = generateRecommendations(mockResults);

      expect(recommendations.some((r) => r.includes('critical'))).toBe(true);
    });

    it('should include effort estimates', () => {
      const recommendations = generateRecommendations(mockResults);

      expect(recommendations.some((r) => r.includes('story points'))).toBe(true);
    });

    it('should recommend focusing on lowest completion', () => {
      const recommendations = generateRecommendations(mockResults);

      expect(recommendations.some((r) => r.includes('lowest completion'))).toBe(true);
    });

    it('should handle results with no gaps', () => {
      const recommendations = generateRecommendations([mockResults[0]]);

      // Should have fewer recommendations
      expect(recommendations.length).toBeLessThan(5);
    });
  });

  describe('createReport', () => {
    it('should create a complete report', () => {
      const report = createReport(mockResults);

      expect(report.summary.totalGoals).toBe(2);
      expect(report.results).toHaveLength(2);
      expect(report.allGaps).toHaveLength(2);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.generatedAt).toBeInstanceOf(Date);
    });
  });

  describe('generateJSON', () => {
    it('should generate valid JSON', () => {
      const report = createReport(mockResults);
      const json = generateJSON(report);

      const parsed = JSON.parse(json);
      expect(parsed.summary.totalGoals).toBe(2);
      expect(parsed.results).toHaveLength(2);
    });

    it('should support compact format', () => {
      const report = createReport(mockResults);
      const compact = generateJSON(report, false);
      const pretty = generateJSON(report, true);

      expect(compact.length).toBeLessThan(pretty.length);
    });
  });

  describe('generateMarkdown', () => {
    it('should generate markdown with header', () => {
      const report = createReport(mockResults);
      const markdown = generateMarkdown(report);

      expect(markdown).toContain('# Verification Report');
      expect(markdown).toContain('## Summary');
      expect(markdown).toContain('## Goal Results');
    });

    it('should include goal details', () => {
      const report = createReport(mockResults);
      const markdown = generateMarkdown(report);

      expect(markdown).toContain('goal-1');
      expect(markdown).toContain('goal-2');
      expect(markdown).toContain('100%');
      expect(markdown).toContain('50%');
    });

    it('should include gap details', () => {
      const report = createReport(mockResults);
      const markdown = generateMarkdown(report);

      expect(markdown).toContain('Missing file');
      expect(markdown).toContain('Critical');
    });

    it('should include recommendations', () => {
      const report = createReport(mockResults);
      const markdown = generateMarkdown(report);

      expect(markdown).toContain('## Recommendations');
    });
  });

  describe('generateHTML', () => {
    it('should generate valid HTML', () => {
      const report = createReport(mockResults);
      const html = generateHTML(report);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    it('should include summary cards', () => {
      const report = createReport(mockResults);
      const html = generateHTML(report);

      expect(html).toContain('Total Goals');
      expect(html).toContain('Achieved');
    });

    it('should include gap table', () => {
      const report = createReport(mockResults);
      const html = generateHTML(report);

      expect(html).toContain('<table');
      expect(html).toContain('Missing file');
    });

    it('should escape HTML in content', () => {
      const resultsWithHtml: VerificationResult[] = [
        {
          ...mockResults[0],
          goalId: 'goal-<script>',
        },
      ];
      const report = createReport(resultsWithHtml);
      const html = generateHTML(report);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('generateConsole', () => {
    it('should generate console output', () => {
      const report = createReport(mockResults);
      const output = generateConsole(report);

      expect(output).toContain('VERIFICATION REPORT');
      expect(output).toContain('Summary');
    });

    it('should include verbose details when requested', () => {
      const report = createReport(mockResults);
      const verbose = generateConsole(report, true);
      const brief = generateConsole(report, false);

      expect(verbose.length).toBeGreaterThan(brief.length);
      expect(verbose).toContain('Goal Details');
    });

    it('should show status indicators', () => {
      const report = createReport(mockResults);
      const output = generateConsole(report);

      expect(output).toContain('Total Goals');
      expect(output).toContain('Achieved');
    });
  });

  describe('filterGapsBySeverity', () => {
    const gaps: Gap[] = [
      { id: '1', severity: 'info' } as Gap,
      { id: '2', severity: 'minor' } as Gap,
      { id: '3', severity: 'major' } as Gap,
      { id: '4', severity: 'critical' } as Gap,
    ];

    it('should filter by minimum severity', () => {
      const filtered = filterGapsBySeverity(gaps, 'major');

      expect(filtered).toHaveLength(2);
      expect(filtered.map((g) => g.id)).toEqual(['3', '4']);
    });

    it('should include all when min is info', () => {
      const filtered = filterGapsBySeverity(gaps, 'info');

      expect(filtered).toHaveLength(4);
    });

    it('should return empty for critical only', () => {
      const filtered = filterGapsBySeverity(
        gaps.filter((g) => g.severity === 'info'),
        'critical'
      );

      expect(filtered).toHaveLength(0);
    });
  });

  describe('ReportBuilder', () => {
    let builder: ReportBuilder;

    beforeEach(() => {
      builder = new ReportBuilder();
    });

    it('should add results', () => {
      builder.addResult(mockResults[0]);

      expect(builder.resultCount).toBe(1);
    });

    it('should add multiple results', () => {
      builder.addResults(mockResults);

      expect(builder.resultCount).toBe(2);
    });

    it('should build report', () => {
      builder.addResults(mockResults);
      const report = builder.build();

      expect(report.summary.totalGoals).toBe(2);
      expect(report.results).toHaveLength(2);
    });

    it('should generate in different formats', () => {
      builder.addResults(mockResults);

      const json = builder.generate('json');
      expect(JSON.parse(json).summary.totalGoals).toBe(2);

      const markdown = builder.generate('markdown');
      expect(markdown).toContain('# Verification Report');

      const console = builder.generate('console');
      expect(console).toContain('VERIFICATION REPORT');
    });

    it('should clear results', () => {
      builder.addResults(mockResults);
      builder.clear();

      expect(builder.resultCount).toBe(0);
    });
  });

  describe('Severity helpers', () => {
    it('should have color functions for all severities', () => {
      expect(severityColors.critical).toBeDefined();
      expect(severityColors.major).toBeDefined();
      expect(severityColors.minor).toBeDefined();
      expect(severityColors.info).toBeDefined();
    });

    it('should have icons for all severities', () => {
      expect(severityIcons.critical).toBeDefined();
      expect(severityIcons.major).toBeDefined();
      expect(severityIcons.minor).toBeDefined();
      expect(severityIcons.info).toBeDefined();
    });
  });
});
