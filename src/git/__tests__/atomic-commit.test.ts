/**
 * Git Atomic Commit - Atomic Commit Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AtomicCommit } from '../atomic-commit';
import { TransactionManager } from '../transaction';
import { ReservationManager } from '../../swarm-mail/reservations';
import { CommitOptions } from '../types';

describe('AtomicCommit', () => {
  let atomicCommit: AtomicCommit;
  let tempDir: string;
  let storagePath: string;
  let reservationManager: ReservationManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-atomic-test-'));
    storagePath = path.join(tempDir, '.storage');

    // Initialize git repo
    const { execSync } = require('child_process');
    execSync('git init', { cwd: tempDir });
    execSync('git config user.email "test@test.com"', { cwd: tempDir });
    execSync('git config user.name "Test"', { cwd: tempDir });

    // Create initial commit
    fs.writeFileSync(path.join(tempDir, 'initial.txt'), 'initial');
    execSync('git add .', { cwd: tempDir });
    execSync('git commit -m "initial"', { cwd: tempDir });

    reservationManager = new ReservationManager(storagePath);

    atomicCommit = new AtomicCommit({
      agentName: 'test-agent',
      storagePath,
      gitPath: 'git',
      workingDirectory: tempDir,
      reservationManager,
      autoRollback: true
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('execute', () => {
    it('should execute full atomic commit flow', () => {
      // Create files to modify
      fs.writeFileSync(path.join(tempDir, 'file1.ts'), 'original 1');
      fs.writeFileSync(path.join(tempDir, 'file2.ts'), 'original 2');

      const result = atomicCommit.execute({
        paths: ['file1.ts', 'file2.ts'],
        changes: [
          { path: 'file1.ts', type: 'modify', content: 'modified 1', previousContent: 'original 1' },
          { path: 'file2.ts', type: 'modify', content: 'modified 2', previousContent: 'original 2' }
        ],
        commitOptions: {
          message: 'feat: atomic commit test'
        }
      });

      expect(result.success).toBe(true);
      expect(result.commitHash).toBeDefined();
      expect(result.transaction?.status).toBe('committed');

      // Verify files were modified
      expect(fs.readFileSync(path.join(tempDir, 'file1.ts'), 'utf-8')).toBe('modified 1');
      expect(fs.readFileSync(path.join(tempDir, 'file2.ts'), 'utf-8')).toBe('modified 2');
    });

    it('should rollback on failure', () => {
      fs.writeFileSync(path.join(tempDir, 'fail-test.ts'), 'original');

      // Create a new atomic commit instance with invalid git path to force failure
      const failingAtomicCommit = new AtomicCommit({
        agentName: 'test-agent',
        storagePath,
        gitPath: 'invalid-git-command',
        workingDirectory: tempDir,
        reservationManager,
        autoRollback: true
      });

      const result = failingAtomicCommit.execute({
        paths: ['fail-test.ts'],
        changes: [
          { path: 'fail-test.ts', type: 'modify', content: 'new', previousContent: 'original' }
        ],
        commitOptions: {
          message: 'this should fail due to invalid git'
        }
      });

      // Should fail and rollback
      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);

      // File should be restored to original content
      // Note: The rollback mechanism restores from backup which was captured before changes
      const finalContent = fs.readFileSync(path.join(tempDir, 'fail-test.ts'), 'utf-8');
      expect(finalContent).toBe('original');
    });

    it('should support adding new files', () => {
      const result = atomicCommit.execute({
        paths: ['new-file.ts'],
        changes: [
          { path: 'new-file.ts', type: 'add', content: 'new file content' }
        ],
        commitOptions: {
          message: 'feat: add new file'
        }
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'new-file.ts'))).toBe(true);
      expect(fs.readFileSync(path.join(tempDir, 'new-file.ts'), 'utf-8')).toBe('new file content');
    });

    it('should support deleting files', () => {
      // Create and commit file first so it's tracked by git
      fs.writeFileSync(path.join(tempDir, 'to-delete.ts'), 'delete me');
      const { execSync } = require('child_process');
      execSync('git add to-delete.ts', { cwd: tempDir });
      execSync('git commit -m "add file to delete"', { cwd: tempDir });

      const result = atomicCommit.execute({
        paths: ['to-delete.ts'],
        changes: [
          { path: 'to-delete.ts', type: 'delete', previousContent: 'delete me' }
        ],
        commitOptions: {
          message: 'feat: delete file'
        }
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'to-delete.ts'))).toBe(false);
    });

    it('should fail when files conflict', () => {
      // First agent begins transaction but doesn't commit (keeps reservation active)
      const txnManager1 = atomicCommit.getTransactionManager();
      const { transaction } = txnManager1.beginTransaction({
        paths: ['conflict.ts'],
        reason: 'First transaction'
      });

      // Second agent tries to reserve same files
      const atomicCommit2 = new AtomicCommit({
        agentName: 'agent-2',
        storagePath,
        gitPath: 'git',
        workingDirectory: tempDir,
        reservationManager,
        autoRollback: true
      });

      const result = atomicCommit2.execute({
        paths: ['conflict.ts'],
        changes: [{ path: 'conflict.ts', type: 'add', content: 'second' }],
        commitOptions: { message: 'second' }
      });

      expect(result.success).toBe(false);
      expect(result.error?.toLowerCase()).toContain('conflict');

      // Cleanup: rollback the first transaction
      txnManager1.rollback(transaction!.id);
    });
  });

  describe('executeAsync', () => {
    it('should execute commit asynchronously', async () => {
      fs.writeFileSync(path.join(tempDir, 'async.ts'), 'original');

      const result = await atomicCommit.executeAsync({
        paths: ['async.ts'],
        changes: [{ path: 'async.ts', type: 'modify', content: 'async modified', previousContent: 'original' }],
        commitOptions: { message: 'async commit' }
      });

      expect(result.success).toBe(true);
      expect(result.commitHash).toBeDefined();
    });
  });

  describe('batchExecute', () => {
    it('should execute multiple independent commits', () => {
      fs.writeFileSync(path.join(tempDir, 'batch1.ts'), 'original 1');
      fs.writeFileSync(path.join(tempDir, 'batch2.ts'), 'original 2');

      const results = atomicCommit.batchExecute([
        {
          paths: ['batch1.ts'],
          changes: [{ path: 'batch1.ts', type: 'modify', content: 'batch 1', previousContent: 'original 1' }],
          commitOptions: { message: 'batch 1' }
        },
        {
          paths: ['batch2.ts'],
          changes: [{ path: 'batch2.ts', type: 'modify', content: 'batch 2', previousContent: 'original 2' }],
          commitOptions: { message: 'batch 2' }
        }
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate commit request', () => {
      const result = atomicCommit.validate({
        paths: ['test.ts'],
        changes: [{ path: 'test.ts', type: 'add', content: 'test' }],
        commitOptions: { message: 'test' }
      });

      expect(result.valid).toBe(true);
    });

    it('should invalidate empty message', () => {
      const result = atomicCommit.validate({
        paths: ['test.ts'],
        changes: [{ path: 'test.ts', type: 'add', content: 'test' }],
        commitOptions: { message: '' }
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Commit message is required');
    });

    it('should invalidate mismatched paths and changes', () => {
      const result = atomicCommit.validate({
        paths: ['file-a.ts'],
        changes: [{ path: 'file-b.ts', type: 'add', content: 'test' }],
        commitOptions: { message: 'test' }
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Change path file-b.ts is not in reserved paths');
    });
  });

  describe('getStatus', () => {
    it('should return system status', () => {
      const status = atomicCommit.getStatus();

      expect(status.agentName).toBe('test-agent');
      expect(status.workingDirectory).toBe(tempDir);
      expect(status.activeTransactions).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should clean up old transactions', () => {
      // Create a transaction
      fs.writeFileSync(path.join(tempDir, 'cleanup.ts'), 'original');
      atomicCommit.execute({
        paths: ['cleanup.ts'],
        changes: [{ path: 'cleanup.ts', type: 'modify', content: 'clean', previousContent: 'original' }],
        commitOptions: { message: 'cleanup test' }
      });

      const cleaned = atomicCommit.cleanup(0);

      expect(cleaned.transactions + cleaned.snapshots).toBeGreaterThan(0);
    });
  });
});
