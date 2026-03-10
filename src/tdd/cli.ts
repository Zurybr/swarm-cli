/**
 * TDD CLI Commands
 *
 * Provides command-line interface for TDD operations.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { TDDSystem } from './index';
import type { TDDPlan, TestCase, TDDCyclePhase } from './types';
import { TDD_TEMPLATES, getTemplate, applyTemplate } from './template';

// ============================================================================
// CLI Setup
// ============================================================================

const program = new Command();

program
  .name('swarm tdd')
  .description('TDD (Test-Driven Development) plan management commands')
  .version('1.0.0');

// ============================================================================
// Plan Commands
// ============================================================================

program
  .command('create')
  .description('Create a new TDD plan')
  .option('-n, --name <name>', 'Plan name', 'Untitled TDD Plan')
  .option('-d, --description <desc>', 'Plan description', '')
  .option('-t, --template <template>', 'Template to use', 'standard')
  .option('-f, --files <files>', 'Target files (comma-separated)', '')
  .option('-o, --output <file>', 'Output file for plan JSON')
  .action(async (options) => {
    try {
      const system = new TDDSystem();
      const targetFiles = options.files ? options.files.split(',') : [];

      const plan = system.createPlan(
        options.template,
        options.name,
        options.description,
        targetFiles
      );

      console.log(chalk.green('✓ Created TDD plan:'), plan.id);
      console.log(chalk.gray('  Name:'), plan.name);
      console.log(chalk.gray('  Template:'), options.template);
      console.log(chalk.gray('  Target files:'), targetFiles.join(', ') || '(none)');

      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(plan, null, 2));
        console.log(chalk.gray('  Saved to:'), options.output);
      }
    } catch (error) {
      console.error(chalk.red('Error creating plan:'), error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all available TDD templates')
  .action(() => {
    console.log(chalk.bold('Available TDD Templates:'));
    console.log();

    for (const template of TDD_TEMPLATES) {
      console.log(chalk.cyan(`  ${template.name}`));
      console.log(chalk.gray(`    ${template.description}`));
      console.log();
    }
  });

program
  .command('show')
  .description('Show TDD plan details')
  .argument('<plan-file>', 'Path to plan JSON file')
  .action((planFile) => {
    try {
      if (!fs.existsSync(planFile)) {
        console.error(chalk.red('Plan file not found:'), planFile);
        process.exit(1);
      }

      const plan: TDDPlan = JSON.parse(fs.readFileSync(planFile, 'utf-8'));

      console.log(chalk.bold('TDD Plan:'), plan.name);
      console.log(chalk.gray('ID:'), plan.id);
      console.log(chalk.gray('Description:'), plan.description || '(none)');
      console.log();

      console.log(chalk.bold('Metadata:'));
      console.log(chalk.gray('  Version:'), plan.metadata.version);
      console.log(chalk.gray('  Target Coverage:'), `${plan.metadata.targetCoverage}%`);
      console.log(chalk.gray('  Enforce Coverage:'), plan.metadata.enforceCoverage ? 'Yes' : 'No');
      console.log(chalk.gray('  Tags:'), plan.metadata.tags.join(', ') || '(none)');
      console.log();

      console.log(chalk.bold('Target Files:'));
      if (plan.targetFiles.length === 0) {
        console.log(chalk.gray('  (none)'));
      } else {
        for (const file of plan.targetFiles) {
          console.log(chalk.gray('  -'), file);
        }
      }
      console.log();

      console.log(chalk.bold('Cycles:'), plan.cycles.length);
      console.log(chalk.bold('Test Cases:'), plan.testCases.length);
      console.log(chalk.bold('Coverage Reports:'), plan.coverageReports.length);
    } catch (error) {
      console.error(chalk.red('Error reading plan:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// Cycle Commands
// ============================================================================

program
  .command('cycle')
  .description('Manage TDD cycles')
  .option('-p, --plan <file>', 'Plan file', 'tdd-plan.json')
  .option('-s, --start', 'Start a new cycle')
  .option('-c, --complete', 'Complete current cycle')
  .option('-d, --description <desc>', 'Cycle description', 'New cycle')
  .option('--phase <phase>', 'Transition to phase (red|green|refactor)')
  .action(async (options) => {
    try {
      if (!fs.existsSync(options.plan)) {
        console.error(chalk.red('Plan file not found:'), options.plan);
        process.exit(1);
      }

      const system = new TDDSystem();
      const planData: TDDPlan = JSON.parse(fs.readFileSync(options.plan, 'utf-8'));

      // Restore plan to system
      system['state'].activePlans.set(planData.id, planData);

      if (options.start) {
        const cycle = await system.startCycle(planData.id, options.description);
        if (cycle) {
          console.log(chalk.green('✓ Started cycle'), cycle.number);
          console.log(chalk.gray('  Phase:'), cycle.phase);
          console.log(chalk.gray('  Description:'), cycle.description);

          // Save updated plan
          fs.writeFileSync(options.plan, JSON.stringify(planData, null, 2));
        }
      } else if (options.complete) {
        const cycle = await system.completeCycle(planData.id);
        if (cycle) {
          console.log(chalk.green('✓ Completed cycle'), cycle.number);
          console.log(chalk.gray('  Duration:'), `${cycle.phaseDurations.total}ms`);

          // Save updated plan
          fs.writeFileSync(options.plan, JSON.stringify(planData, null, 2));
        }
      } else if (options.phase) {
        const cycle = await system.transitionPhase(planData.id, options.phase as TDDCyclePhase);
        if (cycle) {
          console.log(chalk.green('✓ Transitioned to phase:'), cycle.phase);

          // Save updated plan
          fs.writeFileSync(options.plan, JSON.stringify(planData, null, 2));
        }
      } else {
        // Show current cycle status
        const currentCycle = system.getCurrentCycle(planData.id);
        if (currentCycle) {
          console.log(chalk.bold('Current Cycle:'), currentCycle.number);
          console.log(chalk.gray('  Phase:'), currentCycle.phase);
          console.log(chalk.gray('  Status:'), currentCycle.status);
          console.log(chalk.gray('  Description:'), currentCycle.description);
        } else {
          console.log(chalk.yellow('No active cycle'));
          console.log(chalk.gray('Use --start to begin a new cycle'));
        }
      }
    } catch (error) {
      console.error(chalk.red('Error managing cycle:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// Test Commands
// ============================================================================

program
  .command('test')
  .description('Manage test cases')
  .option('-p, --plan <file>', 'Plan file', 'tdd-plan.json')
  .option('-a, --add', 'Add a test case')
  .option('-t, --template <template>', 'Test template', 'jest-unit')
  .option('-n, --name <name>', 'Test name')
  .option('-f, --file <file>', 'Test file path')
  .option('-b, --behavior <behavior>', 'Expected behavior')
  .option('-l, --list', 'List all test cases')
  .action(async (options) => {
    try {
      if (!fs.existsSync(options.plan)) {
        console.error(chalk.red('Plan file not found:'), options.plan);
        process.exit(1);
      }

      const system = new TDDSystem();
      const planData: TDDPlan = JSON.parse(fs.readFileSync(options.plan, 'utf-8'));

      // Restore plan to system
      system['state'].activePlans.set(planData.id, planData);

      if (options.add) {
        if (!options.name || !options.file || !options.behavior) {
          console.error(chalk.red('Missing required options: --name, --file, --behavior'));
          process.exit(1);
        }

        const testCase = system.createTestCase(
          planData.id,
          options.template,
          options.file,
          {
            className: 'Example',
            methodName: options.name,
            expectedBehavior: options.behavior,
            arrange: '// Arrange',
            act: '// Act',
            assert: '// Assert',
          },
          { name: options.name }
        );

        if (testCase) {
          console.log(chalk.green('✓ Added test case:'), testCase.id);
          console.log(chalk.gray('  Name:'), testCase.name);
          console.log(chalk.gray('  File:'), testCase.file);

          // Save updated plan
          fs.writeFileSync(options.plan, JSON.stringify(planData, null, 2));
        }
      } else if (options.list) {
        console.log(chalk.bold('Test Cases:'));
        if (planData.testCases.length === 0) {
          console.log(chalk.gray('  (none)'));
        } else {
          for (const test of planData.testCases) {
            const statusIcon = getStatusIcon(test.status);
            console.log(`  ${statusIcon} ${test.name} (${test.type})`);
            console.log(chalk.gray(`     File: ${test.file}`));
            console.log(chalk.gray(`     Status: ${test.status}`));
          }
        }
      } else {
        // Show test statistics
        const stats = {
          total: planData.testCases.length,
          passed: planData.testCases.filter(t => t.status === 'passed').length,
          failed: planData.testCases.filter(t => t.status === 'failed').length,
          pending: planData.testCases.filter(t => t.status === 'pending' || t.status === 'draft').length,
        };

        console.log(chalk.bold('Test Statistics:'));
        console.log(chalk.gray('  Total:'), stats.total);
        console.log(chalk.green('  Passed:'), stats.passed);
        console.log(chalk.red('  Failed:'), stats.failed);
        console.log(chalk.yellow('  Pending:'), stats.pending);
      }
    } catch (error) {
      console.error(chalk.red('Error managing tests:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// Coverage Commands
// ============================================================================

program
  .command('coverage')
  .description('Coverage operations')
  .option('-p, --plan <file>', 'Plan file', 'tdd-plan.json')
  .option('-r, --run', 'Run coverage analysis')
  .option('-s, --show', 'Show latest coverage report')
  .option('--export <format>', 'Export report (json|text|html)')
  .option('--output <file>', 'Output file for export')
  .action(async (options) => {
    try {
      if (!fs.existsSync(options.plan)) {
        console.error(chalk.red('Plan file not found:'), options.plan);
        process.exit(1);
      }

      const system = new TDDSystem();
      const planData: TDDPlan = JSON.parse(fs.readFileSync(options.plan, 'utf-8'));

      // Restore plan to system
      system['state'].activePlans.set(planData.id, planData);

      if (options.run) {
        console.log(chalk.blue('Running coverage analysis...'));
        const report = await system.runCoverage(planData.id);

        if (report) {
          console.log(chalk.green('✓ Coverage analysis complete'));
          console.log();
          printCoverageSummary(report.summary);

          if (!report.thresholdsMet) {
            console.log();
            console.log(chalk.yellow('Threshold violations:'));
            for (const v of report.violations) {
              console.log(chalk.red(`  ${v.metric}: ${v.actual.toFixed(1)}% < ${v.expected}%`));
            }
          }

          // Save updated plan
          fs.writeFileSync(options.plan, JSON.stringify(planData, null, 2));
        }
      } else if (options.show) {
        const report = system.getCoverageReport(planData.id);
        if (report) {
          printCoverageSummary(report.summary);
        } else {
          console.log(chalk.yellow('No coverage report available'));
        }
      } else if (options.export) {
        const report = system.getCoverageReport(planData.id);
        if (!report) {
          console.error(chalk.red('No coverage report to export'));
          process.exit(1);
        }

        // Use coverage manager to export
        const { CoverageManager } = await import('./coverage.js');
        const manager = new CoverageManager(planData.coverageConfig);
        manager['reports'].set(report.id, report);

        const output = manager.exportReport(report.id, options.export as 'json' | 'text' | 'html');

        if (options.output) {
          fs.writeFileSync(options.output, output);
          console.log(chalk.green('✓ Exported to:'), options.output);
        } else {
          console.log(output);
        }
      } else {
        // Show coverage statistics
        const stats = system.getCoverageStatistics(planData.id);
        if (stats) {
          console.log(chalk.bold('Coverage Statistics:'));
          console.log(chalk.gray('  Statements:'), `${stats.statements.toFixed(1)}%`);
          console.log(chalk.gray('  Branches:'), `${stats.branches.toFixed(1)}%`);
          console.log(chalk.gray('  Functions:'), `${stats.functions.toFixed(1)}%`);
          console.log(chalk.gray('  Lines:'), `${stats.lines.toFixed(1)}%`);
          console.log(chalk.gray('  Target:'), `${stats.target}%`);
          console.log(chalk.gray('  Target Met:'), stats.targetMet ? chalk.green('Yes') : chalk.red('No'));
        } else {
          console.log(chalk.yellow('No coverage data available'));
        }
      }
    } catch (error) {
      console.error(chalk.red('Error with coverage:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// Progress Command
// ============================================================================

program
  .command('progress')
  .description('Show TDD progress report')
  .argument('<plan-file>', 'Path to plan JSON file')
  .option('-f, --format <format>', 'Output format (human|json)', 'human')
  .action((planFile, options) => {
    try {
      if (!fs.existsSync(planFile)) {
        console.error(chalk.red('Plan file not found:'), planFile);
        process.exit(1);
      }

      const system = new TDDSystem();
      const planData: TDDPlan = JSON.parse(fs.readFileSync(planFile, 'utf-8'));

      // Restore plan to system
      system['state'].activePlans.set(planData.id, planData);

      const report = system.generateProgressReport(planData.id);

      if (!report) {
        console.error(chalk.red('Failed to generate progress report'));
        process.exit(1);
      }

      if (options.format === 'json') {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(chalk.bold('TDD Progress Report'));
        console.log(chalk.gray('Plan:'), report.planName);
        console.log(chalk.gray('Generated:'), report.generatedAt.toISOString());
        console.log();

        // Progress bar
        const progressBar = generateProgressBar(report.overallProgress);
        console.log(chalk.bold('Overall Progress:'), `${report.overallProgress}%`);
        console.log(progressBar);
        console.log();

        console.log(chalk.bold('Cycles:'));
        console.log(chalk.gray('  Current:'), report.currentCycle);
        console.log(chalk.gray('  Completed:'), `${report.completedCycles}/${report.totalCycles}`);
        console.log();

        console.log(chalk.bold('Tests:'));
        console.log(chalk.gray('  Total:'), report.testStats.total);
        console.log(chalk.green('  Passed:'), report.testStats.passed);
        console.log(chalk.red('  Failed:'), report.testStats.failed);
        console.log(chalk.yellow('  Pending:'), report.testStats.pending);
        console.log(chalk.gray('  Average Duration:'), `${report.testStats.averageDuration.toFixed(2)}ms`);
        console.log();

        console.log(chalk.bold('Coverage:'));
        console.log(chalk.gray('  Statements:'), `${report.coverageStats.statements.toFixed(1)}%`);
        console.log(chalk.gray('  Branches:'), `${report.coverageStats.branches.toFixed(1)}%`);
        console.log(chalk.gray('  Functions:'), `${report.coverageStats.functions.toFixed(1)}%`);
        console.log(chalk.gray('  Lines:'), `${report.coverageStats.lines.toFixed(1)}%`);
        console.log(chalk.gray('  Target:'), `${report.coverageStats.target}%`);
        console.log(chalk.gray('  Target Met:'), report.coverageStats.targetMet ? chalk.green('Yes') : chalk.red('No'));
      }
    } catch (error) {
      console.error(chalk.red('Error generating progress report:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// Generate Command
// ============================================================================

program
  .command('generate')
  .description('Generate tests from source code')
  .argument('<source-file>', 'Source file to analyze')
  .option('-p, --plan <file>', 'Plan file', 'tdd-plan.json')
  .option('-o, --output <dir>', 'Output directory for tests', './src/__tests__')
  .action(async (sourceFile, options) => {
    try {
      if (!fs.existsSync(sourceFile)) {
        console.error(chalk.red('Source file not found:'), sourceFile);
        process.exit(1);
      }

      if (!fs.existsSync(options.plan)) {
        console.error(chalk.red('Plan file not found:'), options.plan);
        process.exit(1);
      }

      const system = new TDDSystem();
      const planData: TDDPlan = JSON.parse(fs.readFileSync(options.plan, 'utf-8'));

      // Restore plan to system
      system['state'].activePlans.set(planData.id, planData);

      const sourceCode = fs.readFileSync(sourceFile, 'utf-8');
      const tests = await system.generateTests(planData.id, sourceCode, sourceFile);

      console.log(chalk.green(`✓ Generated ${tests.length} test cases`));

      for (const test of tests) {
        console.log(chalk.gray('  -'), test.name);
      }

      // Save updated plan
      fs.writeFileSync(options.plan, JSON.stringify(planData, null, 2));
    } catch (error) {
      console.error(chalk.red('Error generating tests:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusIcon(status: TestCase['status']): string {
  switch (status) {
    case 'passed':
      return chalk.green('✓');
    case 'failed':
    case 'error':
      return chalk.red('✗');
    case 'pending':
    case 'draft':
      return chalk.yellow('○');
    case 'skipped':
      return chalk.gray('⊘');
    default:
      return chalk.gray('?');
  }
}

function printCoverageSummary(summary: { statements: { pct: number }; branches: { pct: number }; functions: { pct: number }; lines: { pct: number } }): void {
  console.log(chalk.bold('Coverage Summary:'));
  console.log(chalk.gray('  Statements:'), `${summary.statements.pct.toFixed(1)}%`);
  console.log(chalk.gray('  Branches:'), `${summary.branches.pct.toFixed(1)}%`);
  console.log(chalk.gray('  Functions:'), `${summary.functions.pct.toFixed(1)}%`);
  console.log(chalk.gray('  Lines:'), `${summary.lines.pct.toFixed(1)}%`);
}

function generateProgressBar(percentage: number, width: number = 40): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  const filledBar = chalk.green('█'.repeat(filled));
  const emptyBar = chalk.gray('░'.repeat(empty));

  return `[${filledBar}${emptyBar}] ${percentage}%`;
}

// ============================================================================
// Export
// ============================================================================

export function createTDDCommand(): Command {
  return program;
}

export default program;
