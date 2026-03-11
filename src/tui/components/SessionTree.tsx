/**
 * SessionTree component for Swarm CLI TUI
 * Renders sessions in a tree view with parent/child hierarchy
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../hooks/useTheme';
import {
  Session,
  SubAgent,
  SESSION_STATUS_ICONS,
  SESSION_STATUS_COLORS,
  AGENT_ROLE_ICONS,
  formatPreview,
} from '../types/session';

interface SubAgentItemProps {
  subagent: SubAgent;
  isSelected: boolean;
  showPreview?: boolean;
}

/**
 * Individual subagent item in the tree
 */
function SubAgentItem({
  subagent,
  isSelected,
  showPreview = true,
}: SubAgentItemProps): React.ReactElement {
  const { colors } = useTheme();
  
  const statusColor = colors[SESSION_STATUS_COLORS[subagent.status]];
  const statusIcon = SESSION_STATUS_ICONS[subagent.status];
  const roleIcon = AGENT_ROLE_ICONS[subagent.role];
  
  const formattedPreview = useMemo(
    () => formatPreview(subagent.preview, 35),
    [subagent.preview]
  );
  
  return React.createElement(
    Box,
    { flexDirection: 'column', marginLeft: 3 },
    React.createElement(
      Box,
      { flexDirection: 'row' },
      // Tree connector
      React.createElement(
        Text,
        { color: colors.muted },
        '├─ '
      ),
      // Status indicator
      React.createElement(
        Text,
        { color: statusColor },
        `${statusIcon} `
      ),
      // Role icon
      React.createElement(
        Text,
        null,
        `${roleIcon} `
      ),
      // Agent name
      React.createElement(
        Text,
        { 
          color: isSelected ? colors.secondary : colors.text,
          bold: isSelected,
        },
        subagent.name
      ),
      // Status text
      React.createElement(
        Text,
        { color: colors.muted },
        ` (${subagent.status})`
      ),
    ),
    // Preview line
    showPreview && formattedPreview && React.createElement(
      Box,
      { marginLeft: 5 },
      React.createElement(
        Text,
        { color: colors.muted, dimColor: true },
        `└ ${formattedPreview}`
      )
    )
  );
}

interface SessionNodeProps {
  session: Session;
  isActive: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  selectedChildId?: string | null;
  showPreview?: boolean;
  onToggleExpand?: () => void;
}

/**
 * Session node with expandable children
 */
function SessionNode({
  session,
  isActive,
  isSelected,
  isExpanded,
  selectedChildId = null,
  showPreview = true,
}: SessionNodeProps): React.ReactElement {
  const { colors } = useTheme();
  
  const statusColor = colors[SESSION_STATUS_COLORS[session.status]];
  const statusIcon = SESSION_STATUS_ICONS[session.status];
  const hasChildren = session.children.length > 0;
  const expandIcon = hasChildren 
    ? (isExpanded ? '▼' : '▶')
    : ' ';
  
  const formattedPreview = useMemo(
    () => formatPreview(session.preview),
    [session.preview]
  );
  
  return React.createElement(
    Box,
    { flexDirection: 'column', marginBottom: 1 },
    // Session header
    React.createElement(
      Box,
      { flexDirection: 'column' },
      React.createElement(
        Box,
        { flexDirection: 'row' },
        // Expand/collapse indicator
        React.createElement(
          Text,
          { color: hasChildren ? colors.secondary : colors.muted },
          `${expandIcon} `
        ),
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
            color: isActive 
              ? colors.primary 
              : isSelected 
                ? colors.secondary 
                : colors.text,
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
        // Children count
        hasChildren && React.createElement(
          Text,
          { color: colors.muted },
          ` (${session.children.length})`
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
      ),
    ),
    // Children (subagents)
    isExpanded && hasChildren && React.createElement(
      Box,
      { flexDirection: 'column', marginTop: 0 },
      session.children.map(child =>
        React.createElement(SubAgentItem, {
          key: child.id,
          subagent: child,
          isSelected: child.id === selectedChildId,
          showPreview,
        })
      )
    )
  );
}

interface SessionTreeProps {
  /** Sessions to display */
  sessions: Session[];
  /** Currently active session ID */
  activeSessionId?: string | null;
  /** Currently selected item ID (session or subagent) */
  selectedSessionId?: string | null;
  /** Expanded session IDs */
  expandedIds?: Set<string>;
  /** Show preview text */
  showPreview?: boolean;
  /** Show border around tree */
  showBorder?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Callback when session is toggled */
  onToggleExpand?: (sessionId: string) => void;
  /** Callback when item is selected */
  onSelect?: (itemId: string) => void;
}

/**
 * SessionTree - Displays sessions in a hierarchical tree format
 */
export function SessionTree({
  sessions,
  activeSessionId = null,
  selectedSessionId = null,
  expandedIds = new Set(),
  showPreview = true,
  showBorder = true,
  emptyMessage = 'No sessions available',
  onToggleExpand,
}: SessionTreeProps): React.ReactElement {
  const { colors } = useTheme();
  
  const content = useMemo(() => {
    if (sessions.length === 0) {
      return React.createElement(
        Text,
        { color: colors.muted, italic: true },
        emptyMessage
      );
    }
    
    return sessions.map(session => {
      const isExpanded = expandedIds.has(session.id);
      const isSelected = session.id === selectedSessionId;
      
      // Check if a child is selected
      const selectedChild = session.children.find(c => c.id === selectedSessionId);
      
      return React.createElement(SessionNode, {
        key: session.id,
        session,
        isActive: session.id === activeSessionId,
        isSelected,
        isExpanded,
        selectedChildId: selectedChild?.id ?? null,
        showPreview,
        onToggleExpand: onToggleExpand 
          ? () => onToggleExpand(session.id) 
          : undefined,
      });
    });
  }, [sessions, activeSessionId, selectedSessionId, expandedIds, showPreview, emptyMessage, colors.muted, onToggleExpand]);
  
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
    // Tree content
    React.createElement(
      Box,
      { flexDirection: 'column' },
      content
    ),
    // Footer with hints
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(
        Text,
        { color: colors.muted, dimColor: true },
        '↑↓ Navigate  ·  Enter Select  ·  Space Expand'
      )
    )
  );
}

export default SessionTree;
