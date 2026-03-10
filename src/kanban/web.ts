/**
 * Kanban Web View Components
 * React/Vue compatible web components for Kanban visualization
 */

import type {
  Board,
  Column,
  Card,
  CardStatus,
  CardPriority,
  WebComponentProps,
  DragDropEvent,
  FilterCriteria
} from './types';

// CSS-in-JS style definitions (framework agnostic)
export const kanbanStyles = {
  board: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  boardHeader: {
    padding: '16px 24px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e0e0e0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  boardTitle: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 600,
    color: '#333'
  },
  boardDescription: {
    margin: '8px 0 0 0',
    fontSize: '14px',
    color: '#666'
  },
  columnsContainer: {
    display: 'flex',
    flex: 1,
    overflowX: 'auto' as const,
    padding: '16px',
    gap: '16px'
  },
  column: {
    minWidth: '280px',
    maxWidth: '280px',
    backgroundColor: '#ebecf0',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column' as const,
    maxHeight: '100%'
  },
  columnHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  columnTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#333',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  },
  columnCount: {
    fontSize: '12px',
    color: '#666',
    backgroundColor: '#ddd',
    padding: '2px 8px',
    borderRadius: '12px'
  },
  cardsContainer: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '8px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '6px',
    padding: '12px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s, transform 0.2s',
    border: '1px solid transparent'
  },
  cardDragging: {
    opacity: 0.5,
    transform: 'rotate(2deg)'
  },
  cardHover: {
    boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
  },
  cardTitle: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
    lineHeight: 1.4
  },
  cardDescription: {
    margin: '0 0 12px 0',
    fontSize: '12px',
    color: '#666',
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden'
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8px'
  },
  cardLabels: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap' as const
  },
  label: {
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '3px',
    fontWeight: 500
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  priority: {
    fontSize: '12px',
    fontWeight: 600
  },
  assignee: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#4a90d9',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 600
  },
  dropZone: {
    minHeight: '100px',
    border: '2px dashed #ccc',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
    fontSize: '14px'
  },
  dropZoneActive: {
    borderColor: '#4a90d9',
    backgroundColor: 'rgba(74, 144, 217, 0.1)'
  }
};

// Status color mapping
const statusColors: Record<CardStatus, string> = {
  backlog: '#9e9e9e',
  todo: '#2196f3',
  in_progress: '#ff9800',
  review: '#9c27b0',
  done: '#4caf50'
};

// Priority color mapping
const priorityColors: Record<CardPriority, string> = {
  low: '#9e9e9e',
  medium: '#2196f3',
  high: '#ff9800',
  critical: '#f44336'
};

// Label color palette
const labelColors = [
  '#e3f2fd', '#f3e5f5', '#e8f5e9', '#fff3e0', '#fce4ec',
  '#e0f7fa', '#f1f8e9', '#fff8e1', '#fbe9e7', '#efebe9'
];

/**
 * Generate HTML for a Kanban board
 */
export function generateBoardHTML(board: Board, props?: Partial<WebComponentProps>): string {
  const { onCardClick, readOnly } = props || {};
  const fullProps: WebComponentProps = { board, ...props };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(board.title)} - Kanban Board</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f5f5f5;
      height: 100vh;
      overflow: hidden;
    }
    ${generateCSS()}
  </style>
</head>
<body>
  ${generateBoardMarkup(board, fullProps)}
  <script>
    ${generateClientJS(readOnly)}
  </script>
