/**
 * Context Engineering - Main ContextEngine Class
 *
 * Orchestrates context analysis, filtering, compression, and injection
 * to control information flow to the context.
 */

import {
  ContextChunk,
  ContextEngineConfig,
  ProcessedContext,
  ContextStats,
  TaskContext,
  RelevanceScore,
  FilterResult,
  CompressionResult,
  InjectionResult,
  DEFAULT_CONTEXT_ENGINE_CONFIG,
  InjectionPayload,
} from './types';

import {
  RelevanceAnalyzer,
  calculateRelevance,
  rankChunks,
  buildTaskContext,
} from './analyzer';

import {
  ContextFilter,
  filterContext,
} from './filter';

import {
  ContextCompressor,
  compressContext,
} from './compress';

import {
  ContextInjector,
  createContextAwareInjections,
} from './injector';

/**
 * Main ContextEngine class
 */
export class ContextEngine {
  private config: ContextEngineConfig;
  private analyzer: RelevanceAnalyzer;
  private filter: ContextFilter;
  private compressor: ContextCompressor;
  private injector: ContextInjector;
  private chunks: ContextChunk[] = [];

  constructor(config: Partial<ContextEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONTEXT_ENGINE_CONFIG, ...config };
    this.analyzer = new RelevanceAnalyzer(this.config.relevance);
    this.filter = new ContextFilter(this.config.filter);
    this.compressor = new ContextCompressor(this.config.compression);
    this.injector = new ContextInjector();
  }

  /**
   * Add a context chunk
   */
  addChunk(chunk: ContextChunk): void {
    this.chunks.push(chunk);
  }

  /**
   * Add multiple context chunks
   */
  addChunks(chunks: ContextChunk[]): void {
    this.chunks.push(...chunks);
  }

  /**
   * Remove a chunk by ID
   */
  removeChunk(chunkId: string): boolean {
    const index = this.chunks.findIndex((c) => c.id === chunkId);
    if (index >= 0) {
      this.chunks.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all chunks
   */
  clearChunks(): void {
    this.chunks = [];
  }

  /**
   * Get all chunks
   */
  getChunks(): ContextChunk[] {
    return [...this.chunks];
  }

  /**
   * Process context for a given task
   */
  processContext(taskDescription: string, currentFile?: string): ProcessedContext {
    const startTime = Date.now();

    // Build task context
    const taskContext = buildTaskContext(
      taskDescription,
      currentFile,
      [],
      []
    );

    if (this.config.debug) {
      console.log('Task Context:', taskContext);
    }

    // Step 1: Analyze relevance
    const relevanceScores = this.analyzer.analyzeBatch(this.chunks, taskContext);

    if (this.config.debug) {
      console.log('Relevance Scores:',
        Array.from(relevanceScores.entries()).map(([id, score]) =>
          `${id}: ${score.score.toFixed(2)}`
        )
      );
    }

    // Step 2: Filter chunks
    const filterResult = this.filter.filter(this.chunks, relevanceScores);

    if (this.config.debug) {
      console.log('Filter Result:', {
        retained: filterResult.retained.length,
        removed: filterResult.removed.length,
        summarized: filterResult.summarized.length,
      });
    }

    // Step 3: Compress if needed
    const chunksToCompress = [
      ...filterResult.retained,
      ...filterResult.summarized.map((s) => ({
        ...s.original,
        content: s.summary,
        tokenCount: Math.ceil(s.summary.length / 4),
      })),
    ];

    const totalTokens = chunksToCompress.reduce((sum, c) => sum + c.tokenCount, 0);
    let compressedResult: CompressionResult | null = null;

    if (totalTokens > this.config.targetContextTokens) {
      compressedResult = this.compressor.compress(chunksToCompress);

      if (this.config.debug) {
        console.log('Compression Result:', {
          originalTokens: compressedResult.originalTokens,
          compressedTokens: compressedResult.compressedTokens,
          ratio: compressedResult.compressionRatio.toFixed(2),
        });
      }
    }

    // Step 4: Build final context string
    let finalChunks = compressedResult
      ? compressedResult.chunks.map((c) => ({
          id: c.originalId,
          content: c.content,
          type: 'reference' as const,
          source: 'compressed',
          timestamp: Date.now(),
          tokenCount: c.compressedTokens,
          priority: 'medium' as const,
        }))
      : chunksToCompress;

    // Step 5: Apply injections
    const contextString = this.buildContextString(finalChunks);
    const { context: finalContext, results: injectionResults } =
      this.injector.applyInjections(contextString, finalChunks, 'start');

    // Calculate stats
    const processingTimeMs = Date.now() - startTime;
    const stats: ContextStats = {
      totalChunks: this.chunks.length,
      retainedChunks: filterResult.retained.length,
      filteredChunks: filterResult.removed.length,
      compressedChunks: compressedResult?.chunks.filter((c) => c.truncated || c.summarized).length || 0,
      originalTokens: this.chunks.reduce((sum, c) => sum + c.tokenCount, 0),
      finalTokens: compressedResult?.compressedTokens || totalTokens,
      processingTimeMs,
      compressionRatio: compressedResult?.compressionRatio || 1,
    };

    return {
      context: finalContext,
      chunks: finalChunks,
      stats,
      injections: injectionResults,
    };
  }

  /**
   * Build context string from chunks
   */
  private buildContextString(chunks: ContextChunk[]): string {
    return chunks
      .map((chunk) => {
        const header = `<!-- ${chunk.type} from ${chunk.source} -->`;
        return `${header}\n${chunk.content}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * Register an injection
   */
  registerInjection(payload: InjectionPayload): void {
    this.injector.register(payload);
  }

  /**
   * Quick filter by relevance threshold
   */
  filterByRelevance(
    threshold?: number,
    taskDescription?: string,
    currentFile?: string
  ): ContextChunk[] {
    const taskContext = taskDescription
      ? buildTaskContext(taskDescription, currentFile)
      : buildTaskContext('', currentFile);

    const scores = this.analyzer.analyzeBatch(this.chunks, taskContext);
    return this.filter.filterByThreshold(this.chunks, scores, threshold);
  }

  /**
   * Compress context to target size
   */
  compressToSize(targetTokens: number): CompressionResult {
    this.compressor.updateConfig({ targetTokens });
    return this.compressor.compress(this.chunks);
  }

  /**
   * Rank chunks by relevance to a task
   */
  rankByRelevance(taskDescription: string, currentFile?: string): Array<{
    chunk: ContextChunk;
    score: RelevanceScore;
  }> {
    const taskContext = buildTaskContext(taskDescription, currentFile);
    return this.analyzer.rank(this.chunks, taskContext);
  }

  /**
   * Get context statistics
   */
  getStats(): {
    totalChunks: number;
    totalTokens: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    for (const chunk of this.chunks) {
      byType[chunk.type] = (byType[chunk.type] || 0) + 1;
      byPriority[chunk.priority] = (byPriority[chunk.priority] || 0) + 1;
    }

    return {
      totalChunks: this.chunks.length,
      totalTokens: this.chunks.reduce((sum, c) => sum + c.tokenCount, 0),
      byType,
      byPriority,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContextEngineConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.relevance) {
      this.analyzer.updateConfig(config.relevance);
    }
    if (config.filter) {
      this.filter.updateConfig(config.filter);
    }
    if (config.compression) {
      this.compressor.updateConfig(config.compression);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ContextEngineConfig {
    return { ...this.config };
  }

  /**
   * Export context to JSON
   */
  exportToJSON(): string {
    return JSON.stringify(
      {
        config: this.config,
        chunks: this.chunks,
        stats: this.getStats(),
      },
      null,
      2
    );
  }

  /**
   * Import context from JSON
   */
  importFromJSON(json: string): void {
    const data = JSON.parse(json);
    this.chunks = data.chunks || [];
    if (data.config) {
      this.updateConfig(data.config);
    }
  }
}

/**
 * Create a context chunk from content
 */
export function createChunk(
  content: string,
  options: Partial<Omit<ContextChunk, 'content' | 'id' | 'timestamp'>> & {
    id?: string;
  } = {}
): ContextChunk {
  const id = options.id || `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const tokenCount = Math.ceil(content.length / 4);

  return {
    id,
    content,
    type: options.type || 'reference',
    source: options.source || 'unknown',
    timestamp: Date.now(),
    tokenCount,
    priority: options.priority || 'medium',
    metadata: options.metadata,
  };
}

/**
 * Create a context chunk from a file
 */
export function createChunkFromFile(
  filePath: string,
  content: string,
  options: Partial<Omit<ContextChunk, 'content' | 'source' | 'timestamp'>> & { id?: string } = {}
): ContextChunk {
  // Determine type from file extension
  let type: ContextChunk['type'] = 'code';
  if (filePath.endsWith('.md') || filePath.endsWith('.txt')) {
    type = 'documentation';
  } else if (filePath.includes('test')) {
    type = 'reference';
  }

  return createChunk(content, {
    ...options,
    type,
    source: filePath,
  });
}

/**
 * Estimate token count from text
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

// Re-export types and functions
export * from './types';
export { RelevanceAnalyzer, calculateRelevance, rankChunks, buildTaskContext } from './analyzer';
export { ContextFilter, filterContext } from './filter';
export { ContextCompressor, compressContext } from './compress';
export {
  ContextInjector,
  createTrigger,
  createCondition,
  createInjection,
  InjectionPatterns,
  registerInjections,
  createContextAwareInjections,
} from './injector';

// Default export
export default ContextEngine;
