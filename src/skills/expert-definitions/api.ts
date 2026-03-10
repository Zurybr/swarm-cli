/**
 * Expert API
 *
 * Provides hybrid CLI/internal invocation for expert agents.
 * Routes expert tasks to the appropriate expert skill and manages
 * skill registry validation, error handling, and duration tracking.
 */

import { SkillRegistry } from '../registry/skill-registry';
import { AgentBuilder } from '../../agents/builder/agent-builder';
import {
  ExpertTaskInput,
  ExpertOutput,
  BaseFinding,
  SeverityLevel,
} from './types';
import { ExpertDefinition } from './expert-agent';
import { securityExpert } from './security/definition';
import { performanceExpert } from './performance/definition';
import { documentationExpert } from './documentation/definition';

/**
 * ExpertAPI provides programmatic access to expert agents
 *
 * Features:
 * - Route tasks to experts by ID
 * - Validate skill availability in registry
 * - Measure execution duration
 * - Handle partial failures gracefully
 * - Format errors as ExpertOutput
 */
export class ExpertAPI {
  private skillRegistry: SkillRegistry;
  private agentBuilder: AgentBuilder;
  private expertMap: Map<string, ExpertDefinition>;

  /**
   * Create a new ExpertAPI instance
   * @param skillRegistry - SkillRegistry for validating skill availability
   * @param agentBuilder - AgentBuilder for skill composition
   */
  constructor(skillRegistry: SkillRegistry, agentBuilder: AgentBuilder) {
    this.skillRegistry = skillRegistry;
    this.agentBuilder = agentBuilder;

    // Initialize expert lookup map
    this.expertMap = new Map([
      ['security-expert', securityExpert],
      ['perf-expert', performanceExpert],
      ['doc-expert', documentationExpert],
    ]);
  }

  /**
   * Invoke an expert by ID with the given task
   *
   * @param expertId - The expert ID (security-expert, perf-expert, doc-expert)
   * @param task - The task input for the expert
   * @returns Promise<ExpertOutput> with findings and metadata
   * @throws Error if expertId is unknown
   */
  async invokeExpert(
    expertId: string,
    task: ExpertTaskInput
  ): Promise<ExpertOutput> {
    const startTime = Date.now();

    // Get expert definition
    const expert = this.getExpertDefinition(expertId);

    // Validate required skills are available in registry
    this.validateSkillsAvailability(expert);

    // Create skill instance using factory
    const skill = expert.createSkill();

    try {
      // Execute the skill
      const result = await skill.execute(task);

      // Add duration to metadata
      return {
        ...result,
        json: {
          ...result.json,
          metadata: {
            ...result.json.metadata,
            durationMs: Date.now() - startTime,
          },
        },
      };
    } catch (error) {
      // Return partial results with error
      return this.formatErrorOutput(error, task, startTime);
    }
  }

  /**
   * Get an expert definition by ID
   *
   * @param expertId - The expert ID
   * @returns The ExpertDefinition
   * @throws Error if expertId is unknown
   */
  private getExpertDefinition(expertId: string): ExpertDefinition {
    const expert = this.expertMap.get(expertId);
    if (!expert) {
      throw new Error(`Unknown expert: ${expertId}`);
    }
    return expert;
  }

  /**
   * Validate that required skills are available in the registry
   *
   * @param expert - The expert definition to validate
   * @throws Error if any required skill is not found
   */
  private validateSkillsAvailability(expert: ExpertDefinition): void {
    for (const skillName of expert.skills) {
      const metadata = this.skillRegistry.getMetadata(skillName);
      if (!metadata) {
        throw new Error(
          `Skill ${skillName} not found in registry for expert ${expert.id}`
        );
      }
    }
  }

  /**
   * Format an error as ExpertOutput
   *
   * @param error - The error that occurred
   * @param task - The task that was being executed
   * @param startTime - The start time of execution
   * @returns ExpertOutput with error information
   */
  private formatErrorOutput(
    error: unknown,
    task: ExpertTaskInput,
    startTime: number
  ): ExpertOutput {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    const now = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    return {
      json: {
        findings: [],
        summary: {
          totalIssues: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          filesScanned: 0,
        },
        metadata: {
          durationMs,
          expertVersion: 'error',
          scannedAt: now,
        },
        errors: [errorMessage],
      },
      markdown: this.buildErrorMarkdown(errorMessage, task, now, durationMs),
    };
  }

  /**
   * Build markdown error report
   */
  private buildErrorMarkdown(
    errorMessage: string,
    task: ExpertTaskInput,
    scannedAt: string,
    durationMs: number
  ): string {
    const lines: string[] = [];

    lines.push('# Expert Analysis Error');
    lines.push('');
    lines.push(`**Target:** ${task.targetPath}`);
    lines.push(`**Generated:** ${scannedAt}`);
    lines.push(`**Duration:** ${durationMs}ms`);
    lines.push('');
    lines.push('## Error');
    lines.push('');
    lines.push(errorMessage);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(
      'The expert analysis failed. Please check the target path and try again.'
    );

    return lines.join('\n');
  }

  /**
   * Get all available expert IDs
   * @returns Array of expert IDs
   */
  getAvailableExperts(): string[] {
    return Array.from(this.expertMap.keys());
  }

  /**
   * Check if an expert ID is available
   * @param expertId - The expert ID to check
   * @returns true if the expert is available
   */
  hasExpert(expertId: string): boolean {
    return this.expertMap.has(expertId);
  }
}
