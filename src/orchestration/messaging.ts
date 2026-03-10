/**
 * Agent Communication System
 * Handles agent-to-agent messaging, broadcast, and message routing
 */

import { EventEmitter } from 'events';
import {
  Message,
  MessageType,
  Agent,
  Task,
  MessageSendRequest,
} from './types';
import { SwarmManager } from './swarm';
import { v4 as uuidv4 } from '../utils/uuid';

/** Message filter options */
export interface MessageFilter {
  from?: string;
  to?: string;
  type?: MessageType;
  taskId?: string;
  threadId?: string;
  priority?: Message['priority'];
  unreadOnly?: boolean;
  since?: Date;
  until?: Date;
}

/** Message delivery result */
export interface MessageDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveredAt?: Date;
}

/** Message thread */
export interface MessageThread {
  id: string;
  subject: string;
  participants: string[];
  messages: Message[];
  createdAt: Date;
  lastActivityAt: Date;
  messageCount: number;
}

/** Messaging system options */
export interface MessagingOptions {
  /** Maximum messages to retain per swarm */
  maxMessages?: number;
  /** Enable message persistence */
  persistMessages?: boolean;
  /** Default message priority */
  defaultPriority?: Message['priority'];
  /** Enable delivery confirmations */
  deliveryConfirmations?: boolean;
}

/** Default messaging options */
const DEFAULT_OPTIONS: MessagingOptions = {
  maxMessages: 10000,
  persistMessages: true,
  defaultPriority: 'normal',
  deliveryConfirmations: true,
};

/**
 * Agent Messaging System - handles inter-agent communication
 */
export class MessagingSystem extends EventEmitter {
  private swarm: SwarmManager;
  private options: MessagingOptions;
  private threads: Map<string, MessageThread> = new Map();
  private deliveryCallbacks: Map<string, (result: MessageDeliveryResult) => void> = new Map();

