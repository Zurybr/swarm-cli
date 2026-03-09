/**
 * Git Atomic Commit - Types Tests
 */

import {
  TransactionStatus,
  ChangeType,
  FileChange,
  CommitOptions,
  Transaction,
  ConflictType,
  Conflict,
  ResolutionStrategy,
  CommitResult,
  RollbackResult
} from '../types';

describe('Git Atomic Commit Types', () => {
  describe('TransactionStatus', () => {
    it('should have all expected statuses', () => {
      const statuses: TransactionStatus[] = [
        'pending',
        'staging',
        'committing',
        'committed',
        'rolling_back',
        'rolled_back',
        'failed'
      ];

      for (const status of statuses) {
        expect(typeof status).toBe('string');
      }
    });
  });

  describe('ChangeType', () => {
    it('should have all expected change types', () => {
      const types: ChangeType[] = ['add', 'modify', 'delete', 'rename'];

      for (const type of types) {
        expect(typeof type).toBe('string');
      }
    });
  });

  describe('FileChange', () => {
    it('should create a valid add change', () => {
      const change: FileChange = {
        path: 'src/new-file.ts',
        type: 'add',
        content: 'console.log("hello")',
        hash: 'abc123'
      };

      expect(change.path).toBe('src/new-file.ts');
      expect(change.type).toBe('add');
      expect(change.content).toBe('console.log("hello")');
    });

    it('should create a valid modify change', () => {
      const change: FileChange = {
        path: 'src/existing.ts',
        type: 'modify',
        content: 'new content',
        previousContent: 'old content',
        hash: 'def456'
      };

      expect(change.type).toBe('modify');
      expect(change.previousContent).toBe('old content');
    });

    it('should create a valid rename change', () => {
      const change: FileChange = {
        path: 'src/new-name.ts',
        type: 'rename',
        previousPath: 'src/old-name.ts',
        content: 'same content'
      };

      expect(change.previousPath).toBe('src/old-name.ts');
    });
  });

  describe('CommitOptions', () => {
    it('should create options with all fields', () => {
      const options: CommitOptions = {
        message: 'feat: add new feature',
        author: {
          name: 'Test Agent',
          email: 'agent@example.com'
        },
        gpgSign: true,
        gpgKeyId: 'ABC123',
        allowEmpty: false,
        amend: false,
        noVerify: false
      };

      expect(options.message).toBe('feat: add new feature');
      expect(options.author?.name).toBe('Test Agent');
      expect(options.gpgSign).toBe(true);
    });

    it('should create options with just message', () => {
      const options: CommitOptions = {
        message: 'fix: bug fix'
      };

      expect(options.message).toBe('fix: bug fix');
      expect(options.author).toBeUndefined();
    });
  });

  describe('Transaction', () => {
    it('should create a valid transaction', () => {
      const transaction: Transaction = {
        id: 'txn-123',
        agentName: 'test-agent',
        status: 'pending',
        reservations: [],
        changes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { taskId: 'task-456' }
      };

      expect(transaction.id).toBe('txn-123');
      expect(transaction.status).toBe('pending');
    });
  });

  describe('ConflictType', () => {
    it('should have all expected conflict types', () => {
      const types: ConflictType[] = [
        'file_modified',
        'file_deleted',
        'reservation_expired',
        'reservation_revoked',
        'merge_conflict',
        'branch_diverged'
      ];

      for (const type of types) {
        expect(typeof type).toBe('string');
      }
    });
  });

  describe('Conflict', () => {
    it('should create a valid conflict', () => {
      const conflict: Conflict = {
        type: 'file_modified',
        path: 'src/conflict.ts',
        message: 'File was modified by another agent',
        resolvable: true
      };

      expect(conflict.type).toBe('file_modified');
      expect(conflict.resolvable).toBe(true);
    });
  });

  describe('ResolutionStrategy', () => {
    it('should have all expected strategies', () => {
      const strategies: ResolutionStrategy[] = ['ours', 'theirs', 'merge', 'abort'];

      for (const strategy of strategies) {
        expect(typeof strategy).toBe('string');
      }
    });
  });

  describe('CommitResult', () => {
    it('should create a successful result', () => {
      const result: CommitResult = {
        success: true,
        transactionId: 'txn-123',
        commitHash: 'abc123',
        message: 'Commit successful'
      };

      expect(result.success).toBe(true);
      expect(result.commitHash).toBe('abc123');
    });

    it('should create a failed result with conflicts', () => {
      const result: CommitResult = {
        success: false,
        transactionId: 'txn-123',
        message: 'Conflicts detected',
        conflicts: [
          {
            type: 'file_modified',
            path: 'src/conflict.ts',
            message: 'Modified externally',
            resolvable: true
          }
        ],
        error: 'Cannot commit with conflicts'
      };

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
    });
  });

  describe('RollbackResult', () => {
    it('should create a successful rollback result', () => {
      const result: RollbackResult = {
        success: true,
        transactionId: 'txn-123',
        message: 'Rollback successful',
        restoredFiles: ['src/file1.ts', 'src/file2.ts']
      };

      expect(result.success).toBe(true);
      expect(result.restoredFiles).toHaveLength(2);
    });
  });
});
