/**
 * LearningCapture - Automatic Learning Capture System - Issue #26.4
 * Sistema para capturar aprendizajes automáticamente de sesiones de AI
 */

import { Hivemind } from './hivemind';
import { 
  Learning, 
  LearningMetadata, 
  LearningContext,
  EmbeddingBackend 
} from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Types of captured learnings
 */
export type CapturedLearningType = 'decision' | 'pattern' | 'anti-pattern' | 'solution';

/**
 * Captured learning structure
 */
export interface CapturedLearning {
  type: CapturedLearningType;
  context: string;
  content: string;
  confidence: number;
  files: string[];
}

/**
 * Trigger configuration
 */
export interface TriggerConfig {
  /** Capture after successful commits */
  onCommitSuccess: boolean;
  /** Capture when a bug is resolved */
  onBugResolved: boolean;
  /** Capture when completing complex tasks */
  onTaskComplete: boolean;
  /** Capture when patterns are discovered */
  onPatternDiscovered: boolean;
  /** Minimum confidence threshold for auto-capture */
  minConfidence: number;
  /** Custom trigger handlers */
  customTriggers?: CustomTrigger[];
}

/**
 * Custom trigger definition
 */
export interface CustomTrigger {
  name: string;
  condition: (context: CaptureContext) => boolean | Promise<boolean>;
  handler: (context: CaptureContext) => CapturedLearning | Promise<CapturedLearning>;
}

/**
 * Context for capture operations
 */
