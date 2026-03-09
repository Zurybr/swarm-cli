/**
 * Cell - Core unit of work in the Hive system
 *
 * Provides methods for creating, updating, and managing cell lifecycle.
 */

import {
  CellData,
  CellStatus,
  CellType,
  CellHistoryEntry,
  CreateCellOptions,
  UpdateCellOptions,
  VALID_STATUS_TRANSITIONS,
} from './types';

/**
 * Error thrown when cell operations fail
 */
export class CellError extends Error {
  constructor(message: string, public readonly cellId?: string) {
    super(message);
    this.name = 'CellError';
  }
}

/**
 * Error thrown when an invalid status transition is attempted
 */
export class InvalidStatusTransitionError extends CellError {
  constructor(
    public readonly from: CellStatus,
    public readonly to: CellStatus,
    cellId?: string
  ) {
    super(`Invalid status transition from "${from}" to "${to}"`, cellId);
    this.name = 'InvalidStatusTransitionError';
  }
}

/**
 * Generates a unique cell ID
 */
export function generateCellId(type: CellType = 'task'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${type}-${timestamp}-${random}`;
}

/**
 * Cell class representing a unit of work
 */
export class Cell {
  private data: CellData;

  /**
   * Create a new Cell instance from data
   */
  constructor(data: CellData) {
    this.data = { ...data };
  }

  /**
   * Create a new cell with the given options
   */
  static create(options: CreateCellOptions): Cell {
    const now = new Date().toISOString();
    const type = options.type || 'task';
    const id = generateCellId(type);

    const data: CellData = {
      id,
      title: options.title,
      description: options.description,
      status: options.status || 'open',
      type,
      parentId: options.parentId,
      priority: options.priority ?? 0,
      createdAt: now,
      updatedAt: now,
      history: [],
      metadata: options.metadata || {},
      tags: options.tags || [],
      owner: options.owner,
      children: [],
    };

    return new Cell(data);
  }

  /**
   * Rehydrate a cell from stored data
   */
  static fromJSON(json: string | CellData): Cell {
    const data = typeof json === 'string' ? JSON.parse(json) : json;

    // Validate required fields
    if (!data.id) throw new CellError('Cell data missing required field: id');
    if (!data.title) throw new CellError('Cell data missing required field: title');
    if (!data.status) throw new CellError('Cell data missing required field: status');
    if (!data.type) throw new CellError('Cell data missing required field: type');
    if (!data.createdAt) throw new CellError('Cell data missing required field: createdAt');

    // Ensure history array exists
    if (!data.history) data.history = [];

    return new Cell(data as CellData);
  }

  // Getters

  get id(): string {
    return this.data.id;
  }

  get title(): string {
    return this.data.title;
  }

  get description(): string | undefined {
    return this.data.description;
  }

  get status(): CellStatus {
    return this.data.status;
  }

  get type(): CellType {
    return this.data.type;
  }

  get parentId(): string | undefined {
    return this.data.parentId;
  }

  get children(): string[] {
    return [...(this.data.children || [])];
  }

  get priority(): number {
    return this.data.priority ?? 0;
  }

  get createdAt(): string {
    return this.data.createdAt;
  }

  get updatedAt(): string {
    return this.data.updatedAt;
  }

  get history(): CellHistoryEntry[] {
    return [...this.data.history];
  }

  get metadata(): Record<string, unknown> {
    return { ...this.data.metadata };
  }

  get tags(): string[] {
    return [...(this.data.tags || [])];
  }

  get owner(): string | undefined {
    return this.data.owner;
  }

  /**
   * Get the raw cell data
   */
  toData(): CellData {
    return { ...this.data };
  }

  /**
   * Serialize to JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }

  /**
   * Update cell properties
   */
  update(options: UpdateCellOptions, actor?: string): void {
    const now = new Date().toISOString();

    // Handle status change
    if (options.status && options.status !== this.data.status) {
      this.transitionStatus(options.status, options.statusReason, actor);
    }

    // Update other fields
    if (options.title !== undefined) {
      this.data.title = options.title;
    }

    if (options.description !== undefined) {
      this.data.description = options.description;
    }

    if (options.priority !== undefined) {
      this.data.priority = options.priority;
    }

    if (options.metadata !== undefined) {
      this.data.metadata = { ...this.data.metadata, ...options.metadata };
    }

    if (options.tags !== undefined) {
      this.data.tags = [...options.tags];
    }

    if (options.owner !== undefined) {
      this.data.owner = options.owner;
    }

    this.data.updatedAt = now;
  }

  /**
   * Validate if a status transition is allowed
   */
  canTransitionTo(newStatus: CellStatus): boolean {
    const allowedTransitions = VALID_STATUS_TRANSITIONS[this.data.status];
    return allowedTransitions.includes(newStatus);
  }

  /**
   * Transition to a new status with validation
   */
  transitionStatus(newStatus: CellStatus, reason?: string, actor?: string): void {
    if (!this.canTransitionTo(newStatus)) {
      throw new InvalidStatusTransitionError(this.data.status, newStatus, this.data.id);
    }

    const oldStatus = this.data.status;
    this.data.status = newStatus;

    // Record in history
    const entry: CellHistoryEntry = {
      timestamp: new Date().toISOString(),
      from: oldStatus,
      to: newStatus,
      reason,
      actor,
    };

    this.data.history.push(entry);
  }

  /**
   * Add a child cell reference
   */
  addChild(childId: string): void {
    if (!this.data.children) {
      this.data.children = [];
    }

    if (!this.data.children.includes(childId)) {
      this.data.children.push(childId);
      this.data.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Remove a child cell reference
   */
  removeChild(childId: string): void {
    if (this.data.children) {
      const index = this.data.children.indexOf(childId);
      if (index !== -1) {
        this.data.children.splice(index, 1);
        this.data.updatedAt = new Date().toISOString();
      }
    }
  }

  /**
   * Check if this cell is a descendant of another cell
   */
  async isDescendantOf(
    parentId: string,
    getCellFn: (id: string) => Promise<Cell | undefined> | Cell | undefined
  ): Promise<boolean> {
    if (!this.data.parentId) return false;
    if (this.data.parentId === parentId) return true;

    const parent = await getCellFn(this.data.parentId);
    if (!parent) return false;

    return parent.isDescendantOf(parentId, getCellFn);
  }

  /**
   * Clone the cell with optional overrides
   */
  clone(overrides?: Partial<CellData>): Cell {
    const clonedData: CellData = {
      ...this.data,
      id: generateCellId(this.data.type),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
      children: [],
      ...overrides,
    };

    return new Cell(clonedData);
  }
}
