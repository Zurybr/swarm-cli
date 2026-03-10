/**
 * Core types for the Specialized Agent System
 * Defines 12 specialized agent types with their configurations and capabilities
 */

/** The 12 specialized agent types */
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
  | 'analyzer';

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
];

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

/** Task assignment for routing */
export interface TaskAssignment {
  /** Task identifier */
  taskId: string;
  /** Task description */
  description: string;
  /** Task type for routing */
  taskType: string;
  /** Required capabilities */
  requiredCapabilities: Partial<AgentCapabilities>;
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Estimated complexity */
  complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
  /** Context information */
  context?: {
    codebase?: string;
    files?: string[];
    dependencies?: string[];
    constraints?: string[];
  };
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

/** Agent instance state */
export interface AgentInstance {
  /** Instance ID */
  id: string;
  /** Agent type */
  type: AgentType;
  /** Current status */
  status: 'idle' | 'busy' | 'paused' | 'error';
  /** Currently assigned task */
  currentTask?: TaskAssignment;
  /** Task history */
  taskHistory: string[];
  /** Created timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
}

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

/** Agent system configuration */
export interface AgentSystemConfig {
  /** Default agent configurations by type */
  defaultConfigs: Record<AgentType, AgentConfig>;
  /** Global permissions */
  globalPermissions: Permission[];
  /** Routing rules */
  routingRules: RoutingRule[];
  /** Model configurations by tier */
  modelConfigs: Record<
    'fast' | 'balanced' | 'powerful',
    {
      model: string;
      temperature: number;
      maxTokens: number;
    }
  >;
}

/** Routing rule for task assignment */
export interface RoutingRule {
  /** Rule ID */
  id: string;
  /** Task type pattern (regex) */
  taskPattern: string;
  /** Required agent type (optional, for forced routing) */
  forceAgentType?: AgentType;
  /** Capability requirements */
  requiredCapabilities: Partial<AgentCapabilities>;
  /** Priority boost */
  priorityBoost: number;
  /** Whether this rule is active */
  active: boolean;
}

/** Task execution result */
export interface TaskResult {
  /** Task ID */
  taskId: string;
  /** Success status */
  success: boolean;
  /** Result data */
  output?: string;
  /** Error message if failed */
  error?: string;
  /** Generated artifacts */
  artifacts?: string[];
  /** Execution metrics */
  metrics?: {
    startTime: Date;
    endTime: Date;
    tokenUsage: number;
    toolCalls: number;
  };
}
