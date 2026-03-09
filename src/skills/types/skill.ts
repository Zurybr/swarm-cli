/**
 * Skill type definitions
 *
 * Provides TypeScript interfaces for skill metadata, schema, and skill objects.
 */

/**
 * JSON Schema type for skill input/output definitions
 */
export interface SkillSchema {
  /** JSON Schema for input validation */
  input: Record<string, unknown>;
  /** JSON Schema for output validation */
  output: Record<string, unknown>;
}

/**
 * Skill metadata interface
 * Contains descriptive and categorization information about a skill
 */
export interface SkillMetadata {
  /** Unique skill name (lowercase alphanumeric with hyphens) */
  name: string;

  /** Human-readable description (10-500 characters) */
  description: string;

  /** Semantic version (e.g., "1.0.0") */
  version: string;

  /** Category for grouping skills */
  category?: 'security' | 'performance' | 'documentation' | 'testing' | 'general';

  /** Tags for filtering and discovery */
  tags?: string[];

  /** Input/output JSON schemas */
  schema?: SkillSchema;

  /** Author or creator of the skill */
  author?: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Skill definition placeholder
 * Will be expanded to include the actual skill implementation
 */
export interface SkillDefinition {
  /** Placeholder for skill implementation details */
  [key: string]: unknown;
}

/**
 * Complete skill interface
 * Combines metadata with the skill definition/implementation
 */
export interface Skill {
  /** Metadata describing the skill */
  metadata: SkillMetadata;

  /** Skill implementation definition */
  definition: SkillDefinition;
}
