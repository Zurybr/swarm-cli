import { Router, Response } from 'express';
import { projectService } from '../services/projectService';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { ProjectConfig } from '../../types/api';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const projects = await projectService.list();
  const activeId = projectService.getActiveProjectId();
  
  res.json({
    projects,
    activeProject: activeId
  });
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { name, path, config } = req.body;
  
  if (!name) {
    return res.status(400).json({
      error: 'name is required',
      code: 'VALIDATION_ERROR'
    });
  }
  
  try {
    const project = await projectService.create({ name, path, config });
    res.status(201).json({ project });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create project',
      code: 'CREATE_ERROR',
      details: error instanceof Error ? error.message : undefined
    });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const project = await projectService.get(req.params.id);
  
  if (!project) {
    return res.status(404).json({
      error: 'Project not found',
      code: 'NOT_FOUND'
    });
  }
  
  res.json({ project });
});

router.post('/:id/switch', async (req: AuthenticatedRequest, res: Response) => {
  const project = await projectService.setActive(req.params.id);
  
  if (!project) {
    return res.status(404).json({
      error: 'Project not found',
      code: 'NOT_FOUND'
    });
  }
  
  res.json({ 
    project,
    message: `Switched to project: ${project.name}`
  });
});

router.get('/:id/config', async (req: AuthenticatedRequest, res: Response) => {
  const config = await projectService.getConfig(req.params.id);
  
  if (!config) {
    return res.status(404).json({
      error: 'Project not found',
      code: 'NOT_FOUND'
    });
  }
  
  res.json({ config });
});

router.put('/:id/config', async (req: AuthenticatedRequest, res: Response) => {
  const config = req.body as Partial<ProjectConfig>;
  
  const updated = await projectService.updateConfig(req.params.id, config);
  
  if (!updated) {
    return res.status(404).json({
      error: 'Project not found',
      code: 'NOT_FOUND'
    });
  }
  
  res.json({ config: updated });
});

router.get('/:id/worktrees', async (req: AuthenticatedRequest, res: Response) => {
  const worktrees = await projectService.listWorktrees(req.params.id);
  
  res.json({ worktrees });
});

router.post('/:id/worktrees', async (req: AuthenticatedRequest, res: Response) => {
  const { taskId } = req.body;
  
  if (!taskId) {
    return res.status(400).json({
      error: 'taskId is required',
      code: 'VALIDATION_ERROR'
    });
  }
  
  const worktree = await projectService.createWorktree(req.params.id, taskId);
  
  if (!worktree) {
    return res.status(500).json({
      error: 'Failed to create worktree',
      code: 'WORKTREE_ERROR'
    });
  }
  
  res.status(201).json({ worktree });
});

router.delete('/:id/worktrees/:taskId', async (req: AuthenticatedRequest, res: Response) => {
  const removed = await projectService.removeWorktree(req.params.id, req.params.taskId);
  
  if (!removed) {
    return res.status(500).json({
      error: 'Failed to remove worktree',
      code: 'WORKTREE_ERROR'
    });
  }
  
  res.sendStatus(204);
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const deleted = await projectService.delete(req.params.id);
  
  if (!deleted) {
    return res.status(404).json({
      error: 'Project not found',
      code: 'NOT_FOUND'
    });
  }
  
  res.sendStatus(204);
});

export { router as projectsRouter };
