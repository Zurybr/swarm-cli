/**
 * PLAN.md to Prompt Converter
 *
 * Converts parsed Plan objects into executable prompts for swarm agents.
 * Handles context resolution, task conversion, and prompt formatting.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Plan, PlanTask } from './types.js';

// ============================================================================
// PromptBuilder
// ============================================================================

/**
 * Options for building prompts
 */
export interface PromptBuilderOptions {
  /** Include context file contents */
  includeContext?: boolean;
  /** Maximum lines to include from context files */
  maxContextLines?: number;
  /** Whether to include verification section */
  includeVerification?: boolean;
  /** Whether to include success criteria */
  includeSuccessCriteria?: boolean;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<PromptBuilderOptions> = {
  includeContext: true,
  maxContextLines: 200,
  includeVerification: true,
  includeSuccessCriteria: true,
};

/**
 * Converts PLAN.md parsed objects into executable agent prompts
 */
export class PromptBuilder {
  private options: Required<PromptBuilderOptions>;
  private projectRoot: string;

  constructor(options: PromptBuilderOptions = {}, projectRoot: string = process.cwd()) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.projectRoot = projectRoot;
  }

  /**
   * Build a complete executable prompt from a Plan object
   */
  async build(plan: Plan): Promise<string> {
    const sections: string[] = [];

    sections.push(this.buildHeader(plan));
    sections.push(this.buildObjective(plan));
    
    if (this.options.includeContext) {
      const context = await this.buildContext(plan);
      if (context) {
        sections.push(context);
      }
    }

    sections.push(this.buildTasks(plan));
    
    if (this.options.includeVerification && plan.verification.length > 0) {
      sections.push(this.buildVerification(plan));
    }
    
    if (this.options.includeSuccessCriteria && plan.successCriteria) {
      sections.push(this.buildSuccessCriteria(plan));
    }

    sections.push(this.buildFooter(plan));

    return sections.filter(Boolean).join('\n\n');
  }

  /**
   * Build a complete executable prompt synchronously (without file reads)
   */
  buildSync(plan: Plan): string {
    const sections: string[] = [];

    sections.push(this.buildHeader(plan));
    sections.push(this.buildObjective(plan));
    sections.push(this.buildContextSync(plan));
    sections.push(this.buildTasks(plan));
    
    if (this.options.includeVerification && plan.verification.length > 0) {
      sections.push(this.buildVerification(plan));
    }
    
    if (this.options.includeSuccessCriteria && plan.successCriteria) {
      sections.push(this.buildSuccessCriteria(plan));
    }

    sections.push(this.buildFooter(plan));

    return sections.filter(Boolean).join('\n\n');
  }

