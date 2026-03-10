/**
 * Agent Type Definitions
 * Defines the 12 specialized agent types with their capabilities and characteristics
 */

import {
  AgentType,
  AgentConfig,
  AgentCapabilities,
  Permission,
} from './types';

/** Default capabilities for each agent type */
const DEFAULT_CAPABILITIES: Record<AgentType, AgentCapabilities> = {
  coordinator: {
    canSpawnAgents: true,
    canModifyCode: false,
    canAccessExternal: true,
    canExecuteShell: false,
    maxParallelTasks: 10,
    preferredModel: 'powerful',
    taskTimeoutMinutes: 60,
  },
  researcher: {
    canSpawnAgents: false,
    canModifyCode: false,
    canAccessExternal: true,
    canExecuteShell: false,
    maxParallelTasks: 5,
    preferredModel: 'balanced',
    taskTimeoutMinutes: 30,
  },
  planner: {
    canSpawnAgents: false,
    canModifyCode: false,
    canAccessExternal: true,
    canExecuteShell: false,
    maxParallelTasks: 3,
    preferredModel: 'powerful',
    taskTimeoutMinutes: 45,
  },
  executor: {
    canSpawnAgents: false,
    canModifyCode: true,
    canAccessExternal: true,
    canExecuteShell: true,
    maxParallelTasks: 5,
    preferredModel: 'balanced',
    taskTimeoutMinutes: 60,
  },
  reviewer: {
    canSpawnAgents: false,
    canModifyCode: false,
    canAccessExternal: false,
    canExecuteShell: false,
    maxParallelTasks: 5,
    preferredModel: 'balanced',
    taskTimeoutMinutes: 30,
  },
  tester: {
    canSpawnAgents: false,
    canModifyCode: true,
    canAccessExternal: false,
    canExecuteShell: true,
    maxParallelTasks: 5,
    preferredModel: 'balanced',
    taskTimeoutMinutes: 45,
  },
  debugger: {
    canSpawnAgents: false,
    canModifyCode: true,
    canAccessExternal: true,
    canExecuteShell: true,
    maxParallelTasks: 3,
    preferredModel: 'powerful',
    taskTimeoutMinutes: 60,
  },
  optimizer: {
    canSpawnAgents: false,
    canModifyCode: true,
    canAccessExternal: false,
    canExecuteShell: true,
    maxParallelTasks: 3,
    preferredModel: 'powerful',
    taskTimeoutMinutes: 60,
  },
  documenter: {
    canSpawnAgents: false,
    canModifyCode: true,
    canAccessExternal: false,
    canExecuteShell: false,
    maxParallelTasks: 5,
    preferredModel: 'fast',
    taskTimeoutMinutes: 30,
  },
  validator: {
    canSpawnAgents: false,
    canModifyCode: false,
    canAccessExternal: true,
    canExecuteShell: true,
    maxParallelTasks: 5,
    preferredModel: 'balanced',
    taskTimeoutMinutes: 30,
  },
  migrator: {
    canSpawnAgents: false,
    canModifyCode: true,
    canAccessExternal: true,
    canExecuteShell: true,
    maxParallelTasks: 3,
    preferredModel: 'powerful',
    taskTimeoutMinutes: 120,
  },
  analyzer: {
    canSpawnAgents: false,
    canModifyCode: false,
    canAccessExternal: true,
    canExecuteShell: false,
    maxParallelTasks: 5,
    preferredModel: 'balanced',
    taskTimeoutMinutes: 45,
  },
};

