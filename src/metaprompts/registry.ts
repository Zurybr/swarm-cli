/**
 * Template Registry
 *
 * Manages template versioning, storage, and retrieval.
 * Supports CRUD operations, version history, and usage statistics.
 */

import type {
  PromptTemplate,
  PromptVersion,
  RegistryEntry,
  AgentType,
  TemplateVariable,
} from './types';
import { AGENT_TEMPLATES, getTemplate } from './templates';

/**
 * Storage interface for template persistence
 */
export interface TemplateStorage {
  /** Load all entries */
  load(): Promise<RegistryEntry[]>;
  /** Save all entries */
  save(entries: RegistryEntry[]): Promise<void>;
  /** Load a single entry by template ID */
  loadEntry(templateId: string): Promise<RegistryEntry | null>;
  /** Save a single entry */
  saveEntry(entry: RegistryEntry): Promise<void>;
  /** Delete an entry */
  deleteEntry(templateId: string): Promise<boolean>;
}

/**
 * In-memory storage implementation
 */
export class MemoryStorage implements TemplateStorage {
  private entries: Map<string, RegistryEntry> = new Map();

  async load(): Promise<RegistryEntry[]> {
    return Array.from(this.entries.values());
  }

  async save(entries: RegistryEntry[]): Promise<void> {
    this.entries.clear();
    for (const entry of entries) {
      this.entries.set(entry.template.id, entry);
    }
  }

  async loadEntry(templateId: string): Promise<RegistryEntry | null> {
    return this.entries.get(templateId) || null;
  }

  async saveEntry(entry: RegistryEntry): Promise<void> {
    this.entries.set(entry.template.id, entry);
  }

  async deleteEntry(templateId: string): Promise<boolean> {
    return this.entries.delete(templateId);
  }
}

/**
 * File-based storage implementation
 */
export class FileStorage implements TemplateStorage {
  private filePath: string;
  private memory: MemoryStorage;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.memory = new MemoryStorage();
  }

  async load(): Promise<RegistryEntry[]> {
    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(this.filePath, 'utf-8');
      const entries = JSON.parse(data, (key, value) => {
        // Revive Date objects
        if (key === 'createdAt' || key === 'modifiedAt') {
          return new Date(value);
        }
        return value;
      });
      await this.memory.save(entries);
      return entries;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async save(entries: RegistryEntry[]): Promise<void> {
    const fs = await import('fs/promises');
    const dir = (await import('path')).dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.filePath,
      JSON.stringify(entries, null, 2),
      'utf-8',
    );
    await this.memory.save(entries);
  }

  async loadEntry(templateId: string): Promise<RegistryEntry | null> {
    const entries = await this.load();
    return entries.find((e) => e.template.id === templateId) || null;
  }

  async saveEntry(entry: RegistryEntry): Promise<void> {
    const entries = await this.load();
    const index = entries.findIndex((e) => e.template.id === entry.template.id);
    if (index >= 0) {
      entries[index] = entry;
    } else {
      entries.push(entry);
    }
    await this.save(entries);
  }

  async deleteEntry(templateId: string): Promise<boolean> {
    const entries = await this.load();
    const index = entries.findIndex((e) => e.template.id === templateId);
    if (index >= 0) {
      entries.splice(index, 1);
      await this.save(entries);
      return true;
    }
    return false;
  }
}

/**
 * Template Registry
 */
export class TemplateRegistry {
  private storage: TemplateStorage;
  private cache: Map<string, RegistryEntry> = new Map();
  private initialized = false;

  constructor(storage?: TemplateStorage) {
    this.storage = storage || new MemoryStorage();
  }

  /**
   * Initialize the registry with built-in templates
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load existing entries
    const entries = await this.storage.load();
    for (const entry of entries) {
      this.cache.set(entry.template.id, entry);
    }

    // Add built-in templates if not present
    for (const [agentType, template] of Object.entries(AGENT_TEMPLATES)) {
      if (!this.cache.has(template.id)) {
        await this.registerTemplate(template as PromptTemplate);
      }
    }

    this.initialized = true;
  }

  /**
   * Register a new template
   */
  async registerTemplate(template: PromptTemplate): Promise<RegistryEntry> {
    const now = new Date();
    const version: PromptVersion = {
      version: '1.0.0',
      templateId: template.id,
      content: template.content,
      changelog: 'Initial version',
      author: template.metadata.author,
      createdAt: now,
      isCurrent: true,
    };

    const entry: RegistryEntry = {
      template,
      versions: [version],
      currentVersion: '1.0.0',
      stats: {
        usageCount: 0,
        avgTokens: template.metadata.estimatedTokens,
        successRate: 1.0,
      },
    };

    await this.storage.saveEntry(entry);
    this.cache.set(template.id, entry);

    return entry;
  }

