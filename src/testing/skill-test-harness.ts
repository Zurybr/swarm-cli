/**
 * Skill Test Harness
 *
 * Provides a fluent API for testing agent skills with deterministic LLM responses
 * and integrated security guardrails. Enables complete skill testing in a single
 * chainable interface.
 *
 * @example
 * ```typescript
 * const harness = new SkillTestHarness((llm) => new MySkill(llm));
 *
 * const { result } = await harness
 *   .givenLLMResponse(/analyze/, { content: '{"issues":[]}', usage: { prompt: 10, completion: 5 } })
 *   .withGuardrail(new PromptInjectionGuardrail())
 *   .whenSkillExecutes({ code: 'const x = 1;' });
 *
 * harness.expectLLMCallCount(1);
 * ```
 */

import type { LLMClient, CompletionResult, CompletionParams, LLMCall } from './mock-llm-client';
import { MockLLMClient } from './mock-llm-client';
import type { LLMResponseFixture } from './fixtures/llm-responses';
import type { BaseGuardrail, GuardrailContext, GuardrailResult } from '../security/base-guardrail';
import { GuardrailBlockedError } from '../security/base-guardrail';

/**
 * Error thrown when skill test harness assertions fail
 */
export class SkillTestAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillTestAssertionError';
  }
}

/**
 * Result of skill execution through the harness
 */
export interface SkillExecutionResult<TOutput> {
  /** The skill's output */
  result: TOutput;
  /** All LLM calls made during execution */
  llmCalls: LLMCall[];
  /** Results from guardrail execution */
  guardrailResults: GuardrailResult<any>[];
}

/**
 * Test harness for individual agent skills
 *
 * Combines MockLLMClient with guardrail integration to provide
 * a complete testing environment for agent skills.
 */
export class SkillTestHarness<TSkill, TInput, TOutput> {
  private mockLLMClient: MockLLMClient;
  private skill: TSkill;
  private guardrails: BaseGuardrail<any, any>[] = [];
  private lastInput?: TInput;
  private lastExecutionResult?: SkillExecutionResult<TOutput>;

  /**
   * Create a new skill test harness
   * @param skillFactory - Factory function that creates the skill with an LLM client
   */
  constructor(skillFactory: (llmClient: LLMClient) => TSkill) {
    this.mockLLMClient = new MockLLMClient();
    this.skill = skillFactory(this.mockLLMClient);
  }

  /**
   * Set an LLM response for a matching prompt pattern
   * @param promptPattern - String or regex to match against prompts
   * @param response - The completion result to return
   * @returns this for chaining
   */
  givenLLMResponse(promptPattern: RegExp | string, response: CompletionResult): this {
    if (typeof promptPattern === 'string') {
      // Convert string to exact match regex
      const escaped = promptPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      this.mockLLMClient.setFixturePattern(new RegExp(escaped), response);
    } else {
      this.mockLLMClient.setFixturePattern(promptPattern, response);
    }
    return this;
  }

  /**
   * Add a guardrail to validate inputs before skill execution
   * @param guardrail - The guardrail to add
   * @returns this for chaining
   */
  withGuardrail(guardrail: BaseGuardrail<any, any>): this {
    this.guardrails.push(guardrail);
    return this;
  }

  /**
   * Load multiple fixtures at once
   * @param fixtures - Array of LLM response fixtures
   * @returns this for chaining
   */
  withFixtures(fixtures: LLMResponseFixture[]): this {
    for (const fixture of fixtures) {
      this.mockLLMClient.setFixturePattern(fixture.promptPattern, fixture.response);
    }
    return this;
  }

