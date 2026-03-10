/**
 * STATE.md Sync
 *
 * Bidirectional synchronization between STATE.md files and the Hive system.
 * Keeps STATE.md and Hive cells in sync.
 */

import { Hive } from '../hive';
import { Cell, CreateCellOptions, UpdateCellOptions, CellData } from '../hive';
import {
  State,
  StateItem,
  StateSection,
  SyncResult,
  SyncDirection,
  SyncConflict,
  StateSectionType,
} from './types';

/**
 * Sync options
 */
export interface SyncOptions {
  /** Sync direction */
  direction?: SyncDirection;
  /** Auto-resolve conflicts (prefer state or hive) */
  conflictResolution?: 'state' | 'hive' | 'manual';
  /** Include only specific sections */
  sections?: StateSectionType[];
  /** Filter by status */
  statusFilter?: string[];
  /** Actor name for history tracking */
  actor?: string;
}

/**
 * Default sync options
 */
const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  direction: 'bidirectional',
  conflictResolution: 'manual',
  actor: 'state-sync',
};

/**
 * Sync STATE.md with Hive
 */
export async function syncWithHive(
  state: State,
  hive: Hive,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const opts = { ...DEFAULT_SYNC_OPTIONS, ...options };
  const timestamp = new Date().toISOString();
  const conflicts: SyncConflict[] = [];
  let syncedToHive = 0;
  let syncedFromHive = 0;

  try {
    // Ensure hive is initialized
    await hive.init();

    // Filter sections if specified
    const sectionsToSync = opts.sections
      ? state.sections.filter(s => opts.sections!.includes(s.type))
      : state.sections;

    // Get all items from STATE.md
    const stateItems = sectionsToSync.flatMap(s => s.items);

    // Filter by status if specified
    const filteredItems = opts.statusFilter
      ? stateItems.filter(item => opts.statusFilter!.includes(item.status))
      : stateItems;

    // Get all cells from Hive
    const hiveCells = await hive.getAllCells();
    const hiveCellMap = new Map(hiveCells.map(c => [c.id, c]));

    // Build state item map
    const stateItemMap = new Map(filteredItems.map(i => [i.id, i]));

    // Detect conflicts and sync based on direction
    if (opts.direction === 'to-hive' || opts.direction === 'bidirectional') {
      for (const item of filteredItems) {
        const existingCell = hiveCellMap.get(item.id);

        if (existingCell) {
          // Check for conflicts
          const conflict = detectConflict(item, existingCell.toData());
          if (conflict) {
            conflicts.push(conflict);

            if (opts.conflictResolution === 'state') {
              // Update Hive with STATE.md values
              await updateCellFromItem(hive, existingCell.id, item, opts.actor);
              syncedToHive++;
            } else if (opts.conflictResolution === 'hive') {
              // Skip - will be handled in from-hive sync
              continue;
            }
            // If manual, don't auto-resolve
          } else {
            // No conflict, update if needed
            await updateCellFromItem(hive, existingCell.id, item, opts.actor);
            syncedToHive++;
          }
        } else {
          // Create new cell in Hive
          await createCellFromItem(hive, item);
          syncedToHive++;
        }
      }
    }

    if (opts.direction === 'from-hive' || opts.direction === 'bidirectional') {
      for (const cell of hiveCells) {
        const cellData = cell.toData();
        const existingItem = stateItemMap.get(cell.id);

        if (existingItem) {
          // Check for conflicts (if not already detected)
          if (opts.direction !== 'bidirectional') {
            const conflict = detectConflict(existingItem, cellData);
            if (conflict) {
              conflicts.push(conflict);

              if (opts.conflictResolution === 'hive') {
                // Update STATE.md item
                updateItemFromCell(existingItem, cellData);
                syncedFromHive++;
              }
              // If manual or state, don't auto-resolve
            } else {
              // No conflict, update if needed
              updateItemFromCell(existingItem, cellData);
              syncedFromHive++;
            }
          }
        } else {
          // Cell exists in Hive but not in STATE.md
          if (opts.direction === 'from-hive' || opts.conflictResolution === 'hive') {
            // Add to state (will need to be inserted into appropriate section)
            syncedFromHive++;
          }
        }
      }
    }

    return {
      success: true,
      direction: opts.direction!,
      syncedToHive,
      syncedFromHive,
      conflicts,
      timestamp,
    };
  } catch (error) {
    return {
      success: false,
      direction: opts.direction!,
      syncedToHive,
      syncedFromHive,
      conflicts,
      error: (error as Error).message,
      timestamp,
    };
  }
}

/**
 * Detect conflict between STATE.md item and Hive cell
 */
