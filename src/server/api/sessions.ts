import { Router, Response } from 'express';
import { sessionService } from '../services/sessionService';
import { projectService } from '../services/projectService';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { MessageRole } from '../../types/api';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  
  const project = await projectService.get(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
  }
  
  const sessions = await sessionService.list(projectId);
  res.json({ sessions });
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { config } = req.body;
  
  const project = await projectService.get(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
  }
  
  const session = await sessionService.create(projectId, config);
  res.status(201).json({ session });
});

router.get('/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, sessionId } = req.params;
  
  const session = await sessionService.get(projectId, sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
  }
  
  res.json({ session });
});

router.delete('/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, sessionId } = req.params;
  
  const deleted = await sessionService.delete(projectId, sessionId);
  if (!deleted) {
    return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
  }
  
  res.sendStatus(204);
});

router.post('/:sessionId/init', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, sessionId } = req.params;
  const { spec, context } = req.body;
  
  const session = await sessionService.get(projectId, sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
  }
  
  const updated = await sessionService.updateStatus(sessionId, 'running');
  res.json({ session: updated, message: 'Session initialized successfully' });
});

router.post('/:sessionId/abort', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, sessionId } = req.params;
  
  const session = await sessionService.get(projectId, sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
  }
  
  const updated = await sessionService.updateStatus(sessionId, 'aborted');
  res.json({ session: updated, message: 'Session aborted' });
});

router.post('/:sessionId/pause', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, sessionId } = req.params;
  
  const session = await sessionService.get(projectId, sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
  }
  
  const updated = await sessionService.updateStatus(sessionId, 'paused');
  res.json({ session: updated, message: 'Session paused' });
});

router.post('/:sessionId/resume', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, sessionId } = req.params;
  
  const session = await sessionService.get(projectId, sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
  }
  
  const updated = await sessionService.updateStatus(sessionId, 'running');
  res.json({ session: updated, message: 'Session resumed' });
});

router.get('/:sessionId/messages', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, sessionId } = req.params;
  const { limit, offset, role } = req.query;
  
  const session = await sessionService.get(projectId, sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
  }
  
  const result = await sessionService.listMessages(
    sessionId,
    limit ? parseInt(limit as string) : 50,
    offset ? parseInt(offset as string) : 0,
    role as MessageRole | undefined
  );
  
  res.json(result);
});

router.post('/:sessionId/messages', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, sessionId } = req.params;
  const { role, content, metadata } = req.body;
  
  if (!role || !content) {
    return res.status(400).json({
      error: 'role and content are required',
      code: 'VALIDATION_ERROR'
    });
  }
  
  const session = await sessionService.get(projectId, sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
  }
  
  const message = await sessionService.addMessage(sessionId, { role, content, metadata });
  res.status(201).json({ message });
});

router.get('/:sessionId/messages/:messageId', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, sessionId, messageId } = req.params;
  
  const session = await sessionService.get(projectId, sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
  }
  
  const message = await sessionService.getMessage(sessionId, messageId);
  if (!message) {
    return res.status(404).json({ error: 'Message not found', code: 'NOT_FOUND' });
  }
  
  res.json({ message });
});

export { router as sessionsRouter };