  constructor(swarm: SwarmManager, options: MessagingOptions = {}) {
    super();
    this.swarm = swarm;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for swarm events
   */
  private setupEventListeners(): void {
    this.swarm.on('task_assigned', (event) => {
      // Send notification to assigned agent
      this.send({
        type: 'task_assignment',
        from: 'coordinator',
        to: event.agentId,
        subject: 'New Task Assigned',
        content: `You have been assigned task ${event.taskId}`,
        taskId: event.taskId,
        priority: 'high',
      });
    });

    this.swarm.on('task_completed', (event) => {
      // Notify coordinator and dependents
      const task = this.swarm.getTask(event.taskId);
      if (task) {
        this.send({
          type: 'task_completion',
          from: task.assignedTo || 'unknown',
          to: 'coordinator',
          subject: 'Task Completed',
          content: `Task ${event.taskId} completed successfully`,
          taskId: event.taskId,
          priority: 'normal',
        });
      }
    });
  }

  /**
   * Send a message
   */
  send(request: MessageSendRequest): MessageDeliveryResult {
    try {
      // Validate sender and recipient
      if (request.from !== 'coordinator' && request.from !== 'broadcast') {
        const sender = this.swarm.getAgent(request.from);
        if (!sender) {
          return {
            success: false,
            error: `Sender agent not found: ${request.from}`,
          };
        }

        if (sender.status === 'offline' || sender.status === 'error') {
          return {
            success: false,
            error: `Sender agent is not active: ${request.from}`,
          };
        }
      }

      if (request.to !== 'broadcast' && request.to !== 'coordinator') {
        const recipient = this.swarm.getAgent(request.to);
        if (!recipient) {
          return {
            success: false,
            error: `Recipient agent not found: ${request.to}`,
          };
        }
      }

      // Create message
      const message: Message = {
        id: uuidv4(),
        type: request.type,
        from: request.from,
        to: request.to,
        subject: request.subject,
        content: request.content,
        priority: request.priority || this.options.defaultPriority!,
        taskId: request.taskId,
        threadId: request.threadId,
        metadata: request.metadata,
        timestamp: new Date(),
        read: false,
      };

      // Handle broadcast
      if (request.to === 'broadcast') {
        return this.broadcast(message);
      }

      // Add message to swarm
      this.swarm.addMessage(message);

      // Update thread
      this.updateThread(message);

      // Emit event
      this.emit('message_sent', { message });

      // Notify recipient
      this.notifyRecipient(message);

      return {
        success: true,
        messageId: message.id,
        deliveredAt: message.timestamp,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Broadcast a message to all agents
   */
  private broadcast(message: Message): MessageDeliveryResult {
    const agents = this.swarm.getAllAgents();
    let deliveredCount = 0;

    for (const agent of agents) {
      if (agent.status !== 'offline') {
        const agentMessage: Message = {
          ...message,
          id: uuidv4(),
          to: agent.id,
        };

        this.swarm.addMessage(agentMessage);
        deliveredCount++;
      }
    }

    this.emit('message_broadcast', {
      originalMessage: message,
      deliveredCount,
    });

    return {
      success: true,
      messageId: message.id,
      deliveredAt: message.timestamp,
    };
  }

  /**
   * Reply to a message
   */
  reply(
    originalMessageId: string,
    content: string,
    options?: {
      subject?: string;
      priority?: Message['priority'];
      metadata?: Record<string, unknown>;
    }
  ): MessageDeliveryResult {
    const originalMessage = this.findMessage(originalMessageId);
    if (!originalMessage) {
      return {
        success: false,
        error: `Original message not found: ${originalMessageId}`,
      };
    }

    return this.send({
      type: 'direct',
      from: originalMessage.to,
      to: originalMessage.from,
      subject: options?.subject || `Re: ${originalMessage.subject}`,
      content,
      priority: options?.priority || originalMessage.priority,
      threadId: originalMessage.threadId,
      metadata: options?.metadata,
    });
  }

  /**
   * Send a request for help
   */
  requestHelp(
    fromAgentId: string,
    taskId: string,
    description: string,
    options?: {
      priority?: Message['priority'];
      requiredCapabilities?: string[];
    }
  ): MessageDeliveryResult {
    return this.send({
      type: 'request_help',
      from: fromAgentId,
      to: 'coordinator',
      subject: 'Help Request',
      content: description,
      taskId,
      priority: options?.priority || 'high',
      metadata: {
        requiredCapabilities: options?.requiredCapabilities,
      },
    });
  }

  /**
   * Provide help to another agent
   */
  provideHelp(
    fromAgentId: string,
    toAgentId: string,
    helpRequestMessageId: string,
    content: string
  ): MessageDeliveryResult {
    const helpRequest = this.findMessage(helpRequestMessageId);

    return this.send({
      type: 'provide_help',
      from: fromAgentId,
      to: toAgentId,
      subject: 'Help Response',
      content,
      taskId: helpRequest?.taskId,
      priority: 'high',
      metadata: {
        inReplyTo: helpRequestMessageId,
      },
    });
  }

  /**
   * Send a status update
   */
  sendStatusUpdate(
    agentId: string,
    status: string,
    details?: Record<string, unknown>
  ): MessageDeliveryResult {
    return this.send({
      type: 'status_update',
      from: agentId,
      to: 'coordinator',
      subject: 'Status Update',
      content: status,
      priority: 'normal',
      metadata: details,
    });
  }

  /**
   * Send a coordination message
   */
  sendCoordinationMessage(
    fromAgentId: string,
    toAgentId: string,
    subject: string,
    content: string,
    options?: {
      taskId?: string;
      priority?: Message['priority'];
    }
  ): MessageDeliveryResult {
    return this.send({
      type: 'coordination',
      from: fromAgentId,
      to: toAgentId,
      subject,
      content,
      taskId: options?.taskId,
      priority: options?.priority || 'normal',
    });
  }

  /**
   * Find a message by ID
   */
  private findMessage(messageId: string): Message | undefined {
    // Search in swarm messages
    const messages = this.getAllMessages();
    return messages.find((m) => m.id === messageId);
  }

  /**
   * Get all messages
   */
  getAllMessages(): Message[] {
    // Access swarm messages through the swarm manager
    const swarmState = (this.swarm as unknown as { swarm: { messages: Message[] } }).swarm;
    return swarmState?.messages || [];
  }

  /**
   * Get messages for an agent
   */
  getMessagesForAgent(agentId: string, filter?: Omit<MessageFilter, 'to'>): Message[] {
    let messages = this.swarm.getMessagesForAgent(agentId, filter?.unreadOnly);

    if (filter) {
      messages = this.applyFilter(messages, { ...filter, to: agentId });
    }

    return messages;
  }

  /**
   * Get messages from an agent
   */
  getMessagesFromAgent(agentId: string, filter?: Omit<MessageFilter, 'from'>): Message[] {
    let messages = this.getAllMessages().filter((m) => m.from === agentId);

    if (filter) {
      messages = this.applyFilter(messages, { ...filter, from: agentId });
    }

    return messages;
  }

  /**
   * Get messages for a task
   */
  getMessagesForTask(taskId: string, filter?: Omit<MessageFilter, 'taskId'>): Message[] {
    let messages = this.getAllMessages().filter((m) => m.taskId === taskId);

    if (filter) {
      messages = this.applyFilter(messages, { ...filter, taskId });
    }

    return messages;
  }

  /**
   * Get messages in a thread
   */
  getThreadMessages(threadId: string): Message[] {
    const thread = this.threads.get(threadId);
    return thread ? thread.messages : [];
  }

  /**
   * Get all threads
   */
  getAllThreads(): MessageThread[] {
    return Array.from(this.threads.values());
  }

  /**
   * Get thread by ID
   */
  getThread(threadId: string): MessageThread | undefined {
    return this.threads.get(threadId);
  }

  /**
   * Mark message as read
   */
  markAsRead(messageId: string): boolean {
    return this.swarm.markMessageRead(messageId);
  }

  /**
   * Mark all messages as read for an agent
   */
  markAllAsRead(agentId: string): number {
    const messages = this.getMessagesForAgent(agentId, { unreadOnly: true });
    let count = 0;

    for (const message of messages) {
      if (this.markAsRead(message.id)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Get unread message count for an agent
   */
  getUnreadCount(agentId: string): number {
    return this.getMessagesForAgent(agentId, { unreadOnly: true }).length;
  }

  /**
   * Apply filters to messages
   */
  private applyFilter(messages: Message[], filter: MessageFilter): Message[] {
    return messages.filter((message) => {
      if (filter.from && message.from !== filter.from) return false;
      if (filter.to && message.to !== filter.to) return false;
      if (filter.type && message.type !== filter.type) return false;
      if (filter.taskId && message.taskId !== filter.taskId) return false;
      if (filter.threadId && message.threadId !== filter.threadId) return false;
      if (filter.priority && message.priority !== filter.priority) return false;
      if (filter.unreadOnly && message.read) return false;
      if (filter.since && message.timestamp < filter.since) return false;
      if (filter.until && message.timestamp > filter.until) return false;
      return true;
    });
  }

  /**
   * Update or create a thread for a message
   */
  private updateThread(message: Message): void {
    const threadId = message.threadId || message.id;

    let thread = this.threads.get(threadId);
    if (!thread) {
      thread = {
        id: threadId,
        subject: message.subject,
        participants: [message.from, message.to],
        messages: [],
        createdAt: message.timestamp,
        lastActivityAt: message.timestamp,
        messageCount: 0,
      };
      this.threads.set(threadId, thread);
    }

    thread.messages.push(message);
    thread.lastActivityAt = message.timestamp;
    thread.messageCount++;

    // Update participants
    if (!thread.participants.includes(message.from)) {
      thread.participants.push(message.from);
    }
    if (!thread.participants.includes(message.to) && message.to !== 'broadcast') {
      thread.participants.push(message.to);
    }
  }

  /**
   * Notify recipient of new message
   */
  private notifyRecipient(message: Message): void {
    // Emit event for the specific recipient
    this.emit(`message:${message.to}`, { message });

    // Also emit general notification
    this.emit('message_received', { message });
  }

  /**
   * Clean up old messages
   */
  cleanup(maxAge?: number): number {
    const messages = this.getAllMessages();
    const now = new Date();
    const maxAgeMs = maxAge || 24 * 60 * 60 * 1000; // Default 24 hours

    let removedCount = 0;
    const swarmState = (this.swarm as unknown as { swarm: { messages: Message[] } }).swarm;

    if (swarmState?.messages) {
      swarmState.messages = messages.filter((message) => {
        const age = now.getTime() - message.timestamp.getTime();
        if (age > maxAgeMs && message.read) {
          removedCount++;
          return false;
        }
        return true;
      });
    }

    // Clean up empty threads
    for (const [threadId, thread] of this.threads.entries()) {
      if (thread.messages.length === 0) {
        this.threads.delete(threadId);
      }
    }

    this.emit('messages_cleaned', { removedCount });

    return removedCount;
  }

  /**
   * Get messaging statistics
   */
  getStats(): {
    totalMessages: number;
    unreadMessages: number;
    threadCount: number;
    messagesByType: Record<MessageType, number>;
    messagesByPriority: Record<Message['priority'], number>;
  } {
    const messages = this.getAllMessages();

    const messagesByType = {} as Record<MessageType, number>;
    const messagesByPriority = {} as Record<Message['priority'], number>;

    for (const message of messages) {
      messagesByType[message.type] = (messagesByType[message.type] || 0) + 1;
      messagesByPriority[message.priority] =
        (messagesByPriority[message.priority] || 0) + 1;
    }

    return {
      totalMessages: messages.length,
      unreadMessages: messages.filter((m) => !m.read).length,
      threadCount: this.threads.size,
      messagesByType,
      messagesByPriority,
    };
  }

  /**
   * Wait for a response to a message
   */
  async waitForResponse(
    messageId: string,
    timeout: number = 30000
  ): Promise<Message | undefined> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.off('message_received', handler);
        resolve(undefined);
      }, timeout);

      const handler = (event: { message: Message }) => {
        if (event.message.inReplyTo === messageId) {
          clearTimeout(timeoutId);
          this.off('message_received', handler);
          resolve(event.message);
        }
      };

      this.on('message_received', handler);
    });
  }

  /**
   * Create a conversation between agents
   */
  async createConversation(
    participants: string[],
    subject: string,
    initialMessage: string,
    options?: {
      taskId?: string;
      priority?: Message['priority'];
    }
  ): Promise<string> {
    const threadId = uuidv4();

    // Send initial message from first participant to others
    for (let i = 1; i < participants.length; i++) {
      this.send({
        type: 'coordination',
        from: participants[0],
        to: participants[i],
        subject,
        content: initialMessage,
        threadId,
        taskId: options?.taskId,
        priority: options?.priority || 'normal',
      });
    }

    return threadId;
  }
}

