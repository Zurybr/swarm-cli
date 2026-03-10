/**
 * Meta-Prompts System
 *
 * Main entry point for the meta-prompts system.
 * Provides a unified API for template management, context injection,
 * prompt optimization, and rendering.
 */

import type {
  AgentType,
  InjectedContext,
  MetaPromptConfig,
  OptimizationStrategy,
  PromptTemplate,
  RenderedPrompt,
  TemplateVariable,
  ValidationResult,
  OptimizationResult,
  AgentCapability,
} from './types';
import { getTemplate, listAgentTypes, getAllTemplateSummaries } from './templates';
import {
  injectContext,
  applyDefaults,
  validateVariables,
  enrichContext,
  contextEnrichers,
  formatCodeSnippet,
  estimateTokens,
  truncateForTokens,
  type InjectionOptions,
} from './injector';
import {
  optimizePrompt,
  optimizeForAgent,
  batchOptimize,
  suggestStrategies,
  compareOptimizations,
  createOptimizedPrompt,
  type OptimizerOptions,
} from './optimizer';
import {
  TemplateRegistry,
  MemoryStorage,
  FileStorage,
  createTemplate,
  getGlobalRegistry,
  resetGlobalRegistry,
  type TemplateStorage,
} from './registry';

export * from './types';
export * from './templates';
export * from './injector';
export * from './optimizer';
export * from './registry';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: MetaPromptConfig = {
  defaultAgentType: 'executor',
  maxContextTokens: 4000,
  optimizationEnabled: true,
  defaultStrategy: 'token_reduction',
  storagePath: './.swarm/metaprompts',
  versioningEnabled: true,
};

/**
 * Main MetaPromptSystem class
 */
export class MetaPromptSystem {
  private config: MetaPromptConfig;
  private registry: TemplateRegistry;
  private initialized = false;

