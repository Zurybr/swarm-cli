/**
 * Hive - Git-backed persistence system for coordinating AI agent swarms
 *
 * A Cell/Bead-based system for tracking units of work with automatic
 * git versioning and rollback capability.
 *
 * @example
 * ```typescript
 * import { Hive, Cell } from './hive';
 *
 * const hive = new Hive({ baseDir: '.hive' });
 * await hive.init();
 *
 * // Create a cell
 * const cell = await hive.createCell({
 *   title: 'Implement feature X',
 *   type: 'task',
 *   priority: 1
 * });
 *
 * // Update status
 * await hive.updateCell(cell.id, { status: 'in_progress' });
 *
 * // Query cells
 * const openTasks = await hive.query({ status: 'open', type: 'task' });
 * ```
 */

// Core classes
export { Cell, CellError, InvalidStatusTransitionError, generateCellId } from './cell';
export { Storage, StorageError } from './storage';
export { GitSync, GitSyncError } from './git-sync';

// Types
export type {
  CellData,
  CellStatus,
  CellType,
  CellHistoryEntry,
  CreateCellOptions,
  UpdateCellOptions,
  StorageConfig,
  StorageResult,
  GitSyncResult,
  CellQuery,
} from './types';

export { VALID_STATUS_TRANSITIONS, DEFAULT_STORAGE_CONFIG } from './types';

import { Storage } from './storage';
import { GitSync } from './git-sync';
import { Cell, CellError } from './cell';
import {
  StorageConfig,
  CreateCellOptions,
  UpdateCellOptions,
  CellQuery,
  CellData,
  DEFAULT_STORAGE_CONFIG,
} from './types';

/**
 * Main Hive class - provides high-level API for cell management
 */
export class Hive {
  private storage: Storage;
  private gitSync: GitSync;
  private config: StorageConfig;
  private initialized: boolean = false;

  constructor(config: Partial<StorageConfig> = {}, projectRoot?: string) {
    this.config = { ...DEFAULT_STORAGE_CONFIG, ...config };
    this.storage = new Storage(this.config);
    this.gitSync = new GitSync(this.config, projectRoot);
  }

  /**
   * Initialize the hive system
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    await this.storage.init();
    await this.gitSync.init();

    this.initialized = true;
  }

  /**
   * Ensure hive is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new CellError('Hive not initialized. Call init() first.');
    }
  }

  /**
   * Create a new cell
   */
  async createCell(options: CreateCellOptions): Promise<Cell> {
    this.ensureInitialized();

    const cell = Cell.create(options);

    // Save to storage
    const result = await this.storage.save(cell);
    if (!result.success) {
      throw new CellError(result.error || 'Failed to create cell');
    }

    // If parentId is specified, add this cell to parent's children
    if (options.parentId) {
      const parent = await this.getCell(options.parentId);
      if (parent) {
        parent.addChild(cell.id);
        await this.storage.save(parent);
      }
    }

    // Auto-commit if enabled
    if (this.config.autoCommit) {
      await this.gitSync.commit(cell, 'create');
    }

    return cell;
  }

  /**
   * Get a cell by ID
   */
  async getCell(id: string): Promise<Cell | undefined> {
    this.ensureInitialized();

    const result = await this.storage.load(id);
    if (!result.success) return undefined;

    return result.data;
  }

  /**
   * Get a cell by ID (throws if not found)
   */
  async requireCell(id: string): Promise<Cell> {
    const cell = await this.getCell(id);
    if (!cell) {
      throw new CellError(`Cell not found: ${id}`);
    }
    return cell;
  }

  /**
   * Update a cell
   */
  async updateCell(
    id: string,
    options: UpdateCellOptions,
    actor?: string
  ): Promise<Cell> {
    this.ensureInitialized();

    const cell = await this.requireCell(id);
    cell.update(options, actor);

    const result = await this.storage.save(cell);
    if (!result.success) {
      throw new CellError(result.error || 'Failed to update cell');
    }

    // Auto-commit if enabled
    if (this.config.autoCommit) {
      await this.gitSync.commit(cell, 'update');
    }

    return cell;
  }

  /**
   * Delete a cell
   */
  async deleteCell(id: string): Promise<void> {
    this.ensureInitialized();

    const cell = await this.requireCell(id);

    const result = await this.storage.delete(id);
    if (!result.success) {
      throw new CellError(result.error || 'Failed to delete cell');
    }

    // Auto-commit if enabled
    if (this.config.autoCommit) {
      await this.gitSync.commit(cell, 'delete');
    }
  }

  /**
   * Query cells with filters
   */
  async query(query: CellQuery = {}): Promise<Cell[]> {
    this.ensureInitialized();
    return this.storage.query(query);
  }

  /**
   * Get the next ready cell (highest priority open cell)
   */
  async getNextReady(): Promise<Cell | undefined> {
    this.ensureInitialized();
    return this.storage.getNextReady();
  }

