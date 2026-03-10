/**
 * Coordination Strategies
 * Implements parallel, sequential, and adaptive task distribution strategies
 */

import {
  Task,
  Agent,
  TaskAssignment,
  TaskResult,
  CoordinationStrategyType,
  AgentType,
} from './types';
import { isSuitableForTaskType, getDefaultCapabilities } from './agents';

/** Task with scoring information */
interface ScoredTask {
  task: Task;
  score: number;
  suitableAgents: Agent[];
}

/** Agent with scoring information */
interface ScoredAgent {
  agent: Agent;
  score: number;
  capabilities: {
    canHandle: boolean;
    workload: number;
    successRate: number;
  };
}

/**
 * Coordination Strategy Interface
 */
export interface CoordinationStrategy {
  /** Strategy type */
  type: CoordinationStrategyType;
  /** Strategy name */
  name: string;
  /** Strategy description */
  description: string;
  /** Execute the strategy for task distribution */
  execute(tasks: Task[], agents: Agent[]): TaskAssignment[];
  /** Handle task completion */
  onTaskComplete(task: Task, result: TaskResult): void;
  /** Handle task failure */
  onTaskFail(task: Task, error: string): void;
  /** Get next tasks to execute */
  getNextTasks(tasks: Task[]): Task[];
}

/**
 * Base strategy with common functionality
 */
abstract class BaseStrategy implements CoordinationStrategy {
  abstract type: CoordinationStrategyType;
  abstract name: string;
  abstract description: string;

