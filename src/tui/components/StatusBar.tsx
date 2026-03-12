/**
 * StatusBar component for Swarm CLI TUI
 * Bottom status line with keybindings and info
 */

import React from 'react';
import { Text, Box } from 'ink';
import { useTheme } from '../hooks/useTheme';

interface KeyBinding {
  key: string;
  description: string;
}

interface StatusBarProps {
  message?: string;
  messageType?: 'info' | 'success' | 'warning' | 'error';
  keyBindings?: KeyBinding[];
  showHelp?: boolean;
  version?: string;
}

const defaultKeyBindings: KeyBinding[] = [
  { key: 'Ctrl+C', description: 'Quit' },
  { key: 'Tab', description: 'Navigate' },
  { key: 'Enter', description: 'Submit' },
];

/**
 * StatusBar component - Bottom status line with context info
 */
export function StatusBar({
  message,
  messageType = 'info',
  keyBindings = defaultKeyBindings,
  showHelp = true,
  version = '0.1.0',
}: StatusBarProps): React.ReactElement {
  const { colors } = useTheme();

  const messageColorMap = {
    info: colors.info,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
  };

  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: colors.border,
    },
    // Key bindings row
    showHelp && React.createElement(
      Box,
      { flexDirection: 'row', justifyContent: 'space-between', paddingX: 1 },
      React.createElement(
        Box,
        { flexDirection: 'row' },
        ...keyBindings.map((binding, index) =>
          React.createElement(
            React.Fragment,
            { key: binding.key },
            index > 0 && React.createElement(Text, { color: colors.muted }, ' │ '),
            React.createElement(Text, { bold: true, color: colors.secondary }, binding.key),
            React.createElement(Text, { color: colors.muted }, ` ${binding.description}`)
          )
        )
      ),
      React.createElement(Text, { color: colors.muted, dimColor: true }, `v${version}`)
    ),
    // Message row (if provided)
    message && React.createElement(
      Box,
      { paddingX: 1 },
      React.createElement(Text, { color: messageColorMap[messageType] }, message)
    )
  );
}

export default StatusBar;