  /**
   * Get all cells
   */
  async getAllCells(): Promise<Cell[]> {
    this.ensureInitialized();
    return this.storage.loadAll();
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  }> {
    this.ensureInitialized();
    return this.storage.getStats();
  }

  /**
   * Transition cell status
   */
  async transitionStatus(
    id: string,
    newStatus: CellData['status'],
    reason?: string,
    actor?: string
  ): Promise<Cell> {
    return this.updateCell(id, { status: newStatus, statusReason: reason }, actor);
  }

  /**
   * Add a child cell to a parent
   */
  async addChild(parentId: string, childId: string): Promise<void> {
    this.ensureInitialized();

    const parent = await this.requireCell(parentId);
    const child = await this.requireCell(childId);

    // Check for circular reference
    const getCell = async (id: string): Promise<Cell | undefined> => {
      const result = await this.storage.load(id);
      return result.success ? result.data : undefined;
    };

    if (await parent.isDescendantOf(childId, getCell)) {
      throw new CellError('Cannot add child: would create circular reference');
    }

    parent.addChild(childId);
    await this.storage.save(parent);

    // Update child's parent reference
    if (child.parentId !== parentId) {
      await this.updateCell(childId, { parentId: parentId });
    }

    // Auto-commit if enabled
    if (this.config.autoCommit) {
      await this.gitSync.commit(parent, 'update', `hive(${parentId}): add child ${childId}`);
    }
  }

  /**
   * Remove a child from a parent
   */
  async removeChild(parentId: string, childId: string): Promise<void> {
    this.ensureInitialized();

    const parent = await this.requireCell(parentId);
    parent.removeChild(childId);
    await this.storage.save(parent);

    // Clear child's parent reference
    const child = await this.getCell(childId);
    if (child && child.parentId === parentId) {
      await this.updateCell(childId, { parentId: undefined });
    }
  }

  /**
   * Get children of a cell
   */
  async getChildren(parentId: string): Promise<Cell[]> {
    this.ensureInitialized();

    const parent = await this.requireCell(parentId);
    const children: Cell[] = [];

    for (const childId of parent.children) {
      const child = await this.getCell(childId);
      if (child) {
        children.push(child);
      }
    }

    return children;
  }

  /**
   * Get the full tree of a cell (including all descendants)
   */
  async getCellTree(rootId: string): Promise<{ cell: Cell; children: Cell[] }> {
    this.ensureInitialized();

    const root = await this.requireCell(rootId);
    const children = await this.getChildren(rootId);

    return { cell: root, children };
  }

  /**
   * Clone a cell
   */
  async cloneCell(id: string, overrides?: Partial<CellData>): Promise<Cell> {
    this.ensureInitialized();

    const original = await this.requireCell(id);
    const cloned = original.clone(overrides);

    const result = await this.storage.save(cloned);
    if (!result.success) {
      throw new CellError(result.error || 'Failed to clone cell');
    }

    // Auto-commit if enabled
    if (this.config.autoCommit) {
      await this.gitSync.commit(cloned, 'create', `hive(${cloned.id}): clone of ${id}`);
    }

    return cloned;
  }

  /**
   * Get git status
   */
  async getGitStatus(): Promise<{
    isRepo: boolean;
    enabled: boolean;
    hasChanges: boolean;
    currentBranch?: string;
  }> {
    return this.gitSync.getStatus();
  }

  /**
   * Manually commit current changes
   */
  async commit(message?: string): Promise<{ success: boolean; commitHash?: string; error?: string }> {
    this.ensureInitialized();

    const result = await this.gitSync.stageChanges();
    if (!result.success) {
      return result;
    }

    // Check if there are changes to commit
    const hasChanges = await this.gitSync.hasChanges();
    if (!hasChanges) {
      return { success: true };
    }

    // Use a generic commit if no specific cell
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const commitMsg = message || 'hive: update cells';
      // Properly quote the message to handle special characters
      const quotedMsg = commitMsg.replace(/"/g, '\\"');
      await execAsync(`git commit -m "${quotedMsg}" --no-verify`, {
        cwd: this.config.baseDir,
      });

      const { stdout } = await execAsync('git rev-parse HEAD', { cwd: this.config.baseDir });
      return { success: true, commitHash: stdout.trim() };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Rollback to a previous commit
   */
  async rollback(commitHash: string): Promise<{ success: boolean; error?: string }> {
    return this.gitSync.rollback(commitHash);
  }

  /**
   * Clear all cells (use with caution)
   */
  async clear(): Promise<void> {
    this.ensureInitialized();
    await this.storage.clear();
  }

  /**
   * Close the hive (cleanup)
   */
  async close(): Promise<void> {
    this.initialized = false;
  }
}

// Hivemind Memory System - Issue #26
export { Hivemind } from './hivemind';
export { 
  OllamaEmbeddingBackend, 
  OpenAIEmbeddingBackend, 
  FullTextSearchBackend,
  createEmbeddingBackend,
  cosineSimilarity 
} from './embedding-backends';

export default Hive;
