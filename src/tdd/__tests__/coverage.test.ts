/**
 * Coverage tests for TDD module
 */

import {
  CoverageManager,
  meetsThresholds,
  calculateCoverageDelta,
  mergeReports,
  type TrendDataPoint,
} from '../coverage';
import type {
  CoverageConfig,
  CoverageReport,
  CoverageSummary,
  FileCoverage,
  CoverageThresholds,
} from '../types';

const mockCoverageConfig: CoverageConfig = {
  enabled: true,
  thresholds: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
  include: ['src/**/*.ts'],
  exclude: ['**/*.test.ts'],
  reporter: ['text', 'json'],
  outputDir: './coverage',
};

describe('CoverageManager', () => {
  let manager: CoverageManager;

  beforeEach(() => {
    manager = new CoverageManager(mockCoverageConfig);
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = manager.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.thresholds.statements).toBe(80);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      manager.updateConfig({ enabled: false });

      expect(manager.getConfig().enabled).toBe(false);
    });
  });

  describe('runCoverage', () => {
    it('should throw error if coverage is disabled', async () => {
      manager.updateConfig({ enabled: false });

      await expect(manager.runCoverage()).rejects.toThrow('Coverage is disabled');
    });

    it('should generate a coverage report', async () => {
      const report = await manager.runCoverage();

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.summary).toBeDefined();
    });

    it('should associate report with cycle ID', async () => {
      const report = await manager.runCoverage('cycle-1');

      expect(report.cycleId).toBe('cycle-1');
    });
  });

  describe('getReport', () => {
    it('should retrieve a report by ID', async () => {
      const report = await manager.runCoverage();
      const retrieved = manager.getReport(report.id);

      expect(retrieved).toBe(report);
    });

    it('should return undefined for unknown report', () => {
      expect(manager.getReport('unknown')).toBeUndefined();
    });
  });

  describe('getAllReports', () => {
    it('should return all reports', async () => {
      await manager.runCoverage();
      await new Promise(resolve => setTimeout(resolve, 10));
      await manager.runCoverage();

      const reports = manager.getAllReports();

      expect(reports.length).toBe(2);
    });
  });

  describe('getLatestReport', () => {
    it('should return the most recent report', async () => {
      const report1 = await manager.runCoverage();
      await new Promise(resolve => setTimeout(resolve, 10));
      const report2 = await manager.runCoverage();

      const latest = manager.getLatestReport();

      expect(latest?.id).toBe(report2.id);
    });

    it('should return undefined when no reports exist', () => {
      expect(manager.getLatestReport()).toBeUndefined();
    });
  });

  describe('getCoverageStatistics', () => {
    it('should return zero stats when no reports exist', () => {
      const stats = manager.getCoverageStatistics(80);

      expect(stats.statements).toBe(0);
      expect(stats.branches).toBe(0);
      expect(stats.functions).toBe(0);
      expect(stats.lines).toBe(0);
      expect(stats.target).toBe(80);
      expect(stats.targetMet).toBe(false);
    });

    it('should return statistics from latest report', async () => {
      await manager.runCoverage();
      const stats = manager.getCoverageStatistics(80);

      expect(stats.statements).toBeGreaterThanOrEqual(0);
      expect(stats.branches).toBeGreaterThanOrEqual(0);
      expect(stats.functions).toBeGreaterThanOrEqual(0);
      expect(stats.lines).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getCoverageTrend', () => {
    it('should return trend data points', async () => {
      await manager.runCoverage();
      await new Promise(resolve => setTimeout(resolve, 10));
      await manager.runCoverage();

      const trend = manager.getCoverageTrend();

      expect(trend.length).toBe(2);
      expect(trend[0].timestamp).toBeInstanceOf(Date);
      expect(typeof trend[0].statements).toBe('number');
    });
  });

  describe('exportReport', () => {
    it('should export report as JSON', async () => {
      const report = await manager.runCoverage();
      const json = manager.exportReport(report.id, 'json');

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should export report as text', async () => {
      const report = await manager.runCoverage();
      const text = manager.exportReport(report.id, 'text');

      expect(text).toContain('Coverage Report');
      expect(text).toContain('Summary');
    });

    it('should export report as HTML', async () => {
      const report = await manager.runCoverage();
      const html = manager.exportReport(report.id, 'html');

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Coverage Report');
    });

    it('should throw error for unknown report', () => {
      expect(() => manager.exportReport('unknown', 'json')).toThrow(
        'Report unknown not found'
      );
    });

    it('should throw error for unsupported format', async () => {
      const report = await manager.runCoverage();

      expect(() =>
        manager.exportReport(report.id, 'xml' as 'json')
      ).toThrow('Unsupported format: xml');
    });
  });
});

