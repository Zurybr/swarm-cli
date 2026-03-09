/**
 * Checkpoint System - Manager
 * Core checkpoint management: create, list, restore, delete
 */

import { StateCapture } from './state';
import { RecoveryManager } from './recovery';
import { AutoCheckpoint } from './auto';
import { Hive } from '../hive';
import { SwarmMail } from '../swarm-mail';
import {
  Checkpoint,
  CheckpointTrigger,
  CheckpointQuery,
  CheckpointResult,
  RestoreOptions,
  RestoreResult,
  CreateCheckpointOptions,
  CheckpointStorageConfig,
  DEFAULT_CHECKPOINT_STORAGE_CONFIG,
  AutoCheckpointConfig,
  RecoveryConfig,
  StateSnapshot,
} from './types';

/**
 * Error thrown when checkpoint operations fail
 */
export class CheckpointManagerError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'CheckpointManagerError';
  }
}

/**
 * Main checkpoint manager - orchestrates state capture, recovery, and auto-checkpointing
 */
export class CheckpointManager {
  private config: CheckpointStorageConfig;
  private stateCapture: StateCapture;
  private recoveryManager: RecoveryManager;
  private autoCheckpoint: AutoCheckpoint;
  private hive: Hive;
  private swarmMail: SwarmMail;
  private initialized: boolean = false;
  private checkpointIndex: Map<string, Checkpoint> = new Map();

  constructor(
    hive: Hive,
    swarmMail: SwarmMail,
    storageConfig?: Partial<CheckpointStorageConfig>,
    autoConfig?: Partial<AutoCheckpointConfig>,
    recoveryConfig?: Partial<RecoveryConfig>
  ) {
    this.hive = hive;
    this.swarmMail = swarmMail;
    this.config = { ...DEFAULT_CHECKPOINT_STORAGE_CONFIG, ...storageConfig };

    // Initialize subsystems
    this.stateCapture = new StateCapture(this.config, hive, swarmMail);
    this.recoveryManager = new RecoveryManager(
      recoveryConfig,
      this.stateCapture,
      hive,
      swarmMail
    );
    this.autoCheckpoint = new AutoCheckpoint(autoConfig, this.stateCapture);
  }

  /**
   * Initialize the checkpoint manager
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Initialize subsystems
    await this.stateCapture.init();
    await this.recoveryManager.init();
    await this.autoCheckpoint.init();

    // Load existing checkpoints from snapshots
    await this.loadCheckpointIndex();

    this.initialized = true;

    // Notify via swarm mail
    this.swarmMail.sendSystemEvent(
      'Checkpoint Manager Initialized',
      'Checkpoint system is ready',
      'coordinator'
    );
  }

  /**
   * Load checkpoint index from existing snapshots
   */
  private async loadCheckpointIndex(): Promise<void> {
    const snapshots = await this.stateCapture.listSnapshots();

    for (const snapshot of snapshots) {
      const checkpoint: Checkpoint = {
        id: `chk-${snapshot.id}`,
        snapshotId: snapshot.id,
        status: 'valid',
        createdAt: snapshot.createdAt,
        trigger: snapshot.trigger,
        description: snapshot.description,
        sizeBytes: await this.stateCapture.getSnapshotSize(snapshot.id),
      };

      this.checkpointIndex.set(checkpoint.id, checkpoint);
    }
  }

