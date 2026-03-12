/**
 * TypeScript types for Kanban board data structures
 */

/**
 * Kanban column status types
 */
export type KanbanStatus = 'backlog' | 'in_progress' | 'review' | 'done';

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Individual task card data
 */
export interface KanbanTask {
  id: string;
  issueNumber: number;
  title: string;
  status: KanbanStatus;
  priority?: TaskPriority;
  assignee?: string;
  labels?: string[];
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Column configuration
 */
export interface KanbanColumn {
  id: KanbanStatus;
  title: string;
  statusIcon: string;
  color: string;
  tasks: KanbanTask[];
}

/**
 * Navigation position within the board
 */
export interface KanbanPosition {
  columnIndex: number;
  taskIndex: number; // -1 means no task selected (column header selected)
}

/**
 * Board layout dimensions
 */
export interface KanbanLayout {
  columnWidth: number;
  maxVisibleTasks: number;
  showTaskCount: boolean;
}

/**
 * Keyboard action types
 */
export type KanbanAction = 
  | 'move_left'
  | 'move_right'
  | 'move_up'
  | 'move_down'
  | 'select_task'
  | 'view_details'
  | 'move_task'
  | 'refresh'
  | 'escape';

/**
 * Kanban board state
 */
export interface KanbanState {
  columns: KanbanColumn[];
  position: KanbanPosition;
  isLoading: boolean;
  error?: string;
  selectedTaskForMove?: KanbanTask;
}

/**
 * Kanban board actions
 */
export interface KanbanActions {
  moveLeft: () => void;
  moveRight: () => void;
  moveUp: () => void;
  moveDown: () => void;
  selectCurrentTask: () => void;
  viewTaskDetails: (task: KanbanTask) => void;
  startMoveTask: () => void;
  completeMoveTask: (targetStatus: KanbanStatus) => void;
  cancelMoveTask: () => void;
  refresh: () => Promise<void>;
  setColumns: (columns: KanbanColumn[]) => void;
}

/**
 * Hook return type
 */
export interface UseKanbanReturn extends KanbanState, KanbanActions {
  currentTask: KanbanTask | null;
  currentColumn: KanbanColumn | null;
  isMovingTask: boolean;
}

/**
 * Column display configuration
 */
export const COLUMN_CONFIG: Record<KanbanStatus, Omit<KanbanColumn, 'tasks'>> = {
  backlog: {
    id: 'backlog',
    title: 'Backlog',
    statusIcon: '📋',
    color: '#6C757D', // muted gray
  },
  in_progress: {
    id: 'in_progress',
    title: 'In Progress',
    statusIcon: '🔄',
    color: '#4ECDC4', // teal - secondary
  },
  review: {
    id: 'review',
    title: 'Review',
    statusIcon: '👀',
    color: '#FFC107', // yellow - warning
  },
  done: {
    id: 'done',
    title: 'Done',
    statusIcon: '✓',
    color: '#28A745', // green - success
  },
};

/**
 * Status icons for task cards
 */
export const STATUS_ICONS: Record<KanbanStatus, string> = {
  backlog: '📋',
  in_progress: '🔄',
  review: '👀',
  done: '✓',
};

/**
 * Priority indicators
 */
export const PRIORITY_ICONS: Record<TaskPriority, string> = {
  low: '◇',
  medium: '◆',
  high: '⬥',
  urgent: '⚠',
};
