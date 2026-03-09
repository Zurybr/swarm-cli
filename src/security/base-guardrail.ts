/**
 * Base Guardrail System
 *
 * Provides defense-in-depth security controls for agent operations.
 * All guardrails extend BaseGuardrail and follow a consistent validation pattern.
 */

/**
 * Context passed to guardrail validation
 */
export interface GuardrailContext {
  agentId: string;
  runId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Severity levels for guardrail violations
 */
export type GuardrailSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Result of guardrail validation
 */
export interface GuardrailResult<T> {
  output: T;
  blocked: boolean;
  reason?: string;
  severity: GuardrailSeverity;
  metadata?: Record<string, any>;
}

/**
 * Error thrown when a guardrail blocks execution
 */
export class GuardrailBlockedError extends Error {
  public readonly severity: GuardrailSeverity;
  public readonly reason: string;
  public readonly metadata?: Record<string, any>;

  constructor(
    guardrailName: string,
    reason: string,
    severity: GuardrailSeverity = 'high',
    metadata?: Record<string, any>
  ) {
    super(`Guardrail '${guardrailName}' blocked: ${reason}`);
    this.name = 'GuardrailBlockedError';
    this.severity = severity;
    this.reason = reason;
    this.metadata = metadata;
  }
}

/**
 * Abstract base class for all guardrails
 *
 * Provides:
 * - Priority-based execution ordering
 * - Pre/post processing hooks
 * - Fail-closed error handling
 * - Consistent validation interface
 */
export abstract class BaseGuardrail<TInput, TOutput> {
  /**
   * Unique name for this guardrail
   */
  abstract readonly name: string;

  /**
   * Execution priority (lower = earlier execution)
   */
  abstract readonly priority: number;

  /**
   * Human-readable description
   */
  abstract readonly description: string;

  /**
   * Validate input and return result
   * Must be implemented by concrete guardrails
   */
  abstract validate(
    input: TInput,
    context: GuardrailContext
  ): Promise<GuardrailResult<TOutput>>;

  /**
   * Optional preprocessing hook
   * Called before validate()
   */
  protected preprocess?(input: TInput): TInput;

  /**
   * Optional postprocessing hook
   * Called after validate()
   */
  protected postprocess?(result: GuardrailResult<TOutput>): TOutput;

  /**
   * Execute the guardrail with full lifecycle
   *
   * 1. Calls preprocess() if defined
   * 2. Calls validate()
   * 3. Returns result with fail-closed error handling
   */
  public async execute(
    input: TInput,
    context: GuardrailContext
  ): Promise<GuardrailResult<TOutput>> {
    try {
      // Preprocess if hook is defined
      const processedInput = this.preprocess ? this.preprocess(input) : input;

      // Run validation
      const result = await this.validate(processedInput, context);

      // Postprocess if hook is defined
      if (this.postprocess) {
        this.postprocess(result);
      }

      return result;
    } catch (error) {
      // Fail closed: block on error for safety
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        output: input as unknown as TOutput,
        blocked: true,
        reason: `Guardrail error: ${errorMessage}`,
        severity: 'high',
        metadata: {
          error: errorMessage,
          guardrailName: this.name,
          failClosed: true
        }
      };
    }
  }
}
