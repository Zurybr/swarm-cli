/**
 * Git Atomic Commit - Public API
 * Atomic commit system for swarm file changes
 *
 * @example
 * ```typescript
 * import { createAtomicCommit, createTransactionManager } from './git';
 *
 * // High-level API
 * const atomicCommit = createAtomicCommit({
 *   agentName: 'my-agent',
 *   storagePath: '/path/to/storage',
 *   workingDirectory: '/path/to/repo',
 *   reservationManager
 * });
 *
 * const result = atomicCommit.execute({
 *   paths: ['file1.ts', 'file2.ts'],
 *   changes: [
 *     { path: 'file1.ts', type: 'modify', content: 'new content', previousContent: 'old' },
 *     { path: 'file2.ts', type: 'add', content: 'new file' }
 *   ],
 *   commitOptions: { message: 'feat: atomic commit' }
 * });
 *
 * if (result.success) {
 *   console.log(`Committed: ${result.commitHash}`);
 * } else {
 *   console.error(`Failed: ${result.error}`);
 * }
 * ```
 */

// Core classes
export { AtomicCommit, createAtomicCommit } from './atomic-commit';
export { TransactionManager, createTransactionManager } from './transaction';
export { ConflictDetector, createConflictDetector } from './conflict';
export { RecoveryManager, createRecoveryManager } from './recovery';

// Types
export type {
  TransactionStatus,
  ChangeType,
  FileChange,
  CommitOptions,
  Transaction,
  TransactionConfig,
  ConflictType,
  Conflict,
  ResolutionStrategy,
  ConflictResolution,
  CommitResult,
  RollbackResult,
  TransactionSnapshot,
  RecoveryState,
  GitOperationResult,
  ExternalChange,
  ValidationResult
} from './types';

// Transaction manager types
export type {
  TransactionManagerOptions,
  BeginTransactionRequest,
  BeginTransactionResult,
  StageChangesResult
} from './transaction';

// Atomic commit types
export type {
  AtomicCommitOptions,
  ExecuteRequest,
  ExecuteResult
} from './atomic-commit';

// Conflict detector types
export type { ConflictDetectorOptions } from './conflict';

// Recovery manager types
export type { RecoveryManagerOptions } from './recovery';

/**
 * Convenience function to create a fully configured atomic commit system
 */
import { AtomicCommit, AtomicCommitOptions } from './atomic-commit';
import { TransactionManager, TransactionManagerOptions } from './transaction';
import { ConflictDetector, ConflictDetectorOptions } from './conflict';
import { RecoveryManager, RecoveryManagerOptions } from './recovery';
import { ReservationManager } from '../swarm-mail/reservations';

export interface GitAtomicSystemOptions {
  agentName: string;
  storagePath: string;
  workingDirectory: string;
  gitPath?: string;
  autoRollback?: boolean;
}

export interface GitAtomicSystem {
  atomicCommit: AtomicCommit;
  transactionManager: TransactionManager;
  conflictDetector: ConflictDetector;
  recoveryManager: RecoveryManager;
  reservationManager: ReservationManager;
}

/**
 * Create a complete atomic commit system with all components
 */
export function createGitAtomicSystem(options: GitAtomicSystemOptions): GitAtomicSystem {
  const reservationManager = new ReservationManager(options.storagePath);

  const atomicCommitOptions: AtomicCommitOptions = {
    agentName: options.agentName,
    storagePath: options.storagePath,
    workingDirectory: options.workingDirectory,
    gitPath: options.gitPath,
    reservationManager,
    autoRollback: options.autoRollback ?? true
  };

  const atomicCommit = new AtomicCommit(atomicCommitOptions);

  const transactionManager = new TransactionManager({
    agentName: options.agentName,
    storagePath: options.storagePath,
    workingDirectory: options.workingDirectory,
    gitPath: options.gitPath,
    reservationManager,
    autoRollback: options.autoRollback ?? true
  });

  const conflictDetector = new ConflictDetector({
    gitPath: options.gitPath || 'git',
    workingDirectory: options.workingDirectory
  });

  const recoveryManager = new RecoveryManager({
    storagePath: options.storagePath,
    gitPath: options.gitPath || 'git',
    workingDirectory: options.workingDirectory
  });

  return {
    atomicCommit,
    transactionManager,
    conflictDetector,
    recoveryManager,
    reservationManager
  };
}

export default createGitAtomicSystem;
