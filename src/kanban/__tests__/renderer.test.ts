/**
 * Kanban Renderer Tests
 */

import { TerminalRenderer, createRenderer, renderBoard, renderCard } from '../renderer';
import type { Board, Card, Column } from '../types';

describe('TerminalRenderer', () => {
  let renderer: TerminalRenderer;
  let board: Board;

  beforeEach(() => {
    board = {
      id: 'board-1',
      title: 'Test Board',
      description: 'A test board',
      columns: [
        {
          id: 'col-1',
          title: 'To Do',
          status: 'todo',
          order: 0,
          wipLimit: 5,
          cards: [
            {
              id: 'card-1',
              title: 'Test Card',
              description: 'A test card description',
              status: 'todo',
              priority: 'high',
              assignee: 'alice',
              labels: ['bug', 'urgent'],
              createdAt: new Date('2024-01-15'),
              updatedAt: new Date('2024-01-16')
            }
          ]
        },
        {
          id: 'col-2',
          title: 'Done',
          status: 'done',
          order: 1,
          cards: []
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  describe('constructor', () => {
    it('should create renderer with default options', () => {
      const r = new TerminalRenderer();
      const output = r.render(board);
      expect(output).toContain('Test Board');
    });

    it('should create renderer with custom options', () => {
      const r = new TerminalRenderer({
        width: 80,
        compact: true,
        unicode: false,
        colors: false
      });
      const output = r.render(board);
      expect(output).toContain('Test Board');
    });
  });

  describe('render', () => {
    it('should render board title', () => {
      renderer = new TerminalRenderer();
      const output = renderer.render(board);
      expect(output).toContain('Test Board');
    });

    it('should render board description', () => {
      renderer = new TerminalRenderer();
      const output = renderer.render(board);
      expect(output).toContain('A test board');
    });

    it('should render column headers', () => {
      renderer = new TerminalRenderer();
      const output = renderer.render(board);
      expect(output).toContain('To Do');
      expect(output).toContain('Done');
    });

    it('should render WIP limit indicator', () => {
      renderer = new TerminalRenderer();
      const output = renderer.render(board);
      expect(output).toContain('(1/5)');
    });

    it('should render card count without WIP limit', () => {
      renderer = new TerminalRenderer();
      const output = renderer.render(board);
      expect(output).toContain('(0)');
    });

    it('should render cards', () => {
      renderer = new TerminalRenderer();
      const output = renderer.render(board);
      expect(output).toContain('Test Card');
    });

    it('should render footer with total count', () => {
      renderer = new TerminalRenderer();
      const output = renderer.render(board);
      expect(output).toContain('Total: 1 cards');
    });
  });

  describe('renderCard', () => {
    it('should render card title', () => {
      renderer = new TerminalRenderer({ width: 40 });
      const card = board.columns[0].cards[0];
      const output = renderer.renderCard(card, 38);
      expect(output).toContain('Test Card');
    });

    it('should render priority indicator', () => {
      renderer = new TerminalRenderer({ width: 40, showPriority: true });
      const card = board.columns[0].cards[0];
      const output = renderer.renderCard(card, 38);
      expect(output).toContain('↑');
    });

    it('should render assignee', () => {
      renderer = new TerminalRenderer({ width: 40, showAssignee: true });
      const card = board.columns[0].cards[0];
      const output = renderer.renderCard(card, 38);
      expect(output).toContain('@alice');
    });

    it('should render labels', () => {
      renderer = new TerminalRenderer({ width: 40, showLabels: true });
      const card = board.columns[0].cards[0];
      const output = renderer.renderCard(card, 38);
      expect(output).toContain('bug');
      expect(output).toContain('urgent');
    });

    it('should handle compact mode', () => {
      renderer = new TerminalRenderer({ width: 40, compact: true });
      const card = board.columns[0].cards[0];
      const output = renderer.renderCard(card, 38);
      expect(output).toContain('Test Card');
    });
  });

  describe('renderColumn', () => {
    it('should render column with cards', () => {
      renderer = new TerminalRenderer({ width: 40 });
      const column = board.columns[0];
      const output = renderer.renderColumn(column, 38);
      expect(output).toContain('To Do');
      expect(output).toContain('Test Card');
    });

    it('should render empty column', () => {
      renderer = new TerminalRenderer({ width: 40 });
      const column = board.columns[1];
      const output = renderer.renderColumn(column, 38);
      expect(output).toContain('Done');
      expect(output).toContain('(0)');
    });
  });

  describe('ASCII mode', () => {
    it('should use ASCII characters when unicode is false', () => {
      renderer = new TerminalRenderer({ unicode: false });
      const output = renderer.render(board);
      expect(output).toContain('+');
      expect(output).toContain('-');
      expect(output).toContain('|');
    });
  });

  describe('Unicode mode', () => {
    it('should use Unicode box drawing characters', () => {
      renderer = new TerminalRenderer({ unicode: true });
      const output = renderer.render(board);
      expect(output).toContain('─');
      expect(output).toContain('│');
    });
  });
});

describe('createRenderer', () => {
  it('should create a renderer with options', () => {
    const renderer = createRenderer({ compact: true });
    expect(renderer).toBeInstanceOf(TerminalRenderer);
  });
});

describe('renderBoard', () => {
  it('should render board to string', () => {
    const board: Board = {
      id: 'board-1',
      title: 'Simple Board',
      columns: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const output = renderBoard(board);
    expect(output).toContain('Simple Board');
  });

  it('should accept render options', () => {
    const board: Board = {
      id: 'board-1',
      title: 'Simple Board',
      columns: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const output = renderBoard(board, { compact: true });
    expect(output).toContain('Simple Board');
  });
});

describe('renderCard', () => {
  it('should render single card', () => {
    const card: Card = {
      id: 'card-1',
      title: 'Single Card',
      status: 'todo',
      priority: 'medium',
      labels: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const output = renderCard(card);
    expect(output).toContain('Single Card');
  });
});
