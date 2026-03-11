/**
 * HelpScreen component for Swarm CLI TUI
 * Overlay showing all available keybindings
 */

import React, { useMemo } from 'react';
import { Box, Text, useStdout } from 'ink';
import { useTheme } from '../hooks/useTheme';
import {
  KeyBindingsConfig,
  KeyBindingGroup,
  KeyBinding,
  getKeyBindingGroups,
  formatKey,
} from '../keybindings';

/**
 * Props for HelpScreen component
 */
export interface HelpScreenProps {
  /** Keybindings configuration to display */
  keybindings?: KeyBindingsConfig;
  /** Custom title */
  title?: string;
  /** Whether to show the help screen */
  visible?: boolean;
  /** Key to close help (displayed at bottom) */
  closeKey?: string;
  /** Maximum height for the help content */
  maxHeight?: number;
}

/**
 * Individual keybinding row
 */
function KeyBindingRow({ 
  binding, 
  keyWidth 
}: { 
  binding: KeyBinding; 
  keyWidth: number;
}): React.ReactElement {
  const { colors } = useTheme();
  const formattedKey = formatKey(binding.key);
  
  return React.createElement(
    Box,
    { marginBottom: 0 },
    React.createElement(
      Box,
      { width: keyWidth, marginRight: 2 },
      React.createElement(
        Text,
        { bold: true, color: colors.primary },
        formattedKey.padEnd(keyWidth)
      )
    ),
    React.createElement(
      Text,
      { dimColor: binding.enabled === false, color: colors.text },
      binding.description
    )
  );
}

/**
 * Keybinding group section
 */
function KeyBindingGroupSection({
  group,
  keyWidth,
}: {
  group: KeyBindingGroup;
  keyWidth: number;
}): React.ReactElement {
  const { colors } = useTheme();
  
  // Filter out disabled bindings
  const enabledBindings = group.bindings.filter(b => b.enabled !== false);
  
  if (enabledBindings.length === 0) return React.createElement(Box);
  
  return React.createElement(
    Box,
    { flexDirection: 'column', marginBottom: 1 },
    // Group header
    React.createElement(
      Text,
      { bold: true, underline: true, color: colors.secondary },
      group.name
    ),
    // Bindings
    ...enabledBindings.map((binding, index) =>
      React.createElement(KeyBindingRow, {
        key: `${group.name}-${binding.action}-${index}`,
        binding,
        keyWidth,
      })
    )
  );
}

/**
 * Help screen overlay showing all keybindings
 */
export function HelpScreen({
  keybindings,
  title = 'Keyboard Shortcuts',
  visible = true,
  closeKey = 'Esc or ?',
  maxHeight: propMaxHeight,
}: HelpScreenProps): React.ReactElement | null {
  const { colors } = useTheme();
  const { stdout } = useStdout();
  
  const terminalHeight = stdout.rows || 24;
  const maxHeight = propMaxHeight || terminalHeight - 4;
  
  // Get grouped keybindings
  const groups = useMemo(() => {
    return getKeyBindingGroups(keybindings);
  }, [keybindings]);
  
  // Calculate max key width for alignment
  const maxKeyWidth = useMemo(() => {
    let maxWidth = 8; // Minimum width
    for (const group of groups) {
      for (const binding of group.bindings) {
        const formatted = formatKey(binding.key);
        maxWidth = Math.max(maxWidth, formatted.length);
      }
    }
    return maxWidth;
  }, [groups]);
  
  if (!visible) return null;
  
  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      borderStyle: 'round',
      borderColor: colors.border,
      paddingX: 2,
      paddingY: 1,
      width: '100%',
      maxHeight,
    },
    // Title
    React.createElement(
      Box,
      { marginBottom: 1, justifyContent: 'center' },
      React.createElement(
        Text,
        { bold: true, color: colors.primary },
        title
      )
    ),
    // Divider
    React.createElement(
      Box,
      { marginBottom: 1 },
      React.createElement(
        Text,
        { color: colors.border },
        '─'.repeat(40)
      )
    ),
    // Keybinding groups
    ...groups.map((group, index) =>
      React.createElement(KeyBindingGroupSection, {
        key: group.name,
        group,
        keyWidth: maxKeyWidth,
      })
    ),
    // Footer with close instruction
    React.createElement(
      Box,
      { marginTop: 1, justifyContent: 'center' },
      React.createElement(
        Text,
        { dimColor: true, color: colors.muted },
        `Press ${closeKey} to close`
      )
    )
  );
}

/**
 * Full-screen help overlay (wraps HelpScreen with border)
 */
export function HelpOverlay({
  visible,
  onClose,
  ...props
}: HelpScreenProps & {
  /** Callback when close is requested */
  onClose?: () => void;
}): React.ReactElement | null {
  const { colors } = useTheme();
  
  if (!visible) return null;
  
  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    React.createElement(
      Box,
      {
        flexDirection: 'column',
        borderStyle: 'double',
        borderColor: colors.primary,
        paddingX: 1,
      },
      React.createElement(HelpScreen, {
        ...props,
        visible: true,
      })
    )
  );
}

export default HelpScreen;
