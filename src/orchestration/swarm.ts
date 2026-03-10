/**
 * Swarm Management
 * Handles swarm lifecycle, agent registration, and task management
 */

import { EventEmitter } from 'events';
import {
  Swarm,
  SwarmConfig,
  SwarmStatus,
  SwarmMetrics,
  Agent,
  AgentType,
  AgentStatus,
  AgentConfig,
  Task,
  TaskStatus,
  TaskResult,
  Message,
  AgentRegistrationRequest,
  TaskCreationRequest,
} from './types';
import { createAgentConfig, getAllAgentTypes } from './agents';
import { v4 as uuidv4 } from '../utils/uuid';

/** Swarm options */
export interface SwarmOptions {
  /** Auto-start the swarm after creation */
  autoStart?: boolean;
  /** Enable event emission */
  enableEvents?: boolean;
}

/** Default swarm configuration */
const DEFAULT_SWARM_CONFIG: Partial<SwarmConfig> = {
  maxAgents: 20,
  strategy: 'adaptive',
  autoScale: true,
  loadBalance: true,
  retryPolicy: {
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true,
  },
  globalPermissions: [],
  defaultAgentConfigs: {},
};

/**
 * Swarm Manager - handles swarm lifecycle and operations
 */
export class SwarmManager extends EventEmitter {
  private swarm: Swarm;
  private config: SwarmConfig;
  private heartbeatInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;

  constructor(config: SwarmConfig, options: SwarmOptions = {}) {
    super();
    this.config = { ...DEFAULT_SWARM_CONFIG, ...config } as SwarmConfig;
    this.swarm = this.createSwarm(this.config);

    if (options.autoStart !== false) {
      this.start();
    }
  }

  /**
   * Create a new swarm instance
   */
  private createSwarm(config: SwarmConfig): Swarm {
    return {
      config,
      status: 'initializing',
      agents: new Map(),
      tasks: new Map(),
      messages: [],
      metrics: this.initializeMetrics(),
      createdAt: new Date(),
    };
  }

