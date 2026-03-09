/**
 * Git Atomic Commit - Core Atomic Commit Logic
 * High-level API for atomic git operations
 */

import * as fs from 'fs';
import * as path from 'path';
import { TransactionManager, BeginTransactionRequest } from './transaction';
import {
  Transaction,
  FileChange,
  CommitOptions,
  CommitResult,
  ValidationResult,
  Conflict
} from './types';
import { ReservationManager } from '../swarm-mail/reservations';
import { ConflictDetector } from './conflict';
import { RecoveryManager } from './recovery';

export interface AtomicCommitOptions {
  agentName: string;
  storagePath: string;
  gitPath?: string;
  workingDirectory: string;
  reservationManager: ReservationManager;
  autoRollback?: boolean;
  timeoutMs?: number;
}

export interface ExecuteRequest {
  paths: string | string[];
  changes: FileChange[];
  commitOptions: CommitOptions;
  metadata?: Record<string, any>;
}

export interface ExecuteResult {
  success: boolean;
  transaction?: Transaction;
  commitHash?: string;
  message: string;
  error?: string;
  conflicts?: Conflict[];
  rolledBack?: boolean;
}

/**
 * High-level API for atomic git commits
 * Coordinates transactions, conflict detection, and recovery
 */
export class AtomicCommit {
  private transactionManager: TransactionManager;
  private conflictDetector: ConflictDetector;
  private recoveryManager: RecoveryManager;
  private agentName: string;
  private workingDirectory: string;
  private autoRollback: boolean;

  constructor(options: AtomicCommitOptions) {
    this.agentName = options.agentName;
    this.workingDirectory = options.workingDirectory;
    this.autoRollback = options.autoRollback ?? true;

    this.transactionManager = new TransactionManager({
      agentName: options.agentName,
      storagePath: options.storagePath,
      gitPath: options.gitPath,
      workingDirectory: options.workingDirectory,
      reservationManager: options.reservationManager,
      autoRollback: options.autoRollback
    });

    this.conflictDetector = new ConflictDetector({
      gitPath: options.gitPath || 'git',
      workingDirectory: options.workingDirectory
    });

    this.recoveryManager = new RecoveryManager({
      storagePath: options.storagePath,
      gitPath: options.gitPath || 'git',
      workingDirectory: options.workingDirectory
    });
  }

