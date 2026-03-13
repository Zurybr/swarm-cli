/**
 * Swarm CLI Server API Types
 * Issue #20.1 - Server API Design
 */

export type SessionStatus =
  | 'initializing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'aborted'
  | 'error';

export type PlanStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type FileStatus = 'tracked' | 'modified' | 'untracked' | 'ignored';

export type MessageRole = 'system' | 'user' | 'assistant' | 'agent';

export interface ProjectConfig {
  defaultModel?: string;
  maxAgents?: number;
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
  };
  orchestration?: {
    strategy: 'parallel' | 'sequential' | 'adaptive';
    maxConcurrentTasks?: number;
  };
}

export interface Project {
  id: string;
  name: string;
  path: string;
  config: ProjectConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListResponse {
  projects: Project[];
  activeProject: string | null;
}

export interface SessionConfig {
  maxAgents?: number;
  timeout?: number;
  contextLimit?: number;
  model?: string;
}

export interface AgentSummary {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'busy' | 'paused' | 'error';
}

export interface SessionMetrics {
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  messagesSent: number;
  tokensUsed: number;
}

export interface Session {
  id: string;
  projectId: string;
  status: SessionStatus;
  config: SessionConfig;
  agents: AgentSummary[];
  metrics: SessionMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface PlanTaskResult {
  success: boolean;
  output?: string;
  error?: string;
  artifacts?: string[];
}

export interface PlanTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  assignedTo?: string;
  result?: PlanTaskResult;
}

export interface Plan {
  id: string;
  projectId: string;
  status: PlanStatus;
  tasks: PlanTask[];
  wave?: number;
  createdAt: string;
  updatedAt: string;
}

export interface File {
  path: string;
  status: FileStatus;
  lastModified?: string;
}

export interface FileContent {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
  size: number;
  lastModified: string;
}

export interface FileStatusResult {
  path: string;
  status: FileStatus;
  staged: boolean;
  conflicts?: string[];
}

export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}