</body>
</html>
  `.trim();
}

/**
 * Generate CSS styles
 */
function generateCSS(): string {
  return `
    .kanban-board {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .board-header {
      padding: 16px 24px;
      background: #fff;
      border-bottom: 1px solid #e0e0e0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .board-title {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #333;
    }
    .board-description {
      margin: 8px 0 0 0;
      font-size: 14px;
      color: #666;
    }
    .columns-container {
      display: flex;
      flex: 1;
      overflow-x: auto;
      padding: 16px;
      gap: 16px;
    }
    .column {
      min-width: 280px;
      max-width: 280px;
      background: #ebecf0;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      max-height: 100%;
    }
    .column-header {
      padding: 12px 16px;
      border-bottom: 1px solid #ddd;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .column-title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #333;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .column-count {
      font-size: 12px;
      color: #666;
      background: #ddd;
      padding: 2px 8px;
      border-radius: 12px;
    }
    .cards-container {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .card {
      background: #fff;
      border-radius: 6px;
      padding: 12px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      cursor: pointer;
      transition: box-shadow 0.2s, transform 0.2s;
      border: 1px solid transparent;
    }
    .card:hover {
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    .card.dragging {
      opacity: 0.5;
      transform: rotate(2deg);
    }
    .card-title {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 500;
      color: #333;
      line-height: 1.4;
    }
    .card-description {
      margin: 0 0 12px 0;
      font-size: 12px;
      color: #666;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
    }
    .card-labels {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .label {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 500;
    }
    .card-meta {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .priority {
      font-size: 12px;
      font-weight: 600;
    }
    .assignee {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #4a90d9;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
    }
    .drop-zone {
      min-height: 100px;
      border: 2px dashed #ccc;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
      font-size: 14px;
    }
    .drop-zone.active {
      border-color: #4a90d9;
      background: rgba(74, 144, 217, 0.1);
    }
    .status-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 6px;
    }
    .priority-low { color: #9e9e9e; }
    .priority-medium { color: #2196f3; }
    .priority-high { color: #ff9800; }
    .priority-critical { color: #f44336; }
  `.trim();
}

/**
 * Generate board markup
 */
function generateBoardMarkup(board: Board, props: WebComponentProps): string {
  const columnsHtml = board.columns.map(col => generateColumnMarkup(col)).join('');

  return `
    <div class="kanban-board" data-board-id="${board.id}">
      <header class="board-header">
        <h1 class="board-title">${escapeHtml(board.title)}</h1>
        ${board.description ? `<p class="board-description">${escapeHtml(board.description)}</p>` : ''}
      </header>
      <div class="columns-container">
        ${columnsHtml}
      </div>
    </div>
  `.trim();
}

/**
 * Generate column markup
 */
function generateColumnMarkup(column: Column): string {
  const cardsHtml = column.cards.map(card => generateCardMarkup(card)).join('');
  const statusColor = statusColors[column.status];

  return `
    <div class="column" data-column-id="${column.id}" data-status="${column.status}">
      <div class="column-header">
        <h3 class="column-title">
          <span class="status-indicator" style="background: ${statusColor}"></span>
          ${escapeHtml(column.title)}
        </h3>
        <span class="column-count">${column.cards.length}${column.wipLimit ? `/${column.wipLimit}` : ''}</span>
      </div>
      <div class="cards-container">
        ${cardsHtml || '<div class="drop-zone">Drop cards here</div>'}
      </div>
    </div>
  `.trim();
}

/**
 * Generate card markup
 */
function generateCardMarkup(card: Card): string {
  const labelsHtml = card.labels.map((label, i) => {
    const color = labelColors[i % labelColors.length];
    return `<span class="label" style="background: ${color}; color: #333">${escapeHtml(label)}</span>`;
  }).join('');

  const priorityClass = `priority-${card.priority}`;
  const assigneeInitial = card.assignee ? card.assignee.charAt(0).toUpperCase() : '?';

  return `
    <div class="card" data-card-id="${card.id}" draggable="true">
      <h4 class="card-title">${escapeHtml(card.title)}</h4>
      ${card.description ? `<p class="card-description">${escapeHtml(card.description)}</p>` : ''}
      <div class="card-footer">
        <div class="card-labels">
          ${labelsHtml}
        </div>
        <div class="card-meta">
          <span class="priority ${priorityClass}">${getPrioritySymbol(card.priority)}</span>
          ${card.assignee ? `<div class="assignee" title="${escapeHtml(card.assignee)}">${assigneeInitial}</div>` : ''}
        </div>
      </div>
    </div>
  `.trim();
}

/**
 * Generate client-side JavaScript
 */
function generateClientJS(readOnly = false): string {
  if (readOnly) {
    return `
      document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', () => {
          console.log('Card clicked:', card.dataset.cardId);
        });
      });
    `.trim();
  }

  return `
    let draggedCard = null;
    let sourceColumn = null;

    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedCard = card;
        sourceColumn = card.closest('.column');
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        draggedCard = null;
        sourceColumn = null;
      });

      card.addEventListener('click', () => {
        console.log('Card clicked:', card.dataset.cardId);
      });
    });

    document.querySelectorAll('.column').forEach(column => {
      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      column.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggedCard) return;

        const targetColumn = column;
        const cardsContainer = targetColumn.querySelector('.cards-container');
        const dropZone = cardsContainer.querySelector('.drop-zone');

        if (dropZone) {
          dropZone.remove();
        }

        cardsContainer.appendChild(draggedCard);

        // Update counts
        updateColumnCounts();

        // Dispatch event
        window.dispatchEvent(new CustomEvent('cardmoved', {
          detail: {
            cardId: draggedCard.dataset.cardId,
            sourceColumnId: sourceColumn?.dataset.columnId,
            targetColumnId: targetColumn.dataset.columnId
          }
        }));
      });
    });

    function updateColumnCounts() {
      document.querySelectorAll('.column').forEach(column => {
        const count = column.querySelectorAll('.card').length;
        const countEl = column.querySelector('.column-count');
        const wipLimit = countEl.textContent.includes('/') ? '/' + countEl.textContent.split('/')[1] : '';
        countEl.textContent = count + wipLimit;
      });
    }
  `.trim();
}

/**
 * Helper: Escape HTML
 */
function escapeHtml(text: string): string {
  const div = { toString: () => text };
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Helper: Get priority symbol
 */
function getPrioritySymbol(priority: CardPriority): string {
  const symbols: Record<CardPriority, string> = {
    low: '↓',
    medium: '→',
    high: '↑',
    critical: '‼'
  };
  return symbols[priority];
}

/**
 * React-style component props interfaces
 */
export interface KanbanBoardProps extends WebComponentProps {
  className?: string;
  style?: Record<string, string>;
}

export interface KanbanColumnProps {
  column: Column;
  onCardClick?: (card: Card) => void;
  onDrop?: (cardId: string, targetColumnId: string) => void;
  readOnly?: boolean;
}

export interface KanbanCardProps {
  card: Card;
  onClick?: (card: Card) => void;
  draggable?: boolean;
  onDragStart?: (card: Card) => void;
}

/**
 * Filter cards for web view
 */
export function filterCardsForWeb(cards: Card[], criteria?: FilterCriteria): Card[] {
  if (!criteria) return cards;

  return cards.filter(card => {
    if (criteria.status?.length && !criteria.status.includes(card.status)) return false;
    if (criteria.priority?.length && !criteria.priority.includes(card.priority)) return false;
    if (criteria.assignee?.length && (!card.assignee || !criteria.assignee.includes(card.assignee))) return false;
    if (criteria.labels?.length && !criteria.labels.some(l => card.labels.includes(l))) return false;
    if (criteria.search) {
      const search = criteria.search.toLowerCase();
      const matches = card.title.toLowerCase().includes(search) ||
                     card.description?.toLowerCase().includes(search);
      if (!matches) return false;
    }
    return true;
  });
}

/**
 * Export board data as JSON
 */
export function exportBoardToJSON(board: Board): string {
  return JSON.stringify(board, null, 2);
}

/**
 * Create a minimal web server handler
 */
export function createWebHandler(board: Board): (req: { url: string }) => { status: number; headers: Record<string, string>; body: string } {
  return (req) => {
    if (req.url === '/api/board') {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: exportBoardToJSON(board)
      };
    }

    if (req.url === '/') {
      return {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
        body: generateBoardHTML(board)
      };
    }

    return {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Not Found'
    };
  };
}
