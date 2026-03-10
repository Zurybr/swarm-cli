/**
 * Pattern Analysis Analyzer
 *
 * Detects insecure code patterns using regex-based analysis.
 * Covers SQL injection, XSS, eval() usage, and other common vulnerabilities.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SecurityFinding, SeverityLevel } from '../../types';

/**
 * Pattern finding
 */
export interface PatternFinding extends SecurityFinding {
  type: 'pattern';
  patternName: string;
}

/**
 * Insecure pattern definition
 */
interface InsecurePattern {
  name: string;
  regex: RegExp;
  severity: SeverityLevel;
  title: string;
  description: string;
  suggestion: string;
  languages: string[]; // File extensions to check
}

/**
 * Known insecure patterns
 */
const INSECURE_PATTERNS: InsecurePattern[] = [
  {
    name: 'sql-injection-concat',
    regex: /(?:query|exec|execute)\s*\(\s*["'`][^"'`]*\$\{[^}]+\}/gi,
    severity: 'critical',
    title: 'Potential SQL Injection',
    description: 'String concatenation in SQL queries can lead to SQL injection attacks.',
    suggestion: 'Use parameterized queries or prepared statements instead of string concatenation.',
    languages: ['.js', '.ts', '.jsx', '.tsx'],
  },
  {
    name: 'eval-usage',
    regex: /\beval\s*\(/g,
    severity: 'critical',
    title: 'Dangerous eval() Usage',
    description: 'eval() executes arbitrary code and is a major security risk.',
    suggestion: 'Use JSON.parse() for JSON data or safer alternatives like Function constructor with caution.',
    languages: ['.js', '.ts', '.jsx', '.tsx'],
  },
  {
    name: 'inner-html',
    regex: /\.innerHTML\s*=/g,
    severity: 'high',
    title: 'Potential XSS via innerHTML',
    description: 'Setting innerHTML with untrusted data can lead to XSS attacks.',
    suggestion: 'Use textContent for plain text or sanitize HTML before insertion with a library like DOMPurify.',
    languages: ['.js', '.ts', '.jsx', '.tsx'],
  },
  {
    name: 'document-write',
    regex: /document\.write\s*\(/g,
    severity: 'high',
    title: 'Dangerous document.write()',
    description: 'document.write() can lead to XSS and performance issues.',
    suggestion: 'Use DOM manipulation methods like createElement and appendChild instead.',
    languages: ['.js', '.ts', '.jsx', '.tsx'],
  },
  {
    name: 'dangerous-function',
    regex: /\b(new\s+Function\s*\(|setTimeout\s*\(\s*["'`]|setInterval\s*\(\s*["'`])/g,
    severity: 'high',
    title: 'Code Execution via String',
    description: 'Passing strings to Function constructor, setTimeout, or setInterval executes code.',
    suggestion: 'Pass function references instead of strings to setTimeout/setInterval. Avoid new Function().',
    languages: ['.js', '.ts', '.jsx', '.tsx'],
  },
  {
    name: 'insecure-random',
    regex: /Math\.random\s*\(\s*\)/g,
    severity: 'medium',
    title: 'Insecure Random Number Generation',
    description: 'Math.random() is not cryptographically secure and should not be used for security purposes.',
    suggestion: 'Use crypto.getRandomValues() or crypto.randomBytes() for security-sensitive random values.',
    languages: ['.js', '.ts', '.jsx', '.tsx'],
  },
  {
    name: 'hardcoded-ip',
    regex: /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    severity: 'low',
    title: 'Hardcoded IP Address',
    description: 'Hardcoded IP addresses can make code less portable and harder to configure.',
    suggestion: 'Consider using configuration files or environment variables for IP addresses.',
    languages: ['.js', '.ts', '.jsx', '.tsx', '.json', '.yaml', '.yml'],
  },
  {
    name: 'disabled-security',
    regex: /(rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]0['"])/g,
    severity: 'critical',
    title: 'Disabled TLS Certificate Validation',
    description: 'Disabling TLS certificate validation makes the application vulnerable to MITM attacks.',
    suggestion: 'Never disable TLS certificate validation in production. Use proper certificates.',
    languages: ['.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  {
    name: 'debug-mode',
    regex: /(DEBUG\s*=\s*true|debug\s*:\s*true|NODE_ENV\s*=\s*['"]development['"])/g,
    severity: 'low',
    title: 'Debug Mode Enabled',
    description: 'Debug mode may expose sensitive information in production.',
    suggestion: 'Ensure debug mode is disabled in production environments.',
    languages: ['.js', '.ts', '.jsx', '.tsx', '.json'],
  },
];

/**
 * Get file extension
 */
function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Check if file should be scanned
 */
function shouldScanFile(filePath: string): boolean {
  const excludedDirs = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.cache',
  ];

  const normalizedPath = filePath.replace(/\\/g, '/');
  for (const dir of excludedDirs) {
    if (normalizedPath.includes(`/${dir}/`)) {
      return false;
    }
  }

  const ext = getFileExtension(filePath);
  const supportedExts = new Set(['.js', '.ts', '.jsx', '.tsx', '.json', '.yaml', '.yml']);
  return supportedExts.has(ext);
}

/**
 * Get all files recursively
 */
async function getFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
          continue;
        }
        await walk(fullPath);
      } else if (entry.isFile() && shouldScanFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

/**
 * Generate a unique finding ID
 */
function generateFindingId(filePath: string, line: number, patternName: string): string {
  const hash = Buffer.from(`${filePath}:${line}:${patternName}`).toString('base64').slice(0, 12);
  return `PAT-${hash}`;
}

/**
 * Analyze a single file for insecure patterns
 */
async function analyzeFile(
  filePath: string,
  severityThreshold: SeverityLevel = 'low'
): Promise<PatternFinding[]> {
  const findings: PatternFinding[] = [];
  const severityOrder: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];
  const thresholdIndex = severityOrder.indexOf(severityThreshold);
  const fileExt = getFileExtension(filePath);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      for (const pattern of INSECURE_PATTERNS) {
        // Skip if pattern doesn't apply to this file type
        if (!pattern.languages.includes(fileExt)) {
          continue;
        }

        // Reset regex lastIndex
        pattern.regex.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = pattern.regex.exec(line)) !== null) {
          const severityIndex = severityOrder.indexOf(pattern.severity);
          if (severityIndex >= thresholdIndex) {
            findings.push({
              id: generateFindingId(filePath, lineIndex + 1, pattern.name),
              filePath,
              line: lineIndex + 1,
              column: match.index + 1,
              severity: pattern.severity,
              type: 'pattern',
              patternName: pattern.name,
              title: pattern.title,
              description: pattern.description,
              suggestion: pattern.suggestion,
              match: match[0].slice(0, 50),
            });
          }
        }
      }
    }
  } catch (error) {
    // Skip files that can't be read
  }

  return findings;
}

/**
 * Analyze code for insecure patterns
 */
export async function analyzePatterns(
  targetPath: string,
  severityThreshold: SeverityLevel = 'low'
): Promise<PatternFinding[]> {
  const stats = await fs.stat(targetPath);

  if (stats.isFile()) {
    return analyzeFile(targetPath, severityThreshold);
  }

  const files = await getFiles(targetPath);
  const allFindings: PatternFinding[] = [];

  for (const file of files) {
    const findings = await analyzeFile(file, severityThreshold);
    allFindings.push(...findings);
  }

  return allFindings;
}
