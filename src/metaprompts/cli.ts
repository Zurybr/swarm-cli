/**
 * Meta-Prompts CLI
 *
 * Command-line interface for managing meta-prompts and templates.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createMetaPromptSystem, quickRender, utils } from './index';
import type { AgentType, InjectedContext, TemplateVariable } from './types';

const program = new Command();

program
  .name('swarm metaprompts')
  .description('CLI for managing meta-prompts and agent templates')
  .version('1.0.0');

/**
 * List available agent types and templates
 */
program
  .command('list')
  .alias('ls')
  .description('List all available agent types and templates')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      const system = createMetaPromptSystem();
      await system.initialize();

      const templates = system.getAllTemplates();

      if (options.json) {
        console.log(JSON.stringify(templates, null, 2));
        return;
      }

      console.log(chalk.bold('\nAvailable Agent Templates\n'));
      console.log('='.repeat(60));

      for (const template of templates) {
        console.log(`\n${chalk.cyan.bold(template.name)}`);
        console.log(`  ID: ${chalk.gray(template.id)}`);
        console.log(`  Description: ${template.description}`);
        console.log(`  Complexity: ${'★'.repeat(template.complexity)}${'☆'.repeat(5 - template.complexity)}`);
        console.log(`  Est. Tokens: ${template.estimatedTokens}`);
        console.log(`  Variables: ${template.variableCount}`);
      }

      console.log(`\n${chalk.gray(`Total: ${templates.length} templates`)}\n`);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Show template details
 */
