/**
 * Context Engineering - Type Definitions
 *
 * Provides TypeScript interfaces for context analysis, filtering,
 * compression, and strategic information injection.
 */

// ============================================================================
// Core Context Types
// ============================================================================

/**
 * Represents a chunk of context information
 */
export interface ContextChunk {
  /** Unique identifier for the chunk */
  id: string;

  /** Content of the context chunk */
  content: string;

  /** Type of context */
  type: ContextType;

  /** Source of the context (file, memory, conversation, etc.) */
  source: string;

  /** Timestamp when the chunk was created */
  timestamp: number;

  /** Token count estimate */
  tokenCount: number;

  /** Priority level for retention */
  priority: PriorityLevel;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Types of context chunks
 */
export type ContextType =
  | 'code'
  | 'documentation'
  | 'conversation'
  | 'memory'
  | 'task'
  | 'error'
  | 'output'
  | 'instruction'
  | 'reference';

/**
 * Priority levels for context retention
 */
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low' | 'discardable';

// ============================================================================
// Relevance Analysis Types
// ============================================================================

/**
 * Relevance score for a context chunk
 */
export interface RelevanceScore {
  /** Overall relevance score (0-1) */
  score: number;

  /** Component scores */
  components: {
    /** Keyword matching score */
    keywordMatch: number;

    /** Semantic similarity score */
    semanticSimilarity: number;

    /** Task context relevance score */
    taskContext: number;

    /** Recency score */
    recency: number;

    /** Priority adjustment */
    priority: number;
  };

  /** Matched keywords */
  matchedKeywords: string[];

  /** Reasoning for the score */
  reasoning: string;
}

/**
 * Task context for relevance analysis
 */
export interface TaskContext {
  /** Current task description */
  task: string;

  /** Current file being worked on */
  currentFile?: string;

  /** Keywords extracted from task */
  keywords: string[];

  /** Related concepts/topics */
  concepts: string[];

  /** Stack/technologies involved */
  stack: string[];

  /** Previous actions taken */
  actionHistory: string[];
}

/**
 * Configuration for relevance analysis
 */
export interface RelevanceConfig {
  /** Weights for different scoring components */
  weights: {
    keywordMatch: number;
    semanticSimilarity: number;
    taskContext: number;
    recency: number;
    priority: number;
  };

  /** Minimum score threshold (0-1) */
  threshold: number;

  /** Keywords to boost */
  boostKeywords: string[];

  /** Keywords to penalize */
  penalizeKeywords: string[];

  /** Time decay factor (0-1, higher = faster decay) */
  timeDecayFactor: number;
}

// ============================================================================
// Filtering Types
// ============================================================================

/**
 * Filter strategy type
 */
export type FilterStrategy = 'retention' | 'exclusion' | 'summarization';

/**
 * Filter configuration
 */
export interface FilterConfig {
  /** Strategy to use */
  strategy: FilterStrategy;

  /** Relevance threshold (0-1) */
  threshold: number;

  /** Maximum chunks to retain */
  maxChunks: number;

  /** Maximum total tokens */
  maxTokens: number;

  /** Always keep these chunk IDs */
  keepIds: string[];

  /** Always remove these chunk IDs */
  removeIds: string[];

  /** Types to always keep */
  alwaysKeepTypes: ContextType[];

  /** Types to always remove */
  alwaysRemoveTypes: ContextType[];
}

/**
 * Filter result
 */
export interface FilterResult {
  /** Chunks that passed the filter */
  retained: ContextChunk[];

  /** Chunks that were removed */
  removed: ContextChunk[];

  /** Chunks that were summarized */
  summarized: SummarizedChunk[];

  /** Statistics about the filter operation */
  stats: FilterStats;
}

/**
 * Summarized chunk
 */
export interface SummarizedChunk {
  /** Original chunk ID */
  originalId: string;

  /** Summary content */
  summary: string;

  /** Original chunk (for reference) */
  original: ContextChunk;

  /** Compression ratio achieved */
  compressionRatio: number;
}

/**
 * Filter statistics
 */
export interface FilterStats {
  /** Total chunks before filtering */
  totalBefore: number;

  /** Total chunks after filtering */
  totalAfter: number;

  /** Tokens before filtering */
  tokensBefore: number;

  /** Tokens after filtering */
  tokensAfter: number;

  /** Number of chunks removed */
  removedCount: number;

  /** Number of chunks summarized */
  summarizedCount: number;
}

// ============================================================================
// Compression Types
// ============================================================================

/**
 * Compression strategy type
 */
export type CompressionStrategy =
  | 'truncate'
  | 'summarize'
  | 'hierarchical'
  | 'deduplicate'
  | 'selective';

/**
 * Compression configuration
 */
export interface CompressionConfig {
  /** Strategy to use */
  strategy: CompressionStrategy;

  /** Target token count */
  targetTokens: number;

  /** Maximum tokens allowed */
  maxTokens: number;

  /** Whether to preserve code blocks */
  preserveCode: boolean;

  /** Whether to preserve structured data */
  preserveStructure: boolean;

  /** Minimum chunk size (don't compress smaller than this) */
  minChunkSize: number;

  /** Compression level (1-10, higher = more aggressive) */
  level: number;
}

/**
 * Compression result
 */
export interface CompressionResult {
  /** Compressed chunks */
  chunks: CompressedChunk[];

