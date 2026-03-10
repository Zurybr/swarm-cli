/**
 * Kanban Terminal Renderer
 * Renders Kanban boards in the terminal with ASCII/Unicode box-drawing characters
 */

import type {
  Board,
  Column,
  Card,
  CardStatus,
  CardPriority,
  TerminalRenderOptions
} from './types';

// Box drawing characters
const BOX = {
  ascii: {
    h: '-',
    v: '|',
    tl: '+',
    tr: '+',
    bl: '+',
    br: '+',
    t: '+',
    b: '+',
    l: '+',
    r: '+'
  },
  unicode: {
    h: '─',
    v: '│',
    tl: '┌',
    tr: '┐',
    bl: '└',
    br: '┘',
    t: '┬',
    b: '┴',
    l: '├',
    r: '┤'
  }
};

// Status colors and symbols
const STATUS_STYLES: Record<CardStatus, { symbol: string; color: string }> = {
  backlog: { symbol: '○', color: '\x1b[90m' },    // Gray
  todo: { symbol: '◯', color: '\x1b[37m' },       // White
  in_progress: { symbol: '◐', color: '\x1b[33m' }, // Yellow
  review: { symbol: '◑', color: '\x1b[34m' },     // Blue
  done: { symbol: '●', color: '\x1b[32m' }        // Green
};

const PRIORITY_STYLES: Record<CardPriority, { symbol: string; color: string }> = {
  low: { symbol: '↓', color: '\x1b[90m' },       // Gray
  medium: { symbol: '→', color: '\x1b[37m' },    // White
  high: { symbol: '↑', color: '\x1b[33m' },      // Yellow
  critical: { symbol: '‼', color: '\x1b[31m' }   // Red
};

const RESET = '\x1b[0m';

export class TerminalRenderer {
  private options: Required<TerminalRenderOptions>;
  private chars: typeof BOX.unicode;

  constructor(options: TerminalRenderOptions = {}) {
    this.options = {
      width: options.width || 120,
      height: options.height || 40,
      showLabels: options.showLabels ?? true,
      showAssignee: options.showAssignee ?? true,
      showPriority: options.showPriority ?? true,
      showDates: options.showDates ?? false,
      compact: options.compact ?? false,
      theme: options.theme || 'default',
      unicode: options.unicode ?? true,
      colors: options.colors ?? true,
      interactive: options.interactive ?? false
    };
    this.chars = this.options.unicode ? BOX.unicode : BOX.ascii;
  }

  /**
   * Render a complete board
   */
  render(board: Board): string {
    const lines: string[] = [];

    // Header
    lines.push(this.renderHeader(board.title));
    if (board.description) {
      lines.push(this.wrapText(board.description, this.options.width - 4));
      lines.push('');
    }

    // Calculate column widths
    const colCount = board.columns.length;
    const colWidth = Math.floor((this.options.width - (colCount + 1)) / colCount);

    // Column headers
    lines.push(this.renderColumnHeaders(board.columns, colWidth));

    // Column contents
    lines.push(...this.renderColumns(board.columns, colWidth));

    // Footer
    lines.push(this.renderFooter(board));

    return lines.join('\n');
  }

  /**
   * Render a single column
   */
  renderColumn(column: Column, width: number): string {
    const lines: string[] = [];

    // Column header
    const wipIndicator = column.wipLimit
      ? ` (${column.cards.length}/${column.wipLimit})`
      : ` (${column.cards.length})`;
    const headerText = this.truncate(column.title + wipIndicator, width - 4);
    lines.push(this.colorize(
      `${this.chars.tl}${this.repeat(this.chars.h, width - 2)}${this.chars.tr}`,
      'header'
    ));
    lines.push(this.colorize(
      `${this.chars.v} ${headerText.padEnd(width - 4)} ${this.chars.v}`,
      'header'
    ));
    lines.push(this.colorize(
      `${this.chars.l}${this.repeat(this.chars.h, width - 2)}${this.chars.r}`,
      'header'
    ));

    // Cards
    for (const card of column.cards) {
      const cardLines = this.renderCard(card, width - 2).split('\n');
      for (const line of cardLines) {
        lines.push(`${this.chars.v}${line}${this.chars.v}`);
      }
    }

    // Empty state
    if (column.cards.length === 0) {
      const emptyText = this.options.compact ? '' : 'No cards';
      lines.push(`${this.chars.v} ${emptyText.padEnd(width - 4)} ${this.chars.v}`);
    }

    // Column footer
    lines.push(this.colorize(
      `${this.chars.bl}${this.repeat(this.chars.h, width - 2)}${this.chars.br}`,
      'header'
    ));

    return lines.join('\n');
  }

