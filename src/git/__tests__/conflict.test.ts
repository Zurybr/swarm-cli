/**
 * Git Atomic Commit - Conflict Detection Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConflictDetector } from '../conflict';
import { Transaction, FileChange } from '../types';
import { FileReservation } from '../../swarm-mail/types';

describe('ConflictDetector', () => {
  let detector: ConflictDetector;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-conflict-test-'));

    // Initialize git repo
    const { execSync } = require('child_process');
    execSync('git init', { cwd: tempDir });
    execSync('git config user.email "test@test.com"', { cwd: tempDir });
    execSync('git config user.name "Test"', { cwd: tempDir });

    // Create initial commit
    fs.writeFileSync(path.join(tempDir, 'initial.txt'), 'initial');
    execSync('git add .', { cwd: tempDir });
    execSync('git commit -m "initial"', { cwd: tempDir });

    detector = new ConflictDetector({
      gitPath: 'git',
      workingDirectory: tempDir
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('checkExternalChanges', () => {
    it('should return empty array when no changes', () => {
      const reservations: FileReservation[] = [
        {
          id: 'res-1',
          path: 'file.txt',
          agentName: 'agent-1',
          status: 'active',
          createdAt: Date.now(),
          expiresAt: Date.now() + 3600000,
          exclusive: true
        }
      ];

      const changes = detector.checkExternalChanges(reservations);
      expect(changes).toHaveLength(0);
    });

    it('should detect modified files', () => {
      const { execSync } = require('child_process');

      // Create and commit a file
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'original');
      execSync('git add .', { cwd: tempDir });
      execSync('git commit -m "add file"', { cwd: tempDir });

      const sinceCommit = execSync('git rev-parse HEAD', { cwd: tempDir }).toString().trim();

      // Modify the file
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'modified');
      execSync('git add .', { cwd: tempDir });
      execSync('git commit -m "modify file"', { cwd: tempDir });

      const reservations: FileReservation[] = [
        {
          id: 'res-1',
          path: 'file.txt',
          agentName: 'agent-1',
          status: 'active',
          createdAt: Date.now(),
          expiresAt: Date.now() + 3600000,
          exclusive: true
        }
      ];

      const changes = detector.checkExternalChanges(reservations, sinceCommit);
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('modified');
      expect(changes[0].path).toBe('file.txt');
    });

    it('should detect deleted files', () => {
      const { execSync } = require('child_process');

      // Create and commit a file
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'original');
      execSync('git add .', { cwd: tempDir });
      execSync('git commit -m "add file"', { cwd: tempDir });

      const sinceCommit = execSync('git rev-parse HEAD', { cwd: tempDir }).toString().trim();

      // Delete the file
      fs.unlinkSync(path.join(tempDir, 'file.txt'));
      execSync('git add .', { cwd: tempDir });
      execSync('git commit -m "delete file"', { cwd: tempDir });

      const reservations: FileReservation[] = [
        {
          id: 'res-1',
          path: 'file.txt',
          agentName: 'agent-1',
          status: 'active',
          createdAt: Date.now(),
          expiresAt: Date.now() + 3600000,
          exclusive: true
        }
      ];

      const changes = detector.checkExternalChanges(reservations, sinceCommit);
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('deleted');
    });
  });

  describe('detectConflicts', () => {
    it('should detect file modified conflicts', () => {
      const transaction: Transaction = {
        id: 'txn-1',
        agentName: 'agent-1',
        status: 'pending',
        reservations: [],
        changes: [
          {
            path: 'file.txt',
            type: 'modify',
            content: 'our changes'
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const externalChanges = [
        {
          path: 'file.txt',
          type: 'modified' as const,
          sinceCommit: 'abc123',
          currentCommit: 'def456'
        }
      ];

      const conflicts = detector.detectConflicts(transaction, externalChanges);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('file_modified');
      expect(conflicts[0].resolvable).toBe(true);
    });

    it('should detect file deleted conflicts', () => {
      const transaction: Transaction = {
        id: 'txn-1',
        agentName: 'agent-1',
        status: 'pending',
        reservations: [],
        changes: [
          {
            path: 'file.txt',
            type: 'modify',
            content: 'our changes',
            previousContent: 'original'
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const externalChanges = [
        {
          path: 'file.txt',
          type: 'deleted' as const,
          sinceCommit: 'abc123',
          currentCommit: 'def456'
        }
      ];

      const conflicts = detector.detectConflicts(transaction, externalChanges);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('file_deleted');
    });

    it('should not flag external changes to unrelated files', () => {
      const transaction: Transaction = {
        id: 'txn-1',
        agentName: 'agent-1',
        status: 'pending',
        reservations: [],
        changes: [
          {
            path: 'file-a.txt',
            type: 'modify',
            content: 'our changes'
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const externalChanges = [
        {
          path: 'file-b.txt',
          type: 'modified' as const,
          sinceCommit: 'abc123',
          currentCommit: 'def456'
        }
      ];

      const conflicts = detector.detectConflicts(transaction, externalChanges);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('checkBranchDivergence', () => {
    it('should return not diverged for single branch', () => {
      const result = detector.checkBranchDivergence();
      // No upstream configured, should return false
      expect(result.diverged).toBe(false);
    });
  });

  describe('checkMergeConflicts', () => {
    it('should return empty array when no conflicts', () => {
      const conflicts = detector.checkMergeConflicts();
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('resolveConflict', () => {
    it('should resolve with ours strategy', () => {
      const conflict = {
        type: 'file_modified' as const,
        path: 'file.txt',
        message: 'Modified',
        resolvable: true
      };

      const resolution = detector.resolveConflict(conflict, 'ours', 'our content', 'their content');
      expect(resolution.strategy).toBe('ours');
      expect(resolution.resolvedContent).toBe('our content');
    });

    it('should resolve with theirs strategy', () => {
      const conflict = {
        type: 'file_modified' as const,
        path: 'file.txt',
        message: 'Modified',
        resolvable: true
      };

      const resolution = detector.resolveConflict(conflict, 'theirs', 'our content', 'their content');
      expect(resolution.strategy).toBe('theirs');
      expect(resolution.resolvedContent).toBe('their content');
    });

    it('should resolve with abort strategy', () => {
      const conflict = {
        type: 'file_modified' as const,
        path: 'file.txt',
        message: 'Modified',
        resolvable: true
      };

      const resolution = detector.resolveConflict(conflict, 'abort');
      expect(resolution.strategy).toBe('abort');
      expect(resolution.resolvedContent).toBeUndefined();
    });
  });

  describe('canSafelyModify', () => {
    it('should return safe for new file', () => {
      const result = detector.canSafelyModify('new-file.txt', 'agent-1');
      expect(result.safe).toBe(true);
    });

    it('should return safe for existing unmodified file', () => {
      fs.writeFileSync(path.join(tempDir, 'existing.txt'), 'content');
      const { execSync } = require('child_process');
      execSync('git add .', { cwd: tempDir });
      execSync('git commit -m "add existing"', { cwd: tempDir });

      const result = detector.canSafelyModify('existing.txt', 'agent-1');
      expect(result.safe).toBe(true);
    });
  });

  describe('getRecommendedStrategy', () => {
    it('should recommend merge for file_modified', () => {
      const conflict = {
        type: 'file_modified' as const,
        path: 'file.txt',
        message: 'Modified',
        resolvable: true
      };

      expect(detector.getRecommendedStrategy(conflict)).toBe('merge');
    });

    it('should recommend ours for deletable file_deleted', () => {
      const conflict = {
        type: 'file_deleted' as const,
        path: 'file.txt',
        message: 'Deleted',
        resolvable: true
      };

      expect(detector.getRecommendedStrategy(conflict)).toBe('ours');
    });

    it('should recommend abort for unresolvable file_deleted', () => {
      const conflict = {
        type: 'file_deleted' as const,
        path: 'file.txt',
        message: 'Deleted',
        resolvable: false
      };

      expect(detector.getRecommendedStrategy(conflict)).toBe('abort');
    });

    it('should recommend abort for reservation_expired', () => {
      const conflict = {
        type: 'reservation_expired' as const,
        path: 'file.txt',
        message: 'Expired',
        resolvable: false
      };

      expect(detector.getRecommendedStrategy(conflict)).toBe('abort');
    });
  });

  describe('validateConflicts', () => {
    it('should validate all resolvable conflicts', () => {
      const conflicts = [
        { type: 'file_modified' as const, path: 'a.txt', message: 'M', resolvable: true },
        { type: 'merge_conflict' as const, path: 'b.txt', message: 'C', resolvable: true }
      ];

      const result = detector.validateConflicts(conflicts);
      expect(result.valid).toBe(true);
      expect(result.unresolvable).toHaveLength(0);
    });

    it('should invalidate when unresolvable conflicts exist', () => {
      const conflicts = [
        { type: 'file_modified' as const, path: 'a.txt', message: 'M', resolvable: true },
        { type: 'file_deleted' as const, path: 'b.txt', message: 'D', resolvable: false }
      ];

      const result = detector.validateConflicts(conflicts);
      expect(result.valid).toBe(false);
      expect(result.unresolvable).toHaveLength(1);
    });
  });
});