  /**
   * Build the header section with phase/plan info
   */
  buildHeader(plan: Plan): string {
    const { metadata } = plan;
    const lines = [
      '# ' + '='.repeat(60),
      `# PLAN: ${metadata.phase}-${metadata.plan}`,
      '# ' + '='.repeat(60),
      '',
      `**Phase:** ${metadata.phase}`,
      `**Plan:** ${metadata.plan}`,
      `**Type:** ${metadata.type}`,
      `**Wave:** ${metadata.wave}`,
      `**Autonomous:** ${metadata.autonomous ? 'Yes' : 'No'}`,
    ];

    if (metadata.depends_on.length > 0) {
      lines.push(`**Depends On:** ${metadata.depends_on.join(', ')}`);
    }

    if (metadata.files_modified.length > 0) {
      lines.push(`**Files to Modify:** ${metadata.files_modified.join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Build the objective section
   */
  buildObjective(plan: Plan): string {
    return [
      '## Objective',
      '',
      plan.objective || '(No objective defined)',
    ].join('\n');
  }

  /**
   * Build the context section with resolved @ references
   */
  async buildContext(plan: Plan): Promise<string> {
    if (plan.context.length === 0) {
      return '';
    }

    const lines = ['## Context', ''];

    for (const ref of plan.context) {
      const resolvedPath = this.resolvePath(ref);
      
      try {
        const content = await fs.readFile(resolvedPath, 'utf-8');
        const truncated = this.truncateContent(content, this.options.maxContextLines);
        
        lines.push(`### ${ref}`);
        lines.push('```');
        lines.push(truncated);
        lines.push('```');
        lines.push('');
      } catch (error) {
        lines.push(`### ${ref}`);
        lines.push(`*(File not found: ${resolvedPath})*`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Build context section synchronously (without file reads)
   */
  buildContextSync(plan: Plan): string {
    if (plan.context.length === 0) {
      return '';
    }

    const lines = ['## Context', ''];

    for (const ref of plan.context) {
      lines.push(`- ${ref}`);
    }

    lines.push('');
    lines.push('*(Use @ references to load actual file contents during execution)*');

    return lines.join('\n');
  }

  /**
   * Build the tasks section with step-by-step instructions
   */
  buildTasks(plan: Plan): string {
    if (plan.tasks.length === 0) {
      return '## Tasks\n\n*(No tasks defined)*';
    }

    const lines = ['## Tasks', ''];

    for (let i = 0; i < plan.tasks.length; i++) {
      const task = plan.tasks[i];
      lines.push(this.buildTask(task, i + 1));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Build a single task as formatted instructions
   */
  buildTask(task: PlanTask, index: number): string {
    const lines: string[] = [];

    lines.push(`### ${index}. ${task.name}`);
    lines.push('');
    
    lines.push(`**Type:** ${task.type}${task.tdd ? ' (TDD)' : ''}`);
    lines.push('');

    if (task.files.length > 0) {
      lines.push(`**Files:** ${task.files.join(', ')}`);
      lines.push('');
    }

    lines.push('**Action:**');
    lines.push(task.action);
    lines.push('');

    if (task.verify) {
      lines.push('**Verification:**');
      lines.push(task.verify);
      lines.push('');
    }

    lines.push('**Done when:**');
    lines.push(task.done);

    if (task.tdd && task.behavior && task.behavior.length > 0) {
      lines.push('');
      lines.push('**Expected behavior:**');
      for (const b of task.behavior) {
        lines.push(`- ${b}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Build the verification checklist section
   */
  buildVerification(plan: Plan): string {
    if (plan.verification.length === 0) {
      return '';
    }

    const lines = ['## Verification Checklist', ''];

    for (const item of plan.verification) {
      lines.push(`- [ ] ${item}`);
    }

    return lines.join('\n');
  }

  /**
   * Build the success criteria section
   */
  buildSuccessCriteria(plan: Plan): string {
    if (!plan.successCriteria) {
      return '';
    }

    return [
      '## Success Criteria',
      '',
      plan.successCriteria,
    ].join('\n');
  }

  /**
   * Build the footer with must-haves if present
   */
  buildFooter(plan: Plan): string {
    const lines: string[] = [];

    if (plan.mustHaves.truths.length > 0) {
      lines.push('## Must-Have Truths');
      lines.push('');
      for (const truth of plan.mustHaves.truths) {
        lines.push(`- ${truth}`);
      }
      lines.push('');
    }

    if (plan.mustHaves.artifacts.length > 0) {
      lines.push('## Required Artifacts');
      lines.push('');
      for (const artifact of plan.mustHaves.artifacts) {
        lines.push(`- \`${artifact.path}\` - ${artifact.provides}`);
      }
      lines.push('');
    }

    if (plan.mustHaves.key_links.length > 0) {
      lines.push('## Key Links');
      lines.push('');
      for (const link of plan.mustHaves.key_links) {
        lines.push(`- ${link.from} → ${link.to} (via ${link.via})`);
      }
      lines.push('');
    }

    lines.push('--');
    lines.push('*Generated by Swarm CLI PLAN.md Prompt Builder*');

    return lines.join('\n');
  }

  /**
   * Resolve a @ reference path to absolute path
   */
  private resolvePath(ref: string): string {
    if (ref.startsWith('@/')) {
      return path.resolve(this.projectRoot, ref.substring(2));
    }
    if (ref.startsWith('@.')) {
      return path.resolve(this.projectRoot, ref.substring(1));
    }
    return path.resolve(this.projectRoot, ref);
  }

  /**
   * Truncate content to maximum number of lines
   */
  private truncateContent(content: string, maxLines: number): string {
    const lines = content.split('\n');
    if (lines.length <= maxLines) {
      return content;
    }
    return lines.slice(0, maxLines).join('\n') + '\n...(truncated)';
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Convert a Plan to an executable prompt string
 */
export async function planToPrompt(plan: Plan, options?: PromptBuilderOptions): Promise<string> {
  const builder = new PromptBuilder(options);
  return builder.build(plan);
}

/**
 * Convert a Plan to a prompt string synchronously
 */
export function planToPromptSync(plan: Plan, options?: PromptBuilderOptions): string {
  const builder = new PromptBuilder(options);
  return builder.buildSync(plan);
}