/** Default permissions for each agent type */
const DEFAULT_PERMISSIONS: Record<AgentType, Permission[]> = {
  coordinator: [
    { resource: 'agents', level: 'admin' },
    { resource: 'tasks', level: 'admin' },
    { resource: 'system', level: 'read' },
    { resource: 'logs', level: 'read' },
  ],
  researcher: [
    { resource: 'code', level: 'read' },
    { resource: 'external', level: 'read' },
    { resource: 'docs', level: 'read' },
  ],
  planner: [
    { resource: 'code', level: 'read' },
    { resource: 'docs', level: 'read' },
    { resource: 'tasks', level: 'write' },
  ],
  executor: [
    { resource: 'code', level: 'write' },
    { resource: 'tests', level: 'write' },
    { resource: 'shell', level: 'write', conditions: ['sandboxed'] },
    { resource: 'git', level: 'write' },
  ],
  reviewer: [
    { resource: 'code', level: 'read' },
    { resource: 'tests', level: 'read' },
    { resource: 'reviews', level: 'write' },
  ],
  tester: [
    { resource: 'code', level: 'read' },
    { resource: 'tests', level: 'write' },
    { resource: 'shell', level: 'write', conditions: ['test-only'] },
  ],
  debugger: [
    { resource: 'code', level: 'write' },
    { resource: 'tests', level: 'write' },
    { resource: 'logs', level: 'read' },
    { resource: 'shell', level: 'write', conditions: ['debug-only'] },
  ],
  optimizer: [
    { resource: 'code', level: 'write' },
    { resource: 'metrics', level: 'read' },
    { resource: 'shell', level: 'write', conditions: ['benchmark-only'] },
  ],
  documenter: [
    { resource: 'code', level: 'read' },
    { resource: 'docs', level: 'write' },
    { resource: 'comments', level: 'write' },
  ],
  validator: [
    { resource: 'code', level: 'read' },
    { resource: 'tests', level: 'read' },
    { resource: 'requirements', level: 'read' },
    { resource: 'shell', level: 'write', conditions: ['validate-only'] },
  ],
  migrator: [
    { resource: 'code', level: 'write' },
    { resource: 'database', level: 'write', conditions: ['migration-only'] },
    { resource: 'git', level: 'write' },
    { resource: 'shell', level: 'write', conditions: ['migration-only'] },
  ],
  analyzer: [
    { resource: 'code', level: 'read' },
    { resource: 'metrics', level: 'read' },
    { resource: 'logs', level: 'read' },
    { resource: 'reports', level: 'write' },
  ],
};

/** Human-readable descriptions for each agent type */
const AGENT_DESCRIPTIONS: Record<AgentType, string> = {
  coordinator:
    'Orchestrates multi-agent swarms, delegates tasks, monitors progress, and ensures successful completion of complex workflows.',
  researcher:
    'Gathers information from codebases, documentation, and external sources to provide context and insights for decision-making.',
  planner:
    'Creates detailed implementation plans, breaks down complex tasks, and defines clear execution paths with milestones.',
  executor:
    'Implements code changes, writes features, and executes tasks according to specifications and plans.',
  reviewer:
    'Reviews code for quality, security, and adherence to standards. Provides constructive feedback and approval decisions.',
  tester:
    'Creates and runs tests, validates functionality, and ensures code quality through comprehensive test coverage.',
  debugger:
    'Identifies and fixes bugs, analyzes error patterns, and implements robust solutions to prevent recurrence.',
  optimizer:
    'Improves performance, reduces resource usage, and refactors code for better efficiency and maintainability.',
  documenter:
    'Writes clear documentation, code comments, and user guides to ensure knowledge is captured and shared.',
  validator:
    'Verifies requirements are met, validates implementations against specifications, and ensures compliance.',
  migrator:
    'Handles code migrations, database schema changes, and version upgrades with minimal disruption.',
  analyzer:
    'Analyzes codebases, system architectures, and performance metrics to identify patterns and improvement opportunities.',
};

/** Display names for each agent type */
const AGENT_NAMES: Record<AgentType, string> = {
  coordinator: 'Coordinator',
  researcher: 'Researcher',
  planner: 'Planner',
  executor: 'Executor',
  reviewer: 'Reviewer',
  tester: 'Tester',
  debugger: 'Debugger',
  optimizer: 'Optimizer',
  documenter: 'Documenter',
  validator: 'Validator',
  migrator: 'Migrator',
  analyzer: 'Analyzer',
};

/** Task types each agent type is best suited for */
const SUITABLE_TASK_TYPES: Record<AgentType, string[]> = {
  coordinator: [
    'orchestrate',
    'delegate',
    'monitor',
    'sync',
    'workflow',
    'multi-agent',
  ],
  researcher: [
    'research',
    'investigate',
    'explore',
    'gather',
    'find',
    'analyze-context',
  ],
  planner: [
    'plan',
    'design',
    'architect',
    'breakdown',
    'schedule',
    'roadmap',
  ],
  executor: [
    'implement',
    'code',
    'build',
    'create',
    'develop',
    'write',
    'feature',
  ],
  reviewer: [
    'review',
    'audit',
    'inspect',
    'assess',
    'evaluate',
    'approve',
  ],
  tester: [
    'test',
    'validate-functionality',
    'coverage',
    'e2e-test',
    'unit-test',
    'integration-test',
  ],
  debugger: [
    'debug',
    'fix',
    'troubleshoot',
    'diagnose',
    'resolve',
    'error',
    'bug',
  ],
  optimizer: [
    'optimize',
    'performance',
    'refactor',
    'improve',
    'tune',
    'benchmark',
    'efficiency',
  ],
  documenter: [
    'document',
    'write-docs',
    'comment',
    'guide',
    'readme',
    'api-docs',
  ],
  validator: [
    'validate',
    'verify',
    'check',
    'compliance',
    'requirements',
    'acceptance',
  ],
  migrator: [
    'migrate',
    'upgrade',
    'transform',
    'convert',
    'schema-change',
    'version-bump',
  ],
  analyzer: [
    'analyze',
    'study',
    'examine',
    'metrics',
    'report',
    'assessment',
    'audit-code',
  ],
};

