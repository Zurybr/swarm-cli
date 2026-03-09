/**
 * SwarmMail integration tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { SwarmMail, createSwarmMail } from '../index';

describe('SwarmMail', () => {
  const testStoragePath = path.join(__dirname, '.test-swarm-mail');
  let mail: SwarmMail;

  beforeEach(() => {
    if (fs.existsSync(testStoragePath)) {
      fs.rmSync(testStoragePath, { recursive: true });
    }

    mail = new SwarmMail({
      agentName: 'test-agent',
      storagePath: testStoragePath
    });
  });

  afterEach(() => {
    if (fs.existsSync(testStoragePath)) {
      fs.rmSync(testStoragePath, { recursive: true });
    }
  });

  describe('messaging', () => {
    it('should send and receive messages', () => {
      const message = mail.send({
        to: 'recipient-agent',
        subject: 'Test',
        body: 'Hello'
      });

      expect(message.id).toBeDefined();
      expect(message.from).toBe('test-agent');

      const retrieved = mail.getMessage(message.id);
      expect(retrieved).toBeDefined();
    });

    it('should reply to messages', () => {
      const original = mail.send({
        to: 'recipient-agent',
        subject: 'Original',
        body: 'Body'
      });

      const reply = mail.reply(original.id, 'Reply body');
      expect(reply).toBeDefined();
      expect(reply!.subject).toBe('Re: Original');
    });

    it('should broadcast messages', () => {
      const message = mail.broadcast('Alert', 'Important!');
      expect(message.type).toBe('broadcast');
      expect(message.to).toBe('broadcast');
    });

    it('should get unread count', () => {
      mail.send({ to: 'test-agent', subject: 'Test', body: 'Body' });
      expect(mail.getUnreadCount()).toBeGreaterThanOrEqual(1);
    });
  });

  describe('reservations', () => {
    it('should reserve files', () => {
      const result = mail.reserve(['file1.ts', 'file2.ts'], {
        reason: 'Refactoring'
      });

      expect(result.success).toBe(true);
      expect(result.reservations).toHaveLength(2);
    });

    it('should check conflicts', () => {
      mail.reserve('file.ts', { reason: 'First' });

      const check = mail.checkConflicts('file.ts');
      expect(check.hasConflict).toBe(false); // Same agent

      // Simulate different agent by creating new instance
      const otherMail = new SwarmMail({
        agentName: 'other-agent',
        storagePath: testStoragePath
      });

      const otherCheck = otherMail.checkConflicts('file.ts');
      expect(otherCheck.hasConflict).toBe(true);
    });

    it('should check if can edit', () => {
      mail.reserve('file.ts', { reason: 'Editing' });
      expect(mail.canEdit('file.ts')).toBe(true);
      expect(mail.canEdit('other-file.ts')).toBe(true);
    });

    it('should get my reservations', () => {
      mail.reserve(['file1.ts', 'file2.ts'], { reason: 'Test' });

      const myReservations = mail.getMyReservations();
      expect(myReservations).toHaveLength(2);
    });

    it('should release all reservations', () => {
      mail.reserve(['file1.ts', 'file2.ts'], { reason: 'Test' });

      const released = mail.releaseAllReservations();
      expect(released).toBe(2);

      const remaining = mail.getMyReservations();
      expect(remaining).toHaveLength(0);
    });
  });

  describe('threads', () => {
    it('should create threads for messages', () => {
      const message = mail.send({
        to: 'recipient-agent',
        subject: 'Thread Test',
        body: 'Body'
      });

      expect(message.threadId).toBeDefined();

      const thread = mail.getThread(message.threadId!);
      expect(thread).toBeDefined();
      expect(thread!.subject).toBe('Thread Test');
    });

    it('should get my threads', () => {
      mail.send({ to: 'agent-1', subject: 'Thread 1', body: 'Body' });
      mail.send({ to: 'agent-2', subject: 'Thread 2', body: 'Body' });

      const myThreads = mail.getMyThreads();
      expect(myThreads.length).toBeGreaterThanOrEqual(2);
    });

    it('should query threads', () => {
      mail.send({ to: 'agent-1', subject: 'Thread', body: 'Body' });

      const threads = mail.queryThreads({ participant: 'agent-1' });
      expect(threads.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('notifications', () => {
    it('should create notifications', () => {
      const notification = mail.notify('message', 'Test', 'Body');
      expect(notification.type).toBe('message');
    });

    it('should get notifications', () => {
      mail.notify('message', 'Test 1', 'Body');
      mail.notify('blocker', 'Test 2', 'Body');

      const notifications = mail.getNotifications();
      expect(notifications.length).toBeGreaterThanOrEqual(2);
    });

    it('should acknowledge notifications', () => {
      const notification = mail.notify('message', 'Test', 'Body');

      const result = mail.acknowledgeNotification(notification.id);
      expect(result).toBe(true);

      const unacknowledged = mail.getUnacknowledgedNotifications();
      expect(unacknowledged.every(n => n.id !== notification.id)).toBe(true);
    });

    it('should register notification handlers', () => {
      const handler = jest.fn();
      const unsubscribe = mail.onNotification('message', handler);

      mail.notify('message', 'Test', 'Body');

      expect(handler).toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('system messages', () => {
    it('should send system events', () => {
      const message = mail.sendSystemEvent('Event', 'Details', 'recipient-agent');
      expect(message.type).toBe('system');
    });

    it('should send blockers', () => {
      const message = mail.sendBlocker('Blocked', 'Cannot proceed', 'coordinator');
      expect(message.type).toBe('blocker');
      expect(message.priority).toBe('urgent');
    });

    it('should send progress updates', () => {
      const message = mail.sendProgress('task-123', 50, 'Halfway', 'coordinator');
      expect(message.type).toBe('progress');
      expect(message.metadata).toEqual({ taskId: 'task-123', progressPercent: 50 });
    });
  });

  describe('utilities', () => {
    it('should get stats', () => {
      mail.send({ to: 'agent-1', subject: 'Test', body: 'Body' });

      const stats = mail.getStats();
      expect(stats.totalMessages).toBeGreaterThanOrEqual(0);
      expect(stats.unreadCount).toBeGreaterThanOrEqual(0);
      expect(stats.threadCount).toBeGreaterThanOrEqual(0);
    });

    it('should cleanup', () => {
      mail.send({ to: 'agent-1', subject: 'Test', body: 'Body' });
      mail.reserve('file.ts', { ttlSeconds: 0 }); // Expired

      const result = mail.cleanup();
      expect(result.messages).toBeGreaterThanOrEqual(0);
      expect(result.reservations).toBeGreaterThanOrEqual(0);
      expect(result.notifications).toBeGreaterThanOrEqual(0);
    });

    it('should expose underlying managers', () => {
      expect(mail.getMailbox()).toBeDefined();
      expect(mail.getReservationManager()).toBeDefined();
      expect(mail.getNotificationManager()).toBeDefined();
    });
  });

  describe('createSwarmMail factory', () => {
    it('should create SwarmMail instance', () => {
      const instance = createSwarmMail({
        agentName: 'factory-agent',
        storagePath: testStoragePath
      });

      expect(instance).toBeInstanceOf(SwarmMail);
    });
  });
});
