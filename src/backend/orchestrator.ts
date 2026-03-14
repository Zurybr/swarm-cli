// Lightweight bridge to expose the core Orchestrator from the backend path
// so that files importing from './orchestrator' (in this directory)
// can resolve to the main implementation located at 'src/core/orchestrator.ts'.
export { Orchestrator } from '../core/orchestrator';
