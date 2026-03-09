/**
 * Checkpoint System - Auto Checkpoint
 * Automatic checkpoint triggers based on intervals, milestones, and risky operations
 */

import { StateCapture } from './state';
import {
  CheckpointTrigger,
  AutoCheckpointConfig,
  DEFAULT_AUTO_CHECKPOINT_CONFIG,
  CheckpointResult,
  Checkpoint,
} from './types';

/**
 * Error thrown when auto-checkpoint operations fail
 */
export class AutoCheckpointError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'AutoCheckpointError';
  }
}

/**
 * Progress tracking entry for a task
 */
interface ProgressEntry {
  taskId: string;
  progressPercent: number;
  lastCheckpointPercent: number;
  updatedAt: number;
}

/**
 * Manages automatic checkpoint creation based on triggers
 */
export class AutoCheckpoint {
  private config: AutoCheckpointConfig;
  private stateCapture: StateCapture;
  private initialized: boolean = false;
  private intervalId?: NodeJS.Timeout;
  private progressMap: Map<string, ProgressEntry> = new Map();
  private checkpoints: Checkpoint[] = [];
  private lastCheckpointTime: number = 0;
  private checkpointCount: number = 0;

  constructor(
    config: Partial<AutoCheckpointConfig> = {},
    stateCapture: StateCapture
  ) {
    this.config = { ...DEFAULT_AUTO_CHECKPOINT_CONFIG, ...config };
    this.stateCapture = stateCapture;
  }

  /**
   * Initialize the auto-checkpoint system
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Ensure state capture is initialized
    await this.stateCapture.init();

    // Start interval-based checkpointing if enabled
    if (this.config.enabled && this.config.intervalMs > 0) {
      this.startInterval();
    }

    this.initialized = true;
  }

  /**
   * Start the interval timer for automatic checkpoints
   */
  private startInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(async () => {
      if (this.shouldCreateCheckpoint()) {
        await this.triggerCheckpoint('auto_interval');
      }
    }, this.config.intervalMs);

