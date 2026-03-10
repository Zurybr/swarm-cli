/**
 * Kanban Custom View Definitions
 * Define and manage custom views for the Kanban board
 */

import type { View, Card, Column, Board, FilterCriteria, SortConfig } from './types';
import { CardFilter } from './filter';

export class ViewManager {
  private views: Map<string, View> = new Map();
  private filter: CardFilter;

  constructor() {
    this.filter = new CardFilter();
  }

  /**
   * Create a new custom view
   */
  createView(
    name: string,
    type: View['type'] = 'kanban',
    config?: Partial<Omit<View, 'id' | 'name' | 'type'>>
  ): View {
    const view: View = {
      id: this.generateId(),
      name,
      type,
      ...config
    };
    this.views.set(view.id, view);
    return view;
  }

  /**
   * Get a view by ID
   */
  getView(id: string): View | undefined {
    return this.views.get(id);
  }

  /**
   * Get all views
   */
  getAllViews(): View[] {
    return Array.from(this.views.values());
  }

  /**
   * Update a view
   */
  updateView(id: string, updates: Partial<Omit<View, 'id'>>): View | undefined {
    const view = this.views.get(id);
    if (!view) return undefined;

    const updated: View = { ...view, ...updates };
    this.views.set(id, updated);
    return updated;
  }

  /**
   * Delete a view
   */
  deleteView(id: string): boolean {
    return this.views.delete(id);
  }

  /**
   * Apply a view to a board, returning the transformed board
   */
  applyView(board: Board, view: View): Board {
    let columns = [...board.columns];

    if (view.filter) {
      columns = columns.map(col => ({
        ...col,
        cards: this.filter.apply(col.cards, view.filter!.criteria)
      }));
    }

    if (view.sortBy) {
      columns = columns.map(col => ({
        ...col,
        cards: this.sortCards(col.cards, view.sortBy!)
      }));
    }

    if (view.groupBy) {
      columns = this.groupColumns(columns, view.groupBy);
    }

    return {
      ...board,
      columns
    };
  }

  /**
   * Create preset views
   */
  createPresetViews(): View[] {
    return [
      this.createView('Kanban Board', 'kanban'),
      this.createView('List View', 'list', {
        sortBy: { field: 'priority', direction: 'desc' }
      }),
      this.createView('High Priority', 'kanban', {
        filter: {
          id: 'high-priority',
          name: 'High Priority',
          criteria: { priority: ['high', 'critical'] }
        }
      }),
      this.createView('My Tasks', 'kanban', {
        filter: {
          id: 'my-tasks',
          name: 'My Tasks',
          criteria: {}
        }
      }),
      this.createView('Calendar View', 'calendar', {
        sortBy: { field: 'dueDate', direction: 'asc' }
      })
    ];
  }

  /**
   * Sort cards by a configuration
   */
  private sortCards(cards: Card[], sortBy: SortConfig): Card[] {
    return [...cards].sort((a, b) => {
      const aVal = this.getFieldValue(a, sortBy.field);
      const bVal = this.getFieldValue(b, sortBy.field);

      if (aVal === undefined && bVal === undefined) return 0;
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;

      if (aVal < bVal) return sortBy.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortBy.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Group columns by a field
   */
  private groupColumns(columns: Column[], groupBy: string): Column[] {
    // For now, just return columns as-is
    // Full implementation would regroup cards across columns
    return columns;
  }

  /**
   * Get a field value from a card
   */
  private getFieldValue(card: Card, field: string): unknown {
    const value = card[field as keyof Card];
    if (value instanceof Date) {
      return value.getTime();
    }
    return value;
  }

  private generateId(): string {
    return `view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const viewPresets = {
  kanban: (name = 'Kanban Board'): Partial<View> => ({
    name,
    type: 'kanban'
  }),

  list: (name = 'List View', sortBy?: SortConfig): Partial<View> => ({
    name,
    type: 'list',
    sortBy: sortBy || { field: 'updatedAt', direction: 'desc' }
  }),

  highPriority: (name = 'High Priority'): Partial<View> => ({
    name,
    type: 'kanban',
    filter: {
      id: 'preset-high-priority',
      name: 'High Priority',
      criteria: { priority: ['high', 'critical'] }
    }
  }),

  byAssignee: (name = 'By Assignee', assignee: string): Partial<View> => ({
    name,
    type: 'kanban',
    filter: {
      id: 'preset-by-assignee',
      name: `Tasks for ${assignee}`,
      criteria: { assignee: [assignee] }
    }
  }),

  calendar: (name = 'Calendar View'): Partial<View> => ({
    name,
    type: 'calendar',
    sortBy: { field: 'dueDate', direction: 'asc' }
  })
};
