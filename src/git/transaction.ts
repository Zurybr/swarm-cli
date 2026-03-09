/**
 * Git Atomic Commit - Transaction Manager
 * Manages atomic transactions for file changes
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  Transaction,
  TransactionConfig,
  FileChange,
  CommitOptions,
  CommitResult,
  RollbackResult,
  ValidationResult,
  TransactionStatus
} from './types';
import { FileReservation, ReservationRequest } from '../swarm-mail/types';
import { ReservationManager } from '../swarm-mail/reservations';
import { RecoveryManager } from './recovery';

export interface TransactionManagerOptions {
  agentName: string;
  storagePath: string;
  gitPath?: string;
  workingDirectory: string;
  reservationManager: ReservationManager;
  autoRollback?: boolean;
}

export interface BeginTransactionRequest {
  paths: string | string[];
  reason?: string;
  ttlSeconds?: number;
}

export interface BeginTransactionResult {
  success: boolean;
  transaction?: Transaction;
  error?: string;
  conflicts?: string[];
}

export interface StageChangesResult {
  success: boolean;
  transaction?: Transaction;
  error?: string;
}

/**
 * Manages atomic transactions for git commits
 */
export class TransactionManager {
  private agentName: string;
  private storagePath: string;
  private gitPath: string;
  private workingDirectory: string;
  private reservationManager: ReservationManager;
  private recoveryManager: RecoveryManager;
  private autoRollback: boolean;
  private transactionsDir: string;

