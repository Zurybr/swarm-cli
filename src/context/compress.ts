/**
 * Context Compression
 *
 * Implements selective compression strategies for context chunks.
 * Supports truncation, summarization, hierarchical compression,
 * deduplication, and selective compression.
 */

import {
  ContextChunk,
  CompressionConfig,
  CompressionResult,
  CompressedChunk,
  HierarchicalSummary,
  DEFAULT_COMPRESSION_CONFIG,
} from './types';

/**
 * Compress context chunks based on configuration
 */
export function compressContext(
  chunks: ContextChunk[],
  config: CompressionConfig = DEFAULT_COMPRESSION_CONFIG
): CompressionResult {
  const startTime = Date.now();
  const originalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

  let compressedChunks: CompressedChunk[] = [];

  switch (config.strategy) {
    case 'truncate':
      compressedChunks = applyTruncation(chunks, config);
      break;
    case 'summarize':
      compressedChunks = applySummarization(chunks, config);
      break;
    case 'hierarchical':
      compressedChunks = applyHierarchicalCompression(chunks, config);
      break;
    case 'deduplicate':
      compressedChunks = applyDeduplication(chunks, config);
      break;
    case 'selective':
      compressedChunks = applySelectiveCompression(chunks, config);
      break;
    default:
      compressedChunks = applySelectiveCompression(chunks, config);
  }

  const compressedTokens = compressedChunks.reduce(
    (sum, c) => sum + c.compressedTokens,
    0
  );

  const compressionRatio =
    originalTokens > 0 ? compressedTokens / originalTokens : 1;

  // Estimate information loss based on compression ratio and methods used
  const informationLoss = estimateInformationLoss(compressedChunks, compressionRatio);

  return {
    chunks: compressedChunks,
    originalTokens,
    compressedTokens,
    compressionRatio,
    informationLoss,
  };
}

/**
 * Apply truncation strategy - truncate chunks to fit target
 */
function applyTruncation(
  chunks: ContextChunk[],
  config: CompressionConfig
): CompressedChunk[] {
  const result: CompressedChunk[] = [];
  let remainingTokens = config.targetTokens;

  // Sort by priority
  const sortedChunks = [...chunks].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, discardable: 4 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  for (const chunk of sortedChunks) {
    if (remainingTokens <= 0) break;

    const targetChunkTokens = Math.min(
      chunk.tokenCount,
      Math.max(config.minChunkSize, Math.floor(remainingTokens / sortedChunks.length))
    );

    if (chunk.tokenCount <= targetChunkTokens) {
      // No truncation needed
      result.push({
        originalId: chunk.id,
        content: chunk.content,
        method: 'truncate',
        originalTokens: chunk.tokenCount,
        compressedTokens: chunk.tokenCount,
        truncated: false,
        summarized: false,
      });
      remainingTokens -= chunk.tokenCount;
    } else {
      // Truncate content
      const truncatedContent = truncateContent(
        chunk.content,
        targetChunkTokens,
        config.preserveCode,
        config.preserveStructure
      );

      result.push({
        originalId: chunk.id,
        content: truncatedContent,
        method: 'truncate',
        originalTokens: chunk.tokenCount,
        compressedTokens: targetChunkTokens,
        truncated: true,
        summarized: false,
      });
      remainingTokens -= targetChunkTokens;
    }
  }

  return result;
}

/**
 * Apply summarization strategy - summarize chunks
 */
function applySummarization(
  chunks: ContextChunk[],
  config: CompressionConfig
): CompressedChunk[] {
  const result: CompressedChunk[] = [];

  for (const chunk of chunks) {
    // Skip small chunks
    if (chunk.tokenCount < config.minChunkSize * 2) {
      result.push({
        originalId: chunk.id,
        content: chunk.content,
        method: 'summarize',
        originalTokens: chunk.tokenCount,
        compressedTokens: chunk.tokenCount,
        truncated: false,
        summarized: false,
      });
      continue;
    }

    const summary = createSummary(chunk, config);
    const compressedTokens = estimateTokens(summary);

    result.push({
      originalId: chunk.id,
      content: summary,
      method: 'summarize',
      originalTokens: chunk.tokenCount,
      compressedTokens,
      truncated: false,
      summarized: true,
    });
  }

  return result;
}

/**
 * Apply hierarchical compression - create multi-level summaries
 */
