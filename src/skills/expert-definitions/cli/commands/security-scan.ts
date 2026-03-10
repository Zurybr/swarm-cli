/**
 * Security Scan CLI Command
 *
 * Provides 'swarm security-scan' command for scanning code
 * for security vulnerabilities and secrets.
 */

import { Command } from 'commander';
import { resolve } from 'path';
import { ExpertAPI } from '../../api';
import { SkillRegistry } from '../../../registry/skill-registry';
import { AgentBuilder } from '../../../../agents/builder/agent-builder';
import { SeverityLevel } from '../../types';

/**
 * Register the security-scan command with the CLI program
 * @param program - Commander program instance
 */
export function securityScanCommand(program: Command): void {
  program
    .command('security-scan <path>')
    .description('Scan code for security vulnerabilities and secrets')
    .option('--severity <level>', 'Minimum severity to report (low|medium|high|critical)', 'medium')
    .option('--format <format>', 'Output format (json|markdown|both)', 'markdown')
    .option('--scan-types <types>', 'Comma-separated scan types (secrets|dependencies|patterns)', 'secrets,dependencies,patterns')
    .action(async (targetPath: string, options: {
      severity: string;
      format: string;
      scanTypes: string;
    }) => {
      try {
        // Validate severity
        const validSeverities: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];
        if (!validSeverities.includes(options.severity as SeverityLevel)) {
          console.error(`❌ Invalid severity: ${options.severity}. Must be one of: ${validSeverities.join(', ')}`);
          process.exit(1);
        }

        // Validate format
        const validFormats = ['json', 'markdown', 'both'];
        if (!validFormats.includes(options.format)) {
          console.error(`❌ Invalid format: ${options.format}. Must be one of: ${validFormats.join(', ')}`);
          process.exit(1);
        }

        // Parse scan types
        const validScanTypes = ['secrets', 'dependencies', 'patterns'];
        const scanTypes = options.scanTypes.split(',').map(t => t.trim());
        const invalidTypes = scanTypes.filter(t => !validScanTypes.includes(t));
        if (invalidTypes.length > 0) {
          console.error(`❌ Invalid scan types: ${invalidTypes.join(', ')}. Must be one of: ${validScanTypes.join(', ')}`);
          process.exit(1);
        }

        // Initialize dependencies
        const { getSkillRegistry } = await import('../../../../cli/skill-registry');
        const { getAgentBuilder } = await import('../../../../cli/agent-builder');

        const registry = await getSkillRegistry();
        const builder = await getAgentBuilder(registry);
        const api = new ExpertAPI(registry, builder);

        // Invoke the security expert
        const result = await api.invokeExpert('security-expert', {
          targetPath: resolve(targetPath),
          severityThreshold: options.severity as SeverityLevel,
          outputFormat: options.format as 'json' | 'markdown' | 'both',
          scanTypes: scanTypes as ('secrets' | 'dependencies' | 'patterns')[],
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

        // Exit with error code if critical findings found (for CI integration)
        const hasCritical = result.json.findings.some(f => f.severity === 'critical');
        process.exit(hasCritical ? 1 : 0);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Security scan failed:', errorMessage);
        process.exit(1);
      }
    });
}
