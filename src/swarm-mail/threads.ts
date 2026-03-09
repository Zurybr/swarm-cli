/**
 * Swarm Mail - Threads
 * Conversation threading for message grouping
 */

import * as fs from 'fs';
import * as path from 'path';
import { Thread, ThreadQuery, Message } from './types';

export class ThreadManager {
  private threadsPath: string;

  constructor(storagePath: string) {
    this.threadsPath = path.join(storagePath, 'threads');
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.threadsPath)) {
      fs.mkdirSync(this.threadsPath, { recursive: true });
    }
  }

  private getThreadPath(threadId: string): string {
    return path.join(this.threadsPath, `${threadId}.json`);
  }

  /**
   * Create a new thread
   */
  create(subject: string, participants: string[], runId?: string, metadata?: Record<string, any>): Thread {
    const thread: Thread = {
      id: `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      subject,
      participants: [...new Set(participants)],
      messageIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      runId,
      metadata
    };

    this.save(thread);
    return thread;
  }

  /**
   * Get a thread by ID
   */
  get(threadId: string): Thread | undefined {
    const threadPath = this.getThreadPath(threadId);
    if (!fs.existsSync(threadPath)) {
      return undefined;
    }

    try {
      const data = fs.readFileSync(threadPath, 'utf-8');
      return JSON.parse(data) as Thread;
    } catch {
      return undefined;
    }
  }

  /**
   * Save a thread
   */
  save(thread: Thread): void {
    const threadPath = this.getThreadPath(thread.id);
    fs.writeFileSync(threadPath, JSON.stringify(thread, null, 2));
  }

  /**
   * Add a message to a thread
   */
  addMessage(threadId: string, messageId: string, sender: string): Thread | undefined {
    const thread = this.get(threadId);
    if (!thread) {
      return undefined;
    }

    if (!thread.messageIds.includes(messageId)) {
      thread.messageIds.push(messageId);
    }

    if (!thread.participants.includes(sender)) {
      thread.participants.push(sender);
    }

    thread.updatedAt = Date.now();
    this.save(thread);
    return thread;
  }

  /**
   * Get or create a thread for a message
   */
  getOrCreateForMessage(message: Message): Thread {
    if (message.threadId) {
      const existing = this.get(message.threadId);
      if (existing) {
        return existing;
      }
    }

    // Create new thread
    const participants = [message.from];
    if (Array.isArray(message.to)) {
      participants.push(...message.to);
    } else if (message.to !== 'broadcast') {
      participants.push(message.to);
    }

    return this.create(
      message.subject,
      participants,
      message.runId,
      message.metadata
    );
  }

  /**
   * Query threads
   */
  query(query: ThreadQuery = {}): Thread[] {
    const threads: Thread[] = [];

    if (!fs.existsSync(this.threadsPath)) {
      return threads;
    }

    const files = fs.readdirSync(this.threadsPath);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const threadPath = path.join(this.threadsPath, file);
      try {
        const data = fs.readFileSync(threadPath, 'utf-8');
        const thread = JSON.parse(data) as Thread;

        if (this.matchesQuery(thread, query)) {
          threads.push(thread);
        }
      } catch {
        // Skip invalid files
      }
    }

    // Sort by updatedAt descending
    threads.sort((a, b) => b.updatedAt - a.updatedAt);

    if (query.limit) {
      return threads.slice(0, query.limit);
    }

    return threads;
  }

  private matchesQuery(thread: Thread, query: ThreadQuery): boolean {
    if (query.participant && !thread.participants.includes(query.participant)) {
      return false;
    }

    if (query.runId && thread.runId !== query.runId) {
      return false;
    }

    if (query.since && thread.updatedAt < query.since) {
      return false;
    }

    return true;
  }

  /**
   * Get messages in a thread
   */
  getMessageIds(threadId: string): string[] {
    const thread = this.get(threadId);
    return thread?.messageIds || [];
  }

  /**
   * Delete a thread
   */
  delete(threadId: string): boolean {
    const threadPath = this.getThreadPath(threadId);
    if (!fs.existsSync(threadPath)) {
      return false;
    }

    fs.unlinkSync(threadPath);
    return true;
  }

  /**
   * Get all threads for an agent
   */
  getForAgent(agentName: string): Thread[] {
    return this.query({ participant: agentName });
  }

  /**
   * Get thread count
   */
  count(): number {
    if (!fs.existsSync(this.threadsPath)) {
      return 0;
    }

    return fs.readdirSync(this.threadsPath).filter(f => f.endsWith('.json')).length;
  }
}
