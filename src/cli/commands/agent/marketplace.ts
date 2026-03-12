import { Command } from 'commander';
import {
  listAgents,
  searchAgents,
  getAgent,
  getRegistryPathFn,
} from '../../../marketplace/registry';
import {
  installAgent,
  listInstalledAgents,
  uninstallLocalAgent,
  getLocalAgentsPathFn,
} from '../../../marketplace/install';
import {
  publishAgent,
  createAgentTemplate,
} from '../../../marketplace/publish';

export function createMarketplaceCommand(): Command {
  const marketplace = new Command('marketplace')
    .description('Manage agent marketplace');

  marketplace
    .command('search')
    .description('Search agents in registry')
    .argument('[query]', 'Search query')
    .option('--list', 'List all available agents')
    .action(async (query: string | undefined, options) => {
      try {
        if (options.list) {
          const agents = listAgents();
          if (agents.length === 0) {
            console.log('No agents in registry.');
            return;
          }
          console.log('Available agents:\n');
          for (const agent of agents) {
            console.log(`  ${agent.name} (v${agent.version})`);
            console.log(`    ${agent.description}`);
            console.log(`    Tags: ${agent.tags.join(', ')}\n`);
          }
        } else if (query) {
          const results = searchAgents(query);
          if (results.length === 0) {
            console.log(`No agents found matching: ${query}`);
            return;
          }
          console.log(`Found ${results.length} agent(s):\n`);
          for (const agent of results) {
            console.log(`  ${agent.name} (v${agent.version})`);
            console.log(`    ${agent.description}`);
            console.log(`    Tags: ${agent.tags.join(', ')}\n`);
          }
        } else {
          console.log('Usage: agent marketplace search <query> or agent marketplace search --list');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Search failed:', errorMessage);
        process.exit(1);
      }
    });

  marketplace
    .command('install')
    .description('Install agent from registry or file')
    .argument('<source>', 'Agent name or path to .md file')
    .option('--name <name>', 'Override agent name')
    .option('--force', 'Force reinstall if already installed')
    .action(async (source: string, options) => {
      try {
        console.log(`Installing agent: ${source}...`);
        const metadata = await installAgent(source, {
          name: options.name,
          force: options.force,
        });
        console.log(`✅ Installed ${metadata.name} (v${metadata.version})`);
        console.log(`   Location: ${getLocalAgentsPathFn()}/${metadata.name}.md`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Install failed:', errorMessage);
        process.exit(1);
      }
    });

  marketplace
    .command('publish')
    .description('Publish agent to local registry')
    .argument('<file>', 'Path to agent .md file')
    .option('--name <name>', 'Agent name')
    .option('--version <version>', 'Version (e.g., 1.0.0)')
    .option('--description <desc>', 'Agent description')
    .option('--author <author>', 'Author name')
    .option('--tags <tags>', 'Comma-separated tags')
    .action(async (file: string, options) => {
      try {
        console.log(`Publishing agent from: ${file}...`);
        const metadata = publishAgent(file, {
          name: options.name,
          version: options.version,
          description: options.description,
          author: options.author,
          tags: options.tags?.split(',').map((t: string) => t.trim()),
        });
        console.log(`✅ Published ${metadata.name} (v${metadata.version})`);
        console.log(`   Registry: ${getRegistryPathFn()}/${metadata.name}.md`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Publish failed:', errorMessage);
        process.exit(1);
      }
    });

  marketplace
    .command('list')
    .description('List installed agents')
    .action(() => {
      try {
        const installed = listInstalledAgents();
        if (installed.length === 0) {
          console.log('No agents installed locally.');
          return;
        }
        console.log('Installed agents:\n');
        for (const name of installed) {
          console.log(`  ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ List failed:', errorMessage);
        process.exit(1);
      }
    });

  marketplace
    .command('info')
    .description('Show agent details')
    .argument('<name>', 'Agent name')
    .action(async (name: string) => {
      try {
        const agent = getAgent(name);
        if (!agent) {
          console.error(`Agent not found: ${name}`);
          process.exit(1);
        }
        console.log(`Name: ${agent.metadata.name}`);
        console.log(`Version: ${agent.metadata.version}`);
        console.log(`Description: ${agent.metadata.description}`);
        console.log(`Author: ${agent.metadata.author}`);
        console.log(`Tags: ${agent.metadata.tags.join(', ')}`);
        console.log(`Created: ${agent.metadata.createdAt}`);
        console.log(`Updated: ${agent.metadata.updatedAt}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Info failed:', errorMessage);
        process.exit(1);
      }
    });

  marketplace
    .command('uninstall')
    .description('Uninstall local agent')
    .argument('<name>', 'Agent name')
    .action(async (name: string) => {
      try {
        const success = uninstallLocalAgent(name);
        if (success) {
          console.log(`✅ Uninstalled: ${name}`);
        } else {
          console.error(`❌ Agent not installed: ${name}`);
          process.exit(1);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Uninstall failed:', errorMessage);
        process.exit(1);
      }
    });

  marketplace
    .command('init')
    .description('Create agent template')
    .argument('<name>', 'Agent name')
    .option('--output <file>', 'Output file path')
    .action(async (name: string, options) => {
      try {
        const template = createAgentTemplate(name);
        const outputPath = options.output || `${name}.md`;
        require('fs').writeFileSync(outputPath, template);
        console.log(`✅ Created agent template: ${outputPath}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Init failed:', errorMessage);
        process.exit(1);
      }
    });

  return marketplace;
}

export function registerMarketplaceCommands(program: Command): void {
  const marketplaceCommand = createMarketplaceCommand();
  program.addCommand(marketplaceCommand);
}

export default createMarketplaceCommand;
