/**
 * Documentation Check CLI Command
 *
 * Provides 'swarm doc-check' command for checking documentation
 * coverage and detecting drift between code and docs.
 */

import { Command } from 'commander';
import { resolve } from 'path';
import { ExpertAPI } from '../../api';
import { SkillRegistry } from '../../../registry/skill-registry';
import { AgentBuilder } from '../../../../agents/builder/agent-builder';
import { SeverityLevel } from '../../types';

/**
 * Register the doc-check command with the CLI program
 * @param program - Commander program instance
 */
export function docCheckCommand(program: Command): void {
  program
    .command('doc-check <path>')
    .description('Check documentation coverage and detect drift')
    .option('--check-drift', 'Check for outdated documentation', true)
    .option('--generate', 'Generate suggested JSDoc for undocumented items', false)
    .option('--format <format>', 'Output format (json|markdown|both)', 'markdown')
    .option('--severity <level>', 'Minimum severity to report (low|medium|high|critical)', 'low')
    .action(async (targetPath: string, options: {
      checkDrift: boolean;
      generate: boolean;
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

        // Initialize dependencies
        const { getSkillRegistry } = await import('../../../../cli/skill-registry');
        const { getAgentBuilder } = await import('../../../../cli/agent-builder');

        const registry = await getSkillRegistry();
        const builder = await getAgentBuilder(registry);
        const api = new ExpertAPI(registry, builder);

        // Invoke the documentation expert
        const result = await api.invokeExpert('doc-expert', {
          targetPath: resolve(targetPath),
          outputFormat: options.format as 'json' | 'markdown' | 'both',
          severityThreshold: options.severity as SeverityLevel,
          checkMissingJsDoc: true,
          checkParamMismatch: options.checkDrift,
          checkReturnMismatch: options.checkDrift,
          generateTemplates: options.generate,
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
        console.error('❌ Documentation check failed:', errorMessage);
        process.exit(1);
      }
    });
}
