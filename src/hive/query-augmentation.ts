/**
 * Query Augmentation System - Issue #26.6
 * Sistema para mejorar queries de búsqueda con contexto
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const execAsync = promisify(exec);

/**
 * Augmented query with expanded terms and context
 */
export interface AugmentedQuery {
  /** Original query string */
  original: string;
  /** Expanded query terms */
  expanded: string[];
  /** Context information */
  context: QueryContext;
  /** Applied filters */
  filters: QueryFilters;
  /** Relevance scores */
  scoring: RelevanceScoring;
}

/**
 * Context gathered from the project
 */
export interface QueryContext {
  /** Current codebase/project name */
  codebase: string;
  /** Recently modified files */
  recentFiles: RecentFileInfo[];
  /** Active task in hive (if any) */
  activeTask?: ActiveTaskInfo;
  /** Current git branch */
  gitBranch?: string;
  /** Project dependencies */
  dependencies: DependencyInfo[];
}

/**
 * Information about a recently modified file
 */
export interface RecentFileInfo {
  path: string;
  lastModified: Date;
  type: string;
}

/**
 * Information about the active task
 */
export interface ActiveTaskInfo {
  id: string;
  title: string;
  type: string;
  tags: string[];
}

/**
 * Information about a project dependency
 */
export interface DependencyInfo {
  name: string;
  version: string;
  type: 'production' | 'dev';
}

/**
 * Filters applied to the query
 */
export interface QueryFilters {
  /** Categories to filter by */
  category?: string[];
  /** Tags to filter by */
  tags?: string[];
  /** Date range for results */
  dateRange?: [Date, Date];
  /** File extensions to include */
  fileExtensions?: string[];
  /** Minimum relevance score */
  minRelevance?: number;
}

/**
 * Relevance scoring configuration
 */
export interface RelevanceScoring {
  /** Weight for semantic similarity (0-1) */
  semanticWeight: number;
  /** Weight for temporal relevance (0-1) */
  temporalWeight: number;
  /** Weight for contextual relevance (0-1) */
  contextualWeight: number;
  /** Boost for exact matches */
  exactMatchBoost: number;
}

/**
 * Technical synonyms map for query expansion
 */
const TECHNICAL_SYNONYMS: Record<string, string[]> = {
  // Programming concepts
  'function': ['method', 'procedure', 'routine', 'fn', 'func'],
  'method': ['function', 'procedure', 'routine'],
  'class': ['type', 'interface', 'struct', 'object'],
  'interface': ['type', 'contract', 'abstract'],
  'variable': ['var', 'let', 'const', 'binding', 'identifier'],
  'parameter': ['param', 'argument', 'arg'],
  'argument': ['param', 'parameter', 'arg'],
  'return': ['output', 'result', 'response'],
  
  // Data structures
  'array': ['list', 'collection', 'sequence'],
  'object': ['dict', 'map', 'record', 'hash'],
  'string': ['text', 'str', 'char'],
  'number': ['int', 'integer', 'float', 'numeric'],
  'boolean': ['bool', 'flag'],
  
  // Operations
  'create': ['make', 'new', 'init', 'initialize', 'instantiate'],
  'update': ['modify', 'change', 'edit', 'patch', 'mutate'],
  'delete': ['remove', 'destroy', 'erase', 'unlink'],
  'read': ['get', 'fetch', 'retrieve', 'load'],
  'write': ['save', 'store', 'persist', 'write'],
  
  // Testing
  'test': ['spec', 'testing', 'unittest', 'testing'],
  'mock': ['stub', 'fake', 'spy', 'double'],
  'assert': ['expect', 'verify', 'check', 'validate'],
  
  // Architecture
  'api': ['endpoint', 'route', 'service', 'rest'],
  'component': ['module', 'widget', 'element', 'part'],
  'service': ['provider', 'handler', 'worker'],
  'handler': ['controller', 'processor', 'listener'],
  
  // Errors
  'error': ['exception', 'err', 'failure', 'fault'],
  'bug': ['issue', 'defect', 'problem', 'glitch'],
  'fix': ['patch', 'repair', 'resolve', 'correct'],
  
  // Git
  'commit': ['changeset', 'revision', 'snapshot'],
  'branch': ['fork', 'stream', 'line'],
  'merge': ['integrate', 'combine', 'join'],
  'pull': ['fetch', 'download', 'sync'],
  'push': ['upload', 'publish', 'sync'],
  
  // Patterns
  'async': ['asynchronous', 'promise', 'await', 'callback'],
  'sync': ['synchronous', 'blocking'],
  'cache': ['memoize', 'store', 'buffer'],
  'queue': ['buffer', 'pipeline', 'channel'],
  
  // Database
  'query': ['search', 'find', 'lookup', 'select'],
  'database': ['db', 'storage', 'persistence'],
  'table': ['relation', 'entity', 'collection'],
  'index': ['idx', 'key', 'pointer'],
};

