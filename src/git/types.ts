/**
 * Git Atomic Commit - Types
 * Core type definitions for atomic commit system
 */

import { FileReservation } from '../swarm-mail/types';

/**
 * Transaction status
 */
export type TransactionStatus =
  | 'pending'      // Transaction created, files reserved
  | 'staging'      // Changes being staged
  | 'committing'   // Commit in progress
  | 'committed'    // Successfully committed
  | 'rolling_back' // Rollback in progress
  | 'rolled_back'  // Successfully rolled back
  | 'failed';      // Failed with error

/**
 * Change type for staged changes
 */
export type ChangeType = 'add' | 'modify' | 'delete' | 'rename';

/**
 * A single file change
 */
export interface FileChange {
  path: string;
  type: ChangeType;
  previousPath?: string; // For renames
  content?: string;      // New content (for add/modify)
  previousContent?: string; // Original content (for rollback)
  hash?: string;         // Content hash for verification
}

/**
 * Commit options
 */
export interface CommitOptions {
  message: string;
  author?: {
    name: string;
    email: string;
  };
  gpgSign?: boolean;
  gpgKeyId?: string;
  allowEmpty?: boolean;
  amend?: boolean;
  noVerify?: boolean;
}

/**
 * Transaction configuration
 */
export interface TransactionConfig {
  agentName: string;
  storagePath: string;
  gitPath?: string;
  autoRollback?: boolean;
  timeoutMs?: number;
}

/**
 * Atomic transaction
 */
export interface Transaction {
  id: string;
  agentName: string;
  status: TransactionStatus;
  reservations: FileReservation[];
  changes: FileChange[];
  commitOptions?: CommitOptions;
  createdAt: number;
  updatedAt: number;
  committedAt?: number;
  rolledBackAt?: number;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Conflict type
 */
export type ConflictType =
  | 'file_modified'      // File modified by another agent
  | 'file_deleted'       // File deleted by another agent
  | 'reservation_expired' // Reservation expired
  | 'reservation_revoked' // Reservation revoked by another agent
  | 'merge_conflict'     // Git merge conflict
  | 'branch_diverged';   // Branch has diverged

/**
 * Conflict details
 */
export interface Conflict {
  type: ConflictType;
  path: string;
  message: string;
  theirs?: string;
  ours?: string;
  base?: string;
  resolvable: boolean;
}

/**
 * Conflict resolution strategy
 */
export type ResolutionStrategy =
  | 'ours'      // Keep our changes
  | 'theirs'    // Accept their changes
  | 'merge'     // Attempt merge
  | 'abort';    // Abort transaction

/**
 * Conflict resolution
 */
export interface ConflictResolution {
  conflict: Conflict;
  strategy: ResolutionStrategy;
  resolvedContent?: string;
}

/**
 * Commit result
 */
export interface CommitResult {
  success: boolean;
  transactionId: string;
  commitHash?: string;
  message: string;
  conflicts?: Conflict[];
  error?: string;
}

/**
 * Rollback result
 */
export interface RollbackResult {
  success: boolean;
  transactionId: string;
  message: string;
  restoredFiles: string[];
  error?: string;
}

/**
 * Transaction snapshot for recovery
 */
export interface TransactionSnapshot {
  transaction: Transaction;
  workingDirectory: string;
  backupPaths: Record<string, string>; // original path -> backup path
  gitState: {
    branch: string;
    head: string;
    staged: string[];
  };
}

/**
 * Recovery state
 */
export interface RecoveryState {
  pendingTransactions: TransactionSnapshot[];
  lastCleanup: number;
}

/**
 * Git operation result
 */
export interface GitOperationResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * External change detection
 */
export interface ExternalChange {
  path: string;
  type: 'modified' | 'deleted' | 'added';
  sinceCommit: string;
  currentCommit: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