  /**
   * Score an agent for a specific task
   */
  protected scoreAgentForTask(agent: Agent, task: Task): number {
    let score = 0;

    // Check if agent type is suitable for task type
    if (isSuitableForTaskType(agent.type, task.taskType)) {
      score += 0.4;
    }

    // Check if task requires specific agent type
    if (task.requiredAgentType) {
      if (agent.type === task.requiredAgentType) {
        score += 0.3;
      } else {
        score -= 0.2;
      }
    }

    // Check capability requirements
    if (task.requiredCapabilities) {
      const agentCaps = agent.config.capabilities;
      let matchCount = 0;
      let totalCount = 0;

      for (const [key, value] of Object.entries(task.requiredCapabilities)) {
        totalCount++;
        if (agentCaps[key as keyof typeof agentCaps] === value) {
          matchCount++;
        }
      }

      if (totalCount > 0) {
        score += (matchCount / totalCount) * 0.2;
      }
    }

    // Factor in current workload (lower is better)
    score += (1 - agent.workload) * 0.1;

    // Factor in success rate
    score += agent.health.successRate * 0.1;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Get the best agent for a task
   */
  protected getBestAgent(task: Task, agents: Agent[]): ScoredAgent | undefined {
    const scoredAgents = agents.map((agent) => ({
      agent,
      score: this.scoreAgentForTask(agent, task),
      capabilities: {
        canHandle: this.canAgentHandleTask(agent, task),
        workload: agent.workload,
        successRate: agent.health.successRate,
      },
    }));

    // Sort by score descending
    scoredAgents.sort((a, b) => b.score - a.score);

    // Return the best agent that can handle the task
    return scoredAgents.find((sa) => sa.capabilities.canHandle);
  }

  /**
   * Check if an agent can handle a task
   */
  protected canAgentHandleTask(agent: Agent, task: Task): boolean {
    // Check if agent is available
    if (agent.status !== 'idle' && agent.workload >= 1) {
      return false;
    }

    // Check required agent type
    if (task.requiredAgentType && agent.type !== task.requiredAgentType) {
      return false;
    }

    // Check required capabilities
    if (task.requiredCapabilities) {
      const agentCaps = agent.config.capabilities;
      for (const [key, value] of Object.entries(task.requiredCapabilities)) {
        if (agentCaps[key as keyof typeof agentCaps] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Sort tasks by priority
   */
  protected sortTasksByPriority(tasks: Task[]): Task[] {
    const priorityOrder: Record<Task['priority'], number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return [...tasks].sort((a, b) => {
      // First sort by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by creation time (older first)
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  /**
   * Filter tasks that are ready to be assigned
   */
  protected getReadyTasks(tasks: Task[]): Task[] {
    return tasks.filter((task) => {
      // Must be pending
      if (task.status !== 'pending') return false;

      // All dependencies must be completed
      return task.dependencies.every((depId) => {
        // This check should be done against the actual task state
        // For now, we assume dependencies are managed externally
        return true;
      });
    });
  }

  abstract execute(tasks: Task[], agents: Agent[]): TaskAssignment[];

  onTaskComplete(task: Task, result: TaskResult): void {
    // Default implementation - can be overridden
  }

  onTaskFail(task: Task, error: string): void {
    // Default implementation - can be overridden
  }

  getNextTasks(tasks: Task[]): Task[] {
    return this.getReadyTasks(this.sortTasksByPriority(tasks));
  }
}

/**
 * Parallel Strategy
 * Assigns tasks to available agents simultaneously
 * Best for: Independent tasks that can be executed concurrently
 */
export class ParallelStrategy extends BaseStrategy {
  type: CoordinationStrategyType = 'parallel';
  name = 'Parallel';
  description = 'Assigns tasks to available agents simultaneously for maximum throughput';

  execute(tasks: Task[], agents: Agent[]): TaskAssignment[] {
    const assignments: TaskAssignment[] = [];
    const readyTasks = this.getReadyTasks(this.sortTasksByPriority(tasks));
    const availableAgents = agents.filter((a) => a.status === 'idle' || a.workload < 1);

    // Create a copy of available agents to track usage
    const agentPool = [...availableAgents];

    for (const task of readyTasks) {
      if (agentPool.length === 0) break;

      const bestMatch = this.getBestAgent(task, agentPool);
      if (bestMatch) {
        const assignment: TaskAssignment = {
          taskId: task.id,
          agentId: bestMatch.agent.id,
          confidence: bestMatch.score,
          reason: `Parallel assignment: best match with score ${(bestMatch.score * 100).toFixed(1)}%`,
        };

        assignments.push(assignment);

        // Remove agent from pool if at capacity
        if (bestMatch.agent.workload >= 1 - 1 / bestMatch.agent.maxConcurrentTasks) {
          const index = agentPool.findIndex((a) => a.id === bestMatch.agent.id);
          if (index !== -1) {
            agentPool.splice(index, 1);
          }
        }
      }
    }

    return assignments;
  }
}

/**
 * Sequential Strategy
 * Assigns tasks one at a time in priority order
 * Best for: Dependent tasks or resource-constrained environments
 */
export class SequentialStrategy extends BaseStrategy {
  type: CoordinationStrategyType = 'sequential';
  name = 'Sequential';
  description = 'Assigns tasks one at a time in priority order for controlled execution';

  execute(tasks: Task[], agents: Agent[]): TaskAssignment[] {
    const assignments: TaskAssignment[] = [];
    const readyTasks = this.getReadyTasks(this.sortTasksByPriority(tasks));
    const availableAgents = agents.filter((a) => a.status === 'idle');

    // Only assign the highest priority task
    if (readyTasks.length > 0 && availableAgents.length > 0) {
      const task = readyTasks[0];
      const bestMatch = this.getBestAgent(task, availableAgents);

      if (bestMatch) {
        const assignment: TaskAssignment = {
          taskId: task.id,
          agentId: bestMatch.agent.id,
          confidence: bestMatch.score,
          reason: `Sequential assignment: highest priority task to best available agent`,
        };

        assignments.push(assignment);
      }
    }

    return assignments;
  }
}

/**
 * Adaptive Strategy
 * Dynamically adjusts based on workload, agent performance, and task characteristics
 * Best for: Dynamic environments with varying workloads
 */
export class AdaptiveStrategy extends BaseStrategy {
  type: CoordinationStrategyType = 'adaptive';
  name = 'Adaptive';
  description = 'Dynamically adjusts strategy based on workload, performance, and task characteristics';

  private recentAssignments: Array<{ timestamp: Date; success: boolean }> = [];
  private strategyHistory: Array<{ timestamp: Date; strategy: string }> = [];

  execute(tasks: Task[], agents: Agent[]): TaskAssignment[] {
    const workload = this.calculateWorkload(agents);
    const taskUrgency = this.calculateTaskUrgency(tasks);
    const agentAvailability = this.calculateAgentAvailability(agents);

    // Choose sub-strategy based on conditions
    let subStrategy: 'parallel' | 'sequential' | 'batched';

    if (workload > 0.8) {
      // High workload - use sequential to reduce contention
      subStrategy = 'sequential';
    } else if (taskUrgency > 0.7) {
      // High urgency - use parallel for speed
      subStrategy = 'parallel';
    } else if (agentAvailability < 0.3) {
      // Few agents available - use sequential
      subStrategy = 'sequential';
    } else {
      // Balanced - use batched approach
      subStrategy = 'batched';
    }

    this.strategyHistory.push({
      timestamp: new Date(),
      strategy: subStrategy,
    });

    // Execute chosen strategy
    switch (subStrategy) {
      case 'parallel':
        return this.executeParallel(tasks, agents);
      case 'sequential':
        return this.executeSequential(tasks, agents);
      case 'batched':
        return this.executeBatched(tasks, agents);
      default:
        return this.executeBatched(tasks, agents);
    }
  }

  /**
   * Execute parallel assignment
   */
  private executeParallel(tasks: Task[], agents: Agent[]): TaskAssignment[] {
    const parallelStrategy = new ParallelStrategy();
    return parallelStrategy.execute(tasks, agents);
  }

  /**
   * Execute sequential assignment
   */
  private executeSequential(tasks: Task[], agents: Agent[]): TaskAssignment[] {
    const sequentialStrategy = new SequentialStrategy();
    return sequentialStrategy.execute(tasks, agents);
  }

  /**
   * Execute batched assignment (middle ground)
   */
  private executeBatched(tasks: Task[], agents: Agent[]): TaskAssignment[] {
    const assignments: TaskAssignment[] = [];
    const readyTasks = this.getReadyTasks(this.sortTasksByPriority(tasks));
    const availableAgents = agents.filter((a) => a.status === 'idle' || a.workload < 0.8);

    // Calculate batch size based on agent availability
    const batchSize = Math.max(1, Math.floor(availableAgents.length * 0.5));

    // Assign tasks in batches
    const tasksToAssign = readyTasks.slice(0, batchSize);
    const agentPool = [...availableAgents];

    for (const task of tasksToAssign) {
      if (agentPool.length === 0) break;

      const bestMatch = this.getBestAgent(task, agentPool);
      if (bestMatch) {
        const assignment: TaskAssignment = {
          taskId: task.id,
          agentId: bestMatch.agent.id,
          confidence: bestMatch.score,
          reason: `Adaptive batched assignment: batch size ${batchSize}, score ${(bestMatch.score * 100).toFixed(1)}%`,
        };

        assignments.push(assignment);

        // Remove agent from pool
        const index = agentPool.findIndex((a) => a.id === bestMatch.agent.id);
        if (index !== -1) {
          agentPool.splice(index, 1);
        }
      }
    }

    return assignments;
  }

  /**
   * Calculate overall workload
   */
  private calculateWorkload(agents: Agent[]): number {
    if (agents.length === 0) return 0;
    const totalWorkload = agents.reduce((sum, a) => sum + a.workload, 0);
    return totalWorkload / agents.length;
  }

  /**
   * Calculate task urgency based on priorities
   */
  private calculateTaskUrgency(tasks: Task[]): number {
    const readyTasks = this.getReadyTasks(tasks);
    if (readyTasks.length === 0) return 0;

    const priorityScores: Record<Task['priority'], number> = {
      critical: 1,
      high: 0.7,
      medium: 0.4,
      low: 0.1,
    };

    const totalUrgency = readyTasks.reduce(
      (sum, t) => sum + priorityScores[t.priority],
      0
    );
    return totalUrgency / readyTasks.length;
  }

  /**
   * Calculate agent availability ratio
   */
  private calculateAgentAvailability(agents: Agent[]): number {
    if (agents.length === 0) return 0;
    const availableCount = agents.filter((a) => a.status === 'idle').length;
    return availableCount / agents.length;
  }

  onTaskComplete(task: Task, result: TaskResult): void {
    this.recentAssignments.push({
      timestamp: new Date(),
      success: result.success,
    });

    // Keep only recent history
    const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour
    this.recentAssignments = this.recentAssignments.filter(
      (a) => a.timestamp > cutoff
    );
  }

  onTaskFail(task: Task, error: string): void {
    this.recentAssignments.push({
      timestamp: new Date(),
      success: false,
    });
  }

  /**
   * Get strategy statistics
   */
  getStats(): {
    recentSuccessRate: number;
    strategyDistribution: Record<string, number>;
    averageWorkload: number;
  } {
    const successCount = this.recentAssignments.filter((a) => a.success).length;
    const recentSuccessRate =
      this.recentAssignments.length > 0
        ? successCount / this.recentAssignments.length
        : 1;

    const strategyDistribution: Record<string, number> = {};
    for (const entry of this.strategyHistory) {
      strategyDistribution[entry.strategy] =
        (strategyDistribution[entry.strategy] || 0) + 1;
    }

    return {
      recentSuccessRate,
      strategyDistribution,
      averageWorkload: 0, // Would need agent data
    };
  }
}

/**
 * Hierarchical Strategy
 * Uses a tree structure for task distribution (coordinator -> sub-coordinators -> workers)
 * Best for: Large-scale swarms with many agents
 */
export class HierarchicalStrategy extends BaseStrategy {
  type: CoordinationStrategyType = 'hierarchical';
  name = 'Hierarchical';
  description = 'Uses tree structure for task distribution in large-scale swarms';

  private coordinatorAgents: Set<string> = new Set();

  execute(tasks: Task[], agents: Agent[]): TaskAssignment[] {
    const assignments: TaskAssignment[] = [];

    // Identify coordinator agents
    const coordinators = agents.filter(
      (a) => a.type === 'coordinator' || this.coordinatorAgents.has(a.id)
    );

    // Group tasks by type for distribution
    const tasksByType = this.groupTasksByType(tasks);

    // Assign task groups to coordinators
    for (const coordinator of coordinators) {
      if (coordinator.workload >= 1) continue;

      // Find suitable task group for this coordinator
      const taskGroup = this.findSuitableTaskGroup(coordinator, tasksByType);
      if (taskGroup.length > 0) {
        const assignment: TaskAssignment = {
          taskId: taskGroup[0].id,
          agentId: coordinator.id,
          confidence: 0.9,
          reason: 'Hierarchical: coordinator assignment for task group',
        };

        assignments.push(assignment);

        // Mark coordinator
        this.coordinatorAgents.add(coordinator.id);
      }
    }

    // Assign remaining tasks to worker agents
    const workerAgents = agents.filter(
      (a) => !this.coordinatorAgents.has(a.id) && a.workload < 1
    );

    const remainingTasks = tasks.filter(
      (t) => !assignments.some((a) => a.taskId === t.id)
    );

    // Use parallel strategy for workers
    const parallelStrategy = new ParallelStrategy();
    const workerAssignments = parallelStrategy.execute(remainingTasks, workerAgents);

    return [...assignments, ...workerAssignments];
  }

  /**
   * Group tasks by type
   */
  private groupTasksByType(tasks: Task[]): Map<string, Task[]> {
    const groups = new Map<string, Task[]>();

    for (const task of tasks) {
      const group = groups.get(task.taskType) || [];
      group.push(task);
      groups.set(task.taskType, group);
    }

    return groups;
  }

  /**
   * Find suitable task group for a coordinator
   */
  private findSuitableTaskGroup(
    coordinator: Agent,
    tasksByType: Map<string, Task[]>
  ): Task[] {
    // Find the largest group of tasks suitable for this coordinator
    let bestGroup: Task[] = [];

    for (const [type, tasks] of tasksByType.entries()) {
      if (isSuitableForTaskType(coordinator.type, type) && tasks.length > bestGroup.length) {
        bestGroup = tasks;
      }
    }

    return bestGroup;
  }
}

/**
 * Strategy factory
 */
export function createStrategy(type: CoordinationStrategyType): CoordinationStrategy {
  switch (type) {
    case 'parallel':
      return new ParallelStrategy();
    case 'sequential':
      return new SequentialStrategy();
    case 'adaptive':
      return new AdaptiveStrategy();
    case 'hierarchical':
      return new HierarchicalStrategy();
    default:
      throw new Error(`Unknown strategy type: ${type}`);
  }
}

/**
 * Get all available strategies
 */
export function getAvailableStrategies(): CoordinationStrategy[] {
  return [
    new ParallelStrategy(),
    new SequentialStrategy(),
    new AdaptiveStrategy(),
    new HierarchicalStrategy(),
  ];
}

/**
 * Get strategy recommendations based on context
 */
export function recommendStrategy(
  taskCount: number,
  agentCount: number,
  dependencyRatio: number
): CoordinationStrategyType {
  if (agentCount > 20 && taskCount > 50) {
    return 'hierarchical';
  }

  if (dependencyRatio > 0.5) {
    return 'sequential';
  }

  if (taskCount > agentCount * 2) {
    return 'parallel';
  }

  return 'adaptive';
}

