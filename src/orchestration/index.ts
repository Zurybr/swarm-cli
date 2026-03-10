/**
 * Orchestration Module - Main Entry Point
 * Provides the main Orchestrator class for managing swarms, agents, and tasks
 */

import { EventEmitter } from 'events';
import {
  OrchestratorConfig,
  OrchestratorEvent,
  OrchestratorEventType,
  EventHandler,
  SwarmConfig,
  AgentType,
  Agent,
  Task,
  TaskResult,
  TaskCreationRequest,
  AgentRegistrationRequest,
  MessageSendRequest,
  CoordinationStrategyType,
  SwarmMetrics,
} from './types';
import { SwarmManager, createSwarm } from './swarm';
import { Coordinator } from './coordinator';
import { MessagingSystem } from './messaging';
import { createStrategy, recommendStrategy } from './strategy';
import { getAllAgentTypes, createAgentConfig, getAgentName } from './agents';
import { v4 as uuidv4 } from '../utils/uuid';

/** Default orchestrator configuration */
const DEFAULT_CONFIG: OrchestratorConfig = {
  defaultStrategy: 'adaptive',
  maxConcurrentSwarms: 5,
  taskQueueSize: 1000,
  enablePersistence: false,
  logLevel: 'info',
};

/**
 * Main Orchestrator class
 * Manages multiple swarms, coordinates agents, and handles task distribution
 */