    // Prevent the interval from keeping the process alive
    if (this.intervalId.unref) {
      this.intervalId.unref();
    }
  }

  /**
   * Stop the interval timer
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Check if auto-checkpointing is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check if enough time has passed since last checkpoint
   */
  private shouldCreateCheckpoint(): boolean {
    if (!this.config.enabled) return false;

    const now = Date.now();
    return now - this.lastCheckpointTime >= this.config.minIntervalMs;
  }

  /**
   * Manually trigger a checkpoint
   */
  async triggerCheckpoint(
    trigger: CheckpointTrigger,
    description?: string
  ): Promise<CheckpointResult> {
    const startTime = Date.now();

    // Check minimum interval (all triggers except pre_operation)
    if (trigger !== 'pre_operation') {
      if (startTime - this.lastCheckpointTime < this.config.minIntervalMs) {
        return {
          success: false,
          error: `minimum interval of ${this.config.minIntervalMs}ms not met`,
          durationMs: 0,
        };
      }
    }

    try {
      // Create snapshot
      const snapshot = await this.stateCapture.createSnapshot(
        trigger,
        description || `Auto checkpoint (${trigger})`
      );

      // Save snapshot
      const saved = await this.stateCapture.saveSnapshot(snapshot);
      if (!saved) {
        return {
          success: false,
          error: 'Failed to save snapshot',
          durationMs: Date.now() - startTime,
        };
      }

      // Get snapshot size
      const sizeBytes = await this.stateCapture.getSnapshotSize(snapshot.id);

      // Create checkpoint record
      const checkpoint: Checkpoint = {
        id: `chk-${Date.now().toString(36)}`,
        snapshotId: snapshot.id,
        status: 'valid',
        createdAt: snapshot.createdAt,
        trigger,
        description,
        sizeBytes,
      };

      this.checkpoints.push(checkpoint);
      this.checkpointCount++;
      this.lastCheckpointTime = Date.now();

      // Enforce max checkpoints
      await this.enforceMaxCheckpoints();

      return {
        success: true,
        checkpoint,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: `Checkpoint failed: ${(error as Error).message}`,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Update progress for a task and check for milestone crossing
   */
  updateProgress(taskId: string, progressPercent: number): CheckpointResult | null {
    const now = Date.now();
    const existing = this.progressMap.get(taskId);

    if (existing) {
      // Check if we crossed a milestone
      if (this.config.onMilestones && this.shouldCheckpointForMilestone(
        existing.progressPercent,
        progressPercent
      )) {
        existing.lastCheckpointPercent = progressPercent;
        existing.progressPercent = progressPercent;
        existing.updatedAt = now;

        // Trigger milestone checkpoint
        this.triggerCheckpoint('auto_milestone', `Milestone reached: ${progressPercent}%`)
          .catch(console.error);
      } else {
        existing.progressPercent = progressPercent;
        existing.updatedAt = now;
      }
    } else {
      this.progressMap.set(taskId, {
        taskId,
        progressPercent,
        lastCheckpointPercent: 0,
        updatedAt: now,
      });
    }

    return null;
  }

  /**
   * Check if progress crossed a milestone percentage
   */
  shouldCheckpointForMilestone(
    previousPercent: number,
    currentPercent: number
  ): boolean {
    if (!this.config.onMilestones) return false;

    for (const milestone of this.config.milestonePercentages) {
      if (previousPercent < milestone && currentPercent >= milestone) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get current progress for a task
   */
  getProgress(taskId: string): number {
    return this.progressMap.get(taskId)?.progressPercent ?? 0;
  }

  /**
   * Check if an operation is considered risky
   */
  isRiskyOperation(operation: string): boolean {
    if (!this.config.onRiskyOperations) return false;

    return this.config.riskyOperations.some(
      risky => operation === risky || operation.startsWith(risky)
    );
  }

  /**
   * Called before a potentially risky operation
   * Returns the checkpoint ID if one was created
   */
  async beforeOperation(
    operation: string
  ): Promise<{ checkpointId?: string; skipped: boolean }> {
    if (!this.isRiskyOperation(operation)) {
      return { skipped: true };
    }

    const result = await this.triggerCheckpoint(
      'pre_operation',
      `Pre-operation checkpoint: ${operation}`
    );

    if (result.success && result.checkpoint) {
      return { checkpointId: result.checkpoint.id, skipped: false };
    }

    return { skipped: false };
  }

  /**
   * Enforce maximum number of checkpoints
   */
  private async enforceMaxCheckpoints(): Promise<void> {
    if (this.checkpoints.length <= this.config.maxCheckpoints) return;

    // Sort by creation time, oldest first
    const sorted = [...this.checkpoints].sort(
      (a, b) => a.createdAt - b.createdAt
    );

    // Remove oldest checkpoints beyond the limit
    const toRemove = sorted.slice(0, sorted.length - this.config.maxCheckpoints);

    for (const checkpoint of toRemove) {
      // Delete the snapshot file
      await this.stateCapture.deleteSnapshot(checkpoint.snapshotId);

      // Remove from our list
      const index = this.checkpoints.findIndex(c => c.id === checkpoint.id);
      if (index !== -1) {
        this.checkpoints.splice(index, 1);
      }
    }
  }

  /**
   * Get all checkpoints
   */
  getCheckpoints(): Checkpoint[] {
    return [...this.checkpoints];
  }

  /**
   * Get checkpoint count
   */
  getCheckpointCount(): number {
    return this.checkpointCount;
  }

  /**
   * Get last checkpoint time
   */
  getLastCheckpointTime(): number {
    return this.lastCheckpointTime;
  }

  /**
   * Cleanup old checkpoints based on retention policy
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    const retentionMs = this.config.intervalMs * 2; // Use 2x interval as retention

    const toRemove: Checkpoint[] = [];

    for (const checkpoint of this.checkpoints) {
      if (now - checkpoint.createdAt > retentionMs) {
        toRemove.push(checkpoint);
      }
    }

    for (const checkpoint of toRemove) {
      await this.stateCapture.deleteSnapshot(checkpoint.snapshotId);
      const index = this.checkpoints.findIndex(c => c.id === checkpoint.id);
      if (index !== -1) {
        this.checkpoints.splice(index, 1);
      }
    }

    return toRemove.length;
  }

  /**
   * Get configuration
   */
  getConfig(): AutoCheckpointConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutoCheckpointConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart interval if settings changed
    if (this.config.enabled && this.config.intervalMs > 0) {
      this.startInterval();
    } else {
      this.stop();
    }
  }
}