/**
 * Create a default agent configuration for a given type
 */
export function createAgentConfig(
  type: AgentType,
  overrides?: Partial<AgentConfig>
): AgentConfig {
  return {
    id: overrides?.id || `${type}-${Date.now()}`,
    type,
    name: overrides?.name || AGENT_NAMES[type],
    description: overrides?.description || AGENT_DESCRIPTIONS[type],
    capabilities: {
      ...DEFAULT_CAPABILITIES[type],
      ...overrides?.capabilities,
    },
    permissions: overrides?.permissions || DEFAULT_PERMISSIONS[type],
    metaPrompt: overrides?.metaPrompt!,
    customConfig: overrides?.customConfig,
  };
}

/**
 * Get the default capabilities for an agent type
 */
export function getDefaultCapabilities(type: AgentType): AgentCapabilities {
  return { ...DEFAULT_CAPABILITIES[type] };
}

/**
 * Get the default permissions for an agent type
 */
export function getDefaultPermissions(type: AgentType): Permission[] {
  return [...DEFAULT_PERMISSIONS[type]];
}

/**
 * Get the description for an agent type
 */
export function getAgentDescription(type: AgentType): string {
  return AGENT_DESCRIPTIONS[type];
}

/**
 * Get the display name for an agent type
 */
export function getAgentName(type: AgentType): string {
  return AGENT_NAMES[type];
}

/**
 * Get suitable task types for an agent type
 */
export function getSuitableTaskTypes(type: AgentType): string[] {
  return [...SUITABLE_TASK_TYPES[type]];
}

/**
 * Check if an agent type is suitable for a task type
 */
export function isSuitableForTaskType(
  agentType: AgentType,
  taskType: string
): boolean {
  return SUITABLE_TASK_TYPES[agentType].some(
    (suitable) =>
      suitable === taskType ||
      taskType.toLowerCase().includes(suitable) ||
      suitable.includes(taskType.toLowerCase())
  );
}

/**
 * Get all agent type definitions
 */
export function getAllAgentTypes(): AgentType[] {
  return [
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
}

/**
 * Get agent types that can handle a specific task type
 */
export function getAgentTypesForTaskType(taskType: string): AgentType[] {
  return getAllAgentTypes().filter((type) => isSuitableForTaskType(type, taskType));
}

/**
 * Compare capabilities between two agent types
 */
export function compareCapabilities(
  type1: AgentType,
  type2: AgentType
): Record<keyof AgentCapabilities, { type1: boolean | number | string; type2: boolean | number | string }> {
  const caps1 = DEFAULT_CAPABILITIES[type1];
  const caps2 = DEFAULT_CAPABILITIES[type2];

  return {
    canSpawnAgents: { type1: caps1.canSpawnAgents, type2: caps2.canSpawnAgents },
    canModifyCode: { type1: caps1.canModifyCode, type2: caps2.canModifyCode },
    canAccessExternal: { type1: caps1.canAccessExternal, type2: caps2.canAccessExternal },
    canExecuteShell: { type1: caps1.canExecuteShell, type2: caps2.canExecuteShell },
    maxParallelTasks: { type1: caps1.maxParallelTasks, type2: caps2.maxParallelTasks },
    preferredModel: { type1: caps1.preferredModel, type2: caps2.preferredModel },
    taskTimeoutMinutes: { type1: caps1.taskTimeoutMinutes, type2: caps2.taskTimeoutMinutes },
  };
}

export {
  DEFAULT_CAPABILITIES,
  DEFAULT_PERMISSIONS,
  AGENT_DESCRIPTIONS,
  AGENT_NAMES,
  SUITABLE_TASK_TYPES,
};
