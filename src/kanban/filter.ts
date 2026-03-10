/**
 * Kanban Filtering and Search
 * Filter cards by various criteria
 */

import type { Card, CardStatus, CardPriority, FilterCriteria, Filter } from './types';

export class CardFilter {
  private filters: Map<string, Filter> = new Map();

  /**
   * Apply filter criteria to a list of cards
   */
  apply(cards: Card[], criteria: FilterCriteria): Card[] {
    return cards.filter(card => this.matches(card, criteria));
  }

  /**
   * Check if a card matches the filter criteria
   */
  matches(card: Card, criteria: FilterCriteria): boolean {
    if (criteria.status && criteria.status.length > 0) {
      if (!criteria.status.includes(card.status)) {
        return false;
      }
    }

    if (criteria.priority && criteria.priority.length > 0) {
      if (!criteria.priority.includes(card.priority)) {
        return false;
      }
    }

    if (criteria.assignee && criteria.assignee.length > 0) {
      if (!card.assignee || !criteria.assignee.includes(card.assignee)) {
        return false;
      }
    }

    if (criteria.labels && criteria.labels.length > 0) {
      const hasMatchingLabel = criteria.labels.some(label =>
        card.labels.includes(label)
      );
      if (!hasMatchingLabel) {
        return false;
      }
    }

    if (criteria.search) {
      const searchLower = criteria.search.toLowerCase();
      const matchesSearch =
        card.title.toLowerCase().includes(searchLower) ||
        (card.description?.toLowerCase().includes(searchLower) ?? false) ||
        card.labels.some(label => label.toLowerCase().includes(searchLower));
      if (!matchesSearch) {
        return false;
      }
    }

    if (criteria.dateRange) {
      if (criteria.dateRange.from && card.createdAt < criteria.dateRange.from) {
        return false;
      }
      if (criteria.dateRange.to && card.createdAt > criteria.dateRange.to) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create a named filter
   */
  createFilter(name: string, criteria: FilterCriteria): Filter {
    const filter: Filter = {
      id: this.generateId(),
      name,
      criteria
    };
    this.filters.set(filter.id, filter);
    return filter;
  }

  /**
   * Get a filter by ID
   */
  getFilter(id: string): Filter | undefined {
    return this.filters.get(id);
  }

  /**
   * Get all filters
   */
  getAllFilters(): Filter[] {
    return Array.from(this.filters.values());
  }

  /**
   * Delete a filter
   */
  deleteFilter(id: string): boolean {
    return this.filters.delete(id);
  }

  /**
   * Update a filter's criteria
   */
  updateFilter(id: string, criteria: Partial<FilterCriteria>): Filter | undefined {
    const filter = this.filters.get(id);
    if (!filter) return undefined;

    const updated: Filter = {
      ...filter,
      criteria: { ...filter.criteria, ...criteria }
    };
    this.filters.set(id, updated);
    return updated;
  }

  /**
   * Filter by status
   */
  byStatus(cards: Card[], status: CardStatus[]): Card[] {
    return this.apply(cards, { status });
  }

  /**
   * Filter by priority
   */
  byPriority(cards: Card[], priority: CardPriority[]): Card[] {
    return this.apply(cards, { priority });
  }

  /**
   * Filter by assignee
   */
  byAssignee(cards: Card[], assignee: string[]): Card[] {
    return this.apply(cards, { assignee });
  }

  /**
   * Filter by labels
   */
  byLabels(cards: Card[], labels: string[]): Card[] {
    return this.apply(cards, { labels });
  }

  /**
   * Search cards by text
   */
  search(cards: Card[], query: string): Card[] {
    return this.apply(cards, { search: query });
  }

  /**
   * Combine multiple filter criteria with AND logic
   */
  combineCriteria(...criteria: FilterCriteria[]): FilterCriteria {
    return criteria.reduce((combined, current) => ({
      status: this.mergeArrays(combined.status, current.status),
      priority: this.mergeArrays(combined.priority, current.priority),
      assignee: this.mergeArrays(combined.assignee, current.assignee),
      labels: this.mergeArrays(combined.labels, current.labels),
      search: current.search || combined.search,
      dateRange: current.dateRange || combined.dateRange
    }), {} as FilterCriteria);
  }

  private mergeArrays<T>(a?: T[], b?: T[]): T[] | undefined {
    if (!a && !b) return undefined;
    const merged = (a || []).concat(b || []);
    return Array.from(new Set(merged));
  }

  private generateId(): string {
    return `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const defaultFilters = {
  highPriority: (cards: Card[]): Card[] =>
    cards.filter(c => c.priority === 'high' || c.priority === 'critical'),

  unassigned: (cards: Card[]): Card[] =>
    cards.filter(c => !c.assignee),

  overdue: (cards: Card[]): Card[] => {
    const now = new Date();
    return cards.filter(c => c.dueDate && c.dueDate < now);
  },

  recentlyUpdated: (cards: Card[], days = 7): Card[] => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return cards.filter(c => c.updatedAt >= cutoff);
  },

  mine: (cards: Card[], username: string): Card[] =>
    cards.filter(c => c.assignee === username)
};
