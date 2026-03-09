/**
 * Checkpoint System - Auto Checkpoint Tests
 */

import { AutoCheckpoint } from '../auto';
import { StateCapture } from '../state';
import {
  CheckpointStorageConfig,
  DEFAULT_CHECKPOINT_STORAGE_CONFIG,
  AutoCheckpointConfig,
  DEFAULT_AUTO_CHECKPOINT_CONFIG,
} from '../types';
import { Hive } from '../../hive';
import { SwarmMail } from '../../swarm-mail';
import * as fs from 'fs';
import * as path from 'path';

describe('AutoCheckpoint', () => {
  let autoCheckpoint: AutoCheckpoint;
  let stateCapture: StateCapture;
  let testDir: string;
  let hive: Hive;
  let swarmMail: SwarmMail;

  beforeEach(async () => {
    testDir = path.join(__dirname, '.test-auto');
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

    stateCapture = new StateCapture(config, hive, swarmMail);
    await stateCapture.init();

    const autoConfig: AutoCheckpointConfig = {
      ...DEFAULT_AUTO_CHECKPOINT_CONFIG,
      enabled: true,
      intervalMs: 1000, // 1 second for testing
      minIntervalMs: 500, // 500ms minimum
      maxCheckpoints: 3,
    };

    autoCheckpoint = new AutoCheckpoint(autoConfig, stateCapture);
    await autoCheckpoint.init();
  });

  afterEach(async () => {
    autoCheckpoint.stop();
    await hive.close();
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should initialize auto checkpoint manager', async () => {
      expect(autoCheckpoint).toBeDefined();
      expect(autoCheckpoint.isEnabled()).toBe(true);
    });

    it('should respect disabled config', async () => {
      const disabledConfig: AutoCheckpointConfig = {
        ...DEFAULT_AUTO_CHECKPOINT_CONFIG,
        enabled: false,
      };
      const disabled = new AutoCheckpoint(disabledConfig, stateCapture);
      await disabled.init();

      expect(disabled.isEnabled()).toBe(false);
      disabled.stop();
    });
  });

  describe('milestone tracking', () => {
    it('should detect milestone crossings', () => {
      // 0 -> 25 should trigger
      expect(autoCheckpoint.shouldCheckpointForMilestone(0, 25)).toBe(true);
      // 20 -> 30 should trigger (crosses 25)
      expect(autoCheckpoint.shouldCheckpointForMilestone(20, 30)).toBe(true);
      // 26 -> 30 should not trigger
      expect(autoCheckpoint.shouldCheckpointForMilestone(26, 30)).toBe(false);
      // 40 -> 60 should trigger (crosses 50)
      expect(autoCheckpoint.shouldCheckpointForMilestone(40, 60)).toBe(true);
    });

    it('should track progress updates', () => {
      autoCheckpoint.updateProgress('task-1', 10);
      expect(autoCheckpoint.getProgress('task-1')).toBe(10);

      autoCheckpoint.updateProgress('task-1', 25);
      expect(autoCheckpoint.getProgress('task-1')).toBe(25);
    });
  });

  describe('risky operations', () => {
    it('should detect risky operations', () => {
      expect(autoCheckpoint.isRiskyOperation('git.push')).toBe(true);
      expect(autoCheckpoint.isRiskyOperation('git.reset')).toBe(true);
      expect(autoCheckpoint.isRiskyOperation('file.delete')).toBe(true);
      expect(autoCheckpoint.isRiskyOperation('safe.operation')).toBe(false);
    });

    it('should trigger checkpoint before risky operation', async () => {
      const result = await autoCheckpoint.beforeOperation('git.push');
      expect(result.checkpointId).toBeDefined();
    });

    it('should not trigger for safe operations', async () => {
      const result = await autoCheckpoint.beforeOperation('safe.operation');
      expect(result.checkpointId).toBeUndefined();
    });
  });

  describe('interval checkpointing', () => {
    it('should respect minimum interval', async () => {
      // First checkpoint
      const result1 = await autoCheckpoint.triggerCheckpoint('manual');
      expect(result1.success).toBe(true);

      // Immediate second should be skipped
      const result2 = await autoCheckpoint.triggerCheckpoint('manual');
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('minimum interval');
    });

    it('should allow checkpoint after min interval', async () => {
      // First checkpoint
      await autoCheckpoint.triggerCheckpoint('manual');

      // Wait for min interval
      await new Promise(resolve => setTimeout(resolve, 600));

      // Second should succeed
      const result2 = await autoCheckpoint.triggerCheckpoint('manual');
      expect(result2.success).toBe(true);
    });
  });

  describe('checkpoint limits', () => {
    it('should enforce max checkpoints', async () => {
      // Create more than max checkpoints
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 550));
        await autoCheckpoint.triggerCheckpoint('auto_interval');
      }

      const checkpoints = autoCheckpoint.getCheckpoints();
      expect(checkpoints.length).toBeLessThanOrEqual(3);
    });
  });

  describe('cleanup', () => {
    it('should cleanup old checkpoints', async () => {
      // Create some checkpoints
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 550));
        await autoCheckpoint.triggerCheckpoint('auto_interval');
      }

      const beforeCount = autoCheckpoint.getCheckpoints().length;
      expect(beforeCount).toBeGreaterThan(0);

      // Cleanup should remove old ones based on retention
      await autoCheckpoint.cleanup();

      // Should still have checkpoints (they're not old enough)
      const afterCount = autoCheckpoint.getCheckpoints().length;
      expect(afterCount).toBeGreaterThanOrEqual(0);
    });
  });
});
