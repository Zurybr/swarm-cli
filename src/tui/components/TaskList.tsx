/**
 * TaskList component for Swarm CLI TUI
 * Displays list of tasks with status icons and timing
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../hooks/useTheme';
import { 
  Task, 
  TaskStatus, 
  Wave, 
  STATUS_ICONS, 
  STATUS_COLORS 
} from '../types/plan';

interface TaskItemProps {
  /** Task to display */
  task: Task;
  /** Whether this is the last task in the wave */
  isLast?: boolean;
  /** Show detailed timing */
  showTiming?: boolean;
}

/**
 * Single task item with status icon and details
 */
function TaskItem({ 
  task, 
  isLast = false,
  showTiming = true,
}: TaskItemProps): React.ReactElement {
  const { colors } = useTheme();
  
  // Get status icon and color
  const icon = STATUS_ICONS[task.status];
  const colorKey = STATUS_COLORS[task.status];
  const statusColor = colors[colorKey];
  
  // Determine timing display
  const timingDisplay = useMemo(() => {
    if (!showTiming) return null;
    
    switch (task.status) {
      case 'completed':
        return React.createElement(
          Text,
          { color: colors.muted, dimColor: true },
          `(${task.durationFormatted || 'done'})`
        );
      case 'running':
        return React.createElement(
          Text,
          { color: colors.warning, italic: true },
          '(running)'
        );
      case 'failed':
        return React.createElement(
          Text,
          { color: colors.error },
          '(failed)'
        );
      case 'blocked':
        return React.createElement(
          Text,
          { color: colors.info },
          '(blocked)'
        );
      default:
        return React.createElement(
          Text,
          { color: colors.muted, dimColor: true },
          '(pending)'
        );
    }
  }, [task.status, task.durationFormatted, showTiming, colors]);

  // Tree connector character
  const connector = isLast ? '└─' : '├─';

  return React.createElement(
    Box,
    { flexDirection: 'row', marginLeft: 2 },
    // Tree connector
    React.createElement(
      Text,
      { color: colors.border },
      connector + ' '
    ),
    // Status icon
    React.createElement(
      Text,
      null,
      icon + ' '
    ),
    // Task number and title
    React.createElement(
      Text,
      { color: statusColor, bold: task.status === 'running' },
      `Task ${task.number}: `
    ),
    React.createElement(
      Text,
      { color: colors.text, dimColor: task.status === 'pending' },
      task.title
    ),
    // Timing/status
    timingDisplay && React.createElement(
      Box,
      { marginLeft: 1 },
      timingDisplay
    )
  );
}

interface WaveHeaderProps {
  /** Wave number */
  number: number;
  /** Whether this wave has any running tasks */
  isActive?: boolean;
}

/**
 * Wave header with wave number
 */
function WaveHeader({ number, isActive = false }: WaveHeaderProps): React.ReactElement {
  const { colors } = useTheme();
  
  return React.createElement(
    Box,
    { flexDirection: 'row', marginTop: 1, marginBottom: 0 },
    React.createElement(
      Text,
      { 
        color: isActive ? colors.warning : colors.secondary,
        bold: isActive,
      },
      `Wave ${number}`
    ),
    isActive && React.createElement(
      Text,
      { color: colors.warning },
      ' ⚡'
    )
  );
}

interface TaskListProps {
  /** Waves of tasks to display */
  waves: Wave[];
  /** Current active wave number (1-indexed) */
  currentWave?: number;
  /** Show timing information */
  showTiming?: boolean;
  /** Compact mode (less spacing) */
  compact?: boolean;
}

/**
 * TaskList component - Displays grouped tasks by wave
 * 
 * @example
 * ```tsx
 * const waves = [
 *   {
 *     number: 1,
 *     tasks: [
 *       { id: '1', number: 1, title: 'Create model', status: 'completed', duration: 135000 },
 *       { id: '2', number: 2, title: 'Create API', status: 'running', duration: 0 },
 *     ]
 *   }
 * ];
 * 
 * <TaskList waves={waves} currentWave={1} />
 * ```
 */
export function TaskList({
  waves,
  currentWave = 0,
  showTiming = true,
  compact = false,
}: TaskListProps): React.ReactElement {
  const { colors } = useTheme();

  const waveElements = useMemo(() => {
    return waves.map((wave, waveIndex) => {
      const isActive = wave.number === currentWave;
      
      const taskElements = wave.tasks.map((task, taskIndex) => {
        const isLast = taskIndex === wave.tasks.length - 1;
        
        return React.createElement(TaskItem, {
          key: task.id,
          task,
          isLast,
          showTiming,
        });
      });

      return React.createElement(
        Box,
        { 
          key: `wave-${wave.number}`,
          flexDirection: 'column',
          marginTop: compact && waveIndex === 0 ? 0 : 1,
        },
        // Wave header
        React.createElement(WaveHeader, { 
          number: wave.number, 
          isActive,
        }),
        // Tasks
        ...taskElements
      );
    });
  }, [waves, currentWave, showTiming, compact, colors]);

  // If no waves, show empty state
  if (waves.length === 0) {
    return React.createElement(
      Box,
      { paddingY: 1 },
      React.createElement(
        Text,
        { color: colors.muted, italic: true },
        'No tasks in plan'
      )
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    ...waveElements
  );
}

interface TaskSummaryProps {
  /** Total number of tasks */
  total: number;
  /** Number of completed tasks */
  completed: number;
  /** Number of running tasks */
  running: number;
  /** Number of failed tasks */
  failed: number;
}

/**
 * Compact task summary showing counts by status
 */
export function TaskSummary({
  total,
  completed,
  running,
  failed,
}: TaskSummaryProps): React.ReactElement {
  const { colors } = useTheme();

  return React.createElement(
    Box,
    { flexDirection: 'row' },
    React.createElement(
      Text,
      { color: colors.text },
      `Tasks: ${total}`
    ),
    completed > 0 && React.createElement(
      Box,
      { flexDirection: 'row', marginLeft: 2 },
      React.createElement(Text, { color: colors.success }, `${STATUS_ICONS.completed} ${completed}`)
    ),
    running > 0 && React.createElement(
      Box,
      { flexDirection: 'row', marginLeft: 2 },
      React.createElement(Text, { color: colors.warning }, `${STATUS_ICONS.running} ${running}`)
    ),
    failed > 0 && React.createElement(
      Box,
      { flexDirection: 'row', marginLeft: 2 },
      React.createElement(Text, { color: colors.error }, `${STATUS_ICONS.failed} ${failed}`)
    ),
  );
}

export default TaskList;
