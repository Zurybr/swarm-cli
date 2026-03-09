/**
 * Type tests for Swarm Mail
 */

import {
  Message,
  MessageType,
  MessagePriority,
  MessageStatus,
  Thread,
  FileReservation,
  ReservationStatus,
  Notification,
  MessageCompose,
  ReservationRequest,
  ConflictCheck,
  MailboxStats
} from '../types';

describe('Swarm Mail Types', () => {
  describe('Message', () => {
    it('should create a valid message', () => {
      const message: Message = {
        id: 'msg-123',
        type: 'direct' as MessageType,
        priority: 'normal' as MessagePriority,
        status: 'unread' as MessageStatus,
        from: 'agent-1',
        to: 'agent-2',
        subject: 'Test',
        body: 'Hello',
        timestamp: Date.now()
      };

      expect(message.id).toBe('msg-123');
      expect(message.type).toBe('direct');
      expect(message.from).toBe('agent-1');
      expect(message.to).toBe('agent-2');
    });

    it('should support broadcast recipients', () => {
      const message: Message = {
        id: 'msg-124',
        type: 'broadcast' as MessageType,
        priority: 'high' as MessagePriority,
        status: 'unread' as MessageStatus,
        from: 'coordinator',
        to: 'broadcast',
        subject: 'Alert',
        body: 'Important!',
        timestamp: Date.now()
      };

      expect(message.to).toBe('broadcast');
    });

    it('should support multiple recipients', () => {
      const message: Message = {
        id: 'msg-125',
        type: 'direct' as MessageType,
        priority: 'normal' as MessagePriority,
        status: 'unread' as MessageStatus,
        from: 'agent-1',
        to: ['agent-2', 'agent-3'],
        subject: 'Group message',
        body: 'Hello all',
        timestamp: Date.now()
      };

      expect(Array.isArray(message.to)).toBe(true);
      expect(message.to).toHaveLength(2);
    });
  });

  describe('Thread', () => {
    it('should create a valid thread', () => {
      const thread: Thread = {
        id: 'thread-123',
        subject: 'Discussion',
        participants: ['agent-1', 'agent-2'],
        messageIds: ['msg-1', 'msg-2'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      expect(thread.participants).toHaveLength(2);
      expect(thread.messageIds).toHaveLength(2);
    });
  });

  describe('FileReservation', () => {
    it('should create a valid reservation', () => {
      const now = Date.now();
      const reservation: FileReservation = {
        id: 'res-123',
        path: '/path/to/file.ts',
        agentName: 'agent-1',
        status: 'active' as ReservationStatus,
        createdAt: now,
        expiresAt: now + 3600000,
        exclusive: true
      };

      expect(reservation.path).toBe('/path/to/file.ts');
      expect(reservation.status).toBe('active');
      expect(reservation.exclusive).toBe(true);
    });
  });

  describe('Notification', () => {
    it('should create a valid notification', () => {
      const notification: Notification = {
        id: 'notif-123',
        type: 'message',
        agentName: 'agent-1',
        title: 'New Message',
        message: 'You have a new message',
        timestamp: Date.now(),
        acknowledged: false
      };

      expect(notification.acknowledged).toBe(false);
      expect(notification.type).toBe('message');
    });
  });

  describe('MessageCompose', () => {
    it('should allow composing a message', () => {
      const compose: MessageCompose = {
        to: 'agent-2',
        subject: 'Hello',
        body: 'World',
        type: 'direct',
        priority: 'normal'
      };

      expect(compose.to).toBe('agent-2');
      expect(compose.subject).toBe('Hello');
    });
  });

  describe('ReservationRequest', () => {
    it('should allow requesting single file', () => {
      const request: ReservationRequest = {
        paths: 'file.ts',
        reason: 'Editing',
        ttlSeconds: 3600,
        exclusive: true
      };

      expect(request.paths).toBe('file.ts');
    });

    it('should allow requesting multiple files', () => {
      const request: ReservationRequest = {
        paths: ['file1.ts', 'file2.ts'],
        reason: 'Refactoring',
        ttlSeconds: 7200
      };

      expect(Array.isArray(request.paths)).toBe(true);
      expect(request.paths).toHaveLength(2);
    });
  });

  describe('ConflictCheck', () => {
    it('should represent no conflict', () => {
      const check: ConflictCheck = {
        hasConflict: false,
        conflicts: [],
        message: 'No conflicts'
      };

      expect(check.hasConflict).toBe(false);
    });

    it('should represent conflicts', () => {
      const check: ConflictCheck = {
        hasConflict: true,
        conflicts: [],
        message: 'Conflicts found'
      };

      expect(check.hasConflict).toBe(true);
    });
  });

  describe('MailboxStats', () => {
    it('should provide stats structure', () => {
      const stats: MailboxStats = {
        totalMessages: 10,
        unreadCount: 3,
        threadCount: 5,
        lastMessageAt: Date.now()
      };

      expect(stats.totalMessages).toBe(10);
      expect(stats.unreadCount).toBe(3);
    });
  });
});
