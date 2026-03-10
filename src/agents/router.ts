/**
 * Task Router for the Specialized Agent System
 * Routes tasks to the most appropriate agent type based on task characteristics
 */

import {
  AgentType,
  TaskAssignment,
  RoutingDecision,
  RoutingRule,
  AgentCapabilities,
  ALL_AGENT_TYPES,
} from './types';
import {
  getSuitableTaskTypes,
  getDefaultCapabilities,
  isSuitableForTaskType,
} from './definitions';

/**
 * Default routing rules
 */
const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  {
    id: 'critical-tasks',
    taskPattern: '.*critical.*|.*urgent.*|.*emergency.*',
    requiredCapabilities: { preferredModel: 'powerful' },
    priorityBoost: 2.0,
    active: true,
  },
  {
    id: 'code-execution',
    taskPattern: '.*implement.*|.*code.*|.*build.*|.*create.*',
    requiredCapabilities: { canModifyCode: true },
    priorityBoost: 1.0,
    active: true,
  },
  {
    id: 'external-access',
    taskPattern: '.*research.*|.*investigate.*|.*explore.*',
    requiredCapabilities: { canAccessExternal: true },
    priorityBoost: 0.5,
    active: true,
  },
  {
    id: 'shell-execution',
    taskPattern: '.*test.*|.*run.*|.*execute.*|.*deploy.*',
    requiredCapabilities: { canExecuteShell: true },
    priorityBoost: 0.5,
    active: true,
  },
  {
    id: 'multi-agent',
    taskPattern: '.*orchestrate.*|.*coordinate.*|.*workflow.*',
    requiredCapabilities: { canSpawnAgents: true },
    priorityBoost: 1.5,
    active: true,
  },
];

/**
 * Scoring weights for routing decisions
 */
const SCORING_WEIGHTS = {
  taskTypeMatch: 0.35,
  capabilityMatch: 0.25,
  complexityMatch: 0.2,
  priorityAlignment: 0.1,
  historicalPerformance: 0.1,
};

/**
 * Complexity to capability mapping
 */
const COMPLEXITY_MODEL_MAPPING: Record<
  string,
  'fast' | 'balanced' | 'powerful'
> = {
  simple: 'fast',
  moderate: 'balanced',
  complex: 'powerful',
  very_complex: 'powerful',
};

/**
 * Model configurations by tier
 */
const MODEL_CONFIGS = {
  fast: {
    model: 'claude-3-haiku',
    temperature: 0.3,
    maxTokens: 2048,
  },
  balanced: {
    model: 'claude-3-sonnet',
    temperature: 0.5,
    maxTokens: 4096,
  },
  powerful: {
    model: 'claude-3-opus',
    temperature: 0.7,
    maxTokens: 8192,
  },
};

/**
 * Calculate task type match score
 */
function calculateTaskTypeMatch(agentType: AgentType, taskType: string): number {
  const suitableTypes = getSuitableTaskTypes(agentType);

  // Exact match
  if (suitableTypes.includes(taskType.toLowerCase())) {
    return 1.0;
  }

  // Partial match
  for (const suitable of suitableTypes) {
    if (
      taskType.toLowerCase().includes(suitable) ||
      suitable.includes(taskType.toLowerCase())
    ) {
      return 0.7;
    }
  }

  // Check with more lenient matching
  const taskKeywords = taskType.toLowerCase().split(/\s+/);
  const matchCount = suitableTypes.filter((st) =>
    taskKeywords.some((kw) => st.includes(kw) || kw.includes(st))
  ).length;

  if (matchCount > 0) {
    return Math.min(0.5, matchCount * 0.15);
  }

  return 0.0;
}

/**
 * Calculate capability match score
 */
function calculateCapabilityMatch(
  agentType: AgentType,
  requiredCapabilities: Partial<AgentCapabilities>
): number {
  const agentCapabilities = getDefaultCapabilities(agentType);
  let matchCount = 0;
  let totalCount = 0;

  for (const [key, required] of Object.entries(requiredCapabilities)) {
    totalCount++;
    const actual = agentCapabilities[key as keyof AgentCapabilities];

    if (typeof required === 'boolean' && typeof actual === 'boolean') {
      if (required === actual) {
        matchCount++;
      }
    } else if (typeof required === 'number' && typeof actual === 'number') {
      if (actual >= required) {
        matchCount++;
      }
    } else if (typeof required === 'string' && typeof actual === 'string') {
      if (actual === required) {
        matchCount++;
      }
    }
  }

  return totalCount > 0 ? matchCount / totalCount : 0.5;
}

/**
 * Calculate complexity match score
 */
