import { createAPIServer } from './api/server';
import { Logger } from '../utils/logger';

const logger = new Logger('Backend');
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

logger.info('Starting Swarm CLI Backend...');
createAPIServer(port);
