/**
 * Context Relevance Analyzer
 *
 * Analyzes the relevance of context chunks to the current task
 * using keyword matching, semantic similarity, and task context.
 */

import {
  ContextChunk,
  RelevanceScore,
  TaskContext,
  RelevanceConfig,
  DEFAULT_RELEVANCE_CONFIG,
  PriorityLevel,
} from './types';

/**
 * Calculate relevance score for a context chunk
 */
export function calculateRelevance(
  chunk: ContextChunk,
  taskContext: TaskContext,
  config: RelevanceConfig = DEFAULT_RELEVANCE_CONFIG
): RelevanceScore {
  const keywordScore = calculateKeywordMatch(chunk, taskContext, config);
  const semanticScore = calculateSemanticSimilarity(chunk, taskContext);
  const taskContextScore = calculateTaskContextRelevance(chunk, taskContext);
  const recencyScore = calculateRecencyScore(chunk, config);
  const priorityScore = calculatePriorityScore(chunk);

  // Calculate weighted average
  const score =
    keywordScore * config.weights.keywordMatch +
    semanticScore * config.weights.semanticSimilarity +
    taskContextScore * config.weights.taskContext +
    recencyScore * config.weights.recency +
    priorityScore * config.weights.priority;

  return {
    score: Math.min(1, Math.max(0, score)),
    components: {
      keywordMatch: keywordScore,
      semanticSimilarity: semanticScore,
      taskContext: taskContextScore,
      recency: recencyScore,
      priority: priorityScore,
    },
    matchedKeywords: extractMatchedKeywords(chunk, taskContext),
    reasoning: generateReasoning(
      chunk,
      keywordScore,
      semanticScore,
      taskContextScore,
      recencyScore,
      priorityScore
    ),
  };
}

/**
 * Calculate keyword matching score
 */
function calculateKeywordMatch(
  chunk: ContextChunk,
  taskContext: TaskContext,
  config: RelevanceConfig
): number {
  const content = chunk.content.toLowerCase();
  const allKeywords = [
    ...taskContext.keywords,
    ...taskContext.concepts,
    ...taskContext.stack,
  ].map((k) => k.toLowerCase());

  if (allKeywords.length === 0) return 0.5;

  let matchCount = 0;
  let boostedMatches = 0;
  let penalizedMatches = 0;

  for (const keyword of allKeywords) {
    const count = (content.match(new RegExp(`\\b${keyword}\\b`, 'gi')) || []).length;
    if (count > 0) {
      matchCount++;
      if (config.boostKeywords.some((bk) => keyword.includes(bk.toLowerCase()))) {
        boostedMatches += count;
      }
      if (config.penalizeKeywords.some((pk) => keyword.includes(pk.toLowerCase()))) {
        penalizedMatches += count;
      }
    }
  }

  const baseScore = matchCount / allKeywords.length;
  const boost = Math.min(0.3, boostedMatches * 0.1);
  const penalty = Math.min(0.3, penalizedMatches * 0.1);

  return Math.min(1, Math.max(0, baseScore + boost - penalty));
}

/**
 * Calculate semantic similarity score (simplified version)
 * In a real implementation, this would use embeddings
 */
function calculateSemanticSimilarity(
  chunk: ContextChunk,
  taskContext: TaskContext
): number {
  // Simplified semantic similarity based on word overlap and n-grams
  const chunkWords = new Set(chunk.content.toLowerCase().split(/\s+/));
  const taskWords = new Set(
    [
      taskContext.task,
      ...taskContext.keywords,
      ...taskContext.concepts,
    ]
      .join(' ')
      .toLowerCase()
      .split(/\s+/)
  );

  const intersection = new Set(Array.from(chunkWords).filter((w) => taskWords.has(w)));
  const union = new Set([...Array.from(chunkWords), ...Array.from(taskWords)]);

  if (union.size === 0) return 0.5;

  // Jaccard similarity
  const jaccard = intersection.size / union.size;

  // Boost for code type chunks when working with code
  if (chunk.type === 'code' && taskContext.stack.length > 0) {
    return Math.min(1, jaccard * 1.2);
  }

  return jaccard;
}