  /**
   * Initialize swarm metrics
   */
  private initializeMetrics(): SwarmMetrics {
    return {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      cancelledTasks: 0,
      averageCompletionTime: 0,
      agentUtilization: 0,
      messageCount: 0,
      errorCount: 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * Start the swarm
   */
  start(): void {
    if (this.swarm.status === 'active') {
      return;
    }

    this.swarm.status = 'active';
    this.swarm.startedAt = new Date();

    // Start heartbeat monitoring
    this.startHeartbeat();

    // Start metrics collection
    this.startMetricsCollection();

    this.emit('swarm_started', { swarmId: this.config.id });
  }

  /**
   * Pause the swarm
   */
  pause(): void {
    if (this.swarm.status !== 'active') {
      return;
    }

    this.swarm.status = 'paused';
    this.emit('swarm_paused', { swarmId: this.config.id });
  }

  /**
   * Resume the swarm
   */
  resume(): void {
    if (this.swarm.status !== 'paused') {
      return;
    }

    this.swarm.status = 'active';
    this.emit('swarm_resumed', { swarmId: this.config.id });
  }

  /**
   * Shutdown the swarm gracefully
   */
  async shutdown(graceful: boolean = true): Promise<void> {
    this.swarm.status = 'shutting_down';
    this.emit('swarm_shutting_down', { swarmId: this.config.id, graceful });

    // Stop intervals
    this.stopHeartbeat();
    this.stopMetricsCollection();

    if (graceful) {
      // Wait for active tasks to complete
      await this.waitForActiveTasks();
    }

    // Mark all agents as offline
    for (const agent of this.swarm.agents.values()) {
      agent.status = 'offline';
    }

    this.swarm.status = 'terminated';
    this.swarm.terminatedAt = new Date();
    this.emit('swarm_terminated', { swarmId: this.config.id });
  }

  /**
   * Wait for active tasks to complete
   */
  private async waitForActiveTasks(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const activeTasks = this.getActiveTasks();
      if (activeTasks.length === 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  /**
   * Get active tasks
   */
  private getActiveTasks(): Task[] {
    return Array.from(this.swarm.tasks.values()).filter(
      (task) => task.status === 'in_progress' || task.status === 'assigned'
    );
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.checkAgentHealth();
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, 60000); // Every minute
  }

  /**
   * Stop metrics collection
   */
  private stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }

  /**
   * Check agent health
   */
  private checkAgentHealth(): void {
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const agent of this.swarm.agents.values()) {
      const timeSinceHeartbeat = now.getTime() - agent.health.lastHeartbeat.getTime();

      if (timeSinceHeartbeat > staleThreshold) {
        if (agent.status !== 'error') {
          agent.status = 'error';
          this.emit('agent_stale', { agentId: agent.id, swarmId: this.config.id });
        }
      }
    }
  }

  /**
   * Update swarm metrics
   */
  private updateMetrics(): void {
    const tasks = Array.from(this.swarm.tasks.values());
    const agents = Array.from(this.swarm.agents.values());

    // Calculate agent utilization
    const busyAgents = agents.filter((a) => a.status === 'busy').length;
    const utilization = agents.length > 0 ? busyAgents / agents.length : 0;

    // Calculate average completion time
    const completedTasks = tasks.filter((t) => t.status === 'completed' && t.actualDuration);
    const avgCompletionTime =
      completedTasks.length > 0
        ? completedTasks.reduce((sum, t) => sum + (t.actualDuration || 0), 0) / completedTasks.length
        : 0;

    this.swarm.metrics = {
      ...this.swarm.metrics,
      agentUtilization: utilization,
      averageCompletionTime: avgCompletionTime,
      lastUpdated: new Date(),
    };

    this.emit('metrics_updated', { metrics: this.swarm.metrics });
  }

  /**
   * Register a new agent in the swarm
   */
  registerAgent(request: AgentRegistrationRequest): Agent {
    if (this.swarm.agents.size >= this.config.maxAgents) {
      throw new Error(`Swarm has reached maximum agent limit (${this.config.maxAgents})`);
    }

    const agentConfig = createAgentConfig(request.type, {
      name: request.name,
      customConfig: request.customConfig,
    });

    const agent: Agent = {
      id: agentConfig.id,
      type: request.type,
      name: agentConfig.name,
      status: 'idle',
      config: agentConfig,
      assignedTasks: [],
      maxConcurrentTasks: agentConfig.capabilities.maxParallelTasks,
      workload: 0,
      health: {
        lastHeartbeat: new Date(),
        successRate: 1.0,
        averageResponseTime: 0,
        errorCount: 0,
      },
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.swarm.agents.set(agent.id, agent);
    this.emit('agent_registered', { agent, swarmId: this.config.id });

    return agent;
  }

  /**
   * Unregister an agent from the swarm
   */
  unregisterAgent(agentId: string): boolean {
    const agent = this.swarm.agents.get(agentId);
    if (!agent) {
      return false;
    }

    // Reassign any pending tasks
    for (const taskId of agent.assignedTasks) {
      const task = this.swarm.tasks.get(taskId);
      if (task && (task.status === 'pending' || task.status === 'assigned')) {
        task.status = 'pending';
        task.assignedTo = undefined;
        this.emit('task_unassigned', { taskId, agentId, swarmId: this.config.id });
      }
    }

    this.swarm.agents.delete(agentId);
    this.emit('agent_unregistered', { agentId, swarmId: this.config.id });

    return true;
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.swarm.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.swarm.agents.values());
  }

  /**
   * Get agents by type
   */
  getAgentsByType(type: AgentType): Agent[] {
    return this.getAllAgents().filter((agent) => agent.type === type);
  }

  /**
   * Get available (idle) agents
   */
  getAvailableAgents(): Agent[] {
    return this.getAllAgents().filter((agent) => agent.status === 'idle' && agent.workload < 1);
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId: string, status: AgentStatus): boolean {
    const agent = this.swarm.agents.get(agentId);
    if (!agent) {
      return false;
    }

    const oldStatus = agent.status;
    agent.status = status;
    agent.lastActivityAt = new Date();
    agent.health.lastHeartbeat = new Date();

    this.emit('agent_status_changed', {
      agentId,
      oldStatus,
      newStatus: status,
      swarmId: this.config.id,
    });

    return true;
  }

  /**
   * Update agent workload
   */
  updateAgentWorkload(agentId: string, workload: number): boolean {
    const agent = this.swarm.agents.get(agentId);
    if (!agent) {
      return false;
    }

    agent.workload = Math.max(0, Math.min(1, workload));
    agent.status = agent.workload >= 1 ? 'busy' : agent.workload > 0 ? 'busy' : 'idle';
    agent.lastActivityAt = new Date();

    return true;
  }

  /**
   * Create a new task
   */
  createTask(request: TaskCreationRequest): Task {
    const taskId = uuidv4();
    const task: Task = {
      id: taskId,
      title: request.title,
      description: request.description,
      taskType: request.taskType,
      status: 'pending',
      priority: request.priority || 'medium',
      complexity: request.complexity || 'moderate',
      requiredCapabilities: request.requiredCapabilities,
      requiredAgentType: request.requiredAgentType,
      dependencies: request.dependencies || [],
      dependents: [],
      context: request.context,
      createdAt: new Date(),
      estimatedDuration: request.estimatedDuration,
    };

    // Update dependents for dependencies
    for (const depId of task.dependencies) {
      const depTask = this.swarm.tasks.get(depId);
      if (depTask) {
        depTask.dependents.push(taskId);
      }
    }

    this.swarm.tasks.set(taskId, task);
    this.swarm.metrics.totalTasks++;

    this.emit('task_created', { task, swarmId: this.config.id });

    return task;
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.swarm.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.swarm.tasks.values());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    return this.getAllTasks().filter((task) => task.status === status);
  }