  /**
   * Execute an atomic commit operation
   * All changes are committed together or none at all
   */
  execute(request: ExecuteRequest): ExecuteResult {
    // Validate request
    const validation = this.validate(request);
    if (!validation.valid) {
      return {
        success: false,
        message: 'Validation failed',
        error: validation.errors.join(', ')
      };
    }

    // Begin transaction
    const beginResult = this.transactionManager.beginTransaction({
      paths: request.paths,
      reason: request.commitOptions.message
    });

    if (!beginResult.success || !beginResult.transaction) {
      return {
        success: false,
        message: 'Failed to begin transaction',
        error: beginResult.error,
        conflicts: beginResult.conflicts?.map(path => ({
          type: 'reservation_revoked',
          path,
          message: `File ${path} is already reserved`,
          resolvable: false
        }))
      };
    }

    const transaction = beginResult.transaction;
    let rolledBack = false;

    try {
      // Create snapshot BEFORE applying changes (captures original state)
      this.recoveryManager.createSnapshot({
        ...transaction,
        changes: request.changes
      });

      // Apply changes to filesystem
      this.applyChanges(request.changes);

      // Stage changes
      const stageResult = this.transactionManager.stageChanges(
        transaction.id,
        request.changes
      );

      if (!stageResult.success) {
        throw new Error(stageResult.error || 'Failed to stage changes');
      }

      // Check for external conflicts
      const externalChanges = this.conflictDetector.checkExternalChanges(
        transaction.reservations
      );

      if (externalChanges.length > 0) {
        const conflicts = this.conflictDetector.detectConflicts(
          transaction,
          externalChanges
        );

        if (conflicts.length > 0) {
          throw new Error(
            `External conflicts detected: ${conflicts.map(c => c.message).join(', ')}`
          );
        }
      }

      // Commit
      const commitResult = this.transactionManager.commit(
        transaction.id,
        request.commitOptions
      );

      if (!commitResult.success) {
        rolledBack = this.autoRollback;
        throw new Error(commitResult.error || 'Commit failed');
      }

      return {
        success: true,
        transaction: this.transactionManager.getTransaction(transaction.id),
        commitHash: commitResult.commitHash,
        message: commitResult.message
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Rollback on failure
      if (this.autoRollback) {
        this.transactionManager.rollback(transaction.id);
        rolledBack = true;
      }

      return {
        success: false,
        transaction: this.transactionManager.getTransaction(transaction.id),
        message: 'Atomic commit failed',
        error: errorMessage,
        rolledBack
      };
    }
  }

  /**
   * Execute commit asynchronously
   */
  async executeAsync(request: ExecuteRequest): Promise<ExecuteResult> {
    return this.execute(request);
  }

  /**
   * Execute multiple independent commits
   * Each commit is atomic, but they are independent
   */
  batchExecute(requests: ExecuteRequest[]): ExecuteResult[] {
    return requests.map(request => this.execute(request));
  }

  /**
   * Validate a commit request without executing
   */
  validate(request: ExecuteRequest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate commit message
    if (!request.commitOptions.message || request.commitOptions.message.trim() === '') {
      errors.push('Commit message is required');
    }

    // Validate paths
    const paths = Array.isArray(request.paths) ? request.paths : [request.paths];
    if (paths.length === 0) {
      errors.push('At least one file path is required');
    }

    // Validate changes match paths
    const pathSet = new Set(paths);
    for (const change of request.changes) {
      if (!pathSet.has(change.path)) {
        errors.push(`Change path ${change.path} is not in reserved paths`);
      }
    }

    // Validate file existence for modifications
    for (const change of request.changes) {
      if (change.type === 'modify' || change.type === 'delete') {
        const filePath = path.join(this.workingDirectory, change.path);
        if (!fs.existsSync(filePath)) {
          errors.push(`File ${change.path} does not exist for ${change.type}`);
        }
      }
    }

    // Warn about missing previousContent for modifications
    for (const change of request.changes) {
      if (change.type === 'modify' && !change.previousContent) {
        warnings.push(`No previousContent for ${change.path}, rollback may not restore correctly`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if a commit can be performed
   */
  canCommit(paths: string | string[]): {
    canCommit: boolean;
    reason?: string;
    conflicts?: Conflict[];
  } {
    const pathList = Array.isArray(paths) ? paths : [paths];

    // Check for merge conflicts
    const mergeConflicts = this.conflictDetector.checkMergeConflicts();
    if (mergeConflicts.length > 0) {
      return {
        canCommit: false,
        reason: 'Merge conflicts exist in working directory',
        conflicts: mergeConflicts
      };
    }

    // Check branch divergence
    const divergence = this.conflictDetector.checkBranchDivergence();
    if (divergence.diverged && divergence.behind > 0) {
      return {
        canCommit: false,
        reason: `Branch is ${divergence.behind} commits behind remote`,
        conflicts: [{
          type: 'branch_diverged',
          path: '',
          message: `Branch diverged: ${divergence.ahead} ahead, ${divergence.behind} behind`,
          resolvable: false
        }]
      };
    }

    // Check each file can be safely modified
    for (const filePath of pathList) {
      const safety = this.conflictDetector.canSafelyModify(filePath, this.agentName);
      if (!safety.safe) {
        return {
          canCommit: false,
          reason: safety.reason,
          conflicts: safety.conflict ? [safety.conflict] : undefined
        };
      }
    }

    return { canCommit: true };
  }

  /**
   * Get current status
   */
  getStatus(): {
    agentName: string;
    workingDirectory: string;
    activeTransactions: number;
    pendingRecovery: number;
    canCommit: boolean;
  } {
    const activeTransactions = this.transactionManager.getActiveTransactions();
    const pendingRecovery = this.recoveryManager.getPendingTransactions();

    return {
      agentName: this.agentName,
      workingDirectory: this.workingDirectory,
      activeTransactions: activeTransactions.length,
      pendingRecovery: pendingRecovery.length,
      canCommit: this.canCommit([]).canCommit
    };
  }

  /**
   * Recover from incomplete transactions
   */
  async recover(): Promise<{
    recovered: string[];
    failed: string[];
  }> {
    return this.recoveryManager.recover();
  }

  /**
   * Clean up old transactions and snapshots
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): {
    transactions: number;
    snapshots: number;
  } {
    const transactions = this.transactionManager.cleanup(maxAgeMs);
    const snapshots = this.recoveryManager.cleanup(maxAgeMs);

    return { transactions, snapshots };
  }

  /**
   * Get the underlying transaction manager
   */
  getTransactionManager(): TransactionManager {
    return this.transactionManager;
  }

  /**
   * Get the conflict detector
   */
  getConflictDetector(): ConflictDetector {
    return this.conflictDetector;
  }

  /**
   * Get the recovery manager
   */
  getRecoveryManager(): RecoveryManager {
    return this.recoveryManager;
  }

  // ==================== Private Helpers ====================

  private applyChanges(changes: FileChange[]): void {
    for (const change of changes) {
      const filePath = path.join(this.workingDirectory, change.path);

      switch (change.type) {
        case 'add':
        case 'modify':
          // Ensure directory exists
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(filePath, change.content || '');
          break;

        case 'delete':
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          break;

        case 'rename':
          if (change.previousPath) {
            const oldPath = path.join(this.workingDirectory, change.previousPath);
            if (fs.existsSync(oldPath)) {
              const newDir = path.dirname(filePath);
              if (!fs.existsSync(newDir)) {
                fs.mkdirSync(newDir, { recursive: true });
              }
              fs.renameSync(oldPath, filePath);
            }
          }
          break;
      }
    }
  }
}

/**
 * Create a new atomic commit instance
 */
export function createAtomicCommit(options: AtomicCommitOptions): AtomicCommit {
  return new AtomicCommit(options);
}

export default AtomicCommit;
