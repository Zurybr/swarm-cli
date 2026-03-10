/**
 * Complexity Analyzer
 *
 * Uses typhonjs-escomplex to calculate cyclomatic complexity,
 * Halstead metrics, and maintainability index.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import escomplex from 'typhonjs-escomplex';
import { ComplexityReport, FunctionMetrics } from '../../types';

/**
 * File analysis result
 */
export interface FileComplexityResult {
  filePath: string;
  report: ComplexityReport;
  error?: string;
}

/**
 * Get file extension
 */
function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Check if file should be analyzed
 */
function shouldAnalyzeFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx';
}

/**
 * Check if file is likely generated (too large)
 */
async function isGeneratedFile(filePath: string, maxLines = 1000): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    return lines.length > maxLines;
  } catch {
    return true; // Treat unreadable files as generated
  }
}

/**
 * Read .gitignore patterns
 */
async function readGitignore(dir: string): Promise<string[]> {
  try {
    const content = await fs.readFile(path.join(dir, '.gitignore'), 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch {
    return [];
  }
}

/**
 * Check if path should be excluded based on patterns
 */
function shouldExclude(filePath: string, patterns: string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of patterns) {
    // Simple pattern matching
    const cleanPattern = pattern.replace(/\/$/, '');
    if (normalizedPath.includes(cleanPattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Get all files recursively, respecting .gitignore
 */
async function getFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const gitignorePatterns = await readGitignore(dir);
  const defaultExcludes = ['node_modules', '.git', 'dist', 'build', 'coverage'];

  async function walk(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (defaultExcludes.includes(entry.name)) {
          continue;
        }
        if (shouldExclude(fullPath, gitignorePatterns)) {
          continue;
        }
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (shouldExclude(fullPath, gitignorePatterns)) {
          continue;
        }
        if (shouldAnalyzeFile(fullPath)) {
          files.push(fullPath);
        }
      }
    }
  }

  await walk(dir);
  return files;
}

/**
 * Analyze a single file for complexity
 */
export async function analyzeFile(filePath: string): Promise<FileComplexityResult> {
  try {
    // Skip generated files
    if (await isGeneratedFile(filePath)) {
      return {
        filePath,
        report: null as any,
        error: 'File too large (likely generated)',
      };
    }

    const source = await fs.readFile(filePath, 'utf-8');

    // Use typhonjs-escomplex for analysis
    const report = escomplex.analyzeModule(source);

    // Transform to our ComplexityReport format
    const complexityReport: ComplexityReport = {
      filePath,
      maintainability: report.maintainability,
      cyclomatic: report.aggregate.cyclomatic,
      halstead: {
        bugs: report.aggregate.halstead.bugs,
        difficulty: report.aggregate.halstead.difficulty,
        effort: report.aggregate.halstead.effort,
      },
      functions: (report.methods || []).map((fn: any) => ({
        name: fn.name,
        line: fn.lineStart,
        cyclomatic: fn.cyclomatic,
        params: fn.paramCount,
        sloc: fn.sloc.logical,
        halstead: {
          bugs: fn.halstead.bugs,
          difficulty: fn.halstead.difficulty,
          effort: fn.halstead.effort,
        },
      })),
    };

    return {
      filePath,
      report: complexityReport,
    };
  } catch (error) {
    return {
      filePath,
      report: null as any,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Analyze complexity for all files in a directory
 */
export async function analyzeComplexity(targetPath: string): Promise<ComplexityReport[]> {
  const stats = await fs.stat(targetPath);

  if (stats.isFile()) {
    const result = await analyzeFile(targetPath);
    return result.error ? [] : [result.report];
  }

  const files = await getFiles(targetPath);
  const reports: ComplexityReport[] = [];

  for (const file of files) {
    const result = await analyzeFile(file);
    if (!result.error && result.report) {
      reports.push(result.report);
    }
  }

  return reports;
}

/**
 * Get aggregate complexity metrics
 */
export function getAggregateMetrics(reports: ComplexityReport[]): {
  averageMaintainability: number;
  averageCyclomatic: number;
  totalBugs: number;
  totalEffort: number;
  fileCount: number;
} {
  if (reports.length === 0) {
    return {
      averageMaintainability: 0,
      averageCyclomatic: 0,
      totalBugs: 0,
      totalEffort: 0,
      fileCount: 0,
    };
  }

  const totalMaintainability = reports.reduce((sum, r) => sum + r.maintainability, 0);
  const totalCyclomatic = reports.reduce((sum, r) => sum + r.cyclomatic, 0);
  const totalBugs = reports.reduce((sum, r) => sum + r.halstead.bugs, 0);
  const totalEffort = reports.reduce((sum, r) => sum + r.halstead.effort, 0);

  return {
    averageMaintainability: totalMaintainability / reports.length,
    averageCyclomatic: totalCyclomatic / reports.length,
    totalBugs,
    totalEffort,
    fileCount: reports.length,
  };
}