  /**
   * Get pending tasks (ready to be assigned)
   */
  getPendingTasks(): Task[] {
    return this.getAllTasks().filter((task) => {
      if (task.status !== 'pending') return false;
      // Check if all dependencies are completed
      return task.dependencies.every((depId) => {
        const depTask = this.swarm.tasks.get(depId);
        return depTask?.status === 'completed';
      });
    });
  }

  /**
   * Assign a task to an agent
   */
  assignTask(taskId: string, agentId: string): boolean {
    const task = this.swarm.tasks.get(taskId);
    const agent = this.swarm.agents.get(agentId);

    if (!task || !agent) {
      return false;
    }

    if (task.status !== 'pending') {
      return false;
    }

    task.assignedTo = agentId;
    task.status = 'assigned';
    task.startedAt = new Date();

    agent.assignedTasks.push(taskId);
    agent.status = 'busy';
    agent.workload = Math.min(1, agent.assignedTasks.length / agent.maxConcurrentTasks);

    this.emit('task_assigned', { taskId, agentId, swarmId: this.config.id });

    return true;
  }

  /**
   * Start task execution
   */
  startTask(taskId: string): boolean {
    const task = this.swarm.tasks.get(taskId);
    if (!task || task.status !== 'assigned') {
      return false;
    }

    task.status = 'in_progress';
    task.startedAt = new Date();

    this.emit('task_started', { taskId, agentId: task.assignedTo, swarmId: this.config.id });

    return true;
  }

  /**
   * Complete a task
   */
  completeTask(taskId: string, result: TaskResult): boolean {
    const task = this.swarm.tasks.get(taskId);
    if (!task || task.status !== 'in_progress') {
      return false;
    }

    task.status = result.success ? 'completed' : 'failed';
    task.result = result;
    task.completedAt = new Date();

    if (task.startedAt) {
      task.actualDuration = (task.completedAt.getTime() - task.startedAt.getTime()) / (1000 * 60);
    }

    // Update agent
    if (task.assignedTo) {
      const agent = this.swarm.agents.get(task.assignedTo);
      if (agent) {
        agent.assignedTasks = agent.assignedTasks.filter((id) => id !== taskId);
        agent.workload = agent.assignedTasks.length / agent.maxConcurrentTasks;
        agent.status = agent.workload > 0 ? 'busy' : 'idle';

        // Update health metrics
        if (result.success) {
          agent.health.successRate =
            (agent.health.successRate * 9 + 1) / 10; // Moving average
        } else {
          agent.health.successRate =
            (agent.health.successRate * 9) / 10;
          agent.health.errorCount++;
        }
      }
    }

    // Update metrics
    if (result.success) {
      this.swarm.metrics.completedTasks++;
    } else {
      this.swarm.metrics.failedTasks++;
    }

    this.emit(result.success ? 'task_completed' : 'task_failed', {
      taskId,
      result,
      swarmId: this.config.id,
    });

    return true;
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    const task = this.swarm.tasks.get(taskId);
    if (!task || task.status === 'completed' || task.status === 'failed') {
      return false;
    }

    task.status = 'cancelled';
    task.completedAt = new Date();

    // Update agent
    if (task.assignedTo) {
      const agent = this.swarm.agents.get(task.assignedTo);
      if (agent) {
        agent.assignedTasks = agent.assignedTasks.filter((id) => id !== taskId);
        agent.workload = agent.assignedTasks.length / agent.maxConcurrentTasks;
        agent.status = agent.workload > 0 ? 'busy' : 'idle';
      }
    }

    this.swarm.metrics.cancelledTasks++;

    this.emit('task_cancelled', { taskId, swarmId: this.config.id });

    return true;
  }

  /**
   * Add a message to the swarm
   */
  addMessage(message: Message): void {
    this.swarm.messages.push(message);
    this.swarm.metrics.messageCount++;

    this.emit('message_added', { message, swarmId: this.config.id });
  }

