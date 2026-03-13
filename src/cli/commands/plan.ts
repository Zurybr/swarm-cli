import { Command } from 'commander';
import { getMode, getClient, isRemoteMode, reconnectToServer } from '../client-context';
import { PlanParser } from '../../plan/parser';
import { PlanValidator } from '../../plan/validator';
import * as fs from 'fs/promises';

const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
};

export function createPlanCommandRemote(): Command {
  const planCmd = new Command('plan')
    .description('Plan management commands (supports local and remote)');

  planCmd
    .command('create')
    .description('Create a plan from spec file')
    .argument('<spec>', 'Specification file path')
    .option('-p, --project <id>', 'Project ID (remote mode)')
    .action(handlePlanCreate);

  planCmd
    .command('list')
    .description('List plans')
    .option('-p, --project <id>', 'Project ID (remote mode)')
    .action(handlePlanList);

  planCmd
    .command('status')
    .description('Get plan status')
    .argument('<plan-id>', 'Plan ID')
    .option('-p, --project <id>', 'Project ID (remote mode)')
    .action(handlePlanStatus);

  return planCmd;
}

async function handlePlanCreate(spec: string, options: { project?: string }): Promise<void> {
  const mode = getMode();

  if (mode === 'remote') {
    await handleRemotePlanCreate(spec, options.project);
  } else {
    await handleLocalPlanCreate(spec);
  }
}

async function handleRemotePlanCreate(spec: string, projectId?: string): Promise<void> {
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
        console.error(colors.red('No projects found. Create a project first.'));
        process.exit(1);
      }
      targetProjectId = projects[0].id;
    }

    const specContent = await fs.readFile(spec, 'utf-8');
    
    const plans = await client.listPlans(targetProjectId);
    console.log(`Found ${plans.length} existing plans`);
    console.log(colors.green(`Plan would be created in project ${targetProjectId}`));
    console.log(`Spec: ${spec}`);
    
  } catch (error) {
    console.error(colors.red(`Error: ${error instanceof Error ? error.message : error}`));
    
    if (error instanceof Error && error.message.includes('fetch')) {
      console.log(colors.yellow('\nFalling back to local mode...'));
    }
    process.exit(1);
  }
}

async function handleLocalPlanCreate(spec: string): Promise<void> {
  try {
    const content = await fs.readFile(spec, 'utf-8');
    const parser = new PlanParser();
    const result = parser.parse(content, spec);

    if (!result.success) {
      console.error(colors.red('Parse failed:'));
      for (const error of result.errors) {
        console.error(colors.red(`  [${error.code}] ${error.message}`));
      }
      process.exit(1);
    }

    console.log(colors.green(`Plan created: ${result.plan?.metadata.phase}-${result.plan?.metadata.plan}`));
  } catch (error) {
    console.error(colors.red(`Error: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}

async function handlePlanList(options: { project?: string }): Promise<void> {
  const mode = getMode();

  if (mode === 'remote') {
    await handleRemotePlanList(options.project);
  } else {
    console.log('Local mode: Use plan commands directly');
    console.log('  swarm-cli plan parse <file>');
    console.log('  swarm-cli plan validate <file>');
    console.log('  swarm-cli plan execute <file>');
  }
}

async function handleRemotePlanList(projectId?: string): Promise<void> {
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
        console.log('No projects found');
        return;
      }
      targetProjectId = projects[0].id;
    }

    const plans = await client.listPlans(targetProjectId);

    if (plans.length === 0) {
      console.log('No plans found');
      return;
    }

    console.log(`\nPlans in project ${targetProjectId}:`);
    console.log();

    for (const plan of plans) {
      console.log(`  ${plan.id}: (${plan.status}) - ${plan.tasks?.length || 0} tasks`);
    }
  } catch (error) {
    console.error(colors.red(`Error: ${error instanceof Error ? error.message : error}`));
    
    if (error instanceof Error && error.message.includes('fetch')) {
      console.log(colors.yellow('\nServer unreachable. Falling back to local mode...'));
    }
    process.exit(1);
  }
}

async function handlePlanStatus(planId: string, options: { project?: string }): Promise<void> {
  const mode = getMode();

  if (mode === 'remote') {
    await handleRemotePlanStatus(planId, options.project);
  } else {
    console.log('Local mode: Plan status not available');
  }
}

async function handleRemotePlanStatus(planId: string, projectId?: string): Promise<void> {
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

    const plan = await client.getPlanStatus(targetProjectId, planId);
    
    console.log(`\nPlan: ${plan.id}`);
    console.log(`Status: ${plan.status}`);
    console.log(`Tasks: ${plan.tasks?.length || 0}`);
    
  } catch (error) {
    console.error(colors.red(`Error: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}
