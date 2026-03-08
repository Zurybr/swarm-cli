import { Router, Request, Response } from 'express';
import { Logger } from '../../../utils/logger';

const logger = new Logger('TasksRoute');
const router = Router();

// GET /api/tasks - List tasks (placeholder)
router.get('/', (req: Request, res: Response) => {
  // TODO: Implement task listing from database
  res.json({ tasks: [] });
});

// POST /api/tasks - Create task (placeholder)
router.post('/', (req: Request, res: Response) => {
  // TODO: Implement task creation
  res.status(201).json({ message: 'Task created' });
});

export { router as tasksRouter };
