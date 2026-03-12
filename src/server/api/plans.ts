import { Router, Response } from 'express';
import { planService } from '../services/planService';
import { projectService } from '../services/projectService';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  
  const project = await projectService.get(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
  }
  
  const plans = await planService.list(projectId);
  res.json({ plans });
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const { tasks } = req.body;
  
  const project = await projectService.get(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
  }
  
  if (!tasks || !Array.isArray(tasks)) {
    return res.status(400).json({
      error: 'tasks array is required',
      code: 'VALIDATION_ERROR'
    });
  }
  
  const plan = await planService.create(projectId, tasks);
  res.status(201).json({ plan });
});

router.get('/:planId', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, planId } = req.params;
  
  const plan = await planService.get(projectId, planId);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found', code: 'NOT_FOUND' });
  }
  
  res.json({ plan });
});

router.get('/:planId/status', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, planId } = req.params;
  
  const plan = await planService.get(projectId, planId);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found', code: 'NOT_FOUND' });
  }
  
  res.json({ plan });
});

router.post('/:planId/execute', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, planId } = req.params;
  
  const plan = await planService.get(projectId, planId);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found', code: 'NOT_FOUND' });
  }
  
  const updated = await planService.updateStatus(planId, 'running');
  res.json({ plan: updated, message: 'Plan execution started' });
});

router.post('/:planId/cancel', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, planId } = req.params;
  
  const plan = await planService.get(projectId, planId);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found', code: 'NOT_FOUND' });
  }
  
  const updated = await planService.updateStatus(planId, 'cancelled');
  res.json({ plan: updated, message: 'Plan cancelled' });
});

router.delete('/:planId', async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, planId } = req.params;
  
  const deleted = await planService.delete(projectId, planId);
  if (!deleted) {
    return res.status(404).json({ error: 'Plan not found', code: 'NOT_FOUND' });
  }
  
  res.sendStatus(204);
});

export { router as plansRouter };
