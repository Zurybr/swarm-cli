/**
 * Checkpoint System
 * Swarm state checkpoint/recovery system for fault tolerance
 *
 * @example
 * ```typescript
 * import { CheckpointManager } from './checkpoint';
 * import { Hive } from './hive';
 * import { SwarmMail } from './swarm-mail';
 *
 * const hive = new Hive({ baseDir: '.hive' });
 * const swarmMail = new SwarmMail({ agentName: 'coordinator', storagePath: '.swarm' });
 *
 * const checkpointManager = new CheckpointManager(hive, swarmMail);
 * await checkpointManager.init();
 *
 * // Create a checkpoint
 * const result = await checkpointManager.createCheckpoint({
 *   trigger: 'manual',
 *   description: 'Before major refactor'
 * });
 *
 * // List checkpoints
 * const checkpoints = await checkpointManager.listCheckpoints();
 *
 * // Restore from checkpoint
 * await checkpointManager.restoreFromCheckpoint({
 *   checkpointId: 'chk-abc123',
 *   restoreAgents: true,
 *   restoreTasks: true
 * });
 * ```
 */

// Core types
export type {
  Checkpoint,
  CheckpointStatus,
  CheckpointTrigger,
  StateSnapshot,
  AgentSnapshot,
  TaskSnapshot,
  MailSnapshot,
  EnvironmentSnapshot,
  CreateCheckpointOptions,
  RestoreOptions,
  CheckpointResult,
  RestoreResult,
  CheckpointQuery,
  AutoCheckpointConfig,
  RecoveryConfig,
  CheckpointStorageConfig,
  RecoveryStrategy,
  HealthCheckResult,
} from './types';

// Default configurations
export {
  DEFAULT_AUTO_CHECKPOINT_CONFIG,
  DEFAULT_RECOVERY_CONFIG,
  DEFAULT_CHECKPOINT_STORAGE_CONFIG,
} from './types';

// Core classes
export { CheckpointManager, CheckpointManagerError } from './manager';
export { StateCapture, StateCaptureError } from './state';
export { RecoveryManager, RecoveryError } from './recovery';
export { AutoCheckpoint, AutoCheckpointError } from './auto';

// Convenience function to create a checkpoint manager
import { CheckpointManager } from './manager';
import { Hive } from '../hive';
import { SwarmMail } from '../swarm-mail';
import {
  CheckpointStorageConfig,
  AutoCheckpointConfig,
  RecoveryConfig,
} from './types';

/**
 * Options for creating a checkpoint manager
 */
export interface CreateCheckpointManagerOptions {
  /** Hive instance for cell/task persistence */
  hive: Hive;
  /** SwarmMail instance for messaging */
  swarmMail: SwarmMail;
  /** Storage configuration */
  storageConfig?: Partial<CheckpointStorageConfig>;
  /** Auto-checkpoint configuration */
  autoConfig?: Partial<AutoCheckpointConfig>;
  /** Recovery configuration */
  recoveryConfig?: Partial<RecoveryConfig>;
  /** Auto-initialize after creation */
  autoInit?: boolean;
}

/**
 * Create and optionally initialize a checkpoint manager
 */
export async function createCheckpointManager(
  options: CreateCheckpointManagerOptions
): Promise<CheckpointManager> {
  const manager = new CheckpointManager(
    options.hive,
    options.swarmMail,
    options.storageConfig,
    options.autoConfig,
    options.recoveryConfig
  );

  if (options.autoInit !== false) {
    await manager.init();
  }

  return manager;
}

/**
 * Quick checkpoint helper - create a checkpoint with minimal setup
 * @deprecated Use CheckpointManager.createCheckpoint() instead
 */
export async function quickCheckpoint(
  hive: Hive,
  swarmMail: SwarmMail,
  description?: string
): Promise<{
  success: boolean;
  checkpointId?: string;
  error?: string;
}> {
  const manager = new CheckpointManager(hive, swarmMail);
  await manager.init();

  try {
    const result = await manager.createCheckpoint({
      trigger: 'manual',
      description,
    });

    return {
      success: result.success,
      checkpointId: result.checkpoint?.id,
      error: result.error,
    };
  } finally {
    await manager.close();
  }
}

// Default export
export { CheckpointManager as default };
