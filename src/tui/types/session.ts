/**
 * TypeScript types for Session data
 * Defines the structure for sessions, subagents, and navigation state
 */

/**
 * Session execution status
 */
export type SessionStatus = 'active' | 'idle' | 'completed' | 'failed' | 'pending';

/**
 * Agent role type
 */
export type AgentRole = 'coordinator' | 'coder' | 'tester' | 'researcher' | 'debugger' | 'reviewer';

/**
 * Child session (subagent) within a parent session
 */
export interface SubAgent {
  /** Unique subagent identifier */
  id: string;
  /** Agent name (e.g., @researcher, @debugger) */
  name: string;
  /** Agent role */
  role: AgentRole;
  /** Current status */
  status: SessionStatus;
  /** Parent session ID */
  parentId: string;
  /** Short preview of current work */
  preview?: string;
  /** When the subagent was spawned */
  createdAt: number;
}

/**
 * Main session representing a conversation or task
 */
export interface Session {
  /** Unique session identifier */
  id: string;
  /** Session display number */
  number: number;
  /** Session name/title */
  name: string;
  /** Current status */
  status: SessionStatus;
  /** Short preview of session content */
  preview?: string;
  /** Child subagents spawned from this session */
  children: SubAgent[];
  /** When the session was created */
  createdAt: number;
  /** When the session was last active */
  lastActiveAt: number;
  /** Whether this session is expanded in tree view */
  isExpanded?: boolean;
}

/**
 * Session navigation state for hooks
 */
export interface SessionNavigationState {
  /** All sessions */
  sessions: Session[];
  /** Currently active session ID */
  activeSessionId: string | null;
  /** Currently selected session ID (for keyboard navigation) */
  selectedSessionId: string | null;
  /** Expanded session IDs in tree view */
  expandedIds: Set<string>;
  /** Whether any operation is in progress */
  isLoading: boolean;
  /** Any error that occurred */
  error: string | null;
}

/**
 * Session navigation actions
 */
export interface SessionNavigationActions {
  /** Navigate to next session */
  nextSession: () => void;
  /** Navigate to previous session */
  prevSession: () => void;
  /** Select a specific session */
  selectSession: (sessionId: string) => void;
  /** Activate the selected session */
  activateSession: (sessionId: string) => void;
  /** Toggle session expansion in tree view */
  toggleExpand: (sessionId: string) => void;
  /** Expand all sessions */
  expandAll: () => void;
  /** Collapse all sessions */
  collapseAll: () => void;
  /** Add a new session */
  addSession: (session: Omit<Session, 'id' | 'createdAt' | 'lastActiveAt'>) => void;
  /** Remove a session */
  removeSession: (sessionId: string) => void;
  /** Add a subagent to a session */
  addSubAgent: (sessionId: string, subagent: Omit<SubAgent, 'id' | 'parentId' | 'createdAt'>) => void;
  /** Update session status */
  updateSessionStatus: (sessionId: string, status: SessionStatus) => void;
  /** Refresh sessions from source */
  refresh: () => Promise<void>;
}

/**
 * Combined hook return type
 */
export type UseSessionsReturn = SessionNavigationState & SessionNavigationActions;

/**
 * Status icon mapping
 */
export const SESSION_STATUS_ICONS: Record<SessionStatus, string> = {
  active: '●',
  idle: '○',
  completed: '✓',
  failed: '✗',
  pending: '◐',
};

/**
 * Agent role icon mapping
 */
export const AGENT_ROLE_ICONS: Record<AgentRole, string> = {
  coordinator: '🎯',
  coder: '💻',
  tester: '🧪',
  researcher: '🔍',
  debugger: '🐛',
  reviewer: '👀',
};

/**
 * Status color mapping (for theme colors)
 */
export const SESSION_STATUS_COLORS: Record<SessionStatus, keyof import('../theme/types').ThemeColors> = {
  active: 'success',
  idle: 'muted',
  completed: 'info',
  failed: 'error',
  pending: 'warning',
};

/**
 * Generate a unique ID
 */
export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique subagent ID
 */
export function generateSubAgentId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Format session preview (truncate to max length)
 */
export function formatPreview(preview: string | undefined, maxLength: number = 40): string {
  if (!preview) return '';
  if (preview.length <= maxLength) return preview;
  return `${preview.substring(0, maxLength - 3)}...`;
}

/**
 * Format relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
