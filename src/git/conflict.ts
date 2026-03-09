/**
 * Git Atomic Commit - Conflict Detection and Resolution
 * Detects and resolves conflicts between agents
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  Conflict,
  ConflictType,
  ConflictResolution,
  ResolutionStrategy,
  ExternalChange,
  Transaction
} from './types';
import { FileReservation } from '../swarm-mail/types';

export interface ConflictDetectorOptions {
  gitPath: string;
  workingDirectory: string;
}

/**
 * Detects and resolves conflicts for atomic commits
 */
export class ConflictDetector {
  private gitPath: string;
  private workingDirectory: string;

  constructor(options: ConflictDetectorOptions) {
    this.gitPath = options.gitPath || 'git';
    this.workingDirectory = options.workingDirectory;
  }

  /**
   * Check for external changes to reserved files
   */
  checkExternalChanges(
    reservations: FileReservation[],
    sinceCommit?: string
  ): ExternalChange[] {
    const changes: ExternalChange[] = [];

    if (!sinceCommit) {
      sinceCommit = this.getHeadCommit();
    }

    const currentCommit = this.getHeadCommit();

    if (sinceCommit === currentCommit) {
      return changes;
    }

    for (const reservation of reservations) {
      const filePath = reservation.path;
      const fullPath = path.join(this.workingDirectory, filePath);

      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        // File was deleted
        if (this.wasFileInCommit(filePath, sinceCommit)) {
          changes.push({
            path: filePath,
            type: 'deleted',
            sinceCommit,
            currentCommit
          });
        }
        continue;
      }

      // Check if file was modified since our reservation
      if (this.hasFileChanged(filePath, sinceCommit)) {
        changes.push({
          path: filePath,
          type: 'modified',
          sinceCommit,
          currentCommit
        });
      }
    }