function applyHierarchicalCompression(
  chunks: ContextChunk[],
  config: CompressionConfig
): CompressedChunk[] {
  if (chunks.length === 0) return [];

  // Build hierarchical summary tree
  const tree = buildHierarchicalTree(chunks, config);

  // Flatten tree into compressed chunks based on level
  const result: CompressedChunk[] = [];
  const targetLevel = Math.min(tree.level, Math.floor(config.level / 2));

  function traverse(node: HierarchicalSummary): void {
    if (node.level === targetLevel || node.children.length === 0) {
      const tokens = estimateTokens(node.summary);
      result.push({
        originalId: node.id,
        content: node.summary,
        method: 'hierarchical',
        originalTokens: node.sourceChunks.length * 100, // Estimate
        compressedTokens: tokens,
        truncated: false,
        summarized: true,
      });
    } else {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(tree);
  return result;
}

/**
 * Apply deduplication strategy - remove duplicate content
 */
function applyDeduplication(
  chunks: ContextChunk[],
  config: CompressionConfig
): CompressedChunk[] {
  const result: CompressedChunk[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    // Create content fingerprint
    const fingerprint = createFingerprint(chunk.content);

    if (seen.has(fingerprint)) {
      // Skip duplicate
      continue;
    }

    seen.add(fingerprint);

    // Also check for near-duplicates using similarity
    let isNearDuplicate = false;
    for (const existing of result) {
      if (calculateSimilarity(chunk.content, existing.content) > 0.9) {
        isNearDuplicate = true;
        break;
      }
    }

    if (!isNearDuplicate) {
      result.push({
        originalId: chunk.id,
        content: chunk.content,
        method: 'deduplicate',
        originalTokens: chunk.tokenCount,
        compressedTokens: chunk.tokenCount,
        truncated: false,
        summarized: false,
      });
    }
  }

  return result;
}

/**
 * Apply selective compression - choose best method per chunk
 */
function applySelectiveCompression(
  chunks: ContextChunk[],
  config: CompressionConfig
): CompressedChunk[] {
  const result: CompressedChunk[] = [];
  let remainingTokens = config.targetTokens;
  const tokensPerChunk = Math.floor(remainingTokens / chunks.length);

  for (const chunk of chunks) {
    if (chunk.tokenCount <= tokensPerChunk || chunk.tokenCount < config.minChunkSize) {
      // No compression needed
      result.push({
        originalId: chunk.id,
        content: chunk.content,
        method: 'selective',
        originalTokens: chunk.tokenCount,
        compressedTokens: chunk.tokenCount,
        truncated: false,
        summarized: false,
      });
      remainingTokens -= chunk.tokenCount;
    } else {
      // Choose compression method based on content type
      const compressed = compressChunkSelectively(chunk, tokensPerChunk, config);
      result.push(compressed);
      remainingTokens -= compressed.compressedTokens;
    }
  }

  return result;
}

/**
 * Compress a single chunk using the best method
 */
function compressChunkSelectively(
  chunk: ContextChunk,
  targetTokens: number,
  config: CompressionConfig
): CompressedChunk {
  const compressionNeeded = chunk.tokenCount / targetTokens;

  // Light compression - just truncate
  if (compressionNeeded < 1.5) {
    const content = truncateContent(
      chunk.content,
      targetTokens,
      config.preserveCode,
      config.preserveStructure
    );
    return {
      originalId: chunk.id,
      content,
      method: 'selective',
      originalTokens: chunk.tokenCount,
      compressedTokens: targetTokens,
      truncated: true,
      summarized: false,
    };
  }

  // Medium compression - smart truncation
  if (compressionNeeded < 3) {
    const content = smartTruncate(chunk, targetTokens, config);
    return {
      originalId: chunk.id,
      content,
      method: 'selective',
      originalTokens: chunk.tokenCount,
      compressedTokens: targetTokens,
      truncated: true,
      summarized: false,
    };
  }

  // Heavy compression - summarize
  const summary = createSummary(chunk, config);
  return {
    originalId: chunk.id,
    content: summary,
    method: 'selective',
    originalTokens: chunk.tokenCount,
    compressedTokens: estimateTokens(summary),
    truncated: false,
    summarized: true,
  };
}

/**
 * Truncate content intelligently
 */
function truncateContent(
  content: string,
  targetTokens: number,
  preserveCode: boolean,
  preserveStructure: boolean
): string {
  const targetChars = targetTokens * 4; // Approximate

  if (content.length <= targetChars) {
    return content;
  }

  // For code, try to preserve structure
  if (preserveCode && content.includes('{')) {
    return truncateCodePreservingStructure(content, targetChars);
  }

  // For structured content, preserve structure
  if (preserveStructure && (content.includes('#') || content.includes('-'))) {
    return truncatePreservingStructure(content, targetChars);
  }

  // Default: keep beginning and end
  const halfLength = Math.floor((targetChars - 3) / 2);
  return content.substring(0, halfLength) + '...' + content.substring(content.length - halfLength);
}

/**
 * Truncate code while preserving structure
 */
function truncateCodePreservingStructure(content: string, targetChars: number): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let currentChars = 0;
  let inFunction = false;
  let braceCount = 0;

  for (const line of lines) {
    if (currentChars + line.length > targetChars * 0.8 && !inFunction) {
      result.push('// ... truncated ...');
      break;
    }

    result.push(line);
    currentChars += line.length;

    // Track function boundaries
    if (line.includes('{')) braceCount++;
    if (line.includes('}')) braceCount--;
    inFunction = braceCount > 0;
  }

  return result.join('\n');
}

/**
 * Truncate while preserving markdown structure
 */
function truncatePreservingStructure(content: string, targetChars: number): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let currentChars = 0;

  for (const line of lines) {
    // Always keep headers
    if (line.trim().startsWith('#')) {
      result.push(line);
      currentChars += line.length;
      continue;
    }

    if (currentChars + line.length > targetChars) {
      result.push('...');
      break;
    }

    result.push(line);
    currentChars += line.length;
  }

  return result.join('\n');
}