function detectConflict(item: StateItem, cellData: CellData): SyncConflict | null {
  const conflicts: Array<{ field: string; stateValue: unknown; hiveValue: unknown }> = [];

  // Check title
  if (item.title !== cellData.title) {
    conflicts.push({ field: 'title', stateValue: item.title, hiveValue: cellData.title });
  }

  // Check status
  if (item.status !== cellData.status) {
    conflicts.push({ field: 'status', stateValue: item.status, hiveValue: cellData.status });
  }

  // Check description
  if (item.title !== cellData.description && cellData.description) {
    // Description might be stored differently, only flag if significantly different
    if (!item.title.includes(cellData.description) && !cellData.description.includes(item.title)) {
      conflicts.push({ field: 'description', stateValue: item.title, hiveValue: cellData.description });
    }
  }

  // Check priority
  if (item.priority !== undefined && cellData.priority !== undefined) {
    const priorityMap: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const itemPriority = priorityMap[item.priority] || 0;
    if (itemPriority !== cellData.priority) {
      conflicts.push({ field: 'priority', stateValue: item.priority, hiveValue: cellData.priority });
    }
  }

  // Check owner
  if (item.owner !== cellData.owner) {
    conflicts.push({ field: 'owner', stateValue: item.owner, hiveValue: cellData.owner });
  }

  // Check parent
  if (item.parentId !== cellData.parentId) {
    conflicts.push({ field: 'parentId', stateValue: item.parentId, hiveValue: cellData.parentId });
  }

  // Check tags
  const itemTags = item.tags || [];
  const cellTags = cellData.tags || [];
  if (JSON.stringify(itemTags.sort()) !== JSON.stringify(cellTags.sort())) {
    conflicts.push({ field: 'tags', stateValue: itemTags, hiveValue: cellTags });
  }

  if (conflicts.length > 0) {
    // Return the first conflict for simplicity
    return {
      itemId: item.id,
      field: conflicts[0].field,
      stateValue: conflicts[0].stateValue,
      hiveValue: conflicts[0].hiveValue,
    };
  }

  return null;
}

/**
 * Create a new Hive cell from STATE.md item
 */
async function createCellFromItem(hive: Hive, item: StateItem): Promise<Cell> {
  const options: CreateCellOptions = {
    id: item.id,
    title: item.title,
    description: item.title, // Use title as description for now
    type: item.type || 'task',
    status: item.status,
    parentId: item.parentId,
    priority: item.priority ? mapPriorityToNumber(item.priority) : 0,
    owner: item.owner,
    tags: item.tags,
    metadata: {
      ...item.metadata,
      stateCreatedAt: item.createdAt,
      stateUpdatedAt: item.updatedAt,
    },
  };

  return hive.createCell(options);
}

/**
 * Update existing Hive cell from STATE.md item
 */
async function updateCellFromItem(
  hive: Hive,
  cellId: string,
  item: StateItem,
  actor?: string
): Promise<Cell> {
  const options: UpdateCellOptions = {
    title: item.title,
    status: item.status,
    parentId: item.parentId,
    priority: item.priority ? mapPriorityToNumber(item.priority) : undefined,
    owner: item.owner,
    tags: item.tags,
    metadata: {
      stateUpdatedAt: item.updatedAt,
      ...item.metadata,
    },
  };

  return hive.updateCell(cellId, options, actor);
}

/**
 * Update STATE.md item from Hive cell data
 */
function updateItemFromCell(item: StateItem, cellData: CellData): void {
  item.title = cellData.title;
  item.status = cellData.status;
  item.type = cellData.type;
  item.priority = mapNumberToPriority(cellData.priority);
  item.owner = cellData.owner;
  item.parentId = cellData.parentId;
  item.tags = cellData.tags || [];
  item.updatedAt = cellData.updatedAt;

  // Extract metadata
  if (cellData.metadata) {
    item.metadata = { ...item.metadata, ...cellData.metadata };
  }
}

/**
 * Map priority string to number
 */
