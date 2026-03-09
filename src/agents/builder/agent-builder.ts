/**
 * Agent Builder
 *
 * Fluent API for composing skills into agents with validation.
 * Provides a chainable interface for building agent configurations.
 */

import { SkillRegistry } from '../../skills/registry/skill-registry';
import { SkillMetadata } from '../../skills/types/skill';
import {
  SkillConfig,
  CompositionConfig,
  CompositionValidationResult,
} from '../types/composition';
import { SchemaValidator, ValidationResult } from './schema-validator';

/**
 * AgentBuilder provides a fluent API for composing skills into agents
 */
export class AgentBuilder {
  private registry: SkillRegistry;
  private schemaValidator: SchemaValidator;
  private name?: string;
  private description?: string;
  private skills: SkillConfig[];
  private outputSkill?: string;
  private globalConfig?: Record<string, unknown>;

  /**
   * Create a new AgentBuilder instance
   * @param registry - SkillRegistry for looking up skills
   */
  constructor(registry: SkillRegistry) {
    this.registry = registry;
    this.schemaValidator = new SchemaValidator();
    this.skills = [];
  }

  /**
   * Set the agent name
   * @param name - Unique agent name
   * @returns this for chaining
   */
  withName(name: string): this {
    this.name = name;
    return this;
  }

  /**
   * Set the agent description
   * @param description - Human-readable description
   * @returns this for chaining
   */
  withDescription(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Add a skill to the composition chain
   * @param skillName - Name of the skill to add
   * @param config - Optional skill-specific configuration
   * @returns this for chaining
   */
  use(skillName: string, config?: Record<string, unknown>): this {
    this.skills.push({
      skillName,
      config,
    });
    return this;
  }

  /**
   * Add a skill with a specific version
   * @param skillName - Name of the skill to add
   * @param version - Specific version to use
   * @param config - Optional skill-specific configuration
   * @returns this for chaining
   */
  useVersion(
    skillName: string,
    version: string,
    config?: Record<string, unknown>
  ): this {
    this.skills.push({
      skillName,
      version,
      config,
    });
    return this;
  }

  /**
   * Designate which skill produces the final output
   * @param skillName - Name of the output skill
   * @returns this for chaining
   */
  withOutput(skillName: string): this {
    this.outputSkill = skillName;
    return this;
  }

  /**
   * Set global configuration merged into all skill configs
   * @param config - Global configuration object
   * @returns this for chaining
   */
  withGlobalConfig(config: Record<string, unknown>): this {
    this.globalConfig = config;
    return this;
  }

  /**
   * Build the agent composition configuration
   * Validates the configuration and returns a CompositionConfig
   * @returns Promise<CompositionConfig>
   * @throws Error if validation fails
   */
  async build(): Promise<CompositionConfig> {
    // Validate required fields
    if (!this.name) {
      throw new Error('Agent name is required. Call withName() before build().');
    }

    if (this.skills.length === 0) {
      throw new Error(
        'At least one skills is required. Call use() or useVersion() before build().'
      );
    }

    // Resolve all skills from registry
    const resolvedSkills = await this.resolveSkills();

    // Validate skill chain compatibility
    const validationResult = this.schemaValidator.validateChain(resolvedSkills);

    if (!validationResult.valid) {
      const errorMessages = validationResult.errors.join('; ');
      throw new Error(`Skill chain validation failed: ${errorMessages}`);
    }

    // Merge global config with skill configs
    const mergedSkills = this.skills.map((skill) => ({
      ...skill,
      config: this.mergeConfigs(this.globalConfig, skill.config),
    }));

    return {
      name: this.name,
      description: this.description || '',
      skills: mergedSkills,
      outputSkill: this.outputSkill,
      globalConfig: this.globalConfig,
    };
  }

  /**
   * Validate the composition without building
   * @returns ValidationResult with any errors or warnings
   */
  async validate(): Promise<CompositionValidationResult> {
    if (this.skills.length === 0) {
      return {
        valid: false,
        errors: ['At least one skill is required'],
        warnings: [],
      };
    }

    try {
      const resolvedSkills = await this.resolveSkills();
      const schemaResult = this.schemaValidator.validateChain(resolvedSkills);

      return {
        valid: schemaResult.valid,
        errors: schemaResult.errors,
        warnings: schemaResult.warnings,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [(error as Error).message],
        warnings: [],
      };
    }
  }

  /**
   * Resolve all skills from the registry
   * @returns Array of resolved SkillMetadata
   * @throws Error if any skill is not found
   */
  private async resolveSkills(): Promise<SkillMetadata[]> {
    const resolved: SkillMetadata[] = [];

    for (const skillConfig of this.skills) {
      let metadata: SkillMetadata | undefined;

      if (skillConfig.version) {
        metadata = this.registry.getMetadataByVersion(
          skillConfig.skillName,
          skillConfig.version
        );
      } else {
        metadata = this.registry.getMetadata(skillConfig.skillName);
      }

      if (!metadata) {
        const versionInfo = skillConfig.version
          ? `@${skillConfig.version}`
          : '';
        throw new Error(
          `Skill "${skillConfig.skillName}${versionInfo}" not found in registry`
        );
      }

      resolved.push(metadata);
    }

    return resolved;
  }

  /**
   * Merge global config with skill-specific config
   * Skill config takes precedence over global config
   * @param global - Global configuration
   * @param local - Skill-specific configuration
   * @returns Merged configuration
   */
  private mergeConfigs(
    global?: Record<string, unknown>,
    local?: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    if (!global && !local) {
      return undefined;
    }

    if (!global) {
      return local;
    }

    if (!local) {
      return global;
    }

    return {
      ...global,
      ...local,
    };
  }
}
