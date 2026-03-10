/**
 * Kanban Drag and Drop Tests
 */

import { DragDropManager, createDragDropManager, isMoveAllowed } from '../dragdrop';
import type { Board, Card, Column } from '../types';

describe('DragDropManager', () => {
  let manager: DragDropManager;
  let board: Board;

  beforeEach(() => {
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
              title: 'Task 1',
              status: 'todo',
              priority: 'medium',
              labels: [],
              createdAt: new Date(),
              updatedAt: new Date()
            },
            {
              id: 'card-2',
              title: 'Task 2',
              status: 'todo',
              priority: 'high',
              labels: [],
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ]
        },
        {
          id: 'col-2',
          title: 'In Progress',
          status: 'in_progress',
          order: 1,
          cards: [
            {
              id: 'card-3',
              title: 'Task 3',
              status: 'in_progress',
              priority: 'low',
              labels: [],
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ]
        },
        {
          id: 'col-3',
          title: 'Done',
          status: 'done',
          order: 2,
          cards: []
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    manager = new DragDropManager(board);
  });

  describe('initial state', () => {
    it('should not be dragging initially', () => {
      expect(manager.isDragging()).toBe(false);
      expect(manager.getDraggedCardId()).toBeUndefined();
    });

    it('should return initial state', () => {
      const state = manager.getState();
      expect(state.isDragging).toBe(false);
    });
  });

  describe('dragStart', () => {
    it('should start dragging', () => {
      manager.dragStart('card-1', 'col-1');
      expect(manager.isDragging()).toBe(true);
      expect(manager.getDraggedCardId()).toBe('card-1');
    });

    it('should emit dragstart event', () => {
      const handler = jest.fn();
      manager.subscribe(handler);

      manager.dragStart('card-1', 'col-1');

      expect(handler).toHaveBeenCalledWith({
        type: 'dragstart',
        cardId: 'card-1',
        sourceColumnId: 'col-1'
      });
    });
  });

  describe('dragOver', () => {
    it('should update target column', () => {
      manager.dragStart('card-1', 'col-1');
      manager.dragOver('col-2', 1);

      const state = manager.getState();
      expect(state.targetColumnId).toBe('col-2');
      expect(state.targetIndex).toBe(1);
    });

    it('should not update when not dragging', () => {
      manager.dragOver('col-2', 1);
      const state = manager.getState();
      expect(state.targetColumnId).toBeUndefined();
    });

    it('should emit dragover event', () => {
      const handler = jest.fn();
      manager.subscribe(handler);

      manager.dragStart('card-1', 'col-1');
      manager.dragOver('col-2', 1);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'dragover',
        cardId: 'card-1',
        sourceColumnId: 'col-1',
        targetColumnId: 'col-2',
        targetIndex: 1
      }));
    });
  });

  describe('drop', () => {
    it('should return false when not dragging', () => {
      expect(manager.drop()).toBe(false);
    });

    it('should move card between columns', () => {
      manager.dragStart('card-1', 'col-1');
      manager.dragOver('col-2');

      const result = manager.drop();

      expect(result).toBe(true);
      expect(board.columns[0].cards).toHaveLength(1);
      expect(board.columns[1].cards).toHaveLength(2);
      expect(board.columns[1].cards.some(c => c.id === 'card-1')).toBe(true);
    });

    it('should update card status when moving', () => {
      manager.dragStart('card-1', 'col-1');
      manager.dragOver('col-2');
      manager.drop();

      const movedCard = board.columns[1].cards.find(c => c.id === 'card-1');
      expect(movedCard?.status).toBe('in_progress');
    });

    it('should emit drop event', () => {
      const handler = jest.fn();
      manager.subscribe(handler);

      manager.dragStart('card-1', 'col-1');
      manager.dragOver('col-2', 0);
      manager.drop();

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'drop',
        cardId: 'card-1',
        sourceColumnId: 'col-1',
        targetColumnId: 'col-2'
      }));
    });
  });

  describe('dragEnd', () => {
    it('should end dragging', () => {
      manager.dragStart('card-1', 'col-1');
      manager.dragEnd();

      expect(manager.isDragging()).toBe(false);
      expect(manager.getDraggedCardId()).toBeUndefined();
    });

    it('should emit dragend event', () => {
      const handler = jest.fn();
      manager.subscribe(handler);

      manager.dragStart('card-1', 'col-1');
      manager.dragEnd();

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'dragend',
        cardId: 'card-1',
        sourceColumnId: 'col-1'
      }));
    });
  });

  describe('moveCard', () => {
    it('should move card programmatically', () => {
      const result = manager.moveCard('card-1', 'col-1', 'col-2', 0);

      expect(result).toBe(true);
      expect(board.columns[0].cards).toHaveLength(1);
      expect(board.columns[1].cards).toHaveLength(2);
    });

    it('should return false for non-existent card', () => {
      const result = manager.moveCard('non-existent', 'col-1', 'col-2');
      expect(result).toBe(false);
    });

    it('should return false for non-existent columns', () => {
      const result = manager.moveCard('card-1', 'non-existent', 'col-2');
      expect(result).toBe(false);
    });
  });

  describe('cancel', () => {
    it('should cancel dragging', () => {
      manager.dragStart('card-1', 'col-1');
      manager.cancel();

      expect(manager.isDragging()).toBe(false);
    });
  });

  describe('subscription', () => {
    it('should unsubscribe handler', () => {
      const handler = jest.fn();
      const unsubscribe = manager.subscribe(handler);

      unsubscribe();
      manager.dragStart('card-1', 'col-1');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle errors in handlers gracefully', () => {
      const errorHandler = jest.fn(() => { throw new Error('Test error'); });
      const normalHandler = jest.fn();

      manager.subscribe(errorHandler);
      manager.subscribe(normalHandler);

      expect(() => manager.dragStart('card-1', 'col-1')).not.toThrow();
      expect(normalHandler).toHaveBeenCalled();
    });
  });
});