  constructor(config: Partial<MetaPromptConfig> = {}, storage?: TemplateStorage) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (storage) {
      this.registry = new TemplateRegistry(storage);
    } else if (this.config.storagePath) {
      this.registry = new TemplateRegistry(new FileStorage(this.config.storagePath));
    } else {
      this.registry = new TemplateRegistry(new MemoryStorage());
    }
  }

  /**
   * Initialize the system
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.registry.initialize();
    this.initialized = true;
  }

  /**
   * Render a prompt for a specific agent type
   */
  async render(
    agentType: AgentType,
    context: InjectedContext,
    customValues: Record<string, unknown> = {},
    options: InjectionOptions = {},
  ): Promise<RenderedPrompt> {
    await this.ensureInitialized();

    const template = await this.registry.getTemplateByAgentType(agentType);
    const version = await this.registry.getVersionHistory(template.id);
    const currentVersion = version.find((v) => v.isCurrent)?.version || '1.0.0';

    // Enrich context if enabled
    let enrichedContext = context;
    if (this.config.optimizationEnabled) {
      enrichedContext = enrichContext(context, [
        contextEnrichers.timestamp,
        contextEnrichers.codeStats,
        contextEnrichers.historySummary,
      ]);
    }

    // Inject context into template
    const { result: prompt, validation } = injectContext(
      template.content,
      template.variables,
      enrichedContext,
      customValues,
      options,
    );

    // Optimize if enabled
    let finalPrompt = prompt;
    let optimization: OptimizationResult | undefined;

    if (this.config.optimizationEnabled) {
      optimization = optimizePrompt(prompt, {
        strategy: this.config.defaultStrategy,
        targetTokens: this.config.maxContextTokens,
      });
      finalPrompt = optimization.optimized;
    }

    const estimatedTokens = estimateTokens(finalPrompt);

    // Record usage
    await this.registry.recordUsage(template.id, estimatedTokens, validation.valid);

    return {
      prompt: finalPrompt,
      templateId: template.id,
      version: currentVersion,
      variables: applyDefaults(template.variables, { task: context.task, ...customValues }),
      context: enrichedContext,
      estimatedTokens,
      renderedAt: new Date(),
    };
  }

  /**
   * Render with a specific template
   */
  async renderWithTemplate(
    templateId: string,
    context: InjectedContext,
    customValues: Record<string, unknown> = {},
    options: InjectionOptions = {},
  ): Promise<RenderedPrompt> {
    await this.ensureInitialized();

    const template = await this.registry.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const version = await this.registry.getVersionHistory(templateId);
    const currentVersion = version.find((v) => v.isCurrent)?.version || '1.0.0';

    const { result: prompt, validation } = injectContext(
      template.content,
      template.variables,
      context,
      customValues,
      options,
    );

    const estimatedTokens = estimateTokens(prompt);
    await this.registry.recordUsage(templateId, estimatedTokens, validation.valid);

    return {
      prompt,
      templateId,
      version: currentVersion,
      variables: applyDefaults(template.variables, { task: context.task, ...customValues }),
      context,
      estimatedTokens,
      renderedAt: new Date(),
    };
  }

  /**
   * Optimize an existing prompt
   */
  optimize(prompt: string, strategy?: OptimizationStrategy): OptimizationResult {
    return optimizePrompt(prompt, {
      strategy: strategy || this.config.defaultStrategy,
      targetTokens: this.config.maxContextTokens,
    });
  }

  /**
   * Get optimization suggestions for a prompt
   */
  suggestOptimizations(prompt: string): OptimizationStrategy[] {
    return suggestStrategies(prompt);
  }

  /**
   * Validate variables against a template
   */
  async validate(
    templateId: string,
    values: Record<string, unknown>,
  ): Promise<ValidationResult> {
    await this.ensureInitialized();

    const template = await this.registry.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return validateVariables(template.variables, values);
  }

  /**
   * Get available agent types
   */
  getAgentTypes(): AgentType[] {
    return listAgentTypes();
  }

  /**
   * Get template information
   */
  async getTemplateInfo(agentType: AgentType): Promise<{
    id: string;
    name: string;
    description: string;
    complexity: number;
    estimatedTokens: number;
    variableCount: number;
    variables: TemplateVariable[];
  }> {
    await this.ensureInitialized();

    const template = await this.registry.getTemplateByAgentType(agentType);
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      complexity: template.metadata.complexity,
      estimatedTokens: template.metadata.estimatedTokens,
      variableCount: template.variables.length,
      variables: template.variables,
    };
  }

  /**
   * Get all template summaries
   */
  getAllTemplates(): ReturnType<typeof getAllTemplateSummaries> {
    return getAllTemplateSummaries();
  }

  /**
   * Create a custom template
   */
  async createTemplate(
    id: string,
    name: string,
    description: string,
    agentType: AgentType,
    content: string,
    variables: TemplateVariable[],
    author: string,
    tags: string[] = [],
  ): Promise<PromptTemplate> {
    await this.ensureInitialized();

    const template = createTemplate(
      id,
      name,
      description,
      agentType,
      content,
      variables,
      author,
      tags,
    );

    await this.registry.registerTemplate(template);
    return template;
  }

  /**
   * Update a template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<Omit<PromptTemplate, 'id' | 'metadata'>>,
    changelog: string,
  ): Promise<void> {
    await this.ensureInitialized();
    await this.registry.updateTemplate(templateId, updates, changelog);
  }

  /**
   * Get template version history
   */
  async getVersionHistory(templateId: string) {
    await this.ensureInitialized();
    return this.registry.getVersionHistory(templateId);
  }

  /**
   * Rollback to a specific version
   */
  async rollbackVersion(templateId: string, version: string): Promise<void> {
    await this.ensureInitialized();
    await this.registry.rollbackVersion(templateId, version);
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.registry.deleteTemplate(templateId);
  }

  /**
   * Search templates
   */
  async searchTemplates(query: string): Promise<PromptTemplate[]> {
    await this.ensureInitialized();
    return this.registry.search(query);
  }

  /**
   * Export a template to JSON
   */
  exportTemplate(templateId: string): string | null {
    return this.registry.exportTemplate(templateId);
  }

  /**
   * Import a template from JSON
   */
  async importTemplate(json: string): Promise<PromptTemplate> {
    await this.ensureInitialized();
    const entry = await this.registry.importTemplate(json);
    return entry.template;
  }

  /**
   * Get system statistics
   */
  async getStats() {
    await this.ensureInitialized();
    return this.registry.getSummary();
  }

  /**
   * Get configuration
   */
  getConfig(): MetaPromptConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MetaPromptConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

/**
 * Create a new MetaPromptSystem instance
 */
export function createMetaPromptSystem(
  config?: Partial<MetaPromptConfig>,
  storage?: TemplateStorage,
): MetaPromptSystem {
  return new MetaPromptSystem(config, storage);
}

/**
 * Quick render function for simple use cases
 */
export async function quickRender(
  agentType: AgentType,
  task: string,
  context?: Partial<InjectedContext>,
): Promise<string> {
  const system = createMetaPromptSystem();
  await system.initialize();

  const injectedContext: InjectedContext = {
    task,
    ...context,
  };

  const rendered = await system.render(agentType, injectedContext);
  return rendered.prompt;
}

/**
 * Utility functions
 */
export const utils = {
  formatCodeSnippet,
  estimateTokens,
  truncateForTokens,
  compareOptimizations,
  batchOptimize,
  createOptimizedPrompt,
  optimizeForAgent,
  suggestStrategies,
};

/**
 * Default export
 */
export default MetaPromptSystem;
