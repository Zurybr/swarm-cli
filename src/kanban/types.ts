/**
 * Kanban Visualization Types
 * Unified types for CLI, Web, and Terminal rendering
 */

export type CardStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type CardPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Card {
  id: string;
  title: string;
  description?: string;
  status: CardStatus;
  priority: CardPriority;
  assignee?: string;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  metadata?: Record<string, unknown>;
}

export interface Column {
  id: string;
  title: string;
  status: CardStatus;
  cards: Card[];
  wipLimit?: number;
  order: number;
}

export interface Board {
  id: string;
  title: string;
  description?: string;
  columns: Column[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Filter {
  id: string;
  name: string;
  criteria: FilterCriteria;
}

export interface FilterCriteria {
  status?: CardStatus[];
  priority?: CardPriority[];
  assignee?: string[];
  labels?: string[];
  search?: string;
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

export interface View {
  id: string;
  name: string;
  type: 'kanban' | 'list' | 'calendar' | 'gantt';
  filter?: Filter;
  sortBy?: SortConfig;
  groupBy?: string;
  columns?: string[];
}

export interface SortConfig {
  field: keyof Card | string;
  direction: 'asc' | 'desc';
}

export interface DragDropState {
  isDragging: boolean;
  draggedCardId?: string;
  sourceColumnId?: string;
  targetColumnId?: string;
  targetIndex?: number;
}

export interface DragDropEvent {
  type: 'dragstart' | 'dragover' | 'drop' | 'dragend';
  cardId: string;
  sourceColumnId: string;
  targetColumnId?: string;
  targetIndex?: number;
}

export interface RenderOptions {
  width?: number;
  height?: number;
  showLabels?: boolean;
  showAssignee?: boolean;
  showPriority?: boolean;
  showDates?: boolean;
  compact?: boolean;
  theme?: 'default' | 'minimal' | 'colorful';
}

export interface WebComponentProps {
  board: Board;
  onCardMove?: (event: DragDropEvent) => void;
  onCardClick?: (card: Card) => void;
  onColumnClick?: (column: Column) => void;
  filter?: FilterCriteria;
  view?: View;
  readOnly?: boolean;
}

export interface TerminalRenderOptions extends RenderOptions {
  unicode?: boolean;
  colors?: boolean;
  interactive?: boolean;
}

export interface KanbanSystemConfig {
  defaultColumns: CardStatus[];
  enableWipLimits: boolean;
  enableDragDrop: boolean;
  enableFiltering: boolean;
  enableViews: boolean;
  storageType: 'memory' | 'file' | 'database';
}
