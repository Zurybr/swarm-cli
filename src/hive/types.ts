/**
 * Hive - Git-backed persistence system for tracking units of work
 *
 * Core types and interfaces for the Cell/Bead structure.
 */

/**
 * Status values for a cell in the workflow
 */
export type CellStatus =
  | 'open'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'cancelled';

/**
 * Type of cell - indicates the scope/purpose
 */
export type CellType =
  | 'epic'
  | 'task'
  | 'subtask'
  | 'bug'
  | 'feature'
  | 'research';

/**
 * History entry for tracking status changes
 */
export interface CellHistoryEntry {
  /** Timestamp of the change */
  timestamp: string;
  /** Previous status */
  from: CellStatus;
  /** New status */
  to: CellStatus;
  /** Optional reason for the change */
  reason?: string;
  /** Who/what made the change */
  actor?: string;
}

/**
 * Core cell data structure
 */
export interface CellData {
  /** Unique identifier for the cell */
  id: string;
  /** Short title/summary */
  title: string;
  /** Detailed description */
  description?: string;
  /** Current status in workflow */
  status: CellStatus;
  /** Type of cell */
  type: CellType;
  /** Parent cell ID (for hierarchical relationships) */
  parentId?: string;
  /** Child cell IDs */
  children?: string[];
  /** Priority level (higher = more important) */
  priority?: number;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
  /** Status change history */
  history: CellHistoryEntry[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Tags for categorization */
  tags?: string[];
  /** Assigned owner/agent */
  owner?: string;
}

/**
 * Options for creating a new cell
 */
export interface CreateCellOptions {
  title: string;
  description?: string;
  type?: CellType;
  status?: CellStatus;
  parentId?: string;
  priority?: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
  owner?: string;
}

/**
 * Options for updating a cell
 */
export interface UpdateCellOptions {
  title?: string;
  description?: string;
  status?: CellStatus;
  priority?: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
  owner?: string;
  /** Reason for status change (if status is being updated) */
  statusReason?: string;
}

/**
 * Valid status transitions
 * Key: current status, Value: array of allowed next statuses
 */
export const VALID_STATUS_TRANSITIONS: Record<CellStatus, CellStatus[]> = {
  open: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['completed', 'blocked', 'open', 'cancelled'],
  completed: ['open'],
  blocked: ['open', 'in_progress', 'cancelled'],
  cancelled: ['open'],
};

/**
 * Storage configuration options
 */
export interface StorageConfig {
  /** Base directory for hive storage (default: .hive) */
  baseDir: string;
  /** Enable git integration */
  enableGit: boolean;
  /** Git commit message template */
  commitMessageTemplate?: string;
  /** Auto-commit on changes */
  autoCommit: boolean;
}

/**
 * Default storage configuration
 */
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  baseDir: '.hive',
  enableGit: true,
  autoCommit: true,
  commitMessageTemplate: 'hive({id}): {action} {title}',
};

/**
 * Result of a storage operation
 */
export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Git operation result
 */
export interface GitSyncResult {
  success: boolean;
  commitHash?: string;
  error?: string;
}

/**
 * Query filters for finding cells
 */
export interface CellQuery {
  status?: CellStatus | CellStatus[];
  type?: CellType | CellType[];
  parentId?: string | null;
  owner?: string;
  tags?: string[];
  /** Filter by priority >= this value */
  minPriority?: number;
  /** Limit number of results */
  limit?: number;
}
