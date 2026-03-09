/**
 * PLAN.md CLI Integration
 *
 * CLI commands for parsing, validating, and executing PLAN.md files.
 * Integrates with the swarm-cli command structure.
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';

import { PlanParser } from './parser';
import { PlanValidator } from './validator';
import { PlanExecutor } from './executor';
import type {
  PlanExecuteOptions,
  PlanValidateOptions,
  ExecutionContext,
  ExecutionOptions,
  ProgressEvent,
} from './types';

// ============================================================================
// ANSI Color Helpers (avoid ESM chalk issues)
// ============================================================================

const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

// ============================================================================
// CLI Commands
// ============================================================================

/**
 * Create the 'plan' command group
 */
export function createPlanCommand(): Command {
  const planCmd = new Command('plan')
    .description('PLAN.md management commands');

  // Parse command
  planCmd
    .command('parse')
    .description('Parse a PLAN.md file and display structure')
    .argument('<file>', 'Path to PLAN.md file')
    .option('-f, --format <format>', 'Output format (human|json)', 'human')
    .action(handleParse);

  // Validate command
  planCmd
    .command('validate')
    .description('Validate a PLAN.md file')
    .argument('<file>', 'Path to PLAN.md file')
    .option('-f, --format <format>', 'Output format (human|json)', 'human')
    .option('-s, --strict', 'Treat warnings as errors', false)
    .action(handleValidate);

  // Execute command
  planCmd
    .command('execute')
    .description('Execute a PLAN.md file')
    .argument('<file>', 'Path to PLAN.md file')
    .option('-d, --dry-run', 'Validate only, do not execute', false)
    .option('--stop-on-failure', 'Stop on first failure', true)
    .option('-t, --timeout <seconds>', 'Task timeout in seconds', '300')
    .option('-f, --format <format>', 'Output format (human|json)', 'human')
    .option('-v, --verbose', 'Verbose output', false)
    .action(handleExecute);

  // List command
  planCmd
    .command('list')
    .description('List tasks in a PLAN.md file')
    .argument('<file>', 'Path to PLAN.md file')
    .option('-f, --format <format>', 'Output format (human|json)', 'human')
    .action(handleList);

  return planCmd;
}

// ============================================================================
// Command Handlers
// ============================================================================