describe('createDragDropManager', () => {
  it('should create a manager instance', () => {
    const manager = createDragDropManager();
    expect(manager).toBeInstanceOf(DragDropManager);
  });

  it('should create manager with board', () => {
    const board: Board = {
      id: 'board-1',
      title: 'Test',
      columns: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const manager = createDragDropManager(board);
    expect(manager).toBeInstanceOf(DragDropManager);
  });
});

describe('isMoveAllowed', () => {
  const createCard = (id: string): Card => ({
    id,
    title: `Task ${id}`,
    status: 'todo',
    priority: 'medium',
    labels: [],
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const createColumn = (id: string, status: Card['status'], cardCount = 0): Column => ({
    id,
    title: id,
    status,
    order: 0,
    cards: Array(cardCount).fill(null).map((_, i) => createCard(`${id}-card-${i}`))
  });

  it('should allow valid moves', () => {
    const card = createCard('card-1');
    const source = createColumn('col-1', 'todo');
    const target = createColumn('col-2', 'in_progress');

    const result = isMoveAllowed(card, source, target);
    expect(result.allowed).toBe(true);
  });

  it('should reject moves exceeding WIP limit', () => {
    const card = createCard('card-1');
    const source = createColumn('col-1', 'todo');
    const target = createColumn('col-2', 'in_progress', 3);

    const wipLimits = new Map([['col-2', 3]]);
    const result = isMoveAllowed(card, source, target, wipLimits);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('WIP limit exceeded');
  });

  it('should reject invalid status transitions', () => {
    const card = createCard('card-1');
    const source = createColumn('col-1', 'done');
    const target = createColumn('col-2', 'backlog');

    const result = isMoveAllowed(card, source, target);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Invalid status transition');
  });

  it('should allow moves within same column', () => {
    const card = createCard('card-1');
    const column = createColumn('col-1', 'todo');

    const result = isMoveAllowed(card, column, column);
    expect(result.allowed).toBe(true);
  });
});