  /** Original token count */
  originalTokens: number;

  /** Compressed token count */
  compressedTokens: number;

  /** Compression ratio achieved */
  compressionRatio: number;

  /** Information loss estimate (0-1) */
  informationLoss: number;
}

/**
 * Compressed chunk
 */
export interface CompressedChunk {
  /** Original chunk ID */
  originalId: string;

  /** Compressed content */
  content: string;

  /** Compression method used */
  method: CompressionStrategy;

  /** Original token count */
  originalTokens: number;

  /** Compressed token count */
  compressedTokens: number;

  /** Whether the chunk was truncated */
  truncated: boolean;

  /** Whether the chunk was summarized */
  summarized: boolean;
}

/**
 * Hierarchical summary node
 */
export interface HierarchicalSummary {
  /** Node ID */
  id: string;

  /** Summary at this level */
  summary: string;

  /** Child nodes */
  children: HierarchicalSummary[];

  /** Source chunks */
  sourceChunks: string[];

  /** Detail level (0 = highest summary, increases with depth) */
  level: number;
}

// ============================================================================
// Injection Types
// ============================================================================

/**
 * Injection point type
 */
export type InjectionPoint =
  | 'start'
  | 'end'
  | 'before_related'
  | 'after_related'
  | 'on_demand'
  | 'milestone';

/**
 * Injection trigger
 */
export interface InjectionTrigger {
  /** When to inject */
  point: InjectionPoint;

  /** Condition for injection (optional) */
  condition?: InjectionCondition;

  /** Priority of this injection */
  priority: number;
}

/**
 * Injection condition
 */
export interface InjectionCondition {
  /** Match these keywords */
  keywords?: string[];

  /** Match this context type */
  contextType?: ContextType;

  /** Match this source pattern */
  sourcePattern?: RegExp;

  /** Custom condition function (as string for serialization) */
  custom?: string;
}

/**
 * Information to inject
 */
export interface InjectionPayload {
  /** Unique injection ID */
  id: string;

  /** Content to inject */
  content: string;

  /** Injection trigger configuration */
  trigger: InjectionTrigger;

  /** Whether this injection is critical */
  critical: boolean;

  /** Maximum times to inject */
  maxInjections?: number;

  /** Already injected count */
  injectionCount?: number;
}

/**
 * Injection result
 */
export interface InjectionResult {
  /** Whether injection was performed */
  injected: boolean;

  /** Position where injected */
  position?: number;

  /** Content that was injected */
  content?: string;

  /** Injection ID */
  injectionId: string;

  /** Reason for injection or skip */
  reason: string;
}

// ============================================================================
// Context Engine Types
// ============================================================================

/**
 * Context engine configuration
 */
export interface ContextEngineConfig {
  /** Relevance analysis configuration */
  relevance: RelevanceConfig;

  /** Filter configuration */
  filter: FilterConfig;

  /** Compression configuration */
  compression: CompressionConfig;

  /** Maximum context size in tokens */
  maxContextTokens: number;

  /** Target context size in tokens */
  targetContextTokens: number;

  /** Enable debug logging */
  debug: boolean;
}

/**
 * Processed context result
 */
export interface ProcessedContext {
  /** Final context string */
  context: string;

  /** Chunks included in order */
  chunks: ContextChunk[];

  /** Statistics about processing */
  stats: ContextStats;

  /** Injections applied */
  injections: InjectionResult[];
}

/**
 * Context processing statistics
 */
export interface ContextStats {
  /** Total chunks processed */
  totalChunks: number;

  /** Chunks retained */
  retainedChunks: number;

  /** Chunks filtered out */
  filteredChunks: number;

  /** Chunks compressed */
  compressedChunks: number;

  /** Original token count */
  originalTokens: number;

  /** Final token count */
  finalTokens: number;

  /** Processing time in milliseconds */
  processingTimeMs: number;

  /** Compression ratio achieved */
  compressionRatio: number;
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default relevance configuration
 */
export const DEFAULT_RELEVANCE_CONFIG: RelevanceConfig = {
  weights: {
    keywordMatch: 0.25,
    semanticSimilarity: 0.25,
    taskContext: 0.30,
    recency: 0.10,
    priority: 0.10,
  },
  threshold: 0.3,
  boostKeywords: [],
  penalizeKeywords: [],
  timeDecayFactor: 0.1,
};

/**
 * Default filter configuration
 */
export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  strategy: 'retention',
  threshold: 0.3,
  maxChunks: 100,
  maxTokens: 8000,
  keepIds: [],
  removeIds: [],
  alwaysKeepTypes: ['instruction', 'error'],
  alwaysRemoveTypes: [],
};

/**
 * Default compression configuration
 */
export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  strategy: 'selective',
  targetTokens: 6000,
  maxTokens: 8000,
  preserveCode: true,
  preserveStructure: true,
  minChunkSize: 50,
  level: 5,
};

/**
 * Default context engine configuration
 */
export const DEFAULT_CONTEXT_ENGINE_CONFIG: ContextEngineConfig = {
  relevance: DEFAULT_RELEVANCE_CONFIG,
  filter: DEFAULT_FILTER_CONFIG,
  compression: DEFAULT_COMPRESSION_CONFIG,
  maxContextTokens: 8000,
  targetContextTokens: 6000,
  debug: false,
};
