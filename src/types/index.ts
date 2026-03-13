/**
 * Tipos base para Swarm CLI - Integración de Issues
 * Issues: #15, #16, #17, #18, #19, #22, #24, #26
 */

// ============================================================================
// PLAN.md Types - Issue #15
// ============================================================================

export type PlanType = 'execute' | 'tdd' | 'checkpoint';
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'blocked';
export type CheckpointType = 'human-verify' | 'decision' | 'notify';

export interface PlanFrontmatter {
  phase: string;
  plan: number;
  type: PlanType;
  wave: number;
  depends_on: string[];
  files_modified: string[];
  autonomous: boolean;
  requirements: string[];
  user_setup?: UserSetupConfig[];
  dashboard_config?: DashboardConfig[];
  must_haves?: MustHaves;
}

export interface UserSetupConfig {
  service: string;
  why: string;
  env_vars: Array<{
    name: string;
    source: string;
  }>;
}

export interface DashboardConfig {
  task: string;
  location: string;
}

export interface MustHaves {
  truths: string[];
  artifacts: Artifact[];
  key_links: KeyLink[];
}

export interface Artifact {
  path: string;
  provides: string;
  min_lines?: number;
  exports?: string[];
  contains?: string;
}

export interface KeyLink {
  from: string;
  to: string;
  via: string;
  pattern: string;
}

// Re-export verification schema types from Issue #18
export {
  Truth,
  Artifact as VerificationArtifact,
  KeyLink as VerificationKeyLink,
  MustHaves as VerificationMustHaves,
  TruthVerificationResult,
  ArtifactVerificationResult,
  KeyLinkVerificationResult,
  MustHavesVerificationResult,
} from './verification-schema';

export interface PlanTask {
  type: 'auto' | 'checkpoint';
  name: string;
  files?: string[];
  action: string;
  verify?: string;
  done?: string;
  tdd?: boolean;
  checkpoint?: CheckpointConfig;
}

export interface CheckpointConfig {
  type: CheckpointType;
  gate: 'blocking' | 'non-blocking';
  what_built: string;
  how_to_verify: string;
  resume_signal: string;
}

// ============================================================================
// Wave Execution Types - Issue #16
// ============================================================================

export interface DependencyGraph {
  nodes: PlanNode[];
  edges: PlanEdge[];
  waves: Map<number, PlanNode[]>;
}

export interface PlanNode {
  id: string;
  phase: string;
  plan: number;
  wave: number;
  dependencies: string[];
  dependents: string[];
}

export interface PlanEdge {
  from: string;
  to: string;
}

export interface WaveExecutionPlan {
  waveNumber: number;
  plans: PlanNode[];
  canExecuteInParallel: boolean;
}

// ============================================================================
// STATE.md Types - Issue #19
// ============================================================================

export interface ProjectState {
  metadata: StateMetadata;
  current_position: CurrentPosition;
  progress_summary: ProgressSummary;
  completed: CompletedItems;
}

export interface StateMetadata {
  project: string;
  created_at: string;
  updated_at: string;
  version: string;
}

export interface CurrentPosition {
  current_phase: string;
  current_plan: string;
  current_task: number;
  status: 'in_progress' | 'blocked' | 'complete' | 'paused';
}

export interface ProgressSummary {
  phases_total: number;
  phases_completed: number;
  plans_total: number;
  plans_completed: number;
  tasks_total: number;
  tasks_completed: number;
  overall_progress: number;
}

export interface CompletedItems {
  phases: CompletedPhase[];
  milestones: CompletedMilestone[];
}

export interface CompletedPhase {
  id: string;
  completed_at: string;
  plans: string[];
}

export interface CompletedMilestone {
  id: string;
  name: string;
  completed_at: string;
  phases: string[];
}

// ============================================================================
// Multi-Model Provider Types - Issue #22
// ============================================================================

export type ProviderName = 'anthropic' | 'openai' | 'google' | 'opencode' | 'ollama';

export interface Provider {
  name: ProviderName;
  models: Model[];
  complete(options: CompletionOptions): Promise<Completion>;
  stream(options: CompletionOptions): AsyncIterable<Chunk>;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  maxContextTokens: number;
  hasModel(modelId: string): boolean;
}

export interface Model {
  id: string;
  name: string;
  provider: ProviderName;
  maxTokens: number;
  supportsTools: boolean;
  supportsVision: boolean;
  costPer1KInput: number;
  costPer1KOutput: number;
}

export interface CompletionOptions {
  model: string;
  messages: Message[];
  tools?: Tool[];
  temperature?: number;
  maxTokens?: number;
}

export interface Completion {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
}

