/**
 * Git Atomic Commit - Transaction Manager Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TransactionManager } from '../transaction';
import { Transaction, FileChange, CommitOptions } from '../types';
import { ReservationManager } from '../../swarm-mail/reservations';

describe('TransactionManager', () => {
  let manager: TransactionManager;
  let tempDir: string;
  let storagePath: string;
  let reservationManager: ReservationManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-txn-test-'));
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

    manager = new TransactionManager({
      agentName: 'test-agent',
      storagePath,
      gitPath: 'git',
      workingDirectory: tempDir,
      reservationManager
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('beginTransaction', () => {
    it('should create a new transaction with file reservations', () => {
      const result = manager.beginTransaction({
        paths: ['file1.ts', 'file2.ts'],
        reason: 'Test transaction'
      });

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.transaction?.status).toBe('pending');
      expect(result.transaction?.agentName).toBe('test-agent');
      expect(result.transaction?.reservations).toHaveLength(2);
    });

    it('should fail when files are already reserved by another agent', () => {
      // First reservation by test-agent
      manager.beginTransaction({
        paths: ['file1.ts'],
        reason: 'First transaction'
      });

      // Create a second manager with different agent name
      const manager2 = new TransactionManager({
        agentName: 'other-agent',
        storagePath,
        gitPath: 'git',
        workingDirectory: tempDir,
        reservationManager
      });

      // Second reservation by different agent should fail
      const result = manager2.beginTransaction({
        paths: ['file1.ts'],
        reason: 'Second transaction'
      });

      expect(result.success).toBe(false);
      expect(result.error?.toLowerCase()).toContain('conflict');
    });

    it('should generate unique transaction IDs', () => {
      const result1 = manager.beginTransaction({
        paths: ['file1.ts'],
        reason: 'First'
      });

      const result2 = manager.beginTransaction({
        paths: ['file2.ts'],
        reason: 'Second'
      });

      expect(result1.transaction?.id).not.toBe(result2.transaction?.id);
    });
  });

  describe('stageChanges', () => {
    it('should stage file modifications', () => {
      const { transaction } = manager.beginTransaction({
        paths: ['test.ts'],
        reason: 'Test'
      });

      // Create the file first
      fs.writeFileSync(path.join(tempDir, 'test.ts'), 'original');

      const changes: FileChange[] = [
        {
          path: 'test.ts',
          type: 'modify',
          content: 'modified content',
          previousContent: 'original'
        }
      ];

      const result = manager.stageChanges(transaction!.id, changes);

      expect(result.success).toBe(true);
      expect(result.transaction?.changes).toHaveLength(1);
      expect(result.transaction?.status).toBe('staging');
    });

    it('should fail for non-existent transaction', () => {
      const changes: FileChange[] = [
        { path: 'test.ts', type: 'add', content: 'new content' }
      ];

      const result = manager.stageChanges('non-existent', changes);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should validate file is reserved before staging', () => {
      const { transaction } = manager.beginTransaction({
        paths: ['reserved.ts'],
        reason: 'Test'
      });

      const changes: FileChange[] = [
        { path: 'not-reserved.ts', type: 'add', content: 'new content' }
      ];

      const result = manager.stageChanges(transaction!.id, changes);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not reserved');
    });
  });

  describe('commit', () => {
    it('should commit staged changes', () => {
      // Setup: create and stage a file
      fs.writeFileSync(path.join(tempDir, 'commit-test.ts'), 'original');

      const { transaction } = manager.beginTransaction({
        paths: ['commit-test.ts'],
        reason: 'Test commit'
      });

      const changes: FileChange[] = [
        {
          path: 'commit-test.ts',
          type: 'modify',
          content: 'committed content',
          previousContent: 'original'
        }
      ];

      manager.stageChanges(transaction!.id, changes);

      // Apply changes to filesystem
      fs.writeFileSync(path.join(tempDir, 'commit-test.ts'), 'committed content');

      const commitOptions: CommitOptions = {
        message: 'feat: test commit'
      };

      const result = manager.commit(transaction!.id, commitOptions);

      expect(result.success).toBe(true);
      expect(result.commitHash).toBeDefined();

      // Verify transaction status by fetching it
      const updatedTransaction = manager.getTransaction(transaction!.id);
      expect(updatedTransaction?.status).toBe('committed');
    });

    it('should fail commit with empty message', () => {
      const { transaction } = manager.beginTransaction({
        paths: ['test.ts'],
        reason: 'Test'
      });

      const result = manager.commit(transaction!.id, { message: '' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('message');
    });

    it('should include author information in commit', () => {
      fs.writeFileSync(path.join(tempDir, 'author-test.ts'), 'content');

      const { transaction } = manager.beginTransaction({
        paths: ['author-test.ts'],
        reason: 'Test'
      });

      manager.stageChanges(transaction!.id, [
        { path: 'author-test.ts', type: 'modify', content: 'new', previousContent: 'content' }
      ]);

      fs.writeFileSync(path.join(tempDir, 'author-test.ts'), 'new');

      const result = manager.commit(transaction!.id, {
        message: 'test',
        author: { name: 'Test Agent', email: 'agent@test.com' }
      });

      expect(result.success).toBe(true);
    });
  });

  describe('rollback', () => {
    it('should rollback changes and release reservations', () => {
      fs.writeFileSync(path.join(tempDir, 'rollback-test.ts'), 'original');

      const { transaction } = manager.beginTransaction({
        paths: ['rollback-test.ts'],
        reason: 'Test rollback'
      });

      manager.stageChanges(transaction!.id, [
        { path: 'rollback-test.ts', type: 'modify', content: 'modified', previousContent: 'original' }
      ]);

      fs.writeFileSync(path.join(tempDir, 'rollback-test.ts'), 'modified');

      const result = manager.rollback(transaction!.id);

      expect(result.success).toBe(true);
      expect(result.restoredFiles).toContain('rollback-test.ts');

      const content = fs.readFileSync(path.join(tempDir, 'rollback-test.ts'), 'utf-8');
      expect(content).toBe('original');
    });
  });

  describe('getTransaction', () => {
    it('should return transaction by ID', () => {
      const { transaction: created } = manager.beginTransaction({
        paths: ['test.ts'],
        reason: 'Test'
      });

      const retrieved = manager.getTransaction(created!.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created!.id);
    });

    it('should return undefined for non-existent transaction', () => {
      const retrieved = manager.getTransaction('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getActiveTransactions', () => {
    it('should return only active transactions', () => {
      manager.beginTransaction({ paths: ['file1.ts'], reason: 'Active' });

      const { transaction } = manager.beginTransaction({
        paths: ['file2.ts'],
        reason: 'To be committed'
      });

      fs.writeFileSync(path.join(tempDir, 'file2.ts'), 'content');
      manager.stageChanges(transaction!.id, [
        { path: 'file2.ts', type: 'add', content: 'content' }
      ]);
      fs.writeFileSync(path.join(tempDir, 'file2.ts'), 'content');
      manager.commit(transaction!.id, { message: 'commit' });

      const active = manager.getActiveTransactions();

      expect(active).toHaveLength(1);
      expect(active[0].status).toBe('pending');
    });
  });

  describe('validateTransaction', () => {
    it('should validate transaction is ready for commit', () => {
      fs.writeFileSync(path.join(tempDir, 'validate.ts'), 'content');

      const { transaction } = manager.beginTransaction({
        paths: ['validate.ts'],
        reason: 'Test'
      });

      const result = manager.validateTransaction(transaction!.id);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No changes staged');
    });

    it('should pass validation with staged changes', () => {
      fs.writeFileSync(path.join(tempDir, 'validate2.ts'), 'original');

      const { transaction } = manager.beginTransaction({
        paths: ['validate2.ts'],
        reason: 'Test'
      });

      manager.stageChanges(transaction!.id, [
        { path: 'validate2.ts', type: 'modify', content: 'new', previousContent: 'original' }
      ]);

      const result = manager.validateTransaction(transaction!.id);

      expect(result.valid).toBe(true);
    });
  });
});
