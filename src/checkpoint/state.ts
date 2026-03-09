/**
 * Checkpoint System - State Capture
 * Captures and restores swarm state snapshots
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

import { Hive } from '../hive';
import { SwarmMail } from '../swarm-mail';
import {
  StateSnapshot,
  AgentSnapshot,
  TaskSnapshot,
  MailSnapshot,
  EnvironmentSnapshot,
  CheckpointTrigger,
  CheckpointStorageConfig,
  DEFAULT_CHECKPOINT_STORAGE_CONFIG,
} from './types';

const execAsync = promisify(exec);

/**
 * Error thrown when state operations fail
 */
export class StateCaptureError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'StateCaptureError';
  }
}

/**
 * Manages capturing and restoring swarm state
 */
export class StateCapture {
  private config: CheckpointStorageConfig;
  private hive: Hive;
  private swarmMail: SwarmMail;
  private snapshotsDir: string;
  private initialized: boolean = false;

  constructor(
    config: Partial<CheckpointStorageConfig> = {},
    hive: Hive,
    swarmMail: SwarmMail
  ) {
    this.config = { ...DEFAULT_CHECKPOINT_STORAGE_CONFIG, ...config };
    this.hive = hive;
    this.swarmMail = swarmMail;
    this.snapshotsDir = path.join(this.config.baseDir, 'snapshots');
  }

  /**
   * Initialize state capture directories
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    await this.ensureDir(this.config.baseDir);
    await this.ensureDir(this.snapshotsDir);

    this.initialized = true;
  }

  /**
   * Ensure a directory exists
   */
  private async ensureDir(dir: string): Promise<void> {
    try {
      await fs.promises.mkdir(dir, { recursive: true });
    } catch (error) {
      throw new StateCaptureError(`Failed to create directory: ${dir}`, error as Error);
    }
  }

