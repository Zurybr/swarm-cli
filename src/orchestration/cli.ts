#!/usr/bin/env node

/**
 * Orchestration CLI Commands
 * Provides 'swarm orchestrate' commands for managing agent swarms
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { Orchestrator } from './index';
import { AgentType, CoordinationStrategyType, TaskCreationRequest } from './types';
import { createAgentConfig, getAllAgentTypes, getAgentName } from './agents';

let orchestrator: Orchestrator | null = null;

/**
 * Get or create the orchestrator instance
 */
function getOrchestrator(): Orchestrator {
  if (!orchestrator) {
    orchestrator = new Orchestrator({
      defaultStrategy: 'adaptive',
      maxConcurrentSwarms: 5,
      taskQueueSize: 1000,
      enablePersistence: false,
      logLevel: 'info',
    });
  }
  return orchestrator;
}

/**
 * Create the orchestrate command
 */
export function createOrchestrateCommand(): Command {
  const command = new Command('orchestrate')
    .description('Manage agent orchestration and swarms');

  // Swarm management commands
  command.addCommand(createSwarmCommands());

  // Agent management commands
  command.addCommand(createAgentCommands());

  // Task management commands
  command.addCommand(createTaskCommands());

  // Message commands
  command.addCommand(createMessageCommands());

  // Strategy commands
  command.addCommand(createStrategyCommands());

  // Workflow commands
  command.addCommand(createWorkflowCommands());

  // Stats and monitoring
  command.addCommand(createStatsCommands());

  return command;
}

/**
 * Swarm management commands
 */
function createSwarmCommands(): Command {
  const command = new Command('swarm')
    .description('Manage swarms');

  // Create swarm
  command
    .command('create')
    .description('Create a new swarm')
    .requiredOption('-n, --name <name>', 'Swarm name')
    .option('-s, --strategy <strategy>', 'Coordination strategy', 'adaptive')
    .option('-m, --max-agents <n>', 'Maximum agents', '20')
    .option('--auto-scale', 'Enable auto-scaling', false)
    .option('--load-balance', 'Enable load balancing', false)
    .action((options) => {
      const orch = getOrchestrator();
      const swarm = orch.createSwarm(options.name, {
        strategy: options.strategy as CoordinationStrategyType,
        maxAgents: parseInt(options.maxAgents, 10),
        autoScale: options.autoScale,
        loadBalance: options.loadBalance,
      });

      console.log(chalk.green('✓ Swarm created'));
      console.log(`  ID: ${swarm.getInfo().id}`);
      console.log(`  Name: ${swarm.getInfo().name}`);
      console.log(`  Strategy: ${options.strategy}`);
    });

  // List swarms
  command
    .command('list')
    .alias('ls')
    .description('List all swarms')
    .action(() => {
      const orch = getOrchestrator();
      const swarms = orch.getAllSwarms();

      if (swarms.length === 0) {
        console.log(chalk.yellow('No swarms found'));
        return;
      }

      console.log(chalk.bold('\nSwarms:'));
      console.table(
        swarms.map((s) => {
          const info = s.getInfo();
          return {
            ID: info.id.slice(0, 8) + '...',
            Name: info.name,
            Status: info.status,
            Agents: info.agentCount,
            Tasks: info.taskCount,
            Created: info.createdAt.toISOString().split('T')[0],
          };
        })
      );
    });

  // Get swarm info
  command
    .command('info')
    .description('Get swarm information')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .action((options) => {
      const orch = getOrchestrator();
      const stats = orch.getSwarmStats(options.swarm);

      if (!stats) {
        console.error(chalk.red('Swarm not found'));
        process.exit(1);
      }

      console.log(chalk.bold('\nSwarm Information:'));
      console.log(`  Status: ${stats.status}`);
      console.log(`  Agents: ${stats.agents}`);
      console.log(`  Tasks: ${stats.tasks}`);
      console.log(`\nMetrics:`);
      console.log(`  Completed Tasks: ${stats.metrics.completedTasks}`);
      console.log(`  Failed Tasks: ${stats.metrics.failedTasks}`);
      console.log(`  Average Completion Time: ${stats.metrics.averageCompletionTime.toFixed(2)} min`);
      console.log(`  Agent Utilization: ${(stats.metrics.agentUtilization * 100).toFixed(1)}%`);
    });

  // Terminate swarm
  command
    .command('terminate')
    .description('Terminate a swarm')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .option('--force', 'Force termination without graceful shutdown', false)
    .action(async (options) => {
      const orch = getOrchestrator();
      const success = await orch.terminateSwarm(options.swarm, !options.force);

      if (success) {
        console.log(chalk.green('✓ Swarm terminated'));
      } else {
        console.error(chalk.red('Failed to terminate swarm'));
        process.exit(1);
      }
    });

  // Auto-scale swarm
  command
    .command('scale')
    .description('Auto-scale a swarm')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .action((options) => {
      const orch = getOrchestrator();
      const newAgents = orch.autoScale(options.swarm);

      if (newAgents.length > 0) {
        console.log(chalk.green(`✓ Scaled up: ${newAgents.length} new agents`));
        for (const agent of newAgents) {
          console.log(`  - ${agent.name} (${agent.type})`);
        }
      } else {
        console.log(chalk.yellow('No scaling needed'));
      }
    });

  return command;
}

