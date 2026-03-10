/**
 * Kanban System Integration Tests
 */

import {
  KanbanSystem,
  createKanbanSystem,
  createSampleBoard
} from '../index';
import type { Board, Card, CardStatus } from '../types';

describe('KanbanSystem', () => {
  let system: KanbanSystem;

  beforeEach(() => {
    system = new KanbanSystem();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      expect(system.getBoard()).toBeDefined();
      expect(system.getBoard().columns).toHaveLength(5);
    });

    it('should create with custom config', () => {
      const custom = new KanbanSystem({
        defaultColumns: ['todo', 'done'],
        enableWipLimits: false
      });
      expect(custom.getBoard().columns).toHaveLength(2);
    });
  });

  describe('createBoard', () => {
    it('should create a new board', () => {
      const board = system.createBoard('My Project');
      expect(board.title).toBe('My Project');
      expect(board.id).toBeDefined();
    });

    it('should create board with description', () => {
      const board = system.createBoard('My Project', 'Project description');
      expect(board.description).toBe('Project description');
    });

    it('should create default columns', () => {
      const board = system.createBoard('Test');
      const statuses = board.columns.map(c => c.status);
      expect(statuses).toContain('backlog');
      expect(statuses).toContain('todo');
      expect(statuses).toContain('in_progress');
      expect(statuses).toContain('review');
      expect(statuses).toContain('done');
    });
  });

  describe('addCard', () => {
    it('should add a card to the board', () => {
      const card = system.addCard({
        title: 'New Task',
        status: 'todo',
        priority: 'medium',
        labels: []
      });

      expect(card.id).toBeDefined();
      expect(card.title).toBe('New Task');
      expect(system.getCard(card.id)).toEqual(card);
    });

    it('should add card to correct column', () => {
      system.addCard({
        title: 'Task',
        status: 'in_progress',
        priority: 'high',
        labels: []
      });

      const column = system.getBoard().columns.find(c => c.status === 'in_progress');
      expect(column?.cards).toHaveLength(1);
    });

    it('should set timestamps', () => {
      const before = new Date();
      const card = system.addCard({
        title: 'Task',
        status: 'todo',
        priority: 'low',
        labels: []
      });
      const after = new Date();

      expect(card.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(card.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('updateCard', () => {
    beforeEach(() => {
      system.addCard({
        id: 'test-card',
        title: 'Original Title',
        status: 'todo',
        priority: 'low',
        labels: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    it('should update card properties', () => {
      const card = system.getAllCards()[0];
      const updated = system.updateCard(card.id, { title: 'Updated Title' });

      expect(updated?.title).toBe('Updated Title');
    });

    it('should move card when status changes', () => {
      const card = system.getAllCards()[0];
      const updated = system.updateCard(card.id, { status: 'done' as CardStatus });

      expect(updated?.status).toBe('done');
      const doneColumn = system.getBoard().columns.find(c => c.status === 'done');
      expect(doneColumn?.cards.some(c => c.id === card.id)).toBe(true);
    });

    it('should update timestamp', () => {
      const card = system.getAllCards()[0];
      const before = new Date();
      const updated = system.updateCard(card.id, { title: 'Updated' });
      const after = new Date();

      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should return undefined for non-existent card', () => {
      const result = system.updateCard('non-existent', { title: 'Test' });
      expect(result).toBeUndefined();
    });
  });

  describe('deleteCard', () => {
    beforeEach(() => {
      system.addCard({
        title: 'To Delete',
        status: 'todo',
        priority: 'medium',
        labels: []
      });
    });

    it('should delete a card', () => {
      const card = system.getAllCards()[0];
      const result = system.deleteCard(card.id);

      expect(result).toBe(true);
      expect(system.getCard(card.id)).toBeUndefined();
    });

    it('should return false for non-existent card', () => {
      const result = system.deleteCard('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('moveCard', () => {
    beforeEach(() => {
      system.addCard({
        title: 'Movable Task',
        status: 'todo',
        priority: 'medium',
        labels: []
      });
    });

    it('should move card between columns', () => {
      const card = system.getAllCards()[0];
      const targetColumn = system.getBoard().columns.find(c => c.status === 'in_progress');

      const result = system.moveCard(card.id, targetColumn!.id);

      expect(result).toBe(true);
      expect(system.getCard(card.id)?.status).toBe('in_progress');
    });
  });

  describe('getCard and getAllCards', () => {
    beforeEach(() => {
      system.addCard({ title: 'Card 1', status: 'todo', priority: 'low', labels: [] });
      system.addCard({ title: 'Card 2', status: 'in_progress', priority: 'high', labels: [] });
    });

    it('should get card by id', () => {
      const allCards = system.getAllCards();
      const card = system.getCard(allCards[0].id);

      expect(card).toBeDefined();
      expect(card?.title).toBe('Card 1');
    });

    it('should return all cards', () => {
      const cards = system.getAllCards();
      expect(cards).toHaveLength(2);
    });

    it('should return undefined for non-existent card', () => {
      const card = system.getCard('non-existent');
      expect(card).toBeUndefined();
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      system.addCard({ title: 'Bug Fix', status: 'todo', priority: 'high', labels: ['bug'], assignee: 'alice' });
      system.addCard({ title: 'Feature', status: 'in_progress', priority: 'medium', labels: ['feature'], assignee: 'bob' });
      system.addCard({ title: 'Docs', status: 'done', priority: 'low', labels: ['docs'] });
    });

    it('should filter cards by criteria', () => {
      const filtered = system.filterCards({ priority: ['high'] });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Bug Fix');
    });

    it('should create named filters', () => {
      const filter = system.createFilter('High Priority', { priority: ['high', 'critical'] });
      expect(filter.name).toBe('High Priority');
    });
  });

  describe('views', () => {
    it('should create views', () => {
      const view = system.createView('My View', 'kanban');
      expect(view.name).toBe('My View');
      expect(view.type).toBe('kanban');
    });

    it('should apply views', () => {
      system.addCard({ title: 'High Task', status: 'todo', priority: 'high', labels: [] });
      system.addCard({ title: 'Low Task', status: 'todo', priority: 'low', labels: [] });

      const view = system.createView('High Only', 'kanban', {
        filter: { id: 'f1', name: 'High', criteria: { priority: ['high'] } }
      });

      const applied = system.applyView(view.id);
      const allCards = applied.columns.flatMap(c => c.cards);
      expect(allCards).toHaveLength(1);
    });
  });

  describe('rendering', () => {
    it('should render to terminal', () => {
      const output = system.renderToTerminal();
      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
    });

    it('should generate web view', () => {
      const html = system.generateWebView();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
    });
  });

  describe('import/export', () => {
    it('should export to JSON', () => {
      system.createBoard('Export Test');
      const json = system.exportToJSON();

      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.title).toBe('Export Test');
    });

    it('should import from JSON', () => {
      system.createBoard('Original');
      system.addCard({ title: 'Test Card', status: 'todo', priority: 'medium', labels: [] });

      const json = system.exportToJSON();
      const newSystem = new KanbanSystem();
      newSystem.importFromJSON(json);

      expect(newSystem.getBoard().title).toBe('Original');
      expect(newSystem.getAllCards()).toHaveLength(1);
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      system.addCard({ title: 'High', status: 'todo', priority: 'high', labels: [] });
      system.addCard({ title: 'Medium', status: 'in_progress', priority: 'medium', labels: [], assignee: 'alice' });
      system.addCard({ title: 'Done', status: 'done', priority: 'low', labels: [] });
    });

    it('should calculate total cards', () => {
      const stats = system.getStats();
      expect(stats.totalCards).toBe(3);
    });

    it('should calculate cards by status', () => {
      const stats = system.getStats();
      expect(stats.cardsByStatus.todo).toBe(1);
      expect(stats.cardsByStatus.in_progress).toBe(1);
      expect(stats.cardsByStatus.done).toBe(1);
    });

    it('should calculate cards by priority', () => {
      const stats = system.getStats();
      expect(stats.cardsByPriority.high).toBe(1);
      expect(stats.cardsByPriority.medium).toBe(1);
      expect(stats.cardsByPriority.low).toBe(1);
    });

    it('should count unassigned cards', () => {
      const stats = system.getStats();
      expect(stats.unassignedCards).toBe(2);
    });
  });

  describe('drag and drop', () => {
    beforeEach(() => {
      system.addCard({ title: 'Draggable', status: 'todo', priority: 'medium', labels: [] });
    });

    it('should start drag', () => {
      const card = system.getAllCards()[0];
      const column = system.getBoard().columns[0];

      system.dragStart(card.id, column.id);

      // Drag drop is enabled by default
      expect(system.getAllCards()).toHaveLength(1);
    });

    it('should subscribe to card move events', () => {
      const handler = jest.fn();
      const unsubscribe = system.onCardMove(handler);

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('setBoard and getBoard', () => {
    it('should set and get board', () => {
      const newBoard: Board = {
        id: 'new-board',
        title: 'New Board',
        columns: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      system.setBoard(newBoard);
      expect(system.getBoard().id).toBe('new-board');
    });
  });
});

describe('createKanbanSystem', () => {
  it('should create a system instance', () => {
    const system = createKanbanSystem();
    expect(system).toBeInstanceOf(KanbanSystem);
  });

  it('should accept config', () => {
    const system = createKanbanSystem({ enableWipLimits: false });
    expect(system).toBeInstanceOf(KanbanSystem);
  });
});

describe('createSampleBoard', () => {
  it('should create a board with sample data', () => {
    const board = createSampleBoard();
    expect(board.title).toBe('Project Alpha');
    expect(board.columns.length).toBeGreaterThan(0);
  });

  it('should have sample cards', () => {
    const board = createSampleBoard();
    const allCards = board.columns.flatMap(c => c.cards);
    expect(allCards.length).toBeGreaterThan(0);
  });
});
