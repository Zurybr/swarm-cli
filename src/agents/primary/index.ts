import { BuildAgent, BuildAgentConfig } from './build-agent';
import { PlanAgent, PlanAgentConfig } from './plan-agent';
import { Logger } from '../../utils/logger';

export type PrimaryAgentType = 'build' | 'plan';

export interface PrimaryAgentState {
  currentAgent: PrimaryAgentType;
  runId: string;
  agentInstance: BuildAgent | PlanAgent;
}

const logger = new Logger('PrimaryAgents');

class PrimaryAgentManager {
  private currentState: PrimaryAgentState | null = null;
  private history: Array<{ from: PrimaryAgentType; to: PrimaryAgentType; timestamp: Date }> = [];

  initialize(runId: string, agentType: PrimaryAgentType = 'plan'): PrimaryAgentState {
    const agentInstance = this.createAgent(agentType, runId);
    this.currentState = {
      currentAgent: agentType,
      runId,
      agentInstance,
    };
    logger.info(`Initialized ${agentType} agent for run: ${runId}`);
    return this.currentState;
  }

  private createAgent(type: PrimaryAgentType, runId: string): BuildAgent | PlanAgent {
    switch (type) {
      case 'build':
        return BuildAgent.createDefault(runId);
      case 'plan':
        return PlanAgent.createDefault(runId);
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }
  }

  switchAgent(newType: PrimaryAgentType): PrimaryAgentState {
    if (!this.currentState) {
      throw new Error('Primary agent not initialized. Call initialize() first.');
    }

    const oldType = this.currentState.currentAgent;
    if (oldType === newType) {
      logger.info(`Already using ${newType} agent`);
      return this.currentState;
    }

    const newAgent = this.createAgent(newType, this.currentState.runId);
    this.currentState = {
      currentAgent: newType,
      runId: this.currentState.runId,
      agentInstance: newAgent,
    };

    this.history.push({
      from: oldType,
      to: newType,
      timestamp: new Date(),
    });

    logger.info(`Switched from ${oldType} to ${newType}`);
    return this.currentState;
  }

  getCurrentState(): PrimaryAgentState | null {
    return this.currentState;
  }

  getCurrentAgent(): BuildAgent | PlanAgent | null {
    return this.currentState?.agentInstance ?? null;
  }

  getCurrentType(): PrimaryAgentType | null {
    return this.currentState?.currentAgent ?? null;
  }

  getPromptIndicator(): string {
    if (!this.currentState) {
      return '[?] >';
    }
    return this.currentState.agentInstance.getPromptIndicator();
  }

  getSwitchHistory(): Array<{ from: PrimaryAgentType; to: PrimaryAgentType; timestamp: Date }> {
    return [...this.history];
  }

  isBuildAgent(): boolean {
    return this.currentState?.currentAgent === 'build';
  }

  isPlanAgent(): boolean {
    return this.currentState?.currentAgent === 'plan';
  }

  requestBashPermission(): boolean {
    const agent = this.getCurrentAgent();
    if (agent instanceof PlanAgent) {
      agent.requestBashPermission();
      return agent.hasBashPermission();
    }
    return false;
  }

  reset(): void {
    this.currentState = null;
    this.history = [];
    logger.info('Primary agent manager reset');
  }
}

export const primaryAgentManager = new PrimaryAgentManager();

export { BuildAgent, PlanAgent };
export type { BuildAgentConfig, PlanAgentConfig };
