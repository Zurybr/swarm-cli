import {
  Project,
  ProjectConfig,
  Session,
  SessionConfig,
  Message,
  Plan,
  File,
  FileContent,
  FileStatusResult,
  SessionStatus,
} from '../types/api';

export interface Auth {
  apiKey?: string;
  token?: string;
}

export interface InitSessionRequest {
  spec?: string;
  context?: {
    files?: string[];
    dependencies?: string[];
  };
}

export interface ListMessagesOptions {
  limit?: number;
  offset?: number;
  role?: string;
}

export interface MessageListResponse {
  messages: Message[];
  total: number;
}

export interface ProjectListResponse {
  projects: Project[];
}

export interface ProjectResponse {
  project: Project;
}

export interface SessionListResponse {
  sessions: Session[];
}

export interface SessionResponse {
  session: Session;
  message?: string;
}

export interface MessageResponse {
  message: Message;
}

export interface FileListResponse {
  files: File[];
}

export interface FileContentResponse {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
  size: number;
  lastModified: string;
}

export interface FileStatusResponse {
  files: FileStatusResult[];
}

export interface PlanListResponse {
  plans: Plan[];
}

export interface PlanResponse {
  plan: Plan;
  message?: string;
}

export interface PlanUpdate {
  planId: string;
  status: string;
  tasks?: Plan['tasks'];
}

export interface SessionStatusEvent {
  sessionId: string;
  status: SessionStatus;
}

export interface AgentEvent {
  agentId: string;
  name?: string;
  role?: string;
  status?: string;
}

export interface TaskEvent {
  taskId: string;
  title?: string;
  assignedTo?: string;
  status?: string;
  result?: {
    success: boolean;
    output?: string;
    error?: string;
  };
}

export interface FileChange {
  path: string;
  status: string;
  type: 'add' | 'modify' | 'delete';
}

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

export type {
  Project,
  ProjectConfig,
  Session,
  SessionConfig,
  Message,
  Plan,
  File,
  FileContent,
  FileStatusResult,
  SessionStatus,
};
