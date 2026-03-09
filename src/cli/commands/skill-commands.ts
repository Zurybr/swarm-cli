/**
 * Skill CLI Commands
 *
 * Provides CLI commands for skill management:
 * - skill register: Register a new skill with metadata
 * - skill list: List all registered skills
 * - skill search: Search skills by query
 * - skill get: Get detailed skill information
 */

import { Command } from 'commander';
import { SkillRegistry } from '../../skills';
import { SkillMetadata } from '../../skills/types/skill';

/**
 * Register skill commands with the CLI program
 * @param program - Commander program instance
 * @param registry - SkillRegistry instance
 */
export function registerSkillCommands(
  program: Command,
  registry: SkillRegistry
): void {
  const skillCommand = program
    .command('skill')
    .description('Manage agent skills');

  // Register command
  skillCommand
    .command('register')
    .description('Register a new skill')
    .requiredOption('--name <name>', 'Skill name (lowercase alphanumeric with hyphens)')
    .requiredOption('--description <desc>', 'Skill description (10-500 characters)')
    .requiredOption('--version <version>', 'Semantic version (e.g., 1.0.0)')
    .option('--category <category>', 'Skill category (security, performance, documentation, testing, general)')
    .option('--tags <tags>', 'Comma-separated list of tags')
    .action(async (options) => {
      try {
        const metadata: SkillMetadata = {
          name: options.name,
          description: options.description,
          version: options.version,
          category: options.category,
          tags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await registry.register(metadata);
        console.log(`✅ Registered skill: ${metadata.name}@${metadata.version}`);
      } catch (error) {
        console.error('❌ Failed to register skill:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // List command
  skillCommand
    .command('list')
    .description('List all registered skills')
    .option('--category <category>', 'Filter by category')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        let skills = registry.getAllMetadata();

        // Filter by category if specified
        if (options.category) {
          skills = skills.filter(s => s.category === options.category);
        }

        if (skills.length === 0) {
          console.log('No skills registered.');
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(skills, null, 2));
        } else {
          // Table output
          console.log('\n📋 Registered Skills:\n');
          console.log(
            `${'Name'.padEnd(25)} ${'Version'.padEnd(10)} ${'Category'.padEnd(15)} ${'Description'.slice(0, 40)}`
          );
          console.log('-'.repeat(90));

          skills.forEach(skill => {
            const name = skill.name.slice(0, 24).padEnd(25);
            const version = skill.version.padEnd(10);
            const category = (skill.category || 'general').padEnd(15);
            const desc = skill.description.slice(0, 40);
            console.log(`${name} ${version} ${category} ${desc}`);
          });
          console.log();
        }
      } catch (error) {
        console.error('❌ Failed to list skills:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // Search command
  skillCommand
    .command('search <query>')
    .description('Search skills by query')
    .option('--limit <limit>', 'Maximum number of results', '10')
    .action(async (query, options) => {
      try {
        const limit = parseInt(options.limit, 10);
        const results = await registry.search(query, limit);

        if (results.length === 0) {
          console.log(`No skills found for query: "${query}"`);
          return;
        }

        console.log(`\n🔍 Search results for "${query}" (${results.length} found):\n`);
        console.log(
          `${'Rank'.padEnd(6)} ${'Name'.padEnd(25)} ${'Version'.padEnd(10)} ${'Description'.slice(0, 40)}`
        );
        console.log('-'.repeat(85));

        results.forEach((skill, index) => {
          const rank = `#${index + 1}`.padEnd(6);
          const name = skill.name.slice(0, 24).padEnd(25);
          const version = skill.version.padEnd(10);
          const desc = skill.description.slice(0, 40);
          console.log(`${rank} ${name} ${version} ${desc}`);
        });
        console.log();
      } catch (error) {
        console.error('❌ Failed to search skills:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // Get command
  skillCommand
    .command('get <name>')
    .description('Get detailed skill information')
    .action(async (name) => {
      try {
        const skill = registry.getMetadata(name);

        if (!skill) {
          console.error(`❌ Skill not found: ${name}`);
          process.exit(1);
        }

        console.log(`\n📖 Skill: ${skill.name}\n`);
        console.log(`  Name:        ${skill.name}`);
        console.log(`  Version:     ${skill.version}`);
        console.log(`  Category:    ${skill.category || 'general'}`);
        console.log(`  Description: ${skill.description}`);

        if (skill.tags && skill.tags.length > 0) {
          console.log(`  Tags:        ${skill.tags.join(', ')}`);
        }

        if (skill.author) {
          console.log(`  Author:      ${skill.author}`);
        }

        console.log(`  Created:     ${skill.createdAt.toISOString()}`);
        console.log(`  Updated:     ${skill.updatedAt.toISOString()}`);

        // Show all versions
        const versions = registry.getVersions(name);
        if (versions.length > 1) {
          console.log(`\n  All Versions: ${versions.join(', ')}`);
        }

        console.log();
      } catch (error) {
        console.error('❌ Failed to get skill:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
