#!/usr/bin/env node

import { Command } from 'commander';
import { interactiveMode } from './human/interactive';
import { structuredMode } from './ai/structured';
import { createAPIServer } from '../backend/api/server';
import { orchestrator } from '../backend/orchestrator-instance';
import { AGENCY_AGENTS, getAllAgentIds } from '../agents/definitions/agency-agents';
import { Logger } from '../utils/logger';
import { createPlanCommand } from '../plan/cli';
import { registerSkillCommands } from './commands/skill-commands';
import { registerAgentCommands } from './commands/agent-commands';
import { SkillRegistry } from '../skills';
import { createAgentsCommand } from '../agents/cli';
import { registerVerificationCommands } from '../verification/cli';
import { createStateCommand } from '../state/cli';
import { createWaveCommand } from '../wave/cli';
import { createContextCommand } from '../context/cli';
import { createGSDCommand } from '../gsd/cli';
import { createHivemindCommand } from '../hive/cli';
import { registerExpertCommands } from '../skills/expert-definitions/cli';
import { createMCPCommand } from './commands/mcp';
import { createModelCommand } from './commands/model';
import { createCostsCommand } from '../providers';
import { launchTUI } from '../tui';
import { createKanbanCommands } from '../kanban/cli';
import { createTasksCommand } from './commands/tasks';
import sqlite3 from 'sqlite3';

import { createConnectCommand, createDisconnectCommand, createLocalCommand, createServerStatusCommand } from './commands/connect';
import { createPlanCommandRemote } from './commands/plan';
import { createExecuteCommand } from './commands/run';
import { createStatusCommand } from './commands/status';
import { initializeClientContext, getMode } from './client-context';

const logger = new Logger('CLI');
const program = new Command();

// Initialize skill registry
let skillRegistry: SkillRegistry | null = null;

async function initializeSkillRegistry(): Promise<SkillRegistry> {
  if (!skillRegistry) {
    // Use a default database path or get from environment/config
    const dbPath = process.env.SWARM_DB_PATH || './swarm.db';
    const db = new sqlite3.Database(dbPath);
    skillRegistry = new SkillRegistry(db);
    await skillRegistry.initialize();

    // Close database on process exit
    process.on('exit', () => {
      db.close((err) => {
        if (err) logger.error('Error closing database', err);
      });
    });

    process.on('SIGINT', () => {
      db.close((err) => {
        if (err) logger.error('Error closing database', err);
        process.exit(0);
      });
    });
  }
  return skillRegistry;
}

program
  .name('swarm-cli')
  .description('Orquestación de agentes - Specs a proyectos funcionales')
  .version('0.1.0')
  .option('--local', 'Force local mode (ignore server config)')
  .option('--retry-attempts <n>', 'Número máximo de reintentos', '3')
  .option('--retry-delay <ms>', 'Delay inicial entre reintentos (ms)', '1000')
  .option('--retry-max-delay <ms>', 'Delay máximo entre reintentos (ms)', '30000')
  .option('--retry-multiplier <n>', 'Multiplicador de backoff', '2')
  .option('--streaming-on', 'Enable streaming output for LLM responses', false)
  .option('--dynamic-temperature-enabled', 'Enable dynamic temperature adjustment', false)
  .option('--temperature-profile <profile>', 'Temperature profile: coding|balanced|creative|research', 'balanced')
  .option('--temperature <n>', 'Override temperature (0.0-2.0)');

// Interactive mode (default for humans)
program
  .command('interactive')
  .alias('i')
  .description('Modo interactivo para humanos')
  .action(async () => {
    await interactiveMode();
  });

// AI mode (structured)
program
  .command('ai')
  .description('Modo estructurado para IAs')
  .option('-c, --config <file>', 'Archivo de configuración')
  .option('-s, --spec <file>', 'Archivo de especificaciones')
  .action(async (options) => {
    await structuredMode(options);
  });

// Server mode
program
  .command('server')
  .description('Iniciar servidor API')
  .option('-p, --port <port>', 'Puerto', '3000')
  .action((options) => {
    const port = parseInt(options.port, 10);
    createAPIServer(port);
  });

// TUI mode - Terminal User Interface
program
  .command('tui')
  .description('Launch Terminal User Interface')
  .option('-t, --title <title>', 'TUI title', 'Swarm CLI')
  .action((options) => {
    launchTUI({ title: options.title });
  });

