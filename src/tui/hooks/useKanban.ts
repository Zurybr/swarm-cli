/**
 * Hook for Kanban board state management
 * Handles navigation, task selection, and movement
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useInput, Key } from 'ink';
import {
  KanbanTask,
  KanbanStatus,
  KanbanColumn,
  KanbanPosition,
  UseKanbanReturn,
  COLUMN_CONFIG,
} from '../types/kanban';

/**
 * Sample data for development/demo purposes
 */
const createSampleTasks = (): Record<KanbanStatus, KanbanTask[]> => ({
  backlog: [
    { id: 'task-126', issueNumber: 126, title: 'Dashboard', status: 'backlog' },
    { id: 'task-127', issueNumber: 127, title: 'User Settings', status: 'backlog', priority: 'medium' },
    { id: 'task-128', issueNumber: 128, title: 'Notifications', status: 'backlog', priority: 'low' },
  ],
  in_progress: [
    { id: 'task-125', issueNumber: 125, title: 'API Design', status: 'in_progress' as KanbanStatus, priority: 'high' },
  ],
  review: [
    { id: 'task-124', issueNumber: 124, title: 'Tests', status: 'review', priority: 'medium' },
  ],
  done: [
    { id: 'task-122', issueNumber: 122, title: 'Setup', status: 'done' },
    { id: 'task-121', issueNumber: 121, title: 'Init', status: 'done' },
  ],
});

/**
 * Create columns from task data
 */
const createColumns = (tasks: Record<KanbanStatus, KanbanTask[]>): KanbanColumn[] => {
  return (['backlog', 'in_progress', 'review', 'done'] as KanbanStatus[]).map((status) => ({
    ...COLUMN_CONFIG[status],
    tasks: tasks[status] || [],
  }));
};

export interface UseKanbanOptions {
  initialTasks?: Record<KanbanStatus, KanbanTask[]>;
  onTaskSelect?: (task: KanbanTask) => void;
  onTaskMove?: (task: KanbanTask, fromStatus: KanbanStatus, toStatus: KanbanStatus) => void;
  onRefresh?: () => Promise<Record<KanbanStatus, KanbanTask[]>>;
  enabled?: boolean;
}

/**
 * Main Kanban hook with navigation and state management
 */