/**
 * Calculate task context relevance
 */
function calculateTaskContextRelevance(
  chunk: ContextChunk,
  taskContext: TaskContext
): number {
  let score = 0.5;

  // Boost for matching current file
  if (taskContext.currentFile && chunk.source.includes(taskContext.currentFile)) {
    score += 0.3;
  }

  // Boost for code chunks when task involves implementation
  if (chunk.type === 'code' && taskContext.task.toLowerCase().includes('implement')) {
    score += 0.1;
  }

  // Boost for documentation when task involves understanding
  if (chunk.type === 'documentation' &&
      (taskContext.task.toLowerCase().includes('understand') ||
       taskContext.task.toLowerCase().includes('learn'))) {
    score += 0.1;
  }

  // Boost for error chunks when task involves fixing
  if (chunk.type === 'error' &&
      (taskContext.task.toLowerCase().includes('fix') ||
       taskContext.task.toLowerCase().includes('debug'))) {
    score += 0.2;
  }

  // Consider action history
  const recentActions = taskContext.actionHistory.slice(-5);
  for (const action of recentActions) {
    const actionKeywords = action.toLowerCase().split(/\s+/);
    const chunkWords = chunk.content.toLowerCase();
    for (const keyword of actionKeywords) {
      if (chunkWords.includes(keyword) && keyword.length > 3) {
        score += 0.02;
      }
    }
  }

  return Math.min(1, score);
}

/**
 * Calculate recency score
 */
function calculateRecencyScore(
  chunk: ContextChunk,
  config: RelevanceConfig
): number {
  const now = Date.now();
  const age = now - chunk.timestamp;
  const ageInHours = age / (1000 * 60 * 60);

  // Exponential decay based on age
  const decay = Math.exp(-config.timeDecayFactor * ageInHours);

  // Recent chunks (less than 1 hour) get a boost
  if (ageInHours < 1) {
    return Math.min(1, 0.8 + decay * 0.2);
  }

  // Older chunks decay
  return Math.max(0.2, decay);
}

/**
 * Calculate priority score based on chunk priority level
 */
function calculatePriorityScore(chunk: ContextChunk): number {
  const priorityScores: Record<PriorityLevel, number> = {
    critical: 1.0,
    high: 0.8,
    medium: 0.5,
    low: 0.3,
    discardable: 0.1,
  };

  return priorityScores[chunk.priority] ?? 0.5;
}

/**
 * Extract matched keywords from chunk
 */
function extractMatchedKeywords(
  chunk: ContextChunk,
  taskContext: TaskContext
): string[] {
  const content = chunk.content.toLowerCase();
  const allKeywords = [
    ...taskContext.keywords,
    ...taskContext.concepts,
    ...taskContext.stack,
  ];

  return allKeywords.filter((keyword) =>
    content.includes(keyword.toLowerCase())
  );
}

/**
 * Generate reasoning for the relevance score
 */
function generateReasoning(
  chunk: ContextChunk,
  keywordScore: number,
  semanticScore: number,
  taskContextScore: number,
  recencyScore: number,
  priorityScore: number
): string {
  const reasons: string[] = [];

  if (keywordScore > 0.7) {
    reasons.push('Strong keyword match');
  } else if (keywordScore > 0.4) {
    reasons.push('Moderate keyword match');
  }

  if (semanticScore > 0.6) {
    reasons.push('High semantic similarity');
  }

  if (taskContextScore > 0.7) {
    reasons.push('Highly relevant to task context');
  }

  if (recencyScore > 0.8) {
    reasons.push('Very recent');
  }

  if (priorityScore > 0.8) {
    reasons.push(`High priority (${chunk.priority})`);
  }

  if (reasons.length === 0) {
    reasons.push('Low overall relevance');
  }

  return reasons.join('; ');
}

