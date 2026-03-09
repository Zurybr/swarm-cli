/**
 * Swarm Mail - Types
 * Core type definitions for inter-agent messaging system
 */

export type MessageType = 'direct' | 'broadcast' | 'system' | 'blocker' | 'progress';
export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';
export type MessageStatus = 'unread' | 'read' | 'archived';
export type ReservationStatus = 'active' | 'expired' | 'released';

/**
 * Message attachment metadata
 */
export interface MessageAttachment {
  filename: string;
  path?: string;
  content?: string;
  mimeType?: string;
}

/**
 * Core message structure
 */
export interface Message {
  id: string;
  threadId?: string;
  type: MessageType;
  priority: MessagePriority;
  status: MessageStatus;

  // Sender/Recipient
  from: string;
  to: string | string[]; // 'broadcast' for all agents

  // Content
  subject: string;
  body: string;
  attachments?: MessageAttachment[];

  // Metadata
  timestamp: number;
  readAt?: number;
  replyTo?: string; // parent message id

  // Context
  runId?: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

/**
 * Message thread for conversation grouping
 */
export interface Thread {
  id: string;
  subject: string;
  participants: string[];
  messageIds: string[];
  createdAt: number;
  updatedAt: number;
  runId?: string;
  metadata?: Record<string, any>;
}

/**
 * File reservation for exclusive editing
 */
export interface FileReservation {
  id: string;
  path: string;
  agentName: string;
  status: ReservationStatus;
  createdAt: number;
  expiresAt: number;
  releasedAt?: number;
  reason?: string;
  exclusive: boolean;
}

/**
 * Notification for real-time alerts
 */
export interface Notification {
  id: string;
  type: 'message' | 'blocker' | 'progress' | 'system';
  agentName: string;
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  acknowledgedAt?: number;
  metadata?: Record<string, any>;
}

/**
 * Mailbox configuration
 */
export interface MailboxConfig {
  agentName: string;
  storagePath: string;
  maxMessages?: number;
  retentionDays?: number;
}

/**
 * Inbox query filters
 */
export interface InboxQuery {
  type?: MessageType;
  status?: MessageStatus;
  priority?: MessagePriority;
  from?: string;
  since?: number;
  until?: number;
  limit?: number;
  unreadOnly?: boolean;
}

/**
 * Reservation query filters
 */
export interface ReservationQuery {
  agentName?: string;
  path?: string;
  status?: ReservationStatus;
  activeOnly?: boolean;
}

/**
 * Thread query filters
 */
export interface ThreadQuery {
  participant?: string;
  runId?: string;
  since?: number;
  limit?: number;
}

/**
 * Message composition for sending
 */
export interface MessageCompose {
  to: string | string[];
  subject: string;
  body: string;
  type?: MessageType;
  priority?: MessagePriority;
  threadId?: string;
  replyTo?: string;
  attachments?: MessageAttachment[];
  metadata?: Record<string, any>;
}

/**
 * Reservation request
 */
export interface ReservationRequest {
  paths: string | string[];
  reason?: string;
  ttlSeconds?: number;
  exclusive?: boolean;
}

/**
 * Conflict check result
 */
export interface ConflictCheck {
  hasConflict: boolean;
  conflicts: FileReservation[];
  message: string;
}

/**
 * Mailbox statistics
 */
export interface MailboxStats {
  totalMessages: number;
  unreadCount: number;
  threadCount: number;
  lastMessageAt?: number;
}
