/**
 * MCP CLI Commands - Issue #24.4
 * CLI commands for managing MCP servers
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { MCPRegistryManager, MCPInstaller, MCPConfigWizard, MCPVersionManager } from '../../mcp/marketplace';
import { createMCPInitCommand } from './mcp-init.js';
import { createMCPDevCommand } from './mcp-dev.js';

/**
 * Create MCP command group
 */
export function createMCPCommand(): Command {
  const cmd = new Command('mcp')
    .description('Manage MCP (Model Context Protocol) servers');

  // Initialize managers
  const registry = new MCPRegistryManager();
  const installer = new MCPInstaller(registry);
  const wizard = new MCPConfigWizard(registry, installer);
  const versionManager = new MCPVersionManager(registry, installer);

  // Add SDK commands
  cmd.addCommand(createMCPInitCommand());
  cmd.addCommand(createMCPDevCommand());

  // Search command
  cmd.command('search [query]')
    .description('Search for MCP servers')
    .option('-t, --tag <tag>', 'Filter by tag')
    .option('-r, --runtime <runtime>', 'Filter by runtime (node|python|binary)')
    .option('--installed', 'Show only installed servers')
    .option('--json', 'Output as JSON')
    .action(async (query, options) => {
      try {
        await registry.load();
        
        const searchOptions: any = {};
        if (query) searchOptions.query = query;
        if (options.tag) searchOptions.tags = [options.tag];
        if (options.runtime) searchOptions.runtime = options.runtime;
        if (options.installed) searchOptions.installed = true;

        const results = await registry.search(searchOptions);

        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
        } else {
          if (results.length === 0) {
            console.log(chalk.yellow('No servers found'));
            return;
          }

          console.log(chalk.bold(`\n📋 Found ${results.length} server(s):\n`));
          
          results.forEach(server => {
            const installed = server.installed 
              ? chalk.green(' ✓') 
              : '';
            console.log(`  ${chalk.cyan(server.name)}${installed}`);
            console.log(`    ${server.description}`);
            console.log(`    ${chalk.gray(`Tags: ${server.tags.join(', ')}`)}`);
            console.log('');
          });
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // Install command
  cmd.command('install <name>')
    .description('Install an MCP server')
    .option('-v, --version <version>', 'Install specific version')
    .option('-g, --global', 'Install globally')
    .option('--dev', 'Development mode (link local path)')
    .option('--config <json>', 'Initial configuration as JSON')
    .option('--skip-security', 'Skip security scan')
    .action(async (name, options) => {
      try {
        console.log(chalk.bold(`\n📦 Installing ${name}...\n`));

        const installOptions: any = {};
        if (options.version) installOptions.version = options.version;
        if (options.global) installOptions.global = true;
        if (options.dev) installOptions.dev = true;
        if (options.skipSecurity) installOptions.skipSecurityScan = true;
        if (options.config) {
          try {
            installOptions.config = JSON.parse(options.config);
          } catch {
            console.error(chalk.red('Invalid JSON configuration'));
            process.exit(1);
          }
        }

        const result = await installer.install(name, installOptions);

        console.log(chalk.green(`\n✅ Successfully installed ${result.name} v${result.version}`));
        
        if (result.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️  Warnings:'));
          result.warnings.forEach(warning => {
            console.log(chalk.yellow(`  • ${warning}`));
          });
        }

        if (!result.isNew) {
          console.log(chalk.gray('\nNote: Server was already installed'));
        }
      } catch (error) {
        console.error(chalk.red(`\n❌ Installation failed: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // Configure command
  cmd.command('config <name>')
    .description('Configure an MCP server')
    .action(async (name) => {
      try {
        await wizard.configure(name);
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // List command
  cmd.command('list')
    .description('List installed MCP servers')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        await registry.load();
        const servers = await installer.list();

        if (options.json) {
          console.log(JSON.stringify(servers, null, 2));
        } else {
          if (servers.length === 0) {
            console.log(chalk.yellow('\nNo servers installed'));
            console.log(chalk.gray('\nInstall a server with: swarm-cli mcp install <name>'));
            return;
          }

          console.log(chalk.bold(`\n📋 Installed servers (${servers.length}):\n`));
          
          servers.forEach(server => {
            console.log(`  ${chalk.cyan(server.name)} ${chalk.gray(`v${server.installedVersion || server.version}`)}`);
            console.log(`    ${server.description}`);
            console.log('');
          });
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // Info command
  cmd.command('info <name>')
    .description('Show server details')
    .action(async (name) => {
      try {
        await registry.load();
        await wizard.showInfo(name);
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // Update command
  cmd.command('update [name]')
    .description('Update MCP server(s)')
    .option('--all', 'Update all servers')
    .option('--check', 'Check for updates without installing')
    .action(async (name, options) => {
      try {
        await registry.load();

        if (options.check) {
          await versionManager.showUpdateSummary();
          return;
        }

        if (options.all) {
          console.log(chalk.bold('\n🔄 Updating all servers...\n'));
          const results = await installer.updateAll();
          
          results.forEach(result => {
            if (result.updated) {
              console.log(chalk.green(`  ✓ ${result.name}: ${result.previousVersion} → ${result.newVersion}`));
            } else {
              console.log(chalk.gray(`  - ${result.name}: Already up to date (${result.newVersion})`));
            }
          });
          
          console.log(chalk.green('\n✅ Update complete'));
        } else if (name) {
          console.log(chalk.bold(`\n🔄 Updating ${name}...\n`));
          const result = await installer.update(name);
          
          if (result.updated) {
            console.log(chalk.green(`✅ Updated ${name}: ${result.previousVersion} → ${result.newVersion}`));
          } else {
            console.log(chalk.gray(`✓ ${name} is already up to date (${result.newVersion})`));
          }
        } else {
          console.error(chalk.red('Please specify a server name or use --all'));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // Remove command
  cmd.command('remove <name>')
    .description('Uninstall an MCP server')
    .action(async (name) => {
      try {
        console.log(chalk.bold(`\n🗑️  Removing ${name}...\n`));
        await installer.uninstall(name);
        console.log(chalk.green(`\n✅ Successfully removed ${name}`));
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // Test command
  cmd.command('test <name>')
    .description('Test a server connection')
    .action(async (name) => {
      try {
        console.log(chalk.bold(`\n🔌 Testing ${name}...\n`));
        const result = await installer.test(name);
        
        if (result.success) {
          console.log(chalk.green(`✅ ${result.message}`));
        } else {
          console.log(chalk.red(`❌ ${result.message}`));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // Registry commands
  const registryCmd = cmd.command('registry')
    .description('Manage the server registry');

  registryCmd.command('update')
    .description('Update registry from remote')
    .action(async () => {
      try {
        console.log(chalk.bold('\n🔄 Updating registry...\n'));
        await registry.update();
        console.log(chalk.green('✅ Registry updated'));
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  registryCmd.command('stats')
    .description('Show registry statistics')
    .action(async () => {
      try {
        await registry.load();
        const stats = await registry.getStats();
        
        console.log(chalk.bold('\n📊 Registry Statistics\n'));
        console.log(`  Total servers: ${stats.totalServers}`);
        console.log(`  Installed: ${stats.installedServers}`);
        console.log('');
        
        console.log(chalk.bold('By Runtime:'));
        Object.entries(stats.byRuntime).forEach(([runtime, count]) => {
          console.log(`  ${runtime}: ${count}`);
        });
        console.log('');
        
        console.log(chalk.bold('By Tag:'));
        Object.entries(stats.byTag).forEach(([tag, count]) => {
          console.log(`  ${tag}: ${count}`);
        });
        console.log('');
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  registryCmd.command('tags')
    .description('List all available tags')
    .action(async () => {
      try {
        await registry.load();
        const tags = await registry.getTags();
        
        console.log(chalk.bold('\n🏷️  Available Tags\n'));
        tags.forEach(tag => {
          console.log(`  • ${tag}`);
        });
        console.log('');
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // Marketplace command (interactive)
  cmd.command('marketplace')
    .description('Interactive marketplace browser')
    .action(async () => {
      try {
        await wizard.interactiveInstall();
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // Changelog command
  cmd.command('changelog <name>')
    .description('Show changelog for a server')
    .action(async (name) => {
      try {
        await registry.load();
        const changelog = await versionManager.changelog(name);
        console.log(chalk.bold(`\n📝 Changelog for ${name}\n`));
        console.log(changelog);
        console.log('');
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  // Pin command
  cmd.command('pin <name> <version>')
    .description('Pin a server to a specific version')
    .action(async (name, version) => {
      try {
        await registry.load();
        await versionManager.pin(name, version);
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  return cmd;
}
