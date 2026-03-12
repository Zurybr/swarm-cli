import { Logger } from '../../utils/logger';
import { BaseAgent, AgentConfig, Task, AgentResult } from '../base-agent';

export interface TitleConfig {
  model: string;
  apiUrl: string;
  apiKey?: string;
  maxTitleLength?: number;
}

export class TitleAgent extends BaseAgent {
  private titleConfig: TitleConfig;
  private generatedTitles: Map<string, string> = new Map();

  constructor(config: AgentConfig & { titleConfig?: TitleConfig }) {
    super(config);
    this.titleConfig = config.titleConfig || {
      model: config.model || 'gpt-4',
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      maxTitleLength: 60,
    };
  }

  async execute(task: Task): Promise<AgentResult> {
    await this.beforeExecute(task);

    try {
      const firstMessage = task.description;
      const title = await this.generateTitle(firstMessage);
      
      this.generatedTitles.set(task.id, title);

      await this.afterExecute({ success: true, output: title });
      return {
        success: true,
        output: title,
        artifacts: [title],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.afterExecute({ success: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private async generateTitle(firstMessage: string): Promise<string> {
    const truncatedMessage = firstMessage.length > 500 
      ? firstMessage.substring(0, 500) + '...' 
      : firstMessage;

    const prompt = `Generate a concise, descriptive title (max ${this.titleConfig.maxTitleLength} characters) for this conversation:

"${truncatedMessage}"

The title should:
- Be descriptive but brief
- Capture the main topic or goal
- Use title case
- Not include quotes

Respond with only the title.`;

    const response = await fetch(`${this.titleConfig.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.titleConfig.apiKey && { Authorization: `Bearer ${this.titleConfig.apiKey}` }),
      },
      body: JSON.stringify({
        model: this.titleConfig.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.titleConfig.maxTitleLength || 60,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    let title = data.choices?.[0]?.message?.content || 'Untitled Session';

    if (title.length > (this.titleConfig.maxTitleLength || 60)) {
      title = title.substring(0, (this.titleConfig.maxTitleLength || 60) - 3) + '...';
    }

    return title.trim();
  }

  getTitle(taskId: string): string | undefined {
    return this.generatedTitles.get(taskId);
  }

  hasTitle(taskId: string): boolean {
    return this.generatedTitles.has(taskId);
  }
}
