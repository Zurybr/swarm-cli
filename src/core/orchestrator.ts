import { BaseAgent, AgentConfig, Task, AgentResult } from '../agents/base-agent';
import { AgentRegistry, agentRegistry } from '../agents/agent-registry';
import { AGENCY_AGENTS, AgencyAgent } from '../agents/definitions/agency-agents';
import { Logger } from '../utils/logger';
import { EventEmitter } from 'events';

const logger = new Logger('Orchestrator');

export interface Run {
  id: string;
  spec: string;
  status: 'pending' | 'planning' | 'executing' | 'validating' | 'completed' | 'failed';
  agents: string[]; // agent IDs
  tasks: Task[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface OrchestratorConfig {
  maxParallelAgents: number;
  defaultRetries: number;
  ralphLoopEnabled: boolean;
  ralphMaxIterations: number;
}

export class Orchestrator extends EventEmitter {
  private runs: Map<string, Run> = new Map();
  private config: OrchestratorConfig;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    super();
    this.config = {
      maxParallelAgents: config.maxParallelAgents || 10,
      defaultRetries: config.defaultRetries || 5,
      ralphLoopEnabled: config.ralphLoopEnabled ?? true,
      ralphMaxIterations: config.ralphMaxIterations || 10
    };
  }

  async createRun(spec: string, metadata?: Record<string, any>): Promise<Run> {
    const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const run: Run = {
      id: runId,
      spec,
      status: 'pending',
      agents: [],
      tasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata
    };
    
    this.runs.set(runId, run);
    logger.info(`Created run ${runId}`);
    
    this.emit('run:created', run);
    return run;
  }

  async spawnAgent(
    runId: string,
    agencyAgentId: string,
    modelConfig: { model: string; apiUrl: string; apiKey?: string }
  ): Promise<BaseAgent | null> {
    const agencyAgent = AGENCY_AGENTS[agencyAgentId];
    if (!agencyAgent) {
      logger.error(`Agency agent ${agencyAgentId} not found`);
      return null;
    }

    const run = this.runs.get(runId);
    if (!run) {
      logger.error(`Run ${runId} not found`);
      return null;
    }

    // Check parallel limit
    const currentAgents = agentRegistry.getByRun(runId).length;
    if (currentAgents >= this.config.maxParallelAgents) {
      logger.warn(`Max parallel agents (${this.config.maxParallelAgents}) reached for run ${runId}`);
      return null;
    }

    const agentConfig: AgentConfig = {
      id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      runId,
      // Fallback to the agent's defined role or its specialty if role is absent
      role: (agencyAgent as any).role ?? agencyAgent.specialty ?? 'unknown',
      model: modelConfig.model,
      apiUrl: modelConfig.apiUrl,
      apiKey: modelConfig.apiKey,
      tools: agencyAgent.tools,
      maxRetries: this.config.defaultRetries
    };

    // Create concrete agent instance based on role
    const agent = this.createConcreteAgent(agentConfig, agencyAgent);
    
    agentRegistry.register(agent, {
      agencyAgentId,
      personality: agencyAgent.personality
    });
    
    run.agents.push(agent.getId());
    run.updatedAt = new Date();
    
    const agentRole = (agencyAgent as any).role ?? (agencyAgent as any).specialty ?? 'unknown';
    logger.info(`Spawned agent ${agent.getId()} (${agencyAgent.name}) for run ${runId}`);
    this.emit('agent:spawned', { runId, agentId: agent.getId(), role: agentRole });
    
    return agent;
  }

  async executeTask(runId: string, agentId: string, task: Task): Promise<AgentResult> {
    const agent = agentRegistry.get(agentId);
    if (!agent) {
      return { success: false, error: `Agent ${agentId} not found` };
    }

    const run = this.runs.get(runId);
    if (!run) {
      return { success: false, error: `Run ${runId} not found` };
    }

    run.status = 'executing';
    run.updatedAt = new Date();
    
    this.emit('task:started', { runId, agentId, taskId: task.id });

    let result: AgentResult;
    
    // RALPH LOOP - if enabled, retry until success or max iterations
    if (this.config.ralphLoopEnabled) {
      result = await this.ralphLoop(agent, task);
    } else {
      result = await agent.execute(task);
    }

    // Update task status
    task.status = result.success ? 'completed' : 'failed';
    
    this.emit('task:completed', { runId, agentId, taskId: task.id, success: result.success });
    
    return result;
  }

  private async ralphLoop(agent: BaseAgent, task: Task): Promise<AgentResult> {
    const maxIterations = this.config.ralphMaxIterations;
    let iteration = 0;
    let lastResult: AgentResult | null = null;
    
    logger.info(`[RALPH] Starting loop for task: ${task.title}`, { maxIterations });

    while (iteration < maxIterations) {
      iteration++;
      logger.info(`[RALPH] Iteration ${iteration}/${maxIterations}`);
      
      try {
        const result = await agent.execute(task);
        lastResult = result;
        
        if (result.success) {
          logger.info(`[RALPH] Task completed successfully on iteration ${iteration}`);
          return {
            ...result,
            output: `[RALPH COMPLETE - ${iteration} iterations]\n${result.output || ''}`
          };
        }
        
        logger.warn(`[RALPH] Iteration ${iteration} failed: ${result.error}`);
        
        // Brief pause before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        logger.error(`[RALPH] Iteration ${iteration} threw exception`, error);
        lastResult = { 
          success: false, 
          error: `Exception: ${error instanceof Error ? error.message : String(error)}` 
        };
      }
    }
    
    logger.error(`[RALPH] Max iterations (${maxIterations}) reached without success`);
    return lastResult || { success: false, error: 'Max iterations reached' };
  }

  decideExecutionStrategy(tasks: Task[]): 'parallel' | 'sequential' {
    // Check for dependencies
    const hasDependencies = tasks.some(t => t.dependencies && t.dependencies.length > 0);
    
    if (hasDependencies) {
      logger.info('Sequential execution: tasks have dependencies');
      return 'sequential';
    }
    
    // Check task count vs parallel limit
    if (tasks.length <= this.config.maxParallelAgents) {
      logger.info('Parallel execution: independent tasks within limit');
      return 'parallel';
    }
    
    logger.info('Sequential execution: too many tasks for parallel limit');
    return 'sequential';
  }

  async executeRun(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const strategy = this.decideExecutionStrategy(run.tasks);
    logger.info(`Executing run ${runId} with ${strategy} strategy`);

    run.status = 'executing';
    run.updatedAt = new Date();
    this.emit('run:started', run);

    if (strategy === 'parallel') {
      await this.executeParallel(run);
    } else {
      await this.executeSequential(run);
    }

    run.status = 'completed';
    run.updatedAt = new Date();
    this.emit('run:completed', run);
  }

  private async executeParallel(run: Run): Promise<void> {
    const promises = run.tasks.map(async (task, index) => {
      const agentId = run.agents[index % run.agents.length];
      return this.executeTask(run.id, agentId, task);
    });
    
    await Promise.all(promises);
  }

  private async executeSequential(run: Run): Promise<void> {
    for (let i = 0; i < run.tasks.length; i++) {
      const task = run.tasks[i];
      const agentId = run.agents[i % run.agents.length];
      await this.executeTask(run.id, agentId, task);
    }
  }

  getRun(runId: string): Run | undefined {
    return this.runs.get(runId);
  }

  getAllRuns(): Run[] {
    return Array.from(this.runs.values());
  }

  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Updated orchestrator config', this.config);
  }

