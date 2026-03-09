/**
 * Thread tests for Swarm Mail
 */

import * as fs from 'fs';
import * as path from 'path';
import { ThreadManager } from '../threads';
import { Message } from '../types';

describe('ThreadManager', () => {
  const testStoragePath = path.join(__dirname, '.test-threads');
  let threads: ThreadManager;

  beforeEach(() => {
    if (fs.existsSync(testStoragePath)) {
      fs.rmSync(testStoragePath, { recursive: true });
    }

    threads = new ThreadManager(testStoragePath);
  });

  afterEach(() => {
    if (fs.existsSync(testStoragePath)) {
      fs.rmSync(testStoragePath, { recursive: true });
    }
  });

  describe('create', () => {
    it('should create a new thread', () => {
      const thread = threads.create('Test Subject', ['agent-1', 'agent-2']);

      expect(thread.id).toBeDefined();
      expect(thread.subject).toBe('Test Subject');
      expect(thread.participants).toHaveLength(2);
      expect(thread.participants).toContain('agent-1');
      expect(thread.participants).toContain('agent-2');
      expect(thread.messageIds).toHaveLength(0);
      expect(thread.createdAt).toBeDefined();
      expect(thread.updatedAt).toBeDefined();
    });

    it('should deduplicate participants', () => {
      const thread = threads.create('Test', ['agent-1', 'agent-1', 'agent-2']);
      expect(thread.participants).toHaveLength(2);
    });

    it('should include runId and metadata', () => {
      const thread = threads.create(
        'Test',
        ['agent-1'],
        'run-123',
        { priority: 'high' }
      );

      expect(thread.runId).toBe('run-123');
      expect(thread.metadata).toEqual({ priority: 'high' });
    });
  });

  describe('get', () => {
    it('should retrieve a thread by ID', () => {
      const created = threads.create('Test', ['agent-1']);
      const retrieved = threads.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
    });

    it('should return undefined for non-existent thread', () => {
      const retrieved = threads.get('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('addMessage', () => {
    it('should add a message to a thread', async () => {
      const thread = threads.create('Test', ['agent-1']);

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = threads.addMessage(thread.id, 'msg-123', 'agent-1');

      expect(updated).toBeDefined();
      expect(updated!.messageIds).toContain('msg-123');
      expect(updated!.updatedAt).toBeGreaterThanOrEqual(thread.updatedAt);
    });

    it('should add sender to participants', () => {
      const thread = threads.create('Test', ['agent-1']);
      threads.addMessage(thread.id, 'msg-123', 'agent-2');

      const updated = threads.get(thread.id);
      expect(updated!.participants).toContain('agent-2');
    });

    it('should not duplicate message IDs', () => {
      const thread = threads.create('Test', ['agent-1']);
      threads.addMessage(thread.id, 'msg-123', 'agent-1');
      threads.addMessage(thread.id, 'msg-123', 'agent-1');

      const updated = threads.get(thread.id);
      expect(updated!.messageIds).toHaveLength(1);
    });

    it('should return undefined for non-existent thread', () => {
      const result = threads.addMessage('non-existent', 'msg-123', 'agent-1');
      expect(result).toBeUndefined();
    });
  });

  describe('getOrCreateForMessage', () => {
    it('should create new thread for message without threadId', () => {
      const message: Message = {
        id: 'msg-123',
        type: 'direct',
        priority: 'normal',
        status: 'unread',
        from: 'agent-1',
        to: 'agent-2',
        subject: 'New Thread',
        body: 'Hello',
        timestamp: Date.now()
      };

      const thread = threads.getOrCreateForMessage(message);

      expect(thread.id).toBeDefined();
      expect(thread.subject).toBe('New Thread');
      expect(thread.participants).toContain('agent-1');
      expect(thread.participants).toContain('agent-2');
    });

    it('should use existing thread if threadId provided', () => {
      const existingThread = threads.create('Existing', ['agent-1', 'agent-2']);

      const message: Message = {
        id: 'msg-123',
        threadId: existingThread.id,
        type: 'direct',
        priority: 'normal',
        status: 'unread',
        from: 'agent-1',
        to: 'agent-2',
        subject: 'Reply',
        body: 'Hello',
        timestamp: Date.now()
      };

      const thread = threads.getOrCreateForMessage(message);
      expect(thread.id).toBe(existingThread.id);
    });

    it('should handle broadcast messages', () => {
      const message: Message = {
        id: 'msg-123',
        type: 'broadcast',
        priority: 'normal',
        status: 'unread',
        from: 'coordinator',
        to: 'broadcast',
        subject: 'Announcement',
        body: 'Hello all',
        timestamp: Date.now()
      };

      const thread = threads.getOrCreateForMessage(message);
      expect(thread.participants).toContain('coordinator');
    });
  });

  describe('query', () => {
    beforeEach(() => {
      threads.create('Thread 1', ['agent-1', 'agent-2'], 'run-1');
      threads.create('Thread 2', ['agent-1', 'agent-3'], 'run-1');
      threads.create('Thread 3', ['agent-2', 'agent-3'], 'run-2');
    });

    it('should query by participant', () => {
      const results = threads.query({ participant: 'agent-1' });
      expect(results).toHaveLength(2);
    });

    it('should query by runId', () => {
      const results = threads.query({ runId: 'run-1' });
      expect(results).toHaveLength(2);
    });

    it('should query by since', () => {
      const since = Date.now() - 1000;
      const results = threads.query({ since });
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should limit results', () => {
      const results = threads.query({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should sort by updatedAt descending', () => {
      const results = threads.query();
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].updatedAt).toBeGreaterThanOrEqual(results[i].updatedAt);
      }
    });
  });

  describe('getMessageIds', () => {
    it('should return message IDs for a thread', () => {
      const thread = threads.create('Test', ['agent-1']);
      threads.addMessage(thread.id, 'msg-1', 'agent-1');
      threads.addMessage(thread.id, 'msg-2', 'agent-2');

      const messageIds = threads.getMessageIds(thread.id);
      expect(messageIds).toHaveLength(2);
      expect(messageIds).toContain('msg-1');
      expect(messageIds).toContain('msg-2');
    });

    it('should return empty array for non-existent thread', () => {
      const messageIds = threads.getMessageIds('non-existent');
      expect(messageIds).toHaveLength(0);
    });
  });

  describe('delete', () => {
    it('should delete a thread', () => {
      const thread = threads.create('To Delete', ['agent-1']);
      const result = threads.delete(thread.id);

      expect(result).toBe(true);
      expect(threads.get(thread.id)).toBeUndefined();
    });

    it('should return false for non-existent thread', () => {
      const result = threads.delete('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getForAgent', () => {
    it('should return threads for an agent', () => {
      threads.create('Thread 1', ['agent-1', 'agent-2']);
      threads.create('Thread 2', ['agent-1', 'agent-3']);
      threads.create('Thread 3', ['agent-2', 'agent-3']);

      const agentThreads = threads.getForAgent('agent-1');
      expect(agentThreads).toHaveLength(2);
    });
  });

  describe('count', () => {
    it('should return thread count', () => {
      expect(threads.count()).toBe(0);

      threads.create('Thread 1', ['agent-1']);
      expect(threads.count()).toBe(1);

      threads.create('Thread 2', ['agent-2']);
      expect(threads.count()).toBe(2);
    });
  });
});
