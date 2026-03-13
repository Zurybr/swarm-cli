import { Command } from 'commander';
import { getMode, getClient, isRemoteMode } from '../client-context';
import { getServerConfig } from '../../config/client-config';
import { Logger } from '../../utils/logger';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('StatusCommand');

const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
};

export function createStatusCommand(): Command {
  const statusCmd = new Command('status')
    .description('Show system status (local and remote)')
    .option('-v, --verbose', 'Verbose output')
    .action(handleStatus);

  return statusCmd;
}

async function handleStatus(options: { verbose: boolean }): Promise<void> {
  const mode = getMode();
  const serverConfig = getServerConfig();

  console.log('\n' + colors.cyan(' Swarm CLI Status\n'));
  
  console.log(colors.blue('Mode: ') + (mode === 'remote' ? colors.green('Remote') : colors.yellow('Local')));

  if (serverConfig) {
    console.log(colors.blue('Server: ') + serverConfig.url);
  }

  if (mode === 'remote') {
    await handleRemoteStatus(options.verbose);
  } else {
    handleLocalStatus();
  }

  console.log('\n' + colors.blue('💡 Commands:'));
  console.log('   swarm-cli connect <url> --token <token>  - Connect to server');
  console.log('   swarm-cli disconnect                     - Disconnect');
  console.log('   swarm-cli local                         - Force local mode');
  console.log('');
}

async function handleRemoteStatus(verbose: boolean): Promise<void> {
  const client = getClient();
  
  if (!client) {
    console.log('\n' + colors.red('Server: Not connected'));
    return;
  }

  console.log('\n' + colors.blue('Server Status:'));

  try {
    const projects = await client.listProjects();
    console.log(`  ${colors.green('●')} Connected`);
    console.log(`  Projects: ${projects.length}`);

    if (verbose && projects.length > 0) {
      console.log('\n' + colors.blue('Projects:'));
      for (const project of projects.slice(0, 5)) {
        console.log(`  - ${project.name} (${project.id})`);
      }
      if (projects.length > 5) {
        console.log(`  ... and ${projects.length - 5} more`);
      }
    }
  } catch (error) {
    console.log(`  ${colors.red('●')} Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.log(`  ${colors.yellow('Falling back to local mode...')}`);
  }
}

function handleLocalStatus(): void {
  console.log('\n' + colors.blue('Local Status:'));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    fetch('http://localhost:3000/health', { signal: controller.signal })
      .then(() => {
        clearTimeout(timeout);
        console.log(`  ${colors.green('●')} API: Online`);
      })
      .catch(() => {
        clearTimeout(timeout);
        console.log(`  ${colors.yellow('○')} API: Offline (run 'swarm-cli server')`);
      });
  } catch {
    console.log(`  ${colors.yellow('○')} API: Offline`);
  }

  try {
    const gitStatus = execSync('git status --short', { cwd: process.cwd(), encoding: 'utf8' });
    const gitLog = execSync('git log --oneline -1', { cwd: process.cwd(), encoding: 'utf8' }).trim();
    
    if (gitStatus.trim()) {
      console.log(`  ${colors.yellow('●')} Git: Changes pending`);
    } else {
      console.log(`  ${colors.green('●')} Git: Clean`);
    }
    console.log(`    Last: ${gitLog}`);
  } catch {
    console.log(`  ${colors.gray('○')} Git: Not available`);
  }

  try {
    const hivePath = path.join(process.cwd(), '.hive', 'issues.jsonl');
    if (fs.existsSync(hivePath)) {
      const content = fs.readFileSync(hivePath, 'utf8');
      const count = content.trim().split('\n').filter((l) => l.trim()).length;
      console.log(`  ${colors.cyan('●')} Issues: ${count}`);
    } else {
      console.log(`  ${colors.gray('○')} Issues: None`);
    }
  } catch {
    console.log(`  ${colors.gray('○')} Issues: Not available`);
  }
}
