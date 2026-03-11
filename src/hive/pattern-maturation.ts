/**
 * Pattern Maturation System - Issue #26.5
 * Sistema para madurar patrones de learnings
 * 
 * Features:
 * - Detecta patrones recurrentes en learnings
 * - Calcula confianza basada en frecuencia
 * - Agrupa learnings similares
 * - Sugiere consolidación
 */

import { Learning, EmbeddingBackend } from '../types';
import { Hivemind } from './hivemind';

/**
 * Enhanced Pattern interface with tags support
 */
export interface Pattern {
  /** Unique identifier for the pattern */
  id: string;
  /** Human-readable name for the pattern */
  name: string;
  /** Description of what this pattern represents */
  description: string;
  /** Example learnings that match this pattern */
  examples: Learning[];
  /** Number of learnings that match this pattern */
  frequency: number;
  /** Confidence score (0-1) based on cluster cohesion */
  confidence: number;
  /** Tags extracted from the pattern's learnings */
  tags: string[];
}

/**
 * Options for pattern detection
 */
export interface PatternDetectionOptions {
  /** Minimum number of learnings to form a pattern (default: 3) */
  minClusterSize?: number;
  /** Similarity threshold for embedding clustering (default: 0.75) */
  similarityThreshold?: number;
  /** Minimum tag overlap for tag-based clustering (default: 0.5) */
  tagOverlapThreshold?: number;
  /** Maximum number of patterns to return (default: 20) */
  maxPatterns?: number;
  /** Include clustering strategy breakdown */
  includeMetadata?: boolean;
}

/**
 * Result of pattern detection
 */
export interface PatternDetectionResult {
  patterns: Pattern[];
  metadata?: {
    totalLearnings: number;
    patternsFound: number;
    clusteringStats: {
      embedding: number;
      tags: number;
      context: number;
    };
  };
}

/**
 * Consolidation result
 */
export interface ConsolidationResult {
  success: boolean;
  consolidatedLearning?: Learning;
  mergedLearningIds: string[];
  error?: string;
}

/**
 * Skill promotion result
 */
export interface SkillPromotionResult {
  success: boolean;
  skillName?: string;
  skillContent?: string;
  error?: string;
}

/**
 * Clustering strategy types
 */
export type ClusteringStrategy = 'embedding' | 'tags' | 'context' | 'hybrid';

/**
 * PatternRecognizer - Core pattern recognition engine
 * Implements multiple clustering algorithms for pattern detection
 */
export class PatternRecognizer {
  private backend: EmbeddingBackend;
  
  constructor(backend: EmbeddingBackend) {
    this.backend = backend;
  }
  
  /**
   * Detect patterns using hybrid clustering approach
   */
  async detectPatterns(
    learnings: Learning[],
    options: PatternDetectionOptions = {}
  ): Promise<PatternDetectionResult> {
    const {
      minClusterSize = 3,
      similarityThreshold = 0.75,
      tagOverlapThreshold = 0.5,
      maxPatterns = 20,
      includeMetadata = false
    } = options;
    
    if (learnings.length < minClusterSize) {
      return {
        patterns: [],
        metadata: includeMetadata ? {
          totalLearnings: learnings.length,
          patternsFound: 0,
          clusteringStats: { embedding: 0, tags: 0, context: 0 }
        } : undefined
      };
    }
    
    // Run multiple clustering strategies
    const embeddingClusters = this.clusterByEmbedding(learnings, similarityThreshold);
    const tagClusters = this.clusterByTags(learnings, tagOverlapThreshold);
    const contextClusters = this.clusterByContext(learnings);
    
    // Merge clusters from different strategies
    const mergedClusters = this.mergeClusters([
      ...embeddingClusters,
      ...tagClusters,
      ...contextClusters
    ], similarityThreshold);
    
    // Convert clusters to patterns
    const patterns: Pattern[] = [];
    let patternId = 0;
    
    for (const cluster of mergedClusters) {
      if (cluster.length >= minClusterSize) {
        const pattern = this.createPattern(cluster, `pattern-${patternId++}`);
        patterns.push(pattern);
      }
    }
    
    // Sort by confidence and limit results
    const sortedPatterns = patterns
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxPatterns);
    
