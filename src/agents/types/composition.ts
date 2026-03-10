/**
 * Agent composition type definitions
 *
 * Provides TypeScript interfaces for composing skills into agents.
 * Used by AgentBuilder to define agent configurations and validation results.
 */

/**
 * Configuration for a single skill in an agent composition
 */
export interface SkillConfig {
  /** Skill name (must exist in registry) */
  skillName: string;

  /** Optional specific version (defaults to latest) */
  version?: string;

  /** Skill-specific configuration object */
  config?: Record<string, unknown>;
}

/**
 * Complete agent composition configuration
 * Defines an agent as a chain of skills with metadata
 */
export interface CompositionConfig {
  /** Unique agent name */
  name: string;

  /** Human-readable description */
  description: string;

  /** Ordered array of skills to execute */
  skills: SkillConfig[];

  /** Optional skill that produces final output (defaults to last skill) */
  outputSkill?: string;

  /** Global configuration merged into all skill configs */
  globalConfig?: Record<string, unknown>;
}

/**
 * Result of validating a composition configuration
 */
export interface CompositionValidationResult {
  /** Whether the composition is valid */
  valid: boolean;

  /** Array of error messages (empty if valid) */
  errors: string[];

  /** Array of warning messages (non-blocking issues) */
  warnings: string[];
}
