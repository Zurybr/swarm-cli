import { Router, Request, Response } from 'express';
import { agentRegistry } from '../../../agents/agent-registry';
import { Logger } from '../../../utils/logger';

const logger = new Logger('AgentsRoute');
const router = Router();

// GET /api/agents - List all agents
router.get('/', (req: Request, res: Response) => {
  const agents = agentRegistry.getAll().map(agent => ({
    id: agent.getId(),
    role: agent.getRole(),
    status: agent.getStatus(),
    currentTask: agent.getCurrentTask()?.id
  }));
  
  res.json({ agents });
});

// GET /api/agents/stats - Get agent statistics
router.get('/stats', (req: Request, res: Response) => {
  const stats = agentRegistry.getStats();
  res.json(stats);
});

// GET /api/agents/:id - Get agent by ID
router.get('/:id', (req: Request, res: Response) => {
  const entry = agentRegistry.getEntry(req.params.id);
  
  if (!entry) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  const agent = entry.agent;
  res.json({
    agent: {
      id: agent.getId(),
      role: agent.getRole(),
      status: agent.getStatus(),
      currentTask: agent.getCurrentTask(),
      registeredAt: entry.registeredAt,
      metadata: entry.metadata
    }
  });
});

export { router as agentsRouter };