    return {
      patterns: sortedPatterns,
      metadata: includeMetadata ? {
        totalLearnings: learnings.length,
        patternsFound: sortedPatterns.length,
        clusteringStats: {
          embedding: embeddingClusters.length,
          tags: tagClusters.length,
          context: contextClusters.length
        }
      } : undefined
    };
  }
  
  /**
   * Cluster learnings by embedding similarity
   */
  clusterByEmbedding(learnings: Learning[], threshold: number): Learning[][] {
    const clusters: Learning[][] = [];
    const assigned = new Set<string>();
    
    for (const learning of learnings) {
      if (assigned.has(learning.id)) continue;
      
      const cluster: Learning[] = [learning];
      assigned.add(learning.id);
      
      for (const other of learnings) {
        if (assigned.has(other.id)) continue;
        
        const similarity = this.backend.similarity(
          learning.embedding,
          other.embedding
        );
        
        if (similarity >= threshold) {
          cluster.push(other);
          assigned.add(other.id);
        }
      }
      
      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    }
    
    return clusters;
  }
  
  /**
   * Cluster learnings by tag overlap (Jaccard similarity)
   */
  clusterByTags(learnings: Learning[], threshold: number): Learning[][] {
    const clusters: Learning[][] = [];
    const assigned = new Set<string>();
    
    for (const learning of learnings) {
      if (assigned.has(learning.id)) continue;
      if (learning.metadata.tags.length === 0) continue;
      
      const cluster: Learning[] = [learning];
      assigned.add(learning.id);
      
      for (const other of learnings) {
        if (assigned.has(other.id)) continue;
        if (other.metadata.tags.length === 0) continue;
        
        const overlap = this.calculateTagOverlap(
          learning.metadata.tags,
          other.metadata.tags
        );
        
        if (overlap >= threshold) {
          cluster.push(other);
          assigned.add(other.id);
        }
      }
      
      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    }
    
    return clusters;
  }
  
  /**
   * Cluster learnings by shared context (files, codebase, task)
   */
  clusterByContext(learnings: Learning[]): Learning[][] {
    const clusters: Learning[][] = [];
    const assigned = new Set<string>();
    
    // Group by codebase
    const byCodebase = new Map<string, Learning[]>();
    for (const learning of learnings) {
      const cb = learning.context.codebase || 'unknown';
      if (!byCodebase.has(cb)) {
        byCodebase.set(cb, []);
      }
      byCodebase.get(cb)!.push(learning);
    }
    
    // Within each codebase, cluster by shared files
    for (const [, codebaseLearnings] of Array.from(byCodebase)) {
      for (const learning of codebaseLearnings) {
        if (assigned.has(learning.id)) continue;
        if (learning.context.files.length === 0) continue;
        
        const cluster: Learning[] = [learning];
        assigned.add(learning.id);
        
        for (const other of codebaseLearnings) {
          if (assigned.has(other.id)) continue;
          if (other.context.files.length === 0) continue;
          
          // Check for file overlap
          const hasSharedFiles = learning.context.files.some(f => 
            other.context.files.includes(f)
          );
          
          if (hasSharedFiles) {
            cluster.push(other);
            assigned.add(other.id);
          }
        }
        
        if (cluster.length > 1) {
          clusters.push(cluster);
        }
      }
    }
    
    return clusters;
  }
  
  /**
   * Merge overlapping clusters from different strategies
   */
  private mergeClusters(
    allClusters: Learning[][],
    threshold: number
  ): Learning[][] {
    const merged: Learning[][] = [];
    
    for (const cluster of allClusters) {
      let mergedIntoExisting = false;
      
      for (const existingCluster of merged) {
        // Check overlap between clusters
        const overlap = this.calculateClusterOverlap(cluster, existingCluster);
        
        if (overlap >= 0.3) { // 30% overlap threshold for merging
          // Merge clusters
          const clusterIds = new Set(existingCluster.map(l => l.id));
          for (const learning of cluster) {
            if (!clusterIds.has(learning.id)) {
              existingCluster.push(learning);
            }
          }
          mergedIntoExisting = true;
          break;
        }
      }
      
      if (!mergedIntoExisting) {
        merged.push([...cluster]);
      }
    }
    
    return merged;
  }
  
  /**
   * Calculate overlap between two clusters
   */
  private calculateClusterOverlap(cluster1: Learning[], cluster2: Learning[]): number {
    const ids1 = new Set(cluster1.map(l => l.id));
    const ids2 = new Set(cluster2.map(l => l.id));
    
    let intersection = 0;
    for (const id of Array.from(ids1)) {
      if (ids2.has(id)) intersection++;
    }
    
    const union = Math.max(ids1.size, ids2.size);
    return union > 0 ? intersection / union : 0;
  }
  
  /**
   * Calculate Jaccard similarity between tag sets
   */
  private calculateTagOverlap(tags1: string[], tags2: string[]): number {
    const set1 = new Set(tags1.map(t => t.toLowerCase()));
    const set2 = new Set(tags2.map(t => t.toLowerCase()));
    
    let intersection = 0;
    for (const tag of Array.from(set1)) {
      if (set2.has(tag)) intersection++;
    }
    
    const union = set1.size + set2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
  
  /**
   * Create a Pattern from a cluster of learnings
   */
  private createPattern(cluster: Learning[], id: string): Pattern {
    // Extract common tags
    const tagCounts = new Map<string, number>();
    for (const learning of cluster) {
      for (const tag of learning.metadata.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    
    // Tags appearing in >50% of learnings
    const commonTags = Array.from(tagCounts.entries())
      .filter(([, count]) => count >= cluster.length * 0.5)
      .map(([tag]) => tag);
    
    // Generate pattern name and description
    const name = this.generatePatternName(cluster, commonTags);
    const description = this.generatePatternDescription(cluster);
    
    return {
      id,
      name,
      description,
      examples: cluster.slice(0, 5), // Limit examples to 5
      frequency: cluster.length,
      confidence: this.calculateConfidence(cluster),
      tags: commonTags
    };
  }
  
  /**
   * Generate a pattern name from cluster
   */
  private generatePatternName(cluster: Learning[], commonTags: string[]): string {
    // Use category if all learnings share it
    const categories = new Set(cluster.map(l => l.metadata.category));
    if (categories.size === 1) {
      const category = Array.from(categories)[0];
      return `${this.formatCategory(category)} Pattern`;
    }
    
    // Use common tags
    if (commonTags.length > 0) {
      return `${commonTags.slice(0, 2).map(t => this.capitalize(t)).join(' + ')} Pattern`;
    }
    
    // Use common words from content
    const commonWords = this.extractCommonWords(cluster.map(l => l.content));
    if (commonWords.length > 0) {
      return `${this.capitalize(commonWords[0])}-Related Pattern`;
    }
    
    return `Pattern (n=${cluster.length})`;
  }
  
  /**
   * Generate pattern description
   */
  private generatePatternDescription(cluster: Learning[]): string {
    const commonWords = this.extractCommonWords(cluster.map(l => l.content));
    const contexts = new Set(cluster.map(l => l.context.codebase).filter(Boolean));
    
    let description = `Pattern detected across ${cluster.length} learnings`;
    
    if (commonWords.length > 0) {
      description += ` involving: ${commonWords.slice(0, 5).join(', ')}`;
    }
    
    if (contexts.size > 0 && contexts.size <= 3) {
      description += `. Found in: ${Array.from(contexts).join(', ')}`;
    }
    
    return description;
  }
  
  /**
   * Extract common words from content
   */
  private extractCommonWords(contents: string[]): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
      'from', 'as', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'between', 'under', 'again', 'further', 'then',
      'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
      'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only',
      'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but',
      'if', 'or', 'because', 'until', 'while', 'this', 'that', 'these',
      'those', 'which', 'who', 'whom', 'what', 'whose'
    ]);
    
    const wordCounts = new Map<string, number>();
    
    for (const content of contents) {
      const words = content.toLowerCase()
        .split(/\W+/)
        .filter(w => w.length > 3 && !stopWords.has(w));
      
      for (const word of words) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
    
    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);
  }
  
  /**
   * Calculate confidence score for a cluster
   */
  private calculateConfidence(cluster: Learning[]): number {
    if (cluster.length < 2) return 0;
    
    // Calculate average pairwise similarity
    let totalSimilarity = 0;
    let count = 0;
    
    for (let i = 0; i < cluster.length; i++) {
      for (let j = i + 1; j < cluster.length; j++) {
        totalSimilarity += this.backend.similarity(
          cluster[i].embedding,
          cluster[j].embedding
        );
        count++;
      }
    }
    
    const avgSimilarity = count > 0 ? totalSimilarity / count : 0;
    
    // Boost confidence based on frequency (logarithmic scale)
    const frequencyBonus = Math.log10(cluster.length) * 0.1;
    
    // Cap at 1.0
    return Math.min(1.0, avgSimilarity + frequencyBonus);
  }
  
  /**
   * Format category for display
   */
  private formatCategory(category: string): string {
    return category
      .split('-')
      .map(word => this.capitalize(word))
      .join(' ');
  }
  
  /**
   * Capitalize first letter
   */
  private capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }
}

