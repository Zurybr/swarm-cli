/**
 * Kanban CLI Commands
 * Command-line interface for Kanban board management
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import {
  KanbanSystem,
  createKanbanSystem,
  createSampleBoard,
  renderBoard,
  type Board,
  type Card,
  type CardStatus,
  type CardPriority
} from './index';

const program = new Command();

// Global state file path
const STATE_FILE = resolve(process.cwd(), '.kanban-state.json');

/**
 * Load board from state file or create new
 */
function loadBoard(): KanbanSystem {
  const system = createKanbanSystem();

  if (existsSync(STATE_FILE)) {
    try {
      const data = readFileSync(STATE_FILE, 'utf-8');
      system.importFromJSON(data);
    } catch (error) {
      console.error(chalk.red('Error loading board state:'), error);
    }
  }

  return system;
}

/**
 * Save board to state file
 */
function saveBoard(system: KanbanSystem): void {
  try {
    writeFileSync(STATE_FILE, system.exportToJSON());
  } catch (error) {
    console.error(chalk.red('Error saving board state:'), error);
  }
}

/**
 * Format card for display
 */
function formatCard(card: Card, compact = false): string {
  const statusColors: Record<CardStatus, (text: string) => string> = {
    backlog: chalk.gray,
    todo: chalk.blue,
    in_progress: chalk.yellow,
    review: chalk.magenta,
    done: chalk.green
  };

  const prioritySymbols: Record<CardPriority, string> = {
    low: chalk.gray('↓'),
    medium: chalk.white('→'),
    high: chalk.yellow('↑'),
    critical: chalk.red('‼')
  };

  const statusIcon = statusColors[card.status]('●');
  const priorityIcon = prioritySymbols[card.priority];
  const assignee = card.assignee ? chalk.cyan(`@${card.assignee}`) : chalk.gray('unassigned');

  if (compact) {
    return `${statusIcon} ${priorityIcon} ${chalk.white(card.title)} ${assignee}`;
  }

  const lines = [
    `${statusIcon} ${priorityIcon} ${chalk.bold.white(card.title)}`,
    `   ${chalk.gray('ID:')} ${card.id.slice(0, 8)}...`,
    `   ${chalk.gray('Status:')} ${card.status}  ${chalk.gray('Priority:')} ${card.priority}`,
    `   ${chalk.gray('Assignee:')} ${assignee}`
  ];

  if (card.description) {
    lines.push(`   ${chalk.gray('Description:')} ${card.description}`);
  }

  if (card.labels.length > 0) {
    lines.push(`   ${chalk.gray('Labels:')} ${card.labels.map(l => chalk.cyan(l)).join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Create CLI commands
 */
export function createKanbanCommands(): Command {
  const kanban = new Command('kanban')
    .description('Kanban board management commands');

  // Board commands
  kanban
    .command('init')
    .description('Initialize a new Kanban board')
    .argument('[name]', 'Board name', 'My Board')
    .option('-s, --sample', 'Create with sample data')
    .action((name, options) => {
      const system = createKanbanSystem();

      if (options.sample) {
        const board = createSampleBoard();
        system.setBoard(board);
        console.log(chalk.green('✓ Created sample board:'), chalk.bold(board.title));
      } else {
        system.createBoard(name);
        console.log(chalk.green('✓ Created board:'), chalk.bold(name));
      }

      saveBoard(system);
    });

  kanban
    .command('show')
    .description('Display the Kanban board')
    .option('-c, --compact', 'Compact display mode')
    .option('--no-color', 'Disable colors')
    .option('--ascii', 'Use ASCII characters instead of Unicode')
    .action((options) => {
      const system = loadBoard();
      const output = system.renderToTerminal({
        compact: options.compact,
        colors: options.color,
        unicode: !options.ascii
      });
      console.log(output);
    });

  kanban
    .command('list')
    .alias('ls')
    .description('List all cards')
    .option('-s, --status <status>', 'Filter by status')
    .option('-p, --priority <priority>', 'Filter by priority')
    .option('-a, --assignee <assignee>', 'Filter by assignee')
    .option('-l, --label <label>', 'Filter by label')
    .option('-c, --compact', 'Compact display')
    .action((options) => {
      const system = loadBoard();
      let cards = system.getAllCards();

      if (options.status) {
        cards = cards.filter(c => c.status === options.status);
      }
      if (options.priority) {
        cards = cards.filter(c => c.priority === options.priority);
      }
      if (options.assignee) {
        cards = cards.filter(c => c.assignee === options.assignee);
      }
      if (options.label) {
        cards = cards.filter(c => c.labels.includes(options.label));
      }

      if (cards.length === 0) {
        console.log(chalk.yellow('No cards found'));
        return;
      }

      console.log(chalk.bold(`\nFound ${cards.length} cards:\n`));
      cards.forEach(card => {
        console.log(formatCard(card, options.compact));
        console.log();
      });
    });

  // Card commands
  const card = kanban
    .command('card')
    .description('Card management commands');

  card
    .command('add')
    .description('Add a new card')
    .argument('<title>', 'Card title')
    .option('-d, --description <desc>', 'Card description')
    .option('-s, --status <status>', 'Initial status', 'backlog')
    .option('-p, --priority <priority>', 'Priority', 'medium')
    .option('-a, --assignee <assignee>', 'Assignee')
    .option('-l, --labels <labels>', 'Comma-separated labels')
    .action((title, options) => {
      const system = loadBoard();

      const card = system.addCard({
        title,
        description: options.description,
        status: options.status as CardStatus,
        priority: options.priority as CardPriority,
        assignee: options.assignee,
        labels: options.labels ? options.labels.split(',').map((l: string) => l.trim()) : []
      });

      saveBoard(system);
      console.log(chalk.green('✓ Added card:'), chalk.bold(card.title));
      console.log(chalk.gray(`  ID: ${card.id}`));
    });

  card
    .command('move')
    .description('Move a card to a different column')
    .argument('<card-id>', 'Card ID (or first 8 characters)')
    .argument('<status>', 'Target status')
    .action((cardId, status) => {
      const system = loadBoard();

      // Find card by partial ID
      const cards = system.getAllCards();
      const card = cards.find(c => c.id.startsWith(cardId));

      if (!card) {
        console.error(chalk.red('Error: Card not found'));
        process.exit(1);
      }

      const updated = system.updateCard(card.id, { status: status as CardStatus });

      if (updated) {
        saveBoard(system);
        console.log(chalk.green('✓ Moved card:'), chalk.bold(updated.title));
        console.log(chalk.gray(`  New status: ${updated.status}`));
      } else {
        console.error(chalk.red('Error: Failed to move card'));
      }
    });

  card
    .command('edit')
    .description('Edit a card')
    .argument('<card-id>', 'Card ID (or first 8 characters)')
    .option('-t, --title <title>', 'New title')
    .option('-d, --description <desc>', 'New description')
    .option('-p, --priority <priority>', 'New priority')
    .option('-a, --assignee <assignee>', 'New assignee')
    .action((cardId, options) => {
      const system = loadBoard();

      const cards = system.getAllCards();
      const card = cards.find(c => c.id.startsWith(cardId));

      if (!card) {
        console.error(chalk.red('Error: Card not found'));
        process.exit(1);
      }

      const updates: Partial<Card> = {};
      if (options.title) updates.title = options.title;
      if (options.description) updates.description = options.description;
      if (options.priority) updates.priority = options.priority as CardPriority;
      if (options.assignee) updates.assignee = options.assignee;

      const updated = system.updateCard(card.id, updates);

      if (updated) {
        saveBoard(system);
        console.log(chalk.green('✓ Updated card:'), chalk.bold(updated.title));
      } else {
        console.error(chalk.red('Error: Failed to update card'));
      }
    });

  card
    .command('delete')
    .alias('rm')
    .description('Delete a card')
    .argument('<card-id>', 'Card ID (or first 8 characters)')
    .option('-f, --force', 'Force deletion without confirmation')
    .action((cardId, options) => {
      const system = loadBoard();

      const cards = system.getAllCards();
      const card = cards.find(c => c.id.startsWith(cardId));

      if (!card) {
        console.error(chalk.red('Error: Card not found'));
        process.exit(1);
      }

      if (!options.force) {
        console.log(chalk.yellow('Card to delete:'));
        console.log(formatCard(card, true));
        console.log(chalk.red('\nUse --force to confirm deletion'));
        process.exit(1);
      }

      if (system.deleteCard(card.id)) {
        saveBoard(system);
        console.log(chalk.green('✓ Deleted card'));
      } else {
        console.error(chalk.red('Error: Failed to delete card'));
      }
    });

  card
    .command('show')
    .description('Show card details')
    .argument('<card-id>', 'Card ID (or first 8 characters)')
    .action((cardId) => {
      const system = loadBoard();

      const cards = system.getAllCards();
      const card = cards.find(c => c.id.startsWith(cardId));

      if (!card) {
        console.error(chalk.red('Error: Card not found'));
        process.exit(1);
      }

      console.log(formatCard(card, false));
    });

  // Stats command
  kanban
    .command('stats')
    .description('Show board statistics')
    .action(() => {
      const system = loadBoard();
      const stats = system.getStats();

      console.log(chalk.bold('\nBoard Statistics\n'));
      console.log(`${chalk.gray('Total Cards:')} ${stats.totalCards}`);
      console.log();

      console.log(chalk.bold('By Status:'));
      Object.entries(stats.cardsByStatus).forEach(([status, count]) => {
        const bar = '█'.repeat(Math.min(count, 20));
        console.log(`  ${status.padEnd(12)} ${bar} ${count}`);
      });
      console.log();

      console.log(chalk.bold('By Priority:'));
      Object.entries(stats.cardsByPriority).forEach(([priority, count]) => {
        const color = priority === 'critical' ? chalk.red :
                     priority === 'high' ? chalk.yellow :
                     priority === 'medium' ? chalk.white : chalk.gray;
        console.log(`  ${priority.padEnd(12)} ${color(count.toString())}`);
      });
      console.log();

      console.log(chalk.bold('Other:'));
      console.log(`  Unassigned: ${stats.unassignedCards}`);
      console.log(`  Overdue: ${stats.overdueCards}`);
    });

  // Export/Import commands
  kanban
    .command('export')
    .description('Export board to JSON')
    .argument('[file]', 'Output file', 'kanban-export.json')
    .action((file) => {
      const system = loadBoard();
      const json = system.exportToJSON();
      writeFileSync(resolve(file), json);
      console.log(chalk.green('✓ Exported to'), chalk.bold(file));
    });

  kanban
    .command('import')
    .description('Import board from JSON')
    .argument('<file>', 'Input file')
    .action((file) => {
      const system = createKanbanSystem();
      const path = resolve(file);

      if (!existsSync(path)) {
        console.error(chalk.red('Error: File not found:'), file);
        process.exit(1);
      }

      try {
        const json = readFileSync(path, 'utf-8');
        system.importFromJSON(json);
        saveBoard(system);
        console.log(chalk.green('✓ Imported from'), chalk.bold(file));
        console.log(chalk.gray(`  Board: ${system.getBoard().title}`));
      } catch (error) {
        console.error(chalk.red('Error importing:'), error);
        process.exit(1);
      }
    });

  // Web view command
  kanban
    .command('web')
    .description('Generate web view HTML')
    .option('-o, --output <file>', 'Output file', 'kanban.html')
    .option('-p, --port <port>', 'Start HTTP server on port')
    .action(async (options) => {
      const system = loadBoard();

      if (options.port) {
        const { createServer } = await import('http');
        const handler = system.createWebHandler();

        const server = createServer((req, res) => {
          const result = handler({ url: req.url || '/' });
          res.writeHead(result.status, result.headers);
          res.end(result.body);
        });

        server.listen(parseInt(options.port), () => {
          console.log(chalk.green(`✓ Server running at http://localhost:${options.port}`));
        });
      } else {
        const html = system.generateWebView();
        writeFileSync(resolve(options.output), html);
        console.log(chalk.green('✓ Generated'), chalk.bold(options.output));
      }
    });

  return kanban;
}

// Export the command creator
export default createKanbanCommands;
