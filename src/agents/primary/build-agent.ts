import { BaseAgent, AgentConfig, Task, AgentResult } from '../base-agent';
import { Logger } from '../../utils/logger';
import { randomUUID } from 'crypto';

export interface BuildAgentConfig extends AgentConfig {
  allowWrite: boolean;
  allowEdit: boolean;
  allowBash: boolean;
  allowRead: boolean;
}

export class BuildAgent extends BaseAgent {
  private buildConfig: BuildAgentConfig;

  constructor(config: BuildAgentConfig) {
    super(config);
    this.buildConfig = {
      ...config,
      allowWrite: config.allowWrite ?? true,
      allowEdit: config.allowEdit ?? true,
      allowBash: config.allowBash ?? true,
      allowRead: config.allowRead ?? true,
    };
  }

  static createDefault(runId: string): BuildAgent {
    const config: BuildAgentConfig = {
      id: randomUUID(),
      runId,
      role: 'build',
      model: 'claude-3-opus',
      apiUrl: process.env.LLM_API_URL || 'https://api.anthropic.com',
      apiKey: process.env.ANTHROPIC_API_KEY,
      tools: ['write', 'edit', 'read', 'bash', 'glob', 'grep', 'webfetch'],
      allowWrite: true,
      allowEdit: true,
      allowBash: true,
      allowRead: true,
      maxRetries: 5,
    };
    return new BuildAgent(config);
  }

  async execute(task: Task): Promise<AgentResult> {
    await this.beforeExecute(task);
    
    try {
      const result = await this.retryWithBackoff(async () => {
        this.logger.info(`Executing build task: ${task.title}`);
        return await this.performBuild(task);
      });

      await this.afterExecute({ success: true, output: result });
      return { success: true, output: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.afterExecute({ success: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private async performBuild(task: Task): Promise<string> {
    this.logger.info(`Building: ${task.description}`);
    return `Build completed for task: ${task.title}`;
  }

  canWrite(): boolean {
    return this.buildConfig.allowWrite;
  }

  canEdit(): boolean {
    return this.buildConfig.allowEdit;
  }

  canBash(): boolean {
    return this.buildConfig.allowBash;
  }

  canRead(): boolean {
    return this.buildConfig.allowRead;
  }

  getTools(): string[] {
    const tools: string[] = [];
    if (this.buildConfig.allowRead) tools.push('read', 'glob', 'grep');
    if (this.buildConfig.allowWrite) tools.push('write');
    if (this.buildConfig.allowEdit) tools.push('edit');
    if (this.buildConfig.allowBash) tools.push('bash');
    if (this.buildConfig.allowRead) tools.push('webfetch');
    return tools;
  }

  getPromptIndicator(): string {
    return '[build] >';
  }
}

export default BuildAgent;