/**
 * PatternMaturation - Main class for pattern lifecycle management
 */
export class PatternMaturation {
  private hivemind: Hivemind;
  private recognizer: PatternRecognizer;
  private patterns: Map<string, Pattern> = new Map();
  
  constructor(hivemind: Hivemind, backend: EmbeddingBackend) {
    this.hivemind = hivemind;
    this.recognizer = new PatternRecognizer(backend);
  }
  
  /**
   * Detect patterns in stored learnings
   */
  async detectPatterns(options: PatternDetectionOptions = {}): Promise<PatternDetectionResult> {
    const learnings = await this.hivemind.getAllLearnings();
    const result = await this.recognizer.detectPatterns(learnings, options);
    
    // Cache patterns for later use
    for (const pattern of result.patterns) {
      this.patterns.set(pattern.id, pattern);
    }
    
    return result;
  }
  
  /**
   * Get a specific pattern by ID
   */
  getPattern(patternId: string): Pattern | undefined {
    return this.patterns.get(patternId);
  }
  
  /**
   * Get all cached patterns
   */
  getAllPatterns(): Pattern[] {
    return Array.from(this.patterns.values());
  }
  
  /**
   * Consolidate a pattern into a single learning
   */
  async consolidatePattern(patternId: string): Promise<ConsolidationResult> {
    const pattern = this.patterns.get(patternId);
    
    if (!pattern) {
      return {
        success: false,
        mergedLearningIds: [],
        error: `Pattern not found: ${patternId}`
      };
    }
    
    if (pattern.examples.length < 2) {
      return {
        success: false,
        mergedLearningIds: [],
        error: 'Pattern has insufficient learnings to consolidate'
      };
    }
    
    try {
      // Create consolidated learning content
      const consolidatedContent = this.createConsolidatedContent(pattern);
      
      // Extract merged tags
      const mergedTags = Array.from(new Set(
        pattern.examples.flatMap(l => l.metadata.tags)
      ));
      
      // Extract merged files
      const mergedFiles = Array.from(new Set(
        pattern.examples.flatMap(l => l.context.files)
      ));
      
      // Create the consolidated learning
      const consolidatedLearning: Learning = {
        id: `consolidated-${patternId}-${Date.now()}`,
        content: consolidatedContent,
        embedding: [], // Will be generated by hivemind.save()
        metadata: {
          source: 'pattern-consolidation',
          timestamp: new Date(),
          tags: [...mergedTags, 'consolidated', `pattern:${pattern.name}`],
          category: this.determineConsolidatedCategory(pattern.examples)
        },
        context: {
          codebase: pattern.examples[0]?.context.codebase || 'unknown',
          files: mergedFiles.slice(0, 10), // Limit to 10 files
          task: `Consolidated from pattern: ${pattern.name}`
        }
      };
      
      // Save the consolidated learning
      await this.hivemind.save(consolidatedLearning);
      
      // Remove original learnings (optional - could be configurable)
      const mergedIds = pattern.examples.map(l => l.id);
      // Note: We keep originals for reference but mark them as consolidated
      // In a production system, you might want to soft-delete or archive them
      
      return {
        success: true,
        consolidatedLearning,
        mergedLearningIds: mergedIds
      };
    } catch (error) {
      return {
        success: false,
        mergedLearningIds: [],
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Create consolidated content from pattern examples
   */
  private createConsolidatedContent(pattern: Pattern): string {
    const lines: string[] = [
      `# ${pattern.name}`,
      '',
      pattern.description,
      '',
      '## Key Insights',
      ''
    ];
    
    // Extract key insights from examples
    const insights = this.extractInsights(pattern.examples);
    for (const insight of insights) {
      lines.push(`- ${insight}`);
    }
    
    lines.push('');
    lines.push('## Common Patterns');
    lines.push('');
    
    // Add common patterns
    const commonPatterns = this.extractCommonPatterns(pattern.examples);
    for (const cp of commonPatterns) {
      lines.push(`- ${cp}`);
    }
    
    lines.push('');
    lines.push(`## Source Learnings (${pattern.examples.length})`);
    lines.push('');
    
    // List source learning IDs
    for (const example of pattern.examples.slice(0, 5)) {
      lines.push(`- ${example.id}: ${example.content.slice(0, 100)}...`);
    }
    
    if (pattern.examples.length > 5) {
      lines.push(`- ... and ${pattern.examples.length - 5} more`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Extract key insights from learnings
   */
  private extractInsights(learnings: Learning[]): string[] {
    const insights: string[] = [];
    
    // Look for sentences with key insight indicators
    const indicators = ['important:', 'note:', 'key:', 'insight:', 'found that', 'discovered'];
    
    for (const learning of learnings) {
      const sentences = learning.content.split(/[.!?]+/);
      for (const sentence of sentences) {
        const lowerSentence = sentence.toLowerCase();
        if (indicators.some(i => lowerSentence.includes(i))) {
          insights.push(sentence.trim());
        }
      }
    }
    
    return Array.from(new Set(insights)).slice(0, 5);
  }
  
  /**
   * Extract common patterns from learnings
   */
  private extractCommonPatterns(learnings: Learning[]): string[] {
    const patterns: string[] = [];
    
    // Extract common code patterns, file patterns, etc.
    const fileExtensions = new Set<string>();
    const codePatterns: string[] = [];
    
    for (const learning of learnings) {
      // Extract file extensions
      for (const file of learning.context.files) {
        const ext = file.split('.').pop();
        if (ext && ext.length < 10) {
          fileExtensions.add(ext);
        }
      }
      
      // Extract code patterns (simple heuristic)
      const codeMatches = learning.content.match(/`[^`]+`/g);
      if (codeMatches) {
        codePatterns.push(...codeMatches);
      }
    }
    
    if (fileExtensions.size > 0) {
      patterns.push(`Common file types: ${Array.from(fileExtensions).join(', ')}`);
    }
    
    if (codePatterns.length > 0) {
      const uniquePatterns = Array.from(new Set(codePatterns)).slice(0, 3);
      patterns.push(`Code patterns: ${uniquePatterns.join(', ')}`);
    }
    
    return patterns;
  }
  
  /**
   * Determine category for consolidated learning
   */
  private determineConsolidatedCategory(learnings: Learning[]): Learning['metadata']['category'] {
    const categoryCounts = new Map<Learning['metadata']['category'], number>();
    
    for (const learning of learnings) {
      categoryCounts.set(
        learning.metadata.category,
        (categoryCounts.get(learning.metadata.category) || 0) + 1
      );
    }
    
    // Return most common category
    let maxCount = 0;
    let dominantCategory: Learning['metadata']['category'] = 'pattern';
    
    for (const [category, count] of Array.from(categoryCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantCategory = category;
      }
    }
    
    return dominantCategory;
  }
  
  /**
   * Promote a pattern to a skill
   */
  async promoteToSkill(patternId: string): Promise<SkillPromotionResult> {
    const pattern = this.patterns.get(patternId);
    
    if (!pattern) {
      return {
        success: false,
        error: `Pattern not found: ${patternId}`
      };
    }
    
    if (pattern.confidence < 0.7) {
      return {
        success: false,
        error: `Pattern confidence too low for promotion: ${pattern.confidence.toFixed(2)} (minimum: 0.70)`
      };
    }
    
    if (pattern.frequency < 5) {
      return {
        success: false,
        error: `Pattern frequency too low for promotion: ${pattern.frequency} (minimum: 5)`
      };
    }
    
    try {
      const skillName = this.generateSkillName(pattern);
      const skillContent = this.generateSkillContent(pattern);
      
      return {
        success: true,
        skillName,
        skillContent
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Generate a skill name from pattern
   */
  private generateSkillName(pattern: Pattern): string {
    // Convert pattern name to kebab-case skill name
    return pattern.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  /**
   * Generate skill content from pattern
   */
  private generateSkillContent(pattern: Pattern): string {
    const lines: string[] = [
      `# ${pattern.name}`,
      '',
      `> Auto-generated skill from pattern maturation`,
      `> Confidence: ${(pattern.confidence * 100).toFixed(0)}% | Frequency: ${pattern.frequency}`,
      '',
      '## Description',
      '',
      pattern.description,
      '',
      '## Tags',
      '',
      pattern.tags.map(t => `- ${t}`).join('\n'),
      '',
      '## Examples',
      ''
    ];
    
    // Add top examples
    for (let i = 0; i < Math.min(3, pattern.examples.length); i++) {
      const example = pattern.examples[i];
      lines.push(`### Example ${i + 1}`);
      lines.push('');
      lines.push(example.content);
      lines.push('');
      if (example.context.files.length > 0) {
        lines.push(`**Files:** ${example.context.files.slice(0, 3).join(', ')}`);
        lines.push('');
      }
    }
    
    lines.push('## Usage');
    lines.push('');
    lines.push('```');
    lines.push(`// Apply this skill when working with: ${pattern.tags.slice(0, 3).join(', ')}`);
    lines.push('// This skill was automatically generated from observed patterns');
    lines.push('```');
    
    return lines.join('\n');
  }
  
  /**
   * Get pattern statistics
   */
  getStats(): {
    totalPatterns: number;
    avgConfidence: number;
    avgFrequency: number;
    topTags: string[];
  } {
    const patterns = Array.from(this.patterns.values());
    
    if (patterns.length === 0) {
      return {
        totalPatterns: 0,
        avgConfidence: 0,
        avgFrequency: 0,
        topTags: []
      };
    }
    
    const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
    const avgFrequency = patterns.reduce((sum, p) => sum + p.frequency, 0) / patterns.length;
    
    // Count tag occurrences
    const tagCounts = new Map<string, number>();
    for (const pattern of patterns) {
      for (const tag of pattern.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
    
    return {
      totalPatterns: patterns.length,
      avgConfidence,
      avgFrequency,
      topTags
    };
  }
  
  /**
   * Clear pattern cache
   */
  clearCache(): void {
    this.patterns.clear();
  }
}

// Re-export Pattern type for convenience
export type { Pattern as PatternType };
