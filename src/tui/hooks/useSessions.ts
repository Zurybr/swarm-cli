/**
 * Session state management hook for Swarm CLI TUI
 * Provides session navigation, selection, and state management
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Session,
  SubAgent,
  SessionStatus,
  SessionNavigationState,
  SessionNavigationActions,
  UseSessionsReturn,
  generateSessionId,
  generateSubAgentId,
} from '../types/session';

/**
 * Default mock sessions for development
 */
const createDefaultSessions = (): Session[] => [
  {
    id: 'session-1',
    number: 1,
    name: 'Main Project',
    status: 'active',
    preview: 'Implementing authentication flow',
    children: [
      {
        id: 'agent-1',
        name: '@researcher',
        role: 'researcher',
        status: 'active',
        parentId: 'session-1',
        preview: 'Searching for auth patterns',
        createdAt: Date.now() - 1000 * 60 * 5,
      },
      {
        id: 'agent-2',
        name: '@debugger',
        role: 'debugger',
        status: 'idle',
        parentId: 'session-1',
        preview: 'Waiting for code review',
        createdAt: Date.now() - 1000 * 60 * 3,
      },
    ],
    createdAt: Date.now() - 1000 * 60 * 30,
    lastActiveAt: Date.now() - 1000 * 10,
    isExpanded: true,
  },
  {
    id: 'session-2',
    number: 2,
    name: 'Bug Fix',
    status: 'idle',
    preview: 'Fixing memory leak in worker',
    children: [],
    createdAt: Date.now() - 1000 * 60 * 60,
    lastActiveAt: Date.now() - 1000 * 60 * 45,
    isExpanded: false,
  },
  {
    id: 'session-3',
    number: 3,
    name: 'Feature: Dark Mode',
    status: 'completed',
    preview: 'Theme system implementation',
    children: [
      {
        id: 'agent-3',
        name: '@coder',
        role: 'coder',
        status: 'completed',
        parentId: 'session-3',
        preview: 'CSS variables done',
        createdAt: Date.now() - 1000 * 60 * 60 * 2,
      },
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
    lastActiveAt: Date.now() - 1000 * 60 * 60,
    isExpanded: false,
  },
];

interface UseSessionsOptions {
  /** Initial sessions to load */
  initialSessions?: Session[];
  /** Callback when session is activated */
  onSessionActivate?: (session: Session) => void;
  /** Callback when session is selected */
  onSessionSelect?: (session: Session) => void;
}

/**
 * Hook for managing session state and navigation
 */
export function useSessions(options: UseSessionsOptions = {}): UseSessionsReturn {
  const {
    initialSessions = createDefaultSessions(),
    onSessionActivate,
    onSessionSelect,
  } = options;

  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    initialSessions[0]?.id ?? null
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    initialSessions[0]?.id ?? null
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(initialSessions.filter(s => s.isExpanded).map(s => s.id))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get flat list of all selectable items (sessions + subagents)
   */
  const flatList = useMemo(() => {
    const items: Array<{ type: 'session' | 'subagent'; id: string; sessionId: string }> = [];
    
    for (const session of sessions) {
      items.push({ type: 'session', id: session.id, sessionId: session.id });
      
      if (expandedIds.has(session.id) && session.children.length > 0) {
        for (const child of session.children) {
          items.push({ type: 'subagent', id: child.id, sessionId: session.id });
        }
      }
    }
    
    return items;
  }, [sessions, expandedIds]);

  /**
   * Navigate to next session/item
   */
  const nextSession = useCallback(() => {
    const currentIndex = flatList.findIndex(item => item.id === selectedSessionId);
    if (currentIndex < flatList.length - 1) {
      const nextItem = flatList[currentIndex + 1];
      setSelectedSessionId(nextItem.id);
      
      const session = sessions.find(s => s.id === nextItem.sessionId);
      if (session && onSessionSelect) {
        onSessionSelect(session);
      }
    }
  }, [flatList, selectedSessionId, sessions, onSessionSelect]);

  /**
   * Navigate to previous session/item
   */
  const prevSession = useCallback(() => {
    const currentIndex = flatList.findIndex(item => item.id === selectedSessionId);
    if (currentIndex > 0) {
      const prevItem = flatList[currentIndex - 1];
      setSelectedSessionId(prevItem.id);
      
      const session = sessions.find(s => s.id === prevItem.sessionId);
      if (session && onSessionSelect) {
        onSessionSelect(session);
      }
    }
  }, [flatList, selectedSessionId, sessions, onSessionSelect]);

  /**
   * Select a specific session
   */
  const selectSession = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
    
    const session = sessions.find(s => s.id === sessionId);
    if (session && onSessionSelect) {
      onSessionSelect(session);
    }
  }, [sessions, onSessionSelect]);

  /**
   * Activate a session (make it the current working session)
   */
  const activateSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setSelectedSessionId(sessionId);
    
    // Update lastActiveAt
    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { ...s, lastActiveAt: Date.now(), status: 'active' as SessionStatus }
        : s
    ));
    
    const session = sessions.find(s => s.id === sessionId);
    if (session && onSessionActivate) {
      onSessionActivate(session);
    }
  }, [sessions, onSessionActivate]);

  /**
   * Toggle session expansion
   */
  const toggleExpand = useCallback((sessionId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  /**
   * Expand all sessions
   */
  const expandAll = useCallback(() => {
    setExpandedIds(new Set(sessions.map(s => s.id)));
  }, [sessions]);

  /**
   * Collapse all sessions
   */
  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  /**
   * Add a new session
   */
  const addSession = useCallback((
    sessionData: Omit<Session, 'id' | 'createdAt' | 'lastActiveAt'>
  ) => {
    const now = Date.now();
    const newSession: Session = {
      ...sessionData,
      id: generateSessionId(),
      createdAt: now,
      lastActiveAt: now,
    };
    
    setSessions(prev => [...prev, newSession]);
    return newSession;
  }, []);

  /**
   * Remove a session
   */
  const removeSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    
    if (activeSessionId === sessionId) {
      setActiveSessionId(sessions.find(s => s.id !== sessionId)?.id ?? null);
    }
    if (selectedSessionId === sessionId) {
      setSelectedSessionId(sessions.find(s => s.id !== sessionId)?.id ?? null);
    }
  }, [activeSessionId, selectedSessionId, sessions]);

  /**
   * Add a subagent to a session
   */
  const addSubAgent = useCallback((
    sessionId: string,
    subagentData: Omit<SubAgent, 'id' | 'parentId' | 'createdAt'>
  ) => {
    const newSubAgent: SubAgent = {
      ...subagentData,
      id: generateSubAgentId(),
      parentId: sessionId,
      createdAt: Date.now(),
    };
    
    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { ...s, children: [...s.children, newSubAgent] }
        : s
    ));
    
    return newSubAgent;
  }, []);

  /**
   * Update session status
   */
  const updateSessionStatus = useCallback((sessionId: string, status: SessionStatus) => {
    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, status } : s
    ));
  }, []);

  /**
   * Refresh sessions from source (placeholder for API integration)
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Placeholder: In real implementation, this would fetch from API
      await new Promise(resolve => setTimeout(resolve, 500));
      // setSessions(fetchedSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    // State
    sessions,
    activeSessionId,
    selectedSessionId,
    expandedIds,
    isLoading,
    error,
    
    // Actions
    nextSession,
    prevSession,
    selectSession,
    activateSession,
    toggleExpand,
    expandAll,
    collapseAll,
    addSession,
    removeSession,
    addSubAgent,
    updateSessionStatus,
    refresh,
  };
}

export default useSessions;
