/**
 * Kanban Web Tests
 */

import {
  generateBoardHTML,
  createWebHandler,
  filterCardsForWeb,
  exportBoardToJSON,
  kanbanStyles
} from '../web';
import type { Board, Card } from '../types';

describe('Web Components', () => {
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
              description: 'A test card',
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

  describe('generateBoardHTML', () => {
    it('should generate valid HTML', () => {
      const html = generateBoardHTML(board);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    it('should include board title', () => {
      const html = generateBoardHTML(board);
      expect(html).toContain('Test Board');
      expect(html).toContain('<title>');
    });

    it('should include board description', () => {
      const html = generateBoardHTML(board);
      expect(html).toContain('A test board');
    });

    it('should render columns', () => {
      const html = generateBoardHTML(board);
      expect(html).toContain('To Do');
      expect(html).toContain('Done');
    });

    it('should render cards', () => {
      const html = generateBoardHTML(board);
      expect(html).toContain('Test Card');
      expect(html).toContain('card-1');
    });

    it('should render WIP limit', () => {
      const html = generateBoardHTML(board);
      expect(html).toContain('1/5');
    });

    it('should include CSS styles', () => {
      const html = generateBoardHTML(board);
      expect(html).toContain('<style>');
      expect(html).toContain('.kanban-board');
    });

    it('should include JavaScript', () => {
      const html = generateBoardHTML(board);
      expect(html).toContain('<script>');
    });

    it('should escape HTML in card titles', () => {
      board.columns[0].cards[0].title = '<script>alert("xss")</script>';
      const html = generateBoardHTML(board);
      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should escape HTML in descriptions', () => {
      board.columns[0].cards[0].description = '<b>bold</b>';
      const html = generateBoardHTML(board);
      expect(html).not.toContain('<b>bold</b>');
      expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    });

    it('should render priority indicators', () => {
      const html = generateBoardHTML(board);
      expect(html).toContain('priority-high');
    });

    it('should render assignee initials', () => {
      const html = generateBoardHTML(board);
      expect(html).toContain('alice');
    });

    it('should render labels', () => {
      const html = generateBoardHTML(board);
      expect(html).toContain('bug');
      expect(html).toContain('urgent');
    });

    it('should support readOnly mode', () => {
      const html = generateBoardHTML(board, { readOnly: true });
      // In readOnly mode, the JS should not have drag-drop handlers
      expect(html).not.toContain('dragstart');
    });
  });

  describe('createWebHandler', () => {
    it('should return handler function', () => {
      const handler = createWebHandler(board);
      expect(typeof handler).toBe('function');
    });

    it('should serve HTML on root path', () => {
      const handler = createWebHandler(board);
      const response = handler({ url: '/' });

      expect(response.status).toBe(200);
      expect(response.headers['Content-Type']).toBe('text/html');
      expect(response.body).toContain('Test Board');
    });

    it('should serve JSON on /api/board', () => {
      const handler = createWebHandler(board);
      const response = handler({ url: '/api/board' });

      expect(response.status).toBe(200);
      expect(response.headers['Content-Type']).toBe('application/json');
      const data = JSON.parse(response.body);
      expect(data.id).toBe('board-1');
    });

    it('should return 404 for unknown paths', () => {
      const handler = createWebHandler(board);
      const response = handler({ url: '/unknown' });

      expect(response.status).toBe(404);
      expect(response.body).toBe('Not Found');
    });
  });

  describe('filterCardsForWeb', () => {
    let cards: Card[];

    beforeEach(() => {
      cards = [
        {
          id: 'card-1',
          title: 'High Priority Bug',
          description: 'Critical issue',
          status: 'todo',
          priority: 'high',
          assignee: 'alice',
          labels: ['bug'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'card-2',
          title: 'Feature Request',
          status: 'in_progress',
          priority: 'medium',
          assignee: 'bob',
          labels: ['feature'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'card-3',
          title: 'Documentation',
          status: 'done',
          priority: 'low',
          labels: ['docs'],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    });

    it('should return all cards when no criteria', () => {
      const result = filterCardsForWeb(cards);
      expect(result).toHaveLength(3);
    });

    it('should filter by status', () => {
      const result = filterCardsForWeb(cards, { status: ['todo'] });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-1');
    });

    it('should filter by priority', () => {
      const result = filterCardsForWeb(cards, { priority: ['high'] });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-1');
    });

    it('should filter by assignee', () => {
      const result = filterCardsForWeb(cards, { assignee: ['alice'] });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-1');
    });

    it('should filter by labels', () => {
      const result = filterCardsForWeb(cards, { labels: ['feature'] });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-2');
    });

    it('should filter by search text', () => {
      const result = filterCardsForWeb(cards, { search: 'bug' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-1');
    });

    it('should search in descriptions', () => {
      const result = filterCardsForWeb(cards, { search: 'critical' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('card-1');
    });

    it('should handle unassigned cards', () => {
      const result = filterCardsForWeb(cards, { assignee: ['charlie'] });
      expect(result).toHaveLength(0);
    });
  });

  describe('exportBoardToJSON', () => {
    it('should export board as JSON string', () => {
      const json = exportBoardToJSON(board);
      const parsed = JSON.parse(json);
      expect(parsed.id).toBe('board-1');
      expect(parsed.title).toBe('Test Board');
    });

    it('should include all columns', () => {
      const json = exportBoardToJSON(board);
      const parsed = JSON.parse(json);
      expect(parsed.columns).toHaveLength(2);
    });
  });

  describe('kanbanStyles', () => {
    it('should define board styles', () => {
      expect(kanbanStyles.board).toBeDefined();
      expect(kanbanStyles.board.display).toBe('flex');
    });

    it('should define card styles', () => {
      expect(kanbanStyles.card).toBeDefined();
      expect(kanbanStyles.card.backgroundColor).toBeDefined();
    });

    it('should define column styles', () => {
      expect(kanbanStyles.column).toBeDefined();
      expect(kanbanStyles.column.minWidth).toBeDefined();
    });
  });
});
