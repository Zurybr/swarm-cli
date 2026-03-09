/**
 * Checkpoint System - Types
 * Core type definitions for swarm state checkpoint/recovery
 */

import { CellData } from '../hive/types';
import { Message, FileReservation } from '../swarm-mail/types';

/**
 * Status of a checkpoint
 */
export type CheckpointStatus = 'valid' | 'corrupted' | 'restored' | 'expired';

/**
 * Type of checkpoint trigger
 */
export type CheckpointTrigger =
  | 'manual'
  | 'auto_interval'
  | 'auto_milestone'
  | 'pre_operation'
  | 'shutdown';

/**
 * Snapshot of agent state at a point in time
 */
export interface AgentSnapshot {
  /** Agent name/identifier */
  agentName: string;
  /** Current task/context */
  currentTask?: string;
  /** Progress percentage (0-100) */
  progressPercent: number;
  /** Agent's current state data */
  state: Record<string, unknown>;
  /** Timestamp of snapshot */
  timestamp: number;
}

/**
 * Snapshot of task/cell state
 */
export interface TaskSnapshot {
  /** Cell ID */
  cellId: string;
  /** Cell data at checkpoint time */
  cellData: CellData;
  /** Parent epic ID if applicable */
  epicId?: string;
  /** Current owner/agent */
  owner?: string;
}

/**
 * Snapshot of swarm mail state
 */
export interface MailSnapshot {
  /** Messages since last checkpoint */
  messages: Message[];
  /** Active file reservations */
  reservations: FileReservation[];
  /** Thread IDs active */
  activeThreads: string[];
}

/**
 * Environment state snapshot
 */
export interface EnvironmentSnapshot {
  /** Working directory */
  workingDirectory: string;
  /** Git commit hash at checkpoint time */
  gitCommitHash?: string;
  /** Git branch */
  gitBranch?: string;
  /** Environment variables (filtered) */
  envVars: Record<string, string>;
  /** Timestamp */
  timestamp: number;
}

/**
 * Complete state snapshot
 */
export interface StateSnapshot {
  /** Version of snapshot format */
  version: string;
  /** Unique snapshot ID */
  id: string;
  /** When the snapshot was created */
  createdAt: number;
  /** What triggered this checkpoint */
  trigger: CheckpointTrigger;
  /** Description/notes */
  description?: string;
  /** Agent states */
  agents: AgentSnapshot[];
  /** Task/cell states */
  tasks: TaskSnapshot[];
  /** Mail state */
  mail: MailSnapshot;
  /** Environment state */
  environment: EnvironmentSnapshot;
  /** Metadata for extensibility */
  metadata?: Record<string, unknown>;
}

/**
 * Checkpoint metadata stored in Hive
 */
export interface Checkpoint {
  /** Unique checkpoint ID */
  id: string;
  /** Reference to snapshot file */
  snapshotId: string;
  /** Checkpoint status */
  status: CheckpointStatus;
  /** When created */
  createdAt: number;
  /** When restored (if applicable) */
  restoredAt?: number;
  /** What triggered this checkpoint */
  trigger: CheckpointTrigger;
  /** Description */
  description?: string;
  /** Size of snapshot in bytes */
  sizeBytes: number;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Options for creating a checkpoint
 */
export interface CreateCheckpointOptions {
  /** Trigger type */
  trigger?: CheckpointTrigger;
  /** Description */
  description?: string;
  /** Tags */
  tags?: string[];
  /** Include specific agents only */
  agentFilter?: string[];
  /** Include specific tasks only */
  taskFilter?: string[];
}

/**
 * Options for restoring from checkpoint
 */
export interface RestoreOptions {
  /** Checkpoint ID to restore from */
  checkpointId: string;
  /** Restore agents state */
  restoreAgents?: boolean;
  /** Restore tasks state */
  restoreTasks?: boolean;
  /** Restore mail state */
  restoreMail?: boolean;
  /** Restore environment (git, etc) */
  restoreEnvironment?: boolean;
  /** Validate before restore */
  validate?: boolean;
}

/**
 * Result of a checkpoint operation
 */
export interface CheckpointResult {
  success: boolean;
  checkpoint?: Checkpoint;
  error?: string;
  /** Time taken in ms */
  durationMs?: number;
}

/**
 * Result of a restore operation
 */
export interface RestoreResult {
  success: boolean;
  restoredCheckpoint?: Checkpoint;
  error?: string;
  /** What was restored */
  restored: {
    agents: boolean;
    tasks: boolean;
    mail: boolean;
    environment: boolean;
  };
  /** Time taken in ms */
  durationMs?: number;
}

/**
 * Auto-checkpoint configuration
 */
export interface AutoCheckpointConfig {
  /** Enable auto-checkpointing */
  enabled: boolean;
  /** Interval in milliseconds */
  intervalMs: number;
  /** Checkpoint on milestones */
  onMilestones: boolean;
  /** Milestone progress percentages */
  milestonePercentages: number[];
  /** Checkpoint before risky operations */
  onRiskyOperations: boolean;
  /** Operations considered risky */
  riskyOperations: string[];
  /** Max checkpoints to keep (oldest auto-deleted) */
  maxCheckpoints: number;
  /** Min time between checkpoints */
  minIntervalMs: number;
}

/**
 * Default auto-checkpoint configuration
 */
export const DEFAULT_AUTO_CHECKPOINT_CONFIG: AutoCheckpointConfig = {
  enabled: true,
  intervalMs: 5 * 60 * 1000, // 5 minutes
  onMilestones: true,
  milestonePercentages: [25, 50, 75, 90, 100],
  onRiskyOperations: true,
  riskyOperations: ['git.push', 'git.reset', 'file.delete', 'db.migrate'],
  maxCheckpoints: 10,
  minIntervalMs: 30 * 1000, // 30 seconds
};

/**
 * Query filters for listing checkpoints
 */
export interface CheckpointQuery {
  /** Filter by status */
  status?: CheckpointStatus | CheckpointStatus[];
  /** Filter by trigger type */
  trigger?: CheckpointTrigger | CheckpointTrigger[];
  /** Filter by tags */
  tags?: string[];
  /** Created after this timestamp */
  since?: number;
  /** Created before this timestamp */
  until?: number;
  /** Limit results */
  limit?: number;
}

/**
 * Recovery strategy for handling failures
 */
export type RecoveryStrategy = 'rollback' | 'continue' | 'pause' | 'notify';

/**
 * Recovery configuration
 */
export interface RecoveryConfig {
  /** Default strategy */
  defaultStrategy: RecoveryStrategy;
  /** Auto-retry count */
  autoRetryCount: number;
  /** Notify on recovery */
  notifyOnRecovery: boolean;
  /** Create checkpoint before recovery */
  checkpointBeforeRecovery: boolean;
}

/**
 * Default recovery configuration
 */
export const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  defaultStrategy: 'rollback',
  autoRetryCount: 1,
  notifyOnRecovery: true,
  checkpointBeforeRecovery: true,
};

/**
 * Checkpoint storage configuration
 */
export interface CheckpointStorageConfig {
  /** Base directory for checkpoints */
  baseDir: string;
  /** Enable compression */
  compressSnapshots: boolean;
  /** Max snapshots to keep */
  maxSnapshots: number;
  /** Snapshot retention days */
  retentionDays: number;
}

/**
 * Default checkpoint storage configuration
 */
export const DEFAULT_CHECKPOINT_STORAGE_CONFIG: CheckpointStorageConfig = {
  baseDir: '.checkpoints',
  compressSnapshots: true,
  maxSnapshots: 50,
  retentionDays: 7,
};
