/**
 * Skill Chain Execution
 *
 * Provides SkillChain for storing skill execution order and
 * SkillChainExecutor for running skills sequentially with data flow.
 */

import { SkillRegistry } from '../../skills/registry/skill-registry';
import { SkillMetadata } from '../../skills/types/skill';
import { Logger } from '../../utils/logger';
import { SkillConfig, CompositionConfig } from '../types/composition';

/**
 * Result of executing a skill chain
 */
export interface SkillChainResult {
  /** Whether the chain execution succeeded */
  success: boolean;
  /** Final output from the chain */
  output: unknown;
  /** Execution trace with step details */
  trace: ExecutionStep[];
  /** Error message if execution failed */
  error?: string;
}

/**
 * Single step in the execution trace
 */
export interface ExecutionStep {
  /** Skill name that was executed */
  skill: string;
  /** Input to the skill */
  input: unknown;
  /** Output from the skill */
  output: unknown;
  /** Execution duration in milliseconds */
  durationMs: number;
}

/**
 * Type for skill execution function
 */
export type SkillExecuteFn = (
  skill: SkillMetadata,
  input: unknown,
  config: Record<string, unknown>
) => Promise<unknown> | unknown;

/**
 * Manages the ordered list of skills to execute
 */
export class SkillChain {
  private skills: SkillConfig[];
  private compositionConfig: CompositionConfig;

  /**
   * Create a new SkillChain
   * @param skills - Ordered array of skill configurations
   * @param compositionConfig - Full composition configuration
   */
  constructor(skills: SkillConfig[], compositionConfig: CompositionConfig) {
    this.skills = skills;
    this.compositionConfig = compositionConfig;
  }

  /**
   * Get the ordered list of skills to execute
   * @returns Array of skill configurations in execution order
   */
  getExecutionOrder(): SkillConfig[] {
    return this.skills;
  }

  /**
   * Get the composition configuration
   * @returns CompositionConfig
   */
  getCompositionConfig(): CompositionConfig {
    return this.compositionConfig;
  }
}

/**
 * Executes skills sequentially, managing data flow between skills
 */
export class SkillChainExecutor {
  private chain: SkillChain;
  private registry: SkillRegistry;
  private logger: Logger;
  private executeSkill: SkillExecuteFn;

  /**
   * Create a new SkillChainExecutor
   * @param chain - SkillChain with ordered skills
   * @param registry - SkillRegistry for skill resolution
   * @param logger - Logger for execution logging
   * @param executeSkill - Function to execute individual skills
   */
  constructor(
    chain: SkillChain,
    registry: SkillRegistry,
    logger: Logger,
    executeSkill?: SkillExecuteFn
  ) {
    this.chain = chain;
    this.registry = registry;
    this.logger = logger;
    // Default skill execution: just returns the skill metadata as output
    this.executeSkill = executeSkill || this.defaultExecuteSkill.bind(this);
  }

  /**
   * Execute the skill chain
   * @param initialInput - Initial input to the first skill
   * @returns SkillChainResult with success status and output
   */
  async execute(initialInput: unknown): Promise<SkillChainResult> {
    const skills = this.chain.getExecutionOrder();
    const compositionConfig = this.chain.getCompositionConfig();
    const trace: ExecutionStep[] = [];

    // Handle empty skills array
    if (skills.length === 0) {
      return {
        success: true,
        output: initialInput,
        trace: [],
      };
    }

    let currentInput = initialInput;
    const skillOutputs = new Map<string, unknown>();

    for (const skillConfig of skills) {
      const startTime = Date.now();

      try {
        // Resolve skill from registry
        const skill = this.resolveSkill(skillConfig);
        if (!skill) {
          const versionInfo = skillConfig.version ? `@${skillConfig.version}` : '';
          return {
            success: false,
            output: currentInput,
            trace,
            error: `Skill "${skillConfig.skillName}${versionInfo}" not found in registry`,
          };
        }

        // Merge global config with skill-specific config
        const mergedConfig = this.mergeConfigs(
          compositionConfig.globalConfig,
          skillConfig.config
        );

        this.logger.debug(`Executing skill: ${skill.name}`, {
          skill: skill.name,
          version: skill.version,
        });

        // Execute the skill
        const output = await this.executeSkill(skill, currentInput, mergedConfig || {});

        const durationMs = Date.now() - startTime;

        // Record execution step
        trace.push({
          skill: skill.name,
          input: currentInput,
          output,
          durationMs,
        });

        // Store output for potential outputSkill selection
        skillOutputs.set(skill.name, output);

        // Pass output to next skill
        currentInput = output;
      } catch (error) {
        const durationMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        this.logger.error(`Skill execution failed: ${skillConfig.skillName}`, {
          error: errorMessage,
        });

        trace.push({
          skill: skillConfig.skillName,
          input: currentInput,
          output: null,
          durationMs,
        });

        return {
          success: false,
          output: currentInput,
          trace,
          error: errorMessage,
        };
      }
    }

    // Determine final output
    let finalOutput = currentInput;
    if (compositionConfig.outputSkill) {
      const specifiedOutput = skillOutputs.get(compositionConfig.outputSkill);
      if (specifiedOutput !== undefined) {
        finalOutput = specifiedOutput;
      }
    }

    return {
      success: true,
      output: finalOutput,
      trace,
    };
  }

  /**
   * Resolve a skill from the registry
   * @param skillConfig - Skill configuration with name and optional version
   * @returns SkillMetadata or undefined if not found
   */
  private resolveSkill(skillConfig: SkillConfig): SkillMetadata | undefined {
    if (skillConfig.version) {
      return this.registry.getMetadataByVersion(skillConfig.skillName, skillConfig.version);
    }
    return this.registry.getMetadata(skillConfig.skillName);
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

  /**
   * Default skill execution function
   * Returns the skill metadata as output (placeholder behavior)
   */
  private defaultExecuteSkill(
    skill: SkillMetadata,
    input: unknown,
    config: Record<string, unknown>
  ): unknown {
    return {
      skill: skill.name,
      input,
      config,
    };
  }
}
