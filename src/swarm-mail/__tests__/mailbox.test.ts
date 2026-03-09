/**
 * Mailbox tests for Swarm Mail
 */

import * as fs from 'fs';
import * as path from 'path';
import { Mailbox } from '../mailbox';
import { MailboxConfig, Message, MessagePriority } from '../types';

describe('Mailbox', () => {
  const testStoragePath = path.join(__dirname, '.test-mailbox');
  let mailbox: Mailbox;

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testStoragePath)) {
      fs.rmSync(testStoragePath, { recursive: true });
    }

    const config: MailboxConfig = {
      agentName: 'test-agent',
      storagePath: testStoragePath
    };

    mailbox = new Mailbox(config);
  });

  afterEach(() => {
    if (fs.existsSync(testStoragePath)) {
      fs.rmSync(testStoragePath, { recursive: true });
    }
  });

  describe('send', () => {
    it('should send a direct message', () => {
      const message = mailbox.send({
        to: 'recipient-agent',
        subject: 'Test Subject',
        body: 'Test Body'
      });

      expect(message.id).toBeDefined();
      expect(message.from).toBe('test-agent');
      expect(message.to).toBe('recipient-agent');
      expect(message.subject).toBe('Test Subject');
      expect(message.body).toBe('Test Body');
      expect(message.type).toBe('direct');
      expect(message.status).toBe('unread');
      expect(message.timestamp).toBeDefined();
      expect(message.threadId).toBeDefined();
    });

    it('should send a message with custom priority', () => {
      const message = mailbox.send({
        to: 'recipient-agent',
        subject: 'Urgent',
        body: 'Important!',
        priority: 'urgent' as MessagePriority
      });

      expect(message.priority).toBe('urgent');
    });

    it('should send to multiple recipients', () => {
      const message = mailbox.send({
        to: ['agent-1', 'agent-2'],
        subject: 'Group',
        body: 'Hello all'
      });

      expect(Array.isArray(message.to)).toBe(true);
      expect(message.to).toHaveLength(2);
    });

    it('should create a thread for new messages', () => {
      const message = mailbox.send({
        to: 'recipient-agent',
        subject: 'New Thread',
        body: 'First message'
      });

      expect(message.threadId).toBeDefined();

      const thread = mailbox.getThreadManager().get(message.threadId!);
      expect(thread).toBeDefined();
      expect(thread!.subject).toBe('New Thread');
    });
  });

  describe('get', () => {
    it('should retrieve a message by ID', () => {
      const sent = mailbox.send({
        to: 'recipient-agent',
        subject: 'Test',
        body: 'Body'
      });

      const retrieved = mailbox.get(sent.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(sent.id);
    });

    it('should return undefined for non-existent message', () => {
      const retrieved = mailbox.get('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getInbox', () => {
    it('should return inbox messages', () => {
      mailbox.send({
        to: 'test-agent', // Send to self for inbox testing
        subject: 'Inbox Test',
        body: 'Body'
      });

      const inbox = mailbox.getInbox();
      expect(inbox.length).toBeGreaterThan(0);
    });

    it('should filter by type', () => {
      mailbox.send({
        to: 'test-agent',
        subject: 'Direct',
        body: 'Body',
        type: 'direct'
      });

      mailbox.send({
        to: 'test-agent',
        subject: 'System',
        body: 'Body',
        type: 'system'
      });

      const directMessages = mailbox.getInbox({ type: 'direct' });
      expect(directMessages.every(m => m.type === 'direct')).toBe(true);
    });

    it('should filter by status', () => {
      const message = mailbox.send({
        to: 'test-agent',
        subject: 'Test',
        body: 'Body'
      });

      mailbox.markAsRead(message.id);

      const unreadMessages = mailbox.getInbox({ status: 'unread' });
      expect(unreadMessages.every(m => m.status === 'unread')).toBe(true);
    });

    it('should filter unread only', () => {
      mailbox.send({
        to: 'test-agent',
        subject: 'Unread',
        body: 'Body'
      });

      const unread = mailbox.getInbox({ unreadOnly: true });
      expect(unread.every(m => m.status === 'unread')).toBe(true);
    });

    it('should limit results', () => {
      for (let i = 0; i < 5; i++) {
        mailbox.send({
          to: 'test-agent',
          subject: `Message ${i}`,
          body: 'Body'
        });
      }

      const limited = mailbox.getInbox({ limit: 3 });
      expect(limited).toHaveLength(3);
    });
  });

  describe('markAsRead', () => {
    it('should mark a message as read', () => {
      const message = mailbox.send({
        to: 'test-agent',
        subject: 'Test',
        body: 'Body'
      });

      expect(message.status).toBe('unread');

      const result = mailbox.markAsRead(message.id);
      expect(result).toBe(true);

      const retrieved = mailbox.get(message.id);
      expect(retrieved!.status).toBe('read');
      expect(retrieved!.readAt).toBeDefined();
    });

    it('should return false for non-existent message', () => {
      const result = mailbox.markAsRead('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('archive', () => {
    it('should archive a message', () => {
      const message = mailbox.send({
        to: 'test-agent',
        subject: 'Test',
        body: 'Body'
      });

      const result = mailbox.archive(message.id);
      expect(result).toBe(true);

      const retrieved = mailbox.get(message.id);
      expect(retrieved!.status).toBe('archived');
    });
  });

  describe('reply', () => {
    it('should create a reply to a message', () => {
      const original = mailbox.send({
        to: 'recipient-agent',
        subject: 'Original',
        body: 'Original body'
      });

      const reply = mailbox.reply(original.id, 'Reply body');

      expect(reply).toBeDefined();
      expect(reply!.subject).toBe('Re: Original');
      expect(reply!.body).toBe('Reply body');
      expect(reply!.replyTo).toBe(original.id);
      expect(reply!.threadId).toBe(original.threadId);
    });

    it('should return undefined for non-existent message', () => {
      const reply = mailbox.reply('non-existent', 'Body');
      expect(reply).toBeUndefined();
    });

    it('should use custom subject if provided', () => {
      const original = mailbox.send({
        to: 'recipient-agent',
        subject: 'Original',
        body: 'Body'
      });

      const reply = mailbox.reply(original.id, 'Reply', 'Custom Subject');
      expect(reply!.subject).toBe('Custom Subject');
    });
  });

  describe('broadcast', () => {
    it('should send a broadcast message', () => {
      const message = mailbox.broadcast('Alert', 'Important message', 'high');

      expect(message.type).toBe('broadcast');
      expect(message.to).toBe('broadcast');
      expect(message.priority).toBe('high');
    });
  });

  describe('sendSystemEvent', () => {
    it('should send a system event', () => {
      const message = mailbox.sendSystemEvent(
        'Task Complete',
        'Task finished successfully',
        'recipient-agent',
        { taskId: 'task-123' }
      );

      expect(message.type).toBe('system');
      expect(message.subject).toBe('Task Complete');
      expect(message.metadata).toEqual({ taskId: 'task-123' });
    });
  });

  describe('sendBlocker', () => {
    it('should send a blocker notification', () => {
      const message = mailbox.sendBlocker(
        'Blocked',
        'Cannot proceed without X',
        'coordinator',
        { taskId: 'task-123' }
      );

      expect(message.type).toBe('blocker');
      expect(message.priority).toBe('urgent');
    });
  });

  describe('sendProgress', () => {
    it('should send a progress update', () => {
      const message = mailbox.sendProgress('task-123', 50, 'Halfway done', 'coordinator');

      expect(message.type).toBe('progress');
      expect(message.priority).toBe('low');
      expect(message.metadata).toEqual({ taskId: 'task-123', progressPercent: 50 });
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread messages', () => {
      mailbox.send({ to: 'test-agent', subject: '1', body: 'Body' });
      mailbox.send({ to: 'test-agent', subject: '2', body: 'Body' });

      const count = mailbox.getUnreadCount();
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getStats', () => {
    it('should return mailbox statistics', () => {
      mailbox.send({ to: 'test-agent', subject: 'Test', body: 'Body' });

      const stats = mailbox.getStats();
      expect(stats.totalMessages).toBeGreaterThanOrEqual(0);
      expect(stats.unreadCount).toBeGreaterThanOrEqual(0);
      expect(stats.threadCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('delete', () => {
    it('should delete a message', () => {
      const message = mailbox.send({
        to: 'test-agent',
        subject: 'To Delete',
        body: 'Body'
      });

      const result = mailbox.delete(message.id);
      expect(result).toBe(true);

      const retrieved = mailbox.get(message.id);
      expect(retrieved).toBeUndefined();
    });

    it('should return false for non-existent message', () => {
      const result = mailbox.delete('non-existent');
      expect(result).toBe(false);
    });
  });
});
