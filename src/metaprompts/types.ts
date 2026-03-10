/**
 * Meta-Prompts System Types
 *
 * Type definitions for the meta-prompts system that supports
 * dynamic context injection and prompt optimization for specialized agents.
 */

export {};

/**
 * Variable types supported in templates
 */
export type VariableType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'code'
  | 'json'
  | 'markdown';

/**
 * Template variable definition
 */
export interface TemplateVariable {
  /** Variable name (used in template as {{name}}) */
  name: string;
  /** Variable type */
  type: VariableType;
  /** Human-readable description */
  description: string;
  /** Whether this variable is required */
  required: boolean;
  /** Default value if not provided */
  default?: unknown;
  /** Validation pattern for string types */
  pattern?: string;
  /** Constraints for array/object types */
  constraints?: {
    minItems?: number;
    maxItems?: number;
    minLength?: number;
    maxLength?: number;
  };
}

/**
 * Prompt template definition
 */
export interface PromptTemplate {
  /** Unique template identifier */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Agent type this template is for */
  agentType: AgentType;
  /** Template content with {{variable}} placeholders */
  content: string;
  /** Variables used in this template */
  variables: TemplateVariable[];
  /** Template metadata */
  metadata: TemplateMetadata;
}

/**
 * Agent types supported by the meta-prompts system
 */
export type AgentType =
  | 'coordinator'
  | 'researcher'
  | 'planner'
  | 'executor'
  | 'reviewer'
  | 'tester'
  | 'debugger'
  | 'optimizer'
  | 'documenter'
  | 'validator'
  | 'migrator'
  | 'analyzer';

/**
 * Template metadata
 */
export interface TemplateMetadata {
  /** Template author */
  author: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last modification timestamp */
  modifiedAt: Date;
  /** Template tags */
  tags: string[];
  /** Complexity level (1-5) */
  complexity: number;
  /** Estimated token count */
  estimatedTokens: number;
  /** Whether template is active */
  isActive: boolean;
}

/**
 * Prompt version information
 */
export interface PromptVersion {
  /** Version identifier (semver) */
  version: string;
  /** Template ID this version belongs to */
  templateId: string;
  /** Version content */
  content: string;
  /** Changelog for this version */
  changelog: string;
  /** Author of this version */
  author: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Whether this is the current version */
  isCurrent: boolean;
  /** Parent version (for branching) */
  parentVersion?: string;
}

/**
 * Injected context for prompt rendering
 */
export interface InjectedContext {
  /** Task description */
  task: string;
  /** Project context */
  project?: {
    name: string;
    path: string;
    language?: string;
    framework?: string;
  };
  /** Code context */
  code?: {
    files?: string[];
    snippets?: CodeSnippet[];
    dependencies?: string[];
  };
  /** Historical context */
  history?: {
    previousAttempts?: string[];
    learnings?: string[];
    errors?: string[];
  };
  /** Environment context */
  environment?: {
    os?: string;
    shell?: string;
    nodeVersion?: string;
    tools?: string[];
  };
  /** Custom variables */
  custom?: Record<string, unknown>;
}

/**
 * Code snippet for context injection
 */
export interface CodeSnippet {
  /** File path */
  file: string;
  /** Line range */
  lines: { start: number; end: number };
  /** Code content */
  content: string;
  /** Language */
  language: string;
  /** Relevance score (0-1) */
  relevance: number;
}

/**
 * Optimization strategy
 */
export type OptimizationStrategy =
  | 'token_reduction'
  | 'clarity_enhancement'
  | 'context_compression'
  | 'focus_narrowing'
  | 'example_addition'
  | 'constraint_tightening';

/**
 * Optimization result
 */
export interface OptimizationResult {
  /** Original prompt */
  original: string;
  /** Optimized prompt */
  optimized: string;
  /** Strategy applied */
  strategy: OptimizationStrategy;
  /** Metrics before/after */
  metrics: {
    originalTokens: number;
    optimizedTokens: number;
    tokenReduction: number;
    clarityScore: number;
  };
  /** Changes made */
  changes: string[];
}

/**
 * Rendered prompt result
 */
export interface RenderedPrompt {
  /** Final prompt text */
  prompt: string;
  /** Template used */
  templateId: string;
  /** Version used */
  version: string;
  /** Variables substituted */
  variables: Record<string, unknown>;
  /** Context injected */
  context: InjectedContext;
  /** Token estimate */
  estimatedTokens: number;
  /** Render timestamp */
  renderedAt: Date;
}

/**
 * Template registry entry
 */
export interface RegistryEntry {
  /** Template */
  template: PromptTemplate;
  /** All versions */
  versions: PromptVersion[];
  /** Current version */
  currentVersion: string;
  /** Usage statistics */
  stats: {
    usageCount: number;
    avgTokens: number;
    lastUsed?: Date;
    successRate: number;
  };
}

/**
 * Meta-prompt system configuration
 */
export interface MetaPromptConfig {
  /** Default agent type */
  defaultAgentType: AgentType;
  /** Maximum context tokens */
  maxContextTokens: number;
  /** Optimization enabled */
  optimizationEnabled: boolean;
  /** Default optimization strategy */
  defaultStrategy: OptimizationStrategy;
  /** Storage path for templates */
  storagePath: string;
  /** Versioning enabled */
  versioningEnabled: boolean;
}

/**
 * Validation result for template variables
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Warnings */
  warnings: string[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Variable name with error */
  variable: string;
  /** Error message */
  message: string;
  /** Error type */
  type: 'missing' | 'invalid_type' | 'pattern_mismatch' | 'constraint_violation';
  /** Received value */
  received?: unknown;
}

/**
 * Agent capability profile
 */
export interface AgentCapability {
  /** Agent type */
  agentType: AgentType;
  /** Supported operations */
  capabilities: string[];
  /** Preferred context depth */
  contextDepth: 'minimal' | 'standard' | 'deep';
  /** Optimal prompt length */
  optimalLength: 'short' | 'medium' | 'long';
  /** Special instructions */
  specialInstructions?: string[];
}