// Init command
program
  .command('init')
  .description('Inicializar proyecto')
  .requiredOption('--github <repo>', 'Repositorio GitHub (owner/repo)')
  .option('--specs <file>', 'Archivo de especificaciones')
  .action(async (options) => {
    logger.info('Inicializando proyecto...', options);
    // TODO: Implement init
    console.log('Init command - TODO');
  });

// Run commands
program
  .command('run:create')
  .description('Crear nuevo run')
  .requiredOption('--spec <spec>', 'Especificación del run')
  .action(async (options) => {
    const run = await orchestrator.createRun(options.spec);
    console.log(`Created run: ${run.id}`);
  });

program
  .command('run:execute')
  .description('Ejecutar run')
  .requiredOption('--id <id>', 'ID del run')
  .action(async (options) => {
    await orchestrator.executeRun(options.id);
    console.log(`Executing run: ${options.id}`);
  });

program
  .command('run:list')
  .description('Listar runs')
  .action(() => {
    const runs = orchestrator.getAllRuns();
    console.table(runs.map((r: { id: string; status: string; agents: any[]; tasks: any[]; createdAt: Date }) => ({
      id: r.id,
      status: r.status,
      agents: r.agents.length,
      tasks: r.tasks.length,
      created: r.createdAt.toISOString()
    })));
  });

// Agent commands
program
  .command('agent:spawn')
  .description('Spawn agent para un run')
  .requiredOption('--run <id>', 'ID del run')
  .requiredOption('--agent <agent>', 'ID del agente de Agency')
  .requiredOption('--model <model>', 'Modelo LLM')
  .requiredOption('--api-url <url>', 'URL de la API')
  .option('--api-key <key>', 'API Key')
  .action(async (options) => {
    const agent = await orchestrator.spawnAgent(
      options.run,
      options.agent,
      {
        model: options.model,
        apiUrl: options.apiUrl,
        apiKey: options.apiKey
      }
    );
    
    if (agent) {
      console.log(`Spawned agent: ${agent.getId()} (${agent.getRole()})`);
    } else {
      console.error('Failed to spawn agent');
      process.exit(1);
    }
  });

program
  .command('agent:list')
  .description('Listar agentes disponibles')
  .action(() => {
    console.log('\n🎭 Agentes disponibles:\n');
    
    Object.entries(AGENCY_AGENTS).forEach(([id, agent]) => {
      console.log(`  ${id.padEnd(25)} - ${agent.name} (${agent.division})`);
      console.log(`    ${agent.description}`);
      console.log();
    });
  });

program
  .command('agent:stats')
  .description('Estadísticas de agentes')
  .action(() => {
    // TODO: Get from agentRegistry
    console.log('Agent stats - TODO');
  });

// Plan commands
program.addCommand(createPlanCommand());

// Agents commands
program.addCommand(createAgentsCommand());

// Verification commands
registerVerificationCommands(program);

// State commands
program.addCommand(createStateCommand());

// Wave execution commands
program.addCommand(createWaveCommand());

// Hivemind semantic memory commands
program.addCommand(createHivemindCommand());

// Context engineering commands
program.addCommand(createContextCommand());

// GSD project management commands
program.addCommand(createGSDCommand());

// MCP marketplace commands
program.addCommand(createMCPCommand());

// Model configuration commands - Issue #22.3
program.addCommand(createModelCommand());

// Kanban commands - Issue #13
program.addCommand(createKanbanCommands());

// Tasks commands - Issue #13
program.addCommand(createTasksCommand());

// Cost tracking commands - Issue #22.6
program.addCommand(createCostsCommand());

// Skill, agent, and expert commands - initialized asynchronously
(async () => {
  try {
    const registry = await initializeSkillRegistry();
    registerSkillCommands(program, registry);
    // Register agent commands after skill commands (dependency order)
    registerAgentCommands(program, registry);
    // Register expert commands
    registerExpertCommands(program);
  } catch (error) {
    logger.error('Failed to initialize skill registry', error);
    // Continue without skill commands - they won't be available
  }
})();

