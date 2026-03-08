import { Logger } from '../../utils/logger';
import { orchestrator } from '../../backend/orchestrator-instance';

const logger = new Logger('StructuredMode');

export interface StructuredOptions {
  config?: string;
  spec?: string;
}

export async function structuredMode(options: StructuredOptions): Promise<void> {
  logger.info('Structured mode started', options);
  
  // Output structured JSON for AI consumption
  const output = {
    mode: 'structured',
    timestamp: new Date().toISOString(),
    options,
    orchestrator: {
      config: orchestrator.getConfig(),
      runs: orchestrator.getAllRuns().map(r => ({
        id: r.id,
        status: r.status,
        agents: r.agents.length,
        tasks: r.tasks.length
      }))
    }
  };
  
  console.log(JSON.stringify(output, null, 2));
}
