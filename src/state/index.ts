/**
 * STATE.md - Project State Single Source of Truth
 *
 * Main StateManager class for managing project state through STATE.md files.
 * Provides bidirectional sync with the Hive system.
 *
 * @example
 * ```typescript
 * import { StateManager } from './state';
 *
 * const manager = new StateManager({
 *   stateFilePath: './STATE.md',
 *   hiveConfig: { baseDir: '.hive' }
 * });
 *
 * await manager.init();
 *
 * // Load existing state or create from Hive
 * const state = await manager.load();
 *
 * // Make changes
 * state.sections[0].items.push(newItem);
 *
 * // Save and sync
 * await manager.save(state);
 * await manager.sync({ direction: 'to-hive' });
 * ```
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Hive } from '../hive';
import {
  State,
  StateItem,
  StateSection,
  StateManagerConfig,
  ValidationResult,
  SyncResult,
  SyncDirection,
  StateStats,
  StateDiff,
  ExportFormat,
  DEFAULT_STATE_CONFIG,
} from './types';
import { parseState, serializeState, ParseError, extractAllItems, findItemById, upsertItem, removeItem } from './parser';
import { validateState, isValid, validateOrThrow, formatValidationResult, ValidatorOptions } from './validator';
import { syncWithHive, importFromHive, exportToHive, getSyncStatus, SyncOptions } from './sync';

// Re-export types
export * from './types';
export { parseState, serializeState, ParseError } from './parser';
export { validateState, isValid, validateOrThrow, formatValidationResult } from './validator';
export { syncWithHive, importFromHive, exportToHive, getSyncStatus } from './sync';

/**
 * Error thrown when state operations fail
 */
export class StateManagerError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'StateManagerError';
  }
}

/**
 * Main StateManager class
 */
export class StateManager {
  private config: StateManagerConfig;
  private hive: Hive;
  private currentState: State | null = null;
  private initialized = false;

  constructor(config: Partial<StateManagerConfig> = {}, projectRoot?: string) {
    this.config = { ...DEFAULT_STATE_CONFIG, ...config };
    this.hive = new Hive(this.config.hiveConfig, projectRoot);
  }