  /**
   * Get messages for an agent
   */
  getMessagesForAgent(agentId: string, unreadOnly: boolean = false): Message[] {
    return this.swarm.messages.filter((msg) => {
      if (msg.to !== agentId && msg.to !== 'broadcast') return false;
      if (unreadOnly && msg.read) return false;
      return true;
    });
  }

  /**
   * Mark message as read
   */
  markMessageRead(messageId: string): boolean {
    const message = this.swarm.messages.find((m) => m.id === messageId);
    if (!message) {
      return false;
    }

    message.read = true;
    return true;
  }

  /**
   * Get swarm metrics
   */
  getMetrics(): SwarmMetrics {
    return { ...this.swarm.metrics };
  }

  /**
   * Get swarm status
   */
  getStatus(): SwarmStatus {
    return this.swarm.status;
  }

  /**
   * Get swarm info
   */
  getInfo(): {
    id: string;
    name: string;
    status: SwarmStatus;
    agentCount: number;
    taskCount: number;
    createdAt: Date;
    startedAt?: Date;
  } {
    return {
      id: this.config.id,
      name: this.config.name,
      status: this.swarm.status,
      agentCount: this.swarm.agents.size,
      taskCount: this.swarm.tasks.size,
      createdAt: this.swarm.createdAt,
      startedAt: this.swarm.startedAt,
    };
  }

  /**
   * Get swarm config
   */
  getConfig(): SwarmConfig {
    return { ...this.config };
  }

  /**
   * Auto-scale agents based on workload
   */
  autoScale(): Agent[] {
    if (!this.config.autoScale) {
      return [];
    }

    const newAgents: Agent[] = [];
    const pendingTasks = this.getPendingTasks().length;
    const availableAgents = this.getAvailableAgents().length;

    // Scale up if there are pending tasks and no available agents
    if (pendingTasks > 0 && availableAgents === 0) {
      const agentsNeeded = Math.min(
        pendingTasks,
        this.config.maxAgents - this.swarm.agents.size
      );

      for (let i = 0; i < agentsNeeded; i++) {
        // Find the most suitable agent type for pending tasks
        const agentType = this.determineBestAgentType();
        const agent = this.registerAgent({ type: agentType });
        newAgents.push(agent);
      }
    }

    return newAgents;
  }

  /**
   * Determine the best agent type for current workload
   */
  private determineBestAgentType(): AgentType {
    const pendingTasks = this.getPendingTasks();
    const typeCounts: Record<string, number> = {};

    // Count required agent types
    for (const task of pendingTasks) {
      if (task.requiredAgentType) {
        typeCounts[task.requiredAgentType] = (typeCounts[task.requiredAgentType] || 0) + 1;
      }
    }

    // Find the type with most demand
    let bestType: AgentType = 'executor';
    let maxCount = 0;

    for (const [type, count] of Object.entries(typeCounts)) {
      if (count > maxCount) {
        maxCount = count;
        bestType = type as AgentType;
      }
    }

    return bestType;
  }

  /**
   * Export swarm state
   */
  exportState(): object {
    return {
      config: this.config,
      status: this.swarm.status,
      agents: Array.from(this.swarm.agents.entries()),
      tasks: Array.from(this.swarm.tasks.entries()),
      messages: this.swarm.messages,
      metrics: this.swarm.metrics,
      createdAt: this.swarm.createdAt,
      startedAt: this.swarm.startedAt,
    };
  }

  /**
   * Import swarm state
   */
  importState(state: object): void {
    const imported = state as {
      config: SwarmConfig;
      agents: [string, Agent][];
      tasks: [string, Task][];
      messages: Message[];
      metrics: SwarmMetrics;
    };

    this.config = imported.config;
    this.swarm.config = imported.config;
    this.swarm.agents = new Map(imported.agents);
    this.swarm.tasks = new Map(imported.tasks);
    this.swarm.messages = imported.messages;
    this.swarm.metrics = imported.metrics;
  }
}

/**
 * Create a new swarm
 */
export function createSwarm(
  name: string,
  config?: Partial<SwarmConfig>,
  options?: SwarmOptions
): SwarmManager {
  const swarmConfig: SwarmConfig = {
    id: uuidv4(),
    name,
    ...DEFAULT_SWARM_CONFIG,
    ...config,
    defaultAgentConfigs: {
      ...DEFAULT_SWARM_CONFIG.defaultAgentConfigs,
      ...config?.defaultAgentConfigs,
    },
    retryPolicy: {
      ...DEFAULT_SWARM_CONFIG.retryPolicy,
      ...config?.retryPolicy,
    },
  } as SwarmConfig;

  return new SwarmManager(swarmConfig, options);
}

export { SwarmConfig, SwarmStatus, SwarmMetrics, Agent, AgentStatus, Task, TaskStatus };
