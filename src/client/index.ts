export { SwarmClient } from './client';
export { HttpClient } from './httpClient';
export { WebSocketClient } from './websocketClient';
export { EventEmitter } from './events';

export type {
  Auth,
  Project,
  ProjectConfig,
  Session,
  SessionConfig,
  Message,
  Plan,
  File,
  FileContent,
  FileStatusResult,
  InitSessionRequest,
  ListMessagesOptions,
  MessageListResponse,
  ProjectListResponse,
  ProjectResponse,
  SessionListResponse,
  SessionResponse,
  MessageResponse,
  FileListResponse,
  FileContentResponse,
  FileStatusResponse,
  PlanListResponse,
  PlanResponse,
  PlanUpdate,
  SessionStatusEvent,
  AgentEvent,
  TaskEvent,
  FileChange,
  WebSocketMessage,
} from './types';