/**
 * Agent management commands
 */
function createAgentCommands(): Command {
  const command = new Command('agent')
    .description('Manage agents in a swarm');

  // Register agent
  command
    .command('register')
    .description('Register a new agent')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .requiredOption('-t, --type <type>', 'Agent type')
    .option('-n, --name <name>', 'Agent name')
    .action((options) => {
      const orch = getOrchestrator();

      if (!getAllAgentTypes().includes(options.type as AgentType)) {
        console.error(chalk.red(`Invalid agent type: ${options.type}`));
        console.log(`Valid types: ${getAllAgentTypes().join(', ')}`);
        process.exit(1);
      }

      const agent = orch.registerAgent(options.swarm, {
        type: options.type as AgentType,
        name: options.name,
      });

      console.log(chalk.green('✓ Agent registered'));
      console.log(`  ID: ${agent.id}`);
      console.log(`  Type: ${agent.type}`);
      console.log(`  Name: ${agent.name}`);
    });

  // Register multiple agents
  command
    .command('register-bulk')
    .description('Register multiple agents')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .requiredOption('-t, --type <type>', 'Agent type')
    .requiredOption('-c, --count <n>', 'Number of agents')
    .action((options) => {
      const orch = getOrchestrator();
      const count = parseInt(options.count, 10);

      const requests = Array.from({ length: count }, () => ({
        type: options.type as AgentType,
      }));

      const agents = orch.registerAgents(options.swarm, requests);

      console.log(chalk.green(`✓ Registered ${agents.length} agents`));
      for (const agent of agents) {
        console.log(`  - ${agent.id.slice(0, 8)}... (${agent.type})`);
      }
    });

  // List agents
  command
    .command('list')
    .alias('ls')
    .description('List agents in a swarm')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .option('-t, --type <type>', 'Filter by type')
    .action((options) => {
      const orch = getOrchestrator();
      const swarm = orch.getSwarm(options.swarm);

      if (!swarm) {
        console.error(chalk.red('Swarm not found'));
        process.exit(1);
      }

      let agents = swarm.getAllAgents();

      if (options.type) {
        agents = agents.filter((a) => a.type === options.type);
      }

      if (agents.length === 0) {
        console.log(chalk.yellow('No agents found'));
        return;
      }

      console.log(chalk.bold(`\nAgents (${agents.length}):`));
      console.table(
        agents.map((a) => ({
          ID: a.id.slice(0, 8) + '...',
          Type: a.type,
          Name: a.name,
          Status: a.status,
          Workload: `${(a.workload * 100).toFixed(0)}%`,
          Tasks: a.assignedTasks.length,
        }))
      );
    });

  // Unregister agent
  command
    .command('unregister')
    .description('Unregister an agent')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .requiredOption('-a, --agent <id>', 'Agent ID')
    .action((options) => {
      const orch = getOrchestrator();
      const success = orch.unregisterAgent(options.swarm, options.agent);

      if (success) {
        console.log(chalk.green('✓ Agent unregistered'));
      } else {
        console.error(chalk.red('Failed to unregister agent'));
        process.exit(1);
      }
    });

  // Show agent types
  command
    .command('types')
    .description('Show available agent types')
    .action(() => {
      console.log(chalk.bold('\nAvailable Agent Types:\n'));

      for (const type of getAllAgentTypes()) {
        const info = createAgentConfig(type);
        console.log(chalk.cyan(`  ${info.name}`));
        console.log(`    ${info.description}`);
        console.log(`    Capabilities: ${Object.entries(info.capabilities)
          .filter(([, v]) => v === true || (typeof v === 'number' && v > 0))
          .map(([k]) => k)
          .join(', ')}`);
        console.log();
      }
    });

  return command;
}

/**
 * Task management commands
 */
