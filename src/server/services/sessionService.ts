import crypto from 'crypto';
import { Session, SessionConfig, SessionStatus, Message, MessageRole, AgentSummary, SessionMetrics } from '../../types/api';

function generateId(prefix: string): string {
  const randomBytes = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${randomBytes}`;
}

const defaultMetrics: SessionMetrics = {
  tasksTotal: 0,
  tasksCompleted: 0,
  tasksFailed: 0,
  messagesSent: 0,
  tokensUsed: 0
};

class SessionService {
  private sessions: Map<string, Session> = new Map();
  private messages: Map<string, Message[]> = new Map();

  async list(projectId: string): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(s => s.projectId === projectId);
  }

  async get(projectId: string, sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    return session && session.projectId === projectId ? session : null;
  }

  async create(projectId: string, config: SessionConfig = {}): Promise<Session> {
    const now = new Date().toISOString();
    const session: Session = {
      id: generateId('ses'),
      projectId,
      status: 'initializing',
      config,
      agents: [],
      metrics: { ...defaultMetrics },
      createdAt: now,
      updatedAt: now
    };
    
    this.sessions.set(session.id, session);
    this.messages.set(session.id, []);
    return session;
  }

  async updateStatus(sessionId: string, status: SessionStatus): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    session.status = status;
    session.updatedAt = new Date().toISOString();
    return session;
  }

  async addAgent(sessionId: string, agent: AgentSummary): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    session.agents.push(agent);
    session.updatedAt = new Date().toISOString();
    return session;
  }

  async updateMetrics(sessionId: string, metrics: Partial<SessionMetrics>): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    session.metrics = { ...session.metrics, ...metrics };
    session.updatedAt = new Date().toISOString();
    return session;
  }

  async delete(projectId: string, sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.projectId !== projectId) return false;
    
    this.sessions.delete(sessionId);
    this.messages.delete(sessionId);
    return true;
  }

  async listMessages(sessionId: string, limit = 50, offset = 0, role?: MessageRole): Promise<{ messages: Message[]; total: number }> {
    const messages = this.messages.get(sessionId) || [];
    let filtered = messages;
    
    if (role) {
      filtered = messages.filter(m => m.role === role);
    }
    
    return {
      messages: filtered.slice(offset, offset + limit),
      total: filtered.length
    };
  }

  async getMessage(sessionId: string, messageId: string): Promise<Message | null> {
    const messages = this.messages.get(sessionId) || [];
    return messages.find(m => m.id === messageId) || null;
  }

  async addMessage(sessionId: string, data: { role: MessageRole; content: string; metadata?: Record<string, unknown> }): Promise<Message> {
    const messages = this.messages.get(sessionId) || [];
    
    const message: Message = {
      id: generateId('msg'),
      sessionId,
      role: data.role,
      content: data.content,
      metadata: data.metadata,
      timestamp: new Date().toISOString()
    };
    
    messages.push(message);
    this.messages.set(sessionId, messages);
    
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metrics.messagesSent++;
      session.updatedAt = new Date().toISOString();
    }
    
    return message;
  }
}

export const sessionService = new SessionService();
