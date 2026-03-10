/**
 * STATE.md CLI Commands
 *
 * Provides CLI integration for the STATE.md system.
 * Commands: init, show, list, add, update, remove, sync, validate, stats
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import { StateManager, StateManagerError } from './index';
import { StateCliOptions, StateItem, CellStatus, CellType } from './types';
import { parseState } from './parser';

/**
 * Create the state command group
 */
export function createStateCommand(): Command {
  const state = new Command('state')
    .description('Manage project state through STATE.md')
    .option('-f, --file <path>', 'Path to STATE.md file', './STATE.md');

  // Init command - create new STATE.md
  state
    .command('init')
    .description('Initialize a new STATE.md file')
    .argument('[project-name]', 'Project name', 'my-project')
    .option('--from-hive', 'Import existing cells from Hive')
    .action(async (projectName, options) => {
      try {
        const manager = createManager(state.opts().file);
        await manager.init();

        const exists = await manager.exists();
        if (exists && !options.fromHive) {
          console.log(chalk.yellow('⚠ STATE.md already exists. Use --from-hive to import from Hive.'));
          return;
        }

        if (options.fromHive) {
          await manager.importFromHive(projectName);
          console.log(chalk.green(`✓ Imported state from Hive to ${state.opts().file}`));
        } else {
          await manager.create(projectName);
          console.log(chalk.green(`✓ Created ${state.opts().file} for project "${projectName}"`));
        }

        await manager.close();
      } catch (error) {
        console.error(chalk.red(`✗ Failed to initialize: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // Show command - display state
  state
    .command('show')
    .description('Display current state')
    .option('-s, --section <type>', 'Show only specific section')
    .option('-i, --item <id>', 'Show specific item by ID')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const manager = createManager(state.opts().file);
        await manager.init();

        const stateData = await manager.getState();

        if (options.item) {
          const item = await manager.findItem(options.item);
          if (!item) {
            console.log(chalk.yellow(`Item "${options.item}" not found`));
            return;
          }
          if (options.json) {
            console.log(JSON.stringify(item, null, 2));
          } else {
            printItem(item);
          }
          return;
        }

        if (options.json) {
          if (options.section) {
            const section = stateData.sections.find(
              s => s.type === options.section || s.title === options.section
            );
            console.log(JSON.stringify(section || {}, null, 2));
          } else {
            console.log(JSON.stringify(stateData, null, 2));
          }
        } else {
          printState(stateData, options.section);
        }

        await manager.close();
      } catch (error) {
        console.error(chalk.red(`✗ Failed to show state: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // List command - list items
  state
    .command('list')
    .description('List items in state')
    .option('-s, --status <status>', 'Filter by status')
    .option('-t, --type <type>', 'Filter by type')
    .option('-o, --owner <owner>', 'Filter by owner')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const manager = createManager(state.opts().file);
        await manager.init();

        const stateData = await manager.getState();
        let items = stateData.sections.flatMap(s => s.items);

        // Apply filters
        if (options.status) {
          items = items.filter(i => i.status === options.status);
        }
        if (options.type) {
          items = items.filter(i => i.type === options.type);
        }
        if (options.owner) {
          items = items.filter(i => i.owner === options.owner);
        }

        if (options.json) {
          console.log(JSON.stringify(items, null, 2));
        } else {
          if (items.length === 0) {
            console.log(chalk.gray('No items found'));
          } else {
            console.log(chalk.bold(`\nFound ${items.length} item(s):\n`));
            items.forEach(item => printItemLine(item));
          }
        }

        await manager.close();
      } catch (error) {
        console.error(chalk.red(`✗ Failed to list items: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // Add command - add new item
  state
    .command('add')
    .description('Add a new item to state')
    .argument('<title>', 'Item title')
    .option('-s, --status <status>', 'Item status', 'open')
    .option('-t, --type <type>', 'Item type', 'task')
    .option('-p, --priority <priority>', 'Item priority')
    .option('-o, --owner <owner>', 'Item owner')
    .option('--section <section>', 'Section to add to')
    .option('--id <id>', 'Custom ID')
    .action(async (title, options) => {
      try {
        const manager = createManager(state.opts().file);
        await manager.init();

        const item: StateItem = {
          id: options.id || generateId(options.type),
          title,
          status: options.status as CellStatus,
          type: options.type as CellType,
          priority: options.priority as any,
          owner: options.owner,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await manager.addItem(item, options.section);
        await manager.save(await manager.getState());

        console.log(chalk.green(`✓ Added item "${title}" with ID ${item.id}`));
        await manager.close();
      } catch (error) {
        console.error(chalk.red(`✗ Failed to add item: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // Update command - update existing item
  state
    .command('update')
    .description('Update an existing item')
    .argument('<id>', 'Item ID')
    .option('-t, --title <title>', 'New title')
    .option('-s, --status <status>', 'New status')
    .option('-p, --priority <priority>', 'New priority')
    .option('-o, --owner <owner>', 'New owner')
    .action(async (id, options) => {
      try {
        const manager = createManager(state.opts().file);
        await manager.init();

        const updates: Partial<StateItem> = {};
        if (options.title) updates.title = options.title;
        if (options.status) updates.status = options.status as CellStatus;
        if (options.priority) updates.priority = options.priority as any;
        if (options.owner) updates.owner = options.owner;

        const updated = await manager.updateItem(id, updates);
        if (!updated) {
          console.log(chalk.yellow(`Item "${id}" not found`));
          return;
        }

        await manager.save(await manager.getState());
        console.log(chalk.green(`✓ Updated item "${id}"`));
        await manager.close();
      } catch (error) {
        console.error(chalk.red(`✗ Failed to update item: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // Remove command - remove item
  state
    .command('remove')
    .alias('rm')
    .description('Remove an item from state')
    .argument('<id>', 'Item ID')
    .option('--force', 'Force removal without confirmation')
    .action(async (id, options) => {
      try {
        const manager = createManager(state.opts().file);
        await manager.init();

        const item = await manager.findItem(id);
        if (!item) {
          console.log(chalk.yellow(`Item "${id}" not found`));
          return;
        }

        if (!options.force) {
          console.log(chalk.yellow(`⚠ About to remove: "${item.title}"`));
          console.log(chalk.gray('Use --force to confirm'));
          return;
        }

        const removed = await manager.removeItem(id);
        if (removed) {
          await manager.save(await manager.getState());
          console.log(chalk.green(`✓ Removed item "${id}"`));
        }

        await manager.close();
      } catch (error) {
        console.error(chalk.red(`✗ Failed to remove item: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // Move command - move item between sections
  state
    .command('move')
    .description('Move item to a different section')
    .argument('<id>', 'Item ID')
    .argument('<section>', 'Target section (type or title)')
    .action(async (id, section) => {
      try {
        const manager = createManager(state.opts().file);
        await manager.init();

        const moved = await manager.moveItem(id, section);
        if (moved) {
          await manager.save(await manager.getState());
          console.log(chalk.green(`✓ Moved item "${id}" to section "${section}"`));
        } else {
          console.log(chalk.yellow(`Could not move item "${id}" to "${section}"`));
        }

        await manager.close();
      } catch (error) {
        console.error(chalk.red(`✗ Failed to move item: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // Sync command - sync with Hive
  state
    .command('sync')
    .description('Synchronize STATE.md with Hive')
    .option('-d, --direction <dir>', 'Sync direction (to-hive, from-hive, bidirectional)', 'bidirectional')
    .option('-r, --resolve <strategy>', 'Conflict resolution (state, hive, manual)', 'manual')
    .option('--dry-run', 'Show what would be synced without making changes')
    .action(async (options) => {
      try {
        const manager = createManager(state.opts().file);
        await manager.init();

        if (options.dryRun) {
          const status = await manager.getSyncStatus();
          console.log(chalk.bold('\nSync Status (Dry Run):\n'));
          console.log(`  In sync: ${status.inSync ? chalk.green('Yes') : chalk.yellow('No')}`);
          console.log(`  Only in STATE.md: ${status.stateOnly.length}`);
          console.log(`  Only in Hive: ${status.hiveOnly.length}`);
          console.log(`  Divergent: ${status.divergent.length}`);

          if (status.divergent.length > 0) {
            console.log(chalk.yellow('\n  Divergent items:'));
            status.divergent.forEach(d => {
              console.log(`    - ${d.item.id}: ${d.differences.join(', ')}`);
            });
          }
          return;
        }

        const result = await manager.sync({
          direction: options.direction as any,
          conflictResolution: options.resolve as any,
        });

        if (result.success) {
          console.log(chalk.green('✓ Sync completed successfully'));
          console.log(`  Synced to Hive: ${result.syncedToHive}`);
          console.log(`  Synced from Hive: ${result.syncedFromHive}`);

          if (result.conflicts.length > 0) {
            console.log(chalk.yellow(`\n  ⚠ ${result.conflicts.length} conflict(s) detected:`));
            result.conflicts.forEach(c => {
              console.log(`    - ${c.itemId}.${c.field}: STATE="${c.stateValue}" vs HIVE="${c.hiveValue}"`);
            });
          }
        } else {
          console.error(chalk.red(`✗ Sync failed: ${result.error}`));
          process.exit(1);
        }

        await manager.close();
      } catch (error) {
        console.error(chalk.red(`✗ Failed to sync: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // Validate command - validate state
  state
    .command('validate')
    .description('Validate STATE.md structure')
    .option('--strict', 'Enable strict validation')
    .action(async (options) => {
      try {
        const manager = createManager(state.opts().file);
        await manager.init();

        const result = await manager.validate({ strict: options.strict });

        console.log(chalk.bold('\nValidation Results:\n'));
        console.log(`  Valid: ${result.valid ? chalk.green('Yes') : chalk.red('No')}`);
        console.log(`  Errors: ${result.errorCount}`);
        console.log(`  Warnings: ${result.warningCount}`);
        console.log(`  Info: ${result.infoCount}`);

        if (result.issues.length > 0) {
          console.log(chalk.bold('\n  Issues:'));
          result.issues.forEach(issue => {
            const icon = issue.severity === 'error' ? chalk.red('✗') :
                        issue.severity === 'warning' ? chalk.yellow('⚠') : chalk.blue('ℹ');
            console.log(`    ${icon} [${issue.severity.toUpperCase()}] ${issue.path}: ${issue.message}`);
            if (issue.suggestion) {
              console.log(chalk.gray(`      → ${issue.suggestion}`));
            }
          });
        }

        await manager.close();

        if (!result.valid) {
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`✗ Failed to validate: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // Stats command - show statistics
  state
    .command('stats')
    .description('Show state statistics')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const manager = createManager(state.opts().file);
        await manager.init();

        const stats = await manager.getStats();

        if (options.json) {
          console.log(JSON.stringify(stats, null, 2));
        } else {
          console.log(chalk.bold('\nState Statistics:\n'));
          console.log(`  Total items: ${stats.total}`);
          console.log(`  Last updated: ${stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Never'}`);

          if (Object.keys(stats.byStatus).length > 0) {
            console.log(chalk.bold('\n  By Status:'));
            Object.entries(stats.byStatus).forEach(([status, count]) => {
              const color = status === 'completed' ? chalk.green :
                           status === 'in_progress' ? chalk.blue :
                           status === 'blocked' ? chalk.red : chalk.gray;
              console.log(`    ${status}: ${color(count.toString())}`);
            });
          }

          if (Object.keys(stats.byType).length > 0) {
            console.log(chalk.bold('\n  By Type:'));
            Object.entries(stats.byType).forEach(([type, count]) => {
              console.log(`    ${type}: ${count}`);
            });
          }

          if (Object.keys(stats.bySection).length > 0) {
            console.log(chalk.bold('\n  By Section:'));
            Object.entries(stats.bySection).forEach(([section, count]) => {
              console.log(`    ${section}: ${count}`);
            });
          }

          if (Object.keys(stats.byOwner).length > 0) {
            console.log(chalk.bold('\n  By Owner:'));
            Object.entries(stats.byOwner).forEach(([owner, count]) => {
              console.log(`    ${owner}: ${count}`);
            });
          }
        }

        await manager.close();
      } catch (error) {
        console.error(chalk.red(`✗ Failed to get stats: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // Export command - export to different formats
  state
    .command('export')
    .description('Export state to different format')
    .argument('<format>', 'Export format (json, yaml, csv, markdown)')
    .option('-o, --output <file>', 'Output file (default: stdout)')
    .action(async (format, options) => {
      try {
        const validFormats = ['json', 'yaml', 'csv', 'markdown'];
        if (!validFormats.includes(format)) {
          console.error(chalk.red(`Invalid format. Must be one of: ${validFormats.join(', ')}`));
          process.exit(1);
        }

        const manager = createManager(state.opts().file);
        await manager.init();

        const output = await manager.export(format as any);

        if (options.output) {
          await fs.writeFile(options.output, output, 'utf-8');
          console.log(chalk.green(`✓ Exported to ${options.output}`));
        } else {
          console.log(output);
        }

        await manager.close();
      } catch (error) {
        console.error(chalk.red(`✗ Failed to export: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // Archive command - archive completed items
  state
    .command('archive')
    .description('Archive completed items')
    .option('--before <date>', 'Archive items completed before date (YYYY-MM-DD)')
    .action(async (options) => {
      try {
        const manager = createManager(state.opts().file);
        await manager.init();

        const beforeDate = options.before ? new Date(options.before) : undefined;
        const result = await manager.archive(beforeDate);

        if (result.archived > 0) {
          console.log(chalk.green(`✓ Archived ${result.archived} item(s) to ${result.filePath}`));
        } else {
          console.log(chalk.gray('No items to archive'));
        }

        await manager.close();
      } catch (error) {
        console.error(chalk.red(`✗ Failed to archive: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  return state;
}

/**
 * Create a StateManager instance
 */
function createManager(filePath: string): StateManager {
  return new StateManager({
    stateFilePath: filePath,
    autoSync: false,
  });
}

/**
 * Generate a unique ID
 */
function generateId(type: string = 'task'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${type}-${timestamp}-${random}`;
}

/**
 * Print state in human-readable format
 */
function printState(state: import('./types').State, sectionFilter?: string): void {
  console.log(chalk.bold(`\n${state.frontmatter.project}\n`));
  console.log(chalk.gray(`Version: ${state.frontmatter.version}`));
  if (state.frontmatter.lastSync) {
    console.log(chalk.gray(`Last sync: ${new Date(state.frontmatter.lastSync).toLocaleString()}`));
  }

  const sections = sectionFilter
    ? state.sections.filter(s => s.type === sectionFilter || s.title === sectionFilter)
    : state.sections;

  sections.forEach(section => {
    const title = section.title || section.type;
    const count = section.items.length;
    console.log(chalk.bold(`\n## ${title} (${count})`));

    if (section.items.length === 0) {
      console.log(chalk.gray('  (empty)'));
    } else {
      section.items.forEach(item => printItemLine(item));
    }
  });

  console.log('');
}

/**
 * Print a single item line
 */
function printItemLine(item: StateItem): void {
  const statusIcon = item.status === 'completed' ? chalk.green('✓') :
                     item.status === 'in_progress' ? chalk.blue('◐') :
                     item.status === 'blocked' ? chalk.red('✗') : chalk.gray('○');

  const priorityColor = item.priority === 'critical' ? chalk.red :
                        item.priority === 'high' ? chalk.yellow :
                        item.priority === 'medium' ? chalk.gray : chalk.gray;

  const priorityIcon = item.priority ? priorityColor(`[${item.priority[0].toUpperCase()}]`) : '';

  console.log(`  ${statusIcon} ${priorityIcon} ${chalk.bold(item.id)}: ${item.title}`);

  if (item.owner) {
    console.log(chalk.gray(`     @${item.owner}`));
  }
}

/**
 * Print detailed item information
 */
function printItem(item: StateItem): void {
  console.log(chalk.bold(`\n${item.title}\n`));
  console.log(`  ID: ${item.id}`);
  console.log(`  Status: ${item.status}`);
  if (item.type) console.log(`  Type: ${item.type}`);
  if (item.priority) console.log(`  Priority: ${item.priority}`);
  if (item.owner) console.log(`  Owner: ${item.owner}`);
  if (item.parentId) console.log(`  Parent: ${item.parentId}`);
  if (item.tags?.length) console.log(`  Tags: ${item.tags.join(', ')}`);
  if (item.createdAt) console.log(`  Created: ${new Date(item.createdAt).toLocaleString()}`);
  if (item.updatedAt) console.log(`  Updated: ${new Date(item.updatedAt).toLocaleString()}`);
  if (item.completedAt) console.log(`  Completed: ${new Date(item.completedAt).toLocaleString()}`);
  if (item.blockedReason) console.log(`  Blocked: ${item.blockedReason}`);

  if (item.notes?.length) {
    console.log(chalk.bold('\n  Notes:'));
    item.notes.forEach(note => console.log(`    • ${note}`));
  }

  console.log('');
}

export default createStateCommand;
