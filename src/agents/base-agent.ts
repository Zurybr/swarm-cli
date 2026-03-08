import { Logger } from '../utils/logger';

export interface AgentConfig {
  id: string;
  runId: string;
  role: string;
  model: string;
  apiUrl: string;
  apiKey?: string;
  tools: string[];
  maxRetries?: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies?: string[];
}

export interface AgentResult {
  success: boolean;
  output?: string;
  error?: string;
  artifacts?: string[];
}

export abstract class BaseAgent {
  protected logger: Logger;
  protected config: AgentConfig;
  protected status: 'idle' | 'working' | 'completed' | 'failed' = 'idle';
  protected currentTask?: Task;

  constructor(config: AgentConfig) {
    this.config = { ...config, maxRetries: config.maxRetries || 5 };
    this.logger = new Logger(`Agent:${config.role}:${config.id}`);
  }

  abstract execute(task: Task): Promise<AgentResult>;

  getStatus(): string {
    return this.status;
  }

  getId(): string {
    return this.config.id;
  }

  getRole(): string {
    return this.config.role;
  }

  getCurrentTask(): Task | undefined {
    return this.currentTask;
  }

  protected async beforeExecute(task: Task): Promise<void> {
    this.status = 'working';
    this.currentTask = task;
    this.logger.info(`Starting task: ${task.title}`, { taskId: task.id });
  }

  protected async afterExecute(result: AgentResult): Promise<void> {
    this.status = result.success ? 'completed' : 'failed';
    this.logger.info(`Task ${result.success ? 'completed' : 'failed'}`, { 
      taskId: this.currentTask?.id,
      success: result.success 
    });
  }

  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = this.config.maxRetries || 5
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        this.logger.warn(`Attempt ${attempt}/${retries} failed, retrying in ${delay}ms`, { error: lastError.message });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error(`Failed after ${retries} retries`);
  }
}