/**
 * Default relevance scoring configuration
 */
const DEFAULT_SCORING: RelevanceScoring = {
  semanticWeight: 0.4,
  temporalWeight: 0.3,
  contextualWeight: 0.3,
  exactMatchBoost: 1.5,
};

/**
 * Query Augmentation class
 * Expands queries with related terms and adds project context
 */
export class QueryAugmentation {
  private projectRoot: string;
  private hiveDir: string;
  private synonyms: Map<string, string[]>;
  private scoring: RelevanceScoring;

  constructor(options: QueryAugmentationOptions = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.hiveDir = options.hiveDir || join(this.projectRoot, '.hive');
    this.synonyms = new Map(Object.entries(TECHNICAL_SYNONYMS));
    this.scoring = { ...DEFAULT_SCORING, ...options.scoring };
    
    // Add custom synonyms
    if (options.customSynonyms) {
      for (const [term, synonyms] of Object.entries(options.customSynonyms)) {
        this.synonyms.set(term.toLowerCase(), synonyms);
      }
    }
  }

  /**
   * Augment a query with expanded terms and context
   */
  async augment(query: string, options: AugmentOptions = {}): Promise<AugmentedQuery> {
    const expanded = await this.expandQuery(query);
    const context = await this.gatherContext(options);
    const filters = this.buildFilters(query, options);
    
    return {
      original: query,
      expanded,
      context,
      filters,
      scoring: this.scoring,
    };
  }

  /**
   * Expand a query with related terms
   */
  private async expandQuery(query: string): Promise<string[]> {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const expanded = new Set<string>([query]);
    
    for (const term of terms) {
      // Add the term itself
      expanded.add(term);
      
      // Add synonyms
      const synonyms = this.synonyms.get(term) || [];
      for (const synonym of synonyms) {
        expanded.add(synonym);
      }
      
      // Add plural/singular variations
      if (term.endsWith('s')) {
        expanded.add(term.slice(0, -1));
      } else {
        expanded.add(term + 's');
      }
      
      // Add common prefixes
      const prefixes = ['get', 'set', 'is', 'has', 'can', 'should', 'will'];
      for (const prefix of prefixes) {
        expanded.add(`${prefix}${term.charAt(0).toUpperCase()}${term.slice(1)}`);
      }
    }
    
    return Array.from(expanded);
  }

  /**
   * Gather context from the project
   */
  private async gatherContext(options: AugmentOptions): Promise<QueryContext> {
    const [
      recentFiles,
      activeTask,
      gitBranch,
      dependencies,
    ] = await Promise.all([
      this.getRecentFiles(options.maxRecentFiles || 10),
      this.getActiveTask(),
      this.getGitBranch(),
      this.getDependencies(),
    ]);
    
    return {
      codebase: this.getProjectName(),
      recentFiles,
      activeTask,
      gitBranch,
      dependencies,
    };
  }

