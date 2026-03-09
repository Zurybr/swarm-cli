/**
 * Agent Test Harness
 *
 * Provides a testing environment for full BaseAgent implementations.
 * Combines MockLLMClient with guardrail integration for comprehensive
 * agent workflow testing.
 *
 * @example
 * ```typescript
 * const harness = new AgentTestHarness((config, llm) => new MyAgent(config, llm));
 *
 * const { result } = await harness
 *   .withAgentConfig({ role: 'reviewer', model: 'gpt-4' })
 *   .withLLMResponse(/Review/, { content: 'LGTM', usage: { prompt: 10, completion: 5 } })
 *   .withGuardrail(new PromptInjectionGuardrail())
 *   .whenAgentExecutes({ id: '1', title: 'Review code', description: 'Check PR', status: 'pending' });
 *
 * expect(harness.getAgentStatus()).toBe('completed');
 * ```
 */

import type { LLMClient, CompletionResult, LLMCall } from './mock-llm-client';
import { MockLLMClient } from './mock-llm-client';
import type { LLMResponseFixture } from './fixtures/llm-responses';
import type { BaseGuardrail, GuardrailContext, GuardrailResult } from '../security/base-guardrail';
import { GuardrailBlockedError } from '../security/base-guardrail';
import type { BaseAgent, AgentConfig, Task, AgentResult } from '../agents/base-agent';

/**
 * Error thrown when agent test harness assertions fail
 */
export class AgentTestAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentTestAssertionError';
  }
}

/**
 * Result of agent execution through the harness
 */
export interface AgentExecutionResult {
  /** The agent's execution result */
  result: AgentResult;
  /** All LLM calls made during execution */
  llmCalls: LLMCall[];
  /** Results from guardrail execution */
  guardrailResults: GuardrailResult<any>[];
}

/**
 * Test harness for full BaseAgent implementations
 *
 * Provides a complete testing environment for agent workflows,
 * combining deterministic LLM responses with security validation.
 */
export class AgentTestHarness {
  private mockLLMClient: MockLLMClient;
  private agent: BaseAgent;
  private guardrails: BaseGuardrail<any, any>[] = [];
  private agentConfig: AgentConfig;
  private lastTask?: Task;
  private lastExecutionResult?: AgentExecutionResult;

  /**
   * Default agent configuration
   */
  private static readonly DEFAULT_CONFIG: AgentConfig = {
    id: 'test-agent',
    runId: 'test-run',
    role: 'test',
    model: 'gpt-4',
    apiUrl: 'http://localhost:3000',
    tools: []
  };

  /**
   * Create a new agent test harness
   * @param agentFactory - Factory function that creates the agent with config and LLM client
   */
  constructor(
    agentFactory: (config: AgentConfig, llmClient: LLMClient) => BaseAgent,
    initialConfig?: Partial<AgentConfig>
  ) {
    this.mockLLMClient = new MockLLMClient();
    this.agentConfig = { ...AgentTestHarness.DEFAULT_CONFIG, ...initialConfig };
    this.agent = agentFactory(this.agentConfig, this.mockLLMClient);
  }

  /**
   * Update agent configuration
   * @param config - Partial configuration to merge with existing
   * @returns this for chaining
   */
  withAgentConfig(config: Partial<AgentConfig>): this {
    this.agentConfig = { ...this.agentConfig, ...config };
    // Recreate agent with new config
    const agentAny = this.agent.constructor as any;
    this.agent = new agentAny(this.agentConfig, this.mockLLMClient);
    return this;
  }