function createTaskCommands(): Command {
  const command = new Command('task')
    .description('Manage tasks');

  // Create task
  command
    .command('create')
    .description('Create a new task')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .requiredOption('-t, --title <title>', 'Task title')
    .requiredOption('-d, --description <desc>', 'Task description')
    .requiredOption('--type <type>', 'Task type')
    .option('-p, --priority <priority>', 'Priority (low/medium/high/critical)', 'medium')
    .option('-c, --complexity <complexity>', 'Complexity (simple/moderate/complex/very_complex)', 'moderate')
    .option('--agent-type <type>', 'Required agent type')
    .option('--deps <deps>', 'Dependencies (comma-separated task IDs)')
    .action((options) => {
      const orch = getOrchestrator();

      const request: TaskCreationRequest = {
        title: options.title,
        description: options.description,
        taskType: options.type,
        priority: options.priority as TaskCreationRequest['priority'],
        complexity: options.complexity as TaskCreationRequest['complexity'],
        requiredAgentType: options.agentType as AgentType,
        dependencies: options.deps ? options.deps.split(',') : undefined,
      };

      const task = orch.createTask(options.swarm, request);

      console.log(chalk.green('✓ Task created'));
      console.log(`  ID: ${task.id}`);
      console.log(`  Title: ${task.title}`);
      console.log(`  Priority: ${task.priority}`);
    });

  // List tasks
  command
    .command('list')
    .alias('ls')
    .description('List tasks in a swarm')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .option('--status <status>', 'Filter by status')
    .action((options) => {
      const orch = getOrchestrator();
      const swarm = orch.getSwarm(options.swarm);

      if (!swarm) {
        console.error(chalk.red('Swarm not found'));
        process.exit(1);
      }

      let tasks = swarm.getAllTasks();

      if (options.status) {
        tasks = tasks.filter((t) => t.status === options.status);
      }

      if (tasks.length === 0) {
        console.log(chalk.yellow('No tasks found'));
        return;
      }

      console.log(chalk.bold(`\nTasks (${tasks.length}):`));
      console.table(
        tasks.map((t) => ({
          ID: t.id.slice(0, 8) + '...',
          Title: t.title.slice(0, 30),
          Status: t.status,
          Priority: t.priority,
          Assigned: t.assignedTo ? t.assignedTo.slice(0, 8) + '...' : '-',
        }))
      );
    });

  // Complete task
  command
    .command('complete')
    .description('Mark a task as completed')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .requiredOption('-t, --task <id>', 'Task ID')
    .option('--output <output>', 'Task output')
    .option('--failed', 'Mark as failed', false)
    .action((options) => {
      const orch = getOrchestrator();

      const result = {
        success: !options.failed,
        output: options.output,
        metrics: {
          startTime: new Date(),
          endTime: new Date(),
        },
      };

      const success = orch.completeTask(options.swarm, options.task, result);

      if (success) {
        console.log(chalk.green(options.failed ? '✓ Task marked as failed' : '✓ Task completed'));
      } else {
        console.error(chalk.red('Failed to complete task'));
        process.exit(1);
      }
    });

  // Cancel task
  command
    .command('cancel')
    .description('Cancel a task')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .requiredOption('-t, --task <id>', 'Task ID')
    .action((options) => {
      const orch = getOrchestrator();
      const success = orch.cancelTask(options.swarm, options.task);

      if (success) {
        console.log(chalk.green('✓ Task cancelled'));
      } else {
        console.error(chalk.red('Failed to cancel task'));
        process.exit(1);
      }
    });

  // Process pending tasks
  command
    .command('process')
    .description('Process pending tasks')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .action(async (options) => {
      const orch = getOrchestrator();
      await orch.processPendingTasks(options.swarm);
      console.log(chalk.green('✓ Processed pending tasks'));
    });

  return command;
}

/**
 * Message commands
 */