  /**
   * Build filters from options
   */
  private buildFilters(query: string, options: AugmentOptions): QueryFilters {
    const filters: QueryFilters = {};
    
    if (options.category) {
      filters.category = Array.isArray(options.category) 
        ? options.category 
        : [options.category];
    }
    
    if (options.tags) {
      filters.tags = options.tags;
    }
    
    if (options.dateRange) {
      filters.dateRange = options.dateRange;
    }
    
    if (options.fileExtensions) {
      filters.fileExtensions = options.fileExtensions;
    }
    
    if (options.minRelevance !== undefined) {
      filters.minRelevance = options.minRelevance;
    }
    
    return filters;
  }

  /**
   * Get recently modified files
   */
  private async getRecentFiles(limit: number): Promise<RecentFileInfo[]> {
    const files: RecentFileInfo[] = [];
    
    try {
      // Get files modified in the last 7 days
      const { stdout } = await execAsync(
        `git log --name-only --pretty=format: --since="7 days ago" | sort | uniq | head -n ${limit * 2}`,
        { cwd: this.projectRoot }
      );
      
      const filePaths = stdout.split('\n').filter(f => f.trim().length > 0);
      
      for (const filePath of filePaths.slice(0, limit)) {
        try {
          const fullPath = join(this.projectRoot, filePath);
          const stats = statSync(fullPath);
          const ext = extname(filePath);
          
          files.push({
            path: filePath,
            lastModified: stats.mtime,
            type: this.getFileType(ext),
          });
        } catch {
          // File might not exist anymore
          continue;
        }
      }
    } catch {
      // Git might not be available or no commits
    }
    
    return files;
  }

  /**
   * Get file type from extension
   */
  private getFileType(ext: string): string {
    const types: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'golang',
      '.rs': 'rust',
      '.java': 'java',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.sql': 'sql',
    };
    
