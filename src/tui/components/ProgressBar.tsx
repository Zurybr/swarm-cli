/**
 * ProgressBar component for Swarm CLI TUI
 * Visual progress indicator with customizable styling
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../hooks/useTheme';

interface ProgressBarProps {
  /** Progress percentage (0-100) */
  percent: number;
  /** Width of the progress bar in characters */
  width?: number;
  /** Show percentage text */
  showPercent?: boolean;
  /** Custom label before the bar */
  label?: string;
  /** Character for filled portion */
  filledChar?: string;
  /** Character for empty portion */
  emptyChar?: string;
  /** Use color gradient based on progress */
  useGradient?: boolean;
}

/**
 * Get color based on progress percentage
 */
function getProgressColor(
  percent: number, 
  colors: ReturnType<typeof useTheme>['colors']
): string {
  if (percent >= 100) return colors.success;
  if (percent >= 75) return colors.success;
  if (percent >= 50) return colors.warning;
  if (percent >= 25) return colors.warning;
  return colors.error;
}

/**
 * ProgressBar component - Visual progress indicator
 * 
 * @example
 * ```tsx
 * // Basic progress bar
 * <ProgressBar percent={50} />
 * 
 * // With label and custom width
 * <ProgressBar percent={75} width={30} label="Downloading" />
 * 
 * // With gradient colors
 * <ProgressBar percent={60} useGradient showPercent />
 * ```
 */
export function ProgressBar({
  percent,
  width = 20,
  showPercent = true,
  label,
  filledChar = '█',
  emptyChar = '░',
  useGradient = false,
}: ProgressBarProps): React.ReactElement {
  const { colors } = useTheme();

  // Clamp percent to valid range
  const clampedPercent = useMemo(() => 
    Math.max(0, Math.min(100, percent)), 
    [percent]
  );

  // Calculate filled and empty portions
  const { filled, empty } = useMemo(() => {
    const filledCount = Math.round((clampedPercent / 100) * width);
    return {
      filled: filledCount,
      empty: width - filledCount,
    };
  }, [clampedPercent, width]);

  // Determine color
  const barColor = useMemo(() => 
    useGradient 
      ? getProgressColor(clampedPercent, colors)
      : colors.primary,
    [useGradient, clampedPercent, colors]
  );

  // Build the progress bar string
  const barString = useMemo(() => {
    const filledPart = filledChar.repeat(filled);
    const emptyPart = emptyChar.repeat(empty);
    return `${filledPart}${emptyPart}`;
  }, [filledChar, emptyChar, filled, empty]);

  return React.createElement(
    Box,
    { flexDirection: 'row', alignItems: 'center' },
    // Label (if provided)
    label && React.createElement(
      Box,
      { marginRight: 1 },
      React.createElement(Text, { color: colors.muted }, label)
    ),
    // Progress bar
    React.createElement(
      Text,
      { color: barColor },
      barString
    ),
    // Percentage text
    showPercent && React.createElement(
      Box,
      { marginLeft: 1 },
      React.createElement(
        Text,
        { color: colors.text, bold: true },
        `${clampedPercent}%`
      )
    )
  );
}

/**
 * ProgressBar with status text
 * Displays progress bar with completion status below
 */
export function ProgressBarWithStatus({
  percent,
  width = 20,
  statusText,
  showPercent = true,
}: ProgressBarProps & { statusText?: string }): React.ReactElement {
  const { colors } = useTheme();

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(ProgressBar, {
      percent,
      width,
      showPercent,
      useGradient: true,
    }),
    statusText && React.createElement(
      Text,
      { color: colors.muted, dimColor: true },
      statusText
    )
  );
}

/**
 * Segmented progress bar for multi-step processes
 * Shows individual segments for each step
 */
export function SegmentedProgressBar({
  segments,
  currentSegment,
  width = 20,
}: {
  /** Total number of segments */
  segments: number;
  /** Currently active segment (0-indexed) */
  currentSegment: number;
  /** Width per segment */
  width?: number;
}): React.ReactElement {
  const { colors } = useTheme();

  const segmentWidth = Math.floor(width / segments);
  const extraWidth = width % segments;

  const segmentElements = useMemo(() => {
    const elements: React.ReactElement[] = [];
    
    for (let i = 0; i < segments; i++) {
      const isCompleted = i < currentSegment;
      const isCurrent = i === currentSegment;
      const segmentChar = isCompleted ? '█' : isCurrent ? '▓' : '░';
      const color = isCompleted 
        ? colors.success 
        : isCurrent 
          ? colors.warning 
          : colors.muted;
      
      // Add extra width to last segment
      const thisWidth = i === segments - 1 
        ? segmentWidth + extraWidth 
        : segmentWidth;

      elements.push(
        React.createElement(
          Text,
          { key: i, color },
          segmentChar.repeat(thisWidth)
        )
      );
    }

    return elements;
  }, [segments, currentSegment, segmentWidth, extraWidth, colors]);

  return React.createElement(
    Box,
    { flexDirection: 'row' },
    ...segmentElements
  );
}

export default ProgressBar;
