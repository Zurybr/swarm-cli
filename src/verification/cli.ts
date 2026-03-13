/**
 * Verification CLI Commands
 *
 * CLI integration for the goal-backward verification system.
 * Provides commands for verifying goals, managing must-haves, and generating reports.
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  VerificationSystem,
  createVerificationSystem,
  existenceMustHave,
  valueMustHave,
  structureMustHave,
  relationMustHave,
  FixPlanGenerator,
} from './index';
import type {
  VerifyCommandOptions,
  GoalsCommandOptions,
  CreateGoalCommandOptions,
  ReportFormat,
  Goal,
  VerificationResult,
} from './types';

// ============================================================================
// ANSI Color Helpers
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

// Chained color helpers
const boldBlue = (text: string) => colors.bold(colors.blue(text));
const boldYellow = (text: string) => colors.bold(colors.yellow(text));

// ============================================================================
// CLI State
// ============================================================================

let verificationSystem: VerificationSystem | null = null;

/**
 * Get or create the verification system instance
 */
function getSystem(): VerificationSystem {
  if (!verificationSystem) {
    verificationSystem = createVerificationSystem({
      workingDir: process.cwd(),
    });
  }
  return verificationSystem;
}

/**
 * Load goals from a JSON file
 */
async function loadGoalsFromFile(filePath: string): Promise<Goal[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(content);

  if (Array.isArray(data)) {
    return data;
  } else if (data.goals) {
    return data.goals;
  }

  return [data];
}

/**
 * Save goals to a JSON file
 */
async function saveGoalsToFile(filePath: string, goals: Goal[]): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(goals, null, 2), 'utf-8');
}

// ============================================================================
// Command Handlers
// ============================================================================

/**
 * Handle the 'verify' command
 */
