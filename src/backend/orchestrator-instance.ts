import { Orchestrator } from './orchestrator';

// Singleton orchestrator instance for the application
export const orchestrator = new Orchestrator({
  maxParallelAgents: 10,
  defaultRetries: 5,
  ralphLoopEnabled: true,
  ralphMaxIterations: 10
});
