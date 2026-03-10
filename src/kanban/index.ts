/**
 * Kanban System - Main Entry Point
 * Unified Kanban visualization for CLI, Web, and Terminal
 */

import type {
  Board,
  Column,
  Card,
  CardStatus,
  CardPriority,
  View,
  Filter,
  FilterCriteria,
  KanbanSystemConfig,
  TerminalRenderOptions,
  WebComponentProps,
  DragDropEvent
} from './types';

import { TerminalRenderer, renderBoard, renderCard } from './renderer';
import { DragDropManager, createDragDropManager, isMoveAllowed } from './dragdrop';
import { CardFilter, defaultFilters } from './filter';
import { ViewManager, viewPresets } from './views';
import { generateBoardHTML, createWebHandler, filterCardsForWeb } from './web';

export * from './types';
export * from './renderer';
export * from './dragdrop';
export * from './filter';
export * from './views';
export * from './web';

export class KanbanSystem {
  private board: Board;
  private config: KanbanSystemConfig;
  private filter: CardFilter;
  private viewManager: ViewManager;
  private dragDrop: DragDropManager;
  private renderer: TerminalRenderer;

  constructor(config: Partial<KanbanSystemConfig> = {}) {
    this.config = {
      defaultColumns: ['backlog', 'todo', 'in_progress', 'review', 'done'],
      enableWipLimits: true,
      enableDragDrop: true,
      enableFiltering: true,
      enableViews: true,
      storageType: 'memory',
      ...config
    };

    this.filter = new CardFilter();
    this.viewManager = new ViewManager();
    this.dragDrop = new DragDropManager();
    this.renderer = new TerminalRenderer();
    this.board = this.createDefaultBoard();

    this.setupEventHandlers();
  }

  /**
   * Get the current board
   */
  getBoard(): Board {
    return this.board;
  }

  /**
   * Set a new board
   */
  setBoard(board: Board): void {
    this.board = board;
    this.dragDrop.setBoard(board);
  }

  /**
   * Create a new board with default columns
   */
  createBoard(title: string, description?: string): Board {
    this.board = {
      id: this.generateId(),
      title,
      description,
      columns: this.config.defaultColumns.map((status, index) => ({
        id: `col-${status}`,
        title: this.formatStatus(status),
        status: status as CardStatus,
        cards: [],
        order: index
      })),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.dragDrop.setBoard(this.board);
    return this.board;
  }

  /**
   * Add a card to the board
   */
  addCard(card: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>): Card {
    const newCard: Card = {
      ...card,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const column = this.board.columns.find(c => c.status === card.status);
    if (column) {
      column.cards.push(newCard);
      this.board.updatedAt = new Date();
    }

    return newCard;
  }

  /**
   * Update a card
   */
  updateCard(cardId: string, updates: Partial<Omit<Card, 'id'>>): Card | undefined {
    for (const column of this.board.columns) {
      const cardIndex = column.cards.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        const card = column.cards[cardIndex];

        // If status changed, move to different column
        if (updates.status && updates.status !== card.status) {
          column.cards.splice(cardIndex, 1);
          const newColumn = this.board.columns.find(c => c.status === updates.status);
          if (newColumn) {
            const updatedCard = { ...card, ...updates, updatedAt: new Date() };
            newColumn.cards.push(updatedCard);
            this.board.updatedAt = new Date();
            return updatedCard;
          }
        }

        const updatedCard = { ...card, ...updates, updatedAt: new Date() };
        column.cards[cardIndex] = updatedCard;
        this.board.updatedAt = new Date();
        return updatedCard;
      }
    }
    return undefined;
  }

  /**
   * Delete a card
   */
  deleteCard(cardId: string): boolean {
    for (const column of this.board.columns) {
      const cardIndex = column.cards.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        column.cards.splice(cardIndex, 1);
        this.board.updatedAt = new Date();
        return true;
      }
    }
    return false;
  }

  /**
   * Move a card between columns
   */
  moveCard(cardId: string, targetColumnId: string, targetIndex?: number): boolean {
    return this.dragDrop.moveCard(cardId, this.findCardColumnId(cardId) || '', targetColumnId, targetIndex);
  }

  /**
   * Get a card by ID
   */
  getCard(cardId: string): Card | undefined {
    for (const column of this.board.columns) {
      const card = column.cards.find(c => c.id === cardId);
      if (card) return card;
    }
    return undefined;
  }

  /**
   * Get all cards
   */
  getAllCards(): Card[] {
    return this.board.columns.flatMap(col => col.cards);
  }

  /**
   * Filter cards
   */
  filterCards(criteria: FilterCriteria): Card[] {
    return this.filter.apply(this.getAllCards(), criteria);
  }

  /**
   * Create a filter
   */
  createFilter(name: string, criteria: FilterCriteria): Filter {
    return this.filter.createFilter(name, criteria);
  }

  /**
   * Create a view
   */
  createView(name: string, type: View['type'], config?: Partial<Omit<View, 'id' | 'name' | 'type'>>): View {
    return this.viewManager.createView(name, type, config);
  }

  /**
   * Apply a view to the board
   */
  applyView(viewId: string): Board {
    const view = this.viewManager.getView(viewId);
    if (!view) return this.board;
    return this.viewManager.applyView(this.board, view);
  }

