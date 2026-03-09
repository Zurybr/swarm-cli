/**
 * Checkpoint System - Recovery
 * Handles failure recovery and state restoration
 */

import { StateCapture } from './state';
import { Hive } from '../hive';
import { SwarmMail } from '../swarm-mail';
import {
  RestoreOptions,
  RestoreResult,
  RecoveryConfig,
  DEFAULT_RECOVERY_CONFIG,
  RecoveryStrategy,
  StateSnapshot,
} from './types';

/**
 * Error thrown when recovery operations fail
 */
export class RecoveryError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'RecoveryError';
  }
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  issues: string[];
  lastCheckpointId?: string;
  checkpointAge?: number;
}

/**
 * Retry options
 */
export interface RetryOptions {
  maxAttempts: number;
  delayMs?: number;
  backoffMultiplier?: number;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
};

/**
 * Manages recovery from failures and state restoration
 */
export class RecoveryManager {
  private config: RecoveryConfig;
  private stateCapture: StateCapture;
  private hive: Hive;
  private swarmMail: SwarmMail;
  private initialized: boolean = false;
  private lastCheckpointId?: string;

  constructor(
    config: Partial<RecoveryConfig> = {},
    stateCapture: StateCapture,
    hive: Hive,
    swarmMail: SwarmMail
  ) {
    this.config = { ...DEFAULT_RECOVERY_CONFIG, ...config };
    this.stateCapture = stateCapture;
    this.hive = hive;
    this.swarmMail = swarmMail;
  }

