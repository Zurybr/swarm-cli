import type { Message, PlanUpdate, SessionStatusEvent, AgentEvent, TaskEvent, FileChange } from './types';

export type MessageHandler = (msg: Message) => void;
export type PlanUpdateHandler = (update: PlanUpdate) => void;
export type FileChangeHandler = (change: FileChange) => void;
export type SessionStatusHandler = (status: SessionStatusEvent) => void;
export type AgentEventHandler = (event: AgentEvent) => void;
export type TaskEventHandler = (event: TaskEvent) => void;
export type ErrorHandler = (error: Error) => void;

export interface EventHandlers {
  message?: MessageHandler;
  planUpdate?: PlanUpdateHandler;
  fileChange?: FileChangeHandler;
  sessionStatus?: SessionStatusHandler;
  agentEvent?: AgentEventHandler;
  taskEvent?: TaskEventHandler;
  error?: ErrorHandler;
}

export class EventEmitter {
  private handlers: EventHandlers = {};

  setHandlers(handlers: EventHandlers): void {
    this.handlers = handlers;
  }

  handleMessage(msg: Message): void {
    this.handlers.message?.(msg);
  }

  handlePlanUpdate(update: PlanUpdate): void {
    this.handlers.planUpdate?.(update);
  }

  handleFileChange(change: FileChange): void {
    this.handlers.fileChange?.(change);
  }

  handleSessionStatus(status: SessionStatusEvent): void {
    this.handlers.sessionStatus?.(status);
  }

  handleAgentEvent(event: AgentEvent): void {
    this.handlers.agentEvent?.(event);
  }

  handleTaskEvent(event: TaskEvent): void {
    this.handlers.taskEvent?.(event);
  }

  handleError(error: Error): void {
    this.handlers.error?.(error);
  }
}

export function mapWebSocketMessage(
  data: Record<string, unknown>,
  handlers: EventEmitter
): void {
  const type = data.type as string;

  switch (type) {
    case 'message:new':
      handlers.handleMessage(data.message as Message);
      break;
    case 'plan:status':
      handlers.handlePlanUpdate(data as unknown as PlanUpdate);
      break;
    case 'file:change':
      handlers.handleFileChange(data as unknown as FileChange);
      break;
    case 'session:status':
      handlers.handleSessionStatus(data as unknown as SessionStatusEvent);
      break;
    case 'agent:spawned':
    case 'agent:status':
      handlers.handleAgentEvent(data as unknown as AgentEvent);
      break;
    case 'task:started':
    case 'task:completed':
    case 'task:failed':
      handlers.handleTaskEvent(data as unknown as TaskEvent);
      break;
    case 'error':
      const error = new Error((data.message as string) || 'Unknown error');
      handlers.handleError(error);
      break;
  }
}