  /**
   * Initialize the state manager
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.hive.init();
      this.initialized = true;
    } catch (error) {
      throw new StateManagerError('Failed to initialize StateManager', error as Error);
    }
  }

  /**
   * Ensure manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new StateManagerError('StateManager not initialized. Call init() first.');
    }
  }

  /**
   * Load STATE.md from disk
   * If file doesn't exist, imports from Hive
   */
  async load(): Promise<State> {
    this.ensureInitialized();

    try {
      const content = await fs.readFile(this.config.stateFilePath, 'utf-8');
      this.currentState = parseState(content);
      return this.currentState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, import from Hive
        const projectName = path.basename(process.cwd());
        this.currentState = await importFromHive(this.hive, projectName);
        return this.currentState;
      }
      throw new StateManagerError(`Failed to load state from ${this.config.stateFilePath}`, error as Error);
    }
  }

  /**
   * Load STATE.md from disk (throws if not found)
   */
  async loadOrThrow(): Promise<State> {
    this.ensureInitialized();

    const content = await fs.readFile(this.config.stateFilePath, 'utf-8');
    this.currentState = parseState(content);
    return this.currentState;
  }

  /**
   * Check if STATE.md exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.config.stateFilePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save state to STATE.md
   */
  async save(state: State): Promise<void> {
    this.ensureInitialized();

    // Validate before saving
    const validation = validateState(state, {
      strict: this.config.validation?.requireAllFields,
    });
    if (!validation.valid) {
      const errorCount = validation.issues.filter(i => i.severity === 'error').length;
      throw new StateManagerError(
        `Cannot save invalid state: ${errorCount} validation error(s). Use validate() to see details.`
      );
    }

    try {
      const content = serializeState(state);
      await fs.mkdir(path.dirname(this.config.stateFilePath), { recursive: true });
      await fs.writeFile(this.config.stateFilePath, content, 'utf-8');
      this.currentState = state;
    } catch (error) {
      throw new StateManagerError(`Failed to save state to ${this.config.stateFilePath}`, error as Error);
    }
  }

  /**
   * Create a new STATE.md file from template
   */
  async create(projectName: string, template?: Partial<State>): Promise<State> {
    this.ensureInitialized();

    const state: State = {
      frontmatter: {
        version: '1.0',
        project: projectName,
        lastSync: new Date().toISOString(),
        autoGenerated: false,
        ...template?.frontmatter,
      },
      sections: template?.sections || [
        { type: 'overview', items: [], order: 0 },
        { type: 'active', items: [], order: 1 },
        { type: 'blocked', items: [], order: 2 },
        { type: 'backlog', items: [], order: 3 },
        { type: 'completed', items: [], order: 4 },
      ],
    };

    await this.save(state);
    return state;
  }

  /**
   * Get current state (loads if not already loaded)
   */
  async getState(): Promise<State> {
    if (this.currentState) {
      return this.currentState;
    }
    return this.load();
  }

  /**
   * Validate current state
   */
  async validate(options?: ValidatorOptions): Promise<ValidationResult> {
    const state = await this.getState();
    return validateState(state, { ...this.config.validation, ...options });
  }

  /**
   * Sync with Hive
   */
  async sync(options?: SyncOptions): Promise<SyncResult> {
    this.ensureInitialized();

    const state = await this.getState();
    const result = await syncWithHive(state, this.hive, options);

    // Update lastSync timestamp
    if (result.success && this.currentState) {
      this.currentState.frontmatter.lastSync = result.timestamp;
      if (this.config.autoSync) {
        await this.save(this.currentState);
      }
    }

    return result;
  }

  /**
   * Import all cells from Hive into STATE.md
   */
  async importFromHive(projectName?: string): Promise<State> {
    this.ensureInitialized();

    const name = projectName || this.currentState?.frontmatter.project || path.basename(process.cwd());
    this.currentState = await importFromHive(this.hive, name);

    if (this.config.autoSync) {
      await this.save(this.currentState);
    }

    return this.currentState;
  }

  /**
   * Export all items to Hive
   */
  async exportToHive(options?: { actor?: string; clearExisting?: boolean }): Promise<{ created: number; updated: number; errors: string[] }> {
    this.ensureInitialized();

    const state = await this.getState();
    return exportToHive(state, this.hive, options);
  }

  /**
   * Get sync status between STATE.md and Hive
   */
  async getSyncStatus(): Promise<{
    inSync: boolean;
    stateOnly: StateItem[];
    hiveOnly: import('../hive/types').CellData[];
    divergent: Array<{ item: StateItem; cell: import('../hive/types').CellData; differences: string[] }>;
  }> {
    this.ensureInitialized();

    const state = await this.getState();
    return getSyncStatus(state, this.hive);
  }

  /**
   * Add a new item to the state
   */
  async addItem(item: StateItem, sectionType?: string): Promise<State> {
    const state = await this.getState();

    // Determine which section to add to
    const targetSection = sectionType
      ? state.sections.find(s => s.type === sectionType || s.title === sectionType)
      : this.inferSectionFromStatus(state, item.status);

    if (targetSection) {
      targetSection.items.push(item);
    } else {
      // Add to first section or create backlog
      if (state.sections.length > 0) {
        state.sections[0].items.push(item);
      } else {
        state.sections.push({ type: 'backlog', items: [item], order: 0 });
      }
    }

    if (this.config.autoSync) {
      await this.save(state);
    }

    return state;
  }

  /**
   * Update an existing item
   */
  async updateItem(id: string, updates: Partial<StateItem>): Promise<StateItem | null> {
    const state = await this.getState();

    for (const section of state.sections) {
      const item = section.items.find(i => i.id === id);
      if (item) {
        Object.assign(item, updates);
        item.updatedAt = new Date().toISOString();

        if (this.config.autoSync) {
          await this.save(state);
        }

        return item;
      }
    }

    return null;
  }

  /**
   * Remove an item from the state
   */
  async removeItem(id: string): Promise<boolean> {
    const state = await this.getState();
    let removed = false;

    for (const section of state.sections) {
      const index = section.items.findIndex(i => i.id === id);
      if (index !== -1) {
        section.items.splice(index, 1);
        removed = true;
        break;
      }
    }

    if (removed && this.config.autoSync) {
      await this.save(state);
    }

    return removed;
  }

  /**
   * Find item by ID
   */
  async findItem(id: string): Promise<StateItem | undefined> {
    const state = await this.getState();
    return findItemById(state, id);
  }

  /**
   * Move item to a different section
   */
  async moveItem(id: string, targetSectionType: string): Promise<boolean> {
    const state = await this.getState();

    // Find the item
    let item: StateItem | undefined;
    let sourceSection: StateSection | undefined;

    for (const section of state.sections) {
      const found = section.items.find(i => i.id === id);
      if (found) {
        item = found;
        sourceSection = section;
        break;
      }
    }

    if (!item || !sourceSection) {
      return false;
    }

    // Find target section
    const targetSection = state.sections.find(
      s => s.type === targetSectionType || s.title === targetSectionType
    );

    if (!targetSection || targetSection === sourceSection) {
      return false;
    }

    // Remove from source
    const index = sourceSection.items.findIndex(i => i.id === id);
    if (index !== -1) {
      sourceSection.items.splice(index, 1);
    }

    // Add to target
    targetSection.items.push(item);

    if (this.config.autoSync) {
      await this.save(state);
    }

    return true;
  }

  /**
   * Get state statistics
   */
  async getStats(): Promise<StateStats> {
    const state = await this.getState();
    const allItems = extractAllItems(state);

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const bySection: Record<string, number> = {};
    const byOwner: Record<string, number> = {};

    let lastUpdated: string | null = null;

    for (const item of allItems) {
      // Count by status
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;

      // Count by type
      if (item.type) {
        byType[item.type] = (byType[item.type] || 0) + 1;
      }

      // Count by owner
      if (item.owner) {
        byOwner[item.owner] = (byOwner[item.owner] || 0) + 1;
      }

      // Track last updated
      if (item.updatedAt) {
        if (!lastUpdated || item.updatedAt > lastUpdated) {
          lastUpdated = item.updatedAt;
        }
      }
    }

    // Count by section
    for (const section of state.sections) {
      const key = section.title || section.type;
      bySection[key] = section.items.length;
    }

    return {
      total: allItems.length,
      byStatus,
      byType,
      bySection,
      byOwner,
      lastUpdated,
    };
  }

  /**
   * Get diff between current state and another state
   */
  async diff(otherState: State): Promise<StateDiff> {
    const state = await this.getState();
    const currentItems = extractAllItems(state);
    const otherItems = extractAllItems(otherState);

    const currentMap = new Map(currentItems.map(i => [i.id, i]));
    const otherMap = new Map(otherItems.map(i => [i.id, i]));

    const added: StateItem[] = [];
    const removed: StateItem[] = [];
    const modified: StateDiff['modified'] = [];
    const unchanged: StateItem[] = [];

    // Find added and modified
    for (const [id, item] of otherMap) {
      const current = currentMap.get(id);
      if (!current) {
        added.push(item);
      } else {
        const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

        // Compare key fields
        const fields: Array<keyof StateItem> = ['title', 'status', 'type', 'priority', 'owner'];
        for (const field of fields) {
          if (current[field] !== item[field]) {
            changes.push({
              field,
              oldValue: current[field],
              newValue: item[field],
            });
          }
        }

        if (changes.length > 0) {
          modified.push({ item, changes });
        } else {
          unchanged.push(item);
        }
      }
    }

    // Find removed
    for (const [id, item] of currentMap) {
      if (!otherMap.has(id)) {
        removed.push(item);
      }
    }

    return { added, removed, modified, unchanged };
  }

  /**
   * Export state to different formats
   */
  async export(format: ExportFormat): Promise<string> {
    const state = await this.getState();

    switch (format) {
      case 'json':
        return JSON.stringify(state, null, 2);

      case 'yaml':
        // Use the serializeState which outputs YAML frontmatter + markdown
        return serializeState(state);

      case 'markdown':
        return serializeState(state);

      case 'csv':
        return exportToCsv(state);

      default:
        throw new StateManagerError(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Archive completed items to a separate file
   */
  async archive(completedBefore?: Date): Promise<{ archived: number; filePath: string }> {
    const state = await this.getState();
    const cutoff = completedBefore || new Date();
    cutoff.setDate(cutoff.getDate() - 30); // Default: archive items completed > 30 days ago

    const archived: StateItem[] = [];
    let archivedCount = 0;

    for (const section of state.sections) {
      const remaining: StateItem[] = [];

      for (const item of section.items) {
        if (
          item.status === 'completed' &&
          item.completedAt &&
          new Date(item.completedAt) < cutoff
        ) {
          archived.push(item);
          archivedCount++;
        } else {
          remaining.push(item);
        }
      }

      section.items = remaining;
    }

    if (archivedCount > 0) {
      // Save archive file
      const archiveFileName = `STATE-archive-${new Date().toISOString().split('T')[0]}.md`;
      const archivePath = path.join(path.dirname(this.config.stateFilePath), archiveFileName);

      const archiveState: State = {
        frontmatter: {
          version: '1.0',
          project: `${state.frontmatter.project}-archive`,
          lastSync: new Date().toISOString(),
          autoGenerated: true,
        },
        sections: [{ type: 'completed', items: archived, order: 0 }],
      };

      await fs.writeFile(archivePath, serializeState(archiveState), 'utf-8');

      // Save updated state
      await this.save(state);

      return { archived: archivedCount, filePath: archivePath };
    }

    return { archived: 0, filePath: '' };
  }

  /**
   * Infer section from status
   */
  private inferSectionFromStatus(state: State, status: string): StateSection | undefined {
    switch (status) {
      case 'in_progress':
        return state.sections.find(s => s.type === 'active');
      case 'completed':
        return state.sections.find(s => s.type === 'completed');
      case 'blocked':
        return state.sections.find(s => s.type === 'blocked');
      case 'open':
      default:
        return state.sections.find(s => s.type === 'backlog');
    }
  }

  /**
   * Get the Hive instance
   */
  getHive(): Hive {
    return this.hive;
  }

  /**
   * Get configuration
   */
  getConfig(): StateManagerConfig {
    return { ...this.config };
  }

  /**
   * Close the state manager
   */
  async close(): Promise<void> {
    this.initialized = false;
    this.currentState = null;
    await this.hive.close();
  }

  // ==================== Backup & Restore ====================

  /**
   * Create a backup of current STATE.md
   */
  async backup(customPath?: string): Promise<string> {
    this.ensureInitialized();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = customPath || this.config.stateFilePath.replace(/\.md$/, `.backup-${timestamp}.md`);

    try {
      await fs.copyFile(this.config.stateFilePath, backupPath);
      return backupPath;
    } catch (error) {
      throw new StateManagerError(`Failed to create backup at ${backupPath}`, error as Error);
    }
  }

  /**
   * Restore state from a backup file
   */
  async restore(backupPath: string): Promise<void> {
    this.ensureInitialized();

    try {
      const content = await fs.readFile(backupPath, 'utf-8');
      const state = parseState(content);
      await this.save(state);
    } catch (error) {
      throw new StateManagerError(`Failed to restore from ${backupPath}`, error as Error);
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<Array<{ path: string; created: Date; size: number }>> {
    this.ensureInitialized();

    const dir = path.dirname(this.config.stateFilePath);
    const basename = path.basename(this.config.stateFilePath, '.md');

    try {
      const files = await fs.readdir(dir);
      const backupRegex = new RegExp(`^${basename}\\.backup-.+\\.md$`);

      const backups: Array<{ path: string; created: Date; size: number }> = [];

      for (const file of files) {
        if (backupRegex.test(file)) {
          const filePath = path.join(dir, file);
          const stat = await fs.stat(filePath);
          backups.push({
            path: filePath,
            created: stat.mtime,
            size: stat.size,
          });
        }
      }

      return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw new StateManagerError('Failed to list backups', error as Error);
    }
  }
}

/**
 * Export state to CSV format
 */
function exportToCsv(state: State): string {
  const items = extractAllItems(state);
  const headers = ['id', 'title', 'status', 'type', 'priority', 'owner', 'createdAt', 'updatedAt'];

  const lines: string[] = [headers.join(',')];

  for (const item of items) {
    const values = headers.map(h => {
      const value = item[h as keyof StateItem];
      if (value === undefined || value === null) return '';
      if (Array.isArray(value)) return `"${value.join(', ')}"`;
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

export default StateManager;
