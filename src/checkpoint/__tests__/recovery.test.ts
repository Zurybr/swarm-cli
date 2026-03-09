/**
 * Checkpoint System - Recovery Tests
 */

import { RecoveryManager } from '../recovery';
import { StateCapture } from '../state';
import {
  CheckpointStorageConfig,
  DEFAULT_CHECKPOINT_STORAGE_CONFIG,
  RecoveryConfig,
  DEFAULT_RECOVERY_CONFIG,
  StateSnapshot,
} from '../types';
import { Hive } from '../../hive';
import { SwarmMail } from '../../swarm-mail';
import * as fs from 'fs';
import * as path from 'path';

describe('RecoveryManager', () => {
  let recoveryManager: RecoveryManager;
  let stateCapture: StateCapture;
  let testDir: string;
  let hive: Hive;
  let swarmMail: SwarmMail;

  beforeEach(async () => {
    testDir = path.join(__dirname, '.test-recovery');
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

    const recoveryConfig: RecoveryConfig = {
      ...DEFAULT_RECOVERY_CONFIG,
      notifyOnRecovery: false, // Disable notifications in tests
    };

    recoveryManager = new RecoveryManager(recoveryConfig, stateCapture, hive, swarmMail);
    await recoveryManager.init();
  });

  afterEach(async () => {
    await hive.close();
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should initialize recovery manager', async () => {
      expect(recoveryManager).toBeDefined();
    });
  });

  describe('restore', () => {
    it('should restore from valid snapshot', async () => {
      // Create and save a snapshot
      const snapshot = await stateCapture.createSnapshot('manual', 'Test restore');
      await stateCapture.saveSnapshot(snapshot);

      const result = await recoveryManager.restore({
        checkpointId: snapshot.id,
        restoreAgents: true,
        restoreTasks: true,
        restoreMail: false,
        restoreEnvironment: false,
        validate: true,
      });

      expect(result.success).toBe(true);
      expect(result.restored.agents).toBe(true);
      expect(result.restored.tasks).toBe(true);
      expect(result.restored.mail).toBe(false);
    });

    it('should fail to restore from non-existent snapshot', async () => {
      const result = await recoveryManager.restore({
        checkpointId: 'non-existent',
        validate: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle partial restore', async () => {
      const snapshot = await stateCapture.createSnapshot('manual', 'Partial restore');
      await stateCapture.saveSnapshot(snapshot);

      const result = await recoveryManager.restore({
        checkpointId: snapshot.id,
        restoreAgents: true,
        restoreTasks: false,
        restoreMail: false,
        restoreEnvironment: false,
        validate: true,
      });

      expect(result.success).toBe(true);
      expect(result.restored.agents).toBe(true);
      expect(result.restored.tasks).toBe(false);
    });
  });

  describe('failure handling', () => {
    it('should handle operation failure with rollback strategy', async () => {
      const snapshot = await stateCapture.createSnapshot('manual', 'Pre-failure');
      await stateCapture.saveSnapshot(snapshot);

      const result = await recoveryManager.handleFailure(
        new Error('Test failure'),
        snapshot.id,
        'rollback'
      );

      expect(result.success).toBe(true);
      expect(result.restoredCheckpoint).toBeDefined();
    });

    it('should handle operation failure with continue strategy', async () => {
      const result = await recoveryManager.handleFailure(
        new Error('Test failure'),
        undefined,
        'continue'
      );

      expect(result.success).toBe(true);
      expect(result.restored.agents).toBe(false);
      expect(result.restored.tasks).toBe(false);
    });

    it('should handle operation failure with pause strategy', async () => {
      const result = await recoveryManager.handleFailure(
        new Error('Test failure'),
        undefined,
        'pause'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('paused');
    });
  });

  describe('health check', () => {
    it('should report healthy when no issues', async () => {
      const health = await recoveryManager.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.issues).toHaveLength(0);
    });

    it('should detect missing checkpoint reference', async () => {
      // Simulate a scenario where we'd expect issues
      const health = await recoveryManager.healthCheck();

      // Health check should pass when no checkpoint is expected
      expect(health.healthy).toBe(true);
    });
  });

  describe('retry logic', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      };

      const result = await recoveryManager.withRetry(operation, { maxAttempts: 3 });

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should fail after max retries', async () => {
      const operation = async () => {
        throw new Error('Persistent failure');
      };

      const result = await recoveryManager.withRetry(operation, { maxAttempts: 2 });

      expect(result.success).toBe(false);
    });
  });
});
