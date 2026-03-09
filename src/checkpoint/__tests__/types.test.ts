/**
 * Checkpoint System - Types Tests
 */

import {
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
  DEFAULT_AUTO_CHECKPOINT_CONFIG,
  DEFAULT_RECOVERY_CONFIG,
  DEFAULT_CHECKPOINT_STORAGE_CONFIG,
} from '../types';

describe('Checkpoint Types', () => {
  describe('Default Configurations', () => {
    it('should have sensible auto-checkpoint defaults', () => {
      expect(DEFAULT_AUTO_CHECKPOINT_CONFIG.enabled).toBe(true);
      expect(DEFAULT_AUTO_CHECKPOINT_CONFIG.intervalMs).toBe(5 * 60 * 1000); // 5 min
      expect(DEFAULT_AUTO_CHECKPOINT_CONFIG.onMilestones).toBe(true);
      expect(DEFAULT_AUTO_CHECKPOINT_CONFIG.milestonePercentages).toEqual([25, 50, 75, 90, 100]);
      expect(DEFAULT_AUTO_CHECKPOINT_CONFIG.onRiskyOperations).toBe(true);
      expect(DEFAULT_AUTO_CHECKPOINT_CONFIG.riskyOperations).toContain('git.push');
      expect(DEFAULT_AUTO_CHECKPOINT_CONFIG.maxCheckpoints).toBe(10);
      expect(DEFAULT_AUTO_CHECKPOINT_CONFIG.minIntervalMs).toBe(30 * 1000); // 30 sec
    });

    it('should have sensible recovery defaults', () => {
      expect(DEFAULT_RECOVERY_CONFIG.defaultStrategy).toBe('rollback');
      expect(DEFAULT_RECOVERY_CONFIG.autoRetryCount).toBe(1);
      expect(DEFAULT_RECOVERY_CONFIG.notifyOnRecovery).toBe(true);
      expect(DEFAULT_RECOVERY_CONFIG.checkpointBeforeRecovery).toBe(true);
    });

    it('should have sensible storage defaults', () => {
      expect(DEFAULT_CHECKPOINT_STORAGE_CONFIG.baseDir).toBe('.checkpoints');
      expect(DEFAULT_CHECKPOINT_STORAGE_CONFIG.compressSnapshots).toBe(true);
      expect(DEFAULT_CHECKPOINT_STORAGE_CONFIG.maxSnapshots).toBe(50);
      expect(DEFAULT_CHECKPOINT_STORAGE_CONFIG.retentionDays).toBe(7);
    });
  });

  describe('Type Interfaces', () => {
    it('should create a valid checkpoint', () => {
      const checkpoint: Checkpoint = {
        id: 'chk-123',
        snapshotId: 'snap-456',
        status: 'valid' as CheckpointStatus,
        createdAt: Date.now(),
        trigger: 'manual' as CheckpointTrigger,
        sizeBytes: 1024,
        description: 'Test checkpoint',
      };

      expect(checkpoint.id).toBe('chk-123');
      expect(checkpoint.status).toBe('valid');
      expect(checkpoint.trigger).toBe('manual');
    });

    it('should create a valid state snapshot', () => {
      const snapshot: StateSnapshot = {
        version: '1.0.0',
        id: 'snap-123',
        createdAt: Date.now(),
        trigger: 'manual' as CheckpointTrigger,
        description: 'Test snapshot',
        agents: [],
        tasks: [],
        mail: {
          messages: [],
          reservations: [],
          activeThreads: [],
        },
        environment: {
          workingDirectory: '/test',
          gitCommitHash: 'abc123',
          gitBranch: 'main',
          envVars: {},
          timestamp: Date.now(),
        },
      };

      expect(snapshot.version).toBe('1.0.0');
      expect(snapshot.agents).toEqual([]);
      expect(snapshot.mail.messages).toEqual([]);
    });

    it('should create valid agent snapshot', () => {
      const agent: AgentSnapshot = {
        agentName: 'worker-1',
        currentTask: 'task-123',
        progressPercent: 50,
        state: { key: 'value' },
        timestamp: Date.now(),
      };

      expect(agent.agentName).toBe('worker-1');
      expect(agent.progressPercent).toBe(50);
    });

    it('should create valid checkpoint options', () => {
      const options: CreateCheckpointOptions = {
        trigger: 'auto_interval',
        description: 'Auto checkpoint',
        tags: ['auto', 'interval'],
      };

      expect(options.trigger).toBe('auto_interval');
      expect(options.tags).toContain('auto');
    });

    it('should create valid restore options', () => {
      const options: RestoreOptions = {
        checkpointId: 'chk-123',
        restoreAgents: true,
        restoreTasks: true,
        restoreMail: false,
        restoreEnvironment: true,
        validate: true,
      };

      expect(options.checkpointId).toBe('chk-123');
      expect(options.restoreAgents).toBe(true);
      expect(options.restoreMail).toBe(false);
    });

    it('should create valid checkpoint result', () => {
      const result: CheckpointResult = {
        success: true,
        checkpoint: {
          id: 'chk-123',
          snapshotId: 'snap-456',
          status: 'valid',
          createdAt: Date.now(),
          trigger: 'manual',
          sizeBytes: 1024,
        },
        durationMs: 100,
      };

      expect(result.success).toBe(true);
      expect(result.durationMs).toBe(100);
    });

    it('should create valid restore result', () => {
      const result: RestoreResult = {
        success: true,
        restored: {
          agents: true,
          tasks: true,
          mail: false,
          environment: true,
        },
        durationMs: 200,
      };

      expect(result.success).toBe(true);
      expect(result.restored.agents).toBe(true);
      expect(result.restored.mail).toBe(false);
    });

    it('should create valid checkpoint query', () => {
      const query: CheckpointQuery = {
        status: 'valid',
        trigger: 'manual',
        tags: ['important'],
        limit: 10,
      };

      expect(query.status).toBe('valid');
      expect(query.limit).toBe(10);
    });
  });
});
