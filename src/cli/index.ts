#!/usr/bin/env node

import { Command } from 'commander';
import { interactiveMode } from './human/interactive';
import { structuredMode } from './ai/structured';
import { createAPIServer } from '../backend/api/server';
import { orchestrator } from '../backend/orchestrator-instance';
import { AGENCY_AGENTS, getAllAgentIds } from '../agents/definitions/agency-agents';
import { Logger } from '../utils/logger';

const logger = new Logger('CLI');
const program = new Command();

program
  .name('swarm-cli')
  .description('Orquestación de agentes - Specs a proyectos funcionales')
  .version('0.1.0');

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
    console.table(runs.map(r => ({
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

// Default to interactive mode
if (process.argv.length === 2) {
  interactiveMode();
} else {
  program.parse();
}
