import { BaseAgent, AgentConfig, Task, AgentResult } from '../base-agent';
import { Logger } from '../../utils/logger';
import { randomUUID } from 'crypto';

export interface PlanAgentConfig extends AgentConfig {
  allowBashPermission: boolean;
  analysisOnly: boolean;
}

export class PlanAgent extends BaseAgent {
  private planConfig: PlanAgentConfig;
  private bashPermissionGranted: boolean = false;

  constructor(config: PlanAgentConfig) {
    super(config);
    this.planConfig = {
      ...config,
      allowBashPermission: config.allowBashPermission ?? false,
      analysisOnly: config.analysisOnly ?? true,
    };
  }

  static createDefault(runId: string): PlanAgent {
    const config: PlanAgentConfig = {
      id: randomUUID(),
      runId,
      role: 'plan',
      model: 'claude-3-sonnet',
      apiUrl: process.env.LLM_API_URL || 'https://api.anthropic.com',
      apiKey: process.env.ANTHROPIC_API_KEY,
      tools: ['read', 'glob', 'grep', 'webfetch'],
      allowBashPermission: false,
      analysisOnly: true,
      maxRetries: 5,
    };
    return new PlanAgent(config);
  }

  async execute(task: Task): Promise<AgentResult> {
    await this.beforeExecute(task);
    
    try {
      const result = await this.retryWithBackoff(async () => {
        this.logger.info(`Analyzing task: ${task.title}`);
        return await this.performAnalysis(task);
      });

      await this.afterExecute({ success: true, output: result });
      return { success: true, output: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.afterExecute({ success: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private async performAnalysis(task: Task): Promise<string> {
    this.logger.info(`Analyzing: ${task.description}`);
    return `Analysis completed for task: ${task.title}`;
  }

  requestBashPermission(): void {
    if (this.planConfig.allowBashPermission) {
      this.bashPermissionGranted = true;
      this.logger.info('Bash permission granted');
    } else {
      this.logger.warn('Bash permission denied - not enabled for this plan agent');
    }
  }

  revokeBashPermission(): void {
    this.bashPermissionGranted = false;
    this.logger.info('Bash permission revoked');
  }

  hasBashPermission(): boolean {
    return this.bashPermissionGranted;
  }

  isAnalysisOnly(): boolean {
    return this.planConfig.analysisOnly;
  }

  getPromptIndicator(): string {
    return '[plan] >';
  }

  getTools(): string[] {
    const tools: string[] = ['read', 'glob', 'grep', 'webfetch'];
    if (this.bashPermissionGranted) {
      tools.push('bash');
    }
    return tools;
  }

  canModify(): boolean {
    return false;
  }
}

export default PlanAgent;
