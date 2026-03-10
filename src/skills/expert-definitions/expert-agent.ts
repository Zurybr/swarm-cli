/**
 * Expert Agent Types
 *
 * ExpertAgent extends AgencyAgent with skills[], capabilities[], expertiseLevel, and outputFormats.
 * Provides type definitions and type guards for expert agents.
 */

import { AgencyAgent } from '../../agents/definitions/agency-agents';
import { BaseExpertSkill, ExpertTaskInput, ExpertOutput } from './types';

/**
 * Expertise level for an expert agent
 */
export type ExpertiseLevel = 'junior' | 'mid' | 'senior';

/**
 * Output format supported by experts
 */
export type OutputFormat = 'json' | 'markdown';

/**
 * ExpertAgent extends AgencyAgent with expert-specific fields
 *
 * Experts complement agency agents by providing specialized skills
 * that can be invoked programmatically via ExpertAPI.
 */
export interface ExpertAgent extends AgencyAgent {
  /** Skill names from registry that this expert uses */
  skills: string[];

  /** High-level capability descriptions */
  capabilities: string[];

  /** Expertise level of the agent */
  expertiseLevel: ExpertiseLevel;

  /** Supported output formats */
  outputFormats: OutputFormat[];
}

/**
 * ExpertDefinition combines ExpertAgent with a skill factory function
 *
 * This allows experts to create their skill instances on demand,
 * enabling lazy initialization and dependency injection.
 */
export type ExpertDefinition = ExpertAgent & {
  /** Factory function to create the expert's skill instance */
  createSkill(): BaseExpertSkill<ExpertTaskInput, ExpertOutput>;
};

/**
 * Type guard to check if an object is an ExpertAgent
 *
 * Verifies that the object has all required ExpertAgent fields
 * in addition to AgencyAgent fields.
 */
export function isExpertAgent(obj: unknown): obj is ExpertAgent {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const agent = obj as Record<string, unknown>;

  // Check required AgencyAgent fields
  const hasAgencyFields =
    typeof agent.id === 'string' &&
    typeof agent.name === 'string' &&
    typeof agent.division === 'string' &&
    typeof agent.role === 'string' &&
    typeof agent.description === 'string' &&
    typeof agent.personality === 'string' &&
    Array.isArray(agent.tools) &&
    Array.isArray(agent.deliverables) &&
    Array.isArray(agent.workflow) &&
    Array.isArray(agent.successMetrics);

  if (!hasAgencyFields) {
    return false;
  }

  // Check required ExpertAgent fields
  const hasExpertFields =
    Array.isArray(agent.skills) &&
    Array.isArray(agent.capabilities) &&
    typeof agent.expertiseLevel === 'string' &&
    ['junior', 'mid', 'senior'].includes(agent.expertiseLevel) &&
    Array.isArray(agent.outputFormats);

  return hasExpertFields;
}

/**
 * Type guard to check if an expert has a specific capability
 *
 * @param expert - The expert agent to check
 * @param capability - The capability to look for
 * @returns true if the expert has the capability
 */
export function hasCapability(
  expert: ExpertAgent,
  capability: string
): boolean {
  return expert.capabilities.includes(capability);
}

/**
 * Get all experts that have a specific capability
 *
 * @param experts - Array of expert agents to filter
 * @param capability - The capability to filter by
 * @returns Array of experts with the capability
 */
export function getExpertsByCapability(
  experts: ExpertAgent[],
  capability: string
): ExpertAgent[] {
  return experts.filter((expert) => hasCapability(expert, capability));
}

/**
 * Get experts by expertise level
 *
 * @param experts - Array of expert agents to filter
 * @param level - The expertise level to filter by
 * @returns Array of experts with the specified level
 */
export function getExpertsByLevel(
  experts: ExpertAgent[],
  level: ExpertiseLevel
): ExpertAgent[] {
  return experts.filter((expert) => expert.expertiseLevel === level);
}
