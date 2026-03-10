/**
 * Context Filter
 *
 * Filters context chunks based on relevance scores and configured strategies.
 * Supports retention, exclusion, and summarization strategies.
 */

import {
  ContextChunk,
  FilterConfig,
  FilterResult,
  FilterStats,
  SummarizedChunk,
  DEFAULT_FILTER_CONFIG,
  ContextType,
  RelevanceScore,
} from './types';

/**
 * Filter context chunks based on configuration
 */
export function filterContext(
  chunks: ContextChunk[],
  relevanceScores: Map<string, RelevanceScore>,
  config: FilterConfig = DEFAULT_FILTER_CONFIG
): FilterResult {
  const startTime = Date.now();
  const stats: FilterStats = {
    totalBefore: chunks.length,
    totalAfter: 0,
    tokensBefore: chunks.reduce((sum, c) => sum + c.tokenCount, 0),
    tokensAfter: 0,
    removedCount: 0,
    summarizedCount: 0,
  };

  const retained: ContextChunk[] = [];
  const removed: ContextChunk[] = [];
  const summarized: SummarizedChunk[] = [];

  // Phase 1: Apply hard rules (always keep/remove by ID and type)
  const { alwaysKeep, alwaysRemove, toProcess } = applyHardRules(chunks, config);

  // Add always-keep chunks directly to retained
  retained.push(...alwaysKeep);
  // Add always-remove chunks directly to removed
  removed.push(...alwaysRemove);

  // Phase 2: Apply strategy-specific filtering to remaining chunks
  switch (config.strategy) {
    case 'retention':
      applyRetentionStrategy(
        toProcess,
        relevanceScores,
        config,
        retained,
        removed
      );
      break;
    case 'exclusion':
      applyExclusionStrategy(
        toProcess,
        relevanceScores,
        config,
        retained,
        removed
      );
      break;
    case 'summarization':
      applySummarizationStrategy(
        toProcess,
        relevanceScores,
        config,
        retained,
        summarized,
        removed
      );
      break;
    default:
      applyRetentionStrategy(
        toProcess,
        relevanceScores,
        config,
        retained,
        removed
      );
  }

  // Phase 3: Apply token limit if exceeded
  const result = applyTokenLimit(retained, summarized, config, stats);

  stats.totalAfter = result.retained.length + result.summarized.length;
  stats.tokensAfter =
    result.retained.reduce((sum, c) => sum + c.tokenCount, 0) +
    result.summarized.reduce((sum, s) => sum + estimateTokens(s.summary), 0);
  stats.removedCount = removed.length + result.removed.length;
  stats.summarizedCount = result.summarized.length;

  return {
    retained: result.retained,
    removed: [...removed, ...result.removed],
    summarized: result.summarized,
    stats,
  };
}

/**
 * Hard rule result
 */
interface HardRuleResult {
  /** Chunks to always keep */
  alwaysKeep: ContextChunk[];
  /** Chunks to always remove */
  alwaysRemove: ContextChunk[];
  /** Chunks to process normally */
  toProcess: ContextChunk[];
}

/**
 * Apply hard rules (always keep/remove by ID and type)
 */
function applyHardRules(
  chunks: ContextChunk[],
  config: FilterConfig
): HardRuleResult {
  const alwaysKeep: ContextChunk[] = [];
  const alwaysRemove: ContextChunk[] = [];
  const toProcess: ContextChunk[] = [];

  for (const chunk of chunks) {
    // Always keep by ID
    if (config.keepIds.includes(chunk.id)) {
      alwaysKeep.push(chunk);
      continue;
    }

    // Always remove by ID
    if (config.removeIds.includes(chunk.id)) {
      alwaysRemove.push(chunk);
      continue;
    }

    // Always keep by type
    if (config.alwaysKeepTypes.includes(chunk.type)) {
      alwaysKeep.push(chunk);
      continue;
    }

    // Always remove by type
    if (config.alwaysRemoveTypes.includes(chunk.type)) {
      alwaysRemove.push(chunk);
      continue;
    }

    toProcess.push(chunk);
  }

  return { alwaysKeep, alwaysRemove, toProcess };
}

/**
 * Apply retention strategy - keep chunks above threshold
 */
function applyRetentionStrategy(
  chunks: ContextChunk[],
  relevanceScores: Map<string, RelevanceScore>,
  config: FilterConfig,
  retained: ContextChunk[],
  removed: ContextChunk[]
): void {
  // Sort by relevance score
  const sorted = [...chunks].sort((a, b) => {
    const scoreA = relevanceScores.get(a.id)?.score ?? 0;
    const scoreB = relevanceScores.get(b.id)?.score ?? 0;
    return scoreB - scoreA;
  });

  for (const chunk of sorted) {
    const score = relevanceScores.get(chunk.id)?.score ?? 0;

    // Keep if above threshold and within max chunks limit
    if (score >= config.threshold && retained.length < config.maxChunks) {
      retained.push(chunk);
    } else {
      removed.push(chunk);
    }
  }
}

