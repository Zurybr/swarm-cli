/**
 * Hivemind CLI Commands - Issue #26.3
 *
 * CLI commands for interacting with the Hivemind semantic memory system.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Hivemind } from './hivemind';
import {
  createEmbeddingBackend,
  OllamaEmbeddingBackend,
  OpenAIEmbeddingBackend,
  FullTextSearchBackend
} from './embedding-backends';
import { Logger } from '../utils/logger';
import { Learning, SearchOptions, EmbeddingBackend } from '../types';

const logger = new Logger('HivemindCLI');

/**
 * Default database path for Hivemind
 */
const DEFAULT_DB_PATH = './.hive/hivemind.db';

/**
 * Get the database path from environment or default
 */
function getDbPath(): string {
  return process.env.HIVEMIND_DB_PATH || DEFAULT_DB_PATH;
}

/**
 * Get embedding backend type from environment or default
 */
function getEmbeddingBackendType(): 'ollama' | 'openai' | 'fts' {
  const type = process.env.HIVEMIND_EMBEDDING_BACKEND;
  if (type === 'ollama' || type === 'openai' || type === 'fts') {
    return type;
  }
  return 'fts'; // Default to full-text search (no external dependencies)
}

/**
 * Create and configure the embedding backend
 */
function createBackend(): EmbeddingBackend {
  const type = getEmbeddingBackendType();
  const config: { apiKey?: string; baseURL?: string; model?: string } = {};

  if (type === 'openai') {
    config.apiKey = process.env.OPENAI_API_KEY;
  }
  if (type === 'ollama') {
    config.baseURL = process.env.OLLAMA_BASE_URL;
    config.model = process.env.OLLAMA_EMBED_MODEL;
  }

  return createEmbeddingBackend(type, config);
}

/**
 * Initialize a Hivemind instance
 */
async function initializeHivemind(): Promise<Hivemind> {
  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);

  // Ensure database directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const backend = createBackend();
  const hivemind = new Hivemind(backend, dbPath);
  await hivemind.initialize();

  return hivemind;
}

/**
 * Create the hivemind command
 */
