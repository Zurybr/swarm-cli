/**
 * Core types for the Agent Orchestration System
 * Defines types for Agent, Swarm, Task, Message, and CoordinationStrategy
 */

/** The 13 specialized agent types */
export type AgentType =
  | 'coordinator'
  | 'researcher'
  | 'planner'
  | 'executor'
  | 'reviewer'
  | 'tester'
  | 'debugger'
  | 'optimizer'
  | 'documenter'
  | 'validator'
  | 'migrator'
  | 'analyzer'
  | 'architect';

/** All agent types as an array for iteration */
export const ALL_AGENT_TYPES: AgentType[] = [
  'coordinator',
  'researcher',
  'planner',
  'executor',
  'reviewer',
  'tester',
  'debugger',
  'optimizer',
  'documenter',
  'validator',
  'migrator',
  'analyzer',
  'architect',
];

/** Agent status in the swarm */
export type AgentStatus = 'idle' | 'busy' | 'paused' | 'error' | 'offline';

/** Task status in the lifecycle */
export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'blocked';

/** Swarm status */
export type SwarmStatus =
  | 'initializing'
  | 'active'
  | 'paused'
  | 'shutting_down'
  | 'terminated'
  | 'error';

/** Coordination strategy types */
export type CoordinationStrategyType = 'parallel' | 'sequential' | 'adaptive' | 'hierarchical';

/** Permission levels for agent operations */
export type PermissionLevel = 'none' | 'read' | 'write' | 'admin';

/** Individual permission definition */
export interface Permission {
  resource: string;
  level: PermissionLevel;
  conditions?: string[];
}

/** Agent capabilities and characteristics */
export interface AgentCapabilities {
  /** Can this agent spawn other agents */
  canSpawnAgents: boolean;
  /** Can this agent modify code */
  canModifyCode: boolean;
  /** Can this agent access external APIs */
  canAccessExternal: boolean;
  /** Can this agent execute shell commands */
  canExecuteShell: boolean;
  /** Maximum number of parallel tasks */
  maxParallelTasks: number;
  /** Preferred model tier */
  preferredModel: 'fast' | 'balanced' | 'powerful';
  /** Timeout for tasks in minutes */
  taskTimeoutMinutes: number;
}

/** Meta-prompt template for an agent type */
export interface MetaPrompt {
  /** Agent type this meta-prompt is for */
  agentType: AgentType;
  /** System prompt template */
  systemPrompt: string;
  /** Task-specific prompt templates by task type */
  taskPrompts: Record<string, string>;
  /** Default tools for this agent type */
  defaultTools: string[];
  /** Response format template */
  responseFormat: string;
  /** Example interactions */
  examples: Array<{
    input: string;
    output: string;
    context?: string;
  }>;
}

/** Configuration for a specialized agent */
export interface AgentConfig {
  /** Unique identifier */
  id: string;
  /** Agent type */
  type: AgentType;
  /** Display name */
  name: string;
  /** Description of responsibilities */
  description: string;
  /** Capabilities */
  capabilities: AgentCapabilities;
  /** Permissions */
  permissions: Permission[];
  /** Meta-prompt reference */
  metaPrompt: MetaPrompt;
  /** Custom configuration */
  customConfig?: Record<string, unknown>;
}

