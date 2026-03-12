import { Command } from 'commander';
import { getMode, getClient } from '../client-context';
import { orchestrator } from '../../backend/orchestrator-instance';

const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
};

export function createExecuteCommand(): Command {
  const executeCmd = new Command('execute')
    .description('Execute a plan (supports local and remote)');

  executeCmd
    .command('run')
    .description('Run a plan')
    .argument('<plan-id>', 'Plan ID')
    .option('-p, --project <id>', 'Project ID (remote mode)')
    .option('-w, --watch', 'Watch execution progress', false)
    .action(handleExecuteRun);

  executeCmd
    .command('abort')
    .description('Abort running plan')
    .argument('<plan-id>', 'Plan ID')
    .option('-p, --project <id>', 'Project ID (remote mode)')
    .action(handleAbortRun);

  return executeCmd;
}

async function handleExecuteRun(planId: string, options: { project?: string; watch: boolean }): Promise<void> {
  const mode = getMode();

  if (mode === 'remote') {
    await handleRemoteExecute(planId, options.project, options.watch);
  } else {
    await handleLocalExecute(planId);
  }
}

async function handleRemoteExecute(planId: string, projectId: string | undefined, watch: boolean): Promise<void> {
  const client = getClient();
  if (!client) {
    console.error(colors.red('Not connected to server'));
    process.exit(1);
  }

  try {
    let targetProjectId = projectId;

    if (!targetProjectId) {
      const projects = await client.listProjects();
      if (projects.length === 0) {
        console.error(colors.red('No projects found'));
        process.exit(1);
      }
      targetProjectId = projects[0].id;
    }

    console.log(colors.blue(`Executing plan ${planId} on project ${targetProjectId}...`));
    
    const plan = await client.executePlan(targetProjectId, planId);
    
    console.log(colors.green(`Plan executed: ${plan.id}`));
    console.log(`Status: ${plan.status}`);
    
    if (watch) {
      console.log(colors.yellow('Watching progress... (not implemented)'));
    }
    
  } catch (error) {
    console.error(colors.red(`Error: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}

async function handleLocalExecute(planId: string): Promise<void> {
  console.log(colors.yellow('Local mode: Use plan execute command'));
  console.log(`  swarm-cli plan execute <file>`);
  console.log(`\nNote: plan IDs are for remote mode only`);
}

async function handleAbortRun(planId: string, options: { project?: string }): Promise<void> {
  const mode = getMode();

  if (mode === 'remote') {
    await handleRemoteAbort(planId, options.project);
  } else {
    console.log(colors.yellow('Local mode: Cannot abort remote plan'));
  }
}

async function handleRemoteAbort(planId: string, projectId: string | undefined): Promise<void> {
  const client = getClient();
  if (!client) {
    console.error(colors.red('Not connected to server'));
    process.exit(1);
  }

  try {
    let targetProjectId = projectId;

    if (!targetProjectId) {
      const projects = await client.listProjects();
      if (projects.length === 0) {
        console.error(colors.red('No projects found'));
        process.exit(1);
      }
      targetProjectId = projects[0].id;
    }

    const plan = await client.cancelPlan(targetProjectId, planId);
    
    console.log(colors.green(`Plan aborted: ${plan.id}`));
    console.log(`Status: ${plan.status}`);
    
  } catch (error) {
    console.error(colors.red(`Error: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}
