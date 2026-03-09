/**
 * Agent CLI Commands
 *
 * Provides CLI commands for agent management:
 * - agent build: Create a composed agent from skills
 */

import { Command } from 'commander';
import { SkillRegistry } from '../../skills';
import { AgentBuilder } from '../../agents';
import { ComposedAgent } from '../../agents';
import { AgentSystem } from '../../agents';
import { CompositionConfig } from '../../agents/types/composition';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Register agent commands with the CLI program
 * @param program - Commander program instance
 * @param registry - SkillRegistry instance
 */
export function registerAgentCommands(
  program: Command,
  registry: SkillRegistry
): void {
  const agentCommand = program
    .command('agent')
    .description('Manage composed agents');

  // Build command
  agentCommand
    .command('build')
    .description('Build a composed agent from skills')
    .requiredOption('--name <name>', 'Agent name (lowercase alphanumeric with hyphens)')
    .requiredOption('--skills <skills>', 'Comma-separated list of skill names')
    .option('--description <desc>', 'Agent description')
    .option('--output <skill>', 'Output skill name (produces final result)')
    .option('--config <file>', 'JSON config file with skill configurations')
    .option('--json', 'Output agent config as JSON')
    .action(async (options) => {
      try {
        // Parse skills
        const skillNames = options.skills.split(',').map((s: string) => s.trim());

        // Load skill configs from file if provided
        let skillConfigs: Record<string, Record<string, unknown>> = {};
        if (options.config) {
          skillConfigs = parseSkillConfig(options.config);
        }

        // Create builder and configure
        const builder = new AgentBuilder(registry)
          .withName(options.name)
          .withDescription(options.description || '');

        // Add each skill with optional config
        for (const skillName of skillNames) {
          const config = skillConfigs[skillName] || skillConfigs[toCamelCase(skillName)];
          builder.use(skillName, config);
        }

        // Set output skill if specified
        if (options.output) {
          builder.withOutput(options.output);
        }

        // Build the agent configuration
        const compositionConfig = await builder.build();

        // Create agent instance and register with agent system
        const agentSystem = new AgentSystem();
        const agentConfig = {
          id: `composed-${options.name}-${Date.now()}`,
          runId: 'cli-run',
          role: options.name,
          model: 'claude-3-sonnet',
          apiUrl: '',
          tools: [],
        };

        const agent = new ComposedAgent(agentConfig, compositionConfig, registry);

        // Register agent with metadata
        (agentSystem as any).instances = (agentSystem as any).instances || new Map();
        (agentSystem as any).instances.set(agentConfig.id, {
          id: agentConfig.id,
          type: 'composed',
          status: 'idle',
          role: options.name,
          skills: skillNames,
          createdAt: new Date(),
        });

        // Output result
        if (options.json) {
          console.log(JSON.stringify(formatAgentOutput(compositionConfig, agentConfig.id), null, 2));
        } else {
          console.log(`✅ Successfully built agent: ${options.name}`);
          console.log(`   ID: ${agentConfig.id}`);
          console.log(`   Skills: ${skillNames.join(', ')}`);
          if (options.description) {
            console.log(`   Description: ${options.description}`);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Failed to build agent:', errorMessage);
        process.exit(1);
      }
    });
}

/**
 * Parse skill configuration from JSON file
 * @param filePath - Path to config file
 * @returns Parsed skill configurations
 */
function parseSkillConfig(filePath: string): Record<string, Record<string, unknown>> {
  try {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Config file not found: ${filePath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const parsed = JSON.parse(content);

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Config file must contain a JSON object');
    }

    return parsed as Record<string, Record<string, unknown>>;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse config file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Convert kebab-case or snake_case to camelCase
 * @param str - Input string
 * @returns camelCase string
 */
function toCamelCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
    .replace(/^(.)/, (_, char) => char.toLowerCase());
}

/**
 * Format agent output for display
 * @param config - Composition configuration
 * @param agentId - Agent ID
 * @returns Formatted output object
 */
function formatAgentOutput(
  config: CompositionConfig,
  agentId: string
): Record<string, unknown> {
  return {
    id: agentId,
    name: config.name,
    description: config.description,
    skills: config.skills.map(s => s.skillName),
    outputSkill: config.outputSkill,
    globalConfig: config.globalConfig,
  };
}
