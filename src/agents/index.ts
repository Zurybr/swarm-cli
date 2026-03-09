/**
 * Main Agent System
 * Central hub for managing specialized agents, routing tasks, and coordinating work
 */

import { randomUUID } from 'crypto';
import {
  AgentType,
  AgentConfig,
  AgentInstance,
  TaskAssignment,
  TaskResult,
  RoutingDecision,
  AgentSystemConfig,
  PermissionCheckResult,
} from './types';
import {
  createAgentConfig,
  getAgentName,
  getAgentDescription,
  getAllAgentTypes,
  getDefaultCapabilities,
  getDefaultPermissions,
} from './definitions';
import {
  getMetaPrompt,
  getSystemPrompt,
  formatTaskPrompt,
  getDefaultTools,
  getResponseFormat,
} from './metaprompts';
import { routeTask, routeTasks, canHandleTask, rerouteTask } from './router';
import {
  checkPermission,
  checkPermissions,
  validateTaskExecution,
  createPermissionGuard,
  getPermissionSummary,
  permissionManager,
  PermissionManager,
} from './permissions';
import { Logger } from '../utils/logger';

// Re-export all types and functions
export * from './types';
export * from './definitions';
export * from './metaprompts';
export * from './router';
export * from './permissions';

// Builder exports - Composable Agent Builder
export { AgentBuilder } from './builder/agent-builder';
export { ComposedAgent } from './builder/composed-agent';
export { SkillChain, SkillChainExecutor } from './builder/skill-chain';
export { SchemaValidator } from './builder/schema-validator';

// Builder types
export type {
  SkillConfig,
  CompositionConfig,
  CompositionValidationResult,
} from './types/composition';

// Re-export base agent types for convenience
export {
  BaseAgent,
  type AgentConfig,
  type Task,
  type AgentResult,
} from './base-agent';

/**
 * Configuration for the Agent System
 */
const DEFAULT_SYSTEM_CONFIG: AgentSystemConfig = {
  defaultConfigs: {} as Record<AgentType, AgentConfig>,
  globalPermissions: [],
  routingRules: [],
  modelConfigs: {
    fast: { model: 'claude-3-haiku', temperature: 0.3, maxTokens: 2048 },
    balanced: { model: 'claude-3-sonnet', temperature: 0.5, maxTokens: 4096 },
    powerful: { model: 'claude-3-opus', temperature: 0.7, maxTokens: 8192 },
  },
};

/**
 * Main Agent System class
 */
export class AgentSystem {
  private logger: Logger;
  private instances: Map<string, AgentInstance> = new Map();
  private config: AgentSystemConfig;
  private taskHistory: Map<string, TaskResult> = new Map();
  private permissionManager: PermissionManager;

  constructor(config: Partial<AgentSystemConfig> = {}) {
    this.logger = new Logger('AgentSystem');
    this.config = { ...DEFAULT_SYSTEM_CONFIG, ...config };
    this.permissionManager = permissionManager;

    // Initialize default configs for all agent types
    for (const agentType of getAllAgentTypes()) {
      this.config.defaultConfigs[agentType] = createAgentConfig(agentType);
    }

    this.logger.info('Agent System initialized');
  }

