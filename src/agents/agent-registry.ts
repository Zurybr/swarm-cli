import { BaseAgent } from './base-agent';
import { Logger } from '../utils/logger';

const logger = new Logger('AgentRegistry');

export interface AgentRegistryEntry {
  agent: BaseAgent;
  registeredAt: Date;
  metadata?: Record<string, any>;
}

export class AgentRegistry {
  private agents: Map<string, AgentRegistryEntry> = new Map();
  private runAgents: Map<string, string[]> = new Map(); // runId -> agentIds

  register(agent: BaseAgent, metadata?: Record<string, any>): void {
    const entry: AgentRegistryEntry = {
      agent,
      registeredAt: new Date(),
      metadata
    };
    
    this.agents.set(agent.getId(), entry);
    
    // Track by run
    const runId = (agent as any).config?.runId;
    if (runId) {
      if (!this.runAgents.has(runId)) {
        this.runAgents.set(runId, []);
      }
      this.runAgents.get(runId)?.push(agent.getId());
    }
    
    logger.info(`Registered agent ${agent.getId()} (${agent.getRole()})`);
  }

  get(id: string): BaseAgent | undefined {
    return this.agents.get(id)?.agent;
  }

  getEntry(id: string): AgentRegistryEntry | undefined {
    return this.agents.get(id);
  }

  getAll(): BaseAgent[] {
    return Array.from(this.agents.values()).map(entry => entry.agent);
  }

  getByRun(runId: string): BaseAgent[] {
    const agentIds = this.runAgents.get(runId) || [];
    return agentIds.map(id => this.get(id)).filter((a): a is BaseAgent => a !== undefined);
  }

  getByStatus(status: string): BaseAgent[] {
    return this.getAll().filter(a => a.getStatus() === status);
  }

  getByRole(role: string): BaseAgent[] {
    return this.getAll().filter(a => a.getRole() === role);
  }

  unregister(id: string): void {
    const entry = this.agents.get(id);
    if (entry) {
      // Remove from run tracking
      const runId = (entry.agent as any).config?.runId;
      if (runId) {
        const runAgentIds = this.runAgents.get(runId) || [];
        this.runAgents.set(runId, runAgentIds.filter(aid => aid !== id));
      }
      
      this.agents.delete(id);
      logger.info(`Unregistered agent ${id}`);
    }
  }

  clearRun(runId: string): void {
    const agentIds = this.runAgents.get(runId) || [];
    for (const id of agentIds) {
      this.agents.delete(id);
    }
    this.runAgents.delete(runId);
    logger.info(`Cleared ${agentIds.length} agents for run ${runId}`);
  }

  getStats(): { total: number; byStatus: Record<string, number>; byRole: Record<string, number> } {
    const all = this.getAll();
    const byStatus: Record<string, number> = {};
    const byRole: Record<string, number> = {};
    
    for (const agent of all) {
      const status = agent.getStatus();
      const role = agent.getRole();
      
      byStatus[status] = (byStatus[status] || 0) + 1;
      byRole[role] = (byRole[role] || 0) + 1;
    }
    
    return {
      total: all.length,
      byStatus,
      byRole
    };
  }
}

// Singleton instance
export const agentRegistry = new AgentRegistry();
