/**
 * KanbanColumn component for Kanban board
 * Individual column with header and task cards
 */

import React from 'react';
import { Text, Box } from 'ink';
import { useTheme } from '../hooks/useTheme';
import { TaskCard } from './TaskCard';
import { KanbanColumn as KanbanColumnType, KanbanPosition } from '../types/kanban';

interface KanbanColumnProps {
  column: KanbanColumnType;
  position: number;
  currentPosition: KanbanPosition;
  isMovingTask?: boolean;
  movingTaskId?: string;
  columnWidth?: number;
  maxVisibleTasks?: number;
}

/**
 * KanbanColumn component - Individual column with tasks
 */
export function KanbanColumn({
  column,
  position: columnIndex,
  currentPosition,
  isMovingTask = false,
  movingTaskId,
  columnWidth = 20,
  maxVisibleTasks = 8,
}: KanbanColumnProps): React.ReactElement {
  const { colors } = useTheme();

  const isSelected = currentPosition.columnIndex === columnIndex;
  const taskCount = column.tasks.length;

  // Determine which tasks to show (with scrolling for large columns)
  const visibleTasks = column.tasks.slice(0, maxVisibleTasks);
  const hasMoreTasks = taskCount > maxVisibleTasks;

  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      width: columnWidth,
      borderStyle: isSelected ? 'bold' : 'single',
      borderColor: isSelected ? colors.primary : colors.border,
      paddingX: 0,
    },
    // Column header
    React.createElement(
      Box,
      {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingX: 1,
        paddingBottom: 0,
      },
      React.createElement(
        Text,
        { bold: true, color: isSelected ? colors.primary : colors.secondary },
        `${column.statusIcon} ${column.title}`
      ),
      React.createElement(
        Text,
        { color: colors.muted, dimColor: true },
        `(${taskCount})`
      )
    ),
    // Header separator
    React.createElement(
      Box,
      { paddingX: 1 },
      React.createElement(
        Text,
        { color: isSelected ? colors.primary : colors.border },
        '─'.repeat(columnWidth - 4)
      )
    ),
    // Task cards container
    React.createElement(
      Box,
      { flexDirection: 'column', paddingX: 1, paddingTop: 1 },
      visibleTasks.length > 0
        ? visibleTasks.map((task, taskIndex) =>
            React.createElement(TaskCard, {
              key: task.id,
              task,
              isSelected: isSelected && currentPosition.taskIndex === taskIndex,
              isMoving: movingTaskId === task.id,
              showPriority: true,
              maxWidth: columnWidth - 4,
            })
          )
        : React.createElement(
            Text,
            { color: colors.muted, dimColor: true, italic: true },
            '  No tasks'
          )
    ),
    // "More tasks" indicator
    hasMoreTasks && React.createElement(
      Box,
      { paddingX: 1 },
      React.createElement(
        Text,
        { color: colors.muted, dimColor: true },
        `  +${taskCount - maxVisibleTasks} more...`
      )
    ),
    // Drop zone indicator when moving
    isMovingTask && isSelected && React.createElement(
      Box,
      {
        paddingX: 1,
        borderStyle: 'double',
        borderColor: colors.warning,
      },
      React.createElement(
        Text,
        { color: colors.warning, bold: true },
        '  ⤓ Drop here (Enter)'
      )
    )
  );
}

export default KanbanColumn;
