import type { WebSocketMessage } from './types';

export type MessageHandler = (message: WebSocketMessage) => void;
export type ErrorHandler = (error: Error) => void;

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private errorHandlers: ErrorHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private currentProjectId: string | null = null;
  private currentSessionId: string | null = null;

  constructor(url: string) {
    this.url = url.replace(/\/$/, '');
  }

  connect(projectId: string, sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.currentProjectId = projectId;
      this.currentSessionId = sessionId;
      const wsUrl = `${this.url}/projects/${projectId}/sessions/${sessionId}/stream`;

      try {
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          this.reconnectAttempts = 0;
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as WebSocketMessage;
            this.emit(data.type, data);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        this.socket.onerror = (event) => {
          const error = new Error('WebSocket connection error');
          this.errorHandlers.forEach((handler) => handler(error));
          reject(error);
        };

        this.socket.onclose = () => {
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
              if (this.currentProjectId && this.currentSessionId) {
                this.connect(this.currentProjectId, this.currentSessionId).catch(() => {});
              }
            }, this.reconnectDelay * this.reconnectAttempts);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.maxReconnectAttempts = 0;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  send(message: WebSocketMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  subscribe(runId: string): void {
    this.send({ type: 'subscribe:run', runId });
  }

  unsubscribe(runId: string): void {
    this.send({ type: 'unsubscribe:run', runId });
  }

  on(event: string, handler: MessageHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  private emit(event: string, data: WebSocketMessage): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler(data));
    }
  }

  get isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}
