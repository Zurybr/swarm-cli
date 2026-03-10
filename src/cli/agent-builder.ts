/**
 * Agent Builder Factory
 *
 * Provides lazy initialization of the AgentBuilder for CLI commands.
 */

import { AgentBuilder } from '../agents';
import { SkillRegistry } from '../skills';

/**
 * Get or create an AgentBuilder instance
 * @param registry - SkillRegistry instance
 * @returns AgentBuilder instance
 */
export async function getAgentBuilder(registry: SkillRegistry): Promise<AgentBuilder> {
  return new AgentBuilder(registry);
}
