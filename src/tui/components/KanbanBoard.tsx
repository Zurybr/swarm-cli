/**
 * KanbanBoard component for Swarm CLI TUI
 * Main kanban board container with columns, navigation, and keyboard controls
 */

import React from 'react';
import { Text, Box, useStdout } from 'ink';
import { useTheme } from '../hooks/useTheme';
import { KanbanColumn } from './KanbanColumn';
import { useKanban, UseKanbanOptions } from '../hooks/useKanban';
import { KanbanTask, KanbanStatus } from '../types/kanban';

interface KanbanBoardProps {
  /** Initial tasks organized by status */
  initialTasks?: Record<KanbanStatus, KanbanTask[]>;
  /** Callback when a task is selected */
  onTaskSelect?: (task: KanbanTask) => void;
  /** Callback when a task is moved between columns */
  onTaskMove?: (task: KanbanTask, fromStatus: KanbanStatus, toStatus: KanbanStatus) => void;
  /** Callback to refresh task data */
  onRefresh?: () => Promise<Record<KanbanStatus, KanbanTask[]>>;
  /** Whether the board is enabled for interaction */
  enabled?: boolean;
  /** Column width in characters */
  columnWidth?: number;
  /** Show keyboard hints */
  showHints?: boolean;
}

/**
 * Keyboard hints for the status bar
 */
const KANBAN_KEY_HINTS = [
  { key: '←→', description: 'Navigate columns' },
  { key: '↑↓', description: 'Navigate tasks' },
  { key: 'Enter', description: 'View details' },
  { key: 'm', description: 'Move task' },
  { key: 'r', description: 'Refresh' },
];

/**
 * KanbanBoard component - Main kanban board with 4 columns
 * 
 * Layout:
 * ┌─ Backlog ─┬─ In Progress ─┬─ Review ─┬─ Done ─┐
 * │           │               │          │       │
 * │ #123      │ #125 🔄       │ #124 👀  │ #122 ✓│
 * │ Auth      │ API Design    │ Tests    │ Setup │
 * │           │               │          │       │
 * └───────────┴───────────────┴──────────┴───────┘
 */
export function KanbanBoard({
  initialTasks,
  onTaskSelect,
  onTaskMove,
  onRefresh,
  enabled = true,
  columnWidth = 20,
  showHints = true,
}: KanbanBoardProps): React.ReactElement {
  const { colors } = useTheme();
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns || 80;

  const kanbanOptions: UseKanbanOptions = {
    initialTasks,
    onTaskSelect,
    onTaskMove,
    onRefresh,
    enabled,
  };

  const {
    columns,
    position,
    currentTask,
    currentColumn,
    isMovingTask,
    selectedTaskForMove,
    isLoading,
    error,
  } = useKanban(kanbanOptions);

  // Calculate dynamic column width based on terminal width
  const availableWidth = terminalWidth - 4; // Account for borders and padding
  const dynamicColumnWidth = Math.min(columnWidth, Math.floor(availableWidth / columns.length) - 2);

  return React.createElement(
    Box,
    { flexDirection: 'column', flexGrow: 1 },
    // Header with current status
    React.createElement(
      Box,
      {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingX: 1,
        marginBottom: 1,
      },
      React.createElement(
        Text,
        { bold: true, color: colors.primary },
        '📋 Kanban Board'
      ),
      // Status indicators
      React.createElement(
        Box,
        { flexDirection: 'row' },
        isLoading && React.createElement(
          Text,
          { color: colors.warning },
          '⏳ Loading... '
        ),
        isMovingTask && React.createElement(
          Text,
          { color: colors.warning, bold: true },
          `📦 Moving: #${selectedTaskForMove?.issueNumber} (←→ to select column, Enter to drop, Esc to cancel)`
        ),
        currentTask && !isMovingTask && React.createElement(
          Text,
          { color: colors.muted },
          `Selected: #${currentTask.issueNumber} - ${currentTask.title}`
        )
      )
    ),
    // Error display
    error && React.createElement(
      Box,
      { paddingX: 1, marginBottom: 1 },
      React.createElement(
        Text,
        { color: colors.error },
        `⚠ Error: ${error}`
      )
    ),
    // Main board with columns
    React.createElement(
      Box,
      {
        flexDirection: 'row',
        flexGrow: 1,
        justifyContent: 'flex-start',
      },
      ...columns.map((column, index) =>
        React.createElement(KanbanColumn, {
          key: column.id,
          column,
          position: index,
          currentPosition: position,
          isMovingTask,
          movingTaskId: selectedTaskForMove?.id,
          columnWidth: dynamicColumnWidth,
        })
      )
    ),
    // Keyboard hints
    showHints && React.createElement(
      Box,
      {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 1,
        borderStyle: 'single',
        borderColor: colors.border,
        paddingX: 1,
      },
      ...KANBAN_KEY_HINTS.flatMap((hint, index) => [
        index > 0 && React.createElement(Text, { key: `sep-${index}`, color: colors.muted }, ' │ '),
        React.createElement(
          React.Fragment,
          { key: hint.key },
          React.createElement(Text, { bold: true, color: colors.secondary }, hint.key),
          React.createElement(Text, { color: colors.muted }, ` ${hint.description}`)
        ),
      ].filter(Boolean))
    )
  );
}

export default KanbanBoard;

// Re-export types for convenience
export type { KanbanBoardProps, KanbanTask, KanbanStatus };
