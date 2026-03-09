/**
 * GitSync - Git integration for Hive persistence
 *
 * Provides automatic commit on changes with atomic writes and rollback capability.
 */

import { execSync, exec } from 'child_process';
import * as util from 'util';
import * as path from 'path';
import { StorageConfig, GitSyncResult } from './types';
import { Cell } from './cell';

const execAsync = util.promisify(exec);

/**
 * Error thrown when git operations fail
 */
export class GitSyncError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'GitSyncError';
  }
}

/**
 * Git integration for Hive storage
 */
export class GitSync {
  private config: StorageConfig;
  private projectRoot: string;
  private isGitRepo: boolean = false;

  constructor(config: StorageConfig, projectRoot: string = process.cwd()) {
    this.config = config;
    this.projectRoot = projectRoot;
  }

  /**
   * Initialize git sync - check if we're in a git repo
   */
  async init(): Promise<void> {
    this.isGitRepo = await this.checkGitRepo();
  }

  /**
   * Check if the project root is a git repository (not just inside one)
   */
  private async checkGitRepo(): Promise<boolean> {
    try {
      // Use --show-toplevel to get the root of the git repo
      const { stdout } = await execAsync('git rev-parse --show-toplevel', { cwd: this.projectRoot });
      const toplevel = stdout.trim();
      // Only consider it a git repo if the toplevel matches our project root
      return toplevel === this.projectRoot;
    } catch {
      return false;
    }
  }

  /**
   * Check if git sync is enabled and available
   */
  isEnabled(): boolean {
    return this.config.enableGit && this.isGitRepo;
  }

  /**
   * Execute a git command and return the result
   */
  private async gitCommand(
    args: string[],
    options: { cwd?: string; ignoreError?: boolean } = {}
  ): Promise<{ success: boolean; output: string; error?: string }> {
    const cwd = options.cwd || this.projectRoot;
    // Properly quote arguments that contain special characters
    const quotedArgs = args.map(arg => {
      // If arg contains spaces, quotes, or special shell characters, wrap in quotes
      if (/[\s\"'()$;|&<>]/.test(arg)) {
        return `"${arg.replace(/"/g, '\\"')}"`;
      }
      return arg;
    });
    const command = `git ${quotedArgs.join(' ')}`;

    try {
      const { stdout } = await execAsync(command, { cwd });
      return { success: true, output: stdout.trim() };
    } catch (error) {
      const errorMessage = (error as Error).message;
      if (options.ignoreError) {
        return { success: false, output: '', error: errorMessage };
      }
      throw new GitSyncError(`Git command failed: ${command}`, error as Error);
    }
  }

  /**
   * Check if there are uncommitted changes in the hive directory
   */
  async hasChanges(): Promise<boolean> {
    if (!this.isEnabled()) return false;

    const relativePath = path.relative(this.projectRoot, this.config.baseDir);
    const result = await this.gitCommand(
      ['status', '--porcelain', relativePath],
      { ignoreError: true }
    );

    return result.success && result.output.trim().length > 0;
  }

  /**
   * Stage changes in the hive directory
   */
  async stageChanges(): Promise<GitSyncResult> {
    if (!this.isEnabled()) {
      return { success: true };
    }

    try {
      const relativePath = path.relative(this.projectRoot, this.config.baseDir);
      await this.gitCommand(['add', relativePath]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to stage changes: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Commit changes with a generated message
   */
  async commit(
    cell: Cell,
    action: 'create' | 'update' | 'delete',
    customMessage?: string
  ): Promise<GitSyncResult> {
    if (!this.isEnabled()) {
      return { success: true };
    }

    // Check if there are changes to commit
    const hasChanges = await this.hasChanges();
    if (!hasChanges) {
      return { success: true };
    }

    try {
      // Stage changes first
      const stageResult = await this.stageChanges();
      if (!stageResult.success) return stageResult;

      // Generate commit message
      const message = customMessage || this.generateCommitMessage(cell, action);

      // Commit
      const result = await this.gitCommand([
        'commit',
        '-m',
        message,
        '--no-verify', // Skip hooks for automated commits
      ]);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Commit failed',
        };
      }

      // Get the commit hash
      const hashResult = await this.gitCommand(['rev-parse', 'HEAD'], {
        ignoreError: true,
      });

      return {
        success: true,
        commitHash: hashResult.success ? hashResult.output : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to commit: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Generate a commit message based on the template
   */
  private generateCommitMessage(
    cell: Cell,
    action: 'create' | 'update' | 'delete'
  ): string {
    const template =
      this.config.commitMessageTemplate || 'hive({id}): {action} {title}';

    return template
      .replace('{id}', cell.id)
      .replace('{action}', action)
      .replace('{title}', cell.title)
      .replace('{type}', cell.type)
      .replace('{status}', cell.status);
  }

  /**
   * Rollback to a previous commit
   */
  async rollback(commitHash: string): Promise<GitSyncResult> {
    if (!this.isEnabled()) {
      return {
        success: false,
        error: 'Git sync is not enabled',
      };
    }

    try {
      // Reset to the specified commit
      await this.gitCommand(['reset', '--hard', commitHash]);

      return { success: true, commitHash };
    } catch (error) {
      return {
        success: false,
        error: `Failed to rollback: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get the current git status
   */
  async getStatus(): Promise<{
    isRepo: boolean;
    enabled: boolean;
    hasChanges: boolean;
    currentBranch?: string;
  }> {
    const isRepo = this.isGitRepo;
    const enabled = this.isEnabled();

    if (!isRepo) {
      return { isRepo: false, enabled: false, hasChanges: false };
    }

    const branchResult = await this.gitCommand(
      ['branch', '--show-current'],
      { ignoreError: true }
    );

    const hasChanges = await this.hasChanges();

    return {
      isRepo: true,
      enabled,
      hasChanges,
      currentBranch: branchResult.success ? branchResult.output : undefined,
    };
  }

  /**
   * Get the last commit that affected the hive directory
   */
  async getLastHiveCommit(): Promise<string | undefined> {
    if (!this.isEnabled()) return undefined;

    try {
      const relativePath = path.relative(this.projectRoot, this.config.baseDir);
      const result = await this.gitCommand(
        ['log', '-1', '--format=%H', '--', relativePath],
        { ignoreError: true }
      );

      return result.success && result.output ? result.output : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Create a backup branch before major operations
   */
  async createBackupBranch(branchName?: string): Promise<GitSyncResult> {
    if (!this.isEnabled()) {
      return { success: true };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = branchName || `hive-backup-${timestamp}`;

    try {
      await this.gitCommand(['branch', name]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create backup branch: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Sync with remote (pull and push)
   * Note: This is optional and should be used carefully
   */
  async syncWithRemote(): Promise<GitSyncResult> {
    if (!this.isEnabled()) {
      return { success: true };
    }

    try {
      // Check if we have a remote
      const remoteResult = await this.gitCommand(['remote'], {
        ignoreError: true,
      });

      if (!remoteResult.success || !remoteResult.output) {
        return { success: true }; // No remote configured
      }

      // Pull with rebase
      const pullResult = await this.gitCommand(['pull', '--rebase'], {
        ignoreError: true,
      });

      if (!pullResult.success) {
        return {
          success: false,
          error: `Failed to pull: ${pullResult.error}`,
        };
      }

      // Push
      const pushResult = await this.gitCommand(['push'], { ignoreError: true });

      if (!pushResult.success) {
        return {
          success: false,
          error: `Failed to push: ${pushResult.error}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to sync with remote: ${(error as Error).message}`,
      };
    }
  }
}
