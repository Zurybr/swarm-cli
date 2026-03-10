/**
 * Kanban Views Tests
 */

import { ViewManager, viewPresets } from '../views';
import type { Board, View, Card } from '../types';

describe('ViewManager', () => {
  let manager: ViewManager;
  let board: Board;

  beforeEach(() => {
    manager = new ViewManager();
    board = {
      id: 'board-1',
      title: 'Test Board',
      columns: [
        {
          id: 'col-1',
          title: 'To Do',
          status: 'todo',
          order: 0,
          cards: [
            {
              id: 'card-1',
              title: 'High Priority Task',
              status: 'todo',
              priority: 'high',
              labels: [],
              createdAt: new Date('2024-01-10'),
              updatedAt: new Date('2024-01-15')
            },
            {
              id: 'card-2',
              title: 'Low Priority Task',
              status: 'todo',
              priority: 'low',
              labels: [],
              createdAt: new Date('2024-01-05'),
              updatedAt: new Date('2024-01-08')
            }
          ]
        },
        {
          id: 'col-2',
          title: 'Done',
          status: 'done',
          order: 1,
          cards: [
            {
              id: 'card-3',
              title: 'Critical Bug',
              status: 'done',
              priority: 'critical',
              labels: [],
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-20')
            }
          ]
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  describe('createView', () => {
    it('should create a kanban view', () => {
      const view = manager.createView('My Board', 'kanban');
      expect(view.name).toBe('My Board');
      expect(view.type).toBe('kanban');
      expect(view.id).toBeDefined();
    });

    it('should create a list view', () => {
      const view = manager.createView('List View', 'list');
      expect(view.type).toBe('list');
    });

    it('should create a view with config', () => {
      const view = manager.createView('Sorted View', 'kanban', {
        sortBy: { field: 'priority', direction: 'desc' }
      });
      expect(view.sortBy).toBeDefined();
      expect(view.sortBy?.field).toBe('priority');
    });
  });

  describe('getView and getAllViews', () => {
    it('should retrieve a view by id', () => {
      const created = manager.createView('Test', 'kanban');
      const retrieved = manager.getView(created.id);
      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent view', () => {
      const result = manager.getView('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return all views', () => {
      manager.createView('View 1', 'kanban');
      manager.createView('View 2', 'list');
      const all = manager.getAllViews();
      expect(all).toHaveLength(2);
    });
  });

  describe('updateView', () => {
    it('should update view properties', () => {
      const view = manager.createView('Original', 'kanban');
      const updated = manager.updateView(view.id, { name: 'Updated' });
      expect(updated?.name).toBe('Updated');
    });

    it('should return undefined for non-existent view', () => {
      const result = manager.updateView('non-existent', {});
      expect(result).toBeUndefined();
    });
  });

  describe('deleteView', () => {
    it('should delete a view', () => {
      const view = manager.createView('To Delete', 'kanban');
      expect(manager.deleteView(view.id)).toBe(true);
      expect(manager.getView(view.id)).toBeUndefined();
    });

    it('should return false for non-existent view', () => {
      expect(manager.deleteView('non-existent')).toBe(false);
    });
  });

  describe('applyView', () => {
    it('should return original board when view not found', () => {
      const result = manager.applyView(board, { id: 'missing', name: 'Missing', type: 'kanban' });
      expect(result).toEqual(board);
    });

    it('should apply filter to board', () => {
      const view = manager.createView('High Priority', 'kanban', {
        filter: {
          id: 'filter-1',
          name: 'High Priority',
          criteria: { priority: ['high', 'critical'] }
        }
      });

      const result = manager.applyView(board, view);
      const allCards = result.columns.flatMap(c => c.cards);
      expect(allCards).toHaveLength(2);
      expect(allCards.every(c => c.priority === 'high' || c.priority === 'critical')).toBe(true);
    });

    it('should apply sorting to board', () => {
      const view = manager.createView('Sorted', 'kanban', {
        sortBy: { field: 'priority', direction: 'asc' }
      });

      const result = manager.applyView(board, view);
      const todoCards = result.columns[0].cards;
      // 'high' < 'low' alphabetically, so asc order puts high first
      expect(todoCards[0].priority).toBe('high');
      expect(todoCards[1].priority).toBe('low');
    });
  });

  describe('createPresetViews', () => {
    it('should create preset views', () => {
      const views = manager.createPresetViews();
      expect(views.length).toBeGreaterThan(0);

      const names = views.map(v => v.name);
      expect(names).toContain('Kanban Board');
      expect(names).toContain('List View');
      expect(names).toContain('High Priority');
    });
  });

  describe('viewPresets', () => {
    it('kanban preset should create kanban view config', () => {
      const config = viewPresets.kanban('My Kanban');
      expect(config.name).toBe('My Kanban');
      expect(config.type).toBe('kanban');
    });

    it('list preset should create list view config with sorting', () => {
      const config = viewPresets.list('My List');
      expect(config.name).toBe('My List');
      expect(config.type).toBe('list');
      expect(config.sortBy).toBeDefined();
    });

    it('highPriority preset should include filter', () => {
      const config = viewPresets.highPriority('Critical');
      expect(config.name).toBe('Critical');
      expect(config.filter).toBeDefined();
      expect(config.filter?.criteria.priority).toContain('high');
    });

    it('byAssignee preset should filter by assignee', () => {
      const config = viewPresets.byAssignee('My Tasks', 'alice');
      expect(config.filter?.criteria.assignee).toContain('alice');
    });

    it('calendar preset should sort by due date', () => {
      const config = viewPresets.calendar('Schedule');
      expect(config.type).toBe('calendar');
      expect(config.sortBy?.field).toBe('dueDate');
    });
  });
});