  /**
   * Initialize the recovery manager
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Ensure state capture is initialized
    await this.stateCapture.init();

    this.initialized = true;
  }

  /**
   * Restore state from a checkpoint
   */
  async restore(options: RestoreOptions): Promise<RestoreResult> {
    this.ensureInitialized();

    const startTime = Date.now();
    const restored = {
      agents: false,
      tasks: false,
      mail: false,
      environment: false,
    };

    try {
      // Load the snapshot
      const snapshot = await this.stateCapture.loadSnapshot(options.checkpointId);

      if (!snapshot) {
        return {
          success: false,
          error: `Checkpoint not found: ${options.checkpointId}`,
          restored,
          durationMs: Date.now() - startTime,
        };
      }

      // Validate if requested
      if (options.validate) {
        const valid = await this.stateCapture.validateSnapshot(snapshot);
        if (!valid) {
          return {
            success: false,
            error: `Invalid or corrupted checkpoint: ${options.checkpointId}`,
            restored,
            durationMs: Date.now() - startTime,
          };
        }
      }

      // Restore agents
      if (options.restoreAgents !== false) {
        await this.restoreAgents(snapshot);
        restored.agents = true;
      }

      // Restore tasks
      if (options.restoreTasks !== false) {
        await this.restoreTasks(snapshot);
        restored.tasks = true;
      }

      // Restore mail state
      if (options.restoreMail) {
        await this.restoreMail(snapshot);
        restored.mail = true;
      }

      // Restore environment (just log for now)
      if (options.restoreEnvironment) {
        restored.environment = true;
      }

      this.lastCheckpointId = options.checkpointId;

      return {
        success: true,
        restoredCheckpoint: {
          id: options.checkpointId,
          snapshotId: snapshot.id,
          status: 'restored',
          createdAt: snapshot.createdAt,
          trigger: snapshot.trigger,
          sizeBytes: 0,
          restoredAt: Date.now(),
        },
        restored,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: `Restore failed: ${(error as Error).message}`,
        restored,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Restore agent states
   */
  private async restoreAgents(snapshot: StateSnapshot): Promise<void> {
    // For now, just log the restoration
    // In a full implementation, this would notify agents of their restored state
    for (const agent of snapshot.agents) {
      console.log(`Restoring agent ${agent.agentName} to progress ${agent.progressPercent}%`);
    }
  }

  /**
   * Restore task states
   */
  private async restoreTasks(snapshot: StateSnapshot): Promise<void> {
    // Restore cells from snapshot
    for (const task of snapshot.tasks) {
      try {
        const existingCell = await this.hive.getCell(task.cellId);
        if (existingCell) {
          // Update existing cell
          await this.hive.updateCell(task.cellId, {
            status: task.cellData.status,
            owner: task.cellData.owner,
          });
        } else {
          // Cell doesn't exist, would need to recreate
          console.log(`Task ${task.cellId} no longer exists, skipping restore`);
        }
      } catch (error) {
        console.warn(`Failed to restore task ${task.cellId}:`, error);
      }
    }
  }

  /**
   * Restore mail state
   */
  private async restoreMail(snapshot: StateSnapshot): Promise<void> {
    // For now, just log
    // In a full implementation, this would restore messages and reservations
    console.log(`Restoring ${snapshot.mail.messages.length} messages`);
    console.log(`Restoring ${snapshot.mail.reservations.length} reservations`);
  }

  /**
   * Handle a failure with appropriate recovery strategy
   */
  async handleFailure(
    error: Error,
    checkpointId?: string,
    strategy?: RecoveryStrategy
  ): Promise<RestoreResult> {
    const useStrategy = strategy || this.config.defaultStrategy;

    console.log(`Handling failure with strategy: ${useStrategy}`);

    switch (useStrategy) {
      case 'rollback':
        if (checkpointId) {
          // Create a safety checkpoint before rollback if configured
          if (this.config.checkpointBeforeRecovery) {
            await this.createSafetyCheckpoint();
          }
          return this.restore({
            checkpointId,
            restoreAgents: true,
            restoreTasks: true,
            validate: true,
          });
        }
        return {
          success: false,
          error: 'No checkpoint provided for rollback',
          restored: { agents: false, tasks: false, mail: false, environment: false },
        };

      case 'continue':
        // Log the error but continue
        console.warn('Continuing despite error:', error.message);
        return {
          success: true,
          restored: { agents: false, tasks: false, mail: false, environment: false },
        };

      case 'pause':
        // Pause and notify
        if (this.config.notifyOnRecovery) {
          this.swarmMail.sendBlocker(
            'Recovery Paused',
            `Operation paused due to error: ${error.message}`,
            'coordinator',
            { checkpointId, strategy: useStrategy }
          );
        }
        return {
          success: false,
          error: `Operation paused: ${error.message}`,
          restored: { agents: false, tasks: false, mail: false, environment: false },
        };

      case 'notify':
        // Just notify, don't take action
        if (this.config.notifyOnRecovery) {
          this.swarmMail.sendSystemEvent(
            'Recovery Notification',
            `Error occurred: ${error.message}`,
            'coordinator',
            { checkpointId, strategy: useStrategy }
          );
        }
        return {
          success: false,
          error: `Error notified: ${error.message}`,
          restored: { agents: false, tasks: false, mail: false, environment: false },
        };

      default:
        return {
          success: false,
          error: `Unknown recovery strategy: ${useStrategy}`,
          restored: { agents: false, tasks: false, mail: false, environment: false },
        };
    }
  }

  /**
   * Create a safety checkpoint before recovery operations
   */
  private async createSafetyCheckpoint(): Promise<void> {
    try {
      const snapshot = await this.stateCapture.createSnapshot(
        'pre_operation',
        'Safety checkpoint before recovery'
      );
      await this.stateCapture.saveSnapshot(snapshot);
      console.log(`Created safety checkpoint: ${snapshot.id}`);
    } catch (error) {
      console.warn('Failed to create safety checkpoint:', error);
    }
  }

  /**
   * Execute an operation with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        const result = await operation();
        return { success: true, result };
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt}/${opts.maxAttempts} failed:`, lastError.message);

        if (attempt < opts.maxAttempts) {
          // Wait before retry with exponential backoff
          const delay = (opts.delayMs || 1000) * Math.pow(opts.backoffMultiplier || 2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: `Failed after ${opts.maxAttempts} attempts: ${lastError?.message}`,
    };
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Perform a health check on the system
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const issues: string[] = [];

    // Check if we have a recent checkpoint
    if (this.lastCheckpointId) {
      const snapshot = await this.stateCapture.loadSnapshot(this.lastCheckpointId);
      if (!snapshot) {
        issues.push(`Last checkpoint ${this.lastCheckpointId} no longer exists`);
      }
    }

    // Check Hive connectivity
    try {
      await this.hive.getStats();
    } catch (error) {
      issues.push('Hive connectivity issue');
    }

    return {
      healthy: issues.length === 0,
      issues,
      lastCheckpointId: this.lastCheckpointId,
    };
  }

  /**
   * Get the last checkpoint ID used
   */
  getLastCheckpointId(): string | undefined {
    return this.lastCheckpointId;
  }

  /**
   * Set the last checkpoint ID
   */
  setLastCheckpointId(id: string): void {
    this.lastCheckpointId = id;
  }

  /**
   * Ensure recovery manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new RecoveryError('RecoveryManager not initialized. Call init() first.');
    }
  }
}