    return changes;
  }

  /**
   * Detect conflicts between transaction and external changes
   */
  detectConflicts(
    transaction: Transaction,
    externalChanges: ExternalChange[]
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    for (const change of externalChanges) {
      const transactionChange = transaction.changes.find(
        c => c.path === change.path
      );

      if (!transactionChange) {
        // External change to a file we're not modifying
        // This is a warning but not necessarily a conflict
        continue;
      }

      if (change.type === 'deleted') {
        conflicts.push({
          type: 'file_deleted',
          path: change.path,
          message: `File ${change.path} was deleted by another agent`,
          resolvable: transactionChange.previousContent !== undefined
        });
      } else if (change.type === 'modified') {
        conflicts.push({
          type: 'file_modified',
          path: change.path,
          message: `File ${change.path} was modified by another agent`,
          resolvable: true
        });
      }
    }

    return conflicts;
  }

  /**
   * Check if branch has diverged from remote
   */
  checkBranchDivergence(): { diverged: boolean; ahead: number; behind: number } {
    try {
      // Fetch remote status without changing working directory
      execSync(`${this.gitPath} fetch --dry-run`, {
        cwd: this.workingDirectory,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
    } catch {
      // fetch --dry-run exits with error, this is expected
    }

    try {
      const aheadBehind = execSync(
        `${this.gitPath} rev-list --left-right --count HEAD...@{upstream}`,
        {
          cwd: this.workingDirectory,
          encoding: 'utf-8',
          stdio: 'pipe'
        }
      ).trim();

      const [behind, ahead] = aheadBehind.split('\t').map(Number);

      return {
        diverged: ahead > 0 || behind > 0,
        ahead,
        behind
      };
    } catch {
      // No upstream configured
      return { diverged: false, ahead: 0, behind: 0 };
    }
  }

  /**
   * Check for merge conflicts in working directory
   */
  checkMergeConflicts(): Conflict[] {
    const conflicts: Conflict[] = [];

    try {
      // Get list of unmerged files
      const unmerged = execSync(
        `${this.gitPath} diff --name-only --diff-filter=U`,
        {
          cwd: this.workingDirectory,
          encoding: 'utf-8',
          stdio: 'pipe'
        }
      ).trim();

      if (!unmerged) {
        return conflicts;
      }

      const files = unmerged.split('\n').filter(f => f.length > 0);

      for (const file of files) {
        conflicts.push({
          type: 'merge_conflict',
          path: file,
          message: `Merge conflict in ${file}`,
          resolvable: true
        });
      }
    } catch (error) {
      // No conflicts or not in a merge state
    }

    return conflicts;
  }

  /**
   * Resolve a conflict using a strategy
   */
  resolveConflict(
    conflict: Conflict,
    strategy: ResolutionStrategy,
    oursContent?: string,
    theirsContent?: string
  ): ConflictResolution {
    if (strategy === 'abort') {
      return {
        conflict,
        strategy: 'abort'
      };
    }

    if (strategy === 'ours') {
      return {
        conflict,
        strategy: 'ours',
        resolvedContent: oursContent
      };
    }

    if (strategy === 'theirs') {
      return {
        conflict,
        strategy: 'theirs',
        resolvedContent: theirsContent
      };
    }

    if (strategy === 'merge') {
      // Simple merge attempt - in real implementation would use 3-way merge
      const merged = this.attemptMerge(oursContent, theirsContent);
      return {
        conflict,
        strategy: 'merge',
        resolvedContent: merged
      };
    }

    return {
      conflict,
      strategy: 'abort'
    };
  }

  /**
   * Check if a file can be safely modified
   */
  canSafelyModify(filePath: string, agentName: string): {
    safe: boolean;
    reason?: string;
    conflict?: Conflict;
  } {
    const fullPath = path.join(this.workingDirectory, filePath);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return { safe: true };
    }

    // Check git status
    try {
      const status = execSync(
        `${this.gitPath} status --porcelain "${filePath}"`,
        {
          cwd: this.workingDirectory,
          encoding: 'utf-8',
          stdio: 'pipe'
        }
      ).trim();

      if (status.startsWith('UU')) {
        return {
          safe: false,
          reason: 'File has merge conflicts',
          conflict: {
            type: 'merge_conflict',
            path: filePath,
            message: `Merge conflict in ${filePath}`,
            resolvable: true
          }
        };
      }

      if (status.startsWith('DD')) {
        return {
          safe: false,
          reason: 'File was deleted in both branches',
          conflict: {
            type: 'file_deleted',
            path: filePath,
            message: `File ${filePath} was deleted`,
            resolvable: false
          }
        };
      }
    } catch {
      // Git command failed, assume safe
    }

    return { safe: true };
  }

  /**
   * Get recommended resolution strategy for a conflict
   */
  getRecommendedStrategy(conflict: Conflict): ResolutionStrategy {
    switch (conflict.type) {
      case 'file_modified':
        return 'merge';
      case 'file_deleted':
        return conflict.resolvable ? 'ours' : 'abort';
      case 'merge_conflict':
        return 'merge';
      case 'reservation_expired':
        return 'abort';
      case 'reservation_revoked':
        return 'abort';
      case 'branch_diverged':
        return 'abort';
      default:
        return 'abort';
    }
  }

  /**
   * Validate that all conflicts are resolvable
   */
  validateConflicts(conflicts: Conflict[]): {
    valid: boolean;
    unresolvable: Conflict[];
  } {
    const unresolvable = conflicts.filter(c => !c.resolvable);
    return {
      valid: unresolvable.length === 0,
      unresolvable
    };
  }

  // ==================== Private Helpers ====================

  private getHeadCommit(): string {
    try {
      return execSync(`${this.gitPath} rev-parse HEAD`, {
        cwd: this.workingDirectory,
        encoding: 'utf-8',
        stdio: 'pipe'
      }).trim();
    } catch {
      return '';
    }
  }

  private wasFileInCommit(filePath: string, commit: string): boolean {
    try {
      execSync(`${this.gitPath} show ${commit}:"${filePath}"`, {
        cwd: this.workingDirectory,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      return true;
    } catch {
      return false;
    }
  }

  private hasFileChanged(filePath: string, sinceCommit: string): boolean {
    try {
      const result = execSync(
        `${this.gitPath} diff --quiet ${sinceCommit}..HEAD -- "${filePath}"`,
        {
          cwd: this.workingDirectory,
          encoding: 'utf-8',
          stdio: 'pipe'
        }
      );
      return result !== '';
    } catch {
      // diff returns exit code 1 if there are differences
      return true;
    }
  }

  private attemptMerge(ours?: string, theirs?: string): string | undefined {
    if (!ours && !theirs) {
      return undefined;
    }
    if (!theirs) {
      return ours;
    }
    if (!ours) {
      return theirs;
    }

    // Simple concatenation strategy - real implementation would use git merge-file
    return `<<<<<<< ours\n${ours}\n=======\n${theirs}\n>>>>>>> theirs`;
  }
}

/**
 * Create a new conflict detector
 */
export function createConflictDetector(
  options: ConflictDetectorOptions
): ConflictDetector {
  return new ConflictDetector(options);
}

export default ConflictDetector;
