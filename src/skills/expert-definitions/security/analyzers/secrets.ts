/**
 * Secret Detection Analyzer
 *
 * Detects secrets in code using entropy analysis and regex patterns.
 * Based on Semgrep and GitLeaks patterns with high-entropy filtering.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SecurityFinding, SeverityLevel } from '../../types';

/**
 * Secret finding with entropy score
 */
export interface SecretFinding extends SecurityFinding {
  type: 'api-key' | 'password' | 'token' | 'private-key';
  entropy: number;
}

/**
 * Secret detection pattern configuration
 */
interface SecretPattern {
  type: SecretFinding['type'];
  name: string;
  regex: RegExp;
  minEntropy: number;
  severity: SeverityLevel;
}

/**
 * Secret detection patterns based on Semgrep/GitLeaks
 */
const SECRET_PATTERNS: SecretPattern[] = [
  {
    type: 'token',
    name: 'GitHub Token',
    regex: /\b(ghp|gho|ghu|ghs|ghr|github_pat)_[a-zA-Z0-9_]{36,}\b/g,
    minEntropy: 3.5,
    severity: 'critical',
  },
  {
    type: 'api-key',
    name: 'AWS Access Key',
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
    minEntropy: 3.0,
    severity: 'high',
  },
  {
    type: 'api-key',
    name: 'AWS Secret Key',
    regex: /\b[A-Za-z0-9/+=]{40}\b/g,
    minEntropy: 4.0,
    severity: 'critical',
  },
  {
    type: 'api-key',
    name: 'Generic API Key',
    regex: /\b(api[_-]?key|apikey)\s*[:=]\s*['"]([a-zA-Z0-9_\-]{16,})['"]/gi,
    minEntropy: 4.0,
    severity: 'high',
  },
  {
    type: 'token',
    name: 'Slack Token',
    regex: /\b(xox[baprs]-[0-9a-zA-Z]{10,48})\b/g,
    minEntropy: 3.5,
    severity: 'high',
  },
  {
    type: 'token',
    name: 'JWT Token',
    regex: /\b(eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*)\b/g,
    minEntropy: 3.0,
    severity: 'medium',
  },
  {
    type: 'private-key',
    name: 'Private Key',
    regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    minEntropy: 0,
    severity: 'critical',
  },
  {
    type: 'password',
    name: 'Password in Code',
    regex: /\b(password|passwd|pwd)\s*[:=]\s*['"]([^'"]{8,})['"]/gi,
    minEntropy: 3.0,
    severity: 'high',
  },
];

/**
 * Calculate Shannon entropy of a string
 * Higher entropy = more randomness = more likely to be a secret
 */
export function calculateEntropy(str: string): number {
  const len = str.length;
  if (len === 0) return 0;

  const frequencies = new Map<string, number>();

  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }

  let entropy = 0;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Get file extension for filtering
 */
function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Check if file should be scanned for secrets
 */
function shouldScanFile(filePath: string): boolean {
  const excludedExtensions = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.ico', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.zip', '.tar', '.gz', '.rar',
    '.exe', '.dll', '.so', '.dylib',
    '.woff', '.woff2', '.ttf', '.eot',
  ]);

  const excludedDirs = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.cache',
  ];

  const ext = getFileExtension(filePath);
  if (excludedExtensions.has(ext)) {
    return false;
  }

  const normalizedPath = filePath.replace(/\\/g, '/');
  for (const dir of excludedDirs) {
    if (normalizedPath.includes(`/${dir}/`)) {
      return false;
    }
  }

  return true;
}

/**
 * Get all files recursively from a directory
 */
async function getFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Skip common excluded directories
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
function generateFindingId(filePath: string, line: number, column: number): string {
  const hash = Buffer.from(`${filePath}:${line}:${column}`).toString('base64').slice(0, 12);
  return `SEC-${hash}`;
}

/**
 * Truncate match for security (don't expose full secrets)
 */
function truncateMatch(match: string, maxLength = 20): string {
  if (match.length <= maxLength) {
    return match + '***';
  }
  return match.slice(0, maxLength) + '...';
}

/**
 * Detect secrets in a single file
 */
async function detectSecretsInFile(
  filePath: string,
  severityThreshold: SeverityLevel = 'low'
): Promise<SecretFinding[]> {
  const findings: SecretFinding[] = [];
  const severityOrder: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];
  const thresholdIndex = severityOrder.indexOf(severityThreshold);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      for (const pattern of SECRET_PATTERNS) {
        // Reset regex lastIndex
        pattern.regex.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = pattern.regex.exec(line)) !== null) {
          const matchedText = match[0];
          const entropy = calculateEntropy(matchedText);

          // Check entropy threshold
          if (entropy >= pattern.minEntropy) {
            // Check severity threshold
            const severityIndex = severityOrder.indexOf(pattern.severity);
            if (severityIndex >= thresholdIndex) {
              findings.push({
                id: generateFindingId(filePath, lineIndex + 1, match.index + 1),
                filePath,
                line: lineIndex + 1,
                column: match.index + 1,
                severity: pattern.severity,
                type: pattern.type,
                title: `${pattern.name} Detected`,
                description: `Potential ${pattern.name.toLowerCase()} found in code. High entropy (${entropy.toFixed(2)}) indicates this may be a real secret.`,
                suggestion: 'Remove the secret from code and use environment variables or a secrets manager.',
                match: truncateMatch(matchedText),
                entropy,
              });
            }
          }
        }
      }
    }
  } catch (error) {
    // Skip files that can't be read (binary, permissions, etc.)
  }

  return findings;
}

/**
 * Detect secrets in the target path
 */
export async function detectSecrets(
  targetPath: string,
  severityThreshold: SeverityLevel = 'low'
): Promise<SecretFinding[]> {
  const stats = await fs.stat(targetPath);

  if (stats.isFile()) {
    return detectSecretsInFile(targetPath, severityThreshold);
  }

  const files = await getFiles(targetPath);
  const allFindings: SecretFinding[] = [];

  for (const file of files) {
    const findings = await detectSecretsInFile(file, severityThreshold);
    allFindings.push(...findings);
  }

  return allFindings;
}