  private createConcreteAgent(config: AgentConfig, agencyAgent: AgencyAgent): BaseAgent {
    // For now, return a generic agent
    // In production, this would instantiate specific agent classes
    return new GenericAgent(config, agencyAgent);
  }
}

// Generic agent implementation
class GenericAgent extends BaseAgent {
  private agencyAgent: AgencyAgent;

  constructor(config: AgentConfig, agencyAgent: AgencyAgent) {
    super(config);
    this.agencyAgent = agencyAgent;
  }

  async execute(task: Task): Promise<AgentResult> {
    await this.beforeExecute(task);
    
    try {
      // Simulate agent execution
      // In production, this would call LLM APIs with agencyAgent.personality as system prompt
      this.logger.info(`Executing with personality: ${this.agencyAgent.name}`);
      this.logger.info(`Workflow: ${this.agencyAgent.workflow.join(' → ')}`);
      
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result: AgentResult = {
        success: true,
        output: `Task "${task.title}" executed by ${this.agencyAgent.name}\n` +
                `Deliverables: ${this.agencyAgent.deliverables.join(', ')}`,
        artifacts: []
      };
      
      await this.afterExecute(result);
      return result;
      
    } catch (error) {
      const result: AgentResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
      await this.afterExecute(result);
      return result;
    }
  }
}
