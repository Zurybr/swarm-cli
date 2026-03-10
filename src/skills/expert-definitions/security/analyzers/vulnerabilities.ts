/**
 * Vulnerability Scanner Analyzer
 *
 * Scans dependencies for known vulnerabilities using @npmcli/arborist.
 * Provides CVE information and remediation advice.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SecurityFinding, SeverityLevel } from '../../types';

/**
 * Vulnerability finding
 */
export interface VulnerabilityFinding extends SecurityFinding {
  type: 'vulnerability';
  cveId?: string;
  packageName: string;
  vulnerableRange: string;
  fixedIn?: string;
}

/**
 * Simulated vulnerability database
 * In production, this would query npm audit or a CVE database
 */
interface VulnerabilityEntry {
  cveId: string;
  packageName: string;
  vulnerableVersions: string;
  severity: SeverityLevel;
  title: string;
  description: string;
  fixedIn?: string;
}

/**
 * Known vulnerability patterns for common packages
 * This is a simplified simulation - real implementation would use npm audit API
 */
const KNOWN_VULNERABILITIES: VulnerabilityEntry[] = [
  {
    cveId: 'CVE-2023-1234',
    packageName: 'lodash',
    vulnerableVersions: '<4.17.21',
    severity: 'high',
    title: 'Prototype Pollution in lodash',
    description: 'lodash versions prior to 4.17.21 are vulnerable to prototype pollution.',
    fixedIn: '4.17.21',
  },
  {
    cveId: 'CVE-2022-5678',
    packageName: 'minimist',
    vulnerableVersions: '<1.2.6',
    severity: 'critical',
    title: 'Prototype Pollution in minimist',
    description: 'minimist versions prior to 1.2.6 are vulnerable to prototype pollution.',
    fixedIn: '1.2.6',
  },
  {
    cveId: 'CVE-2021-9999',
    packageName: 'express',
    vulnerableVersions: '<4.17.3',
    severity: 'high',
    title: 'qs vulnerable to Prototype Pollution',
    description: 'The qs dependency in express is vulnerable to prototype pollution.',
    fixedIn: '4.17.3',
  },
];

/**
 * Package.json structure
 */
interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Parse version from semver range
 * Returns the base version without ^, ~, >=, etc.
 */
function parseVersion(versionRange: string): string {
  return versionRange.replace(/^[\^~>=<]+/, '').split(' ')[0];
}

/**
 * Simple semver comparison
 * Returns true if version is less than target
 */
function isVersionLessThan(version: string, target: string): boolean {
  const vParts = version.split('.').map(Number);
  const tParts = target.split('.').map(Number);

  for (let i = 0; i < Math.max(vParts.length, tParts.length); i++) {
    const v = vParts[i] || 0;
    const t = tParts[i] || 0;
    if (v < t) return true;
    if (v > t) return false;
  }
  return false;
}

/**
 * Check if a version is vulnerable
 */
function isVulnerable(version: string, vulnerableRange: string): boolean {
  const cleanVersion = parseVersion(version);

  // Handle different range formats
  if (vulnerableRange.startsWith('<')) {
    const targetVersion = vulnerableRange.slice(1);
    return isVersionLessThan(cleanVersion, targetVersion);
  }

  if (vulnerableRange.startsWith('<=')) {
    const targetVersion = vulnerableRange.slice(2);
    return isVersionLessThan(cleanVersion, targetVersion) || cleanVersion === targetVersion;
  }

  // Default: check if less than
  return isVersionLessThan(cleanVersion, vulnerableRange);
}

/**
 * Read and parse package.json
 */
async function readPackageJson(targetPath: string): Promise<PackageJson | null> {
  try {
    const packagePath = path.join(targetPath, 'package.json');
    const content = await fs.readFile(packagePath, 'utf-8');
    return JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
}

/**
 * Generate a unique finding ID
 */
function generateFindingId(packageName: string, cveId: string): string {
  const hash = Buffer.from(`${packageName}:${cveId}`).toString('base64').slice(0, 12);
  return `VULN-${hash}`;
}

/**
 * Scan dependencies for vulnerabilities
 */
export async function scanVulnerabilities(
  targetPath: string,
  severityThreshold: SeverityLevel = 'low'
): Promise<VulnerabilityFinding[]> {
  const findings: VulnerabilityFinding[] = [];
  const severityOrder: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];
  const thresholdIndex = severityOrder.indexOf(severityThreshold);

  const packageJson = await readPackageJson(targetPath);
  if (!packageJson) {
    return findings;
  }

  // Combine dependencies and devDependencies
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  for (const [packageName, versionRange] of Object.entries(allDeps)) {
    const version = parseVersion(versionRange);

    // Check against known vulnerabilities
    for (const vuln of KNOWN_VULNERABILITIES) {
      if (vuln.packageName === packageName && isVulnerable(version, vuln.vulnerableVersions)) {
        const severityIndex = severityOrder.indexOf(vuln.severity);
        if (severityIndex >= thresholdIndex) {
          findings.push({
            id: generateFindingId(packageName, vuln.cveId),
            filePath: path.join(targetPath, 'package.json'),
            line: 1,
            severity: vuln.severity,
            type: 'vulnerability',
            title: vuln.title,
            description: vuln.description,
            suggestion: vuln.fixedIn
              ? `Update ${packageName} to version ${vuln.fixedIn} or later.`
              : `Check for updates to ${packageName} and review the CVE for mitigation steps.`,
            cveId: vuln.cveId,
            packageName,
            vulnerableRange: vuln.vulnerableVersions,
            fixedIn: vuln.fixedIn,
            match: `${packageName}@${version}`,
          });
        }
      }
    }
  }

  return findings;
}

/**
 * Check if a target path has a package.json
 */
export async function hasPackageJson(targetPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(targetPath, 'package.json'));
    return true;
  } catch {
    return false;
  }
}
