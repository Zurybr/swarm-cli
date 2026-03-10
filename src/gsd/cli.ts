/**
 * GSD CLI Commands
 *
 * Provides 'swarm gsd' commands for project management.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { GSDSystem } from './index';
import { GSDStatus, GSDPriority, ExportOptions } from './types';

/**
 * Create the GSD CLI command
 * @returns Commander command
 */
export function createGSDCommand(): Command {
  const gsd = new Command('gsd')
    .description('GSD (Get Shit Done) project management commands');

  // ==================== Project Commands ====================

  gsd
    .command('init')
    .description('Initialize a new GSD project')
    .argument('<name>', 'Project name')
    .option('-d, --description <desc>', 'Project description', '')
    .option('-f, --file <path>', 'Project file path', 'PROJECT.md')
    .action(async (name: string, options) => {
      try {
        if (fs.existsSync(options.file)) {
          console.log(chalk.yellow(`⚠ Project file already exists: ${options.file}`));
          const { overwrite } = await import('inquirer').then(m =>
            m.default.prompt([{
              type: 'confirm',
              name: 'overwrite',
              message: 'Overwrite existing file?',
              default: false,
            }])
          );
          if (!overwrite) {
            console.log(chalk.gray('Cancelled'));
            return;
          }
        }

        const system = new GSDSystem({ autoSave: false });
        system.initProject(name, options.description);
        system.save(options.file);

        console.log(chalk.green(`✓ Created GSD project: ${name}`));
        console.log(chalk.gray(`  File: ${path.resolve(options.file)}`));
      } catch (error) {
        console.error(chalk.red(`✗ Failed to create project: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  gsd
    .command('status')
    .description('Show project status and progress')
    .option('-f, --file <path>', 'Project file path')
    .action(async (options) => {
      try {
        const system = await loadSystem(options.file);
        const project = system.getCurrentProject();

        if (!project) {
          console.error(chalk.red('No project loaded'));
          process.exit(1);
        }

        console.log(chalk.bold.blue(`\n📋 ${project.name}\n`));

        if (project.description) {
          console.log(project.description);
          console.log();
        }

        const stats = system.getStats();

        // Overall progress
        console.log(chalk.bold('Overall Progress:'));
        console.log(renderProgressBar(stats.progressPercent));
        console.log(`${stats.progressPercent}% complete\n`);

        // Summary
        console.log(chalk.bold('Summary:'));
        console.log(`  Milestones: ${stats.completedMilestones}/${stats.totalMilestones}`);
        console.log(`  Phases:     ${stats.completedPhases}/${stats.totalPhases}`);
        console.log(`  Tasks:      ${stats.completedTasks}/${stats.totalTasks}`);
        console.log();

        // Milestones
        console.log(chalk.bold('Milestones:'));
        for (const milestone of project.milestones.sort((a, b) => a.order - b.order)) {
          const icon = getStatusIcon(milestone.status);
          const mStats = milestone.phases.reduce(
            (acc, p) => ({
              phases: acc.phases + 1,
              completed: acc.completed + (p.status === 'completed' ? 1 : 0),
            }),
            { phases: 0, completed: 0 }
          );

          console.log(`  ${icon} ${milestone.name}`);
          console.log(`     ${mStats.completed}/${mStats.phases} phases`);

          for (const phase of milestone.phases.sort((a, b) => a.order - b.order)) {
            const pIcon = getStatusIcon(phase.status);
            const tCompleted = phase.tasks.filter(t => t.status === 'completed').length;
            console.log(`       ${pIcon} ${phase.name} (${tCompleted}/${phase.tasks.length} tasks)`);
          }
        }
        console.log();

        // Validation
        const validation = system.validate();
        if (!validation.valid) {
          console.log(chalk.yellow('⚠ Validation Issues:'));
          for (const error of validation.errors) {
            console.log(chalk.red(`  ✗ ${error.field}: ${error.message}`));
          }
        }
        if (validation.warnings.length > 0) {
          console.log(chalk.yellow('Warnings:'));
          for (const warning of validation.warnings) {
            console.log(chalk.yellow(`  ⚠ ${warning.field}: ${warning.message}`));
          }
        }
      } catch (error) {
        console.error(chalk.red(`✗ ${(error as Error).message}`));
        process.exit(1);
      }
    });

  gsd
    .command('validate')
    .description('Validate the project structure')
    .option('-f, --file <path>', 'Project file path')
    .action(async (options) => {
      try {
        const system = await loadSystem(options.file);
        const validation = system.validate();

        if (validation.valid && validation.warnings.length === 0) {
          console.log(chalk.green('✓ Project is valid'));
          return;
        }

        if (validation.valid) {
          console.log(chalk.yellow('⚠ Project is valid with warnings:'));
        } else {
          console.log(chalk.red('✗ Project has errors:'));
        }

        for (const error of validation.errors) {
          console.log(chalk.red(`  ✗ ${error.field}: ${error.message}`));
        }

        for (const warning of validation.warnings) {
          console.log(chalk.yellow(`  ⚠ ${warning.field}: ${warning.message}`));
          if (warning.suggestion) {
            console.log(chalk.gray(`     Suggestion: ${warning.suggestion}`));
          }
        }

        if (!validation.valid) {
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red(`✗ ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // ==================== Milestone Commands ====================

  const milestone = gsd
    .command('milestone')
    .description('Milestone management commands');

  milestone
    .command('add')
    .description('Add a new milestone')
    .argument('<name>', 'Milestone name')
    .option('-d, --description <desc>', 'Milestone description', '')
    .option('-f, --file <path>', 'Project file path')
    .action(async (name: string, options) => {
      try {
        const system = await loadSystem(options.file);
        const milestone = system.addMilestone(name, options.description);
        console.log(chalk.green(`✓ Added milestone: ${milestone.name}`));
      } catch (error) {
        console.error(chalk.red(`✗ ${(error as Error).message}`));
        process.exit(1);
      }
    });

  milestone
    .command('list')
    .description('List all milestones')
    .option('-f, --file <path>', 'Project file path')
    .action(async (options) => {
      try {
        const system = await loadSystem(options.file);
        const project = system.getCurrentProject();

        if (!project || project.milestones.length === 0) {
          console.log(chalk.gray('No milestones found'));
          return;
        }

        console.log(chalk.bold('\nMilestones:\n'));

        for (const m of project.milestones.sort((a, b) => a.order - b.order)) {
          const icon = getStatusIcon(m.status);
          const phaseCount = m.phases.length;
          const completedPhases = m.phases.filter(p => p.status === 'completed').length;

          console.log(`${icon} ${m.name}`);
          console.log(`   Status: ${m.status}`);
          console.log(`   Phases: ${completedPhases}/${phaseCount}`);

          if (m.targetDate) {
            console.log(`   Target: ${m.targetDate.toLocaleDateString()}`);
          }
          console.log();
        }
      } catch (error) {
        console.error(chalk.red(`✗ ${(error as Error).message}`));
        process.exit(1);
      }
    });

  milestone
    .command('remove')
    .description('Remove a milestone')
    .argument('<id>', 'Milestone ID or name')
    .option('-f, --file <path>', 'Project file path')
    .action(async (id: string, options) => {
      try {
        const system = await loadSystem(options.file);
        const milestone = system.getMilestone(id);

        if (!milestone) {
          console.error(chalk.red(`Milestone not found: ${id}`));
          process.exit(1);
        }

        const { confirm } = await import('inquirer').then(m =>
          m.default.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Remove milestone "${milestone.name}"?`,
            default: false,
          }])
        );

        if (!confirm) {
          console.log(chalk.gray('Cancelled'));
          return;
        }

        system.removeMilestone(milestone.id);
        console.log(chalk.green(`✓ Removed milestone: ${milestone.name}`));
      } catch (error) {
        console.error(chalk.red(`✗ ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // ==================== Phase Commands ====================

  const phase = gsd
    .command('phase')
    .description('Phase management commands');

  phase
    .command('add')
    .description('Add a new phase to a milestone')
    .argument('<milestone>', 'Milestone ID or name')
    .argument('<name>', 'Phase name')
    .option('-d, --description <desc>', 'Phase description', '')
    .option('-f, --file <path>', 'Project file path')
    .action(async (milestoneId: string, name: string, options) => {
      try {
        const system = await loadSystem(options.file);
        const milestone = system.getMilestone(milestoneId);

        if (!milestone) {
          console.error(chalk.red(`Milestone not found: ${milestoneId}`));
          process.exit(1);
        }

        const phase = system.addPhase(milestone.id, name, options.description);
        console.log(chalk.green(`✓ Added phase: ${phase.name}`));
      } catch (error) {
        console.error(chalk.red(`✗ ${(error as Error).message}`));
        process.exit(1);
      }
    });

  phase
    .command('list')
    .description('List phases in a milestone')
    .argument('[milestone]', 'Milestone ID or name (omit for all)')
    .option('-f, --file <path>', 'Project file path')
    .action(async (milestoneId: string | undefined, options) => {
      try {
        const system = await loadSystem(options.file);
        const project = system.getCurrentProject();

        if (!project) {
          console.error(chalk.red('No project loaded'));
          process.exit(1);
        }

        let milestones = project.milestones;

        if (milestoneId) {
          const milestone = system.getMilestone(milestoneId);
          if (!milestone) {
            console.error(chalk.red(`Milestone not found: ${milestoneId}`));
            process.exit(1);
          }
          milestones = [milestone];
        }

        for (const m of milestones.sort((a, b) => a.order - b.order)) {
          console.log(chalk.bold(`\n${m.name}:`));

          if (m.phases.length === 0) {
            console.log(chalk.gray('  No phases'));
            continue;
          }

          for (const p of m.phases.sort((a, b) => a.order - b.order)) {
            const icon = getStatusIcon(p.status);
            const taskCount = p.tasks.length;
            const completedTasks = p.tasks.filter(t => t.status === 'completed').length;

            console.log(`  ${icon} ${p.name} (${completedTasks}/${taskCount} tasks)`);
          }
        }
        console.log();
      } catch (error) {
        console.error(chalk.red(`✗ ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // ==================== Task Commands ====================

  const task = gsd
    .command('task')
    .description('Task management commands');

  task
    .command('add')
    .description('Add a new task to a phase')
    .argument('<phase>', 'Phase ID or name')
    .argument('<name>', 'Task name')
    .option('-p, --priority <level>', 'Task priority (critical|high|medium|low)', 'medium')
    .option('-f, --file <path>', 'Project file path')
    .action(async (phaseId: string, name: string, options) => {
      try {
        const system = await loadSystem(options.file);
        const result = system.getPhase(phaseId);

        if (!result) {
          console.error(chalk.red(`Phase not found: ${phaseId}`));
          process.exit(1);
        }

        const { milestone, phase } = result;
        const priority = options.priority as GSDPriority;

        const task = system.addTask(milestone.id, phase.id, name, priority);
        console.log(chalk.green(`✓ Added task: ${task.name}`));
      } catch (error) {
        console.error(chalk.red(`✗ ${(error as Error).message}`));
        process.exit(1);
      }
    });

  task
    .command('complete')
    .description('Mark a task as completed')
    .argument('<task>', 'Task ID or name')
    .option('-f, --file <path>', 'Project file path')
    .action(async (taskId: string, options) => {
      try {
        const system = await loadSystem(options.file);
        const result = system.getTask(taskId);

        if (!result) {
          console.error(chalk.red(`Task not found: ${taskId}`));
          process.exit(1);
        }

        const { milestone, phase, task } = result;
        system.completeTask(milestone.id, phase.id, task.id);
        console.log(chalk.green(`✓ Completed task: ${task.name}`));
      } catch (error) {
        console.error(chalk.red(`✗ ${(error as Error).message}`));
        process.exit(1);
      }
    });

  task
    .command('list')
    .description('List tasks')
    .option('-p, --phase <phase>', 'Filter by phase')
    .option('-s, --status <status>', 'Filter by status')
    .option('-f, --file <path>', 'Project file path')
    .action(async (options) => {
      try {
        const system = await loadSystem(options.file);
        const project = system.getCurrentProject();

        if (!project) {
          console.error(chalk.red('No project loaded'));
          process.exit(1);
        }

        for (const m of project.milestones.sort((a, b) => a.order - b.order)) {
          for (const p of m.phases.sort((a, b) => a.order - b.order)) {
            if (options.phase && !p.name.toLowerCase().includes(options.phase.toLowerCase())) {
              continue;
            }

            const tasks = options.status
              ? p.tasks.filter(t => t.status === options.status)
              : p.tasks;

            if (tasks.length === 0) continue;

            console.log(chalk.bold(`\n${m.name} > ${p.name}:`));

            for (const t of tasks) {
              const icon = getStatusIcon(t.status);
              const priority = t.priority !== 'medium' ? chalk.gray(`[${t.priority}]`) : '';
              console.log(`  ${icon} ${t.name} ${priority}`);
            }
          }
        }
        console.log();
      } catch (error) {
        console.error(chalk.red(`✗ ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // ==================== Roadmap Commands ====================

  const roadmap = gsd
    .command('roadmap')
    .description('Roadmap visualization commands');

  roadmap
    .command('show')
    .description('Display the project roadmap')
    .option('-f, --file <path>', 'Project file path')
    .action(async (options) => {
      try {
        const system = await loadSystem(options.file);
        const visualization = system.visualizeRoadmap();
        console.log(visualization);
      } catch (error) {
        console.error(chalk.red(`✗ ${(error as Error).message}`));
        process.exit(1);
      }
    });

  roadmap
    .command('export')
    .description('Export roadmap to a file')
    .argument('<format>', 'Export format (json|markdown|html|svg)')
    .option('-o, --output <path>', 'Output file path')
    .option('-f, --file <path>', 'Project file path')
    .option('--no-completed', 'Exclude completed items')
    .action(async (format: string, options) => {
      try {
        const system = await loadSystem(options.file);

        const exportFormat = format.toLowerCase() as ExportOptions['format'];
        if (!['json', 'markdown', 'html', 'svg'].includes(exportFormat)) {
          console.error(chalk.red(`Invalid format: ${format}`));
          process.exit(1);
        }

        const content = system.exportRoadmap(exportFormat, {
          includeCompleted: options.completed !== false,
          includeDetails: true,
        });

        if (options.output) {
          fs.writeFileSync(options.output, content, 'utf-8');
          console.log(chalk.green(`✓ Exported to: ${path.resolve(options.output)}`));
        } else {
          console.log(content);
        }
      } catch (error) {
        console.error(chalk.red(`✗ ${(error as Error).message}`));
        process.exit(1);
      }
    });

  roadmap
    .command('upcoming')
    .description('Show upcoming milestones and phases')
    .option('-d, --days <n>', 'Number of days to look ahead', '7')
    .option('-f, --file <path>', 'Project file path')
    .action(async (options) => {
      try {
        const system = await loadSystem(options.file);
        const days = parseInt(options.days, 10);
        const items = system.getUpcomingItems(days);

        if (items.length === 0) {
          console.log(chalk.gray(`No upcoming items in the next ${days} days`));
          return;
        }

        console.log(chalk.bold(`\nUpcoming in the next ${days} days:\n`));

        for (const item of items) {
          const type = item.type === 'milestone' ? chalk.blue('[M]') : chalk.gray('[P]');
          const daysText = item.daysRemaining === 0
            ? chalk.red('Today!')
            : item.daysRemaining === 1
              ? chalk.yellow('Tomorrow')
              : `${item.daysRemaining} days`;

          console.log(`${type} ${item.name}`);
          console.log(`   Due: ${item.targetDate.toLocaleDateString()} (${daysText})`);
        }
        console.log();
      } catch (error) {
        console.error(chalk.red(`✗ ${(error as Error).message}`));
        process.exit(1);
      }
    });

  roadmap
    .command('critical')
    .description('Show critical path (blocking items)')
    .option('-f, --file <path>', 'Project file path')
    .action(async (options) => {
      try {
        const system = await loadSystem(options.file);
        const items = system.getCriticalPath();

        if (items.length === 0) {
          console.log(chalk.green('✓ No blocking items - project is on track!'));
          return;
        }

        console.log(chalk.bold('\nCritical Path (Blocking Items):\n'));

        for (const item of items) {
          const type = item.type === 'milestone' ? chalk.blue('[Milestone]') : chalk.gray('[Phase]');
          const status = getStatusIcon(item.status);

          console.log(`${status} ${type} ${item.name}`);
          console.log(chalk.yellow(`   Blocking: ${item.blocking}`));
        }
        console.log();
      } catch (error) {
        console.error(chalk.red(`✗ ${(error as Error).message}`));
        process.exit(1);
      }
    });

  return gsd;
}

// ==================== Helper Functions ====================

/**
 * Load GSD system with project file
 * @param filePath - Optional explicit file path
 * @returns Configured GSDSystem
 */
async function loadSystem(filePath?: string): Promise<GSDSystem> {
  const system = new GSDSystem();

  const projectPath = filePath || GSDSystem.findProjectFile();

  if (!projectPath) {
    throw new Error('No PROJECT.md found. Run "swarm gsd init" to create one.');
  }

  system.loadProject(projectPath);
  return system;
}

/**
 * Get status icon for display
 * @param status - GSD status
 * @returns Icon character
 */
function getStatusIcon(status: GSDStatus): string {
  switch (status) {
    case 'completed':
      return chalk.green('✓');
    case 'in_progress':
      return chalk.blue('▶');
    case 'blocked':
      return chalk.red('✗');
    case 'cancelled':
      return chalk.gray('⊘');
    default:
      return chalk.gray('○');
  }
}

/**
 * Render a progress bar
 * @param percent - Percentage (0-100)
 * @param width - Bar width in characters
 * @returns Progress bar string
 */
function renderProgressBar(percent: number, width: number = 40): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  return bar;
}

// Re-export
export * from './index';
