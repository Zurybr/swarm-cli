/**
 * Central Coordinator Logic
 * Handles task distribution, agent selection, and workflow management
 */

import { EventEmitter } from 'events';
import {
  Agent,
  AgentType,
  Task,
  TaskResult,
  TaskAssignment,
  RoutingDecision,
  AgentCapabilities,
  CoordinationStrategyType,
} from './types';
import { SwarmManager } from './swarm';
import { getDefaultCapabilities } from './agents';
import {
  CoordinationStrategy,
  ParallelStrategy,
  SequentialStrategy,
  AdaptiveStrategy,
} from './strategy';
import { isSuitableForTaskType, getSuitableTaskTypes } from './agents';

/** Coordinator options */
export interface CoordinatorOptions {
  /** Default coordination strategy */
  defaultStrategy?: CoordinationStrategyType;
  /** Enable load balancing */
  loadBalance?: boolean;
  /** Task assignment retry attempts */
  maxAssignmentRetries?: number;
  /** Enable automatic task routing */
  autoRoute?: boolean;
}

/** Default coordinator options */
const DEFAULT_OPTIONS: CoordinatorOptions = {
  defaultStrategy: 'adaptive',
  loadBalance: true,
  maxAssignmentRetries: 3,
  autoRoute: true,
};

/**
 * Central Coordinator - manages task distribution and agent coordination
 */
export class Coordinator extends EventEmitter {
  private swarm: SwarmManager;
  private options: CoordinatorOptions;
  private strategies: Map<CoordinationStrategyType, CoordinationStrategy>;
  private currentStrategy: CoordinationStrategy;
  private assignmentQueue: Map<string, number> = new Map();

