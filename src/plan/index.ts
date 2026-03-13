/**
 * PLAN.md Executable Prompt Format - Public API
 *
 * This module provides the public API for parsing, validating, and executing
 * PLAN.md files as executable instruction sequences.
 *
 * @example
 * ```typescript
 * import { PlanParser, PlanValidator, PlanExecutor } from '@/plan';
 *
 * // Parse a plan
 * const parser = new PlanParser();
 * const result = await parser.parseFile('path/to/PLAN.md');
 *
 * // Validate
 * const validator = new PlanValidator();
 * const validation = validator.validate(result.plan!);
 *
 * // Execute
 * const executor = new PlanExecutor();
 * const execResult = await executor.execute(result.plan!, context);
 * ```
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Plan structure
  Plan,
  PlanMetadata,
  PlanMustHaves,
  PlanTask,
  ArtifactDefinition,
  KeyLink,
  UserSetup,

  // Parser types
  ParseResult,
  ParseError,
  ParseWarning,

  // Validator types
  ValidationResult,
  ValidationError,
  ValidationWarning,
  DependencyGraph,

  // Executor types
  ExecutionContext,
  ExecutionOptions,
  ExecutionResult,
  ExecutionState,
  ExecutionError,
  TaskExecutionResult,
  ProgressCallback,
  ProgressEvent,
  ProgressEventType,

  // CLI types
  PlanExecuteOptions,
  PlanValidateOptions,
} from './types.js';

// Export JSON Schemas
export {
  PLAN_FRONTMATTER_JSON_SCHEMA,
  PLAN_TASK_JSON_SCHEMA,
} from './types.js';

// ============================================================================
// Class Exports
// ============================================================================

export { PlanParser } from './parser';
export { resolveContextReferences, clearContextCache } from './parser';
export { PlanValidator } from './validator';
export { PlanExecutor } from './executor';
export { PromptBuilder, planToPrompt, planToPromptSync } from './prompt';
export { createPlanCommand } from './cli';

// ============================================================================
// Function Exports
// ============================================================================

export { parsePlan } from './parser';
export { validatePlan } from './validator';
export { executePlan } from './executor';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '0.1.0';