async function handleParse(file: string, options: { format: string }): Promise<void> {
  try {
    const content = await fs.readFile(file, 'utf-8');
    const parser = new PlanParser();
    const result = parser.parse(content, file);

    if (!result.success) {
      console.error(colors.red('Parse failed:'));
      for (const error of result.errors) {
        console.error(colors.red(`  [${error.code}] ${error.message}`));
        if (error.line) {
          console.error(colors.gray(`    at line ${error.line}`));
        }
      }
      process.exit(1);
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(result.plan, null, 2));
    } else {
      printPlanHumanReadable(result.plan!);
    }

    if (result.warnings.length > 0) {
      console.warn(colors.yellow('\nWarnings:'));
      for (const warning of result.warnings) {
        console.warn(colors.yellow(`  [${warning.code}] ${warning.message}`));
      }
    }
  } catch (error) {
    console.error(colors.red(`Error reading file: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}

async function handleValidate(file: string, options: PlanValidateOptions): Promise<void> {
  try {
    const content = await fs.readFile(file, 'utf-8');
    const parser = new PlanParser();
    const parseResult = parser.parse(content, file);

    if (!parseResult.success) {
      console.error(colors.red('Parse failed:'));
      for (const error of parseResult.errors) {
        console.error(colors.red(`  [${error.code}] ${error.message}`));
      }
      process.exit(1);
    }

    const validator = new PlanValidator();
    const validation = validator.validate(parseResult.plan!);

    if (options.format === 'json') {
      console.log(JSON.stringify(validation, null, 2));
    } else {
      printValidationResult(validation);
    }

    const hasErrors = validation.errors.length > 0;
    const hasWarnings = validation.warnings.length > 0;

    if (hasErrors || (options.strict && hasWarnings)) {
      process.exit(1);
    }

    console.log(colors.green('\nValidation passed!'));
  } catch (error) {
    console.error(colors.red(`Error: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}

async function handleExecute(file: string, options: PlanExecuteOptions): Promise<void> {
  try {
    // Parse the plan
    const content = await fs.readFile(file, 'utf-8');
    const parser = new PlanParser();
    const parseResult = parser.parse(content, file);

    if (!parseResult.success) {
      console.error(colors.red('Parse failed:'));
      for (const error of parseResult.errors) {
        console.error(colors.red(`  [${error.code}] ${error.message}`));
      }
      process.exit(1);
    }

    const plan = parseResult.plan!;

    // Validate before execution
    const validator = new PlanValidator();
    const validation = validator.validate(plan);

    if (!validation.valid) {
      console.error(colors.red('Validation failed:'));
      for (const error of validation.errors) {
        console.error(colors.red(`  [${error.code}] ${error.message}`));
      }
      process.exit(1);
    }

    // Build execution context
    const execOptions: ExecutionOptions = {
      stopOnFailure: options.stopOnFailure ?? true,
      maxConcurrency: 1,
      taskTimeout: (options.timeout ?? 300) * 1000,
      captureOutput: true,
    };

    const context: ExecutionContext = {
      workingDir: process.cwd(),
      env: process.env as Record<string, string>,
      dryRun: options.dryRun ?? false,
      options: execOptions,
    };

    // Execute
    const executor = new PlanExecutor();

    if (options.format === 'json') {
      const result = await executor.execute(plan, context);
      console.log(JSON.stringify(result, null, 2));

      if (result.state !== 'completed') {
        process.exit(1);
      }
    } else {
      console.log(colors.blue(`Executing plan: ${plan.metadata.phase}-${plan.metadata.plan}`));
      console.log(colors.gray(`Objective: ${plan.objective.substring(0, 100)}...`));
      console.log();

      const result = await executor.execute(plan, context, (event: ProgressEvent) => {
        printProgressEvent(event, options.verbose ?? false);
      });

      console.log();

      if (result.state === 'completed') {
        console.log(colors.green(`Execution completed in ${result.duration}ms`));
        console.log(colors.gray(`Tasks: ${result.taskResults.length}`));
      } else {
        console.error(colors.red(`Execution failed: ${result.error?.message || 'Unknown error'}`));
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(colors.red(`Error: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}

async function handleList(file: string, options: { format: string }): Promise<void> {
  try {
    const content = await fs.readFile(file, 'utf-8');
    const parser = new PlanParser();
    const result = parser.parse(content, file);

    if (!result.success) {
      console.error(colors.red('Parse failed:'));
      for (const error of result.errors) {
        console.error(colors.red(`  [${error.code}] ${error.message}`));
      }
      process.exit(1);
    }

    const plan = result.plan!;

    if (options.format === 'json') {
      console.log(JSON.stringify(plan.tasks, null, 2));
    } else {
      console.log(colors.blue(`Tasks in ${plan.metadata.phase}-${plan.metadata.plan}:`));
      console.log();

      for (const task of plan.tasks) {
        const typeColor = task.type === 'auto' ? colors.green :
                         task.type === 'manual' ? colors.yellow :
                         colors.cyan;

        console.log(`  ${colors.bold(task.id)}: ${task.name}`);
        console.log(`    Type: ${typeColor(task.type)}${task.tdd ? colors.magenta(' [TDD]') : ''}`);
        console.log(`    Files: ${task.files.join(', ') || 'none'}`);
        console.log(`    Done: ${task.done}`);
        console.log();
      }
    }
  } catch (error) {
    console.error(colors.red(`Error reading file: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}

// ============================================================================
// Output Formatting
// ============================================================================

function printPlanHumanReadable(plan: ReturnType<PlanParser['parse']> extends Promise<infer R> ? (R extends { plan?: infer P } ? P : never) : never): void {
  if (!plan) return;

  console.log(colors.blue.bold(`Plan: ${plan.metadata.phase}-${plan.metadata.plan}`));
  console.log(colors.gray(`Type: ${plan.metadata.type} | Wave: ${plan.metadata.wave} | Autonomous: ${plan.metadata.autonomous}`));
  console.log();

  console.log(colors.yellow('Objective:'));
  console.log(plan.objective);
  console.log();

  if (plan.context.length > 0) {
    console.log(colors.yellow('Context:'));
    for (const ctx of plan.context) {
      console.log(`  - ${ctx}`);
    }
    console.log();
  }

  console.log(colors.yellow(`Tasks (${plan.tasks.length}):`));
  for (const task of plan.tasks) {
    console.log(`  ${colors.bold(task.id)}: ${task.name}`);
  }
  console.log();

  if (plan.verification.length > 0) {
    console.log(colors.yellow('Verification:'));
    for (const item of plan.verification) {
      console.log(`  [ ] ${item}`);
    }
    console.log();
  }

  console.log(colors.yellow('Success Criteria:'));
  console.log(plan.successCriteria);
}

function printValidationResult(validation: ReturnType<PlanValidator['validate']>): void {
  console.log(colors.blue.bold('Validation Result'));
  console.log();

  if (validation.valid) {
    console.log(colors.green('Status: VALID'));
  } else {
    console.log(colors.red('Status: INVALID'));
  }

  if (validation.errors.length > 0) {
    console.log();
    console.log(colors.red(`Errors (${validation.errors.length}):`));
    for (const error of validation.errors) {
      console.log(colors.red(`  [${error.code}] ${error.message}`));
      if (error.taskId) {
        console.log(colors.gray(`    Task: ${error.taskId}`));
      }
      if (error.field) {
        console.log(colors.gray(`    Field: ${error.field}`));
      }
    }
  }

  if (validation.warnings.length > 0) {
    console.log();
    console.log(colors.yellow(`Warnings (${validation.warnings.length}):`));
    for (const warning of validation.warnings) {
      console.log(colors.yellow(`  [${warning.code}] ${warning.message}`));
      if (warning.taskId) {
        console.log(colors.gray(`    Task: ${warning.taskId}`));
      }
    }
  }

  console.log();
  console.log(colors.blue('Dependency Graph:'));
  console.log(`  Execution order: ${validation.dependencies.ordered.join(' -> ')}`);

  if (validation.dependencies.cycles.length > 0) {
    console.log(colors.red(`  Cycles detected: ${validation.dependencies.cycles.length}`));
  }

  if (validation.dependencies.orphaned.length > 0) {
    console.log(colors.yellow(`  Orphaned tasks: ${validation.dependencies.orphaned.join(', ')}`));
  }
}

function printProgressEvent(event: ProgressEvent, verbose: boolean): void {
  const timestamp = event.timestamp.toISOString().split('T')[1].split('.')[0];
  const prefix = colors.gray(`[${timestamp}]`);

  switch (event.type) {
    case 'start':
      console.log(`${prefix} ${colors.blue('▶')} ${event.message}`);
      break;
    case 'task-start':
      if (verbose) {
        console.log(`${prefix} ${colors.blue('→')} ${event.message}`);
      } else {
        process.stdout.write(colors.blue('.'));
      }
      break;
    case 'task-complete':
      if (verbose) {
        console.log(`${prefix} ${colors.green('✓')} ${event.message}`);
      }
      break;
    case 'task-fail':
      console.log();
      console.log(`${prefix} ${colors.red('✗')} ${event.message}`);
      break;
    case 'complete':
      if (!verbose) console.log();
      console.log(`${prefix} ${colors.green('✓')} ${event.message}`);
      break;
    case 'fail':
      if (!verbose) console.log();
      console.log(`${prefix} ${colors.red('✗')} ${event.message}`);
      break;
    default:
      if (verbose) {
        console.log(`${prefix} ${event.message}`);
      }
  }
}

// ============================================================================
// Export for CLI Integration
// ============================================================================

export { handleParse, handleValidate, handleExecute, handleList };
