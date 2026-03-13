#!/usr/bin/env node

/**
 * CLI commands for the Specialized Agent System
 * Provides 'swarm agents' subcommands for managing agents
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  AgentSystem,
  getAgentSystem,
  AgentType,
  ALL_AGENT_TYPES,
  TaskAssignment,
} from './index';
import { getAgentName, getAgentDescription, getSuitableTaskTypes } from './definitions';
import { getMetaPrompt } from './metaprompts';

import { createFormatter, getOutputType, OutputFormatter } from '../utils/output-formatter';

/**
 * Create the agents command group
 */
export function createAgentsCommand(): Command {
  const command = new Command('agents')
    .description('Manage specialized agents and routing');

  // List agent types
  command
    .command('types')
    .alias('list')
    .description('List all available agent types')
    .option('-j, --json', 'Output as JSON (legacy, use --output-type)')
    .option('-o, --output-type <type>', 'Output format: str or json', 'str')
    .action(async (options) => {
      const outputType = getOutputType(options);
      const fmt = createFormatter(outputType);
      
      const system = getAgentSystem();
      const types = system.listAgentTypes();

      if (outputType === 'json') {
        fmt.print(types);
        return;
      }

      console.log(chalk.bold('\n🤖 Available Agent Types\n'));

      for (const agentType of types) {
        console.log(chalk.cyan(`${agentType.name} (${agentType.type})`));
        console.log(`  ${agentType.description}`);
        if (agentType.capabilities.length > 0) {
          console.log(`  Capabilities: ${agentType.capabilities.join(', ')}`);
        }
        console.log();
      }
    });

  // Show agent type details
  command
    .command('describe <type>')
    .alias('view')
    .description('Show detailed information about an agent type')
    .option('-j, --json', 'Output as JSON (legacy, use --output-type)')
    .option('-o, --output-type <type>', 'Output format: str or json', 'str')
    .action(async (type: string, options) => {
      if (!ALL_AGENT_TYPES.includes(type as AgentType)) {
        console.error(chalk.red(`Unknown agent type: ${type}`));
        console.log(`Available types: ${ALL_AGENT_TYPES.join(', ')}`);
        process.exit(1);
      }

      const agentType = type as AgentType;
      const metaPrompt = getMetaPrompt(agentType);
      const system = getAgentSystem();
      const summary = system.getPermissionSummary(agentType);

      const details = {
        type: agentType,
        name: getAgentName(agentType),
        description: getAgentDescription(agentType),
        suitableTasks: getSuitableTaskTypes(agentType),
        systemPrompt: metaPrompt.systemPrompt,
        defaultTools: metaPrompt.defaultTools,
        responseFormat: metaPrompt.responseFormat,
        permissions: summary,
      };

      if (getOutputType(options) === 'json') {
        console.log(JSON.stringify(details, null, 2));
        return;
      }

      console.log(chalk.bold(`\n🤖 ${details.name}\n`));
      console.log(chalk.gray(details.description));
      console.log();

      console.log(chalk.bold('Suitable Tasks:'));
      for (const task of details.suitableTasks) {
        console.log(`  • ${task}`);
      }
      console.log();

      console.log(chalk.bold('Default Tools:'));
      for (const tool of details.defaultTools) {
        console.log(`  • ${tool}`);
      }
      console.log();

      console.log(chalk.bold('Capabilities:'));
      console.log(`  • Can modify code: ${summary.canModifyCode ? 'Yes' : 'No'}`);
      console.log(`  • Can execute shell: ${summary.canExecuteShell ? 'Yes' : 'No'}`);
      console.log(`  • Can access external: ${summary.canAccessExternal ? 'Yes' : 'No'}`);
      console.log(`  • Can spawn agents: ${summary.canSpawnAgents ? 'Yes' : 'No'}`);
      console.log();

      console.log(chalk.bold('Response Format:'));
      console.log(details.responseFormat);
      console.log();
    });

  // Create an agent instance
  command
    .command('create <type>')
    .alias('spawn')
    .description('Create a new agent instance')
    .option('-n, --name <name>', 'Custom name for the agent')
    .option('-c, --config <path>', 'Load agent from YAML config file')
    .option('-j, --json', 'Output as JSON (legacy, use --output-type)')
    .option('-o, --output-type <type>', 'Output format: str or json', 'str')
    .action(async (type: string, options) => {
      // If config is provided, load from YAML
      if (options.config) {
        const { loadAgentConfig } = await import('./yaml-config');
        try {
          const config = loadAgentConfig(options.config);
          console.log(chalk.green(`✅ Loaded agent config: ${config.name}`));
          console.log(chalk.gray(`  Description: ${config.description}`));
          console.log(chalk.gray(`  Division: ${config.division}`));
          if (getOutputType(options) === 'json') {
            console.log(JSON.stringify(config, null, 2));
          }
          return;
        } catch (error) {
          console.error(chalk.red(`Failed to load config: ${error}`));
          process.exit(1);
        }
      }

      if (!ALL_AGENT_TYPES.includes(type as AgentType)) {
        console.error(chalk.red(`Unknown agent type: ${type}`));
        console.log(`Available types: ${ALL_AGENT_TYPES.join(', ')}`);
        process.exit(1);
      }

      const system = getAgentSystem();
      const agent = system.createAgent(type as AgentType, {
        name: options.name,
      });

      if (getOutputType(options) === 'json') {
        console.log(JSON.stringify(agent, null, 2));
        return;
      }

      console.log(chalk.green(`✅ Created ${type} agent: ${agent.id}`));
    });

  // List agent instances
  command
    .command('list')
    .description('List all agent instances')
    .option('-t, --type <type>', 'Filter by agent type')
    .option('-s, --status <status>', 'Filter by status (idle, busy, paused, error)')
    .option('-j, --json', 'Output as JSON (legacy, use --output-type)')
    .option('-o, --output-type <type>', 'Output format: str or json', 'str')
    .action(async (options) => {
      const system = getAgentSystem();
      let agents = system.getAllAgents();

      if (options.type) {
        agents = agents.filter((a) => a.type === options.type);
      }

      if (options.status) {
        agents = agents.filter((a) => a.status === options.status);
      }

      if (getOutputType(options) === 'json') {
        console.log(JSON.stringify(agents, null, 2));
        return;
      }

      if (agents.length === 0) {
        console.log(chalk.yellow('No agent instances found.'));
        return;
      }

      console.log(chalk.bold(`\n🤖 Agent Instances (${agents.length})\n`));

      for (const agent of agents) {
        const statusColor =
          agent.status === 'idle'
            ? chalk.green
            : agent.status === 'busy'
            ? chalk.yellow
            : agent.status === 'paused'
            ? chalk.blue
            : chalk.red;

        console.log(`${chalk.cyan(agent.id)} ${statusColor(`[${agent.status}]`)}`);
        console.log(`  Type: ${getAgentName(agent.type)}`);
        console.log(`  Created: ${agent.createdAt.toISOString()}`);
        if (agent.currentTask) {
          console.log(`  Current Task: ${agent.currentTask.taskId}`);
        }
        console.log();
      }
    });

  // Show agent instance details
  command
    .command('show <id>')
    .description('Show details of a specific agent instance')
    .option('-j, --json', 'Output as JSON (legacy, use --output-type)')
    .option('-o, --output-type <type>', 'Output format: str or json', 'str')
    .action(async (id: string, options) => {
      const system = getAgentSystem();
      const agent = system.getAgent(id);

      if (!agent) {
        console.error(chalk.red(`Agent not found: ${id}`));
        process.exit(1);
      }

      if (getOutputType(options) === 'json') {
        console.log(JSON.stringify(agent, null, 2));
        return;
      }

      console.log(chalk.bold(`\n🤖 Agent: ${agent.id}\n`));
      console.log(`Type: ${getAgentName(agent.type)}`);
      console.log(`Status: ${agent.status}`);
      console.log(`Created: ${agent.createdAt.toISOString()}`);
      console.log(`Last Activity: ${agent.lastActivityAt.toISOString()}`);
      console.log(`Task History: ${agent.taskHistory.length} tasks`);

      if (agent.currentTask) {
        console.log(chalk.bold('\nCurrent Task:'));
        console.log(`  ID: ${agent.currentTask.taskId}`);
        console.log(`  Type: ${agent.currentTask.taskType}`);
        console.log(`  Priority: ${agent.currentTask.priority}`);
        console.log(`  Complexity: ${agent.currentTask.complexity}`);
      }
    });

  // Destroy an agent instance
  command
    .command('destroy <id>')
    .description('Destroy an agent instance')
    .option('-f, --force', 'Force destroy even if busy')
    .action(async (id: string, options) => {
      const system = getAgentSystem();
      const agent = system.getAgent(id);

      if (!agent) {
        console.error(chalk.red(`Agent not found: ${id}`));
        process.exit(1);
      }

      if (agent.status === 'busy' && !options.force) {
        console.error(chalk.red(`Agent is busy. Use --force to destroy anyway.`));
        process.exit(1);
      }

      system.destroyAgent(id);
      console.log(chalk.green(`✅ Destroyed agent: ${id}`));
    });

  // Route a task
  command
    .command('route <description>')
    .description('Route a task and show which agent type would handle it')
    .option('-t, --type <type>', 'Task type')
    .option('-c, --complexity <level>', 'Complexity (simple, moderate, complex, very_complex)', 'moderate')
    .option('-p, --priority <level>', 'Priority (low, medium, high, critical)', 'medium')
    .option('-j, --json', 'Output as JSON (legacy, use --output-type)')
    .option('-o, --output-type <type>', 'Output format: str or json', 'str')
    .action(async (description: string, options) => {
      const system = getAgentSystem();

      const task: TaskAssignment = {
        taskId: `route-test-${Date.now()}`,
        description,
        taskType: options.type || 'general',
        requiredCapabilities: {},
        priority: options.priority,
        complexity: options.complexity,
      };

      const decision = system.routeTask(task);

      if (getOutputType(options) === 'json') {
        console.log(JSON.stringify(decision, null, 2));
        return;
      }

      console.log(chalk.bold('\n🎯 Routing Decision\n'));
      console.log(`Task: ${description}`);
      console.log(`Type: ${task.taskType}`);
      console.log(`Priority: ${task.priority}`);
      console.log(`Complexity: ${task.complexity}`);
      console.log();

      console.log(chalk.green(`Selected Agent: ${decision.agentType}`));
      console.log(`Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
      console.log();

      console.log(chalk.bold('Reasoning:'));
      console.log(decision.reasoning);
      console.log();

      console.log(chalk.bold('Model Configuration:'));
      console.log(`  Model: ${decision.modelConfig.model}`);
      console.log(`  Temperature: ${decision.modelConfig.temperature}`);
      console.log(`  Max Tokens: ${decision.modelConfig.maxTokens}`);
      console.log();

      if (decision.alternatives.length > 0) {
        console.log(chalk.bold('Alternatives:'));
        for (const alt of decision.alternatives) {
          console.log(`  • ${alt.agentType}: ${(alt.confidence * 100).toFixed(1)}%`);
        }
      }
    });

  // Check permissions
  command
    .command('permissions <id>')
    .description('Show permissions for an agent instance')
    .option('-j, --json', 'Output as JSON (legacy, use --output-type)')
    .option('-o, --output-type <type>', 'Output format: str or json', 'str')
    .action(async (id: string, options) => {
      const system = getAgentSystem();
      const agent = system.getAgent(id);

      if (!agent) {
        console.error(chalk.red(`Agent not found: ${id}`));
        process.exit(1);
      }

      const summary = system.getPermissionSummary(id);

      if (getOutputType(options) === 'json') {
        console.log(JSON.stringify(summary, null, 2));
        return;
      }

      console.log(chalk.bold(`\n🔐 Permissions for ${id}\n`));
      console.log(`Agent Type: ${summary.agentType}`);
      console.log(`Total Permissions: ${summary.totalPermissions}`);
      console.log();

      console.log(chalk.bold('Capabilities:'));
      for (const cap of summary.capabilities) {
        console.log(`  ✓ ${cap}`);
      }
      console.log();

      console.log(chalk.bold('Resource Access:'));
      for (const [resource, level] of Object.entries(summary.resources)) {
        const levelColor =
          level === 'admin'
            ? chalk.red
            : level === 'write'
            ? chalk.yellow
            : level === 'read'
            ? chalk.green
            : chalk.gray;
        console.log(`  ${resource}: ${levelColor(level)}`);
      }
    });

  // Check permission for specific resource
  command
    .command('can <id> <resource> <level>')
    .description('Check if an agent has permission for a resource')
    .action(async (id: string, resource: string, level: string) => {
      const system = getAgentSystem();
      const agent = system.getAgent(id);

      if (!agent) {
        console.error(chalk.red(`Agent not found: ${id}`));
        process.exit(1);
      }

      const result = system.checkPermission(
        id,
        resource,
        level as 'none' | 'read' | 'write' | 'admin'
      );

      if (result.granted) {
        console.log(chalk.green(`✅ Granted`));
        console.log(`Agent ${id} has ${level} permission for ${resource}`);
      } else {
        console.log(chalk.red(`❌ Denied`));
        console.log(result.reason);
      }
    });

  // System stats
  command
    .command('stats')
    .description('Show agent system statistics')
    .option('-j, --json', 'Output as JSON (legacy, use --output-type)')
    .option('-o, --output-type <type>', 'Output format: str or json', 'str')
    .action(async (options) => {
      const system = getAgentSystem();
      const stats = system.getStats();

      if (getOutputType(options) === 'json') {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      console.log(chalk.bold('\n📊 Agent System Statistics\n'));

      console.log(chalk.bold('Agents:'));
      console.log(`  Total: ${stats.totalAgents}`);
      console.log();

      console.log(chalk.bold('By Type:'));
      for (const [type, count] of Object.entries(stats.byType)) {
        if (count > 0) {
          console.log(`  ${type}: ${count}`);
        }
      }
      console.log();

      console.log(chalk.bold('By Status:'));
      for (const [status, count] of Object.entries(stats.byStatus)) {
        if (count > 0) {
          const statusColor =
            status === 'idle'
              ? chalk.green
              : status === 'busy'
              ? chalk.yellow
              : status === 'paused'
              ? chalk.blue
              : chalk.red;
          console.log(`  ${status}: ${statusColor(count.toString())}`);
        }
      }
      console.log();

      console.log(chalk.bold('Tasks:'));
      console.log(`  Total: ${stats.totalTasks}`);
      console.log(`  Successful: ${chalk.green(stats.successfulTasks)}`);
      console.log(`  Failed: ${chalk.red(stats.failedTasks)}`);
    });

  // Pause an agent
  command
    .command('pause <id>')
    .description('Pause an agent')
    .action(async (id: string) => {
      const system = getAgentSystem();
      const success = system.pauseAgent(id);

      if (success) {
        console.log(chalk.green(`✅ Paused agent: ${id}`));
      } else {
        console.error(chalk.red(`Failed to pause agent: ${id}`));
        process.exit(1);
      }
    });

  // Resume an agent
  command
    .command('resume <id>')
    .description('Resume a paused agent')
    .action(async (id: string) => {
      const system = getAgentSystem();
      const success = system.resumeAgent(id);

      if (success) {
        console.log(chalk.green(`✅ Resumed agent: ${id}`));
      } else {
        console.error(chalk.red(`Failed to resume agent: ${id}`));
        process.exit(1);
      }
    });

  // Clear all agents
  command
    .command('clear')
    .description('Destroy all agent instances')
    .option('-f, --force', 'Skip confirmation')
    .action(async (options) => {
      if (!options.force) {
        console.log(chalk.yellow('This will destroy all agent instances.'));
        console.log('Use --force to confirm.');
        process.exit(1);
      }

      const system = getAgentSystem();
      system.clearAllAgents();
      console.log(chalk.green('✅ All agent instances cleared'));
    });

  // Compare two agent types
  command
    .command('compare <type1> <type2>')
    .description('Compare two agent types')
    .option('-j, --json', 'Output as JSON (legacy, use --output-type)')
    .option('-o, --output-type <type>', 'Output format: str or json', 'str')
    .action(async (type1: string, type2: string, options) => {
      if (!ALL_AGENT_TYPES.includes(type1 as AgentType)) {
        console.error(chalk.red(`Unknown agent type: ${type1}`));
        process.exit(1);
      }
      if (!ALL_AGENT_TYPES.includes(type2 as AgentType)) {
        console.error(chalk.red(`Unknown agent type: ${type2}`));
        process.exit(1);
      }

      const { compareCapabilities } = await import('./definitions');
      const { comparePermissions } = await import('./permissions');
      const { getDefaultCapabilities } = await import('./definitions');

      const caps1 = getDefaultCapabilities(type1 as AgentType);
      const caps2 = getDefaultCapabilities(type2 as AgentType);

      const comparison = {
        type1: {
          name: getAgentName(type1 as AgentType),
          capabilities: caps1,
        },
        type2: {
          name: getAgentName(type2 as AgentType),
          capabilities: caps2,
        },
      };

      if (getOutputType(options) === 'json') {
        console.log(JSON.stringify(comparison, null, 2));
        return;
      }

      console.log(chalk.bold(`\n🔍 Comparing ${comparison.type1.name} vs ${comparison.type2.name}\n`));

      console.log(chalk.bold('Capabilities:'));
      console.log(`  Can spawn agents: ${caps1.canSpawnAgents} vs ${caps2.canSpawnAgents}`);
      console.log(`  Can modify code: ${caps1.canModifyCode} vs ${caps2.canModifyCode}`);
      console.log(`  Can access external: ${caps1.canAccessExternal} vs ${caps2.canAccessExternal}`);
      console.log(`  Can execute shell: ${caps1.canExecuteShell} vs ${caps2.canExecuteShell}`);
      console.log(`  Max parallel tasks: ${caps1.maxParallelTasks} vs ${caps2.maxParallelTasks}`);
      console.log(`  Preferred model: ${caps1.preferredModel} vs ${caps2.preferredModel}`);
      console.log(`  Task timeout: ${caps1.taskTimeoutMinutes}min vs ${caps2.taskTimeoutMinutes}min`);
    });

  return command;
}

// Export for use in main CLI
export default createAgentsCommand;