  /**
   * Get a template by ID
   */
  async getTemplate(templateId: string): Promise<PromptTemplate | null> {
    await this.ensureInitialized();
    const entry = this.cache.get(templateId);
    return entry?.template || null;
  }

  /**
   * Get template by agent type
   */
  async getTemplateByAgentType(agentType: AgentType): Promise<PromptTemplate> {
    await this.ensureInitialized();
    return getTemplate(agentType);
  }

  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<PromptTemplate[]> {
    await this.ensureInitialized();
    return Array.from(this.cache.values()).map((e) => e.template);
  }

  /**
   * Get templates by tag
   */
  async getTemplatesByTag(tag: string): Promise<PromptTemplate[]> {
    await this.ensureInitialized();
    return Array.from(this.cache.values())
      .filter((e) => e.template.metadata.tags.includes(tag))
      .map((e) => e.template);
  }

  /**
   * Update a template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<Omit<PromptTemplate, 'id' | 'metadata'>>,
    changelog: string,
  ): Promise<RegistryEntry | null> {
    await this.ensureInitialized();

    const entry = this.cache.get(templateId);
    if (!entry) return null;

    // Create new version
    const newVersion = incrementVersion(entry.currentVersion);
    const updatedTemplate: PromptTemplate = {
      ...entry.template,
      ...updates,
      metadata: {
        ...entry.template.metadata,
        modifiedAt: new Date(),
      },
    };

    const version: PromptVersion = {
      version: newVersion,
      templateId,
      content: updatedTemplate.content,
      changelog,
      author: updatedTemplate.metadata.author,
      createdAt: new Date(),
      isCurrent: true,
    };

    // Mark previous version as not current
    for (const v of entry.versions) {
      v.isCurrent = false;
    }

    const updatedEntry: RegistryEntry = {
      template: updatedTemplate,
      versions: [...entry.versions, version],
      currentVersion: newVersion,
      stats: entry.stats,
    };

    await this.storage.saveEntry(updatedEntry);
    this.cache.set(templateId, updatedEntry);

    return updatedEntry;
  }

  /**
   * Create a new version of a template
   */
  async createVersion(
    templateId: string,
    content: string,
    changelog: string,
    author: string,
  ): Promise<PromptVersion | null> {
    await this.ensureInitialized();

    const entry = this.cache.get(templateId);
    if (!entry) return null;

    const newVersion = incrementVersion(entry.currentVersion);

    // Mark previous versions as not current
    for (const v of entry.versions) {
      v.isCurrent = false;
    }

    const version: PromptVersion = {
      version: newVersion,
      templateId,
      content,
      changelog,
      author,
      createdAt: new Date(),
      isCurrent: true,
    };

    entry.versions.push(version);
    entry.currentVersion = newVersion;
    entry.template.content = content;
    entry.template.metadata.modifiedAt = new Date();

    await this.storage.saveEntry(entry);

    return version;
  }

  /**
   * Get version history for a template
   */
  async getVersionHistory(templateId: string): Promise<PromptVersion[]> {
    await this.ensureInitialized();
    const entry = this.cache.get(templateId);
    return entry?.versions || [];
  }

  /**
   * Get a specific version
   */
  async getVersion(
    templateId: string,
    version: string,
  ): Promise<PromptVersion | null> {
    await this.ensureInitialized();
    const entry = this.cache.get(templateId);
    return entry?.versions.find((v) => v.version === version) || null;
  }

  /**
   * Rollback to a previous version
   */
  async rollbackVersion(
    templateId: string,
    targetVersion: string,
  ): Promise<RegistryEntry | null> {
    await this.ensureInitialized();

    const entry = this.cache.get(templateId);
    if (!entry) return null;

    const version = entry.versions.find((v) => v.version === targetVersion);
    if (!version) return null;

    // Mark all versions as not current
    for (const v of entry.versions) {
      v.isCurrent = false;
    }

    // Mark target as current
    version.isCurrent = true;
    entry.currentVersion = targetVersion;
    entry.template.content = version.content;
    entry.template.metadata.modifiedAt = new Date();

    await this.storage.saveEntry(entry);

    return entry;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    await this.ensureInitialized();
    const deleted = await this.storage.deleteEntry(templateId);
    if (deleted) {
      this.cache.delete(templateId);
    }
    return deleted;
  }