describe('Coverage utilities', () => {
  describe('meetsThresholds', () => {
    const createSummary = (pct: number): CoverageSummary => ({
      statements: { total: 100, covered: Math.round(pct), skipped: 0, pct },
      branches: { total: 100, covered: Math.round(pct), skipped: 0, pct },
      functions: { total: 100, covered: Math.round(pct), skipped: 0, pct },
      lines: { total: 100, covered: Math.round(pct), skipped: 0, pct },
    });

    it('should return true when all thresholds are met', () => {
      const summary = createSummary(85);
      const thresholds: CoverageThresholds = {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      };

      expect(meetsThresholds(summary, thresholds)).toBe(true);
    });

    it('should return false when any threshold is not met', () => {
      const summary = createSummary(75);
      const thresholds: CoverageThresholds = {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      };

      expect(meetsThresholds(summary, thresholds)).toBe(false);
    });

    it('should return true when exactly at threshold', () => {
      const summary = createSummary(80);
      const thresholds: CoverageThresholds = {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      };

      expect(meetsThresholds(summary, thresholds)).toBe(true);
    });
  });

  describe('calculateCoverageDelta', () => {
    const createReport = (pct: number): CoverageReport => ({
      id: 'test',
      timestamp: new Date(),
      summary: {
        statements: { total: 100, covered: Math.round(pct), skipped: 0, pct },
        branches: { total: 100, covered: Math.round(pct), skipped: 0, pct },
        functions: { total: 100, covered: Math.round(pct), skipped: 0, pct },
        lines: { total: 100, covered: Math.round(pct), skipped: 0, pct },
      },
      files: [],
      thresholdsMet: true,
      violations: [],
    });

    it('should calculate positive delta', () => {
      const current = createReport(90);
      const previous = createReport(80);

      const delta = calculateCoverageDelta(current, previous);

      expect(delta.statements).toBe(10);
      expect(delta.branches).toBe(10);
    });

    it('should calculate negative delta', () => {
      const current = createReport(70);
      const previous = createReport(85);

      const delta = calculateCoverageDelta(current, previous);

      expect(delta.statements).toBe(-15);
    });

    it('should calculate zero delta', () => {
      const current = createReport(80);
      const previous = createReport(80);

      const delta = calculateCoverageDelta(current, previous);

      expect(delta.statements).toBe(0);
    });
  });

  describe('mergeReports', () => {
    const createFileCoverage = (
      path: string,
      pct: number
    ): FileCoverage => ({
      path,
      statements: { total: 100, covered: Math.round(pct), skipped: 0, pct },
      branches: { total: 100, covered: Math.round(pct), skipped: 0, pct },
      functions: { total: 100, covered: Math.round(pct), skipped: 0, pct },
      lines: { total: 100, covered: Math.round(pct), skipped: 0, pct },
    });

    it('should merge multiple reports', () => {
      const report1: CoverageReport = {
        id: 'r1',
        timestamp: new Date(),
        summary: {
          statements: { total: 100, covered: 80, skipped: 0, pct: 80 },
          branches: { total: 100, covered: 80, skipped: 0, pct: 80 },
          functions: { total: 100, covered: 80, skipped: 0, pct: 80 },
          lines: { total: 100, covered: 80, skipped: 0, pct: 80 },
        },
        files: [createFileCoverage('file1.ts', 80)],
        thresholdsMet: true,
        violations: [],
      };

      const report2: CoverageReport = {
        id: 'r2',
        timestamp: new Date(),
        summary: {
          statements: { total: 100, covered: 90, skipped: 0, pct: 90 },
          branches: { total: 100, covered: 90, skipped: 0, pct: 90 },
          functions: { total: 100, covered: 90, skipped: 0, pct: 90 },
          lines: { total: 100, covered: 90, skipped: 0, pct: 90 },
        },
        files: [createFileCoverage('file2.ts', 90)],
        thresholdsMet: true,
        violations: [],
      };

      const merged = mergeReports([report1, report2]);

      expect(merged.files.length).toBe(2);
      expect(merged.files.some(f => f.path === 'file1.ts')).toBe(true);
      expect(merged.files.some(f => f.path === 'file2.ts')).toBe(true);
    });

    it('should merge files with same path', () => {
      const report1: CoverageReport = {
        id: 'r1',
        timestamp: new Date(),
        summary: {
          statements: { total: 100, covered: 80, skipped: 0, pct: 80 },
          branches: { total: 100, covered: 80, skipped: 0, pct: 80 },
          functions: { total: 100, covered: 80, skipped: 0, pct: 80 },
          lines: { total: 100, covered: 80, skipped: 0, pct: 80 },
        },
        files: [{
          path: 'file.ts',
          statements: { total: 100, covered: 80, skipped: 0, pct: 80 },
          branches: { total: 100, covered: 80, skipped: 0, pct: 80 },
          functions: { total: 100, covered: 80, skipped: 0, pct: 80 },
          lines: { total: 100, covered: 80, skipped: 0, pct: 80 },
        }],
        thresholdsMet: true,
        violations: [],
      };

      const report2: CoverageReport = {
        id: 'r2',
        timestamp: new Date(),
        summary: {
          statements: { total: 100, covered: 90, skipped: 0, pct: 90 },
          branches: { total: 100, covered: 90, skipped: 0, pct: 90 },
          functions: { total: 100, covered: 90, skipped: 0, pct: 90 },
          lines: { total: 100, covered: 90, skipped: 0, pct: 90 },
        },
        files: [{
          path: 'file.ts',
          statements: { total: 100, covered: 90, skipped: 0, pct: 90 },
          branches: { total: 100, covered: 90, skipped: 0, pct: 90 },
          functions: { total: 100, covered: 90, skipped: 0, pct: 90 },
          lines: { total: 100, covered: 90, skipped: 0, pct: 90 },
        }],
        thresholdsMet: true,
        violations: [],
      };

      const merged = mergeReports([report1, report2]);

      expect(merged.files.length).toBe(1);
      expect(merged.files[0].statements.pct).toBe(85); // Average of 80 and 90
    });
  });
});