/**
 * Smart truncate - keep important parts
 */
function smartTruncate(
  chunk: ContextChunk,
  targetTokens: number,
  config: CompressionConfig
): string {
  const lines = chunk.content.split('\n');
  const targetChars = targetTokens * 4;

  // Keep first and last portions, remove middle
  const firstPortion = Math.floor(targetChars * 0.6);
  const lastPortion = Math.floor(targetChars * 0.3);

  let firstPart = '';
  let lastPart = '';
  let currentChars = 0;

  // Take from beginning
  for (const line of lines) {
    if (currentChars + line.length > firstPortion) break;
    firstPart += line + '\n';
    currentChars += line.length + 1;
  }

  // Take from end
  currentChars = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (currentChars + lines[i].length > lastPortion) break;
    lastPart = lines[i] + '\n' + lastPart;
    currentChars += lines[i].length + 1;
  }

  return firstPart + '\n... [truncated] ...\n\n' + lastPart;
}

/**
 * Create a summary of a chunk
 */
function createSummary(chunk: ContextChunk, config: CompressionConfig): string {
  const lines = chunk.content.split('\n');

  switch (chunk.type) {
    case 'code':
      return summarizeCodeChunk(lines, config);
    case 'documentation':
      return summarizeDocChunk(lines);
    case 'conversation':
      return summarizeConversationChunk(lines);
    case 'error':
      return summarizeErrorChunk(lines);
    default:
      return summarizeGenericChunk(lines);
  }
}

/**
 * Summarize code chunk
 */
function summarizeCodeChunk(lines: string[], config: CompressionConfig): string {
  const signatures: string[] = [];
  const comments: string[] = [];
  let inComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Extract function/class signatures
    if (
      trimmed.match(/^(export\s+)?(async\s+)?function\s+\w+/) ||
      trimmed.match(/^(export\s+)?class\s+\w+/) ||
      trimmed.match(/^(export\s+)?(const|let|var)\s+\w+\s*[=:]\s*\(/)
    ) {
      signatures.push(trimmed);
    }

    // Extract JSDoc comments
    if (trimmed.startsWith('/**')) {
      inComment = true;
    }
    if (inComment) {
      comments.push(trimmed);
      if (trimmed.endsWith('*/')) {
        inComment = false;
      }
    }
  }

  const parts: string[] = [];
  if (signatures.length > 0) {
    parts.push('// Functions/Classes:');
    parts.push(...signatures.slice(0, 5));
  }
  if (comments.length > 0 && config.preserveStructure) {
    parts.push('\n// Documentation:');
    parts.push(...comments.slice(0, 10));
  }

  return parts.join('\n') || lines.slice(0, 5).join('\n');
}

/**
 * Summarize documentation chunk
 */
function summarizeDocChunk(lines: string[]): string {
  const headers: string[] = [];
  const keyPoints: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('#')) {
      headers.push(line);
    } else if (
      trimmed.startsWith('- ') ||
      trimmed.startsWith('* ') ||
      trimmed.match(/^\d+\./)
    ) {
      keyPoints.push(line);
    }
  }

  return [...headers.slice(0, 3), ...keyPoints.slice(0, 5)].join('\n');
}

/**
 * Summarize conversation chunk
 */