  /**
   * Render the board to terminal
   */
  renderToTerminal(options?: TerminalRenderOptions): string {
    this.renderer = new TerminalRenderer(options);
    return this.renderer.render(this.board);
  }

  /**
   * Generate HTML for web view
   */
  generateWebView(props?: WebComponentProps): string {
    return generateBoardHTML(this.board, props);
  }

  /**
   * Create a web server handler
   */
  createWebHandler() {
    return createWebHandler(this.board);
  }

  /**
   * Start drag operation
   */
  dragStart(cardId: string, sourceColumnId: string): void {
    if (this.config.enableDragDrop) {
      this.dragDrop.dragStart(cardId, sourceColumnId);
    }
  }

  /**
   * Handle drag over
   */
  dragOver(targetColumnId: string, targetIndex?: number): void {
    if (this.config.enableDragDrop) {
      this.dragDrop.dragOver(targetColumnId, targetIndex);
    }
  }

  /**
   * Drop the card
   */
  drop(): boolean {
    if (!this.config.enableDragDrop) return false;
    return this.dragDrop.drop();
  }

  /**
   * End drag operation
   */
  dragEnd(): void {
    if (this.config.enableDragDrop) {
      this.dragDrop.dragEnd();
    }
  }

  /**
   * Subscribe to drag-drop events
   */
  onCardMove(handler: (event: DragDropEvent) => void): () => void {
    return this.dragDrop.subscribe(handler);
  }

  /**
   * Export board to JSON
   */
  exportToJSON(): string {
    return JSON.stringify(this.board, null, 2);
  }

  /**
   * Import board from JSON
   */
  importFromJSON(json: string): void {
    const data = JSON.parse(json);
    this.board = {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      columns: data.columns.map((col: Column) => ({
        ...col,
        cards: col.cards.map((card: Card) => ({
          ...card,
          createdAt: new Date(card.createdAt),
          updatedAt: new Date(card.updatedAt),
          dueDate: card.dueDate ? new Date(card.dueDate) : undefined
        }))
      }))
    };
    this.dragDrop.setBoard(this.board);
  }

  /**
   * Get board statistics
   */
  getStats(): {
    totalCards: number;
    cardsByStatus: Record<CardStatus, number>;
    cardsByPriority: Record<CardPriority, number>;
    unassignedCards: number;
    overdueCards: number;
  } {
    const cards = this.getAllCards();
    const now = new Date();

    return {
      totalCards: cards.length,
      cardsByStatus: {
        backlog: cards.filter(c => c.status === 'backlog').length,
        todo: cards.filter(c => c.status === 'todo').length,
        in_progress: cards.filter(c => c.status === 'in_progress').length,
        review: cards.filter(c => c.status === 'review').length,
        done: cards.filter(c => c.status === 'done').length
      },
      cardsByPriority: {
        low: cards.filter(c => c.priority === 'low').length,
        medium: cards.filter(c => c.priority === 'medium').length,
        high: cards.filter(c => c.priority === 'high').length,
        critical: cards.filter(c => c.priority === 'critical').length
      },
      unassignedCards: cards.filter(c => !c.assignee).length,
      overdueCards: cards.filter(c => c.dueDate && c.dueDate < now).length
    };
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.dragDrop.subscribe((event) => {
      if (event.type === 'drop') {
        this.board.updatedAt = new Date();
      }
    });
  }

  /**
   * Create default board
   */
  private createDefaultBoard(): Board {
    return this.createBoard('New Board');
  }

  /**
   * Find which column contains a card
   */
  private findCardColumnId(cardId: string): string | undefined {
    for (const column of this.board.columns) {
      if (column.cards.some(c => c.id === cardId)) {
        return column.id;
      }
    }
    return undefined;
  }

  /**
   * Format status for display
   */
  private formatStatus(status: string): string {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `kanban-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create a new Kanban system instance
 */
export function createKanbanSystem(config?: Partial<KanbanSystemConfig>): KanbanSystem {
  return new KanbanSystem(config);
}

/**
 * Create a sample board with demo data
 */
export function createSampleBoard(): Board {
  const system = new KanbanSystem();
  const board = system.createBoard('Project Alpha', 'A sample Kanban board');

  // Add sample cards
  system.addCard({
    title: 'Design system architecture',
    description: 'Create initial architecture diagrams and documentation',
    status: 'done',
    priority: 'high',
    assignee: 'alice',
    labels: ['design', 'architecture']
  });

  system.addCard({
    title: 'Implement authentication',
    description: 'Add user login and registration',
    status: 'in_progress',
    priority: 'high',
    assignee: 'bob',
    labels: ['backend', 'auth']
  });

  system.addCard({
    title: 'Create landing page',
    description: 'Design and implement the marketing landing page',
    status: 'todo',
    priority: 'medium',
    assignee: 'carol',
    labels: ['frontend', 'design']
  });

  system.addCard({
    title: 'Setup CI/CD pipeline',
    description: 'Configure GitHub Actions for automated testing and deployment',
    status: 'backlog',
    priority: 'medium',
    labels: ['devops']
  });

  system.addCard({
    title: 'Write API documentation',
    description: 'Document all REST API endpoints',
    status: 'review',
    priority: 'low',
    assignee: 'alice',
    labels: ['docs']
  });

  return board;
}

export default KanbanSystem;
