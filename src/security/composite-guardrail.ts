/**
 * Composite Guardrail
 *
 * Orchestrates multiple guardrails in defense-in-depth configuration.
 * Runs guards in priority order and aggregates results.
 */

import {
  BaseGuardrail,
  GuardrailContext,
  GuardrailResult,
  GuardrailSeverity
} from './base-guardrail';

/**
 * Composite execution mode
 * - 'all': All guards must pass (any block causes failure)
 * - 'any': Any guard can block (used for redundant checks)
 */
export type CompositeMode = 'all' | 'any';

/**
 * Composite guardrail that runs multiple guards
 *
 * Provides defense-in-depth by running multiple guardrails
 * in priority order and aggregating their results.
 */
export class CompositeGuardrail<TInput, TOutput> extends BaseGuardrail<TInput, TOutput> {
  readonly name = 'CompositeGuardrail';
  readonly priority = 0;
  readonly description = 'Orchestrates multiple guardrails';

  private readonly guardrails: BaseGuardrail<any, any>[];
  private readonly mode: CompositeMode;

  /**
   * @param guardrails - Array of guardrails to execute
   * @param mode - 'all' (all must pass) or 'any' (redundant checks)
   */
  constructor(
    guardrails: BaseGuardrail<any, any>[],
    mode: CompositeMode = 'all'
  ) {
    super();
    this.mode = mode;
    // Sort guardrails by priority (ascending - lower numbers first)
    this.guardrails = [...guardrails].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Validate input through all configured guardrails
   *
   * Execution:
   * 1. Runs each guardrail in priority order
   * 2. Collects all results
   * 3. For mode='all': returns first block, or success if all pass
   * 4. For mode='any': returns combined result (all must agree)
   */
  async validate(
    input: TInput,
    context: GuardrailContext
  ): Promise<GuardrailResult<TOutput>> {
    const results: GuardrailResult<any>[] = [];
    let currentInput: any = input;

    // Execute each guardrail in priority order
    for (const guardrail of this.guardrails) {
      try {
        const result = await guardrail.execute(currentInput, context);
        results.push(result);

        // In 'all' mode, stop on first block
        if (this.mode === 'all' && result.blocked) {
          return {
            output: currentInput,
            blocked: true,
            reason: `Blocked by ${guardrail.name}: ${result.reason}`,
            severity: result.severity,
            metadata: {
              guardrail: this.name,
              blockedBy: guardrail.name,
              guardrailResults: results.map(r => ({
                name: r.metadata?.guardrail || 'unknown',
                blocked: r.blocked,
                severity: r.severity
              })),
              mode: this.mode
            }
          };
        }

        // Chain output to next guardrail if not blocked
        if (!result.blocked) {
          currentInput = result.output;
        }
      } catch (error) {
        // Fail closed on guardrail error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          output: currentInput,
          blocked: true,
          reason: `Guardrail ${guardrail.name} failed: ${errorMessage}`,
          severity: 'critical',
          metadata: {
            guardrail: this.name,
            failedGuardrail: guardrail.name,
            error: errorMessage,
            guardrailResults: results.map(r => ({
              name: r.metadata?.guardrail || 'unknown',
              blocked: r.blocked,
              severity: r.severity
            })),
            mode: this.mode,
            failClosed: true
          }
        };
      }
    }

    // All guardrails executed
    const blockedResults = results.filter(r => r.blocked);

    if (this.mode === 'any') {
      // In 'any' mode, we need consensus
      if (blockedResults.length > 0) {
        const highestSeverity = this.getHighestSeverity(blockedResults.map(r => r.severity));
        return {
          output: currentInput,
          blocked: true,
          reason: `Blocked by ${blockedResults.length} guardrails`,
          severity: highestSeverity,
          metadata: {
            guardrail: this.name,
            blockedCount: blockedResults.length,
            guardrailResults: results.map(r => ({
              name: r.metadata?.guardrail || 'unknown',
              blocked: r.blocked,
              severity: r.severity
            })),
            mode: this.mode
          }
        };
      }
    }

    // All guards passed
    return {
      output: currentInput,
      blocked: false,
      severity: this.getHighestSeverity(results.map(r => r.severity)),
      metadata: {
        guardrail: this.name,
        guardsExecuted: results.length,
        guardrailResults: results.map(r => ({
          name: r.metadata?.guardrail || 'unknown',
          blocked: r.blocked,
          severity: r.severity
        })),
        mode: this.mode
      }
    };
  }

  /**
   * Get the list of configured guardrails
   */
  getGuardrails(): BaseGuardrail<any, any>[] {
    return [...this.guardrails];
  }

  /**
   * Get the execution mode
   */
  getMode(): CompositeMode {
    return this.mode;
  }

  /**
   * Determine the highest severity from a list
   */
  private getHighestSeverity(severities: GuardrailSeverity[]): GuardrailSeverity {
    const severityOrder: GuardrailSeverity[] = ['low', 'medium', 'high', 'critical'];
    let highestIndex = 0;

    for (const severity of severities) {
      const index = severityOrder.indexOf(severity);
      if (index > highestIndex) {
        highestIndex = index;
      }
    }

    return severityOrder[highestIndex];
  }
}
