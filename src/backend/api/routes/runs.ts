import { Router, Request, Response } from 'express';
import { orchestrator } from '../../orchestrator-instance';
import { Logger } from '../../../utils/logger';

const logger = new Logger('RunsRoute');
const router = Router();

// GET /api/runs - List all runs
router.get('/', (req: Request, res: Response) => {
  const runs = orchestrator.getAllRuns();
  res.json({ runs });
});

// POST /api/runs - Create new run
router.post('/', async (req: Request, res: Response) => {
  try {
    const { spec, metadata } = req.body;
    
    if (!spec) {
      return res.status(400).json({ error: 'spec is required' });
    }
    
    const run = await orchestrator.createRun(spec, metadata);
    logger.info(`Created run via API: ${run.id}`);
    
    res.status(201).json({ run });
  } catch (error) {
    logger.error('Failed to create run', error);
    res.status(500).json({ error: 'Failed to create run' });
  }
});

// GET /api/runs/:id - Get run by ID
router.get('/:id', (req: Request, res: Response) => {
  const run = orchestrator.getRun(req.params.id);
  
  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }
  
  res.json({ run });
});

// POST /api/runs/:id/execute - Execute run
router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const runId = req.params.id;
    const run = orchestrator.getRun(runId);
    
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    // Execute asynchronously
    orchestrator.executeRun(runId).catch(error => {
      logger.error(`Run ${runId} execution failed`, error);
    });
    
    res.json({ message: 'Run execution started', runId });
  } catch (error) {
    logger.error('Failed to execute run', error);
    res.status(500).json({ error: 'Failed to execute run' });
  }
});

// POST /api/runs/:id/agents - Spawn agent for run
router.post('/:id/agents', async (req: Request, res: Response) => {
  try {
    const runId = req.params.id;
    const { agencyAgentId, model, apiUrl, apiKey } = req.body;
    
    if (!agencyAgentId || !model || !apiUrl) {
      return res.status(400).json({ 
        error: 'agencyAgentId, model, and apiUrl are required' 
      });
    }
    
    const agent = await orchestrator.spawnAgent(runId, agencyAgentId, {
      model,
      apiUrl,
      apiKey
    });
    
    if (!agent) {
      return res.status(400).json({ error: 'Failed to spawn agent' });
    }
    
    res.status(201).json({ 
      agent: {
        id: agent.getId(),
        role: agent.getRole(),
        status: agent.getStatus()
      }
    });
  } catch (error) {
    logger.error('Failed to spawn agent', error);
    res.status(500).json({ error: 'Failed to spawn agent' });
  }
});

export { router as runsRouter };
