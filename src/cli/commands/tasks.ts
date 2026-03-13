/**
 * Tasks CLI Commands - Issue #13
 *
 * CLI commands for listing tasks from Hive cells.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { CellData, CellStatus, CellType } from '../../hive/types';

const DEFAULT_HIVE_DIR = '.hive';

/**
 * Load cells from hive storage
 */
function loadCells(): CellData[] {
  const cellsDir = path.join(process.cwd(), DEFAULT_HIVE_DIR, 'cells');
  const cells: CellData[] = [];

  if (!fs.existsSync(cellsDir)) {
    return cells;
  }

  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const cell = JSON.parse(content) as CellData;
          cells.push(cell);
        } catch (error) {
          // Skip invalid files
        }
      }
    }
  }

  walkDir(cellsDir);
  return cells;
}

/**
 * Format cell for display
 */
function formatCell(cell: CellData, compact = false): string {
  const statusColors: Record<CellStatus, (text: string) => string> = {
    open: chalk.gray,
    in_progress: chalk.yellow,
    completed: chalk.green,
    blocked: chalk.red,
    cancelled: chalk.gray
  };

  const typeIcons: Record<CellType, string> = {
    epic: '🎯',
    task: '📋',
    subtask: '→',
    bug: '🐛',
    feature: '✨',
    research: '🔬'
  };

  const statusIcon = statusColors[cell.status]('●');
  const typeIcon = typeIcons[cell.type] || '📋';
  const owner = cell.owner ? chalk.cyan(`@${cell.owner}`) : '';
  const priority = cell.priority !== undefined ? ` [P${cell.priority}]` : '';

  if (compact) {
    return `${statusIcon} ${typeIcon} ${chalk.white(cell.title)}${priority} ${owner}`;
  }

  const lines = [
    `${statusIcon} ${typeIcon} ${chalk.bold.white(cell.title)}${priority}`,
    `   ${chalk.gray('ID:')} ${cell.id}`,
    `   ${chalk.gray('Status:')} ${cell.status}  ${chalk.gray('Type:')} ${cell.type}`,
  ];

  if (owner) {
    lines.push(`   ${chalk.gray('Owner:')} ${owner}`);
  }

  if (cell.description) {
    const desc = cell.description.length > 100 
      ? cell.description.slice(0, 100) + '...'
      : cell.description;
    lines.push(`   ${chalk.gray('Description:')} ${desc}`);
  }

      if (cell.tags && cell.tags.length > 0) {
        lines.push(`   ${chalk.gray('Tags:')} ${cell.tags.map((t: string) => chalk.cyan(t)).join(', ')}`);
      }

  return lines.join('\n');
}

/**
 * Create tasks command
 */
export function createTasksCommand(): Command {
  const tasks = new Command('tasks')
    .description('List and manage tasks from Hive cells');

  // List command
  tasks
    .command('list')
    .alias('ls')
    .description('List all tasks')
    .option('-s, --status <status>', 'Filter by status (open, in_progress, completed, blocked, cancelled)')
    .option('-t, --type <type>', 'Filter by type (task, bug, feature, epic, subtask, research)')
    .option('-o, --owner <owner>', 'Filter by owner')
    .option('--phase <phase>', 'Filter by phase tag (e.g., "03-features")')
    .option('-c, --compact', 'Compact display mode')
    .option('--json', 'Output as JSON')
    .action((options) => {
      let cells = loadCells();

      // Apply filters
      if (options.status) {
        cells = cells.filter(c => c.status === options.status);
      }
      if (options.type) {
        cells = cells.filter(c => c.type === options.type);
      }
      if (options.owner) {
        cells = cells.filter(c => c.owner === options.owner);
      }
      if (options.phase) {
        cells = cells.filter(c => c.tags?.includes(options.phase));
      }

      if (cells.length === 0) {
        console.log(chalk.yellow('No tasks found'));
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(cells, null, 2));
        return;
      }

      // Sort by priority and status
      cells.sort((a, b) => {
        // Priority desc
        if (a.priority !== undefined && b.priority !== undefined) {
          if (a.priority !== b.priority) return b.priority - a.priority;
        }
        // Then by status
        const statusOrder: Record<CellStatus, number> = {
          in_progress: 0,
          open: 1,
          blocked: 2,
          completed: 3,
          cancelled: 4
        };
        return statusOrder[a.status] - statusOrder[b.status];
      });

      console.log(chalk.bold(`\nFound ${cells.length} task(s):\n`));
      cells.forEach(cell => {
        console.log(formatCell(cell, options.compact));
        console.log();
      });
    });

  // Stats command
  tasks
    .command('stats')
    .description('Show task statistics')
    .action(() => {
      const cells = loadCells();

      const stats = {
        total: cells.length,
        byStatus: {} as Record<CellStatus, number>,
        byType: {} as Record<CellType, number>,
        open: cells.filter(c => c.status === 'open').length,
        inProgress: cells.filter(c => c.status === 'in_progress').length,
        completed: cells.filter(c => c.status === 'completed').length,
        blocked: cells.filter(c => c.status === 'blocked').length,
      };

      for (const cell of cells) {
        stats.byStatus[cell.status] = (stats.byStatus[cell.status] || 0) + 1;
        stats.byType[cell.type] = (stats.byType[cell.type] || 0) + 1;
      }

      console.log(chalk.bold('\n📊 Task Statistics\n'));
      console.log(chalk.white(`  Total: ${stats.total}`));
      console.log(`  ${chalk.yellow('In Progress:')} ${stats.inProgress}`);
      console.log(`  ${chalk.gray('Open:')} ${stats.open}`);
      console.log(`  ${chalk.green('Completed:')} ${stats.completed}`);
      console.log(`  ${chalk.red('Blocked:')} ${stats.blocked}`);
      console.log();

      if (Object.keys(stats.byType).length > 0) {
        console.log(chalk.bold('By Type:'));
        for (const [type, count] of Object.entries(stats.byType)) {
          console.log(`  ${type}: ${count}`);
        }
        console.log();
      }
    });

  return tasks;
}

export default createTasksCommand;
