/**
 * Skill Version Manager
 *
 * Provides semantic version operations for skill version management.
 */

import * as semver from 'semver';

/**
 * SkillVersionManager provides semantic version operations
 */
export class SkillVersionManager {
  /**
   * Check if a version string is valid semver
   * @param version - Version string to validate
   * @returns true if valid semver format
   */
  isValid(version: string): boolean {
    // Only accept strict semver (major.minor.patch), no prerelease, no v prefix
    if (!version || typeof version !== 'string') {
      return false;
    }
    // Reject versions starting with 'v' (semver.valid strips it, but we want strict format)
    if (version.startsWith('v') || version.startsWith('V')) {
      return false;
    }
    return semver.valid(version) !== null && !version.includes('-');
  }

  /**
   * Compare two versions
   * @param v1 - First version
   * @param v2 - Second version
   * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  compare(v1: string, v2: string): number {
    return semver.compare(v1, v2);
  }

  /**
   * Check if a version satisfies a range
   * @param version - Version to check
   * @param range - Semver range (e.g., "^1.0.0", "~1.0.0", ">=2.0.0")
   * @returns true if version satisfies the range
   */
  satisfies(version: string, range: string): boolean {
    return semver.satisfies(version, range);
  }

  /**
   * Get the latest version from an array of versions
   * @param versions - Array of version strings
   * @returns The highest version, or null if array is empty
   */
  getLatest(versions: string[]): string | null {
    return semver.maxSatisfying(versions, '*');
  }

  /**
   * Check if a version update is compatible (same major version and higher)
   * @param current - Current version
   * @param candidate - Candidate version to update to
   * @returns true if compatible update (same major, higher version)
   */
  isCompatibleUpdate(current: string, candidate: string): boolean {
    const currentMajor = semver.major(current);
    const candidateMajor = semver.major(candidate);

    // Must be same major version
    if (currentMajor !== candidateMajor) {
      return false;
    }

    // Candidate must be higher version
    return semver.gt(candidate, current);
  }
}
