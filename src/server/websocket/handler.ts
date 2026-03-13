import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Logger } from '../../utils/logger';

const logger = new Logger('WebSocketHandler');

interface WSClient {
  id: string;
  socket: WebSocket;
  subscriptions: Set<string>;
}

export class WebSocketHandler {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private sessionRooms: Map<string, Set<string>> = new Map();

  initialize(server: ReturnType<typeof import('http').createServer>): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    
    this.wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
      const clientId = this.generateClientId();
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const pathParts = url.pathname.split('/').filter(Boolean);
      
      let projectId: string | null = null;
      let sessionId: string | null = null;
      
      if (pathParts[0] === 'projects' && pathParts[1]) {
        projectId = pathParts[1];
      }
      if (pathParts[2] === 'sessions' && pathParts[3]) {
        sessionId = pathParts[3];
      }
      
      const client: WSClient = {
        id: clientId,
        socket,
        subscriptions: new Set()
      };
      
      if (projectId && sessionId) {
        const roomKey = `${projectId}:${sessionId}`;
        client.subscriptions.add(roomKey);
        
        if (!this.sessionRooms.has(roomKey)) {
          this.sessionRooms.set(roomKey, new Set());
        }
        this.sessionRooms.get(roomKey)!.add(clientId);
      }
      
      this.clients.set(clientId, client);
      logger.info(`Client connected: ${clientId} (project: ${projectId}, session: ${sessionId})`);
      
      socket.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error) {
          logger.error('Failed to parse message', error);
        }
      });
      
      socket.on('close', () => {
        this.handleDisconnect(clientId);
      });
      
      socket.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}`, error);
      });
      
      socket.send(JSON.stringify({
        type: 'connected',
        clientId,
        message: 'Connected to Swarm CLI WebSocket'
      }));
    });
    
    logger.info('WebSocket server initialized');
  }

  private handleMessage(clientId: string, message: { type: string; [key: string]: unknown }): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    switch (message.type) {
      case 'subscribe:run': {
        const runId = message.runId as string;
        if (runId) {
          client.subscriptions.add(`run:${runId}`);
          logger.info(`Client ${clientId} subscribed to run ${runId}`);
        }
        break;
      }
      case 'unsubscribe:run': {
        const runId = message.runId as string;
        if (runId) {
          client.subscriptions.delete(`run:${runId}`);
          logger.info(`Client ${clientId} unsubscribed from run ${runId}`);
        }
        break;
      }
      default:
        logger.warn(`Unknown message type: ${message.type}`);
    }
  }

  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    for (const roomKey of client.subscriptions) {
      const room = this.sessionRooms.get(roomKey);
      if (room) {
        room.delete(clientId);
        if (room.size === 0) {
          this.sessionRooms.delete(roomKey);
        }
      }
    }
    
    this.clients.delete(clientId);
    logger.info(`Client disconnected: ${clientId}`);
  }

  broadcast(projectId: string, sessionId: string, event: string, data: unknown): void {
    const roomKey = `${projectId}:${sessionId}`;
    const room = this.sessionRooms.get(roomKey);
    
    if (!room) return;
    
    const message = JSON.stringify({
      type: event,
      ...data as object
    });
    
    for (const clientId of room) {
      const client = this.clients.get(clientId);
      if (client && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(message);
      }
    }
  }

  broadcastToRun(runId: string, event: string, data: unknown): void {
    const message = JSON.stringify({
      type: event,
      ...data as object
    });
    
    for (const client of this.clients.values()) {
      if (client.subscriptions.has(`run:${runId}`) && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(message);
      }
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  close(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.clients.clear();
    this.sessionRooms.clear();
  }
}

export const wsHandler = new WebSocketHandler();
