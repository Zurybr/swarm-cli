/**
 * Kanban Drag and Drop Logic
 * State management for drag-and-drop operations
 */

import type { DragDropState, DragDropEvent, Card, Column, Board } from './types';

export type DragDropHandler = (event: DragDropEvent) => void;

export class DragDropManager {
  private state: DragDropState = {
    isDragging: false
  };
  private handlers: Set<DragDropHandler> = new Set();
  private board: Board | null = null;

  constructor(board?: Board) {
    if (board) {
      this.board = board;
    }
  }

  /**
   * Set the board reference
   */
  setBoard(board: Board): void {
    this.board = board;
  }

  /**
   * Get current drag state
   */
  getState(): DragDropState {
    return { ...this.state };
  }

  /**
   * Check if currently dragging
   */
  isDragging(): boolean {
    return this.state.isDragging;
  }

  /**
   * Get the currently dragged card ID
   */
  getDraggedCardId(): string | undefined {
    return this.state.draggedCardId;
  }

  /**
   * Start dragging a card
   */
  dragStart(cardId: string, sourceColumnId: string): void {
    this.state = {
      isDragging: true,
      draggedCardId: cardId,
      sourceColumnId
    };

    this.emit({
      type: 'dragstart',
      cardId,
      sourceColumnId
    });
  }

  /**
   * Handle drag over a column
   */
  dragOver(targetColumnId: string, targetIndex?: number): void {
    if (!this.state.isDragging) return;

    this.state = {
      ...this.state,
      targetColumnId,
      targetIndex
    };

    if (this.state.draggedCardId && this.state.sourceColumnId) {
      this.emit({
        type: 'dragover',
        cardId: this.state.draggedCardId,
        sourceColumnId: this.state.sourceColumnId,
        targetColumnId,
        targetIndex
      });
    }
  }

  /**
   * Drop the card
   */
  drop(): boolean {
    if (!this.state.isDragging || !this.state.draggedCardId || !this.state.sourceColumnId) {
      return false;
    }

    const event: DragDropEvent = {
      type: 'drop',
      cardId: this.state.draggedCardId,
      sourceColumnId: this.state.sourceColumnId,
      targetColumnId: this.state.targetColumnId || this.state.sourceColumnId,
      targetIndex: this.state.targetIndex
    };

    this.emit(event);

    // Apply the move to the board if available
    if (this.board) {
      this.applyMove(event);
    }

    return true;
  }

  /**
   * End the drag operation
   */
  dragEnd(): void {
    if (!this.state.isDragging) return;

    const event: DragDropEvent = {
      type: 'dragend',
      cardId: this.state.draggedCardId!,
      sourceColumnId: this.state.sourceColumnId!
    };

    this.emit(event);

    this.state = {
      isDragging: false
    };
  }

  /**
   * Subscribe to drag-drop events
   */
  subscribe(handler: DragDropHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Unsubscribe from drag-drop events
   */
  unsubscribe(handler: DragDropHandler): void {
    this.handlers.delete(handler);
  }

  /**
   * Move a card between columns or within a column
   */
  moveCard(
    cardId: string,
    sourceColumnId: string,
    targetColumnId: string,
    targetIndex?: number
  ): boolean {
    if (!this.board) return false;

    const event: DragDropEvent = {
      type: 'drop',
      cardId,
      sourceColumnId,
      targetColumnId,
      targetIndex
    };

    return this.applyMove(event);
  }

  /**
   * Cancel the current drag operation
   */
  cancel(): void {
    this.state = {
      isDragging: false
    };
  }

  /**
   * Emit an event to all handlers
   */
  private emit(event: DragDropEvent): void {
    this.handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Drag-drop handler error:', error);
      }
    });
  }

  /**
   * Apply a move to the board
   */
  private applyMove(event: DragDropEvent): boolean {
    if (!this.board) return false;

    const sourceColumn = this.board.columns.find(c => c.id === event.sourceColumnId);
    const targetColumn = this.board.columns.find(c => c.id === event.targetColumnId);

    if (!sourceColumn || !targetColumn) return false;

    const cardIndex = sourceColumn.cards.findIndex(c => c.id === event.cardId);
    if (cardIndex === -1) return false;

    const [card] = sourceColumn.cards.splice(cardIndex, 1);

    // Update card status to match target column
    card.status = targetColumn.status;
    card.updatedAt = new Date();

    // Insert at target position
    if (event.targetIndex !== undefined && event.targetIndex >= 0) {
      targetColumn.cards.splice(event.targetIndex, 0, card);
    } else {
      targetColumn.cards.push(card);
    }

    return true;
  }
}

/**
 * Create a drag-drop manager for a board
 */
export function createDragDropManager(board?: Board): DragDropManager {
  return new DragDropManager(board);
}

/**
 * Validate if a move is allowed
 */
export function isMoveAllowed(
  card: Card,
  sourceColumn: Column,
  targetColumn: Column,
  wipLimits: Map<string, number> = new Map()
): { allowed: boolean; reason?: string } {
  // Check WIP limit
  const wipLimit = wipLimits.get(targetColumn.id);
  if (wipLimit !== undefined && targetColumn.cards.length >= wipLimit) {
    return { allowed: false, reason: 'WIP limit exceeded' };
  }

  // Check if card can move to target status
  const validTransitions: Record<string, string[]> = {
    backlog: ['todo'],
    todo: ['in_progress', 'backlog'],
    in_progress: ['review', 'todo', 'done'],
    review: ['done', 'in_progress'],
    done: ['review']
  };

  const allowedTargets = validTransitions[sourceColumn.status] || [];
  if (!allowedTargets.includes(targetColumn.status) && sourceColumn.id !== targetColumn.id) {
    return { allowed: false, reason: 'Invalid status transition' };
  }

  return { allowed: true };
}