  /**
   * Execute the skill with the given input
   *
   * Execution flow:
   * 1. Run all guardrails on the input (if any configured)
   * 2. If any guardrail blocks, throw GuardrailBlockedError
   * 3. Execute the skill with the input
   * 4. Return result with LLM calls and guardrail results
   *
   * @param input - Input to pass to the skill
   * @returns Execution result with output, LLM calls, and guardrail results
   * @throws GuardrailBlockedError if a guardrail blocks execution
   */
  async whenSkillExecutes(input: TInput): Promise<SkillExecutionResult<TOutput>> {
    this.lastInput = input;
    const guardrailResults: GuardrailResult<any>[] = [];

    // Run guardrails if configured
    if (this.guardrails.length > 0) {
      const context = this.createGuardrailContext();
      // Convert input to string for guardrail validation
      const inputForGuardrail = typeof input === 'string'
        ? input
        : JSON.stringify(input);

      for (const guardrail of this.guardrails) {
        const result = await guardrail.execute(inputForGuardrail, context);
        guardrailResults.push(result);

        if (result.blocked) {
          throw new GuardrailBlockedError(
            guardrail.name,
            result.reason || 'Blocked by guardrail',
            result.severity,
            result.metadata
          );
        }
      }
    }

    // Execute the skill
    // We assume the skill has an 'execute' or similar method
    const skillAny = this.skill as any;
    let result: TOutput;

    if (typeof skillAny.execute === 'function') {
      result = await skillAny.execute(input);
    } else if (typeof skillAnycall === 'function') {
      result = await skillAny(input);
    } else {
      throw new Error('Skill must have an execute method or be callable');
    }

    // Build execution result
    const executionResult: SkillExecutionResult<TOutput> = {
      result,
      llmCalls: this.mockLLMClient.getCalls(),
      guardrailResults
    };

    this.lastExecutionResult = executionResult;
    return executionResult;
  }

  /**
   * Assert that at least one LLM call contains the expected substring
   * @param expectedSubstring - The substring to search for
   * @throws SkillTestAssertionError if no call contains the substring
   */
  expectLLMCallContaining(expectedSubstring: string): void {
    const calls = this.mockLLMClient.getCalls();
    const found = calls.some(call =>
      call.params.prompt.includes(expectedSubstring)
    );

    if (!found) {
      const callPrompts = calls.map(c => c.params.prompt.substring(0, 100));
      throw new SkillTestAssertionError(
        `Expected LLM call containing "${expectedSubstring}". ` +
        `Found ${calls.length} calls: ${JSON.stringify(callPrompts)}`
      );
    }
  }

  /**
   * Assert that the number of LLM calls matches the expected count
   * @param expectedCount - The expected number of calls
   * @throws SkillTestAssertionError if the count doesn't match
   */
  expectLLMCallCount(expectedCount: number): void {
    const calls = this.mockLLMClient.getCalls();
    if (calls.length !== expectedCount) {
      throw new SkillTestAssertionError(
        `Expected ${expectedCount} LLM calls, but got ${calls.length}`
      );
    }
  }

  /**
   * Assert that a guardrail blocked execution
   * @param guardrailName - Optional specific guardrail name to check
   * @throws SkillTestAssertionError if no guardrail blocked
   */
  expectGuardrailBlocked(guardrailName?: string): void {
    if (!this.lastExecutionResult) {
      throw new SkillTestAssertionError(
        'No execution recorded. Call whenSkillExecutes first.'
      );
    }

    const results = this.lastExecutionResult.guardrailResults;
    const blockedResults = results.filter(r => r.blocked);

    if (blockedResults.length === 0) {
      throw new SkillTestAssertionError(
        'Expected guardrail to block, but no guardrails blocked'
      );
    }

    if (guardrailName) {
      const specificBlocked = blockedResults.some(
        r => r.metadata?.guardrail === guardrailName
      );
      if (!specificBlocked) {
        throw new SkillTestAssertionError(
          `Expected guardrail "${guardrailName}" to block, but it didn't. ` +
          `Blocked by: ${blockedResults.map(r => r.metadata?.guardrail).join(', ')}`
        );
      }
    }
  }

  /**
   * Get all recorded LLM calls
   * @returns Array of LLM calls
   */
  getLLMCalls(): LLMCall[] {
    return this.mockLLMClient.getCalls();
  }

  /**
   * Get the last execution result
   * @returns The last execution result or undefined
   */
  getLastExecutionResult(): SkillExecutionResult<TOutput> | undefined {
    return this.lastExecutionResult;
  }

  /**
   * Get the configured guardrails
   * @returns Array of guardrails
   */
  getGuardrails(): BaseGuardrail<any, any>[] {
    return [...this.guardrails];
  }

  /**
   * Reset the harness state
   * Clears fixtures, calls, guardrails, and execution history
   */
  reset(): void {
    this.mockLLMClient.clearFixtures();
    this.mockLLMClient.clearCalls();
    this.guardrails = [];
    this.lastInput = undefined;
    this.lastExecutionResult = undefined;
  }

  /**
   * Create a guardrail context for the current execution
   */
  private createGuardrailContext(): GuardrailContext {
    return {
      agentId: 'test-agent',
      runId: `test-run-${Date.now()}`,
      timestamp: new Date(),
      metadata: {
        test: true,
        input: this.lastInput
      }
    };
  }
}