// Config commands
program
  .command('config:ralph')
  .description('Configurar Ralph loop')
  .option('--enable', 'Habilitar Ralph loop')
  .option('--disable', 'Deshabilitar Ralph loop')
  .option('--max-iterations <n>', 'Máximo de iteraciones')
  .action((options) => {
    const config = orchestrator.getConfig();

    if (options.enable) {
      orchestrator.updateConfig({ ralphLoopEnabled: true });
      console.log('✅ Ralph loop habilitado');
    }

    if (options.disable) {
      orchestrator.updateConfig({ ralphLoopEnabled: false });
      console.log('❌ Ralph loop deshabilitado');
    }

    if (options.maxIterations) {
      orchestrator.updateConfig({
        ralphMaxIterations: parseInt(options.maxIterations, 10)
      });
      console.log(`📊 Max iteraciones: ${options.maxIterations}`);
    }

    // Show current config
    const current = orchestrator.getConfig();
    console.log('\nConfiguración actual:');
    console.log(`  Ralph loop: ${current.ralphLoopEnabled ? 'ON' : 'OFF'}`);
    console.log(`  Max iterations: ${current.ralphMaxIterations}`);
    console.log(`  Max parallel agents: ${current.maxParallelAgents}`);
    console.log(`  Default retries: ${current.defaultRetries}`);
  });

// Status command - quick system overview
program
  .command('status')
  .description('Mostrar estado del sistema')
  .action(async () => {
    const { execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    
    console.log('\n❤️‍🔥 **Swarm CLI Status**\n');
    
    // API Status
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      await fetch('http://localhost:3000/health', { signal: controller.signal });
      clearTimeout(timeout);
      console.log('🟢 API: Online');
    } catch {
      console.log('🔴 API: Offline (run `swarm-cli server` to start)');
    }
    
    // Git status
    try {
      const gitStatus = execSync('git status --short', { cwd: process.cwd(), encoding: 'utf8' });
      const gitLog = execSync('git log --oneline -1', { cwd: process.cwd(), encoding: 'utf8' }).trim();
      if (gitStatus.trim()) {
        console.log('🟡 Git: Cambios sin commitear');
      } else {
        console.log('🟢 Git: Limpio');
      }
      console.log(`   Último commit: ${gitLog}`);
    } catch {
      console.log('⚪ Git: No disponible');
    }
    
    // Issues count
    try {
      const hivePath = path.join(process.cwd(), '.hive', 'issues.jsonl');
      if (fs.existsSync(hivePath)) {
        const content = fs.readFileSync(hivePath, 'utf8');
        const count = content.trim().split('\n').filter((l: string) => l.trim()).length;
        console.log(`📋 Issues: ${count} registrados`);
      } else {
        console.log('📋 Issues: 0 (no .hive/issues.jsonl)');
      }
    } catch {
      console.log('⚪ Issues: No disponible');
    }
    
    // Storage
    try {
      const df = execSync('df -h . | tail -1', { cwd: process.cwd(), encoding: 'utf8' }).trim();
      const parts = df.split(/\s+/);
      const usage = parts[4];
      const avail = parts[3];
      console.log(`💾 Storage: ${usage} usado, ${avail} disponible`);
    } catch {
      console.log('⚪ Storage: No disponible');
    }
    
    // Runs - Skip if API is offline to avoid hanging
    let apiOnline = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 500);
      await fetch('http://localhost:3000/health', { signal: controller.signal });
      clearTimeout(timeout);
      apiOnline = true;
    } catch {
      // API offline
    }
    
    if (apiOnline) {
      try {
        const runs = orchestrator.getAllRuns();
        const running = runs.filter((r: { status: string }) => r.status === 'executing').length;
        const failed = runs.filter((r: { status: string }) => r.status === 'failed').length;
        console.log(`🚀 Runs: ${runs.length} total (${running} ejecutando, ${failed} failed)`);
      } catch {
        console.log('⚪ Runs: No disponible');
      }
    } else {
      console.log('⚪ Runs: (API offline - iniciar server para ver runs)');
    }
    
    console.log('\n💡 Comandos útiles:');
    console.log('   swarm-cli server          - Iniciar API');
    console.log('   swarm-cli run:list        - Listar runs');
    console.log('   swarm-cli agent:list      - Listar agentes');
    console.log('');
  });

// Client commands - Server connection management
program.addCommand(createConnectCommand());
program.addCommand(createDisconnectCommand());
program.addCommand(createLocalCommand());
program.addCommand(createServerStatusCommand());
program.addCommand(createStatusCommand());

// Remote plan commands (overrides local plan for remote mode)
program.addCommand(createPlanCommandRemote());

// Execute commands (run plans locally or remotely)
program.addCommand(createExecuteCommand());

// Default to interactive mode
if (process.argv.length === 2) {
  const opts = program.opts();
  if (opts.local) {
    initializeClientContext(true);
    interactiveMode();
  } else {
    initializeClientContext();
    interactiveMode();
  }
} else {
  const opts = program.opts();
  if (opts.local) {
    initializeClientContext(true);
  } else {
    initializeClientContext();
  }
  program.parse();
}