program
  .command('show')
  .description('Show detailed information about a template')
  .argument('<agent-type>', 'Agent type (e.g., executor, planner)')
  .option('-c, --content', 'Show full template content')
  .option('-j, --json', 'Output as JSON')
  .action(async (agentType: string, options) => {
    try {
      const system = createMetaPromptSystem();
      await system.initialize();

      const validTypes = system.getAgentTypes();
      if (!validTypes.includes(agentType as AgentType)) {
        console.error(chalk.red(`Invalid agent type: ${agentType}`));
        console.log(chalk.gray(`Valid types: ${validTypes.join(', ')}`));
        process.exit(1);
      }

      const info = await system.getTemplateInfo(agentType as AgentType);

      if (options.json) {
        console.log(JSON.stringify(info, null, 2));
        return;
      }

      console.log(chalk.bold(`\n${info.name}\n`));
      console.log(`ID: ${chalk.gray(info.id)}`);
      console.log(`Description: ${info.description}`);
      console.log(`Complexity: ${'★'.repeat(info.complexity)}${'☆'.repeat(5 - info.complexity)}`);
      console.log(`Estimated Tokens: ${info.estimatedTokens}`);
      console.log(`\n${chalk.bold('Variables:')}`);

      for (const v of info.variables) {
        const required = v.required ? chalk.red('(required)') : chalk.gray('(optional)');
        const def = v.default !== undefined ? chalk.gray(` [default: ${JSON.stringify(v.default)}]`) : '';
        console.log(`  • ${chalk.cyan(v.name)} ${chalk.gray(v.type)} ${required}${def}`);
        console.log(`    ${v.description}`);
      }

      if (options.content) {
        console.log(`\n${chalk.bold('Template Content:')}`);
        console.log('-'.repeat(60));
        const system = createMetaPromptSystem();
        await system.initialize();
        const template = await system.getTemplateInfo(agentType as AgentType);
        console.log(template);
      }

      console.log();
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Render a prompt
 */
program
  .command('render')
  .description('Render a prompt for an agent type')
  .argument('<agent-type>', 'Agent type')
  .argument('<task>', 'Task description')
  .option('-c, --context <file>', 'JSON file with additional context')
  .option('-v, --vars <vars>', 'Custom variables as JSON', '{}')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('--no-optimize', 'Disable prompt optimization')
  .action(async (agentType: string, task: string, options) => {
    try {
      const system = createMetaPromptSystem({
        optimizationEnabled: options.optimize !== false,
      });
      await system.initialize();

      const validTypes = system.getAgentTypes();
      if (!validTypes.includes(agentType as AgentType)) {
        console.error(chalk.red(`Invalid agent type: ${agentType}`));
        console.log(chalk.gray(`Valid types: ${validTypes.join(', ')}`));
        process.exit(1);
      }

      let context: InjectedContext = { task };

      if (options.context) {
        const fs = await import('fs/promises');
        const contextData = await fs.readFile(options.context, 'utf-8');
        context = { ...JSON.parse(contextData), task };
      }

      const customVars = JSON.parse(options.vars);

      const rendered = await system.render(agentType as AgentType, context, customVars);

      const output = [
        chalk.gray(`# Template: ${rendered.templateId} (v${rendered.version})`),
        chalk.gray(`# Estimated tokens: ${rendered.estimatedTokens}`),
        chalk.gray(`# Rendered at: ${rendered.renderedAt.toISOString()}`),
        '',
        rendered.prompt,
      ].join('\n');

      if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, rendered.prompt, 'utf-8');
        console.log(chalk.green(`Prompt written to ${options.output}`));
        console.log(chalk.gray(`Estimated tokens: ${rendered.estimatedTokens}`));
      } else {
        console.log(output);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Optimize a prompt
 */
program
  .command('optimize')
  .description('Optimize a prompt file')
  .argument('<file>', 'Prompt file to optimize')
  .option('-s, --strategy <strategy>', 'Optimization strategy', 'token_reduction')
  .option('-t, --target-tokens <n>', 'Target token count', '2000')
  .option('-o, --output <file>', 'Output file (default: overwrite)')
  .option('--dry-run', 'Show changes without applying')
  .action(async (file: string, options) => {
    try {
      const fs = await import('fs/promises');
      const prompt = await fs.readFile(file, 'utf-8');

      const result = utils.optimizeForAgent(
        { content: prompt } as any,
        'executor',
        {
          strategy: options.strategy as any,
          targetTokens: parseInt(options.targetTokens),
        },
      );

      console.log(chalk.bold('\nOptimization Results\n'));
      console.log(`Strategy: ${chalk.cyan(result.strategy)}`);
      console.log(`Original tokens: ${result.metrics.originalTokens}`);
      console.log(`Optimized tokens: ${chalk.green(result.metrics.optimizedTokens)}`);
      console.log(`Token reduction: ${chalk.green(`${(result.metrics.tokenReduction * 100).toFixed(1)}%`)}`);
      console.log(`Clarity score: ${result.metrics.clarityScore.toFixed(2)}`);

      console.log(chalk.bold('\nChanges:'));
      for (const change of result.changes) {
        console.log(`  • ${change}`);
      }

      if (!options.dryRun) {
        const outputFile = options.output || file;
        await fs.writeFile(outputFile, result.optimized, 'utf-8');
        console.log(chalk.green(`\nOptimized prompt written to ${outputFile}`));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Analyze a prompt
 */
program
  .command('analyze')
  .description('Analyze a prompt and suggest improvements')
  .argument('<file>', 'Prompt file to analyze')
  .action(async (file: string) => {
    try {
      const fs = await import('fs/promises');
      const prompt = await fs.readFile(file, 'utf-8');

      const tokens = utils.estimateTokens(prompt);
      const strategies = utils.suggestStrategies(prompt);

      console.log(chalk.bold('\nPrompt Analysis\n'));
      console.log(`Token estimate: ${chalk.cyan(tokens)}`);
      console.log(`Character count: ${prompt.length}`);
      console.log(`Line count: ${prompt.split('\n').length}`);

      console.log(chalk.bold('\nSuggested optimizations:'));
      for (const strategy of strategies) {
        console.log(`  • ${chalk.yellow(strategy)}`);
      }

      // Check for common issues
      const issues: string[] = [];

      if (prompt.length > 8000) {
        issues.push('Prompt is very long - consider context compression');
      }

      if (!prompt.includes('##') && prompt.length > 500) {
        issues.push('No structure detected - consider adding headers');
      }

      if (!prompt.toLowerCase().includes('example')) {
        issues.push('No examples found - consider adding examples');
      }

      if (/\b(something|thing|stuff)\b/i.test(prompt)) {
        issues.push('Vague terms detected - be more specific');
      }

      if (issues.length > 0) {
        console.log(chalk.bold('\nPotential issues:'));
        for (const issue of issues) {
          console.log(`  • ${chalk.red(issue)}`);
        }
      } else {
        console.log(chalk.green('\nNo obvious issues detected!'));
      }

      console.log();
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Export template
 */
program
  .command('export')
  .description('Export a template to JSON')
  .argument('<agent-type>', 'Agent type to export')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(async (agentType: string, options) => {
    try {
      const system = createMetaPromptSystem();
      await system.initialize();

      const validTypes = system.getAgentTypes();
      if (!validTypes.includes(agentType as AgentType)) {
        console.error(chalk.red(`Invalid agent type: ${agentType}`));
        process.exit(1);
      }

      const info = await system.getTemplateInfo(agentType as AgentType);
      const json = JSON.stringify(info, null, 2);

      if (options.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.output, json, 'utf-8');
        console.log(chalk.green(`Template exported to ${options.output}`));
      } else {
        console.log(json);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Import template
 */
program
  .command('import')
  .description('Import a template from JSON')
  .argument('<file>', 'JSON file to import')
  .action(async (file: string) => {
    try {
      const fs = await import('fs/promises');
      const json = await fs.readFile(file, 'utf-8');

      const system = createMetaPromptSystem();
      await system.initialize();

      const template = await system.importTemplate(json);
      console.log(chalk.green(`Template imported: ${template.name} (${template.id})`));
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Get statistics
 */
program
  .command('stats')
  .description('Show meta-prompts system statistics')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    try {
      const system = createMetaPromptSystem();
      await system.initialize();

      const stats = await system.getStats();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      console.log(chalk.bold('\nMeta-Prompts Statistics\n'));
      console.log(`Total templates: ${chalk.cyan(stats.totalTemplates)}`);
      console.log(`Total versions: ${chalk.cyan(stats.totalVersions)}`);

      console.log(chalk.bold('\nMost used templates:'));
      for (const name of stats.mostUsed) {
        console.log(`  • ${name}`);
      }

      console.log(chalk.bold('\nRecently updated:'));
      for (const name of stats.recentlyUpdated) {
        console.log(`  • ${name}`);
      }

      console.log();
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Quick render command
 */
program
  .command('quick')
  .description('Quickly render a prompt without full initialization')
  .argument('<agent-type>', 'Agent type')
  .argument('<task>', 'Task description')
  .action(async (agentType: string, task: string) => {
    try {
      const prompt = await quickRender(agentType as AgentType, task);
      console.log(prompt);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Parse arguments
program.parse();

export { program };
