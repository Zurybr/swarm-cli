/**
 * Storage - File system operations for Hive cells
 *
 * Handles reading/writing cell data to JSON files with atomic operations.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Cell } from './cell';
import {
  CellData,
  StorageConfig,
  DEFAULT_STORAGE_CONFIG,
  StorageResult,
  CellQuery,
} from './types';

/**
 * Error thrown when storage operations fail
 */
export class StorageError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * File-based storage for cells
 */
export class Storage {
  private config: StorageConfig;
  private cellsDir: string;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...DEFAULT_STORAGE_CONFIG, ...config };
    this.cellsDir = path.join(this.config.baseDir, 'cells');
  }

  /**
   * Initialize storage directory structure
   */
  async init(): Promise<void> {
    await this.ensureDir(this.config.baseDir);
    await this.ensureDir(this.cellsDir);
  }

  /**
   * Get the path to a cell file
   */
  private getCellPath(id: string): string {
    // Use first 2 chars of ID as subdirectory for better file distribution
    const prefix = id.substring(0, 2);
    const dir = path.join(this.cellsDir, prefix);
    return path.join(dir, `${id}.json`);
  }

  /**
   * Ensure a directory exists
   */
  private async ensureDir(dir: string): Promise<void> {
    try {
      await fs.promises.mkdir(dir, { recursive: true });
    } catch (error) {
      throw new StorageError(`Failed to create directory: ${dir}`, error as Error);
    }
  }

  /**
   * Write a cell to storage atomically
   */
  async save(cell: Cell): Promise<StorageResult<Cell>> {
    try {
      const cellPath = this.getCellPath(cell.id);
      const dir = path.dirname(cellPath);

      await this.ensureDir(dir);

      const data = cell.toData();
      const json = JSON.stringify(data, null, 2);

      // Write to temp file first, then rename for atomicity
      const tempPath = `${cellPath}.tmp`;
      await fs.promises.writeFile(tempPath, json, 'utf-8');
      await fs.promises.rename(tempPath, cellPath);

      return { success: true, data: cell };
    } catch (error) {
      return {
        success: false,
        error: `Failed to save cell ${cell.id}: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Read a cell from storage
   */
  async load(id: string): Promise<StorageResult<Cell>> {
    try {
      const cellPath = this.getCellPath(id);

      if (!fs.existsSync(cellPath)) {
        return { success: false, error: `Cell not found: ${id}` };
      }

      const json = await fs.promises.readFile(cellPath, 'utf-8');
      const cell = Cell.fromJSON(json);

      return { success: true, data: cell };
    } catch (error) {
      return {
        success: false,
        error: `Failed to load cell ${id}: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Delete a cell from storage
   */
  async delete(id: string): Promise<StorageResult<void>> {
    try {
      const cellPath = this.getCellPath(id);

      if (!fs.existsSync(cellPath)) {
        return { success: false, error: `Cell not found: ${id}` };
      }

      await fs.promises.unlink(cellPath);

      // Try to clean up empty parent directory
      const dir = path.dirname(cellPath);
      try {
        const files = await fs.promises.readdir(dir);
        if (files.length === 0) {
          await fs.promises.rmdir(dir);
        }
      } catch {
        // Ignore cleanup errors
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete cell ${id}: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Check if a cell exists
   */
  async exists(id: string): Promise<boolean> {
    const cellPath = this.getCellPath(id);
    return fs.existsSync(cellPath);
  }

  /**
   * List all cell IDs in storage
   */
  async listAll(): Promise<string[]> {
    const ids: string[] = [];

    try {
      if (!fs.existsSync(this.cellsDir)) {
        return ids;
      }

      const prefixes = await fs.promises.readdir(this.cellsDir);

      for (const prefix of prefixes) {
        const prefixDir = path.join(this.cellsDir, prefix);
        const stat = await fs.promises.stat(prefixDir);

        if (stat.isDirectory()) {
          const files = await fs.promises.readdir(prefixDir);
          for (const file of files) {
            if (file.endsWith('.json')) {
              ids.push(file.replace('.json', ''));
            }
          }
        }
      }

      return ids;
    } catch (error) {
      throw new StorageError('Failed to list cells', error as Error);
    }
  }

  /**
   * Load all cells
   */
  async loadAll(): Promise<Cell[]> {
    const ids = await this.listAll();
    const cells: Cell[] = [];

    for (const id of ids) {
      const result = await this.load(id);
      if (result.success && result.data) {
        cells.push(result.data);
      }
    }

    return cells;
  }

  /**
   * Query cells with filters
   */
  async query(query: CellQuery = {}): Promise<Cell[]> {
    let cells = await this.loadAll();

    // Filter by status
    if (query.status !== undefined) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status];
      cells = cells.filter(c => statuses.includes(c.status));
    }

    // Filter by type
    if (query.type !== undefined) {
      const types = Array.isArray(query.type) ? query.type : [query.type];
      cells = cells.filter(c => types.includes(c.type));
    }

    // Filter by parent
    if (query.parentId !== undefined) {
      if (query.parentId === null) {
        cells = cells.filter(c => c.parentId === undefined);
      } else {
        cells = cells.filter(c => c.parentId === query.parentId);
      }
    }

    // Filter by owner
    if (query.owner !== undefined) {
      cells = cells.filter(c => c.owner === query.owner);
    }

    // Filter by tags (must have all specified tags)
    if (query.tags !== undefined && query.tags.length > 0) {
      cells = cells.filter(c => {
        const cellTags = c.tags || [];
        return query.tags!.every(tag => cellTags.includes(tag));
      });
    }

    // Filter by minimum priority
    if (query.minPriority !== undefined) {
      cells = cells.filter(c => (c.priority ?? 0) >= query.minPriority!);
    }

    // Sort by priority (descending), then by creation date (ascending)
    cells.sort((a, b) => {
      const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Apply limit
    if (query.limit !== undefined && query.limit > 0) {
      cells = cells.slice(0, query.limit);
    }

    return cells;
  }

  /**
   * Get the next ready cell (highest priority, oldest, not blocked)
   */
  async getNextReady(): Promise<Cell | undefined> {
    const cells = await this.query({
      status: 'open',
    });

    return cells[0];
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  }> {
    const cells = await this.loadAll();

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const cell of cells) {
      byStatus[cell.status] = (byStatus[cell.status] || 0) + 1;
      byType[cell.type] = (byType[cell.type] || 0) + 1;
    }

    return {
      total: cells.length,
      byStatus,
      byType,
    };
  }

  /**
   * Clear all cells (use with caution)
   */
  async clear(): Promise<void> {
    try {
      if (fs.existsSync(this.cellsDir)) {
        await fs.promises.rm(this.cellsDir, { recursive: true, force: true });
        await this.ensureDir(this.cellsDir);
      }
    } catch (error) {
      throw new StorageError('Failed to clear storage', error as Error);
    }
  }

  /**
   * Get the base directory path
   */
  getBaseDir(): string {
    return this.config.baseDir;
  }

  /**
   * Get the cells directory path
   */
  getCellsDir(): string {
    return this.cellsDir;
  }
}
