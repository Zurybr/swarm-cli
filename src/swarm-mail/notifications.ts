/**
 * Swarm Mail - Notifications
 * Real-time alert system for agent coordination
 */

import * as fs from 'fs';
import * as path from 'path';
import { Notification } from './types';
import { Mailbox } from './mailbox';

export interface NotificationHandler {
  (notification: Notification): void;
}

export class NotificationManager {
  private storagePath: string;
  private notificationsPath: string;
  private agentName: string;
  private handlers: Map<string, NotificationHandler[]> = new Map();
  private mailbox?: Mailbox;

  constructor(storagePath: string, agentName: string, mailbox?: Mailbox) {
    this.storagePath = storagePath;
    this.notificationsPath = path.join(storagePath, 'notifications');
    this.agentName = agentName;
    this.mailbox = mailbox;

    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.notificationsPath)) {
      fs.mkdirSync(this.notificationsPath, { recursive: true });
    }
  }

  private getNotificationPath(notificationId: string): string {
    return path.join(this.notificationsPath, `${notificationId}.json`);
  }

  private generateId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Register a handler for notification types
   */
  on(type: string, handler: NotificationHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }

    this.handlers.get(type)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Create and dispatch a notification
   */
  notify(
    type: Notification['type'],
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): Notification {
    const notification: Notification = {
      id: this.generateId(),
      type,
      agentName: this.agentName,
      title,
      message,
      timestamp: Date.now(),
      acknowledged: false,
      metadata
    };

    this.save(notification);
    this.dispatch(notification);

    return notification;
  }

  /**
   * Notify about a new message
   */
  notifyMessage(from: string, subject: string, messageId: string): Notification {
    return this.notify('message', 'New Message', `Message from ${from}: ${subject}`, {
      from,
      subject,
      messageId
    });
  }

  /**
   * Notify about a blocker
   */
  notifyBlocker(description: string, taskId?: string): Notification {
    return this.notify('blocker', 'Blocker Alert', description, { taskId });
  }

  /**
   * Notify about progress
   */
  notifyProgress(taskId: string, progressPercent: number, message: string): Notification {
    return this.notify('progress', 'Progress Update', message, {
      taskId,
      progressPercent
    });
  }

  /**
   * Notify about system events
   */
  notifySystem(event: string, details: string, metadata?: Record<string, any>): Notification {
    return this.notify('system', event, details, metadata);
  }

  /**
   * Acknowledge a notification
   */
  acknowledge(notificationId: string): boolean {
    const notification = this.get(notificationId);
    if (!notification) {
      return false;
    }

    notification.acknowledged = true;
    notification.acknowledgedAt = Date.now();
    this.save(notification);

    return true;
  }

  /**
   * Get a notification by ID
   */
  get(notificationId: string): Notification | undefined {
    const notificationPath = this.getNotificationPath(notificationId);
    if (!fs.existsSync(notificationPath)) {
      return undefined;
    }

    try {
      const data = fs.readFileSync(notificationPath, 'utf-8');
      return JSON.parse(data) as Notification;
    } catch {
      return undefined;
    }
  }

  /**
   * Get all notifications
   */
  getAll(options: { unacknowledgedOnly?: boolean; limit?: number } = {}): Notification[] {
    const notifications: Notification[] = [];

    if (!fs.existsSync(this.notificationsPath)) {
      return notifications;
    }

    const files = fs.readdirSync(this.notificationsPath);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const notificationPath = path.join(this.notificationsPath, file);
      try {
        const data = fs.readFileSync(notificationPath, 'utf-8');
        const notification = JSON.parse(data) as Notification;

        if (options.unacknowledgedOnly && notification.acknowledged) {
          continue;
        }

        notifications.push(notification);
      } catch {
        // Skip invalid files
      }
    }

    // Sort by timestamp descending
    notifications.sort((a, b) => b.timestamp - a.timestamp);

    if (options.limit) {
      return notifications.slice(0, options.limit);
    }

    return notifications;
  }

  /**
   * Get unacknowledged notifications
   */
  getUnacknowledged(): Notification[] {
    return this.getAll({ unacknowledgedOnly: true });
  }

  /**
   * Get notification count
   */
  getCount(options: { unacknowledgedOnly?: boolean } = {}): number {
    if (options.unacknowledgedOnly) {
      return this.getUnacknowledged().length;
    }
    return this.getAll().length;
  }

  /**
   * Delete a notification
   */
  delete(notificationId: string): boolean {
    const notificationPath = this.getNotificationPath(notificationId);
    if (!fs.existsSync(notificationPath)) {
      return false;
    }

    fs.unlinkSync(notificationPath);
    return true;
  }

  /**
   * Clean up old notifications
   */
  cleanup(maxAgeDays: number = 7): number {
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    const notifications = this.getAll();
    let cleaned = 0;

    for (const notification of notifications) {
      if (notification.timestamp < cutoff && notification.acknowledged) {
        this.delete(notification.id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Clear all handlers
   */
  clearHandlers(): void {
    this.handlers.clear();
  }

  private save(notification: Notification): void {
    const notificationPath = this.getNotificationPath(notification.id);
    fs.writeFileSync(notificationPath, JSON.stringify(notification, null, 2));
  }

  private dispatch(notification: Notification): void {
    // Call type-specific handlers
    const typeHandlers = this.handlers.get(notification.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          handler(notification);
        } catch (error) {
          console.error(`Notification handler error for ${notification.type}:`, error);
        }
      }
    }

    // Call wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler(notification);
        } catch (error) {
          console.error('Notification wildcard handler error:', error);
        }
      }
    }
  }
}

/**
 * Global notification bus for cross-agent notifications
 */
export class NotificationBus {
  private static instance: NotificationManager | null = null;

  static getInstance(storagePath: string, agentName: string): NotificationManager {
    if (!NotificationBus.instance) {
      NotificationBus.instance = new NotificationManager(storagePath, agentName);
    }
    return NotificationBus.instance;
  }

  static reset(): void {
    NotificationBus.instance = null;
  }
}
