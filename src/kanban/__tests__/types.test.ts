/**
 * Kanban Types Tests
 */

import type { Card, Column, Board, FilterCriteria, View, DragDropState } from '../types';

describe('Kanban Types', () => {
  describe('Card type', () => {
    it('should create a valid card object', () => {
      const card: Card = {
        id: 'card-1',
        title: 'Test Card',
        description: 'A test card',
        status: 'todo',
        priority: 'high',
        assignee: 'user1',
        labels: ['bug', 'urgent'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(card.id).toBe('card-1');
      expect(card.title).toBe('Test Card');
      expect(card.status).toBe('todo');
      expect(card.priority).toBe('high');
      expect(card.labels).toHaveLength(2);
    });

    it('should support all card statuses', () => {
      const statuses: Card['status'][] = ['backlog', 'todo', 'in_progress', 'review', 'done'];

      statuses.forEach(status => {
        const card: Card = {
          id: `card-${status}`,
          title: `Card in ${status}`,
          status,
          priority: 'medium',
          labels: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        expect(card.status).toBe(status);
      });
    });

    it('should support all priority levels', () => {
      const priorities: Card['priority'][] = ['low', 'medium', 'high', 'critical'];

      priorities.forEach(priority => {
        const card: Card = {
          id: `card-${priority}`,
          title: `Card with ${priority} priority`,
          status: 'todo',
          priority,
          labels: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        expect(card.priority).toBe(priority);
      });
    });
  });

  describe('Column type', () => {
    it('should create a valid column object', () => {
      const column: Column = {
        id: 'col-1',
        title: 'To Do',
        status: 'todo',
        cards: [],
        wipLimit: 5,
        order: 0
      };

      expect(column.id).toBe('col-1');
      expect(column.title).toBe('To Do');
      expect(column.wipLimit).toBe(5);
      expect(column.cards).toHaveLength(0);
    });

    it('should contain cards', () => {
      const card: Card = {
        id: 'card-1',
        title: 'Test Card',
        status: 'todo',
        priority: 'medium',
        labels: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const column: Column = {
        id: 'col-1',
        title: 'To Do',
        status: 'todo',
        cards: [card],
        order: 0
      };

      expect(column.cards).toHaveLength(1);
      expect(column.cards[0].id).toBe('card-1');
    });
  });

  describe('Board type', () => {
    it('should create a valid board object', () => {
      const board: Board = {
        id: 'board-1',
        title: 'Project Board',
        description: 'Main project board',
        columns: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(board.id).toBe('board-1');
      expect(board.title).toBe('Project Board');
      expect(board.columns).toHaveLength(0);
    });

    it('should contain multiple columns', () => {
      const columns: Column[] = [
        { id: 'col-1', title: 'Backlog', status: 'backlog', cards: [], order: 0 },
        { id: 'col-2', title: 'To Do', status: 'todo', cards: [], order: 1 },
        { id: 'col-3', title: 'Done', status: 'done', cards: [], order: 2 }
      ];

      const board: Board = {
        id: 'board-1',
        title: 'Project Board',
        columns,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(board.columns).toHaveLength(3);
    });
  });

  describe('FilterCriteria type', () => {
    it('should support filtering by status', () => {
      const criteria: FilterCriteria = {
        status: ['todo', 'in_progress']
      };

      expect(criteria.status).toContain('todo');
      expect(criteria.status).toContain('in_progress');
    });

    it('should support filtering by multiple criteria', () => {
      const criteria: FilterCriteria = {
        status: ['todo'],
        priority: ['high', 'critical'],
        assignee: ['user1'],
        labels: ['bug'],
        search: 'urgent'
      };

      expect(criteria.status).toHaveLength(1);
      expect(criteria.priority).toHaveLength(2);
      expect(criteria.search).toBe('urgent');
    });

    it('should support date range filtering', () => {
      const criteria: FilterCriteria = {
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31')
        }
      };

      expect(criteria.dateRange?.from).toBeInstanceOf(Date);
      expect(criteria.dateRange?.to).toBeInstanceOf(Date);
    });
  });

  describe('View type', () => {
    it('should create a kanban view', () => {
      const view: View = {
        id: 'view-1',
        name: 'Kanban Board',
        type: 'kanban'
      };

      expect(view.type).toBe('kanban');
    });

    it('should create a list view with sorting', () => {
      const view: View = {
        id: 'view-2',
        name: 'List View',
        type: 'list',
        sortBy: {
          field: 'priority',
          direction: 'desc'
        }
      };

      expect(view.type).toBe('list');
      expect(view.sortBy?.field).toBe('priority');
      expect(view.sortBy?.direction).toBe('desc');
    });

    it('should support all view types', () => {
      const types: View['type'][] = ['kanban', 'list', 'calendar', 'gantt'];

      types.forEach(type => {
        const view: View = {
          id: `view-${type}`,
          name: `${type} View`,
          type
        };
        expect(view.type).toBe(type);
      });
    });
  });

  describe('DragDropState type', () => {
    it('should represent idle state', () => {
      const state: DragDropState = {
        isDragging: false
      };

      expect(state.isDragging).toBe(false);
      expect(state.draggedCardId).toBeUndefined();
    });

    it('should represent active drag state', () => {
      const state: DragDropState = {
        isDragging: true,
        draggedCardId: 'card-1',
        sourceColumnId: 'col-1',
        targetColumnId: 'col-2',
        targetIndex: 3
      };

      expect(state.isDragging).toBe(true);
      expect(state.draggedCardId).toBe('card-1');
      expect(state.targetColumnId).toBe('col-2');
      expect(state.targetIndex).toBe(3);
    });
  });
});