  /**
   * Record template usage
   */
  async recordUsage(
    templateId: string,
    tokensUsed: number,
    success: boolean,
  ): Promise<void> {
    await this.ensureInitialized();

    const entry = this.cache.get(templateId);
    if (!entry) return;

    entry.stats.usageCount++;
    entry.stats.lastUsed = new Date();

    // Update average tokens
    entry.stats.avgTokens =
      (entry.stats.avgTokens * (entry.stats.usageCount - 1) + tokensUsed) /
      entry.stats.usageCount;

    // Update success rate
    const successCount = entry.stats.successRate * (entry.stats.usageCount - 1);
    entry.stats.successRate =
      (successCount + (success ? 1 : 0)) / entry.stats.usageCount;

    await this.storage.saveEntry(entry);
  }

  /**
   * Get usage statistics
   */
  async getStats(templateId: string): Promise<RegistryEntry['stats'] | null> {
    await this.ensureInitialized();
    const entry = this.cache.get(templateId);
    return entry?.stats || null;
  }

  /**
   * Search templates
   */
  async search(query: string): Promise<PromptTemplate[]> {
    await this.ensureInitialized();

    const lowerQuery = query.toLowerCase();
    return Array.from(this.cache.values())
      .filter(
        (e) =>
          e.template.name.toLowerCase().includes(lowerQuery) ||
          e.template.description.toLowerCase().includes(lowerQuery) ||
          e.template.metadata.tags.some((t) =>
            t.toLowerCase().includes(lowerQuery),
          ),
      )
      .map((e) => e.template);
  }

  /**
   * Clone a template
   */
  async cloneTemplate(
    sourceId: string,
    newId: string,
    newName: string,
  ): Promise<RegistryEntry | null> {
    await this.ensureInitialized();

    const source = this.cache.get(sourceId);
    if (!source) return null;

    const cloned: PromptTemplate = {
      ...source.template,
      id: newId,
      name: newName,
      metadata: {
        ...source.template.metadata,
        createdAt: new Date(),
        modifiedAt: new Date(),
      },
    };

    return this.registerTemplate(cloned);
  }

  /**
   * Export template to JSON
   */
  exportTemplate(templateId: string): string | null {
    const entry = this.cache.get(templateId);
    if (!entry) return null;

    return JSON.stringify(entry.template, null, 2);
  }

  /**
   * Import template from JSON
   */
  async importTemplate(json: string): Promise<RegistryEntry> {
    const template = JSON.parse(json) as PromptTemplate;

    // Validate required fields
    if (!template.id || !template.name || !template.content) {
      throw new Error('Invalid template: missing required fields');
    }

    // Ensure metadata dates are Date objects
    if (template.metadata) {
      template.metadata.createdAt = new Date(template.metadata.createdAt);
      template.metadata.modifiedAt = new Date(template.metadata.modifiedAt);
    }

    return this.registerTemplate(template);
  }

  /**
   * Get registry summary
   */
  async getSummary(): Promise<{
    totalTemplates: number;
    totalVersions: number;
    mostUsed: string[];
    recentlyUpdated: string[];
  }> {
    await this.ensureInitialized();

    const entries = Array.from(this.cache.values());

    const mostUsed = entries
      .sort((a, b) => b.stats.usageCount - a.stats.usageCount)
      .slice(0, 5)
      .map((e) => e.template.name);

    const recentlyUpdated = entries
      .sort(
        (a, b) =>
          b.template.metadata.modifiedAt.getTime() -
          a.template.metadata.modifiedAt.getTime(),
      )
      .slice(0, 5)
      .map((e) => e.template.name);

    return {
      totalTemplates: entries.length,
      totalVersions: entries.reduce((sum, e) => sum + e.versions.length, 0),
      mostUsed,
      recentlyUpdated,
    };
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

/**
 * Increment semantic version
 */
function incrementVersion(version: string): string {
  const parts = version.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join('.');
}

/**
 * Create a custom template from scratch
 */
export function createTemplate(
  id: string,
  name: string,
  description: string,
  agentType: AgentType,
  content: string,
  variables: TemplateVariable[],
  author: string,
  tags: string[] = [],
): PromptTemplate {
  const now = new Date();

  return {
    id,
    name,
    description,
    agentType,
    content,
    variables,
    metadata: {
      author,
      createdAt: now,
      modifiedAt: now,
      tags,
      complexity: 3,
      estimatedTokens: Math.ceil(content.length / 4),
      isActive: true,
    },
  };
}

/**
 * Global registry instance
 */
let globalRegistry: TemplateRegistry | null = null;

/**
 * Get or create global registry
 */
export function getGlobalRegistry(storage?: TemplateStorage): TemplateRegistry {
  if (!globalRegistry) {
    globalRegistry = new TemplateRegistry(storage);
  }
  return globalRegistry;
}

/**
 * Reset global registry (useful for testing)
 */
export function resetGlobalRegistry(): void {
  globalRegistry = null;
}