  /**
   * Render a single card
   */
  renderCard(card: Card, width: number): string {
    const lines: string[] = [];
    const innerWidth = width - 2;

    // Top border
    lines.push(`${this.chars.tl}${this.repeat(this.chars.h, innerWidth)}${this.chars.tr}`);

    // Status and priority indicator
    const status = STATUS_STYLES[card.status];
    const priority = PRIORITY_STYLES[card.priority];
    const indicator = this.options.showPriority
      ? `${this.colorize(status.symbol, status.color)} ${this.colorize(priority.symbol, priority.color)}`
      : this.colorize(status.symbol, status.color);

    // Title
    const titleLines = this.wrapText(card.title, innerWidth - 6).split('\n');
    lines.push(`${this.chars.v} ${indicator} ${this.truncate(titleLines[0], innerWidth - 6).padEnd(innerWidth - 4)} ${this.chars.v}`);
    for (let i = 1; i < titleLines.length; i++) {
      lines.push(`${this.chars.v}     ${this.truncate(titleLines[i], innerWidth - 6).padEnd(innerWidth - 4)} ${this.chars.v}`);
    }

    // Description (if not compact)
    if (!this.options.compact && card.description) {
      const descLines = this.wrapText(card.description, innerWidth - 4).split('\n');
      const maxDescLines = 3;
      for (let i = 0; i < Math.min(descLines.length, maxDescLines); i++) {
        lines.push(`${this.chars.v}  ${descLines[i].padEnd(innerWidth - 4)} ${this.chars.v}`);
      }
      if (descLines.length > maxDescLines) {
        lines.push(`${this.chars.v}  ${'...'.padEnd(innerWidth - 4)} ${this.chars.v}`);
      }
    }

    // Labels
    if (this.options.showLabels && card.labels.length > 0) {
      const labelText = card.labels.slice(0, 3).join(', ');
      lines.push(`${this.chars.v}  ${this.colorize(labelText, '\x1b[36m').padEnd(innerWidth - 4 + (this.options.colors ? 0 : 5))} ${this.chars.v}`);
    }

    // Assignee
    if (this.options.showAssignee && card.assignee) {
      const assigneeText = `@${card.assignee}`;
      lines.push(`${this.chars.v}  ${this.colorize(assigneeText, '\x1b[35m').padEnd(innerWidth - 4 + (this.options.colors ? 0 : 5))} ${this.chars.v}`);
    }

    // Dates
    if (this.options.showDates) {
      const dateText = this.formatDate(card.updatedAt);
      lines.push(`${this.chars.v}  ${dateText.padEnd(innerWidth - 4)} ${this.chars.v}`);
    }

    // Bottom border
    lines.push(`${this.chars.bl}${this.repeat(this.chars.h, innerWidth)}${this.chars.br}`);

    return lines.join('\n');
  }

  /**
   * Render board header
   */
  private renderHeader(title: string): string {
    const width = this.options.width;
    const lines: string[] = [];

    lines.push(this.repeat('=', width));
    lines.push(`  ${title}`);
    lines.push(this.repeat('=', width));

    return lines.join('\n');
  }

  /**
   * Render column headers in a row
   */
  private renderColumnHeaders(columns: Column[], colWidth: number): string {
    // Headers are now part of renderColumns
    return '';
  }

  /**
   * Render all columns side by side
   */
  private renderColumns(columns: Column[], colWidth: number): string[] {
    const renderedColumns = columns.map(col => this.renderColumn(col, colWidth));
    const columnLines = renderedColumns.map(col => col.split('\n'));

    const maxLines = Math.max(...columnLines.map(lines => lines.length));
    const result: string[] = [];

    for (let i = 0; i < maxLines; i++) {
      let line = '';
      for (let j = 0; j < columnLines.length; j++) {
        const colLine = columnLines[j][i] || ' '.repeat(colWidth);
        line += colLine + ' ';
      }
      result.push(line);
    }

    return result;
  }

  /**
   * Render board footer
   */
  private renderFooter(board: Board): string {
    const totalCards = board.columns.reduce((sum, col) => sum + col.cards.length, 0);
    const footerText = `Total: ${totalCards} cards in ${board.columns.length} columns`;
    return `\n${footerText}`;
  }

  /**
   * Helper: Repeat a character
   */
  private repeat(char: string, count: number): string {
    return char.repeat(Math.max(0, count));
  }

  /**
   * Helper: Truncate text
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  /**
   * Helper: Wrap text to multiple lines
   */
  private wrapText(text: string, maxWidth: number): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + word).length > maxWidth) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    }
    lines.push(currentLine.trim());

    return lines.join('\n');
  }

  /**
   * Helper: Colorize text
   */
  private colorize(text: string, color: string): string {
    if (!this.options.colors) return text;
    if (color.startsWith('\x1b[')) {
      return `${color}${text}${RESET}`;
    }
    return text;
  }

  /**
   * Helper: Format date
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }
}

/**
 * Create a terminal renderer with options
 */
export function createRenderer(options?: TerminalRenderOptions): TerminalRenderer {
  return new TerminalRenderer(options);
}

/**
 * Render a board to string
 */
export function renderBoard(board: Board, options?: TerminalRenderOptions): string {
  const renderer = new TerminalRenderer(options);
  return renderer.render(board);
}

/**
 * Render a single card to string
 */
export function renderCard(card: Card, options?: TerminalRenderOptions): string {
  const renderer = new TerminalRenderer({ ...options, width: 40 });
  return renderer.renderCard(card, 38);
}
