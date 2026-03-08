import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { runsRouter } from './routes/runs';
import { agentsRouter } from './routes/agents';
import { tasksRouter } from './routes/tasks';
import { orchestrator } from '../orchestrator-instance';
import { Logger } from '../../utils/logger';

const logger = new Logger('APIServer');

export function createAPIServer(port: number = 3000) {
  const app = express();
  const server = createServer(app);
  const io = new SocketServer(server, {
    cors: { origin: '*' }
  });

  // Middleware
  app.use(express.json());
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  // Routes
  app.use('/api/runs', runsRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/tasks', tasksRouter);

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Orchestrator events → WebSocket
  orchestrator.on('run:created', (run) => {
    io.emit('run:created', run);
  });

  orchestrator.on('run:started', (run) => {
    io.emit('run:started', run);
  });

  orchestrator.on('run:completed', (run) => {
    io.emit('run:completed', run);
  });

  orchestrator.on('agent:spawned', (data) => {
    io.emit('agent:spawned', data);
  });

  orchestrator.on('task:started', (data) => {
    io.emit('task:started', data);
  });

  orchestrator.on('task:completed', (data) => {
    io.emit('task:completed', data);
  });

  // WebSocket connection handling
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);
    
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });

    // Subscribe to run updates
    socket.on('subscribe:run', (runId: string) => {
      socket.join(`run:${runId}`);
      logger.info(`Client ${socket.id} subscribed to run ${runId}`);
    });

    // Unsubscribe from run updates
    socket.on('unsubscribe:run', (runId: string) => {
      socket.leave(`run:${runId}`);
      logger.info(`Client ${socket.id} unsubscribed from run ${runId}`);
    });
  });

  server.listen(port, () => {
    logger.info(`API server listening on port ${port}`);
    logger.info(`WebSocket ready for connections`);
  });

  return { app, server, io };
}