function calculateComplexityMatch(
  agentType: AgentType,
  complexity: string
): number {
  const agentCapabilities = getDefaultCapabilities(agentType);
  const requiredModel = COMPLEXITY_MODEL_MAPPING[complexity] || 'balanced';
  const agentModel = agentCapabilities.preferredModel;

  const modelRanking = { fast: 1, balanced: 2, powerful: 3 };
  const requiredRank = modelRanking[requiredModel];
  const agentRank = modelRanking[agentModel];

  if (agentRank >= requiredRank) {
    return 1.0;
  }

  // Partial match if agent can handle with lower tier
  return agentRank / requiredRank;
}

/**
 * Calculate priority alignment score
 */
function calculatePriorityAlignment(
  agentType: AgentType,
  priority: string
): number {
  const agentCapabilities = getDefaultCapabilities(agentType);

  // High priority tasks should go to agents that can handle parallel tasks
  if (priority === 'critical' || priority === 'high') {
    if (agentCapabilities.maxParallelTasks >= 5) {
      return 1.0;
    }
    return 0.5;
  }

  return 0.8; // Neutral for normal priority
}

/**
 * Calculate overall routing score for an agent type
 */
function calculateRoutingScore(
  agentType: AgentType,
  task: TaskAssignment
): number {
  const taskTypeScore = calculateTaskTypeMatch(agentType, task.taskType);
  const capabilityScore = calculateCapabilityMatch(
    agentType,
    task.requiredCapabilities
  );
  const complexityScore = calculateComplexityMatch(agentType, task.complexity);
  const priorityScore = calculatePriorityAlignment(agentType, task.priority);

  // Apply routing rule boosts
  let boost = 0;
  for (const rule of DEFAULT_ROUTING_RULES) {
    if (!rule.active) continue;

    const regex = new RegExp(rule.taskPattern, 'i');
    if (regex.test(task.taskType) || regex.test(task.description)) {
      const ruleMatch = calculateCapabilityMatch(
        agentType,
        rule.requiredCapabilities
      );
      if (ruleMatch >= 0.8) {
        boost += rule.priorityBoost * 0.1;
      }
    }
  }

  return (
    taskTypeScore * SCORING_WEIGHTS.taskTypeMatch +
    capabilityScore * SCORING_WEIGHTS.capabilityMatch +
    complexityScore * SCORING_WEIGHTS.complexityMatch +
    priorityScore * SCORING_WEIGHTS.priorityAlignment +
    boost
  );
}

/**
 * Select the best model configuration for a task
 */
function selectModelConfig(
  agentType: AgentType,
  complexity: string
): { model: string; temperature: number; maxTokens: number } {
  const agentCapabilities = getDefaultCapabilities(agentType);
  const complexityModel = COMPLEXITY_MODEL_MAPPING[complexity] || 'balanced';

  // Use the higher of agent preference and complexity requirement
  const modelRanking = { fast: 1, balanced: 2, powerful: 3 };
  const agentRank = modelRanking[agentCapabilities.preferredModel];
  const complexityRank = modelRanking[complexityModel];

  const selectedTier =
    agentRank >= complexityRank
      ? agentCapabilities.preferredModel
      : complexityModel;

  return { ...MODEL_CONFIGS[selectedTier] };
}

/**
 * Route a task to the most appropriate agent type
 */