export interface Chunk {
  content: string;
  toolCall?: Partial<ToolCall>;
  isComplete: boolean;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface RoutingConfig {
  defaultProvider: ProviderName;
  defaultModel: string;
  fallbackChain: ProviderName[];
  routingRules: RoutingRule[];
}

export interface RoutingRule {
  condition: 'capability' | 'cost' | 'performance';
  capability?: 'tools' | 'vision' | 'streaming';
  provider: ProviderName;
  model: string;
}

// ============================================================================
// MCP Types - Issue #24
// Re-exported from integrations/mcp/types.ts for backward compatibility
// ============================================================================

// Re-export all MCP types from the integration module
export {
  // Server Configuration
  MCPServerConfig,
  
  // JSON-RPC Types
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  JSONRPCNotification,
  
  // MCP Protocol Types
  MCPInitializeParams,
  MCPInitializeResult,
  MCPCapabilities,
  MCPClientInfo,
  MCPServerInfo,
  
  // Tool Types
  MCPTool,
  MCPInputSchema,
  MCPPropertySchema,
  MCPToolCallParams,
  MCPToolResult,
  MCPContent,
  MCPResourceReference,
  
  // Resource Types
  MCPResource,
  MCPResourceContent,
  MCPResourceReadParams,
  
  // Prompt Types
  MCPPrompt,
  MCPPromptArgument,
  MCPPromptGetParams,
  MCPPromptResult,
  MCPPromptMessage,
  
  // Client Interface
  MCPClient,
  
  // Transport Interface
  MCPTransport,
  
  // Configuration Types
  MCPConfig,
  SwarmConfig as MCPSwarmConfig,
  
  // Integration Types
  MCPToolRegistration,
  MCPIntegrationOptions,
  
  // Error Types
  MCPError,
  MCPConnectionError,
  MCPTimeoutError,
  MCPToolNotFoundError,
  MCPResourceNotFoundError,
} from '../integrations/mcp/types';

// Legacy type aliases for backward compatibility
export type MCPResult = import('../integrations/mcp/types').MCPToolResult;

// ============================================================================
// Hivemind Types - Issue #26
// ============================================================================

export interface EmbeddingBackend {
  name: string;
  embed(text: string): Promise<number[]>;
  similarity(a: number[], b: number[]): number;
}

export interface Learning {
  id: string;
  content: string;
  embedding: number[];
  metadata: LearningMetadata;
  context: LearningContext;
}

export interface LearningMetadata {
  source: string;
  timestamp: Date;
  tags: string[];
  category: 'pattern' | 'anti-pattern' | 'best-practice' | 'error';
}

export interface LearningContext {
  codebase: string;
  files: string[];
  task: string;
}

export interface SearchResult {
  learning: Learning;
  similarity: number;
}

export interface SearchOptions {
  threshold?: number;
  limit?: number;
  tags?: string[];
  category?: string;
}

export interface Pattern {
  id: string;
  name: string;
  description: string;
  examples: Learning[];
  frequency: number;
  confidence: number;
}

// ============================================================================
// Agent Types - Issue #14, #21
// ============================================================================

export type AgentRole = 'planner' | 'executor' | 'verifier' | 'debugger' | 
                        'researcher' | 'mapper' | 'architect' | 'security' |
                        'performance' | 'docs' | 'test' | 'refactor' | 'onboarding';

export type AgentColor = '🟢' | '🟡' | '🔵' | '🔴' | '🟣' | '⚪' | '🔷' | '🛡️' | '⚡' | '📚' | '🧪' | '♻️' | '🚀';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  color: AgentColor;
  isPrimary: boolean;
  permissions: Permission[];
  metaPrompt: string;
  tools: string[];
}

export type Permission = 'read' | 'write' | 'execute' | 'create_subagent' | 'delete' | 'admin';

// ============================================================================
// Kanban Types - Issue #13
// ============================================================================

export interface KanbanBoard {
  id: string;
  name: string;
  columns: KanbanColumn[];
  swimlanes?: Swimlane[];
}

export interface KanbanColumn {
  id: string;
  name: string;
  wipLimit?: number;
  order: number;
  tasks: KanbanTask[];
}

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee?: string;
  labels: string[];
  dueDate?: Date;
  phase?: string;
  plan?: string;
  columnId: string;
  order: number;
}

export interface Swimlane {
  id: string;
  name: string;
  filter: (task: KanbanTask) => boolean;
}

// ============================================================================
// TDD Types - Issue #10
// ============================================================================

export interface TDDTask {
  name: string;
  files: string[];
  testCases: TestCase[];
  verifyCommand: string;
}

export interface TestCase {
  name: string;
  input: any;
  expectedOutput: any;
  description: string;
}

export interface TDDResult {
  phase: 'red' | 'green' | 'refactor';
  testResults: TestResult[];
  coverage: number;
  commits: string[];
  duration: number;
}

export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: JSONSchema;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
