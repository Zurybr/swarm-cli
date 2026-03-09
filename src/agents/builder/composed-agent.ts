/**
 * Composed Agent
 *
 * Agent implementation that extends BaseAgent and executes composed skills as a pipeline.
 * Integrates with the existing orchestration system via the BaseAgent interface.
 */

import {
  BaseAgent,
  AgentConfig,
  Task,
  AgentResult,
} from '../base-agent';
import { SkillRegistry } from '../../skills/registry/skill-registry';
import { CompositionConfig } from '../types/composition';
import { Logger } from '../../utils/logger';
import {
  SkillChain,
  SkillChainExecutor,
  SkillChainResult,
} from './skill-chain';

/**
 * Agent that executes a composed chain of skills
 * Extends BaseAgent for integration with existing orchestration
 */
export class ComposedAgent extends BaseAgent {
  private compositionConfig: CompositionConfig;
  private skillRegistry: SkillRegistry;
  private chainExecutor: SkillChainExecutor;
  private logger: Logger;

  /**
   * Create a new ComposedAgent
   * @param config - Agent configuration (id, role, model, etc.)
   * @param compositionConfig - Composition configuration (skills, outputSkill, etc.)
   * @param skillRegistry - SkillRegistry for skill resolution
   */
  constructor(
    config: AgentConfig,
    compositionConfig: CompositionConfig,
    skillRegistry: SkillRegistry
  ) {
    super(config);
    this.compositionConfig = compositionConfig;
    this.skillRegistry = skillRegistry;
    this.logger = new Logger(`ComposedAgent:${config.role}`);

    const chain = new SkillChain(compositionConfig.skills, compositionConfig);
    this.chainExecutor = new SkillChainExecutor(
      chain,
      skillRegistry,
      this.logger
    );
  }

  /**
   * Execute the composed skill chain for the given task
   * @param task - Task to execute
   * @returns AgentResult with success status, output, and artifacts
   */
  async execute(task: Task): Promise<AgentResult> {
    await this.beforeExecute(task);

    try {
      // Extract input from task description
      const input = this.extractInput(task.description);

      // Execute the skill chain
      const chainResult = await this.chainExecutor.execute(input);

      // Format the result
      const result = this.formatResult(chainResult);

      await this.afterExecute(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('ComposedAgent execution failed', { error: errorMessage });

      const errorResult: AgentResult = {
        success: false,
        error: errorMessage,
      };

      await this.afterExecute(errorResult);
      return errorResult;
    }
  }

  /**
   * Extract input from task description
   * Attempts JSON parse, falls back to wrapping as content property
   * @param description - Task description string
   * @returns Parsed input object
   */
  private extractInput(description: string): unknown {
    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(description);
      return parsed;
    } catch {
      // Not valid JSON, wrap as content property
      return { content: description };
    }
  }

  /**
   * Format chain result into AgentResult
   * @param chainResult - Result from skill chain execution
   * @returns AgentResult for orchestrator
   */
  private formatResult(chainResult: SkillChainResult): AgentResult {
    const artifacts = this.extractArtifacts(chainResult.output);

    return {
      success: chainResult.success,
      output: JSON.stringify(chainResult.output),
      artifacts: artifacts.length > 0 ? artifacts : undefined,
      error: chainResult.error,
    };
  }

  /**
   * Extract artifacts from skill output
   * Looks for filePath and artifacts array properties
   * @param output - Skill chain output
   * @returns Array of artifact paths
   */
  private extractArtifacts(output: unknown): string[] {
    const artifacts: string[] = [];

    if (output === null || output === undefined) {
      return artifacts;
    }

    // Handle array of outputs (from trace)
    if (Array.isArray(output)) {
      for (const item of output) {
        artifacts.push(...this.extractArtifacts(item));
      }
      return artifacts;
    }

    // Handle single object output
    if (typeof output === 'object') {
      const obj = output as Record<string, unknown>;

      // Extract filePath if present
      if (obj.filePath && typeof obj.filePath === 'string') {
        artifacts.push(obj.filePath);
      }

      // Extract artifacts array if present
      if (obj.artifacts && Array.isArray(obj.artifacts)) {
        for (const artifact of obj.artifacts) {
          if (typeof artifact === 'string') {
            artifacts.push(artifact);
          }
        }
      }
    }

    return artifacts;
  }
}
