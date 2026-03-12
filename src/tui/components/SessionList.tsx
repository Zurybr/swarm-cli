/**
 * SessionList component for Swarm CLI TUI
 * Renders a list of sessions with navigation support
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../hooks/useTheme';
import {
  Session,
  SessionStatus,
  SESSION_STATUS_ICONS,
  SESSION_STATUS_COLORS,
  formatPreview,
  formatRelativeTime,
} from '../types/session';

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  isSelected: boolean;
  showPreview?: boolean;
  showTime?: boolean;
  onSelect?: () => void;
}

/**
 * Individual session item in the list
 */
function SessionItem({
  session,
  isActive,
  isSelected,
  showPreview = true,
  showTime = false,
}: SessionItemProps): React.ReactElement {
  const { colors } = useTheme();
  
  const statusColor = colors[SESSION_STATUS_COLORS[session.status]];
  const statusIcon = SESSION_STATUS_ICONS[session.status];
  
  const labelColor = isActive 
    ? colors.primary 
    : isSelected 
      ? colors.secondary 
      : colors.text;
  
  const formattedPreview = useMemo(
    () => formatPreview(session.preview),
    [session.preview]
  );
  
  const formattedTime = useMemo(
    () => showTime ? formatRelativeTime(session.lastActiveAt) : null,
    [session.lastActiveAt, showTime]
  );
  
  return React.createElement(
    Box,
    { flexDirection: 'column', marginLeft: 1 },
    React.createElement(
      Box,
      { flexDirection: 'row' },
      // Status indicator
      React.createElement(
        Text,
        { color: statusColor, bold: isActive },
        `${statusIcon} `
      ),
      // Session name
      React.createElement(
        Text,
        { 
          color: labelColor, 
          bold: isActive || isSelected,
          underline: isSelected && !isActive,
        },
        `Session #${session.number} - ${session.name}`
      ),
      // Active indicator
      isActive && React.createElement(
        Text,
        { color: colors.primary, bold: true },
        ' [ACTIVE]'
      ),
      // Time
      formattedTime && React.createElement(
        Text,
        { color: colors.muted },
        ` (${formattedTime})`
      ),
    ),
    // Preview line
    showPreview && formattedPreview && React.createElement(
      Box,
      { marginLeft: 3 },
      React.createElement(
        Text,
        { color: colors.muted, dimColor: true },
        formattedPreview
      )
    )
  );
}

interface SessionListProps {
  /** Sessions to display */
  sessions: Session[];
  /** Currently active session ID */
  activeSessionId?: string | null;
  /** Currently selected session ID */
  selectedSessionId?: string | null;
  /** Show preview text */
  showPreview?: boolean;
  /** Show relative time */
  showTime?: boolean;
  /** Show border around list */
  showBorder?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Callback when session is selected */
  onSelect?: (sessionId: string) => void;
}

/**
 * SessionList - Displays sessions in a simple list format
 */
export function SessionList({
  sessions,
  activeSessionId = null,
  selectedSessionId = null,
  showPreview = true,
  showTime = false,
  showBorder = true,
  emptyMessage = 'No sessions available',
  onSelect,
}: SessionListProps): React.ReactElement {
  const { colors } = useTheme();
  
  const content = useMemo(() => {
    if (sessions.length === 0) {
      return React.createElement(
        Text,
        { color: colors.muted, italic: true },
        emptyMessage
      );
    }
    
    return sessions.map(session => 
      React.createElement(
        Box,
        { 
          key: session.id, 
          flexDirection: 'column',
          marginBottom: 1,
        },
        React.createElement(SessionItem, {
          session,
          isActive: session.id === activeSessionId,
          isSelected: session.id === selectedSessionId,
          showPreview,
          showTime,
          onSelect: onSelect ? () => onSelect(session.id) : undefined,
        })
      )
    );
  }, [sessions, activeSessionId, selectedSessionId, showPreview, showTime, emptyMessage, colors.muted, onSelect]);
  
  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      paddingX: 1,
      borderStyle: showBorder ? 'single' : undefined,
      borderColor: showBorder ? colors.border : undefined,
    },
    // Header
    React.createElement(
      Box,
      { marginBottom: 1 },
      React.createElement(
        Text,
        { bold: true, color: colors.secondary },
        '━━ Sessions ━━'
      )
    ),
    // Session list
    React.createElement(
      Box,
      { flexDirection: 'column' },
      content
    )
  );
}

export default SessionList;
