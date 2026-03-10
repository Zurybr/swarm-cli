/**
 * Wave Execution CLI Commands
 *
 * Provides CLI commands for the wave-based parallel execution system.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import WaveExecution from './index';
import { ExecutionOptions, CreateTaskOptions, TaskResult } from './types';
import { Logger } from '../utils/logger';

const logger = new Logger('WaveCLI');

/**
 * Create the wave command
 */
export function createWaveCommand(): Command {
  const wave = new Command('wave')
    .description('Wave-based parallel execution commands');

  // Plan command - create and visualize execution plan
  wave
    .command('plan')
    .description('Create and visualize an execution plan from tasks')
    .option('-f, --file <file>', 'Task definition file (JSON)')
    .option('-o, --output <file>', 'Output plan to file')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const execution = new WaveExecution();

        // Load tasks from file or use example
        let tasks: CreateTaskOptions[];
        if (options.file) {
          const fs = await import('fs');
          const content = fs.readFileSync(options.file, 'utf-8');
          tasks = JSON.parse(content);
        } else {
          // Example tasks
          tasks = createExampleTasks();
          console.log(chalk.blue('Using example tasks (use -f to specify a file)'));
        }

        // Add tasks
        execution.addTasks(tasks);

        // Create plan
        const plan = execution.createPlan();

        // Output
        if (options.json) {
          console.log(execution.serializePlan());
        } else {
          console.log(chalk.green(`\n✓ Created plan with ${plan.waves.length} waves`));
          console.log(chalk.gray(`  Total tasks: ${plan.totalTasks}`));

          // Display waves
          for (const wave of plan.waves) {
            console.log(chalk.yellow(`\n  Wave ${wave.number}:`));
            for (const task of wave.tasks) {
              const deps = task.dependencies.length > 0
                ? chalk.gray(` (depends: ${task.dependencies.join(', ')})`)
                : '';
              console.log(`    • ${task.name}${deps}`);
            }
          }

          // Metrics
          const metrics = execution.getMetrics();
          console.log(chalk.cyan('\n  Metrics:'));
          console.log(`    Max parallelism: ${metrics.maxParallelism}`);
          console.log(`    Avg tasks/wave: ${metrics.averageTasksPerWave.toFixed(1)}`);
          console.log(`    Critical path: ${metrics.criticalPathLength} tasks`);
        }

        // Save to file if requested
        if (options.output) {
          const fs = await import('fs');
          fs.writeFileSync(options.output, execution.serializePlan());
          console.log(chalk.green(`\n✓ Plan saved to ${options.output}`));
        }
      } catch (error) {
        logger.error('Failed to create plan', error);
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Execute command - run the execution plan
  wave
    .command('execute')
    .description('Execute a wave-based plan')
    .option('-f, --file <file>', 'Task definition file (JSON)')
    .option('-p, --plan <file>', 'Plan file to execute (instead of tasks)')
    .option('-c, --concurrency <n>', 'Maximum concurrent tasks', '10')
    .option('--continue-on-failure', 'Continue execution even if tasks fail')
    .option('--timeout <ms>', 'Global timeout in milliseconds', '0')
    .option('--delay <ms>', 'Delay between waves in milliseconds', '0')
    .action(async (options) => {
      try {
        const execution = new WaveExecution();

        if (options.plan) {
          // Load plan from file
          const fs = await import('fs');
          const content = fs.readFileSync(options.plan, 'utf-8');
          const planData = JSON.parse(content);
          // Note: Plan deserialization would need to reconstruct task functions
          console.log(chalk.yellow('Plan file loading not fully implemented'));
          return;
        }

        // Load tasks from file or use example
        let tasks: CreateTaskOptions[];
        if (options.file) {
          const fs = await import('fs');
          const content = fs.readFileSync(options.file, 'utf-8');
          tasks = JSON.parse(content);
        } else {
          tasks = createExampleTasks();
          console.log(chalk.blue('Using example tasks (use -f to specify a file)'));
        }

        // Add tasks
        execution.addTasks(tasks);

        // Create plan
        execution.createPlan();

        // Execution options
        const execOptions: ExecutionOptions = {
          maxConcurrency: parseInt(options.concurrency, 10),
          continueOnFailure: options.continueOnFailure,
          globalTimeoutMs: parseInt(options.timeout, 10),
          waveDelayMs: parseInt(options.delay, 10),
          onWaveStart: (wave) => {
            console.log(chalk.yellow(`\n▶ Starting wave ${wave.number} (${wave.tasks.length} tasks)`));
          },
          onWaveComplete: (wave) => {
            const status = wave.status === 'completed'
              ? chalk.green('✓')
              : chalk.red('✗');
            console.log(chalk.gray(`${status} Wave ${wave.number} ${wave.status}`));
          },
          onTaskComplete: (task, result) => {
            console.log(chalk.green(`  ✓ ${task.name} (${result.durationMs}ms)`));
          },
          onTaskFailed: (task, error) => {
            console.log(chalk.red(`  ✗ ${task.name}: ${error.message}`));
          },
        };

        console.log(chalk.cyan('\nExecuting plan...'));
        const startTime = Date.now();

        const result = await execution.execute(execOptions);

        const duration = Date.now() - startTime;

        // Summary
        console.log(chalk.cyan('\n─────────────────────────'));
        if (result.success) {
          console.log(chalk.green('✓ Execution completed successfully'));
        } else {
          console.log(chalk.red('✗ Execution failed'));
        }
        console.log(chalk.gray(`  Duration: ${duration}ms`));
        console.log(chalk.gray(`  Completed: ${result.taskResults.size - result.failedTasks.length} tasks`));
        if (result.failedTasks.length > 0) {
          console.log(chalk.red(`  Failed: ${result.failedTasks.length} tasks`));
        }
        if (result.skippedTasks.length > 0) {
          console.log(chalk.yellow(`  Skipped: ${result.skippedTasks.length} tasks`));
        }

        process.exit(result.success ? 0 : 1);
      } catch (error) {
        logger.error('Execution failed', error);
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Validate command - check for cycles and other issues
  wave
    .command('validate')
    .description('Validate task dependencies')
    .option('-f, --file <file>', 'Task definition file (JSON)')
    .action(async (options) => {
      try {
        const execution = new WaveExecution();

        let tasks: CreateTaskOptions[];
        if (options.file) {
          const fs = await import('fs');
          const content = fs.readFileSync(options.file, 'utf-8');
          tasks = JSON.parse(content);
        } else {
          tasks = createExampleTasks();
          console.log(chalk.blue('Using example tasks (use -f to specify a file)'));
        }

        execution.addTasks(tasks);

        const validation = execution.validateDependencies();

        if (validation.valid) {
          console.log(chalk.green('✓ Dependencies are valid (no cycles detected)'));
        } else {
          console.log(chalk.red('✗ Invalid dependencies:'));
          console.log(chalk.red(`  ${validation.error}`));
          process.exit(1);
        }

        // Also validate plan
        execution.createPlan();
        const planValidation = execution.validatePlan();

        if (planValidation.valid) {
          console.log(chalk.green('✓ Plan is valid'));
        } else {
          console.log(chalk.red('✗ Plan validation failed:'));
          for (const error of planValidation.errors) {
            console.log(chalk.red(`  - ${error}`));
          }
          process.exit(1);
        }
      } catch (error) {
        logger.error('Validation failed', error);
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Visualize command - show dependency graph
  wave
    .command('visualize')
    .description('Visualize task dependencies')
    .option('-f, --file <file>', 'Task definition file (JSON)')
    .option('--critical-path', 'Highlight critical path')
    .action(async (options) => {
      try {
        const execution = new WaveExecution();

        let tasks: CreateTaskOptions[];
        if (options.file) {
          const fs = await import('fs');
          const content = fs.readFileSync(options.file, 'utf-8');
          tasks = JSON.parse(content);
        } else {
          tasks = createExampleTasks();
          console.log(chalk.blue('Using example tasks (use -f to specify a file)'));
        }

        execution.addTasks(tasks);
        execution.createPlan();

        const criticalPath = options.criticalPath
          ? new Set(execution.getCriticalPath())
          : new Set<string>();

        console.log(chalk.cyan('\nDependency Graph:'));
        console.log(chalk.gray('(Tasks grouped by wave)'));

        const plan = execution.getPlan();
        if (plan) {
          for (const wave of plan.waves) {
            console.log(chalk.yellow(`\nWave ${wave.number}:`));
            for (const task of wave.tasks) {
              const isCritical = criticalPath.has(task.id);
              const marker = isCritical ? chalk.red('★') : ' ';
              const deps = task.dependencies.length > 0
                ? chalk.gray(` ← ${task.dependencies.join(', ')}`)
                : chalk.gray(' (root)');
              console.log(`  ${marker} ${task.name}${deps}`);
            }
          }

          if (options.criticalPath) {
            console.log(chalk.red('\n★ = on critical path'));
          }
        }
      } catch (error) {
        logger.error('Visualization failed', error);
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Example command - generate example task file
  wave
    .command('example')
    .description('Generate an example task definition file')
    .option('-o, --output <file>', 'Output file', 'wave-example.json')
    .action(async (options) => {
      try {
        const fs = await import('fs');
        const tasks = createExampleTaskDefinitions();
        fs.writeFileSync(options.output, JSON.stringify(tasks, null, 2));
        console.log(chalk.green(`✓ Example tasks written to ${options.output}`));
        console.log(chalk.gray('Note: Task definitions need execute functions to be runnable.'));
        console.log(chalk.gray('Use the JavaScript API for full functionality.'));
      } catch (error) {
        logger.error('Failed to create example', error);
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  return wave;
}

/**
 * Create example tasks for demonstration
 */
function createExampleTasks(): CreateTaskOptions[] {
  return [
    {
      id: 'task-1',
      name: 'Setup Environment',
      description: 'Initialize the build environment',
      dependencies: [],
      priority: 10,
      execute: async () => {
        await delay(100);
        return { success: true, data: 'Environment ready', durationMs: 100 };
      },
    },
    {
      id: 'task-2',
      name: 'Install Dependencies',
      description: 'Install npm packages',
      dependencies: ['task-1'],
      priority: 9,
      execute: async () => {
        await delay(200);
        return { success: true, data: 'Dependencies installed', durationMs: 200 };
      },
    },
    {
      id: 'task-3',
      name: 'Lint Code',
      description: 'Run ESLint',
      dependencies: ['task-2'],
      priority: 5,
      execute: async () => {
        await delay(150);
        return { success: true, data: 'No lint errors', durationMs: 150 };
      },
    },
    {
      id: 'task-4',
      name: 'Type Check',
      description: 'Run TypeScript compiler',
      dependencies: ['task-2'],
      priority: 5,
      execute: async () => {
        await delay(180);
        return { success: true, data: 'Type check passed', durationMs: 180 };
      },
    },
    {
      id: 'task-5',
      name: 'Run Tests',
      description: 'Execute test suite',
      dependencies: ['task-3', 'task-4'],
      priority: 8,
      execute: async () => {
        await delay(300);
        return { success: true, data: 'All tests passed', durationMs: 300 };
      },
    },
    {
      id: 'task-6',
      name: 'Build Project',
      description: 'Compile production build',
      dependencies: ['task-2'],
      priority: 7,
      execute: async () => {
        await delay(250);
        return { success: true, data: 'Build complete', durationMs: 250 };
      },
    },
    {
      id: 'task-7',
      name: 'Deploy',
      description: 'Deploy to production',
      dependencies: ['task-5', 'task-6'],
      priority: 10,
      execute: async () => {
        await delay(150);
        return { success: true, data: 'Deployment successful', durationMs: 150 };
      },
    },
  ];
}

/**
 * Create example task definitions (without execute functions for JSON serialization)
 */
function createExampleTaskDefinitions(): Array<{
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  priority: number;
}> {
  return [
    {
      id: 'task-1',
      name: 'Setup Environment',
      description: 'Initialize the build environment',
      dependencies: [],
      priority: 10,
    },
    {
      id: 'task-2',
      name: 'Install Dependencies',
      description: 'Install npm packages',
      dependencies: ['task-1'],
      priority: 9,
    },
    {
      id: 'task-3',
      name: 'Lint Code',
      description: 'Run ESLint',
      dependencies: ['task-2'],
      priority: 5,
    },
    {
      id: 'task-4',
      name: 'Type Check',
      description: 'Run TypeScript compiler',
      dependencies: ['task-2'],
      priority: 5,
    },
    {
      id: 'task-5',
      name: 'Run Tests',
      description: 'Execute test suite',
      dependencies: ['task-3', 'task-4'],
      priority: 8,
    },
    {
      id: 'task-6',
      name: 'Build Project',
      description: 'Compile production build',
      dependencies: ['task-2'],
      priority: 7,
    },
    {
      id: 'task-7',
      name: 'Deploy',
      description: 'Deploy to production',
      dependencies: ['task-5', 'task-6'],
      priority: 10,
    },
  ];
}

/**
 * Utility delay function
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default createWaveCommand;
