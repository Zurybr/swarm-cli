/**
 * Swarm Mail - Agent Coordination System
 * Inter-agent messaging, file reservations, and notifications
 *
 * @example
 * ```typescript
 * import { SwarmMail, MessagePriority } from './swarm-mail';
 *
 * const mail = new SwarmMail({
 *   agentName: 'worker-1',
 *   storagePath: './.swarm'
 * });
 *
 * // Send a direct message
 * mail.send({
 *   to: 'worker-2',
 *   subject: 'Hello',
 *   body: 'Can you help with this?'
 * });
 *
 * // Reserve files for editing
 * mail.reserve(['src/file.ts'], { reason: 'Implementing feature' });
 *
 * // Check inbox
 * const messages = mail.getInbox({ unreadOnly: true });
 * ```
 */

// Core types
export {
  Message,
  MessageType,
  MessagePriority,
  MessageStatus,
  Thread,
  FileReservation,
  ReservationStatus,
  Notification,
  MessageAttachment,
  MessageCompose,
  InboxQuery,
  ReservationQuery,
  ThreadQuery,
  ReservationRequest,
  ConflictCheck,
  MailboxStats,
  MailboxConfig
} from './types';

// Core classes
export { Mailbox } from './mailbox';
export { ThreadManager } from './threads';
export { ReservationManager } from './reservations';
export { NotificationManager, NotificationBus, NotificationHandler } from './notifications';

import { Mailbox } from './mailbox';
import { ReservationManager } from './reservations';
import { NotificationManager, NotificationHandler } from './notifications';
import {
  MailboxConfig,
  MessageCompose,
  Message,
  InboxQuery,
  ReservationRequest,
  FileReservation,
  ConflictCheck,
  Thread,
  ThreadQuery,
  Notification
} from './types';

/**
 * Main SwarmMail class - combines mailbox, reservations, and notifications
 */
export class SwarmMail {
  private mailbox: Mailbox;
  private reservations: ReservationManager;
  private notifications: NotificationManager;
  private config: MailboxConfig;

  constructor(config: MailboxConfig) {
    this.config = config;
    this.mailbox = new Mailbox(config);
    this.reservations = new ReservationManager(config.storagePath);
    this.notifications = new NotificationManager(config.storagePath, config.agentName, this.mailbox);
  }

  // ==================== Messaging ====================

  /**
   * Send a message to another agent
   */
  send(compose: MessageCompose): Message {
    const message = this.mailbox.send(compose);

    // Notify recipients
    const recipients = Array.isArray(compose.to) ? compose.to : [compose.to];
    for (const recipient of recipients) {
      if (recipient !== 'broadcast') {
        this.notifications.notifyMessage(this.config.agentName, compose.subject, message.id);
      }
    }

    return message;
  }

  /**
   * Get a message by ID
   */
  getMessage(messageId: string): Message | undefined {
    return this.mailbox.get(messageId);
  }

  /**
   * Get inbox messages
   */
  getInbox(query?: InboxQuery): Message[] {
    return this.mailbox.getInbox(query);
  }

  /**
   * Get outbox messages
   */
  getOutbox(query?: InboxQuery): Message[] {
    return this.mailbox.getOutbox(query);
  }

  /**
   * Get broadcast messages
   */
  getBroadcasts(query?: InboxQuery): Message[] {
    return this.mailbox.getBroadcasts(query);
  }

  /**
   * Mark a message as read
   */
  markAsRead(messageId: string): boolean {
    return this.mailbox.markAsRead(messageId);
  }

  /**
   * Archive a message
   */
  archiveMessage(messageId: string): boolean {
    return this.mailbox.archive(messageId);
  }

  /**
   * Reply to a message
   */
  reply(originalMessageId: string, body: string, subject?: string): Message | undefined {
    return this.mailbox.reply(originalMessageId, body, subject);
  }

  /**
   * Send a broadcast to all agents
   */
  broadcast(subject: string, body: string, priority?: 'low' | 'normal' | 'high' | 'urgent', metadata?: Record<string, any>): Message {
    return this.mailbox.broadcast(subject, body, priority, metadata);
  }

  /**
   * Send a system event
   */
  sendSystemEvent(subject: string, body: string, to: string | string[], metadata?: Record<string, any>): Message {
    return this.mailbox.sendSystemEvent(subject, body, to, metadata);
  }

  /**
   * Send a blocker notification
   */
  sendBlocker(subject: string, body: string, to: string, metadata?: Record<string, any>): Message {
    const message = this.mailbox.sendBlocker(subject, body, to, metadata);
    this.notifications.notifyBlocker(body, metadata?.taskId);
    return message;
  }

