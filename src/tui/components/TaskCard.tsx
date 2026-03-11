/**
 * TaskCard component for Kanban board
 * Displays individual task with issue number, title, and status icon
 */

import React from 'react';
import { Text, Box } from 'ink';
import { useTheme } from '../hooks/useTheme';
import { ThemeColors } from '../theme/types';
import {
  KanbanTask,
  STATUS_ICONS,
  PRIORITY_ICONS,
  TaskPriority,
} from '../types/kanban';

interface TaskCardProps {
  task: KanbanTask;
  isSelected?: boolean;
  isMoving?: boolean;
  showPriority?: boolean;
  maxWidth?: number;
}

/**
 * Get priority color based on priority level
 */
const getPriorityColor = (priority: TaskPriority | undefined, colors: ThemeColors): string => {
  switch (priority) {
    case 'urgent':
      return colors.error;
    case 'high':
      return colors.warning;
    case 'medium':
      return colors.info;
    case 'low':
    default:
      return colors.muted;
  }
};

/**
 * Truncate text to fit within max width
 */
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
};

/**
 * TaskCard component - Individual task card for Kanban columns
 */
export function TaskCard({
  task,
  isSelected = false,
  isMoving = false,
  showPriority = true,
  maxWidth = 18,
}: TaskCardProps): React.ReactElement {
  const { colors } = useTheme();

  const statusIcon = STATUS_ICONS[task.status];
  const priorityIcon = task.priority ? PRIORITY_ICONS[task.priority] : '';
  const priorityColor = getPriorityColor(task.priority, colors);

  // Format title to fit
  const titleDisplay = truncateText(task.title, maxWidth - 6);

  // Border style based on selection state
  const borderStyle = isSelected ? 'bold' : 'single';
  const borderColor = isSelected
    ? colors.primary
    : isMoving
    ? colors.warning
    : colors.border;

  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      borderStyle,
      borderColor,
      paddingX: 1,
      marginBottom: 1,
      width: maxWidth,
    },
    // Issue number and status icon row
    React.createElement(
      Box,
      { justifyContent: 'space-between' },
      React.createElement(
        Text,
        { bold: true, color: colors.secondary },
        `#${task.issueNumber}`
      ),
      React.createElement(Text, {}, statusIcon)
    ),
    // Title row
    React.createElement(
      Box,
      { marginTop: 0 },
      React.createElement(
        Text,
        {
          color: isSelected ? colors.text : colors.muted,
          dimColor: !isSelected,
        },
        titleDisplay
      )
    ),
    // Priority indicator (if enabled and priority exists)
    showPriority && task.priority && React.createElement(
      Box,
      { marginTop: 0 },
      React.createElement(
        Text,
        { color: priorityColor },
        `${priorityIcon} ${task.priority}`
      )
    ),
    // Moving indicator
    isMoving && React.createElement(
      Box,
      { marginTop: 0 },
      React.createElement(
        Text,
        { color: colors.warning, bold: true },
        '↔ MOVING'
      )
    )
  );
}

export default TaskCard;
