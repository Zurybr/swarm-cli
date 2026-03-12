import { SubagentType, SubagentDefinition, SubagentRegistry } from './registry';
import { ParsedMention } from './parser';

export interface SessionContext {
  sessionId: string;
  parentSessionId?: string;
  projectPath: string;
  currentAgent?: string;
  taskDescription?: string;
  metadata?: Record<string, unknown>;
}

export interface SubagentExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  artifacts?: string[];
  sessionId: string;
  parentSessionId: string;
  subagentType: SubagentType;
}

export interface ForkedSession {
  sessionId: string;
  parentSessionId: string;
  subagentType: SubagentType;
  definition: SubagentDefinition;
  createdAt: Date;
  context: SessionContext;
  results?: SubagentExecutionResult;
}

class SubagentSessionManagerImpl {
  private sessions: Map<string, ForkedSession> = new Map();
  private sessionHistory: Map<string, SubagentExecutionResult[]> = new Map();

  createFork(
    parentSessionId: string,
    subagentType: SubagentType,
    projectPath: string,
    metadata?: Record<string, unknown>
  ): ForkedSession | null {
    const definition = SubagentRegistry.get(subagentType);
    
    if (!definition) {
      return null;
    }

    const sessionId = `subagent-${subagentType}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const session: ForkedSession = {
      sessionId,
      parentSessionId,
      subagentType,
      definition,
      createdAt: new Date(),
      context: {
        sessionId,
        parentSessionId,
        projectPath,
        currentAgent: subagentType,
        metadata,
      },
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): ForkedSession | undefined {
    return this.sessions.get(sessionId);
  }

  completeSession(
    sessionId: string,
    result: SubagentExecutionResult
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.results = result;
      
      const parentHistory = this.sessionHistory.get(result.parentSessionId) || [];
      parentHistory.push(result);
      this.sessionHistory.set(result.parentSessionId, parentHistory);
    }
  }

  getSessionHistory(parentSessionId: string): SubagentExecutionResult[] {
    return this.sessionHistory.get(parentSessionId) || [];
  }

  getActiveSessions(parentSessionId?: string): ForkedSession[] {
    const allSessions = Array.from(this.sessions.values());
    
    if (parentSessionId) {
      return allSessions.filter(s => s.parentSessionId === parentSessionId && !s.results);
    }
    
    return allSessions.filter(s => !s.results);
  }

  terminateSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  clearParentSessions(parentSessionId: string): void {
    const toDelete: string[] = [];
    
    for (const [id, session] of this.sessions.entries()) {
      if (session.parentSessionId === parentSessionId) {
        toDelete.push(id);
      }
    }
    
    toDelete.forEach(id => this.sessions.delete(id));
  }
}

export const SubagentSessionManager = new SubagentSessionManagerImpl();

export async function executeSubagent(
  parentSessionId: string,
  mention: ParsedMention,
  projectPath: string,
  contextMessage?: string
): Promise<SubagentExecutionResult> {
  const session = SubagentSessionManager.createFork(
    parentSessionId,
    mention.subagent,
    projectPath
  );

  if (!session) {
    return {
      success: false,
      output: '',
      error: `Unknown subagent type: ${mention.subagent}`,
      sessionId: '',
      parentSessionId,
      subagentType: mention.subagent,
    };
  }

  const definition = session.definition;
  
  const systemPrompt = `${definition.systemPrompt}

Current task: ${mention.query}
${contextMessage ? `\nAdditional context: ${contextMessage}` : ''}

Project path: ${projectPath}`;

  const result: SubagentExecutionResult = {
    success: true,
    output: `[${definition.name}] Executing: ${mention.query}\n\nResult would be generated here.`,
    sessionId: session.sessionId,
    parentSessionId,
    subagentType: mention.subagent,
  };

  SubagentSessionManager.completeSession(session.sessionId, result);

  return result;
}

export function formatSubagentResult(result: SubagentExecutionResult): string {
  if (!result.success) {
    return `❌ @${result.subagentType} failed: ${result.error}`;
  }

  return `✅ @${result.subagentType} result:\n${result.output}`;
}
