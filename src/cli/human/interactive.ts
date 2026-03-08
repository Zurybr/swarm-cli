import { Logger } from '../../utils/logger';
import inquirer from 'inquirer';
import { orchestrator } from '../../backend/orchestrator-instance';
import { AGENCY_AGENTS } from '../../agents/definitions/agency-agents';

const logger = new Logger('Interactive');

export async function interactiveMode(): Promise<void> {
  console.log('\n🐝 Swarm CLI - Modo Interactivo\n');
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '¿Qué quieres hacer?',
      choices: [
        { name: '🚀 Crear nuevo run', value: 'create-run' },
        { name: '📋 Listar runs', value: 'list-runs' },
        { name: '🤖 Spawn agente', value: 'spawn-agent' },
        { name: '🎭 Ver agentes disponibles', value: 'list-agents' },
        { name: '⚙️  Configurar Ralph', value: 'config-ralph' },
        { name: '❌ Salir', value: 'exit' }
      ]
    }
  ]);
  
  switch (action) {
    case 'create-run':
      await createRunInteractive();
      break;
    case 'list-runs':
      await listRunsInteractive();
      break;
    case 'spawn-agent':
      await spawnAgentInteractive();
      break;
    case 'list-agents':
      listAgentsInteractive();
      break;
    case 'config-ralph':
      await configRalphInteractive();
      break;
    case 'exit':
      console.log('👋 Hasta luego!');
      process.exit(0);
  }
  
  // Loop back to menu
  await interactiveMode();
}

async function createRunInteractive(): Promise<void> {
  const { spec } = await inquirer.prompt([
    {
      type: 'input',
      name: 'spec',
      message: 'Descripción del run:',
      default: 'Implementar feature X'
    }
  ]);
  
  const run = await orchestrator.createRun(spec);
  console.log(`\n✅ Run creado: ${run.id}`);
  console.log(`   Estatus: ${run.status}`);
}

async function listRunsInteractive(): Promise<void> {
  const runs = orchestrator.getAllRuns();
  
  if (runs.length === 0) {
    console.log('\n📭 No hay runs activos');
    return;
  }
  
  console.log('\n📋 Runs:\n');
  runs.forEach(run => {
    console.log(`  ${run.id} - ${run.status}`);
    console.log(`    Agents: ${run.agents.length}, Tasks: ${run.tasks.length}`);
    console.log();
  });
}

async function spawnAgentInteractive(): Promise<void> {
  const runs = orchestrator.getAllRuns();
  
  if (runs.length === 0) {
    console.log('\n⚠️  Primero crea un run');
    return;
  }
  
  const { runId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'runId',
      message: 'Selecciona el run:',
      choices: runs.map(r => ({ name: r.id, value: r.id }))
    }
  ]);
  
  const agentChoices = Object.entries(AGENCY_AGENTS).map(([id, agent]) => ({
    name: `${agent.name} (${agent.division})`,
    value: id
  }));
  
  const { agentId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'agentId',
      message: 'Selecciona el agente:',
      choices: agentChoices
    }
  ]);
  
  const { model, apiUrl } = await inquirer.prompt([
    {
      type: 'input',
      name: 'model',
      message: 'Modelo LLM:',
      default: 'gpt-4'
    },
    {
      type: 'input',
      name: 'apiUrl',
      message: 'API URL:',
      default: 'https://api.openai.com/v1'
    }
  ]);
  
  const agent = await orchestrator.spawnAgent(runId, agentId, { model, apiUrl });
  
  if (agent) {
    console.log(`\n✅ Agente spawnado: ${agent.getId()}`);
    console.log(`   Rol: ${agent.getRole()}`);
  } else {
    console.log('\n❌ Error al spawnar agente');
  }
}

function listAgentsInteractive(): void {
  console.log('\n🎭 Agentes disponibles:\n');
  
  Object.entries(AGENCY_AGENTS).forEach(([id, agent]) => {
    console.log(`  ${id}`);
    console.log(`    ${agent.name} - ${agent.division}`);
    console.log(`    ${agent.description}`);
    console.log();
  });
}

async function configRalphInteractive(): Promise<void> {
  const config = orchestrator.getConfig();
  
  const { enabled, maxIterations } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enabled',
      message: '¿Habilitar Ralph loop?',
      default: config.ralphLoopEnabled
    },
    {
      type: 'number',
      name: 'maxIterations',
      message: 'Máximo de iteraciones:',
      default: config.ralphMaxIterations
    }
  ]);
  
  orchestrator.updateConfig({
    ralphLoopEnabled: enabled,
    ralphMaxIterations: maxIterations
  });
  
  console.log('\n✅ Configuración actualizada');
  console.log(`   Ralph loop: ${enabled ? 'ON' : 'OFF'}`);
  console.log(`   Max iterations: ${maxIterations}`);
}
