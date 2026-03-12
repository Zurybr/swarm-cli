/**
 * MainContent component for Swarm CLI TUI
 * Scrollable content area for displaying output and data
 */

import React, { ReactNode, useMemo } from 'react';
import { Text, Box } from 'ink';
import { useTheme } from '../hooks/useTheme';

interface MainContentProps {
  children?: ReactNode;
  title?: string;
  showBorder?: boolean;
  scrollable?: boolean;
  maxHeight?: number;
  emptyMessage?: string;
}

/**
 * MainContent component - Primary content display area
 */
export function MainContent({
  children,
  title,
  showBorder = true,
  scrollable = false,
  maxHeight = 10,
  emptyMessage = 'No content to display',
}: MainContentProps): React.ReactElement {
  const { colors } = useTheme();

  const content = useMemo(() => {
    if (!children) {
      return React.createElement(
        Text,
        { color: colors.muted, italic: true },
        emptyMessage
      );
    }
    return children;
  }, [children, colors.muted, emptyMessage]);

  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      flexGrow: 1,
      paddingX: 1,
      borderStyle: showBorder ? 'single' : undefined,
      borderColor: showBorder ? colors.border : undefined,
    },
    title && React.createElement(
      Box,
      { marginBottom: 1 },
      React.createElement(Text, { bold: true, color: colors.secondary }, `━━ ${title} ━━`)
    ),
    React.createElement(
      Box,
      {
        flexDirection: 'column',
        flexGrow: 1,
        maxHeight: scrollable ? maxHeight : undefined,
      },
      content
    )
  );
}

export default MainContent;
