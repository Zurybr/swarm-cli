/**
 * Performance Analyze CLI Command
 *
 * Provides 'swarm perf-analyze' command for analyzing code
 * complexity and identifying performance bottlenecks.
 */

import { Command } from 'commander';
import { resolve } from 'path';
import { ExpertAPI } from '../../api';
import { SkillRegistry } from '../../../registry/skill-registry';
import { AgentBuilder } from '../../../../agents/builder/agent-builder';
import { SeverityLevel } from '../../types';

/**
 * Register the perf-analyze command with the CLI program
 * @param program - Commander program instance
 */
export function perfAnalyzeCommand(program: Command): void {
  program
    .command('perf-analyze <path>')
    .description('Analyze code complexity and identify performance bottlenecks')
    .option('--threshold-cyclomatic <n>', 'Cyclomatic complexity threshold', '10')
    .option('--threshold-maintainability <n>', 'Maintainability index threshold', '80')
    .option('--threshold-length <n>', 'Function length threshold (lines)', '50')
    .option('--format <format>', 'Output format (json|markdown|both)', 'markdown')
    .option('--severity <level>', 'Minimum severity to report (low|medium|high|critical)', 'low')
    .action(async (targetPath: string, options: {
      thresholdCyclomatic: string;
      thresholdMaintainability: string;
      thresholdLength: string;
      format: string;
      severity: string;
    }) => {
      try {
        // Validate format
        const validFormats = ['json', 'markdown', 'both'];
        if (!validFormats.includes(options.format)) {
          console.error(`❌ Invalid format: ${options.format}. Must be one of: ${validFormats.join(', ')}`);
          process.exit(1);
        }

        // Validate severity
        const validSeverities: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];
        if (!validSeverities.includes(options.severity as SeverityLevel)) {
          console.error(`❌ Invalid severity: ${options.severity}. Must be one of: ${validSeverities.join(', ')}`);
          process.exit(1);
        }

        // Parse thresholds
        const cyclomaticThreshold = parseInt(options.thresholdCyclomatic, 10);
        const maintainabilityThreshold = parseInt(options.thresholdMaintainability, 10);
        const functionLengthThreshold = parseInt(options.thresholdLength, 10);

        if (isNaN(cyclomaticThreshold) || cyclomaticThreshold < 1) {
          console.error('❌ Invalid cyclomatic threshold. Must be a positive integer.');
          process.exit(1);
        }

        if (isNaN(maintainabilityThreshold) || maintainabilityThreshold < 0 || maintainabilityThreshold > 171) {
          console.error('❌ Invalid maintainability threshold. Must be between 0 and 171.');
          process.exit(1);
        }

        if (isNaN(functionLengthThreshold) || functionLengthThreshold < 1) {
          console.error('❌ Invalid function length threshold. Must be a positive integer.');
          process.exit(1);
        }

        // Initialize dependencies
        const { getSkillRegistry } = await import('../../../../cli/skill-registry');
        const { getAgentBuilder } = await import('../../../../cli/agent-builder');

        const registry = await getSkillRegistry();
        const builder = await getAgentBuilder(registry);
        const api = new ExpertAPI(registry, builder);

        // Invoke the performance expert
        const result = await api.invokeExpert('perf-expert', {
          targetPath: resolve(targetPath),
          outputFormat: options.format as 'json' | 'markdown' | 'both',
          severityThreshold: options.severity as SeverityLevel,
          cyclomaticThreshold,
          maintainabilityThreshold,
          functionLengthThreshold,
        });

        // Output based on format
        if (options.format === 'json') {
          console.log(JSON.stringify(result.json, null, 2));
        } else if (options.format === 'markdown') {
          console.log(result.markdown);
        } else {
          console.log(JSON.stringify(result.json, null, 2));
          console.log('\n---\n');
          console.log(result.markdown);
        }

        // Exit with error code if critical findings found
        const hasCritical = result.json.findings.some(f => f.severity === 'critical');
        process.exit(hasCritical ? 1 : 0);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Performance analysis failed:', errorMessage);
        process.exit(1);
      }
    });
}
