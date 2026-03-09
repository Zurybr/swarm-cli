/**
 * Swarm Mail - Mailbox
 * Inbox/outbox operations for agent messaging
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Message,
  MessageType,
  MessagePriority,
  MessageStatus,
  MessageCompose,
  InboxQuery,
  MailboxStats,
  MailboxConfig
} from './types';
import { ThreadManager } from './threads';

export class Mailbox {
  private config: MailboxConfig;
  private inboxPath: string;
  private outboxPath: string;
  private threadManager: ThreadManager;

  constructor(config: MailboxConfig) {
    this.config = {
      maxMessages: 1000,
      retentionDays: 30,
      ...config
    };

    this.inboxPath = path.join(config.storagePath, 'inbox');
    this.outboxPath = path.join(config.storagePath, 'outbox');
    this.threadManager = new ThreadManager(config.storagePath);

    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.inboxPath)) {
      fs.mkdirSync(this.inboxPath, { recursive: true });
    }
    if (!fs.existsSync(this.outboxPath)) {
      fs.mkdirSync(this.outboxPath, { recursive: true });
    }
  }

  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send a message (adds to sender's outbox and recipient's inbox)
   */
  send(compose: MessageCompose): Message {
    const message: Message = {
      id: this.generateId(),
      type: compose.type || 'direct',
      priority: compose.priority || 'normal',
      status: 'unread',
      from: this.config.agentName,
      to: compose.to,
      subject: compose.subject,
      body: compose.body,
      attachments: compose.attachments,
      timestamp: Date.now(),
      replyTo: compose.replyTo,
      metadata: compose.metadata
    };

    // Handle threading
    let threadId = compose.threadId;
    if (!threadId && compose.replyTo) {
      // Find thread from parent message
      const parent = this.get(compose.replyTo);
      if (parent) {
        threadId = parent.threadId;
      }
    }

    if (threadId) {
      message.threadId = threadId;
      this.threadManager.addMessage(threadId, message.id, this.config.agentName);
    } else if (message.type === 'direct' || message.type === 'broadcast') {
      // Create new thread for new conversations
      const thread = this.threadManager.getOrCreateForMessage(message);
      message.threadId = thread.id;
      this.threadManager.addMessage(thread.id, message.id, this.config.agentName);
    }

    // Save to outbox (sender's copy)
    this.saveToOutbox(message);

    // Save to inbox(es) (recipient's copy)
    const recipients = Array.isArray(compose.to) ? compose.to : [compose.to];
    for (const recipient of recipients) {
      if (recipient === 'broadcast') {
        // Broadcast messages go to a special broadcast folder
        this.saveToBroadcast(message);
      } else {
        this.saveToInbox(message, recipient);
      }
    }

    return message;
  }

  /**
   * Get a message by ID (searches inbox and outbox)
   */
  get(messageId: string): Message | undefined {
    // Check inbox first
    const inboxPath = path.join(this.inboxPath, `${messageId}.json`);
    if (fs.existsSync(inboxPath)) {
      try {
        const data = fs.readFileSync(inboxPath, 'utf-8');
        return JSON.parse(data) as Message;
      } catch {
        return undefined;
      }
    }

    // Check outbox
    const outboxPath = path.join(this.outboxPath, `${messageId}.json`);
    if (fs.existsSync(outboxPath)) {
      try {
        const data = fs.readFileSync(outboxPath, 'utf-8');
        return JSON.parse(data) as Message;
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Get inbox messages
   */
  getInbox(query: InboxQuery = {}): Message[] {
    return this.queryInbox(this.inboxPath, query);
  }

  /**
   * Get outbox messages
   */
  getOutbox(query: InboxQuery = {}): Message[] {
    return this.queryInbox(this.outboxPath, query);
  }

  /**
   * Get broadcast messages
   */
  getBroadcasts(query: InboxQuery = {}): Message[] {
    const broadcastPath = path.join(this.config.storagePath, 'broadcast');
    if (!fs.existsSync(broadcastPath)) {
      return [];
    }
    return this.queryInbox(broadcastPath, query);
  }

  /**
   * Mark a message as read
   */
  markAsRead(messageId: string): boolean {
    const message = this.get(messageId);
    if (!message) {
      return false;
    }

    message.status = 'read';
    message.readAt = Date.now();

    // Update in all locations
    this.saveToInbox(message, this.extractRecipient(message));
    return true;
  }

  /**
   * Mark a message as archived
   */
  archive(messageId: string): boolean {
    const message = this.get(messageId);
    if (!message) {
      return false;
    }

    message.status = 'archived';
    this.saveToInbox(message, this.extractRecipient(message));
    return true;
  }

  /**
   * Reply to a message
   */
  reply(originalMessageId: string, body: string, subject?: string): Message | undefined {
    const original = this.get(originalMessageId);
    if (!original) {
      return undefined;
    }

    // Determine recipient (reply to sender)
    const to = original.from;

    // Use original subject if not provided
    const replySubject = subject || (original.subject.startsWith('Re: ')
      ? original.subject
      : `Re: ${original.subject}`);

    return this.send({
      to,
      subject: replySubject,
      body,
      type: 'direct',
      replyTo: originalMessageId,
      threadId: original.threadId
    });
  }

  /**
   * Send a broadcast message to all agents
   */
  broadcast(subject: string, body: string, priority: MessagePriority = 'normal', metadata?: Record<string, any>): Message {
    return this.send({
      to: 'broadcast',
      subject,
      body,
      type: 'broadcast',
      priority,
      metadata
    });
  }

  /**
   * Send a system event message
   */
  sendSystemEvent(subject: string, body: string, to: string | string[], metadata?: Record<string, any>): Message {
    return this.send({
      to,
      subject,
      body,
      type: 'system',
      priority: 'normal',
      metadata
    });
  }

  /**
   * Send a blocker notification
   */
  sendBlocker(subject: string, body: string, to: string, metadata?: Record<string, any>): Message {
    return this.send({
      to,
      subject,
      body,
      type: 'blocker',
      priority: 'urgent',
      metadata
    });
  }

  /**
   * Send a progress update
   */
  sendProgress(taskId: string, progressPercent: number, message: string, to: string): Message {
    return this.send({
      to,
      subject: `Progress Update: ${taskId}`,
      body: message,
      type: 'progress',
      priority: 'low',
      metadata: { taskId, progressPercent }
    });
  }

  /**
   * Get unread message count
   */
  getUnreadCount(): number {
    return this.getInbox({ unreadOnly: true }).length;
  }

  /**
   * Get mailbox statistics
   */
  getStats(): MailboxStats {
    const inbox = this.getInbox();
    const unreadCount = inbox.filter(m => m.status === 'unread').length;

    return {
      totalMessages: inbox.length,
      unreadCount,
      threadCount: this.threadManager.count(),
      lastMessageAt: inbox.length > 0
        ? Math.max(...inbox.map(m => m.timestamp))
        : undefined
    };
  }

  /**
   * Delete a message
   */
  delete(messageId: string): boolean {
    let deleted = false;

    // Try inbox
    const inboxPath = path.join(this.inboxPath, `${messageId}.json`);
    if (fs.existsSync(inboxPath)) {
      fs.unlinkSync(inboxPath);
      deleted = true;
    }

    // Try outbox
    const outboxPath = path.join(this.outboxPath, `${messageId}.json`);
    if (fs.existsSync(outboxPath)) {
      fs.unlinkSync(outboxPath);
      deleted = true;
    }

    return deleted;
  }

  /**
   * Clean up old messages
   */
  cleanup(): number {
    if (!this.config.retentionDays) {
      return 0;
    }

    const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    let cleaned = 0;

    // Clean inbox
    const inboxMessages = this.getInbox();
    for (const message of inboxMessages) {
      if (message.timestamp < cutoff && message.status === 'archived') {
        this.delete(message.id);
        cleaned++;
      }
    }

    // Clean outbox
    const outboxMessages = this.getOutbox();
    for (const message of outboxMessages) {
      if (message.timestamp < cutoff) {
        this.delete(message.id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get thread manager
   */
  getThreadManager(): ThreadManager {
    return this.threadManager;
  }

  private saveToInbox(message: Message, recipient?: string): void {
    const inboxPath = path.join(this.inboxPath, `${message.id}.json`);
    fs.writeFileSync(inboxPath, JSON.stringify(message, null, 2));
  }

  private saveToOutbox(message: Message): void {
    const outboxPath = path.join(this.outboxPath, `${message.id}.json`);
    fs.writeFileSync(outboxPath, JSON.stringify(message, null, 2));
  }

  private saveToBroadcast(message: Message): void {
    const broadcastPath = path.join(this.config.storagePath, 'broadcast');
    if (!fs.existsSync(broadcastPath)) {
      fs.mkdirSync(broadcastPath, { recursive: true });
    }
    const messagePath = path.join(broadcastPath, `${message.id}.json`);
    fs.writeFileSync(messagePath, JSON.stringify(message, null, 2));
  }

  private extractRecipient(message: Message): string | undefined {
    if (Array.isArray(message.to)) {
      return message.to.find(r => r !== this.config.agentName);
    }
    return message.to === this.config.agentName ? undefined : message.to;
  }

  private queryInbox(searchPath: string, query: InboxQuery): Message[] {
    const messages: Message[] = [];

    if (!fs.existsSync(searchPath)) {
      return messages;
    }

    const files = fs.readdirSync(searchPath);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const messagePath = path.join(searchPath, file);
      try {
        const data = fs.readFileSync(messagePath, 'utf-8');
        const message = JSON.parse(data) as Message;

        if (this.matchesQuery(message, query)) {
          messages.push(message);
        }
      } catch {
        // Skip invalid files
      }
    }

    // Sort by timestamp descending
    messages.sort((a, b) => b.timestamp - a.timestamp);

    if (query.limit) {
      return messages.slice(0, query.limit);
    }

    return messages;
  }

  private matchesQuery(message: Message, query: InboxQuery): boolean {
    if (query.type && message.type !== query.type) {
      return false;
    }

    if (query.status && message.status !== query.status) {
      return false;
    }

    if (query.priority && message.priority !== query.priority) {
      return false;
    }

    if (query.from && message.from !== query.from) {
      return false;
    }

    if (query.since && message.timestamp < query.since) {
      return false;
    }

    if (query.until && message.timestamp > query.until) {
      return false;
    }

    if (query.unreadOnly && message.status !== 'unread') {
      return false;
    }

    return true;
  }
}
