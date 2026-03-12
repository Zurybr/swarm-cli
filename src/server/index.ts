import express, { Request, Response, NextFunction } from 'express';
import { createServer as createHttpServer } from 'http';
import { projectsRouter } from './api/projects';
import { sessionsRouter } from './api/sessions';
import { plansRouter } from './api/plans';
import { filesRouter } from './api/files';
import { corsMiddleware } from './middleware/cors';
import { authMiddleware } from './middleware/auth';
import { wsHandler } from './websocket/handler';
import { Logger } from '../utils/logger';

const logger = new Logger('Server');

export interface ServerConfig {
  port: number;
  apiPrefix: string;
}

export function createServer(config: ServerConfig = { port: 3000, apiPrefix: '/api' }) {
  const app = express();
  const server = createHttpServer(app);
  
  app.use(corsMiddleware);
  app.use(express.json());
  
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });
  
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
  
  app.use(`${config.apiPrefix}/projects`, projectsRouter);
  app.use(`${config.apiPrefix}/projects/:projectId/sessions`, sessionsRouter);
  app.use(`${config.apiPrefix}/projects/:projectId/plans`, plansRouter);
  app.use(`${config.apiPrefix}/projects/:projectId/sessions/:sessionId/files`, filesRouter);
  
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', err);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  });
  
  wsHandler.initialize(server);
  
  server.listen(config.port, () => {
    logger.info(`Server listening on port ${config.port}`);
    logger.info(`API: ${config.apiPrefix}`);
    logger.info(`WebSocket: ws://localhost:${config.port}/ws`);
  });
  
  return { app, server };
}

if (require.main === module) {
  const port = parseInt(process.env.PORT || '3000', 10);
  createServer({ port, apiPrefix: '/api' });
}