export function routeTask(task: TaskAssignment): RoutingDecision {
  const scores: Array<{ agentType: AgentType; score: number }> = [];

  for (const agentType of ALL_AGENT_TYPES) {
    const score = calculateRoutingScore(agentType, task);
    scores.push({ agentType, score });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  const bestMatch = scores[0];
  const alternatives = scores.slice(1, 4); // Top 3 alternatives

  // Generate reasoning
  const reasoning = generateReasoning(bestMatch.agentType, task, scores);

  return {
    agentType: bestMatch.agentType,
    confidence: bestMatch.score,
    reasoning,
    alternatives: alternatives.map((a) => ({
      agentType: a.agentType,
      confidence: a.score,
    })),
    modelConfig: selectModelConfig(bestMatch.agentType, task.complexity),
  };
}

/**
 * Generate human-readable reasoning for routing decision
 */
function generateReasoning(
  selectedAgent: AgentType,
  task: TaskAssignment,
  allScores: Array<{ agentType: AgentType; score: number }>
): string {
  const suitableTypes = getSuitableTaskTypes(selectedAgent);
  const agentCapabilities = getDefaultCapabilities(selectedAgent);

  const parts: string[] = [
    `Selected ${selectedAgent} agent based on:`,
    '',
  ];

  // Task type match
  const taskMatch = suitableTypes.find((t) =>
    task.taskType.toLowerCase().includes(t)
  );
  if (taskMatch) {
    parts.push(`- Task type '${task.taskType}' matches ${selectedAgent}'s specialty`);
  }

  // Capabilities
  const caps: string[] = [];
  if (agentCapabilities.canModifyCode && task.requiredCapabilities.canModifyCode) {
    caps.push('code modification capability');
  }
  if (agentCapabilities.canExecuteShell && task.requiredCapabilities.canExecuteShell) {
    caps.push('shell execution capability');
  }
  if (agentCapabilities.canAccessExternal && task.requiredCapabilities.canAccessExternal) {
    caps.push('external access capability');
  }

  if (caps.length > 0) {
    parts.push(`- Required capabilities: ${caps.join(', ')}`);
  }

  // Complexity
  parts.push(`- Complexity '${task.complexity}' aligns with ${agentCapabilities.preferredModel} model preference`);

  // Priority
  if (task.priority === 'critical' || task.priority === 'high') {
    parts.push(`- ${task.priority} priority requires ${agentCapabilities.maxParallelTasks} parallel task capacity`);
  }

  // Score comparison
  const bestMatch = allScores[0];
  const runnerUp = allScores[1];
  if (runnerUp && bestMatch.score - runnerUp.score < 0.1) {
    parts.push(`- Close runner-up: ${runnerUp.agentType} (score: ${runnerUp.score.toFixed(2)})`);
  }

  return parts.join('\n');
}

/**
 * Get the best matching agent types for a task type
 */
export function getBestAgentsForTaskType(
  taskType: string,
  limit: number = 3
): Array<{ agentType: AgentType; score: number }> {
  const scores: Array<{ agentType: AgentType; score: number }> = [];

  for (const agentType of ALL_AGENT_TYPES) {
    const score = calculateTaskTypeMatch(agentType, taskType);
    scores.push({ agentType, score });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, limit);
}

/**
 * Check if an agent type can handle a task
 */
export function canHandleTask(
  agentType: AgentType,
  task: TaskAssignment
): boolean {
  const capabilities = getDefaultCapabilities(agentType);

  // Check required capabilities
  for (const [key, required] of Object.entries(task.requiredCapabilities)) {
    const actual = capabilities[key as keyof AgentCapabilities];

    if (typeof required === 'boolean' && typeof actual === 'boolean') {
      if (required && !actual) return false;
    } else if (typeof required === 'number' && typeof actual === 'number') {
      if (actual < required) return false;
    }
  }

  return true;
}

/**
 * Get routing rules
 */
export function getRoutingRules(): RoutingRule[] {
  return [...DEFAULT_ROUTING_RULES];
}

/**
 * Add a custom routing rule
 */
export function addRoutingRule(rule: RoutingRule): void {
  DEFAULT_ROUTING_RULES.push(rule);
}

/**
 * Remove a routing rule by ID
 */
export function removeRoutingRule(ruleId: string): boolean {
  const index = DEFAULT_ROUTING_RULES.findIndex((r) => r.id === ruleId);
  if (index >= 0) {
    DEFAULT_ROUTING_RULES.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Enable or disable a routing rule
 */
export function setRoutingRuleActive(ruleId: string, active: boolean): boolean {
  const rule = DEFAULT_ROUTING_RULES.find((r) => r.id === ruleId);
  if (rule) {
    rule.active = active;
    return true;
  }
  return false;
}

/**
 * Batch route multiple tasks
 */
export function routeTasks(tasks: TaskAssignment[]): RoutingDecision[] {
  return tasks.map((task) => routeTask(task));
}

/**
 * Re-route a task with additional constraints
 */
export function rerouteTask(
  task: TaskAssignment,
  excludeAgentTypes: AgentType[]
): RoutingDecision | null {
  const scores: Array<{ agentType: AgentType; score: number }> = [];

  for (const agentType of ALL_AGENT_TYPES) {
    if (excludeAgentTypes.includes(agentType)) continue;

    const score = calculateRoutingScore(agentType, task);
    scores.push({ agentType, score });
  }

  if (scores.length === 0) return null;

  scores.sort((a, b) => b.score - a.score);

  const bestMatch = scores[0];
  const alternatives = scores.slice(1, 4);

  return {
    agentType: bestMatch.agentType,
    confidence: bestMatch.score,
    reasoning: generateReasoning(bestMatch.agentType, task, scores),
    alternatives: alternatives.map((a) => ({
      agentType: a.agentType,
      confidence: a.score,
    })),
    modelConfig: selectModelConfig(bestMatch.agentType, task.complexity),
  };
}

// Export scoring functions for testing
export const _testing = {
  calculateTaskTypeMatch,
  calculateCapabilityMatch,
  calculateComplexityMatch,
  calculatePriorityAlignment,
  calculateRoutingScore,
  selectModelConfig,
};
