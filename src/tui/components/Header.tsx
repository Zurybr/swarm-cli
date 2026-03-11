/**
 * Header component for Swarm CLI TUI
 * Displays title bar with branding and status indicators
 */

import React from 'react';
import { Text, Box } from 'ink';
import { useTheme } from '../hooks/useTheme';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showStatus?: boolean;
  statusText?: string;
  statusColor?: 'success' | 'warning' | 'error' | 'info' | 'muted';
}

/**
 * Header component - Top bar with title and optional status
 */
export function Header({
  title = 'Swarm CLI',
  subtitle = 'Agent Orchestration',
  showStatus = true,
  statusText = 'Ready',
  statusColor = 'success',
}: HeaderProps): React.ReactElement {
  const { colors } = useTheme();

  const statusColorMap = {
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    muted: colors.muted,
  };

  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      paddingX: 1,
      borderStyle: 'single',
      borderColor: colors.border,
    },
    React.createElement(
      Box,
      { flexDirection: 'row', justifyContent: 'space-between' },
      React.createElement(
        Box,
        { flexDirection: 'row' },
        React.createElement(Text, { bold: true, color: colors.primary }, '🔥 '),
        React.createElement(Text, { bold: true }, title),
        subtitle && React.createElement(Text, { color: colors.muted }, ` • ${subtitle}`)
      ),
      showStatus && React.createElement(
        Box,
        { flexDirection: 'row' },
        React.createElement(Text, { color: colors.muted }, '● '),
        React.createElement(Text, { color: statusColorMap[statusColor] }, statusText)
      )
    )
  );
}

export default Header;
