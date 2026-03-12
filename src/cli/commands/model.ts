/**
 * Model CLI Commands - Issue #22.3
 * CLI commands for per-agent model configuration
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { 
  AgentModelConfig, 
  AgentType, 
  createAgentModelConfig,
  ModelValidationError 
} from '../../providers/agent-model-config';
import { ProviderManager } from '../../providers/provider-manager';

/**
 * Create model command group
 */
export function createModelCommand(): Command {
  const cmd = new Command('model')
    .description('Manage per-agent model configuration');

  // List command
  cmd.command('list')
    .description('List current agent model configuration')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await getAgentModelConfig();
        
        if (options.json) {
          console.log(config.toJSON());
        } else {
          displayConfigTable(config);
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // Get command
  cmd.command('get <agent>')
    .description('Get model configuration for a specific agent')
    .option('--json', 'Output as JSON')
    .action(async (agent, options) => {
      try {
        const config = await getAgentModelConfig();
        
        if (!isValidAgentType(agent)) {
          console.error(chalk.red(`Invalid agent type: ${agent}`));
          console.log(chalk.gray(`Valid types: build, plan, researcher, triage`));
          process.exit(1);
        }

        const mapping = config.getModelForAgent(agent as AgentType);
        
        if (options.json) {
          console.log(JSON.stringify(mapping, null, 2));
        } else {
          console.log(chalk.bold(`\n📋 Model configuration for ${chalk.cyan(agent)}:\n`));
          console.log(`  Provider: ${chalk.green(mapping.provider)}`);
          console.log(`  Model:    ${chalk.green(mapping.model)}`);
          if (mapping.temperature !== undefined) {
            console.log(`  Temperature: ${mapping.temperature}`);
          }
          if (mapping.maxTokens !== undefined) {
            console.log(`  Max Tokens: ${mapping.maxTokens}`);
          }
          console.log('');
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // Set command
  cmd.command('set <agent> <model>')
    .description('Set model for a specific agent (format: provider:model or just model)')
    .option('--temperature <n>', 'Temperature setting (0.0-2.0)', parseFloat)
    .option('--max-tokens <n>', 'Maximum tokens', parseInt)
    .option('--no-validate', 'Skip model validation')
    .action(async (agent, model, options) => {
      try {
        const config = await getAgentModelConfig();
        
        if (agent !== 'all' && !isValidAgentType(agent)) {
          console.error(chalk.red(`Invalid agent type: ${agent}`));
          console.log(chalk.gray(`Valid types: build, plan, researcher, triage, or 'all'`));
          process.exit(1);
        }

        const { provider, model: modelId } = config.parseCliFlag(model);
        
        const mapping = { 
          provider, 
          model: modelId,
          temperature: options.temperature,
          maxTokens: options.maxTokens
        };

        if (agent === 'all') {
          await config.applyCliOverride('all', model, { 
            validate: options.validate !== false 
          });
          console.log(chalk.green(`\n✅ Set model for all agents to ${chalk.cyan(provider)}:${chalk.cyan(modelId)}`));
        } else {
          await config.setModelForAgent(agent as AgentType, mapping, { 
            validate: options.validate !== false 
          });
          console.log(chalk.green(`\n✅ Set model for ${chalk.cyan(agent)} to ${chalk.cyan(provider)}:${chalk.cyan(modelId)}`));
        }

        // Show updated config
        displayConfigTable(config);
        
        // Remind about persistence
        console.log(chalk.gray('\n💡 Note: Changes are in-memory. Use --config-file to persist.'));

      } catch (error) {
        if (error instanceof ModelValidationError) {
          console.error(chalk.red(`\n❌ Validation error: ${error.message}`));
          console.log(chalk.yellow('\nAvailable models:'));
          error.availableModels.forEach(m => console.log(chalk.gray(`  - ${m}`)));
        } else {
          console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        }
        process.exit(1);
      }
    });

  // Available command
  cmd.command('available')
    .description('List all available models')
    .option('--provider <name>', 'Filter by provider')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const config = await getAgentModelConfig();
        let models = config.listAvailableModels();
        
        if (options.provider) {
          models = models.filter(m => m.provider === options.provider);
        }

        if (options.json) {
          console.log(JSON.stringify(models, null, 2));
        } else {
          if (models.length === 0) {
            console.log(chalk.yellow('\nNo models available'));
            console.log(chalk.gray('\nMake sure providers are configured with API keys.'));
            return;
          }

          console.log(chalk.bold(`\n📋 Available Models (${models.length}):\n`));
          
          // Group by provider
          const byProvider = groupBy(models, 'provider');
          
          for (const [provider, providerModels] of Object.entries(byProvider)) {
            console.log(chalk.cyan.bold(`${provider}:`));
            (providerModels as any[]).forEach((model: any) => {
              const tools = model.supportsTools ? '🔧' : '';
              const vision = model.supportsVision ? '👁️' : '';
              const caps = `${tools}${vision}`.padEnd(2);
              console.log(`  ${caps} ${model.id.padEnd(25)} $${model.costPer1KInput.toFixed(5)}/1K in`);
            });
            console.log('');
          }
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // Recommend command
  cmd.command('recommend <agent>')
    .description('Get recommended model for an agent type')
    .action(async (agent) => {
      try {
        if (!isValidAgentType(agent)) {
          console.error(chalk.red(`Invalid agent type: ${agent}`));
          console.log(chalk.gray(`Valid types: build, plan, researcher, triage`));
          process.exit(1);
        }

        const config = await getAgentModelConfig();
        const recommended = config.getRecommendedModel(agent as AgentType);
        
        if (recommended) {
          console.log(chalk.bold(`\n💡 Recommended model for ${chalk.cyan(agent)}:\n`));
          console.log(`  Provider: ${chalk.green(recommended.provider)}`);
          console.log(`  Model:    ${chalk.green(recommended.id)}`);
          console.log(`  Tools:    ${recommended.supportsTools ? '✅' : '❌'}`);
          console.log(`  Vision:   ${recommended.supportsVision ? '✅' : '❌'}`);
          console.log(`  Cost:     $${recommended.costPer1KInput.toFixed(5)}/1K input`);
          console.log('');
        } else {
          console.log(chalk.yellow(`No recommendation available for ${agent}`));
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // Reset command
  cmd.command('reset')
    .description('Reset to default model configuration')
    .action(async () => {
      try {
        const config = await getAgentModelConfig();
        config.reset();
        
        console.log(chalk.green('\n✅ Reset to default configuration\n'));
        displayConfigTable(config);
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // Validate command
  cmd.command('validate')
    .description('Validate current model configuration')
    .action(async () => {
      try {
        const config = await getAgentModelConfig();
        const agentTypes: AgentType[] = ['build', 'plan', 'researcher', 'triage'];
        
        console.log(chalk.bold('\n🔍 Validating model configuration...\n'));
        
        let allValid = true;
        
        for (const agent of agentTypes) {
          const mapping = config.getModelForAgent(agent);
          const isValid = await config.validateModel(mapping.provider, mapping.model);
          
          if (isValid) {
            console.log(chalk.green(`  ✅ ${agent}: ${mapping.provider}:${mapping.model}`));
          } else {
            console.log(chalk.red(`  ❌ ${agent}: ${mapping.provider}:${mapping.model} (not available)`));
            allValid = false;
          }
        }
        
        console.log('');
        
        if (allValid) {
          console.log(chalk.green.bold('✅ All models are valid and available'));
        } else {
          console.log(chalk.yellow.bold('⚠️  Some models are not available. Use "model available" to see options.'));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  return cmd;
}

/**
 * Global --model flag handler
 * Use this when the --model flag is passed at the command level
 */
export async function handleModelFlag(
  modelFlag: string, 
  agentType: AgentType | 'all' = 'all'
): Promise<AgentModelConfig> {
  const config = await getAgentModelConfig();
  
  try {
    await config.applyCliOverride(agentType, modelFlag);
    console.log(chalk.gray(`Model override applied: ${modelFlag} for ${agentType}`));
  } catch (error) {
    if (error instanceof ModelValidationError) {
      console.error(chalk.yellow(`Warning: Model validation failed, using override anyway: ${error.message}`));
      await config.applyCliOverride(agentType, modelFlag, { validate: false });
    } else {
      throw error;
    }
  }
  
  return config;
}

/**
 * Get or create the global AgentModelConfig instance
 */
let globalConfig: AgentModelConfig | null = null;

export async function getAgentModelConfig(): Promise<AgentModelConfig> {
  if (!globalConfig) {
    const providerManager = new ProviderManager();
    await providerManager.autoRegisterProviders();
    globalConfig = createAgentModelConfig(providerManager);
  }
  return globalConfig;
}

/**
 * Reset the global config (useful for testing)
 */
export function resetAgentModelConfig(): void {
  globalConfig = null;
}

/**
 * Display configuration as a table
 */
function displayConfigTable(config: AgentModelConfig): void {
  const agentTypes: AgentType[] = ['build', 'plan', 'researcher', 'triage'];
  
  console.log(chalk.bold('\n📋 Agent Model Configuration:\n'));
  
  // Header
  console.log(chalk.gray('┌─────────────┬────────────┬─────────────────────┬───────┬────────────┐'));
  console.log(chalk.gray('│') + chalk.bold(' Agent       ') + chalk.gray('│') + 
               chalk.bold(' Provider   ') + chalk.gray('│') + 
               chalk.bold(' Model               ') + chalk.gray('│') + 
               chalk.bold(' Temp  ') + chalk.gray('│') + 
               chalk.bold(' Max Tokens ') + chalk.gray('│'));
  console.log(chalk.gray('├─────────────┼────────────┼─────────────────────┼───────┼────────────┤'));
  
  // Rows
  for (const agent of agentTypes) {
    const mapping = config.getModelForAgent(agent);
    const agentStr = chalk.cyan(agent.padEnd(11));
    const providerStr = mapping.provider.padEnd(10);
    const modelStr = mapping.model.padEnd(19);
    const tempStr = (mapping.temperature?.toString() || '-').padEnd(5);
    const tokensStr = (mapping.maxTokens?.toString() || '-').padEnd(10);
    
    console.log(chalk.gray('│') + ` ${agentStr} ` + chalk.gray('│') + 
                ` ${providerStr} ` + chalk.gray('│') + 
                ` ${modelStr} ` + chalk.gray('│') + 
                ` ${tempStr} ` + chalk.gray('│') + 
                ` ${tokensStr} ` + chalk.gray('│'));
  }
  
  console.log(chalk.gray('└─────────────┴────────────┴─────────────────────┴───────┴────────────┘'));
  console.log('');
}

/**
 * Check if a string is a valid agent type
 */
function isValidAgentType(type: string): boolean {
  return ['build', 'plan', 'researcher', 'triage'].includes(type);
}

/**
 * Group array by a property
 */
function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}