  constructor(swarm: SwarmManager, options: CoordinatorOptions = {}) {
    super();
    this.swarm = swarm;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.strategies = new Map();

    // Initialize strategies
    this.strategies.set('parallel', new ParallelStrategy());
    this.strategies.set('sequential', new SequentialStrategy());
    this.strategies.set('adaptive', new AdaptiveStrategy());

    // Set default strategy
    this.currentStrategy =
      this.strategies.get(this.options.defaultStrategy!) ||
      this.strategies.get('adaptive')!;

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for swarm events
   */
  private setupEventListeners(): void {
    this.swarm.on('task_created', () => {
      if (this.options.autoRoute) {
        this.processPendingTasks();
      }
    });

    this.swarm.on('task_completed', () => {
      this.processPendingTasks();
    });

    this.swarm.on('task_failed', (event) => {
      this.handleTaskFailure(event.taskId, event.result);
    });

    this.swarm.on('agent_registered', () => {
      this.processPendingTasks();
    });

    this.swarm.on('agent_status_changed', (event) => {
      if (event.newStatus === 'idle') {
        this.processPendingTasks();
      }
    });
  }

  /**
   * Set the coordination strategy
   */
  setStrategy(strategyType: CoordinationStrategyType): void {
    const strategy = this.strategies.get(strategyType);
    if (!strategy) {
      throw new Error(`Unknown strategy type: ${strategyType}`);
    }
    this.currentStrategy = strategy;
    this.emit('strategy_changed', { strategyType });
  }

  /**
   * Get the current strategy
   */
  getStrategy(): CoordinationStrategy {
    return this.currentStrategy;
  }

  /**
   * Process pending tasks and assign them to agents
   */
  async processPendingTasks(): Promise<TaskAssignment[]> {
    const pendingTasks = this.swarm.getPendingTasks();
    const availableAgents = this.swarm.getAvailableAgents();

    if (pendingTasks.length === 0 || availableAgents.length === 0) {
      return [];
    }

    // Get task assignments from current strategy
    const assignments = this.currentStrategy.execute(pendingTasks, availableAgents);
    const successfulAssignments: TaskAssignment[] = [];

    // Execute assignments
    for (const assignment of assignments) {
      const success = this.executeAssignment(assignment);
      if (success) {
        successfulAssignments.push(assignment);
      }
    }

    return successfulAssignments;
  }

  /**
   * Execute a task assignment
   */
  private executeAssignment(assignment: TaskAssignment): boolean {
    const { taskId, agentId } = assignment;

    // Check retry count
    const retryCount = this.assignmentQueue.get(taskId) || 0;
    if (retryCount >= (this.options.maxAssignmentRetries || 3)) {
      this.emit('assignment_failed', {
        taskId,
        agentId,
        reason: 'Max retries exceeded',
      });
      return false;
    }

    const success = this.swarm.assignTask(taskId, agentId);

    if (success) {
      this.assignmentQueue.delete(taskId);
      this.emit('task_assigned', { taskId, agentId, confidence: assignment.confidence });

      // Auto-start the task
      this.swarm.startTask(taskId);
    } else {
      this.assignmentQueue.set(taskId, retryCount + 1);
    }

    return success;
  }

  /**
   * Route a task to the best agent type
   */
  routeTask(task: Task): RoutingDecision {
    const agents = this.swarm.getAllAgents();
    const availableAgents = this.swarm.getAvailableAgents();

    // Score each agent type for this task
    const scores: Array<{ agentType: AgentType; score: number; reason: string }> = [];

    for (const agentType of this.getAllAgentTypes()) {
      const score = this.scoreAgentTypeForTask(agentType, task);
      scores.push({
        agentType,
        score: score.score,
        reason: score.reason,
      });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    const bestMatch = scores[0];
    const alternatives = scores.slice(1, 4).map((s) => ({
      agentType: s.agentType,
      confidence: s.score,
    }));

    // Find available agents of the best type
    const suitableAgents = availableAgents.filter((a) => a.type === bestMatch.agentType);

    // Calculate final confidence based on availability
    let confidence = bestMatch.score;
    if (suitableAgents.length === 0) {
      confidence *= 0.5; // Penalty if no agents available
    }

    return {
      agentType: bestMatch.agentType,
      confidence,
      reasoning: bestMatch.reason,
      alternatives,
      modelConfig: this.getModelConfig(bestMatch.agentType),
    };
  }

  /**
   * Score an agent type for a specific task
   */
  private scoreAgentTypeForTask(
    agentType: AgentType,
    task: Task
  ): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    // Check if task requires specific agent type
    if (task.requiredAgentType) {
      if (task.requiredAgentType === agentType) {
        score += 1.0;
        reasons.push('Exact type match');
      } else {
        score -= 0.5;
        reasons.push('Type mismatch');
      }
    }

    // Check task type suitability
    if (isSuitableForTaskType(agentType, task.taskType)) {
      score += 0.3;
      reasons.push('Suitable for task type');
    }

    // Check capability requirements
    if (task.requiredCapabilities) {
      const caps = getDefaultCapabilities(agentType);
      let capMatch = 0;
      let capTotal = 0;

      for (const [key, value] of Object.entries(task.requiredCapabilities)) {
        capTotal++;
        if (caps[key as keyof AgentCapabilities] === value) {
          capMatch++;
        }
      }

      if (capTotal > 0) {
        const capScore = capMatch / capTotal;
        score += capScore * 0.3;
        reasons.push(`Capabilities match: ${(capScore * 100).toFixed(0)}%`);
      }
    }

    // Check agent availability
    const availableAgents = this.swarm.getAvailableAgents().filter((a) => a.type === agentType);
    if (availableAgents.length > 0) {
      score += 0.1;
      reasons.push('Agents available');
    }

    // Complexity matching
    const complexityScore = this.getComplexityScore(agentType, task.complexity);
    score += complexityScore * 0.2;
    reasons.push(`Complexity match: ${(complexityScore * 100).toFixed(0)}%`);

    return {
      score: Math.min(1, Math.max(0, score)),
      reason: reasons.join('; '),
    };
  }


  /**
   * Get complexity score for agent type and task complexity
   */
  private getComplexityScore(agentType: AgentType, complexity: Task['complexity']): number {
    const complexityMap: Record<Task['complexity'], number> = {
      simple: 1,
      moderate: 2,
      complex: 3,
      very_complex: 4,
    };

    const typeComplexityMap: Record<AgentType, number> = {
      coordinator: 4,
      researcher: 2,
      planner: 4,
      executor: 2,
      reviewer: 2,
      tester: 2,
      debugger: 3,
      optimizer: 3,
      documenter: 1,
      validator: 2,
      migrator: 4,
      analyzer: 3,
      architect: 4,
    };

    const taskLevel = complexityMap[complexity];
    const agentLevel = typeComplexityMap[agentType];

    // Higher agent level is better for complex tasks
    if (agentLevel >= taskLevel) {
      return 1;
    }
    return agentLevel / taskLevel;
  }

  /**
   * Get model configuration for agent type
   */
  private getModelConfig(agentType: AgentType): {
    model: string;
    temperature: number;
    maxTokens: number;
  } {
    const modelConfigs: Record<
      'fast' | 'balanced' | 'powerful',
      { model: string; temperature: number; maxTokens: number }
    > = {
      fast: { model: 'claude-3-haiku', temperature: 0.3, maxTokens: 2000 },
      balanced: { model: 'claude-3-sonnet', temperature: 0.5, maxTokens: 4000 },
      powerful: { model: 'claude-3-opus', temperature: 0.7, maxTokens: 8000 },
    };

    const caps = getDefaultCapabilities(agentType);
    return modelConfigs[caps.preferredModel];
  }

  /**
   * Handle task failure
   */
  private handleTaskFailure(taskId: string, result: TaskResult): void {
    const task = this.swarm.getTask(taskId);
    if (!task) return;

    // Check if we should retry
    const retryCount = this.assignmentQueue.get(taskId) || 0;
    const maxRetries = this.swarm.getConfig().retryPolicy.maxRetries;

    if (retryCount < maxRetries) {
      // Retry with a different agent
      this.assignmentQueue.set(taskId, retryCount + 1);
      this.emit('task_retry', { taskId, attempt: retryCount + 1 });

      // Re-queue the task
      setTimeout(() => this.processPendingTasks(), 1000);
    } else {
      this.emit('task_failed_permanently', { taskId, result });
      this.assignmentQueue.delete(taskId);
    }
  }

  /**
   * Get all agent types
   */
  private getAllAgentTypes(): AgentType[] {
    const { getAllAgentTypes } = require('./agents');
    return getAllAgentTypes();
  }

  /**
   * Get workload distribution across agents
   */
  getWorkloadDistribution(): Record<AgentType, { count: number; workload: number }> {
    const agents = this.swarm.getAllAgents();
    const distribution = {} as Record<AgentType, { count: number; workload: number }>;

    for (const agent of agents) {
      if (!distribution[agent.type]) {
        distribution[agent.type] = { count: 0, workload: 0 };
      }
      distribution[agent.type].count++;
      distribution[agent.type].workload += agent.workload;
    }

    // Calculate averages
    for (const type of Object.keys(distribution) as AgentType[]) {
      if (distribution[type].count > 0) {
        distribution[type].workload /= distribution[type].count;
      }
    }

    return distribution;
  }

  /**
   * Get task queue status
   */
  getQueueStatus(): {
    pending: number;
    assigned: number;
    inProgress: number;
    completed: number;
    failed: number;
  } {
    const tasks = this.swarm.getAllTasks();

    return {
      pending: tasks.filter((t) => t.status === 'pending').length,
      assigned: tasks.filter((t) => t.status === 'assigned').length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
    };
  }

  /**
   * Balance load across agents
   */
  balanceLoad(): TaskAssignment[] {
    if (!this.options.loadBalance) {
      return [];
    }

    const assignments: TaskAssignment[] = [];
    const agents = this.swarm.getAllAgents();
    const busyAgents = agents.filter((a) => a.status === 'busy');

    // Find overloaded agents
    for (const agent of busyAgents) {
      if (agent.workload > 0.8) {
        // Try to redistribute tasks
        const redistributableTasks = agent.assignedTasks
          .map((id) => this.swarm.getTask(id))
          .filter((t) => t && t.status === 'assigned');

        for (const task of redistributableTasks) {
          if (!task) continue;

          // Find a less busy agent
          const alternative = this.findLessBusyAgent(agent, task);
          if (alternative) {
            // Cancel current assignment and reassign
            this.swarm.cancelTask(task.id);
            const success = this.swarm.assignTask(task.id, alternative.id);
            if (success) {
              assignments.push({
                taskId: task.id,
                agentId: alternative.id,
                confidence: 0.8,
                reason: 'Load balancing',
              });
            }
          }
        }
      }
    }

    return assignments;
  }

  /**
   * Find a less busy agent for a task
   */
  private findLessBusyAgent(currentAgent: Agent, task: Task): Agent | undefined {
    const availableAgents = this.swarm
      .getAvailableAgents()
      .filter((a) => a.type === currentAgent.type && a.id !== currentAgent.id)
      .sort((a, b) => a.workload - b.workload);

    return availableAgents[0];
  }

  /**
   * Get coordinator statistics
   */
  getStats(): {
    totalAssignments: number;
    successfulAssignments: number;
    failedAssignments: number;
    averageAssignmentTime: number;
    strategy: CoordinationStrategyType;
  } {
    const tasks = this.swarm.getAllTasks();
    const assignments = Array.from(this.assignmentQueue.entries());

    return {
      totalAssignments: tasks.filter((t) => t.assignedTo).length,
      successfulAssignments: tasks.filter((t) => t.status === 'completed').length,
      failedAssignments: tasks.filter((t) => t.status === 'failed').length,
      averageAssignmentTime: this.calculateAverageAssignmentTime(tasks),
      strategy: this.currentStrategy.type,
    };
  }

  /**
   * Calculate average assignment time
   */
  private calculateAverageAssignmentTime(tasks: Task[]): number {
    const assignedTasks = tasks.filter((t) => t.assignedTo && t.startedAt && t.createdAt);

    if (assignedTasks.length === 0) return 0;

    const totalTime = assignedTasks.reduce((sum, t) => {
      return sum + (t.startedAt!.getTime() - t.createdAt.getTime());
    }, 0);

    return totalTime / assignedTasks.length / 1000; // Return in seconds
  }

  /**
   * Create a workflow from a list of tasks
   */
  createWorkflow(
    tasks: Array<{
      title: string;
      description: string;
      taskType: string;
      dependencies?: string[];
      priority?: Task['priority'];
    }>
  ): string[] {
    const taskIds: string[] = [];
    const taskMap = new Map<string, string>(); // Map title to ID

    // Create all tasks
    for (const taskDef of tasks) {
      const task = this.swarm.createTask({
        title: taskDef.title,
        description: taskDef.description,
        taskType: taskDef.taskType,
        priority: taskDef.priority || 'medium',
      });

      taskIds.push(task.id);
      taskMap.set(taskDef.title, task.id);
    }

    // Set up dependencies
    for (let i = 0; i < tasks.length; i++) {
      const taskDef = tasks[i];
      const taskId = taskIds[i];

      if (taskDef.dependencies) {
        const depIds = taskDef.dependencies
          .map((depTitle) => taskMap.get(depTitle))
          .filter((id): id is string => id !== undefined);

        const task = this.swarm.getTask(taskId);
        if (task) {
          task.dependencies = depIds;
          for (const depId of depIds) {
            const depTask = this.swarm.getTask(depId);
            if (depTask) {
              depTask.dependents.push(taskId);
            }
          }
        }
      }
    }

    this.emit('workflow_created', { taskIds, taskCount: tasks.length });

    return taskIds;
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(taskIds: string[]): {
    completed: number;
    inProgress: number;
    pending: number;
    failed: number;
    total: number;
    progress: number;
  } {
    const tasks = taskIds.map((id) => this.swarm.getTask(id)).filter((t): t is Task => t !== undefined);

    const completed = tasks.filter((t) => t.status === 'completed').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const pending = tasks.filter((t) => t.status === 'pending' || t.status === 'assigned').length;
    const failed = tasks.filter((t) => t.status === 'failed').length;
    const total = tasks.length;

    return {
      completed,
      inProgress,
      pending,
      failed,
      total,
      progress: total > 0 ? completed / total : 0,
    };
  }
}

