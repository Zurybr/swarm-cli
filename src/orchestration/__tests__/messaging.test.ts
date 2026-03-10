/**
 * Tests for messaging system
 */

import { MessagingSystem } from '../messaging';
import { SwarmManager, createSwarm } from '../swarm';
import { MessageType } from '../types';

describe('MessagingSystem', () => {
  let swarm: SwarmManager;
  let messaging: MessagingSystem;

  beforeEach(() => {
    swarm = createSwarm('Test Swarm', { maxAgents: 10 });
    messaging = new MessagingSystem(swarm);
  });

  afterEach(async () => {
    if (swarm.getStatus() !== 'terminated') {
      await swarm.shutdown(false);
    }
  });

  describe('send', () => {
    it('should send a message between agents', () => {
      const agent1 = swarm.registerAgent({ type: 'executor' });
      const agent2 = swarm.registerAgent({ type: 'tester' });

      const result = messaging.send({
        type: 'direct',
        from: agent1.id,
        to: agent2.id,
        subject: 'Test Message',
        content: 'Hello!',
        priority: 'normal',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should fail when sender does not exist', () => {
      const agent = swarm.registerAgent({ type: 'tester' });

      const result = messaging.send({
        type: 'direct',
        from: 'non-existent',
        to: agent.id,
        subject: 'Test',
        content: 'Hello!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Sender agent not found');
    });

    it('should fail when recipient does not exist', () => {
      const agent = swarm.registerAgent({ type: 'executor' });

      const result = messaging.send({
        type: 'direct',
        from: agent.id,
        to: 'non-existent',
        subject: 'Test',
        content: 'Hello!',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Recipient agent not found');
    });

    it('should handle broadcast messages', () => {
      swarm.registerAgent({ type: 'executor' });
      swarm.registerAgent({ type: 'tester' });
      const sender = swarm.registerAgent({ type: 'coordinator' });

      const result = messaging.send({
        type: 'broadcast',
        from: sender.id,
        to: 'broadcast',
        subject: 'Announcement',
        content: 'Hello everyone!',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('reply', () => {
    it('should reply to a message', () => {
      const agent1 = swarm.registerAgent({ type: 'executor' });
      const agent2 = swarm.registerAgent({ type: 'tester' });

      const sendResult = messaging.send({
        type: 'direct',
        from: agent1.id,
        to: agent2.id,
        subject: 'Question',
        content: 'How do I test this?',
      });

      const replyResult = messaging.reply(sendResult.messageId!, 'Here is how...');

      expect(replyResult.success).toBe(true);
    });

    it('should fail when original message does not exist', () => {
      const result = messaging.reply('non-existent', 'Reply');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('requestHelp', () => {
    it('should send help request to coordinator', () => {
      const agent = swarm.registerAgent({ type: 'executor' });
      const task = swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      const result = messaging.requestHelp(
        agent.id,
        task.id,
        'Need help with testing'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('provideHelp', () => {
    it('should send help response', () => {
      const agent1 = swarm.registerAgent({ type: 'executor' });
      const agent2 = swarm.registerAgent({ type: 'tester' });
      const task = swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      const requestResult = messaging.requestHelp(
        agent1.id,
        task.id,
        'Need help'
      );

      const responseResult = messaging.provideHelp(
        agent2.id,
        agent1.id,
        requestResult.messageId!,
        'Here is the solution'
      );

      expect(responseResult.success).toBe(true);
    });
  });

  describe('getMessagesForAgent', () => {
    it('should get messages for an agent', () => {
      const agent1 = swarm.registerAgent({ type: 'executor' });
      const agent2 = swarm.registerAgent({ type: 'tester' });

      messaging.send({
        type: 'direct',
        from: agent1.id,
        to: agent2.id,
        subject: 'Test',
        content: 'Hello!',
      });

      const messages = messaging.getMessagesForAgent(agent2.id);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello!');
    });

    it('should filter unread messages', () => {
      const agent1 = swarm.registerAgent({ type: 'executor' });
      const agent2 = swarm.registerAgent({ type: 'tester' });

      messaging.send({
        type: 'direct',
        from: agent1.id,
        to: agent2.id,
        subject: 'Test',
        content: 'Hello!',
      });

      const unreadMessages = messaging.getMessagesForAgent(agent2.id, { unreadOnly: true });
      expect(unreadMessages).toHaveLength(1);

      messaging.markAsRead(unreadMessages[0].id);

      const newUnreadMessages = messaging.getMessagesForAgent(agent2.id, { unreadOnly: true });
      expect(newUnreadMessages).toHaveLength(0);
    });
  });

  describe('getThreadMessages', () => {
    it('should get messages in a thread', () => {
      const agent1 = swarm.registerAgent({ type: 'executor' });
      const agent2 = swarm.registerAgent({ type: 'tester' });

      const result = messaging.send({
        type: 'direct',
        from: agent1.id,
        to: agent2.id,
        subject: 'Thread Test',
        content: 'First message',
      });

      const threadId = messaging.getAllMessages().find(m => m.id === result.messageId)?.threadId;

      if (threadId) {
        const messages = messaging.getThreadMessages(threadId);
        expect(messages).toHaveLength(1);
      }
    });
  });

  describe('markAsRead', () => {
    it('should mark message as read', () => {
      const agent1 = swarm.registerAgent({ type: 'executor' });
      const agent2 = swarm.registerAgent({ type: 'tester' });

      const result = messaging.send({
        type: 'direct',
        from: agent1.id,
        to: agent2.id,
        subject: 'Test',
        content: 'Hello!',
      });

      const success = messaging.markAsRead(result.messageId!);

      expect(success).toBe(true);
    });

    it('should return false for non-existent message', () => {
      const success = messaging.markAsRead('non-existent');
      expect(success).toBe(false);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread message count', () => {
      const agent1 = swarm.registerAgent({ type: 'executor' });
      const agent2 = swarm.registerAgent({ type: 'tester' });

      messaging.send({
        type: 'direct',
        from: agent1.id,
        to: agent2.id,
        subject: 'Test 1',
        content: 'Hello!',
      });

      messaging.send({
        type: 'direct',
        from: agent1.id,
        to: agent2.id,
        subject: 'Test 2',
        content: 'Hello again!',
      });

      const count = messaging.getUnreadCount(agent2.id);

      expect(count).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return messaging statistics', () => {
      const agent1 = swarm.registerAgent({ type: 'executor' });
      const agent2 = swarm.registerAgent({ type: 'tester' });

      messaging.send({
        type: 'direct',
        from: agent1.id,
        to: agent2.id,
        subject: 'Test',
        content: 'Hello!',
        priority: 'high',
      });

      const stats = messaging.getStats();

      expect(stats.totalMessages).toBe(1);
      expect(stats.unreadMessages).toBe(1);
      expect(stats.threadCount).toBeGreaterThan(0);
      expect(stats.messagesByPriority.high).toBe(1);
    });
  });

  describe('createConversation', () => {
    it('should create a conversation between agents', async () => {
      const agent1 = swarm.registerAgent({ type: 'coordinator' });
      const agent2 = swarm.registerAgent({ type: 'executor' });
      const agent3 = swarm.registerAgent({ type: 'tester' });

      const threadId = await messaging.createConversation(
        [agent1.id, agent2.id, agent3.id],
        'Project Discussion',
        'Let us discuss the implementation'
      );

      expect(threadId).toBeDefined();

      const thread = messaging.getThread(threadId);
      expect(thread).toBeDefined();
      expect(thread?.participants).toContain(agent1.id);
      expect(thread?.participants).toContain(agent2.id);
    });
  });
});