/**
 * Batch analyze multiple chunks
 */
export function analyzeChunks(
  chunks: ContextChunk[],
  taskContext: TaskContext,
  config: RelevanceConfig = DEFAULT_RELEVANCE_CONFIG
): Map<string, RelevanceScore> {
  const results = new Map<string, RelevanceScore>();

  for (const chunk of chunks) {
    const score = calculateRelevance(chunk, taskContext, config);
    results.set(chunk.id, score);
  }

  return results;
}

/**
 * Rank chunks by relevance
 */
export function rankChunks(
  chunks: ContextChunk[],
  taskContext: TaskContext,
  config: RelevanceConfig = DEFAULT_RELEVANCE_CONFIG
): Array<{ chunk: ContextChunk; score: RelevanceScore }> {
  const scored = chunks.map((chunk) => ({
    chunk,
    score: calculateRelevance(chunk, taskContext, config),
  }));

  return scored.sort((a, b) => b.score.score - a.score.score);
}

/**
 * Extract keywords from text
 */
export function extractKeywords(text: string): string[] {
  // Remove common stop words
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall',
    'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
    'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
    'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'and', 'but', 'or', 'yet', 'so',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Count frequency
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  // Return top keywords by frequency
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

/**
 * Build task context from task description
 */
export function buildTaskContext(
  task: string,
  currentFile?: string,
  stack: string[] = [],
  actionHistory: string[] = []
): TaskContext {
  const keywords = extractKeywords(task);

  // Extract concepts (multi-word phrases)
  const concepts: string[] = [];
  const phrases = task.match(/\b\w+(?:\s+\w+){1,3}\b/g) || [];
  for (const phrase of phrases) {
    if (phrase.length > 5 && !concepts.includes(phrase)) {
      concepts.push(phrase);
    }
  }

  return {
    task,
    currentFile,
    keywords,
    concepts,
    stack,
    actionHistory,
  };
}

/**
 * Relevance Analyzer class for more complex analysis
 */
export class RelevanceAnalyzer {
  private config: RelevanceConfig;
  private cache: Map<string, RelevanceScore> = new Map();

  constructor(config: Partial<RelevanceConfig> = {}) {
    this.config = { ...DEFAULT_RELEVANCE_CONFIG, ...config };
  }

  /**
   * Analyze a single chunk
   */
  analyze(chunk: ContextChunk, taskContext: TaskContext): RelevanceScore {
    const cacheKey = `${chunk.id}:${taskContext.task}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const score = calculateRelevance(chunk, taskContext, this.config);
    this.cache.set(cacheKey, score);
    return score;
  }

  /**
   * Analyze multiple chunks
   */
  analyzeBatch(
    chunks: ContextChunk[],
    taskContext: TaskContext
  ): Map<string, RelevanceScore> {
    const results = new Map<string, RelevanceScore>();

    for (const chunk of chunks) {
      results.set(chunk.id, this.analyze(chunk, taskContext));
    }

    return results;
  }

  /**
   * Rank chunks by relevance
   */
  rank(
    chunks: ContextChunk[],
    taskContext: TaskContext
  ): Array<{ chunk: ContextChunk; score: RelevanceScore }> {
    return rankChunks(chunks, taskContext, this.config);
  }

  /**
   * Filter chunks by relevance threshold
   */
  filter(
    chunks: ContextChunk[],
    taskContext: TaskContext,
    threshold?: number
  ): ContextChunk[] {
    const minScore = threshold ?? this.config.threshold;
    const ranked = this.rank(chunks, taskContext);
    return ranked
      .filter((r) => r.score.score >= minScore)
      .map((r) => r.chunk);
  }

  /**
   * Clear the analysis cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RelevanceConfig>): void {
    this.config = { ...this.config, ...config };
    this.clearCache();
  }
}