async function handleVerify(
  target: string,
  options: VerifyCommandOptions
): Promise<void> {
  const system = getSystem();

  try {
    // Check if target is a file
    let isFile = false;
    try {
      const stats = await fs.stat(target);
      isFile = stats.isFile();
    } catch {
      isFile = false;
    }

    let results;

    if (isFile) {
      // Load goals from file and verify all
      const goals = await loadGoalsFromFile(target);

      // Clear existing goals and load new ones
      system.getGoalManager().clear();
      for (const goal of goals) {
        system.getGoalManager().createGoal({
          title: goal.title,
          description: goal.description,
          mustHaves: goal.mustHaves,
          priority: goal.priority,
          tags: goal.tags,
          owner: goal.owner,
          metadata: goal.metadata,
        });
      }

      results = await system.verifyAll();
    } else {
      // Verify a single goal by ID
      const result = await system.verify(target);
      results = [result];
    }

    // Generate report
    const format = options.format || 'console';
    const verbose = options.verbose || false;

    if (options.output) {
      await system.writeReport({
        format,
        outputPath: options.output,
        includeDetails: verbose,
        includeRemediation: true,
      });
      console.log(colors.green(`Report written to: ${options.output}`));
    } else {
      console.log(system.generateReport(format, verbose));
    }

    // Exit with error code if any goal failed
    const hasFailures = results.some((r) => !r.achieved);
    if (hasFailures) {
      process.exit(1);
    }
  } catch (error) {
    console.error(
      colors.red(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

/**
 * Handle the 'goals' list command
 */
async function handleGoalsList(options: GoalsCommandOptions): Promise<void> {
  const system = getSystem();

  try {
    let goals = system.listGoals();

    if (options.status) {
      goals = goals.filter((g) => g.status === options.status);
    }

    if (options.tags && options.tags.length > 0) {
      goals = goals.filter((g) =>
        options.tags!.some((tag) => g.tags?.includes(tag))
      );
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(goals, null, 2));
      return;
    }

    // Console output
    console.log(boldBlue('\n📋 Goals\n'));

    if (goals.length === 0) {
      console.log(colors.gray('No goals found.'));
      return;
    }

    for (const goal of goals) {
      const statusColor =
        goal.status === 'verified'
          ? colors.green
          : goal.status === 'failed'
          ? colors.red
          : goal.status === 'partial'
          ? colors.yellow
          : colors.gray;

      console.log(`  ${colors.bold(goal.id)}: ${goal.title}`);
      console.log(`    Status: ${statusColor(goal.status)}`);
      console.log(`    Must-Haves: ${goal.mustHaves.length}`);

      if (options.verbose) {
        console.log(`    Description: ${goal.description}`);
        if (goal.tags?.length) {
          console.log(`    Tags: ${goal.tags.join(', ')}`);
        }
        if (goal.owner) {
          console.log(`    Owner: ${goal.owner}`);
        }
      }

      console.log();
    }
  } catch (error) {
    console.error(
      colors.red(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

/**
 * Handle the 'goals create' command
 */
async function handleGoalsCreate(
  options: CreateGoalCommandOptions
): Promise<void> {
  const system = getSystem();

  try {
    // Parse must-haves if provided
    let mustHaves = [];
    if (options.mustHaves) {
      try {
        // Try to parse as JSON
        mustHaves = JSON.parse(options.mustHaves);
      } catch {
        // Try to read as file
        const content = await fs.readFile(options.mustHaves, 'utf-8');
        mustHaves = JSON.parse(content);
      }
    }

    const goal = system.createGoal({
      title: options.title,
      description: options.description,
      mustHaves,
      parentId: options.parent,
      priority: options.priority,
      tags: options.tags,
      owner: options.owner,
    });

    if (options.output) {
      await saveGoalsToFile(options.output, [goal]);
      console.log(colors.green(`Goal saved to: ${options.output}`));
    } else {
      console.log(colors.green('Goal created:'));
      console.log(JSON.stringify(goal, null, 2));
    }
  } catch (error) {
    console.error(
      colors.red(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

/**
 * Handle the 'goals show' command
 */
async function handleGoalsShow(
  goalId: string,
  options: { format?: ReportFormat }
): Promise<void> {
  const system = getSystem();

  try {
    const goal = system.getGoal(goalId);
    if (!goal) {
      console.error(colors.red(`Goal not found: ${goalId}`));
      process.exit(1);
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(goal, null, 2));
      return;
    }

    console.log(boldBlue(`\n📋 Goal: ${goal.title}\n`));
    console.log(`  ID: ${goal.id}`);
    console.log(`  Status: ${goal.status}`);
    console.log(`  Description: ${goal.description}`);
    console.log(`  Priority: ${goal.priority}`);
    console.log(`  Must-Haves: ${goal.mustHaves.length}`);

    if (goal.tags?.length) {
      console.log(`  Tags: ${goal.tags.join(', ')}`);
    }

    if (goal.owner) {
      console.log(`  Owner: ${goal.owner}`);
    }

    if (goal.parentId) {
      console.log(`  Parent: ${goal.parentId}`);
    }

    if (goal.children?.length) {
      console.log(`  Children: ${goal.children.join(', ')}`);
    }

    console.log(boldYellow('\n  Must-Haves:\n'));
    for (const mh of goal.mustHaves) {
      const statusIcon =
        mh.status === 'satisfied'
          ? colors.green('✓')
          : mh.status === 'failed'
          ? colors.red('✗')
          : colors.gray('○');
      const requiredTag = mh.required
        ? colors.red('[required]')
        : colors.gray('[optional]');

      console.log(`    ${statusIcon} ${mh.description} ${requiredTag}`);
      console.log(`       Type: ${mh.type}, Target: ${mh.target}`);

      if (mh.expected !== undefined) {
        console.log(`       Expected: ${JSON.stringify(mh.expected)}`);
      }
    }

    console.log();
  } catch (error) {
    console.error(
      colors.red(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

/**
 * Handle the 'goals delete' command
 */
async function handleGoalsDelete(goalId: string): Promise<void> {
  const system = getSystem();

  try {
    const deleted = system.deleteGoal(goalId);
    if (deleted) {
      console.log(colors.green(`Goal deleted: ${goalId}`));
    } else {
      console.error(colors.red(`Goal not found: ${goalId}`));
      process.exit(1);
    }
  } catch (error) {
    console.error(
      colors.red(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

// ============================================================================
// Command Creation
// ============================================================================

/**
 * Create the 'verify' command
 */
function createVerifyCommand(): Command {
  const verifyCmd = new Command('verify')
    .description('Verify goals using backward verification')
    .argument('<target>', 'Goal ID or goals file to verify')
    .option('-f, --format <format>', 'Output format (json|markdown|html|console)', 'console')
    .option('-o, --output <file>', 'Output file path')
    .option('--stop-on-failure', 'Stop on first failure', false)
    .option('-v, --verbose', 'Verbose output', false)
    .option('-t, --timeout <seconds>', 'Check timeout in seconds', '30')
    .option('--tags <tags>', 'Filter by tags (comma-separated)')
    .option('--min-severity <severity>', 'Minimum severity to report (critical|major|minor|info)')
    .action(handleVerify);

  return verifyCmd;
}

/**
 * Create the 'goals' command group
 */
function createGoalsCommand(): Command {
  const goalsCmd = new Command('goals')
    .description('Manage verification goals');

  // List command
  goalsCmd
    .command('list')
    .description('List all goals')
    .option('-s, --status <status>', 'Filter by status')
    .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
    .option('-f, --format <format>', 'Output format (human|json)', 'human')
    .option('-v, --verbose', 'Show detailed information', false)
    .action(handleGoalsList);

  // Create command
  goalsCmd
    .command('create')
    .description('Create a new goal')
    .requiredOption('--title <title>', 'Goal title')
    .requiredOption('--description <description>', 'Goal description')
    .option('-m, --must-haves <file|json>', 'Must-have criteria (JSON string or file path)')
    .option('-p, --parent <id>', 'Parent goal ID')
    .option('--priority <number>', 'Priority level', '0')
    .option('--tags <tags>', 'Tags (comma-separated)')
    .option('--owner <name>', 'Goal owner')
    .option('-o, --output <file>', 'Save goal to file')
    .action(handleGoalsCreate);

  // Show command
  goalsCmd
    .command('show')
    .description('Show goal details')
    .argument('<goalId>', 'Goal ID')
    .option('-f, --format <format>', 'Output format (human|json)', 'human')
    .action(handleGoalsShow);

  // Delete command
  goalsCmd
    .command('delete')
    .description('Delete a goal')
    .argument('<goalId>', 'Goal ID')
    .action(handleGoalsDelete);

  return goalsCmd;
}

/**
 * Create the 'must-have' command group
 */
function createMustHaveCommand(): Command {
  const mhCmd = new Command('must-have')
    .alias('mh')
    .description('Manage must-have criteria');

  // Add existence must-have
  mhCmd
    .command('add-existence')
    .description('Add an existence-type must-have to a goal')
    .argument('<goalId>', 'Goal ID')
    .requiredOption('-t, --target <path>', 'Target path to check')
    .requiredOption('-d, --description <text>', 'Description of the requirement')
    .option('--optional', 'Mark as optional (not required)')
    .option('-w, --weight <number>', 'Weight for completion calculation', '1.0')
    .action(async (goalId, options) => {
      const system = getSystem();
      const mustHave = existenceMustHave(options.target, options.description, {
        required: !options.optional,
        weight: parseFloat(options.weight),
      });

      const goal = system.addMustHave(goalId, mustHave);
      if (goal) {
        console.log(colors.green(`Added must-have to goal: ${goalId}`));
      } else {
        console.error(colors.red(`Goal not found: ${goalId}`));
        process.exit(1);
      }
    });

  // Add value must-have
  mhCmd
    .command('add-value')
    .description('Add a value-type must-have to a goal')
    .argument('<goalId>', 'Goal ID')
    .requiredOption('-t, --target <path>', 'Target path or variable')
    .requiredOption('-d, --description <text>', 'Description of the requirement')
    .requiredOption('-e, --expected <value>', 'Expected value')
    .option('-o, --operator <op>', 'Comparison operator', 'equals')
    .option('--optional', 'Mark as optional')
    .option('-w, --weight <number>', 'Weight', '1.0')
    .action(async (goalId, options) => {
      const system = getSystem();
      const mustHave = valueMustHave(
        options.target,
        options.description,
        options.expected,
        options.operator,
        {
          required: !options.optional,
          weight: parseFloat(options.weight),
        }
      );

      const goal = system.addMustHave(goalId, mustHave);
      if (goal) {
        console.log(colors.green(`Added value must-have to goal: ${goalId}`));
      } else {
        console.error(colors.red(`Goal not found: ${goalId}`));
        process.exit(1);
      }
    });

  // Add structure must-have
  mhCmd
    .command('add-structure')
    .description('Add a structure-type must-have to a goal')
    .argument('<goalId>', 'Goal ID')
    .requiredOption('-t, --target <path>', 'Target path')
    .requiredOption('-d, --description <text>', 'Description')
    .requiredOption('-e, --expected <schema>', 'Expected structure (JSON or type name)')
    .option('--optional', 'Mark as optional')
    .option('-w, --weight <number>', 'Weight', '1.0')
    .action(async (goalId, options) => {
      const system = getSystem();
      let expected: unknown = options.expected;
      try {
        expected = JSON.parse(options.expected);
      } catch {
        // Keep as string
      }

      const mustHave = structureMustHave(options.target, options.description, expected, {
        required: !options.optional,
        weight: parseFloat(options.weight),
      });

      const goal = system.addMustHave(goalId, mustHave);
      if (goal) {
        console.log(colors.green(`Added structure must-have to goal: ${goalId}`));
      } else {
        console.error(colors.red(`Goal not found: ${goalId}`));
        process.exit(1);
      }
    });

  // Add relation must-have
  mhCmd
    .command('add-relation')
    .description('Add a relation-type must-have to a goal')
    .argument('<goalId>', 'Goal ID')
    .requiredOption('-t, --target <path>', 'Source target')
    .requiredOption('-r, --related <path>', 'Related target')
    .requiredOption('--relation-type <type>', 'Relation type (depends_on|references|contains|extends)')
    .requiredOption('-d, --description <text>', 'Description')
    .option('--optional', 'Mark as optional')
    .option('-w, --weight <number>', 'Weight', '1.0')
    .action(async (goalId, options) => {
      const system = getSystem();
      const mustHave = relationMustHave(
        options.target,
        options.related,
        options.relationType,
        options.description,
        {
          required: !options.optional,
          weight: parseFloat(options.weight),
        }
      );

      const goal = system.addMustHave(goalId, mustHave);
      if (goal) {
        console.log(colors.green(`Added relation must-have to goal: ${goalId}`));
      } else {
        console.error(colors.red(`Goal not found: ${goalId}`));
        process.exit(1);
      }
    });

  return mhCmd;
}

// ============================================================================
// Fix Plan Commands
// ============================================================================

/**
 * Create the 'fix-plan' command
 */
function createFixPlanCommand(): Command {
  const fpCmd = new Command('fix-plan')
    .description('Generate fix plans from verification gaps (Issue #18)')
    .option('-o, --output <dir>', 'Output directory for fix plans', './.planning/fixes')
    .option('-p, --phase <name>', 'Phase name for metadata', 'unknown')
    .option('-f, --format <format>', 'Output format (yaml|json|summary)', 'yaml')
    .option('--from-results <file>', 'Load verification results from JSON file')
    .option('--from-goal <goalId>', 'Generate fix plan for a specific goal')
    .option('--save', 'Save fix plans to files', false)
    .action(async (options) => {
      try {
        const system = getSystem();
        const generator = new FixPlanGenerator({
          outputDir: options.output,
          phase: options.phase,
        });

        // Cargar resultados desde archivo si se especificó
        let results: VerificationResult[] = [];
        if (options.fromResults) {
          const content = await fs.readFile(options.fromResults, 'utf-8');
          results = JSON.parse(content);
        } else if (options.fromGoal) {
          const result = await system.verify(options.fromGoal);
          results = [result];
        } else {
          // Verificar todos los goals
          results = await system.verifyAll();
        }

        // Generar fix plans
        const fixPlans = generator.generateFixPlans(results);

        if (fixPlans.length === 0) {
          console.log(colors.green('✅ No gaps found! No fix plans needed.'));
          return;
        }

        // Mostrar resumen
        console.log(colors.bold('\n📋 Fix Plans Summary\n'));
        console.log(`Total Plans: ${fixPlans.length}`);
        console.log(`Total Fixes: ${fixPlans.reduce((sum, p) => sum + p.fixes.length, 0)}`);
        
        const summary = generator.generateSummary(fixPlans);
        console.log('\n' + summary);

        // Guardar o mostrar según formato
        if (options.save) {
          const savedPaths = await generator.saveFixPlans(fixPlans, options.output);
          console.log(colors.green(`\n✅ Saved ${savedPaths.length} fix plan(s) to ${options.output}`));
          for (const p of savedPaths) {
            console.log(colors.gray(`   - ${p}`));
          }
        } else {
          // Mostrar en consola
          console.log(colors.bold('\n📄 Fix Plans:\n'));
          for (const plan of fixPlans) {
            if (options.format === 'yaml') {
              console.log(generator.exportToYAML(plan));
            } else if (options.format === 'json') {
              console.log(JSON.stringify(plan, null, 2));
            }
          }
        }
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // Subcomando para generar fix plan consolidado
  fpCmd
    .command('consolidated')
    .description('Generate a single consolidated fix plan')
    .argument('<gaps-file>', 'JSON file with gaps array')
    .option('-o, --output <file>', 'Output file path')
    .option('-p, --phase <name>', 'Phase name', 'unknown')
    .option('--goal-id <id>', 'Goal ID for metadata')
    .action(async (gapsFile, options) => {
      try {
        const content = await fs.readFile(gapsFile, 'utf-8');
        const gaps = JSON.parse(content);

        const generator = new FixPlanGenerator({
          phase: options.phase,
        });

        const fixPlan = generator.generateConsolidatedFixPlan(
          gaps,
          options.goalId,
          'consolidated-fix'
        );

        const yaml = generator.exportToYAML(fixPlan);

        if (options.output) {
          await fs.writeFile(options.output, yaml, 'utf-8');
          console.log(colors.green(`✅ Saved consolidated fix plan to ${options.output}`));
        } else {
          console.log(yaml);
        }
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // Subcomando para estimar esfuerzo
  fpCmd
    .command('estimate')
    .description('Estimate effort for fix plans')
    .argument('<results-file>', 'JSON file with verification results')
    .action(async (resultsFile) => {
      try {
        const content = await fs.readFile(resultsFile, 'utf-8');
        const results = JSON.parse(content);

        const generator = new FixPlanGenerator();
        const fixPlans = generator.generateFixPlans(results);
        const effort = generator.estimateTotalEffort(fixPlans);

        console.log(colors.bold('\n📊 Effort Estimate\n'));
        console.log(`Total Fix Plans: ${fixPlans.length}`);
        console.log(`Total Fixes: ${fixPlans.reduce((sum, p) => sum + p.fixes.length, 0)}`);
        console.log(colors.yellow(`\nEstimated Effort: ${effort} hours`));
        console.log(colors.gray(`  (Based on priority-based weighting)`));
      } catch (error) {
        console.error(colors.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  return fpCmd;
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Create all verification-related CLI commands
 */
export function createVerificationCommands(): Command[] {
  return [
    createVerifyCommand(),
    createGoalsCommand(),
    createMustHaveCommand(),
    createFixPlanCommand(),
  ];
}

/**
 * Register verification commands with the main CLI program
 */
export function registerVerificationCommands(program: Command): void {
  const commands = createVerificationCommands();
  for (const cmd of commands) {
    program.addCommand(cmd);
  }
}

export { createVerifyCommand, createGoalsCommand, createMustHaveCommand, createFixPlanCommand };