/**
 * Apply exclusion strategy - remove chunks below threshold
 */
function applyExclusionStrategy(
  chunks: ContextChunk[],
  relevanceScores: Map<string, RelevanceScore>,
  config: FilterConfig,
  retained: ContextChunk[],
  removed: ContextChunk[]
): void {
  for (const chunk of chunks) {
    const score = relevanceScores.get(chunk.id)?.score ?? 0;

    // Remove if below threshold
    if (score < config.threshold) {
      removed.push(chunk);
    } else {
      retained.push(chunk);
    }
  }

  // Apply max chunks limit if exceeded
  if (retained.length > config.maxChunks) {
    // Sort by relevance and keep top N
    retained.sort((a, b) => {
      const scoreA = relevanceScores.get(a.id)?.score ?? 0;
      const scoreB = relevanceScores.get(b.id)?.score ?? 0;
      return scoreB - scoreA;
    });

    const excess = retained.splice(config.maxChunks);
    removed.push(...excess);
  }
}

/**
 * Apply summarization strategy - summarize low-relevance chunks
 */
function applySummarizationStrategy(
  chunks: ContextChunk[],
  relevanceScores: Map<string, RelevanceScore>,
  config: FilterConfig,
  retained: ContextChunk[],
  summarized: SummarizedChunk[],
  removed: ContextChunk[]
): void {
  // Sort by relevance score
  const sorted = [...chunks].sort((a, b) => {
    const scoreA = relevanceScores.get(a.id)?.score ?? 0;
    const scoreB = relevanceScores.get(b.id)?.score ?? 0;
    return scoreB - scoreA;
  });

  for (const chunk of sorted) {
    const score = relevanceScores.get(chunk.id)?.score ?? 0;

    if (score >= config.threshold && retained.length < config.maxChunks * 0.7) {
      // High relevance - keep full
      retained.push(chunk);
    } else if (
      score >= config.threshold * 0.5 &&
      summarized.length < config.maxChunks * 0.3
    ) {
      // Medium relevance - summarize
      const summary = summarizeChunk(chunk);
      summarized.push({
        originalId: chunk.id,
        summary,
        original: chunk,
        compressionRatio: summary.length / chunk.content.length,
      });
    } else {
      // Low relevance - remove
      removed.push(chunk);
    }
  }
}

/**
 * Apply token limit constraints
 */
function applyTokenLimit(
  retained: ContextChunk[],
  summarized: SummarizedChunk[],
  config: FilterConfig,
  stats: FilterStats
): { retained: ContextChunk[]; summarized: SummarizedChunk[]; removed: ContextChunk[] } {
  const resultRetained: ContextChunk[] = [];
  const resultSummarized: SummarizedChunk[] = [];
  const removed: ContextChunk[] = [];

  let currentTokens = 0;

  // First, add summarized chunks (they're already compressed)
  for (const summary of summarized) {
    const tokens = estimateTokens(summary.summary);
    if (currentTokens + tokens <= config.maxTokens) {
      resultSummarized.push(summary);
      currentTokens += tokens;
    } else {
      removed.push(summary.original);
    }
  }

  // Then, add retained chunks in priority order
  const sortedRetained = [...retained].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, discardable: 4 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  for (const chunk of sortedRetained) {
    if (currentTokens + chunk.tokenCount <= config.maxTokens) {
      resultRetained.push(chunk);
      currentTokens += chunk.tokenCount;
    } else {
      // Try to summarize if too large
      if (chunk.tokenCount > 100) {
        const summary = summarizeChunk(chunk);
        const summaryTokens = estimateTokens(summary);
        if (currentTokens + summaryTokens <= config.maxTokens) {
          resultSummarized.push({
            originalId: chunk.id,
            summary,
            original: chunk,
            compressionRatio: summary.length / chunk.content.length,
          });
          currentTokens += summaryTokens;
          continue;
        }
      }
      removed.push(chunk);
    }
  }

  return {
    retained: resultRetained,
    summarized: resultSummarized,
    removed,
  };
}

/**
 * Summarize a context chunk
 */
function summarizeChunk(chunk: ContextChunk): string {
  const lines = chunk.content.split('\n');

  // For code, keep structure but reduce detail
  if (chunk.type === 'code') {
    return summarizeCode(lines);
  }

  // For documentation, extract key points
  if (chunk.type === 'documentation') {
    return summarizeDocumentation(lines);
  }

  // For conversation, extract key messages
  if (chunk.type === 'conversation') {
    return summarizeConversation(lines);
  }

  // Default: truncate with ellipsis
  return truncateWithEllipsis(chunk.content, 200);
}

/**
 * Summarize code content
 */
