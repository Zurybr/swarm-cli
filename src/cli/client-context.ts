import { SwarmClient } from '../client/client';
import {
  loadClientConfig,
  getServerConfig,
  isRemoteMode,
  isLocalMode,
  setLocalMode,
  reloadClientConfig,
  type ServerConfig,
  type ClientConfig,
} from '../config/client-config';
import { Logger } from '../utils/logger';

const logger = new Logger('ClientContext');

export type ExecutionMode = 'local' | 'remote';

let clientInstance: SwarmClient | null = null;
let currentMode: ExecutionMode = 'local';
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

export function getClientContext(): {
  mode: ExecutionMode;
  client: SwarmClient | null;
  config: ClientConfig;
} {
  return {
    mode: currentMode,
    client: clientInstance,
    config: loadClientConfig(),
  };
}

export function initializeClientContext(forceLocal = false): ExecutionMode {
  if (forceLocal) {
    setLocalMode(true);
    currentMode = 'local';
    clientInstance = null;
    logger.info('Mode: Local (forced)');
    return currentMode;
  }

  const config = loadClientConfig();

  if (!config.server) {
    currentMode = 'local';
    clientInstance = null;
    logger.info('Mode: Local (no server config)');
    return currentMode;
  }

  return connectToServer(config.server.url, config.server.token);
}

export function connectToServer(url: string, token: string): ExecutionMode {
  try {
    clientInstance = new SwarmClient();
    
    clientInstance.connect(url, {
      token,
    }).then(() => {
      currentMode = 'remote';
      reconnectAttempts = 0;
      logger.info(`Mode: Remote (${url})`);
    }).catch((error) => {
      logger.error(`Failed to connect to server: ${error instanceof Error ? error.message : error}`);
      currentMode = 'local';
      clientInstance = null;
    });
    
    currentMode = 'remote';
    reconnectAttempts = 0;
    logger.info(`Mode: Remote (${url})`);
    return currentMode;
  } catch (error) {
    logger.error(`Failed to connect to server: ${error instanceof Error ? error.message : error}`);
    currentMode = 'local';
    clientInstance = null;
    return currentMode;
  }
}

export function disconnectFromServer(): void {
  if (clientInstance) {
    clientInstance.disconnect();
    clientInstance = null;
  }
  currentMode = 'local';
  logger.info('Disconnected from server');
}

export async function reconnectToServer(): Promise<ExecutionMode> {
  const config = getServerConfig();
  
  if (!config) {
    logger.warn('No server config to reconnect');
    return currentMode;
  }

  reconnectAttempts++;

  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    logger.error(`Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached, falling back to local mode`);
    currentMode = 'local';
    clientInstance = null;
    reconnectAttempts = 0;
    return currentMode;
  }

  logger.info(`Reconnecting to server (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
  return connectToServer(config.url, config.token);
}

export function isConnected(): boolean {
  return clientInstance !== null && currentMode === 'remote';
}

export function getClient(): SwarmClient | null {
  return clientInstance;
}

export function getMode(): ExecutionMode {
  return currentMode;
}

export { isRemoteMode, isLocalMode, reloadClientConfig, type ServerConfig, type ClientConfig };