function mapPriorityToNumber(priority: string): number {
  switch (priority) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

/**
 * Map priority number to string
 */
function mapNumberToPriority(priority: number | undefined): 'critical' | 'high' | 'medium' | 'low' | undefined {
  if (priority === undefined) return undefined;
  switch (priority) {
    case 4: return 'critical';
    case 3: return 'high';
    case 2: return 'medium';
    case 1: return 'low';
    default: return undefined;
  }
}

/**
 * Import all Hive cells into a new State object
 */
export async function importFromHive(
  hive: Hive,
  projectName: string,
  options: { sections?: StateSectionType[] } = {}
): Promise<State> {
  await hive.init();

  const cells = await hive.getAllCells();

  // Group cells by status into sections
  const sections: StateSection[] = [];

  const activeItems: StateItem[] = [];
  const completedItems: StateItem[] = [];
  const blockedItems: StateItem[] = [];
  const backlogItems: StateItem[] = [];

  for (const cell of cells) {
    const data = cell.toData();
    const item: StateItem = {
      id: data.id,
      title: data.title,
      status: data.status,
      type: data.type,
      priority: mapNumberToPriority(data.priority),
      owner: data.owner,
      parentId: data.parentId,
      tags: data.tags,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      children: data.children,
      metadata: data.metadata,
    };

    // Categorize by status
    switch (data.status) {
      case 'in_progress':
        activeItems.push(item);
        break;
      case 'completed':
        completedItems.push(item);
        break;
      case 'blocked':
        blockedItems.push(item);
        break;
      case 'open':
      case 'cancelled':
      default:
        backlogItems.push(item);
        break;
    }
  }

  // Add sections with items
  if (activeItems.length > 0) {
    sections.push({ type: 'active', items: activeItems, order: 0 });
  }
  if (blockedItems.length > 0) {
    sections.push({ type: 'blocked', items: blockedItems, order: 1 });
  }
  if (backlogItems.length > 0) {
    sections.push({ type: 'backlog', items: backlogItems, order: 2 });
  }
  if (completedItems.length > 0) {
    sections.push({ type: 'completed', items: completedItems, order: 3 });
  }

  // Sort sections by order
  sections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return {
    frontmatter: {
      version: '1.0',
      project: projectName,
      lastSync: new Date().toISOString(),
      autoGenerated: true,
    },
    sections,
  };
}

/**
 * Export State to Hive cells
 */
export async function exportToHive(
  state: State,
  hive: Hive,
  options: { actor?: string; clearExisting?: boolean } = {}
): Promise<{ created: number; updated: number; errors: string[] }> {
  await hive.init();

  const result = { created: 0, updated: 0, errors: [] as string[] };

  // Optionally clear existing cells
  if (options.clearExisting) {
    const existing = await hive.getAllCells();
    for (const cell of existing) {
      try {
        await hive.deleteCell(cell.id);
      } catch (error) {
        result.errors.push(`Failed to delete cell ${cell.id}: ${(error as Error).message}`);
      }
    }
  }

  // Get existing cells map
  const existingCells = await hive.getAllCells();
  const existingMap = new Map(existingCells.map(c => [c.id, c]));

  // Export all items
  const allItems = state.sections.flatMap(s => s.items);

  for (const item of allItems) {
    try {
      if (existingMap.has(item.id)) {
        await updateCellFromItem(hive, item.id, item, options.actor);
        result.updated++;
      } else {
        await createCellFromItem(hive, item);
        result.created++;
      }
    } catch (error) {
      result.errors.push(`Failed to export item ${item.id}: ${(error as Error).message}`);
    }
  }

  return result;
}

/**
 * Get sync status - compare STATE.md with Hive
 */
export async function getSyncStatus(
  state: State,
  hive: Hive
): Promise<{
  inSync: boolean;
  stateOnly: StateItem[];
  hiveOnly: CellData[];
  divergent: Array<{ item: StateItem; cell: CellData; differences: string[] }>;
}> {
  await hive.init();

  const stateItems = state.sections.flatMap(s => s.items);
  const stateItemMap = new Map(stateItems.map(i => [i.id, i]));

  const hiveCells = await hive.getAllCells();
  const hiveCellMap = new Map(hiveCells.map(c => [c.id, c.toData()]));

  const stateOnly: StateItem[] = [];
  const hiveOnly: CellData[] = [];
  const divergent: Array<{ item: StateItem; cell: CellData; differences: string[] }> = [];

  // Find items only in STATE.md
  for (const item of stateItems) {
    if (!hiveCellMap.has(item.id)) {
      stateOnly.push(item);
    }
  }

  // Find cells only in Hive
  for (const cell of hiveCells) {
    const cellData = cell.toData();
    if (!stateItemMap.has(cellData.id)) {
      hiveOnly.push(cellData);
    }
  }

  // Find divergent items
  for (const item of stateItems) {
    const cellData = hiveCellMap.get(item.id);
    if (cellData) {
      const differences: string[] = [];

      if (item.title !== cellData.title) differences.push('title');
      if (item.status !== cellData.status) differences.push('status');
      if (item.owner !== cellData.owner) differences.push('owner');

      if (differences.length > 0) {
        divergent.push({ item, cell: cellData, differences });
      }
    }
  }

  return {
    inSync: stateOnly.length === 0 && hiveOnly.length === 0 && divergent.length === 0,
    stateOnly,
    hiveOnly,
    divergent,
  };
}