export function useKanban(options: UseKanbanOptions = {}): UseKanbanReturn {
  const {
    initialTasks = createSampleTasks(),
    onTaskSelect,
    onTaskMove,
    onRefresh,
    enabled = true,
  } = options;

  const [columns, setColumnsState] = useState<KanbanColumn[]>(() => createColumns(initialTasks));
  const [position, setPosition] = useState<KanbanPosition>({
    columnIndex: 0,
    taskIndex: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [selectedTaskForMove, setSelectedTaskForMove] = useState<KanbanTask | undefined>();

  // Derived state
  const currentColumn = useMemo(() => {
    return columns[position.columnIndex] || null;
  }, [columns, position.columnIndex]);

  const currentTask = useMemo(() => {
    if (!currentColumn || position.taskIndex < 0) return null;
    return currentColumn.tasks[position.taskIndex] || null;
  }, [currentColumn, position.taskIndex]);

  const isMovingTask = selectedTaskForMove !== undefined;

  // Navigation actions
  const moveLeft = useCallback(() => {
    setPosition((prev) => ({
      ...prev,
      columnIndex: Math.max(0, prev.columnIndex - 1),
      taskIndex: 0,
    }));
  }, []);

  const moveRight = useCallback(() => {
    setPosition((prev) => ({
      ...prev,
      columnIndex: Math.min(columns.length - 1, prev.columnIndex + 1),
      taskIndex: 0,
    }));
  }, [columns.length]);

  const moveUp = useCallback(() => {
    setPosition((prev) => {
      if (!currentColumn) return prev;
      const maxTaskIndex = Math.max(0, currentColumn.tasks.length - 1);
      return {
        ...prev,
        taskIndex: Math.max(0, prev.taskIndex - 1),
      };
    });
  }, [currentColumn]);

  const moveDown = useCallback(() => {
    setPosition((prev) => {
      if (!currentColumn) return prev;
      const maxTaskIndex = Math.max(0, currentColumn.tasks.length - 1);
      return {
        ...prev,
        taskIndex: Math.min(maxTaskIndex, prev.taskIndex + 1),
      };
    });
  }, [currentColumn]);

  // Task actions
  const selectCurrentTask = useCallback(() => {
    if (currentTask && onTaskSelect) {
      onTaskSelect(currentTask);
    }
  }, [currentTask, onTaskSelect]);

  const viewTaskDetails = useCallback((task: KanbanTask) => {
    if (onTaskSelect) {
      onTaskSelect(task);
    }
  }, [onTaskSelect]);

  const startMoveTask = useCallback(() => {
    if (currentTask) {
      setSelectedTaskForMove(currentTask);
    }
  }, [currentTask]);

  const completeMoveTask = useCallback((targetStatus: KanbanStatus) => {
    if (!selectedTaskForMove) return;

    const sourceStatus = selectedTaskForMove.status;
    if (sourceStatus === targetStatus) {
      setSelectedTaskForMove(undefined);
      return;
    }

    // Update columns state
    setColumnsState((prevColumns) => {
      return prevColumns.map((column) => {
        if (column.id === sourceStatus) {
          // Remove task from source column
          return {
            ...column,
            tasks: column.tasks.filter((t) => t.id !== selectedTaskForMove.id),
          };
        }
        if (column.id === targetStatus) {
          // Add task to target column
          const updatedTask = { ...selectedTaskForMove, status: targetStatus };
          return {
            ...column,
            tasks: [...column.tasks, updatedTask],
          };
        }
        return column;
      });
    });

    // Callback
    if (onTaskMove) {
      onTaskMove(selectedTaskForMove, sourceStatus, targetStatus);
    }

    setSelectedTaskForMove(undefined);
  }, [selectedTaskForMove, onTaskMove]);

  const cancelMoveTask = useCallback(() => {
    setSelectedTaskForMove(undefined);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      if (onRefresh) {
        const newTasks = await onRefresh();
        setColumnsState(createColumns(newTasks));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setIsLoading(false);
    }
  }, [onRefresh]);

  const setColumns = useCallback((newColumns: KanbanColumn[]) => {
    setColumnsState(newColumns);
  }, []);

  // Keyboard input handling
  useInput(
    (input: string, key: Key) => {
      if (!enabled) return;

      if (key.leftArrow) {
        moveLeft();
      } else if (key.rightArrow) {
        moveRight();
      } else if (key.upArrow) {
        moveUp();
      } else if (key.downArrow) {
        moveDown();
      } else if (key.return) {
        if (isMovingTask && currentColumn) {
          completeMoveTask(currentColumn.id);
        } else {
          selectCurrentTask();
        }
      } else if (input === 'm' || input === 'M') {
        if (isMovingTask) {
          cancelMoveTask();
        } else {
          startMoveTask();
        }
      } else if (key.escape) {
        if (isMovingTask) {
          cancelMoveTask();
        }
      } else if (input === 'r' || input === 'R') {
        refresh();
      }
    },
    { isActive: enabled }
  );

  // Adjust task index when column changes
  useEffect(() => {
    setPosition((prev) => {
      const column = columns[prev.columnIndex];
      if (!column) return prev;
      const maxIndex = Math.max(0, column.tasks.length - 1);
      if (prev.taskIndex > maxIndex) {
        return { ...prev, taskIndex: maxIndex };
      }
      return prev;
    });
  }, [columns, position.columnIndex]);

  return {
    // State
    columns,
    position,
    isLoading,
    error,
    selectedTaskForMove,
    // Derived
    currentTask,
    currentColumn,
    isMovingTask,
    // Actions
    moveLeft,
    moveRight,
    moveUp,
    moveDown,
    selectCurrentTask,
    viewTaskDetails,
    startMoveTask,
    completeMoveTask,
    cancelMoveTask,
    refresh,
    setColumns,
  };
}

export default useKanban;