function createMessageCommands(): Command {
  const command = new Command('message')
    .alias('msg')
    .description('Manage agent messages');

  // Send message
  command
    .command('send')
    .description('Send a message')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .requiredOption('-f, --from <agent>', 'Sender agent ID')
    .requiredOption('-t, --to <agent>', 'Recipient agent ID')
    .requiredOption('--subject <subject>', 'Message subject')
    .requiredOption('-m, --message <content>', 'Message content')
    .option('--type <type>', 'Message type', 'direct')
    .option('--priority <priority>', 'Priority', 'normal')
    .action((options) => {
      const orch = getOrchestrator();
      const success = orch.sendMessage(options.swarm, {
        type: options.type,
        from: options.from,
        to: options.to,
        subject: options.subject,
        content: options.message,
        priority: options.priority,
      });

      if (success) {
        console.log(chalk.green('✓ Message sent'));
      } else {
        console.error(chalk.red('Failed to send message'));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Strategy commands
 */
function createStrategyCommands(): Command {
  const command = new Command('strategy')
    .description('Manage coordination strategies');

  // Set strategy
  command
    .command('set')
    .description('Set coordination strategy')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .requiredOption('-t, --type <type>', 'Strategy type (parallel/sequential/adaptive/hierarchical)')
    .action((options) => {
      const orch = getOrchestrator();
      const success = orch.setStrategy(options.swarm, options.type as CoordinationStrategyType);

      if (success) {
        console.log(chalk.green(`✓ Strategy set to ${options.type}`));
      } else {
        console.error(chalk.red('Failed to set strategy'));
        process.exit(1);
      }
    });

  // Get recommended strategy
  command
    .command('recommend')
    .description('Get recommended strategy for a swarm')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .action((options) => {
      const orch = getOrchestrator();
      const recommendation = orch.getRecommendedStrategy(options.swarm);

      console.log(chalk.bold('Recommended Strategy:'), recommendation);
    });

  return command;
}

/**
 * Workflow commands
 */
function createWorkflowCommands(): Command {
  const command = new Command('workflow')
    .alias('flow')
    .description('Manage workflows');

  // Create workflow
  command
    .command('create')
    .description('Create a workflow from tasks')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .requiredOption('-f, --file <file>', 'JSON file with task definitions')
    .action((options) => {
      const fs = require('fs');
      const orch = getOrchestrator();

      try {
        const tasks = JSON.parse(fs.readFileSync(options.file, 'utf-8'));
        const taskIds = orch.createWorkflow(options.swarm, tasks);

        console.log(chalk.green('✓ Workflow created'));
        console.log(`  Tasks: ${taskIds.length}`);
        for (const id of taskIds) {
          console.log(`  - ${id}`);
        }
      } catch (error) {
        console.error(chalk.red('Failed to create workflow:'), error);
        process.exit(1);
      }
    });

  // Get workflow status
  command
    .command('status')
    .description('Get workflow status')
    .requiredOption('-s, --swarm <id>', 'Swarm ID')
    .requiredOption('-t, --tasks <ids>', 'Comma-separated task IDs')
    .action((options) => {
      const orch = getOrchestrator();
      const taskIds = options.tasks.split(',');
      const status = orch.getWorkflowStatus(options.swarm, taskIds);

      console.log(chalk.bold('\nWorkflow Status:'));
      console.log(`  Total: ${status.total}`);
      console.log(`  Completed: ${chalk.green(status.completed)}`);
      console.log(`  In Progress: ${chalk.yellow(status.inProgress)}`);
      console.log(`  Pending: ${status.pending}`);
      console.log(`  Failed: ${chalk.red(status.failed)}`);
      console.log(`  Progress: ${(status.progress * 100).toFixed(1)}%`);
    });

  return command;
}

/**
 * Stats commands
 */
function createStatsCommands(): Command {
  const command = new Command('stats')
    .description('Show statistics');

  // Overall stats
  command
    .command('overview')
    .description('Show overall orchestration stats')
    .action(() => {
      const orch = getOrchestrator();
      const stats = orch.getStats();

      console.log(chalk.bold('\nOrchestration Overview:'));
      console.log(`  Swarms: ${stats.swarmCount}`);
      console.log(`  Total Agents: ${stats.totalAgents}`);
      console.log(`  Total Tasks: ${stats.totalTasks}`);
      console.log(`  Active Tasks: ${chalk.yellow(stats.activeTasks)}`);
      console.log(`  Completed Tasks: ${chalk.green(stats.completedTasks)}`);
      console.log(`  Failed Tasks: ${chalk.red(stats.failedTasks)}`);
    });

  // Event history
  command
    .command('events')
    .description('Show event history')
    .option('-t, --type <type>', 'Filter by event type')
    .option('-l, --limit <n>', 'Limit results', '50')
    .action((options) => {
      const orch = getOrchestrator();
      const events = orch.getEventHistory({
        type: options.type,
        limit: parseInt(options.limit, 10),
      });

      if (events.length === 0) {
        console.log(chalk.yellow('No events found'));
        return;
      }

      console.log(chalk.bold(`\nEvents (${events.length}):`));
      for (const event of events) {
        console.log(`  [${event.timestamp.toISOString()}] ${event.type}`);
      }
    });

  return command;
}

// Export for use in main CLI
export { getOrchestrator };
export default createOrchestrateCommand;