    return types[ext.toLowerCase()] || 'unknown';
  }

  /**
   * Get active task from hive
   */
  private async getActiveTask(): Promise<ActiveTaskInfo | undefined> {
    try {
      const cellsDir = join(this.hiveDir, 'cells');
      const files = readdirSync(cellsDir).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        try {
          const content = readFileSync(join(cellsDir, file), 'utf-8');
          const cell = JSON.parse(content);
          
          if (cell.status === 'in_progress') {
            return {
              id: cell.id,
              title: cell.title,
              type: cell.type,
              tags: cell.tags || [],
            };
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Hive directory might not exist
    }
    
    return undefined;
  }

  /**
   * Get current git branch
   */
  private async getGitBranch(): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.projectRoot,
      });
      return stdout.trim();
    } catch {
      return undefined;
    }
  }

  /**
   * Get project dependencies
   */
  private async getDependencies(): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    
    try {
      const packageJsonPath = join(this.projectRoot, 'package.json');
      const content = readFileSync(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      
      // Production dependencies
      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
          dependencies.push({
            name,
            version: version as string,
            type: 'production',
          });
        }
      }
      
      // Dev dependencies
      if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(packageJson.devDependencies)) {
          dependencies.push({
            name,
            version: version as string,
            type: 'dev',
          });
        }
      }
    } catch {
      // package.json might not exist
    }
    
    return dependencies;
  }

  /**
   * Get project name from package.json or directory
   */
  private getProjectName(): string {
    try {
      const packageJsonPath = join(this.projectRoot, 'package.json');
      const content = readFileSync(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      return packageJson.name || 'unknown';
    } catch {
      return this.projectRoot.split('/').pop() || 'unknown';
    }
  }

  /**
   * Calculate relevance score for a result
   */
  calculateRelevance(
    augmentedQuery: AugmentedQuery,
    result: { content: string; timestamp?: Date; tags?: string[]; files?: string[] }
  ): number {
    const scores: number[] = [];
    
    // Semantic similarity (based on term matching)
    const semanticScore = this.calculateSemanticScore(augmentedQuery, result.content);
    scores.push(semanticScore * this.scoring.semanticWeight);
    
    // Temporal relevance
    if (result.timestamp) {
      const temporalScore = this.calculateTemporalScore(result.timestamp);
      scores.push(temporalScore * this.scoring.temporalWeight);
    }
    
    // Contextual relevance
    const contextualScore = this.calculateContextualScore(augmentedQuery, result);
    scores.push(contextualScore * this.scoring.contextualWeight);
    
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  /**
   * Calculate semantic score based on term matching
   */
  private calculateSemanticScore(query: AugmentedQuery, content: string): number {
    const contentLower = content.toLowerCase();
    let matchCount = 0;
    let exactMatch = false;
    
    for (const term of query.expanded) {
      if (contentLower.includes(term.toLowerCase())) {
        matchCount++;
        if (term === query.original) {
          exactMatch = true;
        }
      }
    }
    
    const baseScore = matchCount / query.expanded.length;
    return exactMatch ? baseScore * this.scoring.exactMatchBoost : baseScore;
  }

  /**
   * Calculate temporal score (more recent = higher score)
   */
  private calculateTemporalScore(timestamp: Date): number {
    const now = Date.now();
    const then = timestamp.getTime();
    const ageDays = (now - then) / (1000 * 60 * 60 * 24);
    
    // Exponential decay with half-life of 30 days
    const halfLife = 30;
    return Math.pow(0.5, ageDays / halfLife);
  }

  /**
   * Calculate contextual score based on files and tags
   */
  private calculateContextualScore(
    query: AugmentedQuery,
    result: { tags?: string[]; files?: string[] }
  ): number {
    let score = 0;
    let factors = 0;
    
    // Check tag overlap
    if (result.tags && query.filters.tags) {
      const overlap = result.tags.filter(t => query.filters.tags!.includes(t)).length;
      score += overlap / Math.max(result.tags.length, query.filters.tags.length);
      factors++;
    }
    
    // Check file relevance
    if (result.files && query.context.recentFiles.length > 0) {
      const recentPaths = query.context.recentFiles.map(f => f.path);
      const overlap = result.files.filter(f => 
        recentPaths.some(rp => f.includes(rp) || rp.includes(f))
      ).length;
      score += overlap / Math.max(result.files.length, recentPaths.length);
      factors++;
    }
    
    // Check active task relevance
    if (query.context.activeTask && result.tags) {
      const taskTags = query.context.activeTask.tags;
      const overlap = result.tags.filter(t => taskTags.includes(t)).length;
      if (overlap > 0) {
        score += 0.5; // Boost for active task relevance
        factors++;
      }
    }
    
    return factors > 0 ? score / factors : 0.5;
  }

  /**
   * Add custom synonym mapping
   */
  addSynonym(term: string, synonyms: string[]): void {
    this.synonyms.set(term.toLowerCase(), synonyms);
  }

  /**
   * Update scoring weights
   */
  setScoring(scoring: Partial<RelevanceScoring>): void {
    this.scoring = { ...this.scoring, ...scoring };
  }
}

/**
 * Options for QueryAugmentation constructor
 */
export interface QueryAugmentationOptions {
  /** Project root directory */
  projectRoot?: string;
  /** Hive directory */
  hiveDir?: string;
  /** Custom synonym mappings */
  customSynonyms?: Record<string, string[]>;
  /** Relevance scoring configuration */
  scoring?: Partial<RelevanceScoring>;
}

/**
 * Options for augment method
 */
export interface AugmentOptions {
  /** Categories to filter by */
  category?: string | string[];
  /** Tags to filter by */
  tags?: string[];
  /** Date range for results */
  dateRange?: [Date, Date];
  /** File extensions to include */
  fileExtensions?: string[];
  /** Minimum relevance score */
  minRelevance?: number;
  /** Maximum recent files to include */
  maxRecentFiles?: number;
}

export default QueryAugmentation;