export interface CaptureContext {
  /** Files involved in the operation */
  files: string[];
  /** Commit message if triggered by commit */
  commitMessage?: string;
  /** Task description if triggered by task */
  taskDescription?: string;
  /** Error message if triggered by bug fix */
  errorMessage?: string;
  /** Code changes (diff or content) */
  changes?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Auto-tagging configuration
 */
export interface AutoTaggingConfig {
  /** Enable auto-tagging by file type */
  byFileType: boolean;
  /** Enable auto-tagging by domain */
  byDomain: boolean;
  /** Enable auto-tagging by framework */
  byFramework: boolean;
  /** Custom tagging rules */
  customRules?: TaggingRule[];
}

/**
 * Custom tagging rule
 */
export interface TaggingRule {
  pattern: RegExp | string;
  tags: string[];
  type: 'file' | 'content' | 'extension';
}

/**
 * Default trigger configuration
 */
export const DEFAULT_TRIGGER_CONFIG: TriggerConfig = {
  onCommitSuccess: true,
  onBugResolved: true,
  onTaskComplete: true,
  onPatternDiscovered: true,
  minConfidence: 0.7,
};

/**
 * Default auto-tagging configuration
 */
export const DEFAULT_TAGGING_CONFIG: AutoTaggingConfig = {
  byFileType: true,
  byDomain: true,
  byFramework: true,
};

// ============================================================================
// Constants
// ============================================================================

/**
 * File type to tags mapping
 */
const FILE_TYPE_TAGS: Record<string, string[]> = {
  '.ts': ['typescript', 'backend'],
  '.tsx': ['typescript', 'react', 'frontend'],
  '.js': ['javascript'],
  '.jsx': ['javascript', 'react', 'frontend'],
  '.py': ['python'],
  '.go': ['golang'],
  '.rs': ['rust'],
  '.java': ['java'],
  '.rb': ['ruby'],
  '.php': ['php'],
  '.vue': ['vue', 'frontend'],
  '.svelte': ['svelte', 'frontend'],
  '.css': ['css', 'styling'],
  '.scss': ['scss', 'styling'],
  '.html': ['html', 'frontend'],
  '.sql': ['sql', 'database'],
  '.prisma': ['prisma', 'database', 'orm'],
  '.graphql': ['graphql', 'api'],
  '.yaml': ['yaml', 'config'],
  '.yml': ['yaml', 'config'],
  '.json': ['json', 'config'],
  '.md': ['markdown', 'docs'],
  '.sh': ['shell', 'script'],
  '.dockerfile': ['docker', 'devops'],
};

/**
 * Domain detection patterns
 */
const DOMAIN_PATTERNS: Array<{ pattern: RegExp; tags: string[] }> = [
  { pattern: /test|spec|\.test\.|\.spec\./i, tags: ['testing'] },
  { pattern: /auth|login|password|token|jwt|session/i, tags: ['auth', 'security'] },
  { pattern: /api|endpoint|route|controller/i, tags: ['api', 'backend'] },
  { pattern: /database|db|query|migration|schema/i, tags: ['database'] },
  { pattern: /cache|redis|memcached/i, tags: ['caching'] },
  { pattern: /queue|worker|job|background/i, tags: ['queue', 'async'] },
  { pattern: /graphql|gql|query|mutation/i, tags: ['graphql', 'api'] },
  { pattern: /websocket|socket|realtime/i, tags: ['websocket', 'realtime'] },
  { pattern: /docker|k8s|kubernetes|container/i, tags: ['devops', 'container'] },
  { pattern: /ci|cd|pipeline|deploy/i, tags: ['devops', 'ci-cd'] },
  { pattern: /error|exception|catch|handle/i, tags: ['error-handling'] },
  { pattern: /log|logger|monitoring|metric/i, tags: ['logging', 'observability'] },
  { pattern: /validate|validation|schema/i, tags: ['validation'] },
  { pattern: /component|ui|button|input|form/i, tags: ['ui', 'frontend'] },
  { pattern: /hook|use[A-Z]|useState|useEffect/i, tags: ['react', 'hooks'] },
  { pattern: /middleware|interceptor|guard/i, tags: ['middleware'] },
];

/**
 * Framework detection patterns
 */
const FRAMEWORK_PATTERNS: Array<{ pattern: RegExp; tags: string[] }> = [
  { pattern: /react|jsx|tsx|use[A-Z]/i, tags: ['react'] },
  { pattern: /vue|vuetify|vuex|pinia/i, tags: ['vue'] },
  { pattern: /angular|ng|@angular/i, tags: ['angular'] },
  { pattern: /svelte/i, tags: ['svelte'] },
  { pattern: /next\.js|next\//i, tags: ['nextjs'] },
  { pattern: /nuxt/i, tags: ['nuxt'] },
  { pattern: /express|express\(\)/i, tags: ['express'] },
  { pattern: /fastify/i, tags: ['fastify'] },
  { pattern: /nestjs|@nestjs/i, tags: ['nestjs'] },
  { pattern: /django/i, tags: ['django'] },
  { pattern: /flask/i, tags: ['flask'] },
  { pattern: /fastapi/i, tags: ['fastapi'] },
  { pattern: /rails/i, tags: ['rails'] },
  { pattern: /spring|@spring/i, tags: ['spring'] },
  { pattern: /prisma/i, tags: ['prisma'] },
  { pattern: /typeorm|@entity/i, tags: ['typeorm'] },
  { pattern: /sequelize/i, tags: ['sequelize'] },
  { pattern: /mongoose|schema\(/i, tags: ['mongoose'] },
  { pattern: /trpc/i, tags: ['trpc'] },
  { pattern: /tRPC/i, tags: ['trpc'] },
];

/**
 * Anti-pattern indicators
 */
const ANTI_PATTERN_INDICATORS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /any\s*\)/i, name: 'using-any-type' },
  { pattern: /@ts-ignore/i, name: 'ts-ignore' },
  { pattern: /eslint-disable/i, name: 'eslint-disable' },
  { pattern: /TODO|FIXME|HACK|XXX/i, name: 'code-smell-comment' },
  { pattern: /console\.(log|debug|info)/i, name: 'console-logging' },
  { pattern: /password\s*=\s*['"][^'"]+['"]/i, name: 'hardcoded-password' },
  { pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/i, name: 'hardcoded-api-key' },
  { pattern: /SELECT\s*\*\s*FROM/i, name: 'select-all-columns' },
  { pattern: /eval\s*\(/i, name: 'eval-usage' },
  { pattern: /innerHTML\s*=/i, name: 'innerHTML-assignment' },
  { pattern: /document\.write/i, name: 'document-write' },
];

/**
 * Pattern indicators
 */
const PATTERN_INDICATORS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /interface\s+\w+\s*\{/i, name: 'interface-definition' },
  { pattern: /type\s+\w+\s*=/i, name: 'type-alias' },
  { pattern: /class\s+\w+.*implements/i, name: 'interface-implementation' },
  { pattern: /async\s+\w+\s*\(/i, name: 'async-function' },
  { pattern: /Promise\.<\w+>/i, name: 'promise-usage' },
  { pattern: /try\s*\{[\s\S]*catch/i, name: 'error-handling' },
  { pattern: /useMemo|useCallback/i, name: 'react-optimization' },
  { pattern: /debounce|throttle/i, name: 'performance-optimization' },
  { pattern: /lazy\(|React\.lazy/i, name: 'code-splitting' },
];

// ============================================================================
// LearningCapture Class
// ============================================================================

/**
 * LearningCapture - Automatic Learning Capture System
 * 
 * Captures learnings from AI sessions automatically based on configurable triggers.
 * Supports auto-tagging based on file types, domains, and frameworks.
 * 
 * @example
 * ```typescript
 * const capture = new LearningCapture(hivemind, backend);
 * await capture.initialize();
 * 
 * // Configure triggers
 * capture.configure({
 *   onCommitSuccess: true,
 *   onBugResolved: true,
 *   minConfidence: 0.8
 * });
 * 
 * // Trigger capture manually
 * await capture.captureFromCommit(files, commitMessage);
 * ```
 */
export class LearningCapture {
  private hivemind: Hivemind;
  private backend: EmbeddingBackend;
  private triggerConfig: TriggerConfig;
  private taggingConfig: AutoTaggingConfig;
  private customTriggers: CustomTrigger[] = [];
  private codebasePath: string;
  private initialized: boolean = false;

  constructor(
    hivemind: Hivemind, 
    backend: EmbeddingBackend,
    codebasePath: string = process.cwd()
  ) {
    this.hivemind = hivemind;
    this.backend = backend;
    this.codebasePath = codebasePath;
    this.triggerConfig = { ...DEFAULT_TRIGGER_CONFIG };
    this.taggingConfig = { ...DEFAULT_TAGGING_CONFIG };
  }

  /**
   * Initialize the learning capture system
   */
  async initialize(): Promise<void> {
    this.initialized = true;
  }

  /**
   * Configure trigger settings
   */
  configure(config: Partial<TriggerConfig>): void {
    this.triggerConfig = { ...this.triggerConfig, ...config };
    if (config.customTriggers) {
      this.customTriggers = [...this.customTriggers, ...config.customTriggers];
    }
  }

  /**
   * Configure auto-tagging settings
   */
  configureTagging(config: Partial<AutoTaggingConfig>): void {
    this.taggingConfig = { ...this.taggingConfig, ...config };
  }

  /**
   * Add a custom trigger
   */
  addCustomTrigger(trigger: CustomTrigger): void {
    this.customTriggers.push(trigger);
  }

  /**
   * Capture learning from a successful commit
   */
  async captureFromCommit(
    files: string[], 
    commitMessage: string,
    changes?: string
  ): Promise<Learning | null> {
    if (!this.triggerConfig.onCommitSuccess) {
      return null;
    }

    const context: CaptureContext = {
      files,
      commitMessage,
      changes,
    };

    const captured = await this.analyzeAndCapture(context);
    
    if (captured && captured.confidence >= this.triggerConfig.minConfidence) {
      return this.saveLearning(captured);
    }

    return null;
  }

  /**
   * Capture learning from bug resolution
   */
  async captureFromBugFix(
    files: string[],
    errorMessage: string,
    solution: string,
    changes?: string
  ): Promise<Learning | null> {
    if (!this.triggerConfig.onBugResolved) {
      return null;
    }

    const context: CaptureContext = {
      files,
      errorMessage,
      taskDescription: solution,
      changes,
      metadata: { type: 'bug-fix' },
    };

    const captured = await this.analyzeAndCapture(context);
    
    if (captured && captured.confidence >= this.triggerConfig.minConfidence) {
      return this.saveLearning(captured);
    }

    return null;
  }

  /**
   * Capture learning from task completion
   */
  async captureFromTask(
    files: string[],
    taskDescription: string,
    changes?: string
  ): Promise<Learning | null> {
    if (!this.triggerConfig.onTaskComplete) {
      return null;
    }

    const context: CaptureContext = {
      files,
      taskDescription,
      changes,
    };

    const captured = await this.analyzeAndCapture(context);
    
    if (captured && captured.confidence >= this.triggerConfig.minConfidence) {
      return this.saveLearning(captured);
    }

    return null;
  }

  /**
   * Capture a discovered pattern
   */
  async capturePattern(
    files: string[],
    patternName: string,
    description: string,
    examples: string[]
  ): Promise<Learning | null> {
    if (!this.triggerConfig.onPatternDiscovered) {
      return null;
    }

    const captured: CapturedLearning = {
      type: 'pattern',
      context: `Pattern: ${patternName}`,
      content: `${description}\n\nExamples:\n${examples.map(e => `- ${e}`).join('\n')}`,
      confidence: 0.9,
      files,
    };

    return this.saveLearning(captured);
  }

  /**
   * Manually capture a learning
   */
  async capture(
    type: CapturedLearningType,
    context: string,
    content: string,
    files: string[],
    confidence: number = 0.8
  ): Promise<Learning | null> {
    const captured: CapturedLearning = {
      type,
      context,
      content,
      confidence,
      files,
    };

    return this.saveLearning(captured);
  }

  /**
   * Analyze context and capture learning
   */
  private async analyzeAndCapture(context: CaptureContext): Promise<CapturedLearning | null> {
    // Detect learning type
    const type = this.detectLearningType(context);
    
    // Generate content based on type
    const content = await this.generateContent(context, type);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(context, type);
    
    // Extract context description
    const contextDesc = this.extractContextDescription(context);

    return {
      type,
      context: contextDesc,
      content,
      confidence,
      files: context.files,
    };
  }

  /**
   * Detect the type of learning from context
   */
  private detectLearningType(context: CaptureContext): CapturedLearningType {
    // Check for bug fix
    if (context.errorMessage || 
        (context.commitMessage && /fix|bug|error|issue/i.test(context.commitMessage))) {
      return 'solution';
    }

    // Check for anti-patterns
    if (context.changes) {
      for (const indicator of ANTI_PATTERN_INDICATORS) {
        if (indicator.pattern.test(context.changes)) {
          return 'anti-pattern';
        }
      }
    }

    // Check for architectural decision
    if (context.commitMessage && 
        /architect|design|decision|refactor|restructure/i.test(context.commitMessage)) {
      return 'decision';
    }

    // Check for patterns
    if (context.changes) {
      for (const indicator of PATTERN_INDICATORS) {
        if (indicator.pattern.test(context.changes)) {
          return 'pattern';
        }
      }
    }

    // Default to pattern for successful tasks
    if (context.taskDescription) {
      return 'pattern';
    }

    return 'decision';
  }

  /**
   * Generate content for the learning
   */
  private async generateContent(
    context: CaptureContext, 
    type: CapturedLearningType
  ): Promise<string> {
    const parts: string[] = [];

    // Add type header
    parts.push(`[${type.toUpperCase()}]`);

    // Add commit message if available
    if (context.commitMessage) {
      parts.push(`Commit: ${context.commitMessage}`);
    }

    // Add task description if available
    if (context.taskDescription) {
      parts.push(`Task: ${context.taskDescription}`);
    }

    // Add error message if available
    if (context.errorMessage) {
      parts.push(`Error: ${context.errorMessage}`);
    }

    // Add files involved
    if (context.files.length > 0) {
      parts.push(`Files: ${context.files.join(', ')}`);
    }

    // Add detected patterns/anti-patterns
    if (context.changes) {
      const detectedPatterns = this.detectPatternsInCode(context.changes, type);
      if (detectedPatterns.length > 0) {
        parts.push(`Detected: ${detectedPatterns.join(', ')}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Detect patterns or anti-patterns in code
   */
  private detectPatternsInCode(code: string, type: CapturedLearningType): string[] {
    const detected: string[] = [];
    const indicators = type === 'anti-pattern' ? ANTI_PATTERN_INDICATORS : PATTERN_INDICATORS;

    for (const indicator of indicators) {
      if (indicator.pattern.test(code)) {
        detected.push(indicator.name);
      }
    }

    return Array.from(new Set(detected)); // Remove duplicates
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(context: CaptureContext, type: CapturedLearningType): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence for more context
    if (context.commitMessage) confidence += 0.1;
    if (context.taskDescription) confidence += 0.1;
    if (context.changes) confidence += 0.15;
    if (context.files.length > 0) confidence += 0.05;
    if (context.files.length > 3) confidence += 0.05;

    // Adjust based on type
    if (type === 'anti-pattern') confidence += 0.1; // Anti-patterns are important
    if (type === 'solution') confidence += 0.15; // Solutions are valuable

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Extract context description
   */
  private extractContextDescription(context: CaptureContext): string {
    if (context.commitMessage) {
      return context.commitMessage.split('\n')[0]; // First line of commit
    }
    if (context.taskDescription) {
      return context.taskDescription.slice(0, 100); // First 100 chars
    }
    if (context.errorMessage) {
      return `Fix: ${context.errorMessage.slice(0, 80)}`;
    }
    return 'General learning';
  }

  /**
   * Generate auto-tags for a learning
   */
  private generateTags(context: CaptureContext, type: CapturedLearningType): string[] {
    const tags: Set<string> = new Set();

    // Add type tag
    tags.add(type);

    // Tag by file type
    if (this.taggingConfig.byFileType) {
      for (const file of context.files) {
        const ext = this.getFileExtension(file);
        const fileTags = FILE_TYPE_TAGS[ext];
        if (fileTags) {
          fileTags.forEach(tag => tags.add(tag));
        }
      }
    }

    // Tag by domain
    if (this.taggingConfig.byDomain) {
      const allContent = [
        context.commitMessage,
        context.taskDescription,
        context.changes,
        context.errorMessage,
      ].filter(Boolean).join(' ');

      for (const { pattern, tags: domainTags } of DOMAIN_PATTERNS) {
        if (pattern.test(allContent)) {
          domainTags.forEach(tag => tags.add(tag));
        }
      }
    }

    // Tag by framework
    if (this.taggingConfig.byFramework) {
      const allContent = [
        context.commitMessage,
        context.taskDescription,
        context.changes,
      ].filter(Boolean).join(' ');

      for (const { pattern, tags: frameworkTags } of FRAMEWORK_PATTERNS) {
        if (pattern.test(allContent)) {
          frameworkTags.forEach(tag => tags.add(tag));
        }
      }
    }

    // Apply custom tagging rules
    if (this.taggingConfig.customRules) {
      for (const rule of this.taggingConfig.customRules) {
        const match = this.applyTaggingRule(rule, context);
        if (match) {
          rule.tags.forEach(tag => tags.add(tag));
        }
      }
    }

    return Array.from(tags);
  }

  /**
   * Apply a custom tagging rule
   */
  private applyTaggingRule(rule: TaggingRule, context: CaptureContext): boolean {
    switch (rule.type) {
      case 'file':
        return context.files.some(file => {
          if (typeof rule.pattern === 'string') {
            return file.includes(rule.pattern);
          }
          return rule.pattern.test(file);
        });
      
      case 'content':
        const allContent = [
          context.commitMessage,
          context.taskDescription,
          context.changes,
        ].filter(Boolean).join(' ');
        
        if (typeof rule.pattern === 'string') {
          return allContent.includes(rule.pattern);
        }
        return rule.pattern.test(allContent);
      
      case 'extension':
        return context.files.some(file => {
          const ext = this.getFileExtension(file);
          if (typeof rule.pattern === 'string') {
            return ext === rule.pattern;
          }
          return rule.pattern.test(ext);
        });
      
      default:
        return false;
    }
  }

  /**
   * Get file extension
   */
  private getFileExtension(filename: string): string {
    const basename = filename.split('/').pop() || '';
    const parts = basename.split('.');
    
    if (parts.length > 1) {
      return '.' + parts.pop();
    }
    
    return '';
  }

  /**
   * Save learning to Hivemind
   */
  private async saveLearning(captured: CapturedLearning): Promise<Learning> {
    const context: CaptureContext = {
      files: captured.files,
      commitMessage: captured.context,
      changes: captured.content,
    };

    const tags = this.generateTags(context, captured.type);
    
    const learning: Learning = {
      id: this.generateId(),
      content: captured.content,
      embedding: [],
      metadata: {
        source: 'learning-capture',
        timestamp: new Date(),
        tags,
        category: this.mapTypeToCategory(captured.type),
      },
      context: {
        codebase: this.codebasePath,
        files: captured.files,
        task: captured.context,
      },
    };

    await this.hivemind.save(learning);
    
    return learning;
  }

  /**
   * Map learning type to category
   */
  private mapTypeToCategory(type: CapturedLearningType): LearningMetadata['category'] {
    switch (type) {
      case 'pattern':
        return 'pattern';
      case 'anti-pattern':
        return 'anti-pattern';
      case 'decision':
        return 'best-practice';
      case 'solution':
        return 'best-practice';
      default:
        return 'pattern';
    }
  }

  /**
   * Generate unique ID for learning
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `learn-${timestamp}-${random}`;
  }

  /**
   * Process custom triggers
   */
  async processCustomTriggers(context: CaptureContext): Promise<Learning[]> {
    const learnings: Learning[] = [];

    for (const trigger of this.customTriggers) {
      try {
        const shouldTrigger = await trigger.condition(context);
        if (shouldTrigger) {
          const captured = await trigger.handler(context);
          if (captured.confidence >= this.triggerConfig.minConfidence) {
            const learning = await this.saveLearning(captured);
            learnings.push(learning);
          }
        }
      } catch (error) {
        console.error(`Custom trigger '${trigger.name}' failed:`, error);
      }
    }

    return learnings;
  }

  /**
   * Get current configuration
   */
  getConfig(): { triggers: TriggerConfig; tagging: AutoTaggingConfig } {
    return {
      triggers: { ...this.triggerConfig },
      tagging: { ...this.taggingConfig },
    };
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a LearningCapture instance with default configuration
 */
export async function createLearningCapture(
  hivemind: Hivemind,
  backend: EmbeddingBackend,
  codebasePath?: string
): Promise<LearningCapture> {
  const capture = new LearningCapture(hivemind, backend, codebasePath);
  await capture.initialize();
  return capture;
}

/**
 * Quick capture helper for common scenarios
 */
export async function quickCapture(
  capture: LearningCapture,
  type: CapturedLearningType,
  description: string,
  files: string[] = []
): Promise<Learning | null> {
  return capture.capture(type, description, description, files);
}
