/**
 * Git Atomic Commit - Recovery Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RecoveryManager } from '../recovery';
import { Transaction, FileChange } from '../types';

describe('RecoveryManager', () => {
  let manager: RecoveryManager;
  let tempDir: string;
  let storagePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-recovery-test-'));
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

    manager = new RecoveryManager({
      storagePath,
      gitPath: 'git',
      workingDirectory: tempDir
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('createSnapshot', () => {
    it('should create a snapshot for a transaction', () => {
      const transaction: Transaction = {
        id: 'txn-123',
        agentName: 'agent-1',
        status: 'pending',
        reservations: [],
        changes: [
          {
            path: 'file.txt',
            type: 'modify',
            content: 'new content',
            previousContent: 'old content'
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Create the file first
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'old content');

      const snapshot = manager.createSnapshot(transaction);

      expect(snapshot.transaction.id).toBe('txn-123');
      expect(snapshot.backupPaths['file.txt']).toBeDefined();
      expect(fs.existsSync(snapshot.backupPaths['file.txt'])).toBe(true);
    });

    it('should capture git state', () => {
      const transaction: Transaction = {
        id: 'txn-456',
        agentName: 'agent-1',
        status: 'pending',
        reservations: [],
        changes: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const snapshot = manager.createSnapshot(transaction);

      expect(snapshot.gitState.branch).toBeDefined();
      expect(snapshot.gitState.head).toBeDefined();
      expect(snapshot.gitState.staged).toBeDefined();
    });
  });

  describe('rollback', () => {
    it('should rollback modified files', () => {
      // Create and snapshot a file
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'original content');

      const transaction: Transaction = {
        id: 'txn-rollback',
        agentName: 'agent-1',
        status: 'pending',
        reservations: [],
        changes: [
          {
            path: 'file.txt',
            type: 'modify',
            content: 'modified content',
            previousContent: 'original content'
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      manager.createSnapshot(transaction);

      // Modify the file
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'modified content');

      // Rollback
      const result = manager.rollback('txn-rollback');

      expect(result.success).toBe(true);
      expect(result.restoredFiles).toContain('file.txt');

      const content = fs.readFileSync(path.join(tempDir, 'file.txt'), 'utf-8');
      expect(content).toBe('original content');
    });

    it('should rollback added files', () => {
      const transaction: Transaction = {
        id: 'txn-add',
        agentName: 'agent-1',
        status: 'pending',
        reservations: [],
        changes: [
          {
            path: 'new-file.txt',
            type: 'add',
            content: 'new content'
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      manager.createSnapshot(transaction);

      // Create the file
      fs.writeFileSync(path.join(tempDir, 'new-file.txt'), 'new content');
      expect(fs.existsSync(path.join(tempDir, 'new-file.txt'))).toBe(true);

      // Rollback
      const result = manager.rollback('txn-add');

      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'new-file.txt'))).toBe(false);
    });

    it('should fail rollback for non-existent snapshot', () => {
      const result = manager.rollback('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No snapshot available');
    });
  });

  describe('partialRollback', () => {
    it('should rollback only specified files', () => {
      // Create files
      fs.writeFileSync(path.join(tempDir, 'file-a.txt'), 'original a');
      fs.writeFileSync(path.join(tempDir, 'file-b.txt'), 'original b');

      const transaction: Transaction = {
        id: 'txn-partial',
        agentName: 'agent-1',
        status: 'pending',
        reservations: [],
        changes: [
          {
            path: 'file-a.txt',
            type: 'modify',
            content: 'modified a',
            previousContent: 'original a'
          },
          {
            path: 'file-b.txt',
            type: 'modify',
            content: 'modified b',
            previousContent: 'original b'
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      manager.createSnapshot(transaction);

      // Modify files
      fs.writeFileSync(path.join(tempDir, 'file-a.txt'), 'modified a');
      fs.writeFileSync(path.join(tempDir, 'file-b.txt'), 'modified b');

      // Partial rollback
      const result = manager.partialRollback('txn-partial', ['file-a.txt']);

      expect(result.success).toBe(true);
      expect(result.restoredFiles).toContain('file-a.txt');
      expect(result.restoredFiles).not.toContain('file-b.txt');

      expect(fs.readFileSync(path.join(tempDir, 'file-a.txt'), 'utf-8')).toBe('original a');
      expect(fs.readFileSync(path.join(tempDir, 'file-b.txt'), 'utf-8')).toBe('modified b');
    });
  });

  describe('getPendingTransactions', () => {
    it('should return pending transactions', () => {
      const transaction: Transaction = {
        id: 'txn-pending',
        agentName: 'agent-1',
        status: 'pending',
        reservations: [],
        changes: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      manager.createSnapshot(transaction);

      const pending = manager.getPendingTransactions();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('txn-pending');
    });

    it('should not return committed transactions', () => {
      const transaction: Transaction = {
        id: 'txn-committed',
        agentName: 'agent-1',
        status: 'committed',
        reservations: [],
        changes: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      manager.createSnapshot(transaction);

      const pending = manager.getPendingTransactions();
      expect(pending).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('should clean up old snapshots', () => {
      const transaction: Transaction = {
        id: 'txn-old',
        agentName: 'agent-1',
        status: 'pending',
        reservations: [],
        changes: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      manager.createSnapshot(transaction);

      // Clean up with 0 max age (everything is old)
      const cleaned = manager.cleanup(0);

      expect(cleaned).toBeGreaterThan(0);
      expect(manager.hasSnapshot('txn-old')).toBe(false);
    });
  });

  describe('saveOriginalContent', () => {
    it('should save original content for a file', () => {
      const transactionId = 'txn-save';
      fs.mkdirSync(path.join(storagePath, 'snapshots', transactionId), { recursive: true });

      manager.saveOriginalContent(transactionId, 'test.txt', 'original content');

      const backupPath = path.join(storagePath, 'snapshots', transactionId, 'test.txt');
      expect(fs.existsSync(backupPath)).toBe(true);
      expect(fs.readFileSync(backupPath, 'utf-8')).toBe('original content');
    });
  });

  describe('hasSnapshot', () => {
    it('should return true for existing snapshot', () => {
      const transaction: Transaction = {
        id: 'txn-exists',
        agentName: 'agent-1',
        status: 'pending',
        reservations: [],
        changes: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      manager.createSnapshot(transaction);

      expect(manager.hasSnapshot('txn-exists')).toBe(true);
    });

    it('should return false for non-existent snapshot', () => {
      expect(manager.hasSnapshot('txn-missing')).toBe(false);
    });
  });
});
