import { Logger } from '../../utils/logger';
import { BaseAgent, AgentConfig, Task, AgentResult } from '../base-agent';

export interface CompactionConfig {
  contextLimit: number;
  summaryThreshold: number;
  model: string;
  apiUrl: string;
  apiKey?: string;
}

export interface CompactionResult {
  summary: string;
  tokensSaved: number;
  compressedMessages: number;
}

export class CompactionAgent extends BaseAgent {
  private compactionConfig: CompactionConfig;

  constructor(config: AgentConfig & { compactionConfig?: CompactionConfig }) {
    super(config);
    this.compactionConfig = config.compactionConfig || {
      contextLimit: 100000,
      summaryThreshold: 80000,
      model: config.model || 'gpt-4',
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
    };
  }

  async execute(task: Task): Promise<AgentResult> {
    await this.beforeExecute(task);

    try {
      const messages = (task.description as unknown as { messages?: Array<{ content: string }> })?.messages || [];
      const currentTokens = this.estimateTokens(messages);

      if (currentTokens < this.compactionConfig.summaryThreshold) {
        return {
          success: true,
          output: 'Context not near limit, no compaction needed',
        };
      }

      const result = await this.performCompaction(messages);
      
      await this.afterExecute({ success: true, output: result.summary });
      return {
        success: true,
        output: result.summary,
        artifacts: [`Compacted ${result.compressedMessages} messages, saved ~${result.tokensSaved} tokens`],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.afterExecute({ success: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private async performCompaction(messages: Array<{ content: string }>): Promise<CompactionResult> {
    const systemMessages: Array<{ content: string }> = [];
    const userMessages: Array<{ content: string }> = [];

    for (const msg of messages) {
      if (msg.content.startsWith('System:') || msg.content.startsWith('You are')) {
        systemMessages.push(msg);
      } else {
        userMessages.push(msg);
      }
    }

    const summaryPrompt = `Summarize the following conversation concisely, preserving key information, decisions, and context:

${userMessages.map(m => m.content).join('\n\n')}

Provide a concise summary that captures:
- Main topics discussed
- Key decisions made
- Important context needed for future messages`;

    const summary = await this.generateSummary(summaryPrompt);
    const originalTokens = this.estimateTokens(messages);
    const newTokens = this.estimateTokens([{ content: summary }]);

    return {
      summary,
      tokensSaved: originalTokens - newTokens,
      compressedMessages: userMessages.length,
    };
  }

  private async generateSummary(prompt: string): Promise<string> {
    const response = await fetch(`${this.compactionConfig.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.compactionConfig.apiKey && { Authorization: `Bearer ${this.compactionConfig.apiKey}` }),
      },
      body: JSON.stringify({
        model: this.compactionConfig.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || 'Summary unavailable';
  }

  private estimateTokens(messages: Array<{ content: string }>): number {
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  shouldCompact(currentTokens: number): boolean {
    return currentTokens >= this.compactionConfig.summaryThreshold;
  }

  getContextLimit(): number {
    return this.compactionConfig.contextLimit;
  }
}
