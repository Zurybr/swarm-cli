/**
 * Public API for the skill registry module
 *
 * Exports all public types and classes for skill management.
 */

// Main registry class
export { SkillRegistry } from './registry/skill-registry';

// Types
export { SkillMetadata, SkillSchema, Skill, SkillDefinition } from './types/skill';

// Schema validation
export {
  SkillMetadataSchema,
  SkillSchemaSchema,
  validateSkillMetadata,
  safeValidateSkillMetadata,
} from './schema/skill-metadata';

// Registry components
export { SkillSearchIndex, SkillSearchResult } from './registry/search-index';
export { SkillVersionManager } from './registry/version-manager';
export { SkillStore } from './registry/skill-store';