  /**
   * Generate a unique snapshot ID
   */
  private generateSnapshotId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `snap-${timestamp}-${random}`;
  }

  /**
   * Get the path to a snapshot file
   */
  private getSnapshotPath(snapshotId: string): string {
    // Use first 4 chars of ID as subdirectory for better file distribution
    const prefix = snapshotId.substring(5, 9); // After 'snap-'
    const dir = path.join(this.snapshotsDir, prefix);
    return path.join(dir, `${snapshotId}.json`);
  }

  /**
   * Capture environment state
   */
  async captureEnvironment(): Promise<EnvironmentSnapshot> {
    const timestamp = Date.now();
    const workingDirectory = process.cwd();

    // Get git info if available
    let gitCommitHash: string | undefined;
    let gitBranch: string | undefined;

    try {
      const { stdout: hashStdout } = await execAsync('git rev-parse HEAD');
      gitCommitHash = hashStdout.trim();

      const { stdout: branchStdout } = await execAsync('git rev-parse --abbrev-ref HEAD');
      gitBranch = branchStdout.trim();
    } catch {
      // Git not available or not in a repo
    }

    // Capture filtered environment variables
    const envVars: Record<string, string> = {};
    const allowedPrefixes = ['NODE_', 'SWARM_', 'HIVE_', 'PATH', 'HOME', 'USER'];
    for (const [key, value] of Object.entries(process.env)) {
      if (value && allowedPrefixes.some(prefix => key.startsWith(prefix))) {
        envVars[key] = value;
      }
    }

    return {
      workingDirectory,
      gitCommitHash,
      gitBranch,
      envVars,
      timestamp,
    };
  }

  /**
   * Capture agent states
   */
  async captureAgents(agentNames: string[]): Promise<AgentSnapshot[]> {
    const agents: AgentSnapshot[] = [];

    for (const agentName of agentNames) {
      // Get messages for this agent to determine current state
      const messages = this.swarmMail.getInbox({});
      const agentMessages = messages.filter(
        m => m.from === agentName || m.to === agentName || (Array.isArray(m.to) && m.to.includes(agentName))
      );

      // Get reservations for this agent
      const reservations = this.swarmMail.getMyReservations();

      // Calculate progress from messages
      let progressPercent = 0;
      const progressMessages = agentMessages.filter(m => m.type === 'progress');
      if (progressMessages.length > 0) {
        const latest = progressMessages[progressMessages.length - 1];
        if (latest.metadata?.progressPercent) {
          progressPercent = latest.metadata.progressPercent;
        }
      }

      // Determine current task from messages
      let currentTask: string | undefined;
      const taskMessages = agentMessages.filter(m => m.metadata?.taskId);
      if (taskMessages.length > 0) {
        currentTask = taskMessages[taskMessages.length - 1].metadata?.taskId as string;
      }

      agents.push({
        agentName,
        currentTask,
        progressPercent,
        state: {
          messageCount: agentMessages.length,
          reservationCount: reservations.length,
          lastActivity: agentMessages.length > 0
            ? Math.max(...agentMessages.map(m => m.timestamp))
            : undefined,
        },
        timestamp: Date.now(),
      });
    }

    return agents;
  }

  /**
   * Capture task/cell states from Hive
   */
  async captureTasks(cellIds?: string[]): Promise<TaskSnapshot[]> {
    const tasks: TaskSnapshot[] = [];

    if (cellIds && cellIds.length > 0) {
      // Capture specific cells
      for (const cellId of cellIds) {
        const cell = await this.hive.getCell(cellId);
        if (cell) {
          tasks.push({
            cellId: cell.id,
            cellData: cell.toData(),
            epicId: cell.parentId,
            owner: cell.owner,
          });
        }
      }
    } else {
      // Capture all cells
      const cells = await this.hive.getAllCells();
      for (const cell of cells) {
        tasks.push({
          cellId: cell.id,
          cellData: cell.toData(),
          epicId: cell.parentId,
          owner: cell.owner,
        });
      }
    }

    return tasks;
  }

  /**
   * Capture mail state
   */
  async captureMail(): Promise<MailSnapshot> {
    // Get all messages
    const inbox = this.swarmMail.getInbox({});
    const outbox = this.swarmMail.getOutbox({});
    const broadcasts = this.swarmMail.getBroadcasts({});

    // Combine and deduplicate
    const messageIds = new Set<string>();
    const messages = [...inbox, ...outbox, ...broadcasts].filter(m => {
      if (messageIds.has(m.id)) return false;
      messageIds.add(m.id);
      return true;
    });

    // Get active reservations
    const reservations = this.swarmMail.getMyReservations();

    // Get active threads
    const threads = this.swarmMail.getMyThreads();
    const activeThreads = threads.map(t => t.id);

    return {
      messages,
      reservations,
      activeThreads,
    };
  }

  /**
   * Create a full state snapshot
   */
  async createSnapshot(
    trigger: CheckpointTrigger,
    description?: string,
    options?: {
      agentFilter?: string[];
      taskFilter?: string[];
    }
  ): Promise<StateSnapshot> {
    this.ensureInitialized();

    const id = this.generateSnapshotId();
    const timestamp = Date.now();

    // Capture all state components
    const [environment, agents, tasks, mail] = await Promise.all([
      this.captureEnvironment(),
      this.captureAgents(options?.agentFilter ?? ['default-agent']),
      this.captureTasks(options?.taskFilter),
      this.captureMail(),
    ]);

    return {
      version: '1.0.0',
      id,
      createdAt: timestamp,
      trigger,
      description,
      agents,
      tasks,
      mail,
      environment,
    };
  }

  /**
   * Save a snapshot to disk
   */
  async saveSnapshot(snapshot: StateSnapshot): Promise<boolean> {
    try {
      const snapshotPath = this.getSnapshotPath(snapshot.id);
      const dir = path.dirname(snapshotPath);

      await this.ensureDir(dir);

      let data: string;
      if (this.config.compressSnapshots) {
        // For now, just stringify. Compression can be added later
        data = JSON.stringify(snapshot);
      } else {
        data = JSON.stringify(snapshot, null, 2);
      }

      // Write to temp file first, then rename for atomicity
      const tempPath = `${snapshotPath}.tmp`;
      await fs.promises.writeFile(tempPath, data, 'utf-8');
      await fs.promises.rename(tempPath, snapshotPath);

      return true;
    } catch (error) {
      console.error('Failed to save snapshot:', error);
      return false;
    }
  }

  /**
   * Load a snapshot from disk
   */
  async loadSnapshot(snapshotId: string): Promise<StateSnapshot | null> {
    try {
      const snapshotPath = this.getSnapshotPath(snapshotId);

      if (!fs.existsSync(snapshotPath)) {
        return null;
      }

      const data = await fs.promises.readFile(snapshotPath, 'utf-8');
      return JSON.parse(data) as StateSnapshot;
    } catch (error) {
      console.error('Failed to load snapshot:', error);
      return null;
    }
  }

  /**
   * Delete a snapshot from disk
   */
  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    try {
      const snapshotPath = this.getSnapshotPath(snapshotId);

      if (!fs.existsSync(snapshotPath)) {
        return false;
      }

      await fs.promises.unlink(snapshotPath);

      // Try to clean up empty parent directory
      const dir = path.dirname(snapshotPath);
      try {
        const files = await fs.promises.readdir(dir);
        if (files.length === 0) {
          await fs.promises.rmdir(dir);
        }
      } catch {
        // Ignore cleanup errors
      }

      return true;
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
      return false;
    }
  }

  /**
   * List all available snapshots
   */
  async listSnapshots(): Promise<StateSnapshot[]> {
    const snapshots: StateSnapshot[] = [];

    try {
      if (!fs.existsSync(this.snapshotsDir)) {
        return snapshots;
      }

      const prefixes = await fs.promises.readdir(this.snapshotsDir);

      for (const prefix of prefixes) {
        const prefixDir = path.join(this.snapshotsDir, prefix);
        const stat = await fs.promises.stat(prefixDir);

        if (stat.isDirectory()) {
          const files = await fs.promises.readdir(prefixDir);
          for (const file of files) {
            if (file.endsWith('.json')) {
              const snapshotId = file.replace('.json', '');
              const snapshot = await this.loadSnapshot(snapshotId);
              if (snapshot) {
                snapshots.push(snapshot);
              }
            }
          }
        }
      }

      // Sort by creation time, newest first
      snapshots.sort((a, b) => b.createdAt - a.createdAt);

      return snapshots;
    } catch (error) {
      console.error('Failed to list snapshots:', error);
      return snapshots;
    }
  }

  /**
   * Validate snapshot integrity
   */
  async validateSnapshot(snapshot: StateSnapshot): Promise<boolean> {
    // Check required fields
    if (!snapshot.version || !snapshot.id || !snapshot.createdAt) {
      return false;
    }

    // Check version compatibility
    if (!snapshot.version.startsWith('1.')) {
      return false;
    }

    // Check required components
    if (!snapshot.environment || !snapshot.agents || !snapshot.tasks || !snapshot.mail) {
      return false;
    }

    // Validate environment
    if (!snapshot.environment.workingDirectory || !snapshot.environment.timestamp) {
      return false;
    }

    return true;
  }

  /**
   * Get the size of a snapshot in bytes
   */
  async getSnapshotSize(snapshotId: string): Promise<number> {
    try {
      const snapshotPath = this.getSnapshotPath(snapshotId);
      const stat = await fs.promises.stat(snapshotPath);
      return stat.size;
    } catch {
      return 0;
    }
  }

  /**
   * Ensure state capture is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new StateCaptureError('StateCapture not initialized. Call init() first.');
    }
  }

  /**
   * Get the snapshots directory path
   */
  getSnapshotsDir(): string {
    return this.snapshotsDir;
  }

  /**
   * Get the base directory path
   */
  getBaseDir(): string {
    return this.config.baseDir;
  }
}
