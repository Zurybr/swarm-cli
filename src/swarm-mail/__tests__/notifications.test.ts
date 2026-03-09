/**
 * Notification tests for Swarm Mail
 */

import * as fs from 'fs';
import * as path from 'path';
import { NotificationManager } from '../notifications';

describe('NotificationManager', () => {
  const testStoragePath = path.join(__dirname, '.test-notifications');
  let notifications: NotificationManager;

  beforeEach(() => {
    if (fs.existsSync(testStoragePath)) {
      fs.rmSync(testStoragePath, { recursive: true });
    }

    notifications = new NotificationManager(testStoragePath, 'test-agent');
  });

  afterEach(() => {
    if (fs.existsSync(testStoragePath)) {
      fs.rmSync(testStoragePath, { recursive: true });
    }
  });

  describe('notify', () => {
    it('should create a notification', () => {
      const notification = notifications.notify('message', 'New Message', 'You have mail');

      expect(notification.id).toBeDefined();
      expect(notification.type).toBe('message');
      expect(notification.agentName).toBe('test-agent');
      expect(notification.title).toBe('New Message');
      expect(notification.message).toBe('You have mail');
      expect(notification.timestamp).toBeDefined();
      expect(notification.acknowledged).toBe(false);
    });

    it('should include metadata', () => {
      const notification = notifications.notify('system', 'Event', 'Details', {
        taskId: 'task-123',
        extra: 'data'
      });

      expect(notification.metadata).toEqual({
        taskId: 'task-123',
        extra: 'data'
      });
    });
  });

  describe('notification helpers', () => {
    it('should create message notification', () => {
      const notification = notifications.notifyMessage('agent-1', 'Hello', 'msg-123');

      expect(notification.type).toBe('message');
      expect(notification.metadata).toEqual({
        from: 'agent-1',
        subject: 'Hello',
        messageId: 'msg-123'
      });
    });

    it('should create blocker notification', () => {
      const notification = notifications.notifyBlocker('Cannot proceed', 'task-123');

      expect(notification.type).toBe('blocker');
      expect(notification.title).toBe('Blocker Alert');
      expect(notification.metadata).toEqual({ taskId: 'task-123' });
    });

    it('should create progress notification', () => {
      const notification = notifications.notifyProgress('task-123', 50, 'Halfway done');

      expect(notification.type).toBe('progress');
      expect(notification.title).toBe('Progress Update');
      expect(notification.metadata).toEqual({
        taskId: 'task-123',
        progressPercent: 50
      });
    });

    it('should create system notification', () => {
      const notification = notifications.notifySystem('Task Complete', 'Done!', { taskId: 'task-123' });

      expect(notification.type).toBe('system');
      expect(notification.title).toBe('Task Complete');
      expect(notification.message).toBe('Done!');
    });
  });

  describe('acknowledge', () => {
    it('should acknowledge a notification', () => {
      const notification = notifications.notify('message', 'Test', 'Body');

      const result = notifications.acknowledge(notification.id);
      expect(result).toBe(true);

      const retrieved = notifications.get(notification.id);
      expect(retrieved!.acknowledged).toBe(true);
      expect(retrieved!.acknowledgedAt).toBeDefined();
    });

    it('should return false for non-existent notification', () => {
      const result = notifications.acknowledge('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('should retrieve a notification by ID', () => {
      const created = notifications.notify('message', 'Test', 'Body');
      const retrieved = notifications.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
    });

    it('should return undefined for non-existent notification', () => {
      const retrieved = notifications.get('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAll', () => {
    beforeEach(() => {
      notifications.notify('message', 'Message 1', 'Body');
      notifications.notify('blocker', 'Blocker', 'Body');
      notifications.notify('progress', 'Progress', 'Body');
    });

    it('should return all notifications', () => {
      const all = notifications.getAll();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter unacknowledged only', () => {
      const all = notifications.getAll();
      const first = all[0];
      notifications.acknowledge(first.id);

      const unacknowledged = notifications.getAll({ unacknowledgedOnly: true });
      expect(unacknowledged.every(n => !n.acknowledged)).toBe(true);
    });

    it('should limit results', () => {
      const limited = notifications.getAll({ limit: 2 });
      expect(limited).toHaveLength(2);
    });

    it('should sort by timestamp descending', () => {
      const all = notifications.getAll();
      for (let i = 1; i < all.length; i++) {
        expect(all[i - 1].timestamp).toBeGreaterThanOrEqual(all[i].timestamp);
      }
    });
  });

  describe('getUnacknowledged', () => {
    it('should return only unacknowledged notifications', () => {
      const n1 = notifications.notify('message', 'Test 1', 'Body');
      notifications.notify('message', 'Test 2', 'Body');

      notifications.acknowledge(n1.id);

      const unacknowledged = notifications.getUnacknowledged();
      expect(unacknowledged.every(n => !n.acknowledged)).toBe(true);
    });
  });

  describe('getCount', () => {
    it('should return total count', () => {
      notifications.notify('message', 'Test 1', 'Body');
      notifications.notify('message', 'Test 2', 'Body');

      expect(notifications.getCount()).toBe(2);
    });

    it('should return unacknowledged count', () => {
      const n1 = notifications.notify('message', 'Test 1', 'Body');
      notifications.notify('message', 'Test 2', 'Body');

      notifications.acknowledge(n1.id);

      expect(notifications.getCount({ unacknowledgedOnly: true })).toBe(1);
    });
  });

  describe('delete', () => {
    it('should delete a notification', () => {
      const notification = notifications.notify('message', 'Test', 'Body');
      const result = notifications.delete(notification.id);

      expect(result).toBe(true);
      expect(notifications.get(notification.id)).toBeUndefined();
    });

    it('should return false for non-existent notification', () => {
      const result = notifications.delete('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clean up old acknowledged notifications', () => {
      // Create and acknowledge a notification
      const notification = notifications.notify('message', 'Old', 'Body');
      notifications.acknowledge(notification.id);

      // Manually set timestamp to be old
      const notificationPath = path.join(testStoragePath, 'notifications', `${notification.id}.json`);
      const data = JSON.parse(fs.readFileSync(notificationPath, 'utf-8'));
      data.timestamp = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago
      fs.writeFileSync(notificationPath, JSON.stringify(data, null, 2));

      const cleaned = notifications.cleanup(7); // 7 days max age
      expect(cleaned).toBe(1);
    });

    it('should not clean up unacknowledged notifications', () => {
      notifications.notify('message', 'Old Unacknowledged', 'Body');

      const cleaned = notifications.cleanup(0); // 0 days - everything is old
      expect(cleaned).toBe(0);
    });
  });

  describe('handlers', () => {
    it('should call registered handlers', () => {
      const handler = jest.fn();
      notifications.on('message', handler);

      notifications.notify('message', 'Test', 'Body');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].title).toBe('Test');
    });

    it('should support multiple handlers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      notifications.on('message', handler1);
      notifications.on('message', handler2);

      notifications.notify('message', 'Test', 'Body');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should support wildcard handlers', () => {
      const handler = jest.fn();
      notifications.on('*', handler);

      notifications.notify('message', 'Test', 'Body');
      notifications.notify('blocker', 'Blocker', 'Body');

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should return unsubscribe function', () => {
      const handler = jest.fn();
      const unsubscribe = notifications.on('message', handler);

      notifications.notify('message', 'Test 1', 'Body');
      unsubscribe();
      notifications.notify('message', 'Test 2', 'Body');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle handler errors gracefully', () => {
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const successHandler = jest.fn();

      notifications.on('message', errorHandler);
      notifications.on('message', successHandler);

      // Should not throw
      expect(() => {
        notifications.notify('message', 'Test', 'Body');
      }).not.toThrow();

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });
  });

  describe('clearHandlers', () => {
    it('should clear all handlers', () => {
      const handler = jest.fn();
      notifications.on('message', handler);

      notifications.clearHandlers();
      notifications.notify('message', 'Test', 'Body');

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
