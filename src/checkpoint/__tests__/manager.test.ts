/**
 * Checkpoint System - Manager Integration Tests
 */

import { CheckpointManager } from '../manager';
import { Hive } from '../../hive';
import { SwarmMail } from '../../swarm-mail';
import {
  CheckpointStorageConfig,
  DEFAULT_CHECKPOINT_STORAGE_CONFIG,
} from '../types';
import * as fs from 'fs';
import * as path from 'path';

describe('CheckpointManager', () => {
  let manager: CheckpointManager;
  let testDir: string;
  let hive: Hive;
  let swarmMail: SwarmMail;

  beforeEach(async () => {
    testDir = path.join(__dirname, '.test-manager');
    await fs.promises.mkdir(testDir, { recursive: true });

    const config: CheckpointStorageConfig = {
      ...DEFAULT_CHECKPOINT_STORAGE_CONFIG,
      baseDir: testDir,
    };

    hive = new Hive({ baseDir: path.join(testDir, 'hive') });
    await hive.init();

    swarmMail = new SwarmMail({
      agentName: 'test-agent',
      storagePath: path.join(testDir, 'swarm-mail'),
    });

    manager = new CheckpointManager(hive, swarmMail, config);
    await manager.init();
  });

  afterEach(async () => {
    await manager.close();
    await hive.close();
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should initialize checkpoint manager', async () => {
      expect(manager).toBeDefined();
      expect(manager.getStateCapture()).toBeDefined();
      expect(manager.getRecoveryManager()).toBeDefined();
      expect(manager.getAutoCheckpoint()).toBeDefined();
    });
  });

  describe('checkpoint creation', () => {
    it('should create a checkpoint', async () => {
      const result = await manager.createCheckpoint({
        trigger: 'manual',
        description: 'Test checkpoint',
      });

      expect(result.success).toBe(true);
      expect(result.checkpoint).toBeDefined();
      expect(result.checkpoint?.description).toBe('Test checkpoint');
      expect(result.checkpoint?.trigger).toBe('manual');
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it('should create checkpoint with tags', async () => {
      const result = await manager.createCheckpoint({
        trigger: 'manual',
        description: 'Tagged checkpoint',
        tags: ['test', 'important'],
      });

      expect(result.success).toBe(true);
      expect(result.checkpoint?.tags).toContain('test');
      expect(result.checkpoint?.tags).toContain('important');
    });

    it('should list checkpoints', async () => {
      await manager.createCheckpoint({ trigger: 'manual', description: 'First' });
      await new Promise(resolve => setTimeout(resolve, 50));
      await manager.createCheckpoint({ trigger: 'manual', description: 'Second' });

      const checkpoints = await manager.listCheckpoints();

      expect(checkpoints.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter checkpoints by trigger', async () => {
      await manager.createCheckpoint({ trigger: 'manual', description: 'Manual' });
      await new Promise(resolve => setTimeout(resolve, 50));
      await manager.createCheckpoint({ trigger: 'pre_operation', description: 'Pre-op' });

      const manualCheckpoints = await manager.listCheckpoints({ trigger: 'manual' });
      const preOpCheckpoints = await manager.listCheckpoints({ trigger: 'pre_operation' });

      expect(manualCheckpoints.length).toBeGreaterThanOrEqual(1);
      expect(preOpCheckpoints.length).toBeGreaterThanOrEqual(1);
    });

    it('should get latest checkpoint', async () => {
      await manager.createCheckpoint({ trigger: 'manual', description: 'First' });
      await new Promise(resolve => setTimeout(resolve, 50));
      await manager.createCheckpoint({ trigger: 'manual', description: 'Latest' });

      const latest = await manager.getLatestCheckpoint();

      expect(latest).toBeDefined();
      expect(latest?.description).toBe('Latest');
    });

    it('should get checkpoint by id', async () => {
      const result = await manager.createCheckpoint({
        trigger: 'manual',
        description: 'Find me',
      });

      const checkpoint = await manager.getCheckpoint(result.checkpoint!.id);

      expect(checkpoint).toBeDefined();
      expect(checkpoint?.description).toBe('Find me');
    });
  });

  describe('checkpoint restoration', () => {
    it('should restore from checkpoint', async () => {
      // Create a cell
      const cell = await hive.createCell({
        title: 'Test Task',
        type: 'task',
        status: 'in_progress',
      });

      // Create checkpoint
      const checkpoint = await manager.createCheckpoint({
        trigger: 'manual',
        description: 'Before restore',
      });

      // Update cell
      await hive.updateCell(cell.id, { status: 'completed' });

      // Restore from checkpoint
      const result = await manager.restoreFromCheckpoint({
        checkpointId: checkpoint.checkpoint!.id,
        restoreAgents: true,
        restoreTasks: true,
        validate: true,
      });

      expect(result.success).toBe(true);
      expect(result.restored.tasks).toBe(true);
    });

    it('should fail to restore non-existent checkpoint', async () => {
      const result = await manager.restoreFromCheckpoint({
        checkpointId: 'non-existent',
        restoreTasks: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('checkpoint deletion', () => {
    it('should delete a checkpoint', async () => {
      const result = await manager.createCheckpoint({
        trigger: 'manual',
        description: 'To be deleted',
      });

      const deleted = await manager.deleteCheckpoint(result.checkpoint!.id);

      expect(deleted).toBe(true);

      const checkpoint = await manager.getCheckpoint(result.checkpoint!.id);
      expect(checkpoint).toBeUndefined();
    });

    it('should return false for non-existent checkpoint', async () => {
      const deleted = await manager.deleteCheckpoint('non-existent');
      expect(deleted).toBe(false);
    });

    it('should cleanup old checkpoints', async () => {
      // Create several checkpoints
      for (let i = 0; i < 3; i++) {
        await manager.createCheckpoint({
          trigger: 'manual',
          description: `Checkpoint ${i}`,
        });
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const beforeCount = (await manager.listCheckpoints()).length;
      expect(beforeCount).toBeGreaterThanOrEqual(3);

      // Cleanup with max count of 2
      const deleted = await manager.cleanupOldCheckpoints(undefined, 2);
      expect(deleted).toBeGreaterThanOrEqual(1);
    });
  });

  describe('checkpoint validation', () => {
    it('should validate a checkpoint', async () => {
      const result = await manager.createCheckpoint({
        trigger: 'manual',
        description: 'Valid checkpoint',
      });

      const valid = await manager.validateCheckpoint(result.checkpoint!.id);
      expect(valid).toBe(true);
    });

    it('should return false for non-existent checkpoint', async () => {
      const valid = await manager.validateCheckpoint('non-existent');
      expect(valid).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should get checkpoint statistics', async () => {
      await manager.createCheckpoint({ trigger: 'manual', description: 'Stats test' });

      const stats = await manager.getStats();

      expect(stats.totalCheckpoints).toBeGreaterThanOrEqual(1);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
      expect(stats.byTrigger.manual).toBeGreaterThanOrEqual(1);
      expect(stats.newestCheckpoint).toBeDefined();
    });
  });

  describe('health check', () => {
    it('should perform health check', async () => {
      await manager.createCheckpoint({ trigger: 'manual', description: 'Health' });

      const health = await manager.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.issues).toHaveLength(0);
      expect(health.lastCheckpoint).toBeDefined();
    });

    it('should detect missing checkpoints', async () => {
      // Create fresh manager without checkpoints
      const freshManager = new CheckpointManager(
        hive,
        new SwarmMail({
          agentName: 'fresh-agent',
          storagePath: path.join(testDir, 'fresh-swarm-mail'),
        }),
        { ...DEFAULT_CHECKPOINT_STORAGE_CONFIG, baseDir: path.join(testDir, 'fresh') }
      );
      await freshManager.init();

      const health = await freshManager.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.issues).toContain('No checkpoints exist');

      await freshManager.close();
    });
  });

  describe('auto-checkpoint integration', () => {
    it('should trigger auto checkpoint', async () => {
      const result = await manager.triggerAutoCheckpoint('manual', 'Auto test');

      expect(result.success).toBe(true);
      expect(result.checkpoint).toBeDefined();
    });

    it('should track progress for milestones', async () => {
      manager.updateProgress('task-1', 10);
      manager.updateProgress('task-1', 25); // Should trigger milestone

      // Progress should be tracked
      expect(manager.getAutoCheckpoint().getProgress('task-1')).toBe(25);
    });

    it('should create checkpoint before risky operation', async () => {
      const result = await manager.beforeRiskyOperation('git.push');

      expect(result.skipped).toBe(false);
      expect(result.checkpointId).toBeDefined();
    });

    it('should skip checkpoint for safe operations', async () => {
      const result = await manager.beforeRiskyOperation('safe.operation');

      expect(result.skipped).toBe(true);
      expect(result.checkpointId).toBeUndefined();
    });
  });

  describe('filtering', () => {
    it('should filter by status', async () => {
      await manager.createCheckpoint({ trigger: 'manual' });

      const valid = await manager.listCheckpoints({ status: 'valid' });
      expect(valid.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by time range', async () => {
      const now = Date.now();
      await manager.createCheckpoint({ trigger: 'manual' });

      const recent = await manager.listCheckpoints({
        since: now - 1000,
        until: now + 10000,
      });

      expect(recent.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect limit', async () => {
      await manager.createCheckpoint({ trigger: 'manual' });
      await new Promise(resolve => setTimeout(resolve, 50));
      await manager.createCheckpoint({ trigger: 'manual' });

      const limited = await manager.listCheckpoints({ limit: 1 });
      expect(limited.length).toBe(1);
    });
  });
});
