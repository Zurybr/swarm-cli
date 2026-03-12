/**
 * PlanView component for Swarm CLI TUI
 * Main plan execution view with real-time progress updates
 * 
 * Design from GitHub Issue #23:
 * ┌─ Phase 03-features ────────────────────────────────┐
 * │ Plan 03-02: User Authentication                      │
 * │                                                      │
 * │ Wave 1                                               │
 * │ ├─ ✅ Task 1: Create User model         (2m 15s)    │
 * │ ├─ ⏳ Task 2: Create API endpoints       (running)   │
 * │ └─ ⏸️  Task 3: Add validation             (pending)  │
 * │                                                      │
 * │ Wave 2                                               │
 * │ └─ ⏸️  Task 4: Integration tests        (waiting)  │
 * │                                                      │
 * │ [████████░░░░░░░░░░] 50% complete                    │
 * │ ETA: 3m 45s                                          │
 * └──────────────────────────────────────────────────────┘
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../hooks/useTheme';
import { TaskList } from './TaskList';
import { ProgressBar } from './ProgressBar';
import { Plan, formatDuration } from '../types/plan';

interface PlanHeaderProps {
  /** Phase name (e.g., "03-features") */
  phaseName: string;
  /** Plan number (e.g., "03-02") */
  planNumber: string;
  /** Plan title */
  planTitle: string;
}

/**
 * Plan header with phase and plan information
 */
function PlanHeader({ 
  phaseName, 
  planNumber, 
  planTitle 
}: PlanHeaderProps): React.ReactElement {
  const { colors } = useTheme();

  return React.createElement(
    Box,
    { flexDirection: 'column', marginBottom: 1 },
    // Phase line
    React.createElement(
      Box,
      { flexDirection: 'row' },
      React.createElement(
        Text,
        { color: colors.muted },
        'Phase '
      ),
      React.createElement(
        Text,
        { color: colors.secondary, bold: true },
        phaseName
      )
    ),
    // Plan title
    React.createElement(
      Box,
      { flexDirection: 'row', marginTop: 0 },
      React.createElement(
        Text,
        { color: colors.text },
        `Plan ${planNumber}: `
      ),
      React.createElement(
        Text,
        { color: colors.primary, bold: true },
        planTitle
      )
    )
  );
}

interface PlanFooterProps {
  /** Progress percentage */
  progress: number;
  /** ETA in milliseconds */
  eta: number;
  /** Formatted ETA string */
  etaFormatted?: string;
  /** Whether execution is paused */
  isPaused?: boolean;
  /** Whether execution is complete */
  isComplete?: boolean;
}

/**
 * Plan footer with progress bar and ETA
 */
function PlanFooter({
  progress,
  eta,
  etaFormatted,
  isPaused = false,
  isComplete = false,
}: PlanFooterProps): React.ReactElement {
  const { colors } = useTheme();

  // Determine status text
  const statusText = useMemo(() => {
    if (isComplete) return 'Complete!';
    if (isPaused) return 'Paused';
    if (progress === 0) return 'Starting...';
    return 'complete';
  }, [isComplete, isPaused, progress]);

  // Determine status color
  const statusColor = useMemo(() => {
    if (isComplete) return colors.success;
    if (isPaused) return colors.warning;
    return colors.text;
  }, [isComplete, isPaused, colors]);

  return React.createElement(
    Box,
    { flexDirection: 'column', marginTop: 1 },
    // Progress bar
    React.createElement(
      Box,
      { flexDirection: 'row', alignItems: 'center' },
      React.createElement(ProgressBar, {
        percent: progress,
        width: 20,
        showPercent: false,
        useGradient: true,
      }),
      React.createElement(
        Box,
        { marginLeft: 1 },
        React.createElement(
          Text,
          { color: statusColor, bold: isComplete },
          `${progress}% ${statusText}`
        )
      )
    ),
    // ETA
    !isComplete && eta > 0 && React.createElement(
      Box,
      { flexDirection: 'row', marginTop: 0 },
      React.createElement(
        Text,
        { color: colors.muted },
        'ETA: '
      ),
      React.createElement(
        Text,
        { color: colors.info },
        etaFormatted || formatDuration(eta)
      )
    )
  );
}

