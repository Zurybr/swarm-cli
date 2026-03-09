/**
 * Git Atomic Commit - Recovery and Rollback
 * Handles transaction rollback and state restoration
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  Transaction,
  TransactionSnapshot,
  RollbackResult,
  RecoveryState,
  FileChange
} from './types';

export interface RecoveryManagerOptions {
  storagePath: string;
  gitPath: string;
  workingDirectory: string;
}

/**
 * Manages transaction recovery and rollback
 */
export class RecoveryManager {
  private storagePath: string;
  private gitPath: string;
  private workingDirectory: string;
  private snapshotsDir: string;

  constructor(options: RecoveryManagerOptions) {
    this.storagePath = options.storagePath;
    this.gitPath = options.gitPath || 'git';
    this.workingDirectory = options.workingDirectory;
    this.snapshotsDir = path.join(this.storagePath, 'snapshots');
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.snapshotsDir)) {
      fs.mkdirSync(this.snapshotsDir, { recursive: true });
    }
  }

  private getSnapshotPath(transactionId: string): string {
    return path.join(this.snapshotsDir, `${transactionId}.json`);
  }

  private getBackupDir(transactionId: string): string {
    return path.join(this.snapshotsDir, transactionId);
  }

  /**
   * Create a snapshot before making changes
   */
  createSnapshot(transaction: Transaction): TransactionSnapshot {
    const backupDir = this.getBackupDir(transaction.id);
    fs.mkdirSync(backupDir, { recursive: true });

    const backupPaths: Record<string, string> = {};

    // Backup files that will be modified
    for (const change of transaction.changes) {
      const filePath = path.join(this.workingDirectory, change.path);

      if (fs.existsSync(filePath)) {
        const backupPath = path.join(backupDir, change.path.replace(/[/\\]/g, '_'));
        fs.copyFileSync(filePath, backupPath);
        backupPaths[change.path] = backupPath;
      }
    }

    // Capture git state
    const gitState = this.captureGitState();

    const snapshot: TransactionSnapshot = {
      transaction: { ...transaction },
      workingDirectory: this.workingDirectory,
      backupPaths,
      gitState
    };

    // Save snapshot
    fs.writeFileSync(
      this.getSnapshotPath(transaction.id),
      JSON.stringify(snapshot, null, 2)
    );

    return snapshot;
  }

  /**
   * Rollback a transaction to its original state
   */
  rollback(transactionId: string): RollbackResult {
    const snapshot = this.loadSnapshot(transactionId);

    if (!snapshot) {
      return {
        success: false,
        transactionId,
        message: 'Snapshot not found for transaction',
        restoredFiles: [],
        error: 'No snapshot available for rollback'
      };
    }

    // Debug: Check backup file content
    for (const [path, backupPath] of Object.entries(snapshot.backupPaths)) {
      if (fs.existsSync(backupPath)) {
        const content = fs.readFileSync(backupPath, 'utf-8');
        console.log(`DEBUG: Backup for ${path} contains: ${content}`);
      } else {
        console.log(`DEBUG: Backup for ${path} does not exist at ${backupPath}`);
      }
    }

    const restoredFiles: string[] = [];

    try {
      // Restore backed up files
      for (const [originalPath, backupPath] of Object.entries(snapshot.backupPaths)) {
        const fullOriginalPath = path.join(this.workingDirectory, originalPath);

        if (fs.existsSync(backupPath)) {
          // Ensure directory exists
          const dir = path.dirname(fullOriginalPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.copyFileSync(backupPath, fullOriginalPath);
          restoredFiles.push(originalPath);
        } else {
          // Backup doesn't exist, file was new - delete it
          if (fs.existsSync(fullOriginalPath)) {
            fs.unlinkSync(fullOriginalPath);
          }
        }
      }

      // Handle files that were added (no backup)
      for (const change of snapshot.transaction.changes) {
        if (change.type === 'add' && !snapshot.backupPaths[change.path]) {
          const filePath = path.join(this.workingDirectory, change.path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }

      // Reset git state if needed
      this.resetGitState(snapshot.gitState);

      // Clean up snapshot
      this.cleanupSnapshot(transactionId);

      return {
        success: true,
        transactionId,
        message: `Successfully rolled back ${restoredFiles.length} files`,
        restoredFiles
      };
    } catch (error) {
      return {
        success: false,
        transactionId,
        message: 'Rollback failed',
        restoredFiles,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Perform partial rollback of specific files
   */
  partialRollback(
    transactionId: string,
    filePaths: string[]
  ): RollbackResult {
    const snapshot = this.loadSnapshot(transactionId);

    if (!snapshot) {
      return {
        success: false,
        transactionId,
        message: 'Snapshot not found',
        restoredFiles: [],
        error: 'No snapshot available'
      };
    }

    const restoredFiles: string[] = [];

    try {
      for (const filePath of filePaths) {
        const backupPath = snapshot.backupPaths[filePath];

        if (backupPath && fs.existsSync(backupPath)) {
          const fullOriginalPath = path.join(this.workingDirectory, filePath);
          const dir = path.dirname(fullOriginalPath);

          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.copyFileSync(backupPath, fullOriginalPath);
          restoredFiles.push(filePath);
        }
      }

      return {
        success: true,
        transactionId,
        message: `Partial rollback: restored ${restoredFiles.length} files`,
        restoredFiles
      };
    } catch (error) {
      return {
        success: false,
        transactionId,
        message: 'Partial rollback failed',
        restoredFiles,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check for pending transactions that need recovery
   */
  getPendingTransactions(): Transaction[] {
    const pending: Transaction[] = [];

    if (!fs.existsSync(this.snapshotsDir)) {
      return pending;
    }

    const files = fs.readdirSync(this.snapshotsDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const snapshotPath = path.join(this.snapshotsDir, file);
      try {
        const data = fs.readFileSync(snapshotPath, 'utf-8');
        const snapshot = JSON.parse(data) as TransactionSnapshot;

        // Consider pending if not committed or rolled back
        if (
          snapshot.transaction.status !== 'committed' &&
          snapshot.transaction.status !== 'rolled_back'
        ) {
          pending.push(snapshot.transaction);
        }
      } catch {
        // Skip invalid snapshots
      }
    }

    return pending;
  }

  /**
   * Recover from a crash - check for incomplete transactions
   */
  async recover(): Promise<{
    recovered: string[];
    failed: string[];
  }> {
    const pending = this.getPendingTransactions();
    const recovered: string[] = [];
    const failed: string[] = [];

    for (const transaction of pending) {
      // Auto-rollback incomplete transactions
      const result = this.rollback(transaction.id);

      if (result.success) {
        recovered.push(transaction.id);
      } else {
        failed.push(transaction.id);
      }
    }

    return { recovered, failed };
  }

  /**
   * Clean up old snapshots
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    let cleaned = 0;
    const now = Date.now();

    if (!fs.existsSync(this.snapshotsDir)) {
      return cleaned;
    }

    const files = fs.readdirSync(this.snapshotsDir);

    for (const file of files) {
      const filePath = path.join(this.snapshotsDir, file);
      const stat = fs.statSync(filePath);

      if (now - stat.mtimeMs > maxAgeMs) {
        if (stat.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get recovery state summary
   */
  getRecoveryState(): RecoveryState {
    const pendingTransactions = this.getPendingTransactions();

    return {
      pendingTransactions: pendingTransactions.map(t =>
        this.loadSnapshot(t.id)!
      ).filter(Boolean),
      lastCleanup: this.getLastCleanupTime()
    };
  }

  /**
   * Save original content for a file before modification
   */
  saveOriginalContent(
    transactionId: string,
    filePath: string,
    content: string
  ): void {
    const backupDir = this.getBackupDir(transactionId);
    fs.mkdirSync(backupDir, { recursive: true });

    const backupPath = path.join(backupDir, filePath.replace(/[/\\]/g, '_'));
    fs.writeFileSync(backupPath, content);

    // Update snapshot if it exists
    const snapshotPath = this.getSnapshotPath(transactionId);
    if (fs.existsSync(snapshotPath)) {
      const snapshot = JSON.parse(
        fs.readFileSync(snapshotPath, 'utf-8')
      ) as TransactionSnapshot;

      snapshot.backupPaths[filePath] = backupPath;
      fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
    }
  }

  /**
   * Check if a snapshot exists
   */
  hasSnapshot(transactionId: string): boolean {
    return fs.existsSync(this.getSnapshotPath(transactionId));
  }

  /**
   * Load a snapshot
   */
  loadSnapshot(transactionId: string): TransactionSnapshot | undefined {
    const snapshotPath = this.getSnapshotPath(transactionId);

    if (!fs.existsSync(snapshotPath)) {
      return undefined;
    }

    try {
      const data = fs.readFileSync(snapshotPath, 'utf-8');
      return JSON.parse(data) as TransactionSnapshot;
    } catch {
      return undefined;
    }
  }

  // ==================== Private Helpers ====================

  private captureGitState(): TransactionSnapshot['gitState'] {
    try {
      const branch = execSync(`${this.gitPath} rev-parse --abbrev-ref HEAD`, {
        cwd: this.workingDirectory,
        encoding: 'utf-8',
        stdio: 'pipe'
      }).trim();

      const head = execSync(`${this.gitPath} rev-parse HEAD`, {
        cwd: this.workingDirectory,
        encoding: 'utf-8',
        stdio: 'pipe'
      }).trim();

      const staged = execSync(
        `${this.gitPath} diff --cached --name-only`,
        {
          cwd: this.workingDirectory,
          encoding: 'utf-8',
          stdio: 'pipe'
        }
      )
        .trim()
        .split('\n')
        .filter(f => f.length > 0);

      return { branch, head, staged };
    } catch {
      return { branch: 'main', head: '', staged: [] };
    }
  }

  private resetGitState(
    gitState: TransactionSnapshot['gitState']
  ): void {
    try {
      // Reset any staged changes
      execSync(`${this.gitPath} reset HEAD`, {
        cwd: this.workingDirectory,
        stdio: 'pipe'
      });

      // Checkout original branch if different
      const currentBranch = execSync(
        `${this.gitPath} rev-parse --abbrev-ref HEAD`,
        {
          cwd: this.workingDirectory,
          encoding: 'utf-8',
          stdio: 'pipe'
        }
      ).trim();

      if (currentBranch !== gitState.branch && gitState.branch !== 'HEAD') {
        execSync(`${this.gitPath} checkout ${gitState.branch}`, {
          cwd: this.workingDirectory,
          stdio: 'pipe'
        });
      }
    } catch {
      // Git state reset failed, but files are restored
    }
  }

  private cleanupSnapshot(transactionId: string): void {
    const snapshotPath = this.getSnapshotPath(transactionId);
    const backupDir = this.getBackupDir(transactionId);

    try {
      if (fs.existsSync(snapshotPath)) {
        fs.unlinkSync(snapshotPath);
      }
      if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true, force: true });
      }
    } catch {
      // Cleanup failed, but rollback succeeded
    }
  }

  private getLastCleanupTime(): number {
    const markerPath = path.join(this.storagePath, '.last-cleanup');

    if (!fs.existsSync(markerPath)) {
      return 0;
    }

    try {
      const data = fs.readFileSync(markerPath, 'utf-8');
      return parseInt(data, 10) || 0;
    } catch {
      return 0;
    }
  }
}

/**
 * Create a new recovery manager
 */
export function createRecoveryManager(
  options: RecoveryManagerOptions
): RecoveryManager {
  return new RecoveryManager(options);
}

export default RecoveryManager;
