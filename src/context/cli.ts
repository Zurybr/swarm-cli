/**
 * Context Engineering CLI Commands
 *
 * Provides CLI commands for context analysis, filtering, compression,
 * and injection management.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import {
  ContextEngine,
  createChunk,
  createChunkFromFile,
  InjectionPatterns,
  createContextAwareInjections,
} from './index';
import { ContextType, PriorityLevel } from './types';

const program = new Command();

/**
 * Create context command
 */
export function createContextCommand(): Command {
  const contextCmd = new Command('context')
    .description('Context engineering commands for controlled information flow');

  // Add chunk command
  contextCmd
    .command('add')
    .description('Add a context chunk')
    .requiredOption('-c, --content <content>', 'Content to add')
    .option('-t, --type <type>', 'Chunk type', 'reference')
    .option('-s, --source <source>', 'Source identifier', 'cli')
    .option('-p, --priority <priority>', 'Priority level', 'medium')
    .option('--id <id>', 'Custom chunk ID')
    .action((options) => {
      const engine = new ContextEngine();
      const chunk = createChunk(options.content, {
        type: options.type as ContextType,
        source: options.source,
        priority: options.priority as PriorityLevel,
        id: options.id,
      });
      engine.addChunk(chunk);

      console.log(`Added chunk: ${chunk.id}`);
      console.log(`  Type: ${chunk.type}`);
      console.log(`  Source: ${chunk.source}`);
      console.log(`  Priority: ${chunk.priority}`);
      console.log(`  Tokens: ${chunk.tokenCount}`);
    });

  // Add file command
  contextCmd
    .command('add-file')
    .description('Add a file as context')
    .argument('<file>', 'Path to file')
    .option('-p, --priority <priority>', 'Priority level', 'medium')
    .option('--id <id>', 'Custom chunk ID')
    .action((filePath, options) => {
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const engine = new ContextEngine();
      const chunk = createChunkFromFile(filePath, content, {
        priority: options.priority as PriorityLevel,
        id: options.id,
      });
      engine.addChunk(chunk);

      console.log(`Added file: ${chunk.id}`);
      console.log(`  Source: ${chunk.source}`);
      console.log(`  Type: ${chunk.type}`);
      console.log(`  Tokens: ${chunk.tokenCount}`);
    });

  // Process command
  contextCmd
    .command('process')
    .description('Process context for a task')
    .requiredOption('-t, --task <task>', 'Task description')
    .option('-f, --file <file>', 'Current file being worked on')
    .option('-i, --input <file>', 'Input context JSON file')
    .option('-o, --output <file>', 'Output processed context file')
    .option('--max-tokens <n>', 'Maximum tokens', '8000')
    .option('--target-tokens <n>', 'Target tokens', '6000')
    .option('--debug', 'Enable debug output')
    .action((options) => {
      const engine = new ContextEngine({
        maxContextTokens: parseInt(options.maxTokens),
        targetContextTokens: parseInt(options.targetTokens),
        debug: options.debug,
      });

      // Load input if provided
      if (options.input) {
        if (!fs.existsSync(options.input)) {
          console.error(`Input file not found: ${options.input}`);
          process.exit(1);
        }
        const json = fs.readFileSync(options.input, 'utf-8');
        engine.importFromJSON(json);
      }

      // Add task context injection
      const injections = createContextAwareInjections(options.task, options.file);
      for (const injection of injections) {
        engine.registerInjection(injection);
      }

      // Process context
      const result = engine.processContext(options.task, options.file);

      // Output results
      console.log('\n=== Processing Results ===\n');
      console.log(`Total chunks: ${result.stats.totalChunks}`);
      console.log(`Retained: ${result.stats.retainedChunks}`);
      console.log(`Filtered: ${result.stats.filteredChunks}`);
      console.log(`Compressed: ${result.stats.compressedChunks}`);
      console.log(`Original tokens: ${result.stats.originalTokens}`);
      console.log(`Final tokens: ${result.stats.finalTokens}`);
      console.log(`Compression ratio: ${result.stats.compressionRatio.toFixed(2)}`);
      console.log(`Processing time: ${result.stats.processingTimeMs}ms`);
      console.log(`Injections applied: ${result.injections.length}`);

      // Save output if requested
      if (options.output) {
        fs.writeFileSync(options.output, result.context);
        console.log(`\nContext saved to: ${options.output}`);
      } else {
        console.log('\n=== Processed Context ===\n');
        console.log(result.context.substring(0, 2000));
        if (result.context.length > 2000) {
          console.log('\n... (truncated) ...');
        }
      }
    });

  // Analyze command
  contextCmd
    .command('analyze')
    .description('Analyze context relevance')
    .requiredOption('-t, --task <task>', 'Task description')
    .option('-i, --input <file>', 'Input context JSON file')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const engine = new ContextEngine();

      if (options.input) {
        if (!fs.existsSync(options.input)) {
          console.error(`Input file not found: ${options.input}`);
          process.exit(1);
        }
        const json = fs.readFileSync(options.input, 'utf-8');
        engine.importFromJSON(json);
      }

      const ranked = engine.rankByRelevance(options.task);

      if (options.json) {
        console.log(JSON.stringify(ranked.map((r) => ({
          id: r.chunk.id,
          type: r.chunk.type,
          source: r.chunk.source,
          score: r.score.score,
          components: r.score.components,
          matchedKeywords: r.score.matchedKeywords,
        })), null, 2));
      } else {
        console.log('\n=== Relevance Analysis ===\n');
        console.log('Ranked by relevance:\n');
        for (const { chunk, score } of ranked.slice(0, 20)) {
          console.log(`${chunk.id}`);
          console.log(`  Score: ${score.score.toFixed(3)}`);
          console.log(`  Type: ${chunk.type} | Source: ${chunk.source}`);
          console.log(`  Keywords: ${score.matchedKeywords.slice(0, 5).join(', ')}`);
          console.log(`  Reasoning: ${score.reasoning}`);
          console.log();
        }
      }
    });

  // Filter command
  contextCmd
    .command('filter')
    .description('Filter context by relevance')
    .requiredOption('-t, --task <task>', 'Task description')
    .option('-i, --input <file>', 'Input context JSON file')
    .option('--threshold <n>', 'Relevance threshold', '0.3')
    .option('--max-chunks <n>', 'Maximum chunks to keep', '100')
    .option('-o, --output <file>', 'Output filtered context file')
    .action((options) => {
      const engine = new ContextEngine();

      if (options.input) {
        if (!fs.existsSync(options.input)) {
          console.error(`Input file not found: ${options.input}`);
          process.exit(1);
        }
        const json = fs.readFileSync(options.input, 'utf-8');
        engine.importFromJSON(json);
      }

      engine.updateConfig({
        filter: {
          strategy: 'retention',
          threshold: parseFloat(options.threshold),
          maxChunks: parseInt(options.maxChunks),
          maxTokens: 8000,
          keepIds: [],
          removeIds: [],
          alwaysKeepTypes: ['instruction', 'error'],
          alwaysRemoveTypes: [],
        },
      });

      const filtered = engine.filterByRelevance(
        parseFloat(options.threshold),
        options.task
      );

      console.log(`\nFiltered ${filtered.length} chunks`);

      if (options.output) {
        const output = JSON.stringify(filtered, null, 2);
        fs.writeFileSync(options.output, output);
        console.log(`Saved to: ${options.output}`);
      } else {
        for (const chunk of filtered) {
          console.log(`\n${chunk.id} (${chunk.type})`);
          console.log(chunk.content.substring(0, 200));
        }
      }
    });

  // Compress command
  contextCmd
    .command('compress')
    .description('Compress context to target size')
    .option('-i, --input <file>', 'Input context JSON file')
    .option('--target-tokens <n>', 'Target token count', '6000')
    .option('--strategy <strategy>', 'Compression strategy', 'selective')
    .option('-o, --output <file>', 'Output compressed context file')
    .action((options) => {
      const engine = new ContextEngine();

      if (options.input) {
        if (!fs.existsSync(options.input)) {
          console.error(`Input file not found: ${options.input}`);
          process.exit(1);
        }
        const json = fs.readFileSync(options.input, 'utf-8');
        engine.importFromJSON(json);
      }

      engine.updateConfig({
        compression: {
          strategy: options.strategy as any,
          targetTokens: parseInt(options.targetTokens),
          maxTokens: parseInt(options.targetTokens) * 1.2,
          preserveCode: true,
          preserveStructure: true,
          minChunkSize: 50,
          level: 5,
        },
      });

      const result = engine.compressToSize(parseInt(options.targetTokens));

      console.log('\n=== Compression Results ===\n');
      console.log(`Original tokens: ${result.originalTokens}`);
      console.log(`Compressed tokens: ${result.compressedTokens}`);
      console.log(`Compression ratio: ${result.compressionRatio.toFixed(2)}`);
      console.log(`Information loss: ${(result.informationLoss * 100).toFixed(1)}%`);
      console.log(`Chunks processed: ${result.chunks.length}`);

      if (options.output) {
        const output = JSON.stringify(result, null, 2);
        fs.writeFileSync(options.output, output);
        console.log(`\nSaved to: ${options.output}`);
      }
    });

  // Inject command
  contextCmd
    .command('inject')
    .description('Register an injection')
    .requiredOption('-c, --content <content>', 'Content to inject')
    .option('--point <point>', 'Injection point', 'start')
    .option('--priority <n>', 'Priority', '50')
    .option('--keywords <keywords>', 'Trigger keywords (comma-separated)')
    .option('--critical', 'Mark as critical')
    .action((options) => {
      const engine = new ContextEngine();

      let injection;
      if (options.keywords) {
        const keywords = options.keywords.split(',').map((k: string) => k.trim());
        injection = InjectionPatterns.whenKeywords(
          options.content,
          keywords,
          parseInt(options.priority)
        );
      } else {
        injection = InjectionPatterns.atStart(
          options.content,
          parseInt(options.priority)
        );
      }

      if (options.critical) {
        injection.critical = true;
      }

      engine.registerInjection(injection);

      console.log(`Registered injection: ${injection.id}`);
      console.log(`  Point: ${options.point}`);
      console.log(`  Priority: ${options.priority}`);
      console.log(`  Critical: ${options.critical ? 'yes' : 'no'}`);
    });

  // Stats command
  contextCmd
    .command('stats')
    .description('Show context statistics')
    .option('-i, --input <file>', 'Input context JSON file')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const engine = new ContextEngine();

      if (options.input) {
        if (!fs.existsSync(options.input)) {
          console.error(`Input file not found: ${options.input}`);
          process.exit(1);
        }
        const json = fs.readFileSync(options.input, 'utf-8');
        engine.importFromJSON(json);
      }

      const stats = engine.getStats();

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log('\n=== Context Statistics ===\n');
        console.log(`Total chunks: ${stats.totalChunks}`);
        console.log(`Total tokens: ${stats.totalTokens}`);
        console.log('\nBy Type:');
        for (const [type, count] of Object.entries(stats.byType)) {
          console.log(`  ${type}: ${count}`);
        }
        console.log('\nBy Priority:');
        for (const [priority, count] of Object.entries(stats.byPriority)) {
          console.log(`  ${priority}: ${count}`);
        }
      }
    });

  // Export command
  contextCmd
    .command('export')
    .description('Export context to JSON')
    .option('-i, --input <file>', 'Input context JSON file')
    .option('-o, --output <file>', 'Output file (default: stdout)')
    .action((options) => {
      const engine = new ContextEngine();

      if (options.input) {
        if (!fs.existsSync(options.input)) {
          console.error(`Input file not found: ${options.input}`);
          process.exit(1);
        }
        const json = fs.readFileSync(options.input, 'utf-8');
        engine.importFromJSON(json);
      }

      const exported = engine.exportToJSON();

      if (options.output) {
        fs.writeFileSync(options.output, exported);
        console.log(`Exported to: ${options.output}`);
      } else {
        console.log(exported);
      }
    });

  // Demo command
  contextCmd
    .command('demo')
    .description('Run a context engineering demo')
    .action(() => {
      console.log('\n=== Context Engineering Demo ===\n');

      const engine = new ContextEngine({
        debug: true,
        targetContextTokens: 1000,
      });

      // Add sample chunks
      engine.addChunk(createChunk(
        'function calculateSum(a: number, b: number): number {\n  return a + b;\n}',
        { type: 'code', source: 'math.ts', priority: 'high' }
      ));

      engine.addChunk(createChunk(
        'The user wants to implement a new feature for calculating statistics.',
        { type: 'conversation', source: 'chat', priority: 'high' }
      ));

      engine.addChunk(createChunk(
        '# Project Documentation\n\nThis is a sample documentation file with important information.',
        { type: 'documentation', source: 'README.md', priority: 'medium' }
      ));

      engine.addChunk(createChunk(
        'Error: Cannot find module "lodash"',
        { type: 'error', source: 'build', priority: 'critical' }
      ));

      engine.addChunk(createChunk(
        'Some old debug output that is no longer relevant to the current task.',
        { type: 'output', source: 'debug', priority: 'low' }
      ));

      // Process for a task
      const result = engine.processContext(
        'Implement a statistics calculation module',
        'stats.ts'
      );

      console.log('\n=== Demo Complete ===');
      console.log(`\nProcessed ${result.stats.totalChunks} chunks`);
      console.log(`Final context size: ${result.stats.finalTokens} tokens`);
      console.log(`Compression: ${(result.stats.compressionRatio * 100).toFixed(0)}%`);
    });

  return contextCmd;
}

// Export for use in main CLI
export default createContextCommand;