interface PlanViewProps {
  /** Plan data to display */
  plan: Plan;
  /** Whether execution is currently active */
  isExecuting?: boolean;
  /** Whether execution is paused */
  isPaused?: boolean;
  /** Current wave number (1-indexed) */
  currentWave?: number;
  /** Show border around the view */
  showBorder?: boolean;
  /** Compact mode (less spacing) */
  compact?: boolean;
}

/**
 * PlanView component - Main plan execution view
 * 
 * Displays plan information, task list grouped by waves,
 * progress bar, and estimated time remaining.
 * 
 * @example
 * ```tsx
 * const plan = {
 *   id: 'plan-1',
 *   number: '03-02',
 *   title: 'User Authentication',
 *   phase: { id: 'phase-1', name: '03-features', title: 'Features' },
 *   waves: [
 *     {
 *       number: 1,
 *       tasks: [
 *         { id: '1', number: 1, title: 'Create User model', status: 'completed', duration: 135000 },
 *         { id: '2', number: 2, title: 'Create API endpoints', status: 'running', duration: 0 },
 *       ]
 *     }
 *   ],
 *   totalTasks: 4,
 *   completedTasks: 1,
 *   progress: 25,
 *   eta: 225000,
 * };
 * 
 * <PlanView plan={plan} isExecuting currentWave={1} />
 * ```
 */
export function PlanView({
  plan,
  isExecuting = false,
  isPaused = false,
  currentWave = 0,
  showBorder = true,
  compact = false,
}: PlanViewProps): React.ReactElement {
  const { colors } = useTheme();

  // Determine if plan is complete
  const isComplete = useMemo(() => 
    plan.completedTasks === plan.totalTasks && plan.totalTasks > 0,
    [plan.completedTasks, plan.totalTasks]
  );

  // Get active wave (first wave with running or pending tasks)
  const activeWave = useMemo(() => {
    if (currentWave > 0) return currentWave;
    
    for (const wave of plan.waves) {
      const hasActiveTasks = wave.tasks.some(
        t => t.status === 'running' || t.status === 'pending'
      );
      if (hasActiveTasks) return wave.number;
    }
    return 0;
  }, [plan.waves, currentWave]);

  // Status indicator
  const statusIndicator = useMemo(() => {
    if (isComplete) return { icon: '✨', text: 'Complete', color: colors.success };
    if (isPaused) return { icon: '⏸️', text: 'Paused', color: colors.warning };
    if (isExecuting) return { icon: '▶️', text: 'Running', color: colors.primary };
    return { icon: '📋', text: 'Ready', color: colors.muted };
  }, [isComplete, isPaused, isExecuting, colors]);

  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      paddingX: 1,
      paddingY: compact ? 0 : 1,
      borderStyle: showBorder ? 'single' : undefined,
      borderColor: showBorder ? colors.border : undefined,
    },
    // Status bar
    React.createElement(
      Box,
      { flexDirection: 'row', marginBottom: compact ? 0 : 1 },
      React.createElement(Text, null, statusIndicator.icon + ' '),
      React.createElement(
        Text,
        { color: statusIndicator.color, bold: true },
        statusIndicator.text
      )
    ),
    // Header
    React.createElement(PlanHeader, {
      phaseName: plan.phase.name,
      planNumber: plan.number,
      planTitle: plan.title,
    }),
    // Task list
    React.createElement(TaskList, {
      waves: plan.waves,
      currentWave: activeWave,
      showTiming: true,
      compact,
    }),
    // Footer with progress
    React.createElement(PlanFooter, {
      progress: plan.progress,
      eta: plan.eta,
      etaFormatted: plan.etaFormatted,
      isPaused,
      isComplete,
    })
  );
}

/**
 * Empty plan view placeholder
 */
export function PlanViewEmpty({
  message = 'No plan loaded',
}: {
  message?: string;
}): React.ReactElement {
  const { colors } = useTheme();

  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingY: 3,
      borderStyle: 'single',
      borderColor: colors.border,
    },
    React.createElement(
      Text,
      { color: colors.muted, italic: true },
      '📋 ' + message
    )
  );
}

/**
 * Plan view with loading state
 */
export function PlanViewLoading(): React.ReactElement {
  const { colors } = useTheme();

  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingY: 3,
      borderStyle: 'single',
      borderColor: colors.border,
    },
    React.createElement(
      Text,
      { color: colors.warning },
      '⏳ Loading plan...'
    )
  );
}

export default PlanView;
