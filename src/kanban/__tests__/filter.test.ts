/**
 * Kanban Filter Tests
 */

import { CardFilter, defaultFilters } from '../filter';
import type { Card, FilterCriteria } from '../types';

describe('CardFilter', () => {
  let filter: CardFilter;
  let cards: Card[];

  beforeEach(() => {
    filter = new CardFilter();
    cards = [
      {
        id: 'card-1',
        title: 'Fix login bug',
        description: 'Users cannot login with email',
        status: 'todo',
        priority: 'high',
        assignee: 'alice',
        labels: ['bug', 'auth'],
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-16')
      },
      {
        id: 'card-2',
        title: 'Add dark mode',
        description: 'Implement dark theme',
        status: 'in_progress',
        priority: 'medium',
        assignee: 'bob',
        labels: ['feature', 'ui'],
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-14')
      },
      {
        id: 'card-3',
        title: 'Update documentation',
        status: 'done',
        priority: 'low',
        assignee: 'alice',
        labels: ['docs'],
        createdAt: new Date('2024-01-05'),
        updatedAt: new Date('2024-01-08')
      },
      {
        id: 'card-4',
        title: 'Critical security fix',
        description: 'Fix SQL injection vulnerability',
        status: 'todo',
        priority: 'critical',
        assignee: 'charlie',
        labels: ['bug', 'security'],
        createdAt: new Date('2024-01-20'),
        updatedAt: new Date('2024-01-20')
      },
      {
        id: 'card-5',
        title: 'Refactor codebase',
        status: 'backlog',
        priority: 'medium',
        labels: ['refactor'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02')
      }
    ];
  });

  describe('apply', () => {
    it('should return all cards when no criteria provided', () => {
      const result = filter.apply(cards, {});
      expect(result).toHaveLength(5);
    });

    it('should filter by single status', () => {
      const result = filter.apply(cards, { status: ['todo'] });
      expect(result).toHaveLength(2);
      expect(result.every(c => c.status === 'todo')).toBe(true);
    });

    it('should filter by multiple statuses', () => {
      const result = filter.apply(cards, { status: ['todo', 'in_progress'] });
      expect(result).toHaveLength(3);
    });

    it('should filter by priority', () => {
      const result = filter.apply(cards, { priority: ['high', 'critical'] });
      expect(result).toHaveLength(2);
      expect(result.some(c => c.priority === 'high')).toBe(true);
      expect(result.some(c => c.priority === 'critical')).toBe(true);
    });

    it('should filter by assignee', () => {
      const result = filter.apply(cards, { assignee: ['alice'] });
      expect(result).toHaveLength(2);
      expect(result.every(c => c.assignee === 'alice')).toBe(true);
    });

    it('should filter by labels', () => {
      const result = filter.apply(cards, { labels: ['bug'] });
      expect(result).toHaveLength(2);
      expect(result.every(c => c.labels.includes('bug'))).toBe(true);
    });

    it('should filter by search text in title', () => {
      const result = filter.apply(cards, { search: 'fix' });
      expect(result).toHaveLength(2);
      expect(result.some(c => c.title.includes('Fix'))).toBe(true);
    });

    it('should filter by search text in description', () => {
      const result = filter.apply(cards, { search: 'theme' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-2');
    });

    it('should filter by search text in labels', () => {
      const result = filter.apply(cards, { search: 'security' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-4');
    });

    it('should filter by date range', () => {
      const result = filter.apply(cards, {
        dateRange: {
          from: new Date('2024-01-10'),
          to: new Date('2024-01-18')
        }
      });
      expect(result).toHaveLength(2);
    });

    it('should combine multiple criteria with AND logic', () => {
      const result = filter.apply(cards, {
        status: ['todo'],
        priority: ['high']
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-1');
    });
  });

  describe('createFilter and getFilter', () => {
    it('should create and retrieve a named filter', () => {
      const created = filter.createFilter('High Priority', { priority: ['high', 'critical'] });
      expect(created.name).toBe('High Priority');

      const retrieved = filter.getFilter(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('High Priority');
    });

    it('should return undefined for non-existent filter', () => {
      const result = filter.getFilter('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getAllFilters', () => {
    it('should return all created filters', () => {
      filter.createFilter('Filter 1', { priority: ['high'] });
      filter.createFilter('Filter 2', { status: ['todo'] });

      const all = filter.getAllFilters();
      expect(all).toHaveLength(2);
    });
  });

  describe('deleteFilter', () => {
    it('should delete a filter', () => {
      const created = filter.createFilter('To Delete', {});
      expect(filter.deleteFilter(created.id)).toBe(true);
      expect(filter.getFilter(created.id)).toBeUndefined();
    });

    it('should return false for non-existent filter', () => {
      expect(filter.deleteFilter('non-existent')).toBe(false);
    });
  });

  describe('updateFilter', () => {
    it('should update filter criteria', () => {
      const created = filter.createFilter('Original', { priority: ['low'] });
      const updated = filter.updateFilter(created.id, { priority: ['high'] });

      expect(updated).toBeDefined();
      expect(updated?.criteria.priority).toEqual(['high']);
    });

    it('should return undefined for non-existent filter', () => {
      const result = filter.updateFilter('non-existent', {});
      expect(result).toBeUndefined();
    });
  });

  describe('convenience methods', () => {
    it('byStatus should filter by status', () => {
      const result = filter.byStatus(cards, ['done']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-3');
    });

    it('byPriority should filter by priority', () => {
      const result = filter.byPriority(cards, ['critical']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-4');
    });

    it('byAssignee should filter by assignee', () => {
      const result = filter.byAssignee(cards, ['bob']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-2');
    });

    it('byLabels should filter by labels', () => {
      const result = filter.byLabels(cards, ['feature']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-2');
    });

    it('search should filter by search text', () => {
      const result = filter.search(cards, 'documentation');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-3');
    });
  });

  describe('defaultFilters', () => {
    it('highPriority should return high and critical priority cards', () => {
      const result = defaultFilters.highPriority(cards);
      expect(result).toHaveLength(2);
      expect(result.every(c => c.priority === 'high' || c.priority === 'critical')).toBe(true);
    });

    it('unassigned should return cards without assignee', () => {
      const result = defaultFilters.unassigned(cards);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-5');
    });

    it('overdue should return cards past due date', () => {
      const now = new Date();
      const overdueCards: Card[] = [
        { ...cards[0], dueDate: new Date(now.getTime() - 86400000) }, // yesterday
        { ...cards[1], dueDate: new Date(now.getTime() + 86400000) }  // tomorrow
      ];
      const result = defaultFilters.overdue(overdueCards);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-1');
    });

    it('recentlyUpdated should return recently updated cards', () => {
      // All test cards are from 2024, so use a large window
      const result = defaultFilters.recentlyUpdated(cards, 36500);
      expect(result.length).toBeGreaterThan(0);
    });

    it('mine should return cards assigned to user', () => {
      const result = defaultFilters.mine(cards, 'alice');
      expect(result).toHaveLength(2);
      expect(result.every(c => c.assignee === 'alice')).toBe(true);
    });
  });
});