  /**
   * Create a new checkpoint
   */
  async createCheckpoint(
    options: CreateCheckpointOptions = {}
  ): Promise<CheckpointResult> {
    this.ensureInitialized();

    const startTime = Date.now();
    const trigger = options.trigger || 'manual';

    try {
      // Create snapshot
      const snapshot = await this.stateCapture.createSnapshot(
        trigger,
        options.description,
        {
          agentFilter: options.agentFilter,
          taskFilter: options.taskFilter,
        }
      );

      // Save snapshot
      const saved = await this.stateCapture.saveSnapshot(snapshot);
      if (!saved) {
        return {
          success: false,
          error: 'Failed to save checkpoint snapshot',
          durationMs: Date.now() - startTime,
        };
      }

      // Get snapshot size
      const sizeBytes = await this.stateCapture.getSnapshotSize(snapshot.id);

      // Create checkpoint record
      const checkpoint: Checkpoint = {
        id: `chk-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        snapshotId: snapshot.id,
        status: 'valid',
        createdAt: snapshot.createdAt,
        trigger,
        description: options.description,
        sizeBytes,
        tags: options.tags,
      };

      this.checkpointIndex.set(checkpoint.id, checkpoint);

      // Notify
      this.swarmMail.sendSystemEvent(
        'Checkpoint Created',
        `Checkpoint ${checkpoint.id} created (${trigger})`,
        'coordinator',
        { checkpointId: checkpoint.id, trigger }
      );

      return {
        success: true,
        checkpoint,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = `Checkpoint creation failed: ${(error as Error).message}`;

      // Notify of failure
      this.swarmMail.sendSystemEvent(
        'Checkpoint Failed',
        errorMsg,
        'coordinator',
        { error: (error as Error).message }
      );

      return {
        success: false,
        error: errorMsg,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * List available checkpoints with optional filtering
   */
  async listCheckpoints(query?: CheckpointQuery): Promise<Checkpoint[]> {
    this.ensureInitialized();

    let checkpoints = Array.from(this.checkpointIndex.values());

    // Apply filters
    if (query) {
      if (query.status) {
        const statuses = Array.isArray(query.status)
          ? query.status
          : [query.status];
        checkpoints = checkpoints.filter((c) => statuses.includes(c.status));
      }

      if (query.trigger) {
        const triggers = Array.isArray(query.trigger)
          ? query.trigger
          : [query.trigger];
        checkpoints = checkpoints.filter((c) => triggers.includes(c.trigger));
      }

      if (query.tags) {
        checkpoints = checkpoints.filter((c) =>
          query.tags!.some((tag) => c.tags?.includes(tag))
        );
      }

      if (query.since) {
        checkpoints = checkpoints.filter((c) => c.createdAt >= query.since!);
      }

      if (query.until) {
        checkpoints = checkpoints.filter((c) => c.createdAt <= query.until!);
      }
    }

    // Sort by creation time, newest first
    checkpoints.sort((a, b) => b.createdAt - a.createdAt);

    // Apply limit
    if (query?.limit) {
      checkpoints = checkpoints.slice(0, query.limit);
    }

    return checkpoints;
  }

  /**
   * Get a specific checkpoint by ID
   */
  async getCheckpoint(checkpointId: string): Promise<Checkpoint | undefined> {
    this.ensureInitialized();
    return this.checkpointIndex.get(checkpointId);
  }

  /**
   * Get the most recent checkpoint
   */
  async getLatestCheckpoint(): Promise<Checkpoint | undefined> {
    this.ensureInitialized();

    const checkpoints = await this.listCheckpoints({ limit: 1 });
    return checkpoints[0];
  }

  /**
   * Restore from a checkpoint
   */
  async restoreFromCheckpoint(
    options: RestoreOptions
  ): Promise<RestoreResult> {
    this.ensureInitialized();

    const checkpoint = this.checkpointIndex.get(options.checkpointId);

    if (!checkpoint) {
      return {
        success: false,
        error: `Checkpoint not found: ${options.checkpointId}`,
        restored: {
          agents: false,
          tasks: false,
          mail: false,
          environment: false,
        },
        durationMs: 0,
      };
    }

    // Perform restore
    const result = await this.recoveryManager.restore({
      ...options,
      checkpointId: checkpoint.snapshotId,
    });

    if (result.success && result.restoredCheckpoint) {
      // Update checkpoint status
      checkpoint.status = 'restored';
      checkpoint.restoredAt = Date.now();
      this.checkpointIndex.set(options.checkpointId, checkpoint);

      // Notify
      this.swarmMail.sendSystemEvent(
        'Checkpoint Restored',
        `Restored from checkpoint ${options.checkpointId}`,
        'coordinator',
        {
          checkpointId: options.checkpointId,
          restored: result.restored,
        }
      );
    }

    return result;
  }

  /**
   * Delete a checkpoint
   */
  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    this.ensureInitialized();

    const checkpoint = this.checkpointIndex.get(checkpointId);
    if (!checkpoint) {
      return false;
    }

    try {
      // Delete snapshot
      const deleted = await this.stateCapture.deleteSnapshot(
        checkpoint.snapshotId
      );
      if (!deleted) {
        return false;
      }

      // Remove from index
      this.checkpointIndex.delete(checkpointId);

      // Notify
      this.swarmMail.sendSystemEvent(
        'Checkpoint Deleted',
        `Deleted checkpoint ${checkpointId}`,
        'coordinator'
      );

      return true;
    } catch (error) {
      console.error('Failed to delete checkpoint:', error);
      return false;
    }
  }

  /**
   * Delete old checkpoints based on retention policy
   */
  async cleanupOldCheckpoints(
    maxAgeMs?: number,
    maxCount?: number
  ): Promise<number> {
    this.ensureInitialized();

    let toDelete: Checkpoint[] = [];

    // Find old checkpoints
    if (maxAgeMs) {
      const cutoff = Date.now() - maxAgeMs;
      toDelete = (await this.listCheckpoints()).filter(
        (c) => c.createdAt < cutoff
      );
    }

    // Find excess checkpoints
    if (maxCount) {
      const all = await this.listCheckpoints();
      if (all.length > maxCount) {
        const excess = all.slice(maxCount);
        toDelete = [...toDelete, ...excess];
      }
    }

    // Remove duplicates
    const uniqueIds = new Set<string>();
    toDelete = toDelete.filter((c) => {
      if (uniqueIds.has(c.id)) return false;
      uniqueIds.add(c.id);
      return true;
    });

    // Delete them
    let deletedCount = 0;
    for (const checkpoint of toDelete) {
      if (await this.deleteCheckpoint(checkpoint.id)) {
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Validate a checkpoint's integrity
   */
  async validateCheckpoint(checkpointId: string): Promise<boolean> {
    this.ensureInitialized();

    const checkpoint = this.checkpointIndex.get(checkpointId);
    if (!checkpoint) {
      return false;
    }

    const snapshot = await this.stateCapture.loadSnapshot(
      checkpoint.snapshotId
    );
    if (!snapshot) {
      return false;
    }

    return this.stateCapture.validateSnapshot(snapshot);
  }

  /**
   * Get checkpoint statistics
   */
  async getStats(): Promise<{
    totalCheckpoints: number;
    totalSizeBytes: number;
    byTrigger: Record<CheckpointTrigger, number>;
    oldestCheckpoint?: number;
    newestCheckpoint?: number;
  }> {
    this.ensureInitialized();

    const checkpoints = await this.listCheckpoints();

    const byTrigger: Record<string, number> = {
      manual: 0,
      auto_interval: 0,
      auto_milestone: 0,
      pre_operation: 0,
      shutdown: 0,
    };

    let totalSizeBytes = 0;
    let oldestCheckpoint: number | undefined;
    let newestCheckpoint: number | undefined;

    for (const checkpoint of checkpoints) {
      byTrigger[checkpoint.trigger] = (byTrigger[checkpoint.trigger] || 0) + 1;
      totalSizeBytes += checkpoint.sizeBytes;

      if (!oldestCheckpoint || checkpoint.createdAt < oldestCheckpoint) {
        oldestCheckpoint = checkpoint.createdAt;
      }
      if (!newestCheckpoint || checkpoint.createdAt > newestCheckpoint) {
        newestCheckpoint = checkpoint.createdAt;
      }
    }

    return {
      totalCheckpoints: checkpoints.length,
      totalSizeBytes,
      byTrigger: byTrigger as Record<CheckpointTrigger, number>,
      oldestCheckpoint,
      newestCheckpoint,
    };
  }

  /**
   * Get the underlying state capture instance
   */
  getStateCapture(): StateCapture {
    return this.stateCapture;
  }

  /**
   * Get the underlying recovery manager
   */
  getRecoveryManager(): RecoveryManager {
    return this.recoveryManager;
  }

  /**
   * Get the underlying auto-checkpoint instance
   */
  getAutoCheckpoint(): AutoCheckpoint {
    return this.autoCheckpoint;
  }

  /**
   * Trigger an auto-checkpoint (for manual invocation)
   */
  async triggerAutoCheckpoint(
    trigger: CheckpointTrigger = 'manual',
    description?: string
  ): Promise<CheckpointResult> {
    return this.autoCheckpoint.triggerCheckpoint(trigger, description);
  }

  /**
   * Update progress for milestone tracking
   */
  updateProgress(taskId: string, progressPercent: number): void {
    this.autoCheckpoint.updateProgress(taskId, progressPercent);
  }

  /**
   * Called before a risky operation
   */
  async beforeRiskyOperation(
    operation: string
  ): Promise<{ checkpointId?: string; skipped: boolean }> {
    return this.autoCheckpoint.beforeOperation(operation);
  }

  /**
   * Perform a health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    lastCheckpoint?: string;
  }> {
    const recoveryHealth = await this.recoveryManager.healthCheck();
    const latest = await this.getLatestCheckpoint();

    const issues: string[] = [...recoveryHealth.issues];

    // Check if we have recent checkpoints
    if (latest) {
      const ageMs = Date.now() - latest.createdAt;
      const oneHour = 60 * 60 * 1000;
      if (ageMs > oneHour) {
        issues.push(`Latest checkpoint is ${Math.round(ageMs / 60000)} minutes old`);
      }
    } else {
      issues.push('No checkpoints exist');
    }

    return {
      healthy: issues.length === 0,
      issues,
      lastCheckpoint: latest?.id,
    };
  }

  /**
   * Close the checkpoint manager
   */
  async close(): Promise<void> {
    this.autoCheckpoint.stop();
    this.initialized = false;
  }

  /**
   * Ensure the manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new CheckpointManagerError(
        'CheckpointManager not initialized. Call init() first.'
      );
    }
  }
}
