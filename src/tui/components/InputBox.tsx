/**
 * InputBox component for Swarm CLI TUI
 * User input field with prompt and cursor support
 */

import React from 'react';
import { Text, Box, useInput } from 'ink';
import { useTheme } from '../hooks/useTheme';

interface InputBoxProps {
  value: string;
  placeholder?: string;
  prompt?: string;
  cursorPosition?: number;
  isFocused?: boolean;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  showCursor?: boolean;
}

/**
 * InputBox component - User input field with visual feedback
 */
export function InputBox({
  value,
  placeholder = 'Type a command...',
  prompt = '>',
  cursorPosition,
  isFocused = true,
  onSubmit,
  showCursor = true,
}: InputBoxProps): React.ReactElement {
  const { colors } = useTheme();
  const cursorPos = cursorPosition ?? value.length;

  // Handle input
  useInput(
    (input, key) => {
      if (!isFocused) return;
      
      if (key.return) {
        onSubmit?.(value);
      }
    },
    { isActive: isFocused }
  );

  // Build the display string with cursor
  const renderValue = () => {
    if (!value) {
      return React.createElement(
        Text,
        { color: colors.muted, italic: true },
        placeholder
      );
    }

    if (!showCursor) {
      return React.createElement(Text, null, value);
    }

    // Split value at cursor position for cursor display
    const beforeCursor = value.slice(0, cursorPos);
    const cursorChar = value[cursorPos] || ' ';
    const afterCursor = value.slice(cursorPos + 1);

    return React.createElement(
      React.Fragment,
      null,
      React.createElement(Text, null, beforeCursor),
      React.createElement(
        Text,
        { backgroundColor: colors.primary, color: 'black', bold: true },
        cursorChar
      ),
      React.createElement(Text, null, afterCursor)
    );
  };

  return React.createElement(
    Box,
    {
      flexDirection: 'row',
      paddingX: 1,
      borderStyle: 'single',
      borderColor: isFocused ? colors.primary : colors.border,
    },
    React.createElement(Text, { bold: true, color: colors.primary }, `${prompt} `),
    React.createElement(Box, { flexGrow: 1 }, renderValue())
  );
}

export default InputBox;
