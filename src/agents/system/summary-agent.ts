import { Logger } from '../../utils/logger';
import { BaseAgent, AgentConfig, Task, AgentResult } from '../base-agent';

export interface SummaryConfig {
  model: string;
  apiUrl: string;
  apiKey?: string;
  includeDecisions?: boolean;
  includeArtifacts?: boolean;
}

export interface SessionSummary {
  title: string;
  overview: string;
  decisions: string[];
  artifacts: string[];
  participants: string[];
  duration: number;
}

export class SummaryAgent extends BaseAgent {
  private summaryConfig: SummaryConfig;
  private sessionSummaries: Map<string, SessionSummary> = new Map();

  constructor(config: AgentConfig & { summaryConfig?: SummaryConfig }) {
    super(config);
    this.summaryConfig = config.summaryConfig || {
      model: config.model || 'gpt-4',
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      includeDecisions: true,
      includeArtifacts: true,
    };
  }

  async execute(task: Task): Promise<AgentResult> {
    await this.beforeExecute(task);

    try {
      const sessionData = task.description as unknown as {
        messages?: Array<{ role: string; content: string }>;
        title?: string;
        startTime?: number;
        endTime?: number;
        participants?: string[];
      };

      const summary = await this.generateSummary(sessionData);
      this.sessionSummaries.set(task.id, summary);

      const summaryText = this.formatSummary(summary);

      await this.afterExecute({ success: true, output: summaryText });
      return {
        success: true,
        output: summaryText,
        artifacts: [JSON.stringify(summary, null, 2)],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.afterExecute({ success: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  private async generateSummary(sessionData: {
    messages?: Array<{ role: string; content: string }>;
    title?: string;
    startTime?: number;
    endTime?: number;
    participants?: string[];
  }): Promise<SessionSummary> {
    const messages = sessionData.messages || [];
    const duration = sessionData.endTime && sessionData.startTime 
      ? sessionData.endTime - sessionData.startTime 
      : 0;

    const prompt = `Create a comprehensive session summary for the following conversation:

Title: ${sessionData.title || 'Untitled'}

Messages:
${messages.map(m => `[${m.role}]: ${m.content}`).join('\n\n')}

${this.summaryConfig.includeDecisions ? 'Identify all key decisions made during this session.' : ''}
${this.summaryConfig.includeArtifacts ? 'List all artifacts, files, or outputs created.' : ''}

Provide a JSON response with:
{
  "overview": "2-3 sentence summary of what was accomplished",
  "decisions": ["decision 1", "decision 2"],
  "artifacts": ["file 1", "command 2"],
  "participants": ${JSON.stringify(sessionData.participants || ['user', 'agent'])}
}`;

    const response = await fetch(`${this.summaryConfig.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.summaryConfig.apiKey && { Authorization: `Bearer ${this.summaryConfig.apiKey}` }),
      },
      body: JSON.stringify({
        model: this.summaryConfig.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json() as { 
      choices?: Array<{ message?: { content?: string } }> 
    };
    const content = data.choices?.[0]?.message?.content || '{}';

    try {
      const parsed = JSON.parse(content);
      return {
        title: sessionData.title || 'Untitled Session',
        overview: parsed.overview || 'Session completed',
        decisions: parsed.decisions || [],
        artifacts: parsed.artifacts || [],
        participants: parsed.participants || sessionData.participants || ['user', 'agent'],
        duration,
      };
    } catch {
      return {
        title: sessionData.title || 'Untitled Session',
        overview: 'Session completed',
        decisions: [],
        artifacts: [],
        participants: sessionData.participants || ['user', 'agent'],
        duration,
      };
    }
  }

  private formatSummary(summary: SessionSummary): string {
    const parts: string[] = [
      `# ${summary.title}`,
      '',
      summary.overview,
      '',
    ];

    if (summary.decisions.length > 0) {
      parts.push('## Key Decisions');
      summary.decisions.forEach(d => parts.push(`- ${d}`));
      parts.push('');
    }

    if (summary.artifacts.length > 0) {
      parts.push('## Artifacts');
      summary.artifacts.forEach(a => parts.push(`- ${a}`));
      parts.push('');
    }

    parts.push('## Participants');
    summary.participants.forEach(p => parts.push(`- ${p}`));
    parts.push('');
    parts.push(`Duration: ${Math.round(summary.duration / 1000)}s`);

    return parts.join('\n');
  }

  getSummary(sessionId: string): SessionSummary | undefined {
    return this.sessionSummaries.get(sessionId);
  }

  hasSummary(sessionId: string): boolean {
    return this.sessionSummaries.has(sessionId);
  }
}