export function createHivemindCommand(): Command {
  const hivemind = new Command('hivemind')
    .description('Semantic memory system for storing and searching learnings');

  // Store command - save a learning
  hivemind
    .command('store <information>')
    .description('Store a learning in the semantic memory')
    .option('-t, --tags <tags>', 'Comma-separated tags', '')
    .option('-c, --category <category>', 'Category: pattern, anti-pattern, best-practice, error', 'pattern')
    .option('-s, --source <source>', 'Source of the learning', 'cli')
    .option('--codebase <codebase>', 'Codebase context', process.cwd())
    .option('--files <files>', 'Comma-separated related files', '')
    .option('--task <task>', 'Related task description', '')
    .action(async (information: string, options) => {
      try {
        console.log(chalk.blue('\n🧠 Storing learning...'));

        const hive = await initializeHivemind();

        // Parse tags
        const tags = options.tags
          ? options.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
          : [];

        // Parse files
        const files = options.files
          ? options.files.split(',').map((f: string) => f.trim()).filter(Boolean)
          : [];

        // Create learning object
        const learning: Learning = {
          id: randomUUID(),
          content: information,
          embedding: [],
          metadata: {
            source: options.source,
            timestamp: new Date(),
            tags,
            category: options.category as Learning['metadata']['category']
          },
          context: {
            codebase: options.codebase,
            files,
            task: options.task
          }
        };

        await hive.save(learning);
        await hive.close();

        console.log(chalk.green(`\n✓ Learning stored successfully`));
        console.log(chalk.gray(`  ID: ${learning.id}`));
        console.log(chalk.gray(`  Category: ${learning.metadata.category}`));
        if (tags.length > 0) {
          console.log(chalk.gray(`  Tags: ${tags.join(', ')}`));
        }
        console.log('');

      } catch (error) {
        logger.error('Failed to store learning', error);
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Find command - search for similar learnings
  hivemind
    .command('find <query>')
    .description('Search for similar learnings in semantic memory')
    .option('-l, --limit <n>', 'Maximum number of results', '5')
    .option('--threshold <n>', 'Minimum similarity threshold (0-1)', '0.5')
    .option('-t, --tags <tags>', 'Filter by comma-separated tags')
    .option('-c, --category <category>', 'Filter by category')
    .option('--json', 'Output as JSON')
    .action(async (query: string, options) => {
      try {
        console.log(chalk.blue('\n🔍 Searching learnings...'));

        const hive = await initializeHivemind();

        const searchOptions: SearchOptions = {
          limit: parseInt(options.limit, 10),
          threshold: parseFloat(options.threshold)
        };

        if (options.tags) {
          searchOptions.tags = options.tags.split(',').map((t: string) => t.trim());
        }
        if (options.category) {
          searchOptions.category = options.category;
        }

        const results = await hive.findSimilar(query, searchOptions);
        await hive.close();

        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
        } else {
          if (results.length === 0) {
            console.log(chalk.yellow('\n  No similar learnings found'));
          } else {
            console.log(chalk.green(`\n✓ Found ${results.length} similar learning(s):\n`));
            results.forEach((result, index) => {
              console.log(chalk.cyan(`  ${index + 1}. [${(result.similarity * 100).toFixed(1)}%] ${result.learning.id}`));
              console.log(chalk.white(`     ${result.learning.content.slice(0, 100)}${result.learning.content.length > 100 ? '...' : ''}`));
              console.log(chalk.gray(`     Category: ${result.learning.metadata.category}`));
              if (result.learning.metadata.tags.length > 0) {
                console.log(chalk.gray(`     Tags: ${result.learning.metadata.tags.join(', ')}`));
              }
              console.log('');
            });
          }
        }

      } catch (error) {
        logger.error('Failed to search learnings', error);
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Get command - retrieve a learning by ID
  hivemind
    .command('get <id>')
    .description('Retrieve a specific learning by ID')
    .option('--json', 'Output as JSON')
    .action(async (id: string, options) => {
      try {
        const hive = await initializeHivemind();
        const learning = await hive.getById(id);
        await hive.close();

        if (!learning) {
          console.log(chalk.yellow(`\n⚠ Learning not found: ${id}`));
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify(learning, null, 2));
        } else {
          console.log(chalk.green('\n✓ Learning found:\n'));
          console.log(chalk.cyan(`  ID: ${learning.id}`));
          console.log(chalk.white(`\n  Content:`));
          console.log(`  ${learning.content}`);
          console.log(chalk.gray(`\n  Metadata:`));
          console.log(chalk.gray(`    Source: ${learning.metadata.source}`));
          console.log(chalk.gray(`    Category: ${learning.metadata.category}`));
          console.log(chalk.gray(`    Timestamp: ${learning.metadata.timestamp.toISOString()}`));
          if (learning.metadata.tags.length > 0) {
            console.log(chalk.gray(`    Tags: ${learning.metadata.tags.join(', ')}`));
          }
          console.log(chalk.gray(`\n  Context:`));
          console.log(chalk.gray(`    Codebase: ${learning.context.codebase}`));
          if (learning.context.task) {
            console.log(chalk.gray(`    Task: ${learning.context.task}`));
          }
          if (learning.context.files.length > 0) {
            console.log(chalk.gray(`    Files: ${learning.context.files.join(', ')}`));
          }
          console.log('');
        }

      } catch (error) {
        logger.error('Failed to get learning', error);
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Remove command - delete a learning
  hivemind
    .command('remove <id>')
    .alias('rm')
    .description('Remove a learning from the memory')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (id: string, options) => {
      try {
        const hive = await initializeHivemind();
        const learning = await hive.getById(id);

        if (!learning) {
          console.log(chalk.yellow(`\n⚠ Learning not found: ${id}`));
          await hive.close();
          process.exit(1);
        }

        // Show what will be deleted
        console.log(chalk.yellow('\n⚠ About to delete:'));
        console.log(chalk.gray(`  ID: ${learning.id}`));
        console.log(chalk.white(`  Content: ${learning.content.slice(0, 100)}${learning.content.length > 100 ? '...' : ''}`));

        // Confirm unless --force
        if (!options.force) {
          const readline = await import('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });

          const answer = await new Promise<string>((resolve) => {
            rl.question(chalk.red('\n  Confirm deletion? [y/N]: '), resolve);
          });
          rl.close();

          if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log(chalk.gray('\n  Cancelled.'));
            await hive.close();
            return;
          }
        }

        await hive.delete(id);
        await hive.close();

        console.log(chalk.green('\n✓ Learning removed successfully'));
        console.log('');

      } catch (error) {
        logger.error('Failed to remove learning', error);
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Stats command - show memory statistics
  hivemind
    .command('stats')
    .description('Show statistics about the semantic memory')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const hive = await initializeHivemind();
        const learnings = await hive.getAllLearnings();
        await hive.close();

        // Calculate statistics
        const stats = {
          total: learnings.length,
          byCategory: {} as Record<string, number>,
          bySource: {} as Record<string, number>,
          oldestTimestamp: learnings.length > 0
            ? learnings.reduce((oldest, l) =>
              l.metadata.timestamp < oldest ? l.metadata.timestamp : oldest,
              learnings[0].metadata.timestamp
            ).toISOString()
            : null,
          newestTimestamp: learnings.length > 0
            ? learnings.reduce((newest, l) =>
              l.metadata.timestamp > newest ? l.metadata.timestamp : newest,
              learnings[0].metadata.timestamp
            ).toISOString()
            : null,
          totalTags: Array.from(new Set(learnings.flatMap(l => l.metadata.tags))).length
        };

        // Count by category
        for (const learning of learnings) {
          const cat = learning.metadata.category;
          stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
        }

        // Count by source
        for (const learning of learnings) {
          const src = learning.metadata.source || 'unknown';
          stats.bySource[src] = (stats.bySource[src] || 0) + 1;
        }

        if (options.json) {
          console.log(JSON.stringify(stats, null, 2));
        } else {
          console.log(chalk.cyan('\n📊 Hivemind Statistics\n'));
          console.log(chalk.white(`  Total Learnings: ${stats.total}`));
          console.log(chalk.white(`  Unique Tags: ${stats.totalTags}`));

          if (Object.keys(stats.byCategory).length > 0) {
            console.log(chalk.white('\n  By Category:'));
            for (const [cat, count] of Object.entries(stats.byCategory)) {
              console.log(chalk.gray(`    ${cat}: ${count}`));
            }
          }

          if (Object.keys(stats.bySource).length > 0) {
            console.log(chalk.white('\n  By Source:'));
            for (const [src, count] of Object.entries(stats.bySource)) {
              console.log(chalk.gray(`    ${src}: ${count}`));
            }
          }

          if (stats.oldestTimestamp && stats.newestTimestamp) {
            console.log(chalk.white('\n  Time Range:'));
            console.log(chalk.gray(`    Oldest: ${stats.oldestTimestamp}`));
            console.log(chalk.gray(`    Newest: ${stats.newestTimestamp}`));
          }

          console.log(chalk.gray(`\n  Database: ${getDbPath()}`));
          console.log(chalk.gray(`  Backend: ${getEmbeddingBackendType()}`));
          console.log('');
        }

      } catch (error) {
        logger.error('Failed to get stats', error);
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Index command - index AI sessions
  hivemind
    .command('index')
    .description('Index AI agent sessions into semantic memory')
    .option('-d, --dir <directory>', 'Directory containing AI session files')
    .option('--claude', 'Index Claude sessions (~/.claude/projects)')
    .option('--cursor', 'Index Cursor sessions (~/.cursor-tutor)')
    .option('--opencode', 'Index OpenCode sessions (~/.config/opencode/sessions)')
    .option('--all', 'Index all known session types')
    .option('--dry-run', 'Show what would be indexed without storing')
    .action(async (options) => {
      try {
        console.log(chalk.blue('\n📚 Indexing AI sessions...\n'));

        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        const directories: string[] = [];

        // Collect directories to index
        if (options.all) {
          options.claude = true;
          options.cursor = true;
          options.opencode = true;
        }

        if (options.dir) {
          directories.push(options.dir);
        }
        if (options.claude) {
          directories.push(path.join(homeDir, '.claude', 'projects'));
        }
        if (options.cursor) {
          directories.push(path.join(homeDir, '.cursor-tutor'));
        }
        if (options.opencode) {
          directories.push(path.join(homeDir, '.config', 'opencode', 'sessions'));
        }

        // Default to all if none specified
        if (directories.length === 0) {
          directories.push(
            path.join(homeDir, '.claude', 'projects'),
            path.join(homeDir, '.cursor-tutor'),
            path.join(homeDir, '.config', 'opencode', 'sessions')
          );
        }

        let totalFiles = 0;
        let indexedFiles = 0;
        const errors: string[] = [];

        const hive = options.dryRun ? null : await initializeHivemind();

        for (const dir of directories) {
          if (!fs.existsSync(dir)) {
            console.log(chalk.gray(`  Skipping ${dir} (not found)`));
            continue;
          }

          console.log(chalk.cyan(`  Scanning: ${dir}`));

          // Recursively find JSON/Markdown files
          const files = findSessionFiles(dir);
          totalFiles += files.length;

          for (const file of files) {
            try {
              const content = fs.readFileSync(file, 'utf-8');
              const relativePath = path.relative(homeDir, file);

              // Extract meaningful content based on file type
              let extractedContent = '';
              if (file.endsWith('.json')) {
                extractedContent = extractFromJson(content);
              } else if (file.endsWith('.md')) {
                extractedContent = extractFromMarkdown(content);
              }

              if (!extractedContent || extractedContent.length < 50) {
                continue; // Skip empty or too short content
              }

              if (options.dryRun) {
                console.log(chalk.green(`    ✓ Would index: ${relativePath}`));
                console.log(chalk.gray(`      Preview: ${extractedContent.slice(0, 80)}...`));
              } else {
                const learning: Learning = {
                  id: randomUUID(),
                  content: extractedContent,
                  embedding: [],
                  metadata: {
                    source: 'session-index',
                    timestamp: new Date(),
                    tags: ['auto-indexed', 'session'],
                    category: 'pattern'
                  },
                  context: {
                    codebase: '',
                    files: [file],
                    task: 'session-index'
                  }
                };

                await hive!.save(learning);
                console.log(chalk.green(`    ✓ Indexed: ${relativePath}`));
              }

              indexedFiles++;

            } catch (err) {
              const errMsg = `Failed to process ${file}: ${err}`;
              errors.push(errMsg);
              logger.warn(errMsg);
            }
          }
        }

        if (hive) {
          await hive.close();
        }

        // Summary
        console.log(chalk.cyan('\n─────────────────────────'));
        console.log(chalk.white(`  Total files found: ${totalFiles}`));
        console.log(chalk.green(`  Files ${options.dryRun ? 'would be ' : ''}indexed: ${indexedFiles}`));
        if (errors.length > 0) {
          console.log(chalk.yellow(`  Errors: ${errors.length}`));
        }
        console.log('');

      } catch (error) {
        logger.error('Failed to index sessions', error);
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Sync command - sync learnings to git
  hivemind
    .command('sync')
    .description('Sync learnings to git-backed memories.jsonl file')
    .option('-o, --output <file>', 'Output file path', '.hive/memories.jsonl')
    .option('--append', 'Append to existing file instead of overwriting')
    .action(async (options) => {
      try {
        console.log(chalk.blue('\n🔄 Syncing learnings to git...\n'));

        const hive = await initializeHivemind();
        const learnings = await hive.getAllLearnings();
        await hive.close();

        const outputPath = options.output;
        const outputDir = path.dirname(outputPath);

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Convert learnings to JSONL format
        const lines = learnings.map(l => JSON.stringify({
          id: l.id,
          content: l.content,
          metadata: l.metadata,
          context: l.context,
          // Don't include embedding in git sync (too large)
        }));

        if (options.append && fs.existsSync(outputPath)) {
          // Append to existing file
          const existing = fs.readFileSync(outputPath, 'utf-8');
          const existingIds = new Set(
            existing.trim().split('\n')
              .filter(Boolean)
              .map(line => {
                try {
                  return JSON.parse(line).id;
                } catch {
                  return null;
                }
              })
              .filter(Boolean)
          );

          // Only add new learnings
          const newLines = lines.filter(line => {
            const parsed = JSON.parse(line);
            return !existingIds.has(parsed.id);
          });

          if (newLines.length > 0) {
            fs.appendFileSync(outputPath, '\n' + newLines.join('\n'));
          }

          console.log(chalk.green(`✓ Synced ${newLines.length} new learnings to ${outputPath}`));
          console.log(chalk.gray(`  Total in file: ${existing.trim().split('\n').filter(Boolean).length + newLines.length}`));
        } else {
          // Overwrite/create new file
          fs.writeFileSync(outputPath, lines.join('\n') + '\n');
          console.log(chalk.green(`✓ Synced ${learnings.length} learnings to ${outputPath}`));
        }

        console.log('');

      } catch (error) {
        logger.error('Failed to sync learnings', error);
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // List command - list all learnings
  hivemind
    .command('list')
    .alias('ls')
    .description('List all learnings in the memory')
    .option('-c, --category <category>', 'Filter by category')
    .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
    .option('-l, --limit <n>', 'Limit number of results', '20')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const hive = await initializeHivemind();
        let learnings = await hive.getAllLearnings();

        // Apply filters
        if (options.category) {
          learnings = learnings.filter(l => l.metadata.category === options.category);
        }

        if (options.tags) {
          const filterTags = options.tags.split(',').map((t: string) => t.trim().toLowerCase());
          learnings = learnings.filter(l =>
            l.metadata.tags.some(tag => filterTags.includes(tag.toLowerCase()))
          );
        }

        // Apply limit
        const limit = parseInt(options.limit, 10);
        if (limit > 0 && learnings.length > limit) {
          learnings = learnings.slice(0, limit);
        }

        await hive.close();

        if (options.json) {
          console.log(JSON.stringify(learnings, null, 2));
        } else {
          if (learnings.length === 0) {
            console.log(chalk.yellow('\n  No learnings found'));
          } else {
            console.log(chalk.green(`\n📚 ${learnings.length} learning(s):\n`));
            learnings.forEach((learning, index) => {
              console.log(chalk.cyan(`  ${index + 1}. ${learning.id}`));
              console.log(chalk.white(`     ${learning.content.slice(0, 80)}${learning.content.length > 80 ? '...' : ''}`));
              console.log(chalk.gray(`     Category: ${learning.metadata.category} | Tags: ${learning.metadata.tags.join(', ') || 'none'}`));
              console.log('');
            });
          }
        }

      } catch (error) {
        logger.error('Failed to list learnings', error);
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Patterns command - detect patterns
  hivemind
    .command('patterns')
    .description('Detect patterns in stored learnings')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        console.log(chalk.blue('\n🔍 Detecting patterns...\n'));

        const hive = await initializeHivemind();
        const patterns = await hive.detectPatterns();
        await hive.close();

        if (options.json) {
          console.log(JSON.stringify(patterns, null, 2));
        } else {
          if (patterns.length === 0) {
            console.log(chalk.yellow('  No patterns detected (need at least 3 similar learnings per category)'));
          } else {
            console.log(chalk.green(`✓ Detected ${patterns.length} pattern(s):\n`));
            patterns.forEach((pattern, index) => {
              console.log(chalk.cyan(`  ${index + 1}. ${pattern.name}`));
              console.log(chalk.white(`     ${pattern.description}`));
              console.log(chalk.gray(`     Frequency: ${pattern.frequency} | Confidence: ${(pattern.confidence * 100).toFixed(1)}%`));
              console.log('');
            });
          }
        }

      } catch (error) {
        logger.error('Failed to detect patterns', error);
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  return hivemind;
}

/**
 * Find session files recursively
 */
function findSessionFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and node_modules
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        // Include JSON and Markdown files
        if (entry.name.endsWith('.json') || entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Extract meaningful content from JSON file
 */
function extractFromJson(content: string): string {
  try {
    const data = JSON.parse(content);

    // Handle different session formats
    if (data.messages && Array.isArray(data.messages)) {
      // Claude/Cursor style session
      return data.messages
        .filter((m: any) => m.content && typeof m.content === 'string')
        .map((m: any) => m.content)
        .join('\n\n');
    }

    if (data.conversation && Array.isArray(data.conversation)) {
      // Generic conversation format
      return data.conversation
        .filter((m: any) => m.text || m.content)
        .map((m: any) => m.text || m.content)
        .join('\n\n');
    }

    // Fallback: stringify the whole thing (limited)
    return JSON.stringify(data, null, 2).slice(0, 2000);

  } catch {
    return content.slice(0, 500);
  }
}

/**
 * Extract meaningful content from Markdown file
 */
function extractFromMarkdown(content: string): string {
  // Remove code blocks and keep text
  let cleaned = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Keep link text
    .trim();

  // Limit length
  if (cleaned.length > 2000) {
    cleaned = cleaned.slice(0, 2000) + '...';
  }

  return cleaned;
}

export default createHivemindCommand;