  constructor(options: TransactionManagerOptions) {
    this.agentName = options.agentName;
    this.storagePath = options.storagePath;
    this.gitPath = options.gitPath || 'git';
    this.workingDirectory = options.workingDirectory;
    this.reservationManager = options.reservationManager;
    this.autoRollback = options.autoRollback ?? true;
    this.transactionsDir = path.join(this.storagePath, 'transactions');

    this.recoveryManager = new RecoveryManager({
      storagePath: this.storagePath,
      gitPath: this.gitPath,
      workingDirectory: this.workingDirectory
    });

    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.transactionsDir)) {
      fs.mkdirSync(this.transactionsDir, { recursive: true });
    }
  }

  private generateId(): string {
    return `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getTransactionPath(transactionId: string): string {
    return path.join(this.transactionsDir, `${transactionId}.json`);
  }

  private save(transaction: Transaction): void {
    const transactionPath = this.getTransactionPath(transaction.id);
    fs.writeFileSync(transactionPath, JSON.stringify(transaction, null, 2));
  }

  /**
   * Begin a new transaction with file reservations
   */
  beginTransaction(request: BeginTransactionRequest): BeginTransactionResult {
    const paths = Array.isArray(request.paths) ? request.paths : [request.paths];

    // Check for conflicts
    const conflictCheck = this.reservationManager.checkConflicts(paths, this.agentName);
    if (conflictCheck.hasConflict) {
      return {
        success: false,
        error: `Conflict detected: ${conflictCheck.message}`,
        conflicts: conflictCheck.conflicts.map(c => c.path)
      };
    }

    // Reserve files
    const reservationResult = this.reservationManager.reserve(this.agentName, {
      paths: request.paths,
      reason: request.reason || 'Transaction',
      ttlSeconds: request.ttlSeconds || 3600,
      exclusive: true
    });

    if (!reservationResult.success) {
      return {
        success: false,
        error: 'Failed to reserve files',
        conflicts: reservationResult.conflicts.conflicts.map(c => c.path)
      };
    }

    // Create transaction
    const now = Date.now();
    const transaction: Transaction = {
      id: this.generateId(),
      agentName: this.agentName,
      status: 'pending',
      reservations: reservationResult.reservations,
      changes: [],
      createdAt: now,
      updatedAt: now,
      metadata: {
        reason: request.reason
      }
    };

    this.save(transaction);

    return {
      success: true,
      transaction
    };
  }

  /**
   * Stage changes for a transaction
   */
  stageChanges(transactionId: string, changes: FileChange[]): StageChangesResult {
    const transaction = this.getTransaction(transactionId);

    if (!transaction) {
      return {
        success: false,
        error: `Transaction ${transactionId} not found`
      };
    }

    // Validate all changed files are reserved
    const reservedPaths = new Set(transaction.reservations.map(r => r.path));
    for (const change of changes) {
      if (!reservedPaths.has(change.path)) {
        return {
          success: false,
          error: `File ${change.path} is not reserved in this transaction`
        };
      }
    }

    // Save original content for rollback (only if not already set)
    for (const change of changes) {
      if (change.type === 'modify' || change.type === 'delete') {
        const filePath = path.join(this.workingDirectory, change.path);
        if (fs.existsSync(filePath)) {
          const currentContent = fs.readFileSync(filePath, 'utf-8');
          // Only set previousContent if not already provided (allows caller to specify original content)
          if (change.previousContent === undefined) {
            change.previousContent = currentContent;
          }
          this.recoveryManager.saveOriginalContent(transactionId, change.path, change.previousContent);
        }
      }
    }

    // Update transaction
    transaction.changes = [...transaction.changes, ...changes];
    transaction.status = 'staging';
    transaction.updatedAt = Date.now();

    this.save(transaction);

    // Create snapshot for potential rollback (if not already exists)
    if (!this.recoveryManager.hasSnapshot(transactionId)) {
      this.recoveryManager.createSnapshot(transaction);
    }

    return {
      success: true,
      transaction
    };
  }

  /**
   * Commit the transaction
   */
  commit(transactionId: string, options: CommitOptions): CommitResult {
    const transaction = this.getTransaction(transactionId);

    if (!transaction) {
      return {
        success: false,
        transactionId,
        message: 'Transaction not found',
        error: `Transaction ${transactionId} does not exist`
      };
    }

    // Validate commit options
    if (!options.message || options.message.trim() === '') {
      return {
        success: false,
        transactionId,
        message: 'Invalid commit options',
        error: 'Commit message is required'
      };
    }

    // Validate transaction has changes
    if (transaction.changes.length === 0) {
      return {
        success: false,
        transactionId,
        message: 'No changes to commit',
        error: 'Transaction has no staged changes'
      };
    }

    // Create snapshot for potential rollback
    this.recoveryManager.createSnapshot(transaction);

    try {
      transaction.status = 'committing';
      transaction.commitOptions = options;
      this.save(transaction);

      // Stage files in git
      for (const change of transaction.changes) {
        const filePath = path.join(this.workingDirectory, change.path);

        if (change.type === 'delete') {
          execSync(`${this.gitPath} rm "${change.path}"`, {
            cwd: this.workingDirectory,
            stdio: 'pipe'
          });
        } else {
          // Add or modify
          execSync(`${this.gitPath} add "${change.path}"`, {
            cwd: this.workingDirectory,
            stdio: 'pipe'
          });
        }
      }

      // Build commit command
      let commitCmd = `${this.gitPath} commit -m "${options.message.replace(/"/g, '\\"')}"`;

      if (options.author) {
        commitCmd += ` --author="${options.author.name} <${options.author.email}>"`;
      }

      if (options.gpgSign) {
        commitCmd += options.gpgKeyId ? ` -S${options.gpgKeyId}` : ' -S';
      }

      if (options.allowEmpty) {
        commitCmd += ' --allow-empty';
      }

      if (options.amend) {
        commitCmd += ' --amend';
      }

      if (options.noVerify) {
        commitCmd += ' --no-verify';
      }

      // Execute commit
      const output = execSync(commitCmd, {
        cwd: this.workingDirectory,
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      // Get commit hash
      const commitHash = execSync(`${this.gitPath} rev-parse HEAD`, {
        cwd: this.workingDirectory,
        encoding: 'utf-8',
        stdio: 'pipe'
      }).trim();

      // Update transaction status
      transaction.status = 'committed';
      transaction.committedAt = Date.now();
      transaction.updatedAt = Date.now();
      this.save(transaction);

      // Release reservations
      this.releaseReservations(transaction);

      // Clean up snapshot on successful commit
      this.recoveryManager.cleanup(0);

      return {
        success: true,
        transactionId,
        commitHash,
        message: `Successfully committed ${transaction.changes.length} files`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      transaction.status = 'failed';
      transaction.error = errorMessage;
      transaction.updatedAt = Date.now();
      this.save(transaction);

      // Auto-rollback if enabled
      if (this.autoRollback) {
        this.rollback(transactionId);
      }

      return {
        success: false,
        transactionId,
        message: 'Commit failed',
        error: errorMessage
      };
    }
  }

  /**
   * Rollback a transaction
   */
  rollback(transactionId: string): RollbackResult {
    const transaction = this.getTransaction(transactionId);

    if (!transaction) {
      return {
        success: false,
        transactionId,
        message: 'Transaction not found',
        restoredFiles: [],
        error: `Transaction ${transactionId} does not exist`
      };
    }

    transaction.status = 'rolling_back';
    this.save(transaction);

    // Use recovery manager to restore files
    const result = this.recoveryManager.rollback(transactionId);

    if (result.success) {
      transaction.status = 'rolled_back';
      transaction.rolledBackAt = Date.now();
      transaction.updatedAt = Date.now();
      this.save(transaction);

      // Release reservations
      this.releaseReservations(transaction);
    }

    return result;
  }

  /**
   * Get a transaction by ID
   */
  getTransaction(transactionId: string): Transaction | undefined {
    const transactionPath = this.getTransactionPath(transactionId);

    if (!fs.existsSync(transactionPath)) {
      return undefined;
    }

    try {
      const data = fs.readFileSync(transactionPath, 'utf-8');
      return JSON.parse(data) as Transaction;
    } catch {
      return undefined;
    }
  }

  /**
   * Get all transactions
   */
  getAllTransactions(): Transaction[] {
    const transactions: Transaction[] = [];

    if (!fs.existsSync(this.transactionsDir)) {
      return transactions;
    }

    const files = fs.readdirSync(this.transactionsDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const transactionPath = path.join(this.transactionsDir, file);
      try {
        const data = fs.readFileSync(transactionPath, 'utf-8');
        const transaction = JSON.parse(data) as Transaction;
        transactions.push(transaction);
      } catch {
        // Skip invalid files
      }
    }

    return transactions.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get active (non-finalized) transactions
   */
  getActiveTransactions(): Transaction[] {
    return this.getAllTransactions().filter(
      t => t.status !== 'committed' && t.status !== 'rolled_back' && t.status !== 'failed'
    );
  }

  /**
   * Get transactions for this agent
   */
  getMyTransactions(): Transaction[] {
    return this.getAllTransactions().filter(t => t.agentName === this.agentName);
  }

  /**
   * Validate a transaction is ready for commit
   */
  validateTransaction(transactionId: string): ValidationResult {
    const transaction = this.getTransaction(transactionId);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!transaction) {
      return {
        valid: false,
        errors: ['Transaction not found'],
        warnings: []
      };
    }

    if (transaction.changes.length === 0) {
      errors.push('No changes staged');
    }

    if (transaction.status === 'committed') {
      errors.push('Transaction already committed');
    }

    if (transaction.status === 'rolled_back') {
      errors.push('Transaction already rolled back');
    }

    if (transaction.status === 'failed') {
      warnings.push('Transaction previously failed');
    }

    // Check if reservations are still valid
    for (const reservation of transaction.reservations) {
      const current = this.reservationManager.get(reservation.id);
      if (!current || current.status !== 'active') {
        errors.push(`Reservation expired for ${reservation.path}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Clean up old transactions
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    let cleaned = 0;
    const now = Date.now();

    const transactions = this.getAllTransactions();

    for (const transaction of transactions) {
      // Clean up completed transactions older than maxAge
      const isFinalized =
        transaction.status === 'committed' ||
        transaction.status === 'rolled_back' ||
        transaction.status === 'failed';

      if (isFinalized && now - transaction.updatedAt > maxAgeMs) {
        const transactionPath = this.getTransactionPath(transaction.id);
        if (fs.existsSync(transactionPath)) {
          fs.unlinkSync(transactionPath);
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  // ==================== Private Helpers ====================

  private releaseReservations(transaction: Transaction): void {
    for (const reservation of transaction.reservations) {
      try {
        this.reservationManager.release(reservation.id, this.agentName);
      } catch {
        // Ignore release errors
      }
    }
  }
}

/**
 * Create a new transaction manager
 */
export function createTransactionManager(
  options: TransactionManagerOptions
): TransactionManager {
  return new TransactionManager(options);
}

export default TransactionManager;
