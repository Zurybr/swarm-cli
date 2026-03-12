import { Command } from 'commander';
import { saveServerConfig, getServerConfig } from '../../config/client-config';
import { connectToServer, disconnectFromServer, getMode, initializeClientContext } from '../client-context';
import { SwarmClient } from '../../client/client';

export function createConnectCommand(): Command {
  const connectCmd = new Command('connect')
    .description('Connect to remote Swarm server')
    .argument('<url>', 'Server URL (e.g., https://swarm.example.com)')
    .option('-t, --token <token>', 'Authentication token')
    .option('-g, --global', 'Save config globally (~/.swarm/config.yaml)', false)
    .action(handleConnect);

  return connectCmd;
}

async function handleConnect(url: string, options: { token?: string; global: boolean }): Promise<void> {
  if (!options.token) {
    console.error('Error: --token is required');
    process.exit(1);
  }

  try {
    const client = new SwarmClient();
    await client.connect(url, { token: options.token });
    
    saveServerConfig(url, options.token, options.global);
    
    initializeClientContext();
    
    console.log(`Connected to ${url}`);
    console.log(`Config saved to ${options.global ? '~/.swarm/config.yaml' : '.swarm/config.yaml'}`);
    
    client.disconnect();
  } catch (error) {
    console.error(`Failed to connect: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

export function createDisconnectCommand(): Command {
  const disconnectCmd = new Command('disconnect')
    .description('Disconnect from remote Swarm server')
    .action(handleDisconnect);

  return disconnectCmd;
}

function handleDisconnect(): void {
  const config = getServerConfig();
  
  if (!config) {
    console.log('Not connected to any server');
    return;
  }

  disconnectFromServer();
  console.log('Disconnected from server');
}

export function createLocalCommand(): Command {
  const localCmd = new Command('local')
    .description('Force local mode (ignore server config)')
    .action(handleLocal);

  return localCmd;
}

function handleLocal(): void {
  initializeClientContext(true);
  console.log('Mode: Local (forced)');
}

export function createServerStatusCommand(): Command {
  const statusCmd = new Command('server:status')
    .description('Show server connection status')
    .action(handleServerStatus);

  return statusCmd;
}

function handleServerStatus(): void {
  const mode = getMode();
  const config = getServerConfig();

  console.log(`\nMode: ${mode === 'remote' ? 'Remote' : 'Local'}`);

  if (config) {
    console.log(`Server: ${config.url}`);
  } else {
    console.log('Server: Not configured');
  }

  console.log('\nUse:');
  console.log('  swarm-cli connect <url> --token <token>  - Connect to server');
  console.log('  swarm-cli disconnect                     - Disconnect from server');
  console.log('  swarm-cli local                         - Force local mode');
}