function summarizeCode(lines: string[]): string {
  const result: string[] = [];
  let inFunction = false;
  let functionLines: string[] = [];
  let functionName = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect function/method/class definitions
    const funcMatch =
      trimmed.match(/^(export\s+)?(async\s+)?function\s+(\w+)/) ||
      trimmed.match(/^(export\s+)?class\s+(\w+)/) ||
      trimmed.match(/^(export\s+)?(const|let|var)\s+(\w+)\s*[=:]\s*(async\s*)?\(/);

    if (funcMatch) {
      // Save previous function if any
      if (inFunction && functionName) {
        result.push(`// ${functionName}: ${functionLines.length} lines`);
      }

      inFunction = true;
      functionName = funcMatch[3] || funcMatch[2] || 'anonymous';
      functionLines = [line];
    } else if (inFunction) {
      functionLines.push(line);

      // Detect function end (simplified)
      if (trimmed === '}' && functionLines.length > 1) {
        result.push(`// ${functionName}: ${functionLines.length} lines`);
        inFunction = false;
        functionLines = [];
      }
    } else {
      result.push(line);
    }
  }

  // Handle any remaining function
  if (inFunction && functionName) {
    result.push(`// ${functionName}: ${functionLines.length} lines`);
  }

  return result.join('\n');
}

/**
 * Summarize documentation content
 */
function summarizeDocumentation(lines: string[]): string {
  const keyPoints: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Keep code blocks
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      keyPoints.push(line);
      continue;
    }

    if (inCodeBlock) {
      keyPoints.push(line);
      continue;
    }

    // Extract headers
    if (trimmed.startsWith('#')) {
      keyPoints.push(line);
      continue;
    }

    // Extract list items
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      keyPoints.push(line);
      continue;
    }

    // Extract important sentences
    if (
      trimmed.includes('important') ||
      trimmed.includes('note:') ||
      trimmed.includes('warning:') ||
      trimmed.includes('must') ||
      trimmed.includes('required')
    ) {
      keyPoints.push(line);
    }
  }

  // If no key points extracted, take first and last few lines
  if (keyPoints.length === 0) {
    const firstLines = lines.slice(0, 3);
    const lastLines = lines.slice(-2);
    return [...firstLines, '...', ...lastLines].join('\n');
  }

  return keyPoints.join('\n');
}

/**
 * Summarize conversation content
 */
function summarizeConversation(lines: string[]): string {
  const messages: string[] = [];
  let currentSpeaker = '';
  let currentMessage: string[] = [];

  for (const line of lines) {
    const speakerMatch = line.match(/^(\w+):\s*(.*)$/);

    if (speakerMatch) {
      // Save previous message
      if (currentSpeaker && currentMessage.length > 0) {
        const content = currentMessage.join(' ');
        if (content.length > 100) {
          messages.push(`${currentSpeaker}: ${content.substring(0, 100)}...`);
        } else {
          messages.push(`${currentSpeaker}: ${content}`);
        }
      }

      currentSpeaker = speakerMatch[1];
      currentMessage = [speakerMatch[2]];
    } else if (currentSpeaker) {
      currentMessage.push(line.trim());
    }
  }

  // Save last message
  if (currentSpeaker && currentMessage.length > 0) {
    const content = currentMessage.join(' ');
    if (content.length > 100) {
      messages.push(`${currentSpeaker}: ${content.substring(0, 100)}...`);
    } else {
      messages.push(`${currentSpeaker}: ${content}`);
    }
  }

  // Keep only first and last few messages if too many
  if (messages.length > 5) {
    return [...messages.slice(0, 2), '...', ...messages.slice(-2)].join('\n');
  }

  return messages.join('\n');
}

/**
 * Truncate text with ellipsis
 */
function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const halfLength = Math.floor((maxLength - 3) / 2);
  return (
    text.substring(0, halfLength) + '...' + text.substring(text.length - halfLength)
  );
}

/**
 * Estimate token count from text
 * Rough approximation: 1 token ≈ 4 characters
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Context Filter class for stateful filtering
 */
export class ContextFilter {
  private config: FilterConfig;

  constructor(config: Partial<FilterConfig> = {}) {
    this.config = { ...DEFAULT_FILTER_CONFIG, ...config };
  }

  /**
   * Filter chunks
   */
  filter(
    chunks: ContextChunk[],
    relevanceScores: Map<string, RelevanceScore>
  ): FilterResult {
    return filterContext(chunks, relevanceScores, this.config);
  }

  /**
   * Quick filter by threshold only
   */
  filterByThreshold(
    chunks: ContextChunk[],
    relevanceScores: Map<string, RelevanceScore>,
    threshold?: number
  ): ContextChunk[] {
    const minScore = threshold ?? this.config.threshold;
    return chunks.filter((chunk) => {
      const score = relevanceScores.get(chunk.id)?.score ?? 0;
      return score >= minScore;
    });
  }

  /**
   * Quick filter by type
   */
  filterByType(chunks: ContextChunk[], types: ContextType[]): ContextChunk[] {
    return chunks.filter((chunk) => types.includes(chunk.type));
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FilterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): FilterConfig {
    return { ...this.config };
  }
}