/** Agent instance in the swarm */
export interface Agent {
  /** Unique instance ID */
  id: string;
  /** Agent type */
  type: AgentType;
  /** Display name */
  name: string;
  /** Current status */
  status: AgentStatus;
  /** Agent configuration */
  config: AgentConfig;
  /** Currently assigned tasks */
  assignedTasks: string[];
  /** Maximum concurrent tasks */
  maxConcurrentTasks: number;
  /** Current workload (0-1) */
  workload: number;
  /** Agent health metrics */
  health: {
    lastHeartbeat: Date;
    successRate: number;
    averageResponseTime: number;
    errorCount: number;
  };
  /** Created timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
}

/** Task definition */
export interface Task {
  /** Unique task ID */
  id: string;
  /** Task title */
  title: string;
  /** Task description */
  description: string;
  /** Task type for routing */
  taskType: string;
  /** Current status */
  status: TaskStatus;
  /** Assigned agent ID */
  assignedTo?: string;
  /** Task priority */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Task complexity */
  complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
  /** Required agent capabilities */
  requiredCapabilities?: Partial<AgentCapabilities>;
  /** Required agent type (optional) */
  requiredAgentType?: AgentType;
  /** Task dependencies (task IDs that must complete first) */
  dependencies: string[];
  /** Tasks that depend on this one */
  dependents: string[];
  /** Task context */
  context?: {
    codebase?: string;
    files?: string[];
    dependencies?: string[];
    constraints?: string[];
    [key: string]: unknown;
  };
  /** Task result */
  result?: TaskResult;
  /** Creation timestamp */
  createdAt: Date;
  /** Start timestamp */
  startedAt?: Date;
  /** Completion timestamp */
  completedAt?: Date;
  /** Estimated duration in minutes */
  estimatedDuration?: number;
  /** Actual duration in minutes */
  actualDuration?: number;
}

/** Task result */
export interface TaskResult {
  /** Success status */
  success: boolean;
  /** Result output */
  output?: string;
  /** Error message if failed */
  error?: string;
  /** Generated artifacts */
  artifacts?: string[];
  /** Execution metrics */
  metrics?: {
    startTime: Date;
    endTime: Date;
    tokenUsage?: number;
    toolCalls?: number;
  };
}

/** Message for agent-to-agent communication */
export interface Message {
  /** Unique message ID */
  id: string;
  /** Message type */
  type: MessageType;
  /** Sender agent ID */
  from: string;
  /** Recipient agent ID (or 'broadcast' for all) */
  to: string;
  /** Message subject/title */
  subject: string;
  /** Message content */
  content: string;
  /** Message priority */
  priority: 'low' | 'normal' | 'high' | 'urgent';
  /** Related task ID */
  taskId?: string;
  /** Thread ID for conversation grouping */
  threadId?: string;
  /** Reply to message ID */
  inReplyTo?: string;
  /** Message metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp */
  timestamp: Date;
  /** Read status */
  read: boolean;
}

/** Message types */
export type MessageType =
  | 'task_assignment'
  | 'task_update'
  | 'task_completion'
  | 'request_help'
  | 'provide_help'
  | 'status_update'
  | 'coordination'
  | 'notification'
  | 'broadcast'
  | 'direct';

/** Swarm configuration */
export interface SwarmConfig {
  /** Unique swarm ID */
  id: string;
  /** Swarm name */
  name: string;
  /** Swarm description */
  description?: string;
  /** Coordination strategy */
  strategy: CoordinationStrategyType;
  /** Maximum number of agents */
  maxAgents: number;
  /** Default agent configurations by type */
  defaultAgentConfigs: Partial<Record<AgentType, Partial<AgentConfig>>>;
  /** Swarm-wide permissions */
  globalPermissions: Permission[];
  /** Auto-scaling enabled */
  autoScale: boolean;
  /** Load balancing enabled */
  loadBalance: boolean;
  /** Task retry policy */
  retryPolicy: {
    maxRetries: number;
    retryDelay: number;
    exponentialBackoff: boolean;
  };
}

/** Swarm instance */
export interface Swarm {
  /** Swarm configuration */
  config: SwarmConfig;
  /** Current status */
  status: SwarmStatus;
  /** Agents in the swarm */
  agents: Map<string, Agent>;
  /** Tasks in the swarm */
  tasks: Map<string, Task>;
  /** Message history */
  messages: Message[];
  /** Swarm metrics */
  metrics: SwarmMetrics;
  /** Created timestamp */
  createdAt: Date;
  /** Started timestamp */
  startedAt?: Date;
  /** Terminated timestamp */
  terminatedAt?: Date;
}

/** Swarm metrics */
export interface SwarmMetrics {
  /** Total tasks created */
  totalTasks: number;
  /** Tasks completed successfully */
  completedTasks: number;
  /** Tasks failed */
  failedTasks: number;
  /** Tasks cancelled */
  cancelledTasks: number;
  /** Average task completion time in minutes */
  averageCompletionTime: number;
  /** Agent utilization rate (0-1) */
  agentUtilization: number;
  /** Message count */
  messageCount: number;
  /** Error count */
  errorCount: number;
  /** Last updated */
  lastUpdated: Date;
}

/** Coordination strategy interface */
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

/** Task assignment result */
export interface TaskAssignment {
  /** Task ID */
  taskId: string;
  /** Assigned agent ID */
  agentId: string;
  /** Assignment confidence (0-1) */
  confidence: number;
  /** Assignment reason */
  reason: string;
  /** Expected start time */
  expectedStartTime?: Date;
  /** Expected completion time */
  expectedCompletionTime?: Date;
}

/** Routing decision result */
export interface RoutingDecision {
  /** Selected agent type */
  agentType: AgentType;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reasoning for the decision */
  reasoning: string;
  /** Alternative options */
  alternatives: Array<{
    agentType: AgentType;
    confidence: number;
  }>;
  /** Suggested model configuration */
  modelConfig: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
}

/** Orchestrator configuration */
export interface OrchestratorConfig {
  /** Default coordination strategy */
  defaultStrategy: CoordinationStrategyType;
  /** Maximum concurrent swarms */
  maxConcurrentSwarms: number;
  /** Task queue size */
  taskQueueSize: number;
  /** Enable persistence */
  enablePersistence: boolean;
  /** Persistence path */
  persistencePath?: string;
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/** Orchestrator event types */
export type OrchestratorEventType =
  | 'swarm_created'
  | 'swarm_terminated'
  | 'agent_registered'
  | 'agent_unregistered'
  | 'agent_status_changed'
  | 'task_created'
  | 'task_assigned'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'message_sent'
  | 'message_received'
  | 'error';

/** Orchestrator event */
export interface OrchestratorEvent {
  /** Event type */
  type: OrchestratorEventType;
  /** Event timestamp */
  timestamp: Date;
  /** Event data */
  data: Record<string, unknown>;
  /** Source (swarm ID, agent ID, etc.) */
  source?: string;
}

/** Event handler */
export type EventHandler = (event: OrchestratorEvent) => void | Promise<void>;

/** Permission check result */
export interface PermissionCheckResult {
  /** Whether permission is granted */
  granted: boolean;
  /** Denial reason if not granted */
  reason?: string;
  /** Required permission level */
  requiredLevel?: PermissionLevel;
  /** Actual permission level */
  actualLevel?: PermissionLevel;
}

/** Agent registration request */
export interface AgentRegistrationRequest {
  /** Agent type */
  type: AgentType;
  /** Agent name */
  name?: string;
  /** Custom configuration */
  customConfig?: Record<string, unknown>;
}

/** Task creation request */
export interface TaskCreationRequest {
  /** Task title */
  title: string;
  /** Task description */
  description: string;
  /** Task type */
  taskType: string;
  /** Priority */
  priority?: Task['priority'];
  /** Complexity */
  complexity?: Task['complexity'];
  /** Required agent type */
  requiredAgentType?: AgentType;
  /** Required capabilities */
  requiredCapabilities?: Partial<AgentCapabilities>;
  /** Dependencies */
  dependencies?: string[];
  /** Context */
  context?: Task['context'];
  /** Estimated duration */
  estimatedDuration?: number;
}

/** Message send request */
export interface MessageSendRequest {
  /** Message type */
  type: MessageType;
  /** Sender agent ID */
  from: string;
  /** Recipient agent ID */
  to: string;
  /** Subject */
  subject: string;
  /** Content */
  content: string;
  /** Priority */
  priority?: Message['priority'];
  /** Related task ID */
  taskId?: string;
  /** Thread ID */
  threadId?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}