export class Orchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private swarms: Map<string, SwarmManager> = new Map();
  private coordinators: Map<string, Coordinator> = new Map();
  private messagingSystems: Map<string, MessagingSystem> = new Map();
  private eventHandlers: Map<OrchestratorEventType, Set<EventHandler>> = new Map();
  private eventHistory: OrchestratorEvent[] = [];
  private maxEventHistory: number = 10000;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupEventForwarding();
  }

  /**
   * Set up event forwarding from swarms to orchestrator
   */
  private setupEventForwarding(): void {
    // Events are forwarded when swarms are created
  }

  /**
   * Create a new swarm
   */
  createSwarm(name: string, config?: Partial<SwarmConfig>): SwarmManager {
    if (this.swarms.size >= this.config.maxConcurrentSwarms) {
      throw new Error(
        `Maximum number of concurrent swarms (${this.config.maxConcurrentSwarms}) reached`
      );
    }

    const swarmId = uuidv4();
    const swarmConfig: SwarmConfig = {
      id: swarmId,
      name,
      strategy: this.config.defaultStrategy,
      maxAgents: 20,
      autoScale: true,
      loadBalance: true,
      retryPolicy: {
        maxRetries: 3,
        retryDelay: 1000,
        exponentialBackoff: true,
      },
      defaultAgentConfigs: {},
      globalPermissions: [],
      ...config,
    };

    const swarm = createSwarm(name, swarmConfig, { autoStart: true });
    this.swarms.set(swarmId, swarm);

    // Create coordinator for this swarm
    const coordinator = new Coordinator(swarm, {
      defaultStrategy: swarmConfig.strategy,
      loadBalance: swarmConfig.loadBalance,
      autoRoute: true,
    });
    this.coordinators.set(swarmId, coordinator);

    // Create messaging system for this swarm
    const messaging = new MessagingSystem(swarm, {
      maxMessages: 10000,
      persistMessages: this.config.enablePersistence,
    });
    this.messagingSystems.set(swarmId, messaging);

    // Set up event forwarding
    this.forwardSwarmEvents(swarmId, swarm);

    this.emit('swarm_created', { swarmId, name });
    this.logEvent('swarm_created', { swarmId, name });

    return swarm;
  }

  /**
   * Forward events from swarm to orchestrator
   */
  private forwardSwarmEvents(swarmId: string, swarm: SwarmManager): void {
    const eventsToForward = [
      'swarm_started',
      'swarm_paused',
      'swarm_resumed',
      'swarm_shutting_down',
      'swarm_terminated',
      'agent_registered',
      'agent_unregistered',
      'agent_status_changed',
      'task_created',
      'task_assigned',
      'task_started',
      'task_completed',
      'task_failed',
      'task_cancelled',
      'message_added',
      'metrics_updated',
    ];

    for (const eventName of eventsToForward) {
      swarm.on(eventName, (data: Record<string, unknown>) => {
        this.emit(eventName, { ...data, swarmId });
        this.logEvent(eventName as OrchestratorEventType, { ...data, swarmId });
      });
    }
  }

  /**
   * Get a swarm by ID
   */
  getSwarm(swarmId: string): SwarmManager | undefined {
    return this.swarms.get(swarmId);
  }

  /**
   * Get all swarms
   */
  getAllSwarms(): SwarmManager[] {
    return Array.from(this.swarms.values());
  }

  /**
   * Terminate a swarm
   */
  async terminateSwarm(swarmId: string, graceful: boolean = true): Promise<boolean> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      return false;
    }

    await swarm.shutdown(graceful);

    this.coordinators.delete(swarmId);
    this.messagingSystems.delete(swarmId);
    this.swarms.delete(swarmId);

    this.emit('swarm_terminated', { swarmId });
    this.logEvent('swarm_terminated', { swarmId });

    return true;
  }

  /**
   * Register an agent in a swarm
   */
  registerAgent(swarmId: string, request: AgentRegistrationRequest): Agent {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error(`Swarm not found: ${swarmId}`);
    }

    const agent = swarm.registerAgent(request);
    this.emit('agent_registered', { swarmId, agentId: agent.id, type: agent.type });

    return agent;
  }

  /**
   * Register multiple agents
   */
  registerAgents(
    swarmId: string,
    requests: AgentRegistrationRequest[]
  ): Agent[] {
    return requests.map((request) => this.registerAgent(swarmId, request));
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(swarmId: string, agentId: string): boolean {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      return false;
    }

    const result = swarm.unregisterAgent(agentId);
    if (result) {
      this.emit('agent_unregistered', { swarmId, agentId });
    }

    return result;
  }

  /**
   * Create a task in a swarm
   */
  createTask(swarmId: string, request: TaskCreationRequest): Task {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error(`Swarm not found: ${swarmId}`);
    }

    const task = swarm.createTask(request);
    this.emit('task_created', { swarmId, taskId: task.id });

    return task;
  }

  /**
   * Create multiple tasks
   */
  createTasks(swarmId: string, requests: TaskCreationRequest[]): Task[] {
    return requests.map((request) => this.createTask(swarmId, request));
  }

  /**
   * Complete a task
   */
  completeTask(swarmId: string, taskId: string, result: TaskResult): boolean {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      return false;
    }

    return swarm.completeTask(taskId, result);
  }

  /**
   * Cancel a task
   */
  cancelTask(swarmId: string, taskId: string): boolean {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      return false;
    }

    return swarm.cancelTask(taskId);
  }

  /**
   * Send a message between agents
   */
  sendMessage(swarmId: string, request: MessageSendRequest): boolean {
    const messaging = this.messagingSystems.get(swarmId);
    if (!messaging) {
      return false;
    }

    const result = messaging.send(request);
    return result.success;
  }

  /**
   * Set coordination strategy for a swarm
   */
  setStrategy(swarmId: string, strategyType: CoordinationStrategyType): boolean {
    const coordinator = this.coordinators.get(swarmId);
    if (!coordinator) {
      return false;
    }

    coordinator.setStrategy(strategyType);
    return true;
  }

  /**
   * Get recommended strategy for a swarm
   */
  getRecommendedStrategy(swarmId: string): CoordinationStrategyType {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      return 'adaptive';
    }

    const tasks = swarm.getAllTasks();
    const agents = swarm.getAllAgents();

    // Calculate dependency ratio
    const tasksWithDeps = tasks.filter((t) => t.dependencies.length > 0).length;
    const dependencyRatio = tasks.length > 0 ? tasksWithDeps / tasks.length : 0;

    return recommendStrategy(tasks.length, agents.length, dependencyRatio);
  }

  /**
   * Process pending tasks in a swarm
   */
  async processPendingTasks(swarmId: string): Promise<void> {
    const coordinator = this.coordinators.get(swarmId);
    if (!coordinator) {
      return;
    }

    await coordinator.processPendingTasks();
  }

  /**
   * Create a workflow in a swarm
   */
  createWorkflow(
    swarmId: string,
    tasks: Array<{
      title: string;
      description: string;
      taskType: string;
      dependencies?: string[];
      priority?: Task['priority'];
    }>
  ): string[] {
    const coordinator = this.coordinators.get(swarmId);
    if (!coordinator) {
      throw new Error(`Swarm not found: ${swarmId}`);
    }

    return coordinator.createWorkflow(tasks);
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(
    swarmId: string,
    taskIds: string[]
  ): {
    completed: number;
    inProgress: number;
    pending: number;
    failed: number;
    total: number;
    progress: number;
  } {
    const coordinator = this.coordinators.get(swarmId);
    if (!coordinator) {
      return { completed: 0, inProgress: 0, pending: 0, failed: 0, total: 0, progress: 0 };
    }

    return coordinator.getWorkflowStatus(taskIds);
  }

  /**
   * Get orchestrator statistics
   */
  getStats(): {
    swarmCount: number;
    totalAgents: number;
    totalTasks: number;
    activeTasks: number;
    completedTasks: number;
    failedTasks: number;
  } {
    let totalAgents = 0;
    let totalTasks = 0;
    let activeTasks = 0;
    let completedTasks = 0;
    let failedTasks = 0;

    for (const swarm of this.swarms.values()) {
      totalAgents += swarm.getAllAgents().length;
      const tasks = swarm.getAllTasks();
      totalTasks += tasks.length;
      activeTasks += tasks.filter((t) => t.status === 'in_progress').length;
      completedTasks += tasks.filter((t) => t.status === 'completed').length;
      failedTasks += tasks.filter((t) => t.status === 'failed').length;
    }

    return {
      swarmCount: this.swarms.size,
      totalAgents,
      totalTasks,
      activeTasks,
      completedTasks,
      failedTasks,
    };
  }

  /**
   * Get swarm statistics
   */
  getSwarmStats(swarmId: string): {
    agents: number;
    tasks: number;
    metrics: SwarmMetrics;
    status: string;
  } | null {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      return null;
    }

    return {
      agents: swarm.getAllAgents().length,
      tasks: swarm.getAllTasks().length,
      metrics: swarm.getMetrics(),
      status: swarm.getStatus(),
    };
  }

  /**
   * Log an event
   */
  private logEvent(type: OrchestratorEventType, data: Record<string, unknown>): void {
    const event: OrchestratorEvent = {
      type,
      timestamp: new Date(),
      data,
    };

    this.eventHistory.push(event);

    // Trim history if needed
    if (this.eventHistory.length > this.maxEventHistory) {
      this.eventHistory = this.eventHistory.slice(-this.maxEventHistory);
    }
  }

  /**
   * Get event history
   */
  getEventHistory(
    filter?: {
      type?: OrchestratorEventType;
      since?: Date;
      until?: Date;
      limit?: number;
    }
  ): OrchestratorEvent[] {
    let events = [...this.eventHistory];

    if (filter?.type) {
      events = events.filter((e) => e.type === filter.type);
    }

    if (filter?.since) {
      events = events.filter((e) => e.timestamp >= filter.since!);
    }

    if (filter?.until) {
      events = events.filter((e) => e.timestamp <= filter.until!);
    }

    if (filter?.limit) {
      events = events.slice(-filter.limit);
    }

    return events;
  }

  /**
   * Register an event handler
   */
  onEvent(type: OrchestratorEventType, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, new Set());
    }

    this.eventHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(type)?.delete(handler);
    };
  }

  /**
   * Get all available agent types
   */
  getAvailableAgentTypes(): AgentType[] {
    return getAllAgentTypes();
  }

  /**
   * Get agent type information
   */
  getAgentTypeInfo(type: AgentType): {
    name: string;
    description: string;
    capabilities: ReturnType<typeof createAgentConfig>['capabilities'];
  } {
    const config = createAgentConfig(type);
    return {
      name: config.name,
      description: config.description,
      capabilities: config.capabilities,
    };
  }

  /**
   * Auto-scale a swarm
   */
  autoScale(swarmId: string): Agent[] {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      return [];
    }

    return swarm.autoScale();
  }

  /**
   * Balance load in a swarm
   */
  balanceLoad(swarmId: string): void {
    const coordinator = this.coordinators.get(swarmId);
    if (!coordinator) {
      return;
    }

    coordinator.balanceLoad();
  }

  /**
   * Export orchestrator state
   */
  exportState(): object {
    return {
      config: this.config,
      swarms: Array.from(this.swarms.entries()).map(([id, swarm]) => ({
        id,
        info: swarm.getInfo(),
        state: swarm.exportState(),
      })),
      eventHistory: this.eventHistory,
    };
  }

  /**
   * Import orchestrator state
   */
  importState(state: {
    config: OrchestratorConfig;
    swarms: Array<{ id: string; state: object }>;
  }): void {
    this.config = state.config;

    for (const swarmData of state.swarms) {
      const swarm = this.swarms.get(swarmData.id);
      if (swarm) {
        swarm.importState(swarmData.state);
      }
    }
  }

  /**
   * Shutdown the orchestrator
   */
  async shutdown(graceful: boolean = true): Promise<void> {
    // Shutdown all swarms
    for (const [swarmId] of this.swarms) {
      await this.terminateSwarm(swarmId, graceful);
    }

    this.emit('shutdown', { graceful });
  }
}

// Export all types and utilities
export * from './types';
export * from './agents';
export * from './swarm';
export type { CoordinatorOptions } from './coordinator';
export type { MessagingOptions, MessageFilter, MessageDeliveryResult, MessageThread } from './messaging';
export type { CoordinationStrategy } from './strategy';

// Default export
export default Orchestrator;