  /**
   * Create a new agent instance
   */
  createAgent(
    type: AgentType,
    customConfig?: Partial<AgentConfig>
  ): AgentInstance {
    // Check if we have permission to create this agent type
    const id = randomUUID();
    const config = createAgentConfig(type, {
      id,
      ...customConfig,
    });

    // Ensure meta-prompt is loaded
    if (!config.metaPrompt) {
      config.metaPrompt = getMetaPrompt(type);
    }

    const instance: AgentInstance = {
      id,
      type,
      status: 'idle',
      taskHistory: [],
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.instances.set(id, instance);
    this.logger.info(`Created ${type} agent instance: ${id}`);

    return instance;
  }

  /**
   * Get an agent instance by ID
   */
  getAgent(id: string): AgentInstance | undefined {
    return this.instances.get(id);
  }

  /**
   * Get all agent instances
   */
  getAllAgents(): AgentInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Get agents by type
   */
  getAgentsByType(type: AgentType): AgentInstance[] {
    return this.getAllAgents().filter((a) => a.type === type);
  }

  /**
   * Get agents by status
   */
  getAgentsByStatus(status: AgentInstance['status']): AgentInstance[] {
    return this.getAllAgents().filter((a) => a.status === status);
  }

  /**
   * Get idle agents that can handle a task
   */
  getAvailableAgents(task: TaskAssignment): AgentInstance[] {
    return this.getAgentsByStatus('idle').filter((agent) =>
      canHandleTask(agent.type, task)
    );
  }

  /**
   * Destroy an agent instance
   */
  destroyAgent(id: string): boolean {
    const agent = this.instances.get(id);
    if (!agent) return false;

    if (agent.status === 'busy') {
      this.logger.warn(`Destroying busy agent ${id}`);
    }

    this.instances.delete(id);
    this.permissionManager.clearOverrides(id);
    this.logger.info(`Destroyed agent instance: ${id}`);

    return true;
  }

  /**
   * Route a task to the best agent type
   */
  routeTask(task: TaskAssignment): RoutingDecision {
    return routeTask(task);
  }

  /**
   * Route multiple tasks
   */
  routeTasks(tasks: TaskAssignment[]): RoutingDecision[] {
    return routeTasks(tasks);
  }

  /**
   * Assign a task to an agent
   */
  async assignTask(
    agentId: string,
    task: TaskAssignment
  ): Promise<TaskResult> {
    const agent = this.instances.get(agentId);
    if (!agent) {
      return {
        taskId: task.taskId,
        success: false,
        error: `Agent ${agentId} not found`,
      };
    }

    if (agent.status === 'busy') {
      return {
        taskId: task.taskId,
        success: false,
        error: `Agent ${agentId} is busy with task ${agent.currentTask?.taskId}`,
      };
    }

    // Check permissions
    const permissionCheck = validateTaskExecution(agent.type, {
      type: task.taskType,
      resources: task.context?.files,
      requiresShell: task.requiredCapabilities.canExecuteShell,
      requiresCodeModification: task.requiredCapabilities.canModifyCode,
      requiresExternalAccess: task.requiredCapabilities.canAccessExternal,
    });

    if (!permissionCheck.granted) {
      return {
        taskId: task.taskId,
        success: false,
        error: `Permission denied: ${permissionCheck.reason}`,
      };
    }

    // Update agent state
    agent.status = 'busy';
    agent.currentTask = task;
    agent.lastActivityAt = new Date();

    this.logger.info(`Assigned task ${task.taskId} to agent ${agentId}`);

    // In a real implementation, this would execute the task
    // For now, we return a placeholder result
    const result: TaskResult = {
      taskId: task.taskId,
      success: true,
      output: `Task ${task.taskId} assigned to ${agent.type} agent ${agentId}`,
    };

    // Update agent state after completion
    agent.status = 'idle';
    agent.taskHistory.push(task.taskId);
    agent.currentTask = undefined;

    this.taskHistory.set(task.taskId, result);

    return result;
  }

  /**
   * Execute a task by routing and assigning to the best agent
   */
  async executeTask(task: TaskAssignment): Promise<TaskResult> {
    // Route to best agent type
    const routing = this.routeTask(task);

    // Find or create an available agent of that type
    let agent = this.getAvailableAgents(task).find(
      (a) => a.type === routing.agentType
    );

    if (!agent) {
      // Create a new agent instance
      agent = this.createAgent(routing.agentType);
    }

    // Assign the task
    return this.assignTask(agent.id, task);
  }

  /**
   * Get the system prompt for an agent type
   */
  getSystemPrompt(agentType: AgentType): string {
    return getSystemPrompt(agentType);
  }

  /**
   * Get the task prompt for an agent type
   */
  getTaskPrompt(
    agentType: AgentType,
    taskType: string,
    variables: Record<string, string> = {}
  ): string {
    return formatTaskPrompt(agentType, taskType, variables);
  }

  /**
   * Get the response format for an agent type
   */
  getResponseFormat(agentType: AgentType): string {
    return getResponseFormat(agentType);
  }

  /**
   * Get the default tools for an agent type
   */
  getDefaultTools(agentType: AgentType): string[] {
    return getDefaultTools(agentType);
  }

  /**
   * Check if an agent has permission for an operation
   */
  checkPermission(
    agentId: string,
    resource: string,
    level: 'none' | 'read' | 'write' | 'admin'
  ): PermissionCheckResult {
    const agent = this.instances.get(agentId);
    if (!agent) {
      return {
        granted: false,
        reason: `Agent ${agentId} not found`,
      };
    }

    return this.permissionManager.checkWithOverrides(
      agent.type,
      agentId,
      resource,
      level
    );
  }

  /**
   * Get permission guard for an agent
   */
  getPermissionGuard(agentId: string) {
    const agent = this.instances.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return createPermissionGuard(agent.type);
  }

  /**
   * Get permission summary for an agent
   */
  getPermissionSummary(agentId: string) {
    const agent = this.instances.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return getPermissionSummary(agent.type);
  }

  /**
   * Get system statistics
   */
  getStats(): {
    totalAgents: number;
    byType: Record<AgentType, number>;
    byStatus: Record<string, number>;
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
  } {
    const agents = this.getAllAgents();
    const byType: Record<AgentType, number> = {
      coordinator: 0,
      researcher: 0,
      planner: 0,
      executor: 0,
      reviewer: 0,
      tester: 0,
      debugger: 0,
      optimizer: 0,
      documenter: 0,
      validator: 0,
      migrator: 0,
      analyzer: 0,
    };
    const byStatus: Record<string, number> = {
      idle: 0,
      busy: 0,
      paused: 0,
      error: 0,
    };

    for (const agent of agents) {
      byType[agent.type]++;
      byStatus[agent.status]++;
    }

    const tasks = Array.from(this.taskHistory.values());

    return {
      totalAgents: agents.length,
      byType,
      byStatus,
      totalTasks: tasks.length,
      successfulTasks: tasks.filter((t) => t.success).length,
      failedTasks: tasks.filter((t) => !t.success).length,
    };
  }

  /**
   * Get system configuration
   */
  getConfig(): AgentSystemConfig {
    return { ...this.config };
  }

  /**
   * Update system configuration
   */
  updateConfig(config: Partial<AgentSystemConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('System configuration updated');
  }

  /**
   * Pause an agent
   */
  pauseAgent(id: string): boolean {
    const agent = this.instances.get(id);
    if (!agent) return false;

    if (agent.status === 'busy') {
      this.logger.warn(`Pausing busy agent ${id}`);
    }

    agent.status = 'paused';
    agent.lastActivityAt = new Date();
    this.logger.info(`Paused agent ${id}`);

    return true;
  }

  /**
   * Resume a paused agent
   */
  resumeAgent(id: string): boolean {
    const agent = this.instances.get(id);
    if (!agent || agent.status !== 'paused') return false;

    agent.status = 'idle';
    agent.lastActivityAt = new Date();
    this.logger.info(`Resumed agent ${id}`);

    return true;
  }

  /**
   * Mark an agent as having an error
   */
  markAgentError(id: string, error: string): boolean {
    const agent = this.instances.get(id);
    if (!agent) return false;

    agent.status = 'error';
    agent.lastActivityAt = new Date();
    this.logger.error(`Agent ${id} marked with error: ${error}`);

    return true;
  }

  /**
   * Clear all agent instances
   */
  clearAllAgents(): void {
    for (const [id] of this.instances) {
      this.permissionManager.clearOverrides(id);
    }
    this.instances.clear();
    this.logger.info('All agent instances cleared');
  }

  /**
   * Get task history
   */
  getTaskHistory(taskId?: string): TaskResult | TaskResult[] | undefined {
    if (taskId) {
      return this.taskHistory.get(taskId);
    }
    return Array.from(this.taskHistory.values());
  }

  /**
   * List all available agent types with their descriptions
   */
  listAgentTypes(): Array<{
    type: AgentType;
    name: string;
    description: string;
    capabilities: string[];
  }> {
    return getAllAgentTypes().map((type) => {
      const caps = getDefaultCapabilities(type);
      const capabilities: string[] = [];

      if (caps.canModifyCode) capabilities.push('code-modification');
      if (caps.canExecuteShell) capabilities.push('shell-execution');
      if (caps.canAccessExternal) capabilities.push('external-access');
      if (caps.canSpawnAgents) capabilities.push('agent-spawning');

      return {
        type,
        name: getAgentName(type),
        description: getAgentDescription(type),
        capabilities,
      };
    });
  }
}

// Singleton instance for global use
let globalAgentSystem: AgentSystem | null = null;

/**
 * Get or create the global agent system instance
 */
export function getAgentSystem(config?: Partial<AgentSystemConfig>): AgentSystem {
  if (!globalAgentSystem) {
    globalAgentSystem = new AgentSystem(config);
  }
  return globalAgentSystem;
}

/**
 * Reset the global agent system instance
 */
export function resetAgentSystem(): void {
  if (globalAgentSystem) {
    globalAgentSystem.clearAllAgents();
    globalAgentSystem = null;
  }
}

// Export the AgentSystem class as default
export default AgentSystem;