  /**
   * Send progress update
   */
  sendProgress(taskId: string, progressPercent: number, message: string, to: string): Message {
    const msg = this.mailbox.sendProgress(taskId, progressPercent, message, to);
    this.notifications.notifyProgress(taskId, progressPercent, message);
    return msg;
  }

  /**
   * Get unread count
   */
  getUnreadCount(): number {
    return this.mailbox.getUnreadCount();
  }

  // ==================== Reservations ====================

  /**
   * Reserve files for exclusive editing
   */
  reserve(paths: string | string[], options: { reason?: string; ttlSeconds?: number; exclusive?: boolean } = {}): { success: boolean; reservations: FileReservation[]; conflicts: ConflictCheck } {
    const request: ReservationRequest = {
      paths,
      reason: options.reason,
      ttlSeconds: options.ttlSeconds,
      exclusive: options.exclusive ?? true
    };

    const result = this.reservations.reserve(this.config.agentName, request);

    if (result.success) {
      this.notifications.notifySystem(
        'File Reserved',
        `Reserved ${Array.isArray(paths) ? paths.join(', ') : paths}`,
        { paths, reason: options.reason }
      );
    }

    return result;
  }

  /**
   * Release a reservation
   */
  releaseReservation(reservationId: string): boolean {
    return this.reservations.release(reservationId, this.config.agentName);
  }

  /**
   * Release all reservations for this agent
   */
  releaseAllReservations(): number {
    return this.reservations.releaseAll(this.config.agentName);
  }

  /**
   * Check for conflicts before editing
   */
  checkConflicts(paths: string | string[]): ConflictCheck {
    return this.reservations.checkConflicts(paths, this.config.agentName);
  }

  /**
   * Check if can edit a file
   */
  canEdit(filePath: string): boolean {
    return this.reservations.canEdit(filePath, this.config.agentName);
  }

  /**
   * Get active reservations for this agent
   */
  getMyReservations(): FileReservation[] {
    return this.reservations.getForAgent(this.config.agentName);
  }

  // ==================== Threads ====================

  /**
   * Get a thread by ID
   */
  getThread(threadId: string): Thread | undefined {
    return this.mailbox.getThreadManager().get(threadId);
  }

  /**
   * Query threads
   */
  queryThreads(query?: ThreadQuery): Thread[] {
    return this.mailbox.getThreadManager().query(query);
  }

  /**
   * Get threads for this agent
   */
  getMyThreads(): Thread[] {
    return this.mailbox.getThreadManager().getForAgent(this.config.agentName);
  }

  // ==================== Notifications ====================

  /**
   * Register a notification handler
   */
  onNotification(type: string, handler: NotificationHandler): () => void {
    return this.notifications.on(type, handler);
  }

  /**
   * Get all notifications
   */
  getNotifications(options?: { unacknowledgedOnly?: boolean; limit?: number }): Notification[] {
    return this.notifications.getAll(options);
  }

  /**
   * Get unacknowledged notifications
   */
  getUnacknowledgedNotifications(): Notification[] {
    return this.notifications.getUnacknowledged();
  }

  /**
   * Acknowledge a notification
   */
  acknowledgeNotification(notificationId: string): boolean {
    return this.notifications.acknowledge(notificationId);
  }

  /**
   * Create a custom notification
   */
  notify(type: Notification['type'], title: string, message: string, metadata?: Record<string, any>): Notification {
    return this.notifications.notify(type, title, message, metadata);
  }

  // ==================== Utilities ====================

  /**
   * Get mailbox statistics
   */
  getStats() {
    return this.mailbox.getStats();
  }

  /**
   * Cleanup old messages and expired reservations
   */
  cleanup(): { messages: number; reservations: number; notifications: number } {
    return {
      messages: this.mailbox.cleanup(),
      reservations: this.reservations.cleanupExpired(),
      notifications: this.notifications.cleanup()
    };
  }

  /**
   * Get the underlying mailbox instance
   */
  getMailbox(): Mailbox {
    return this.mailbox;
  }

  /**
   * Get the underlying reservation manager
   */
  getReservationManager(): ReservationManager {
    return this.reservations;
  }

  /**
   * Get the underlying notification manager
   */
  getNotificationManager(): NotificationManager {
    return this.notifications;
  }
}

/**
 * Create a new SwarmMail instance
 */
export function createSwarmMail(config: MailboxConfig): SwarmMail {
  return new SwarmMail(config);
}

export default SwarmMail;