function summarizeConversationChunk(lines: string[]): string {
  const messages: string[] = [];
  let lastSpeaker = '';

  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, speaker, message] = match;
      if (speaker !== lastSpeaker) {
        messages.push(`${speaker}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
        lastSpeaker = speaker;
      }
    }
  }

  // Keep first and last messages
  if (messages.length > 4) {
    return [...messages.slice(0, 2), '...', ...messages.slice(-2)].join('\n');
  }
  return messages.join('\n');
}

/**
 * Summarize error chunk
 */
function summarizeErrorChunk(lines: string[]): string {
  const errorLines: string[] = [];
  let inStackTrace = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Keep error message
    if (trimmed.includes('Error:') || trimmed.includes('Exception:')) {
      errorLines.push(line);
    }

    // Keep first few lines of stack trace
    if (trimmed.startsWith('at ') && errorLines.length < 10) {
      errorLines.push(line);
    }
  }

  return errorLines.join('\n') || lines.slice(0, 5).join('\n');
}

/**
 * Summarize generic chunk
 */
function summarizeGenericChunk(lines: string[]): string {
  // Keep first few and last few lines
  if (lines.length <= 6) return lines.join('\n');

  return [...lines.slice(0, 3), '...', ...lines.slice(-3)].join('\n');
}

/**
 * Build hierarchical summary tree
 */
function buildHierarchicalTree(
  chunks: ContextChunk[],
  config: CompressionConfig
): HierarchicalSummary {
  // Group chunks by source/type
  const groups = new Map<string, ContextChunk[]>();
  for (const chunk of chunks) {
    const key = `${chunk.type}:${chunk.source}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(chunk);
  }

  // Build tree
  const root: HierarchicalSummary = {
    id: 'root',
    summary: `Context with ${chunks.length} chunks`,
    children: [],
    sourceChunks: chunks.map((c) => c.id),
    level: 0,
  };

  for (const [key, groupChunks] of Array.from(groups)) {
    const groupSummary = createGroupSummary(groupChunks, config);
    const child: HierarchicalSummary = {
      id: key,
      summary: groupSummary,
      children: [],
      sourceChunks: groupChunks.map((c) => c.id),
      level: 1,
    };

    // Add individual chunks as leaves if needed
    if (config.level > 2) {
      for (const chunk of groupChunks) {
        child.children.push({
          id: chunk.id,
          summary: createSummary(chunk, config),
          children: [],
          sourceChunks: [chunk.id],
          level: 2,
        });
      }
    }

    root.children.push(child);
  }

  return root;
}

/**
 * Create summary for a group of chunks
 */
function createGroupSummary(chunks: ContextChunk[], config: CompressionConfig): string {
  const type = chunks[0]?.type || 'unknown';
  const source = chunks[0]?.source || 'unknown';

  if (type === 'code') {
    return `Code from ${source}: ${chunks.length} files/functions`;
  } else if (type === 'documentation') {
    return `Documentation from ${source}: ${chunks.length} sections`;
  } else if (type === 'error') {
    return `${chunks.length} error messages`;
  } else {
    return `${type} from ${source}: ${chunks.length} chunks`;
  }
}

/**
 * Create content fingerprint for deduplication
 */
function createFingerprint(content: string): string {
  // Normalize content
  const normalized = content
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w]/g, '')
    .substring(0, 200);

  // Simple hash
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return hash.toString(16);
}

/**
 * Calculate similarity between two strings (0-1)
 */
function calculateSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Estimate information loss
 */
function estimateInformationLoss(
  chunks: CompressedChunk[],
  compressionRatio: number
): number {
  let totalLoss = 0;

  for (const chunk of chunks) {
    if (chunk.summarized) {
      totalLoss += 0.3; // Summarization loses some detail
    }
    if (chunk.truncated) {
      totalLoss += 0.2; // Truncation loses context
    }
  }

  const avgLoss = chunks.length > 0 ? totalLoss / chunks.length : 0;
  return Math.min(1, (1 - compressionRatio) * 0.5 + avgLoss * 0.5);
}

/**
 * Estimate token count from text
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Context Compressor class
 */
export class ContextCompressor {
  private config: CompressionConfig;

  constructor(config: Partial<CompressionConfig> = {}) {
    this.config = { ...DEFAULT_COMPRESSION_CONFIG, ...config };
  }

  /**
   * Compress chunks
   */
  compress(chunks: ContextChunk[]): CompressionResult {
    return compressContext(chunks, this.config);
  }

  /**
   * Compress a single chunk
   */
  compressChunk(chunk: ContextChunk, targetTokens: number): CompressedChunk {
    return compressChunkSelectively(chunk, targetTokens, this.config);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): CompressionConfig {
    return { ...this.config };
  }
}
