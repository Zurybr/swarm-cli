import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../utils/logger';
import {
  DAGBuilder,
  WaveAssigner,
  WaveExecutor,
  ConflictDetector,
  DependencyVisualizer,
} from '../../orchestration';
import {
  DependencyGraph,
  PlanNode,
  WaveExecutionConfig,
  ExecutionResult,
  Wave,
} from '../../orchestration/types';

const logger = new Logger('WaveCommand');

const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
};

export function createWaveCommand(): Command {
  const waveCmd = new Command('wave')
    .description('Wave-based parallel execution commands')
    .addCommand(createVisualizeCommand())
    .addCommand(createExecuteCommand())
    .addCommand(createValidateCommand())
    .addCommand(createExportCommand());

  return waveCmd;
}

function createVisualizeCommand(): Command {
  return new Command('visualize')
    .description('Visualize plan dependencies')
    .option('-p, --plans <dir>', 'Directory containing plan files', '.plans')
    .option('-f, --format <format>', 'Output format: text|dot|mermaid', 'text')
    .action(async (options) => {
      try {
        const plans = await loadPlansFromDirectory(options.plans);
        const builder = new DAGBuilder();
        const graph = builder.buildFromPlans(plans);

        // Check for cycles
        const cycleError = builder.detectCycle(graph);
        if (cycleError) {
          console.log(colors.red('Error: ') + cycleError.message);
          console.log(colors.yellow('Cycle: ') + cycleError.cycle.join(' → '));
          process.exit(1);
        }

        // Assign waves for visualization
        const assigner = new WaveAssigner();
        assigner.assignWaves(graph);

        const visualizer = new DependencyVisualizer();
        let output: string;

        switch (options.format) {
          case 'dot':
            output = visualizer.renderDOT(graph);
            break;
          case 'mermaid':
            output = visualizer.renderMermaid(graph);
            break;
          case 'text':
          default:
            output = visualizer.renderText(graph);
            break;
        }

        console.log(output);
      } catch (error) {
        logger.error('Failed to visualize dependencies', error);
        console.log(colors.red('Error: ') + (error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}

function createExecuteCommand(): Command {
  return new Command('execute')
    .description('Execute plans using wave-based parallel execution')
    .option('-p, --plans <dir>', 'Directory containing plan files', '.plans')
    .option('--sequential', 'Execute sequentially (no parallelization)', false)
    .option('--max-parallel <n>', 'Maximum parallel plans', '4')
    .option('--timeout <n>', 'Timeout per plan in seconds', '600')
    .option('--fail-fast', 'Stop on first failure', false)
    .action(async (options) => {
      try {
        const plans = await loadPlansFromDirectory(options.plans);
        
        // Build and validate graph
        const builder = new DAGBuilder();
        const graph = builder.buildFromPlans(plans);

        const cycleError = builder.detectCycle(graph);
        if (cycleError) {
          console.log(colors.red('Error: Circular dependency detected'));
          console.log(cycleError.message);
          process.exit(1);
        }

        // Configure execution
        const config: WaveExecutionConfig = {
          parallelization: !options.sequential,
          maxParallelPlans: parseInt(options.maxParallel),
          timeoutPerPlan: parseInt(options.timeout),
          failFast: options.failFast,
        };

        // Execute
        const executor = new WaveExecutor(config);
        const tracker = executor.getProgressTracker();

        console.log(colors.cyan('\n🌊 Starting wave-based execution...\n'));

        // Mock plan executor for demonstration
        const planExecutor = async (planId: string, plan: PlanNode): Promise<ExecutionResult> => {
          console.log(colors.blue(`  Executing plan ${planId}...`));
          
          // Simulate execution
          await new Promise((resolve) => setTimeout(resolve, 100));
          
          const result: ExecutionResult = {
            planId,
            success: true,
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 100,
            output: `Plan ${planId} completed successfully`,
          };
          
          console.log(colors.green(`  ✓ Plan ${planId} completed`));
          return result;
        };

        const startTime = Date.now();
        const results = await executor.execute(graph, planExecutor);
        const totalDuration = Date.now() - startTime;

        // Display final progress
        console.log('\n' + tracker.formatProgress());
        console.log(colors.cyan(`\n✅ Execution completed in ${(totalDuration / 1000).toFixed(2)}s\n`));

        // Summary
        const successCount = Array.from(results.values()).filter((r) => r.success).length;
        const failCount = results.size - successCount;
        
        console.log(colors.green(`Successful: ${successCount}`));
        if (failCount > 0) {
          console.log(colors.red(`Failed: ${failCount}`));
        }

      } catch (error) {
        logger.error('Failed to execute plans', error);
        console.log(colors.red('Error: ') + (error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}

function createValidateCommand(): Command {
  return new Command('validate')
    .description('Validate plan dependencies and detect conflicts')
    .option('-p, --plans <dir>', 'Directory containing plan files', '.plans')
    .action(async (options) => {
      try {
        const plans = await loadPlansFromDirectory(options.plans);
        const builder = new DAGBuilder();
        const graph = builder.buildFromPlans(plans);

        console.log(colors.cyan('\n🔍 Validating plan dependencies...\n'));

        // Check for cycles
        const cycleError = builder.detectCycle(graph);
        if (cycleError) {
          console.log(colors.red('❌ Circular dependency detected'));
          console.log(colors.yellow('  Cycle: ') + cycleError.cycle.join(' → '));
          process.exit(1);
        } else {
          console.log(colors.green('✓ No circular dependencies'));
        }

        // Check for missing dependencies
        const isValid = builder.validateDependencies(Array.from(graph.nodes.values()));
        if (isValid) {
          console.log(colors.green('✓ All dependencies are valid'));
        } else {
          console.log(colors.red('❌ Some dependencies are missing'));
        }

        // Check for file conflicts
        const assigner = new WaveAssigner();
        const waves = assigner.assignWaves(graph);
        const conflictDetector = new ConflictDetector();
        
        let hasConflicts = false;
        for (const wave of waves) {
          const wavePlans = wave.plans
            .map((id) => graph.nodes.get(id))
            .filter((p): p is PlanNode => p !== undefined);
          
          const conflicts = conflictDetector.detectConflicts(wave, wavePlans);
          if (conflicts.length > 0) {
            hasConflicts = true;
            console.log(colors.yellow(`\n⚠️  Wave ${wave.number} has ${conflicts.length} conflict(s):`));
            for (const conflict of conflicts) {
              const icon = conflict.type === 'BLOCK' ? '🔴' : '🟡';
              console.log(`  ${icon} ${conflict.type}: ${conflict.description}`);
            }
          }
        }

        if (!hasConflicts) {
          console.log(colors.green('✓ No file conflicts detected'));
        }

        console.log(colors.cyan('\n✅ Validation complete\n'));

      } catch (error) {
        logger.error('Failed to validate plans', error);
        console.log(colors.red('Error: ') + (error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}

function createExportCommand(): Command {
  return new Command('export')
    .description('Export dependency graph to various formats')
    .option('-p, --plans <dir>', 'Directory containing plan files', '.plans')
    .option('-f, --format <format>', 'Export format: dot|mermaid', 'dot')
    .option('-o, --output <file>', 'Output file')
    .action(async (options) => {
      try {
        const plans = await loadPlansFromDirectory(options.plans);
        const builder = new DAGBuilder();
        const graph = builder.buildFromPlans(plans);

        const cycleError = builder.detectCycle(graph);
        if (cycleError) {
          console.log(colors.red('Error: ') + cycleError.message);
          process.exit(1);
        }

        const assigner = new WaveAssigner();
        assigner.assignWaves(graph);

        const visualizer = new DependencyVisualizer();
        const output = options.format === 'mermaid' 
          ? visualizer.renderMermaid(graph)
          : visualizer.renderDOT(graph);

        if (options.output) {
          fs.writeFileSync(options.output, output);
          console.log(colors.green(`✓ Exported to ${options.output}`));
        } else {
          console.log(output);
        }

      } catch (error) {
        logger.error('Failed to export dependencies', error);
        console.log(colors.red('Error: ') + (error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}

/**
 * Load plans from a directory
 * @param plansDir - Directory containing plan files
 * @returns Array of plan objects
 */
async function loadPlansFromDirectory(
  plansDir: string
): Promise<Array<{ id: string; dependsOn: string[]; filesModified?: string[] }>> {
  const plans: Array<{ id: string; dependsOn: string[]; filesModified?: string[] }> = [];
  
  if (!fs.existsSync(plansDir)) {
    throw new Error(`Plans directory not found: ${plansDir}`);
  }

  const files = fs.readdirSync(plansDir);
  
  for (const file of files) {
    if (file.endsWith('.md') || file.endsWith('.yaml') || file.endsWith('.yml')) {
      const filePath = path.join(plansDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Extract plan ID from filename
      const planId = path.basename(file, path.extname(file));
      
      // Parse frontmatter (simplified - in production use proper YAML parser)
      const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
      let dependsOn: string[] = [];
      let filesModified: string[] = [];
      
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        
        // Parse depends_on
        const dependsMatch = frontmatter.match(/depends_on:\s*\n((?:\s*-\s*\S+\n?)*)/);
        if (dependsMatch) {
          dependsOn = dependsMatch[1]
            .split('\n')
            .filter((line) => line.trim().startsWith('-'))
            .map((line) => line.replace(/^\s*-\s*/, '').trim());
        }
        
        // Parse files_modified
        const filesMatch = frontmatter.match(/files_modified:\s*\n((?:\s*-\s*\S+\n?)*)/);
        if (filesMatch) {
          filesModified = filesMatch[1]
            .split('\n')
            .filter((line) => line.trim().startsWith('-'))
            .map((line) => line.replace(/^\s*-\s*/, '').trim());
        }
      }
      
      plans.push({
        id: planId,
        dependsOn,
        filesModified,
      });
    }
  }
  
  return plans;
}