  /**
   * Set an LLM response for a matching prompt pattern
   * @param promptPattern - String or regex to match against prompts
   * @param response - The completion result to return
   * @returns this for chaining
   */
  withLLMResponse(promptPattern: RegExp | string, response: CompletionResult): this {
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
   * Add a guardrail to validate task inputs before agent execution
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
   * Execute the agent with the given task
   *
   * Execution flow:
   * 1. Run all guardrails on the task input (if any configured)
   * 2. If any guardrail blocks, throw GuardrailBlockedError
   * 3. Execute the agent with the task
   * 4. Return result with LLM calls and guardrail results
   *
   * @param task - Task to execute
   * @returns Execution result with agent result, LLM calls, and guardrail results
   * @throws GuardrailBlockedError if a guardrail blocks execution
   */
  async whenAgentExecutes(task: Task): Promise<AgentExecutionResult> {
    this.lastTask = task;
    const guardrailResults: GuardrailResult<any>[] = [];

    // Run guardrails if configured
    if (this.guardrails.length > 0) {
      const context = this.createGuardrailContext();
      // Validate task description as the primary input
      const input = task.description;

      for (const guardrail of this.guardrails) {
        const result = await guardrail.execute(input, context);
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

    // Execute the agent
    const result = await this.agent.execute(task);

    // Build execution result
    const executionResult: AgentExecutionResult = {
      result,
      llmCalls: this.mockLLMClient.getCalls(),
      guardrailResults
    };

    this.lastExecutionResult = executionResult;
    return executionResult;
  }

  /**
   * Get the current agent status
   * @returns The agent's status ('idle' | 'working' | 'completed' | 'failed')
   */
  getAgentStatus(): string {
    return this.agent.getStatus();
  }

  /**
   * Get the agent ID
   * @returns The agent's unique identifier
   */
  getAgentId(): string {
    return this.agent.getId();
  }

  /**
   * Get the agent role
   * @returns The agent's role
   */
  getAgentRole(): string {
    return this.agent.getRole();
  }

  /**
   * Get the current task being executed
   * @returns The current task or undefined
   */
  getCurrentTask(): Task | undefined {
    return this.agent.getCurrentTask();
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
  getLastExecutionResult(): AgentExecutionResult | undefined {
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
   * Assert that at least one LLM call contains the expected substring
   * @param expectedSubstring - The substring to search for
   * @throws AgentTestAssertionError if no call contains the substring
   */
  expectLLMCallContaining(expectedSubstring: string): void {
    const calls = this.mockLLMClient.getCalls();
    const found = calls.some(call =>
      call.params.prompt.includes(expectedSubstring)
    );

    if (!found) {
      const callPrompts = calls.map(c => c.params.prompt.substring(0, 100));
      throw new AgentTestAssertionError(
        `Expected LLM call containing "${expectedSubstring}". ` +
        `Found ${calls.length} calls: ${JSON.stringify(callPrompts)}`
      );
    }
  }

  /**
   * Assert that the number of LLM calls matches the expected count
   * @param expectedCount - The expected number of calls
   * @throws AgentTestAssertionError if the count doesn't match
   */
  expectLLMCallCount(expectedCount: number): void {
    const calls = this.mockLLMClient.getCalls();
    if (calls.length !== expectedCount) {
      throw new AgentTestAssertionError(
        `Expected ${expectedCount} LLM calls, but got ${calls.length}`
      );
    }
  }

  /**
   * Assert that a guardrail blocked execution
   * @param guardrailName - Optional specific guardrail name to check
   * @throws AgentTestAssertionError if no guardrail blocked
   */
  expectGuardrailBlocked(guardrailName?: string): void {
    if (!this.lastExecutionResult) {
      throw new AgentTestAssertionError(
        'No execution recorded. Call whenAgentExecutes first.'
      );
    }

    const results = this.lastExecutionResult.guardrailResults;
    const blockedResults = results.filter(r => r.blocked);

    if (blockedResults.length === 0) {
      throw new AgentTestAssertionError(
        'Expected guardrail to block, but no guardrails blocked'
      );
    }

    if (guardrailName) {
      const specificBlocked = blockedResults.some(
        r => r.metadata?.guardrail === guardrailName
      );
      if (!specificBlocked) {
        throw new AgentTestAssertionError(
          `Expected guardrail "${guardrailName}" to block, but it didn't. ` +
          `Blocked by: ${blockedResults.map(r => r.metadata?.guardrail).join(', ')}`
        );
      }
    }
  }

  /**
   * Reset the harness state
   * Clears fixtures, calls, guardrails, and execution history
   * Recreates the agent with initial config
   */
  reset(): void {
    this.mockLLMClient.clearFixtures();
    this.mockLLMClient.clearCalls();
    this.guardrails = [];
    this.lastTask = undefined;
    this.lastExecutionResult = undefined;

    // Recreate agent with current config
    const agentAny = this.agent.constructor as any;
    this.agent = new agentAny(this.agentConfig, this.mockLLMClient);
  }

  /**
   * Create a guardrail context for the current execution
   */
  private createGuardrailContext(): GuardrailContext {
    return {
      agentId: this.agentConfig.id,
      runId: this.agentConfig.runId,
      timestamp: new Date(),
      metadata: {
        test: true,
        task: this.lastTask
      }
    };
  }
}
