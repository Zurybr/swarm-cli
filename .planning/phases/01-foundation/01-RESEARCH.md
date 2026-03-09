# Phase 1: Foundation - Research

**Researched:** 2026-03-09
**Domain:** AI Agent Testing Framework & Security Guardrails
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational infrastructure for safe agent capability development. The research identifies three core deliverables: (1) a deterministic test mode that mocks LLM responses to enable reproducible agent skill testing, (2) a security guardrails base class implementing defense-in-depth patterns for agent safety, and (3) Jest integration with proper TypeScript support.

The existing codebase uses Jest 29.7.0 with TypeScript 5.3.0, providing a solid foundation. The `BaseAgent` abstract class and `Orchestrator` event-driven architecture support dependency injection patterns needed for testing. The SQLite persistence layer will need test database isolation.

**Primary recommendation:** Implement a three-layer testing approach: (1) deterministic skill testing via dependency-injected LLM clients with fixture-based responses, (2) security guardrails using an abstract base class with concrete implementations for content safety and prompt injection detection, and (3) LLM-as-a-Judge evaluation harness for output quality assessment.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-04 | Agent testing framework (foundations) | Deterministic test mode via DI pattern; Mock LLM fixtures; Jest integration; Security guardrails base class |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Jest | 29.7.0 | Test runner | Already in project; industry standard for TS/Node |
| ts-jest | 29.x | TypeScript preprocessing | Required for Jest + TypeScript integration |
| @types/jest | 29.5.x | Type definitions | Type safety for tests |
| jest-mock-extended | 3.x | Interface mocking | Clean DI mocking with full type safety |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sqlite3 | 5.1.6 | Test database | Use `:memory:` mode for test isolation |
| @faker-js/faker | 8.x | Test data generation | Complex fixture scenarios |

### Installation
```bash
npm install --save-dev ts-jest @types/jest jest-mock-extended
# faker is optional for advanced fixtures
npm install --save-dev @faker-js/faker
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── testing/                    # NEW: Testing framework
│   ├── fixtures/              # Mock LLM responses & test data
│   │   ├── llm-responses.ts   # Pre-defined LLM outputs
│   │   └── agent-scenarios.ts # Common test scenarios
│   ├── mocks/                 # Mock implementations
│   │   ├── mock-llm-client.ts # Deterministic LLM client
│   │   └── mock-guardrails.ts # Test-mode guardrails
│   ├── harness/               # Test harnesses
│   │   ├── agent-test-harness.ts
│   │   └── skill-test-harness.ts
│   └── index.ts               # Public testing API
├── security/                  # NEW: Security guardrails
│   ├── base-guardrail.ts      # Abstract base class
│   ├── content-safety.ts      # Content moderation guard
│   ├── prompt-injection.ts    # Injection detection guard
│   ├── composite-guardrail.ts # Multi-guard orchestrator
│   └── index.ts               # Public security API
├── agents/
│   ├── base-agent.ts          # EXISTING: Add test mode support
│   └── ...
└── skills/                    # NEW: Skill system (Phase 2 prep)
    ├── base-skill.ts          # Skill interface
    └── index.ts
tests/                         # NEW: Test files
├── unit/
│   ├── security/
│   ├── agents/
│   └── skills/
├── integration/
│   └── orchestrator.test.ts
└── fixtures/                  # Shared test fixtures
```

### Pattern 1: Deterministic Test Mode via Dependency Injection

**What:** Inject LLM client dependency to enable mocking in tests while using real clients in production.

**When to use:** All agent skills that call LLM APIs need this pattern for testability.

**Example:**
```typescript
// Source: LangWatch Scenario testing patterns + Jest DI best practices
// https://langwatch.ai/scenario/testing-guides/mocks

// Interface for LLM client - enables swapping implementations
export interface LLMClient {
  complete(params: CompletionParams): Promise<CompletionResult>;
  chat(messages: Message[]): Promise<ChatResponse>;
}

// Production implementation
export class OpenAIClient implements LLMClient {
  async complete(params: CompletionParams): Promise<CompletionResult> {
    // Real API call
    const response = await fetch(this.apiUrl, { ... });
    return response.json();
  }
}

// Test implementation - deterministic responses
export class MockLLMClient implements LLMClient {
  private fixtures: Map<string, any> = new Map();
  private fallbackMode: 'error' | 'empty' = 'empty';

  setFixture(key: string, response: any): void {
    this.fixtures.set(key, response);
  }

  async complete(params: CompletionParams): Promise<CompletionResult> {
    const key = this.generateKey(params);
    if (this.fixtures.has(key)) {
      return this.fixtures.get(key);
    }
    if (this.fallbackMode === 'error') {
      throw new Error(`No fixture for key: ${key}`);
    }
    return { content: '', usage: { prompt: 0, completion: 0 } };
  }

  private generateKey(params: CompletionParams): string {
    // Deterministic key based on prompt content
    return hashPrompt(params.prompt);
  }
}

// Skill using DI
export class CodeReviewSkill {
  constructor(private llmClient: LLMClient) {}

  async review(code: string): Promise<ReviewResult> {
    const response = await this.llmClient.complete({
      prompt: `Review this code: ${code}`,
      temperature: 0.2
    });
    return this.parseReview(response);
  }
}
```

### Pattern 2: Security Guardrails Base Class

**What:** Abstract base class for all security guardrails with priority-based execution and tripwire pattern.

**When to use:** All agent operations that process untrusted input or execute tools.

**Example:**
```typescript
// Source: OpenAI Agents SDK pattern + CodeSignal guardrails course
// https://codesignal.com/learn/courses/controlling-and-securing-openai-agents-execution-in-typescript-2/

export interface GuardrailContext {
  agentId: string;
  runId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface GuardrailResult<T> {
  output: T;
  blocked: boolean;
  reason?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export abstract class BaseGuardrail<TInput, TOutput> {
  abstract readonly name: string;
  abstract readonly priority: number; // Lower = earlier execution
  abstract readonly description: string;

  // Main validation method - must be implemented
  abstract validate(
    input: TInput,
    context: GuardrailContext
  ): Promise<GuardrailResult<TOutput>>;

  // Optional: Pre-processing hook
  protected preprocess?(input: TInput): TInput;

  // Optional: Post-processing hook
  protected postprocess?(result: TOutput): TOutput;

  // Execute with hooks and error handling
  async execute(
    input: TInput,
    context: GuardrailContext
  ): Promise<GuardrailResult<TOutput>> {
    try {
      const processed = this.preprocess ? this.preprocess(input) : input;
      const result = await this.validate(processed, context);
      return result;
    } catch (error) {
      // Fail closed - block on error
      return {
        output: input as unknown as TOutput,
        blocked: true,
        reason: `Guardrail ${this.name} failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'high'
      };
    }
  }
}

// Concrete implementation: Content Safety
export class ContentSafetyGuardrail extends BaseGuardrail<string, string> {
  readonly name = 'ContentSafety';
  readonly priority = 1;
  readonly description = 'Blocks harmful or inappropriate content';

  constructor(
    private moderationApi: ModerationAPI,
    private blockedCategories: string[] = ['hate', 'violence', 'self-harm']
  ) {
    super();
  }

  async validate(
    input: string,
    context: GuardrailContext
  ): Promise<GuardrailResult<string>> {
    const moderation = await this.moderationApi.check(input);

    const flagged = moderation.categories
      .filter(c => this.blockedCategories.includes(c.name) && c.score > 0.5);

    if (flagged.length > 0) {
      return {
        output: input,
        blocked: true,
        reason: `Flagged categories: ${flagged.map(f => f.name).join(', ')}`,
        severity: 'high',
        metadata: { flaggedCategories: flagged }
      };
    }

    return {
      output: input,
      blocked: false,
      severity: 'low'
    };
  }
}

// Concrete implementation: Prompt Injection Detection
export class PromptInjectionGuardrail extends BaseGuardrail<string, string> {
  readonly name = 'PromptInjectionDetection';
  readonly priority = 0; // Run first
  readonly description = 'Detects prompt injection attempts';

  private injectionPatterns = [
    /ignore previous instructions/i,
    /disregard (all|your) (instructions|prompt)/i,
    /system prompt/i,
    /you are now/i,
    /DAN|do anything now/i
  ];

  async validate(
    input: string,
    context: GuardrailContext
  ): Promise<GuardrailResult<string>> {
    const detected = this.injectionPatterns.some(pattern =>
      pattern.test(input)
    );

    if (detected) {
      return {
        output: input,
        blocked: true,
        reason: 'Potential prompt injection detected',
        severity: 'critical'
      };
    }

    return {
      output: input,
      blocked: false,
      severity: 'low'
    };
  }
}

// Composite guardrail for defense in depth
export class CompositeGuardrail<TInput, TOutput> extends BaseGuardrail<TInput, TOutput> {
  readonly name = 'CompositeGuardrail';
  readonly priority = 0;
  readonly description = 'Orchestrates multiple guardrails';

  constructor(
    private guardrails: BaseGuardrail<any, any>[],
    private mode: 'all' | 'any' = 'all' // all must pass vs any can block
  ) {
    super();
    // Sort by priority
    this.guardrails.sort((a, b) => a.priority - b.priority);
  }

  async validate(
    input: TInput,
    context: GuardrailContext
  ): Promise<GuardrailResult<TOutput>> {
    let currentInput: any = input;
    const results: GuardrailResult<any>[] = [];

    for (const guardrail of this.guardrails) {
      const result = await guardrail.execute(currentInput, context);
      results.push(result);

      if (result.blocked && this.mode === 'all') {
        return {
          output: currentInput,
          blocked: true,
          reason: `Blocked by ${guardrail.name}: ${result.reason}`,
          severity: result.severity,
          metadata: { guardrailResults: results }
        } as GuardrailResult<TOutput>;
      }

      currentInput = result.output;
    }

    const anyBlocked = results.some(r => r.blocked);
    const highestSeverity = results
      .filter(r => r.blocked)
      .reduce((max, r) => {
        const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
        return severityOrder[r.severity] > severityOrder[max] ? r.severity : max;
      }, 'low' as GuardrailResult<any>['severity']);

    return {
      output: currentInput,
      blocked: anyBlocked,
      reason: anyBlocked ? results.find(r => r.blocked)?.reason : undefined,
      severity: highestSeverity,
      metadata: { guardrailResults: results }
    } as GuardrailResult<TOutput>;
  }
}
```

### Pattern 3: Test Harness for Agent Skills

**What:** Reusable test harness that sets up mock dependencies and provides assertion helpers.

**When to use:** All skill unit tests.

**Example:**
```typescript
// Source: Jest best practices + LangWatch testing patterns
// https://devblogs.microsoft.com/ise/jest-mocking-best-practices/

import { mock } from 'jest-mock-extended';

export class SkillTestHarness<TSkill, TInput, TOutput> {
  private mockLLMClient: MockLLMClient;
  private skill: TSkill;
  private guardrails: BaseGuardrail<any, any>[] = [];

  constructor(
    private skillFactory: (llmClient: LLMClient) => TSkill,
    private options: {
      enableGuardrails?: boolean;
      strictFixtures?: boolean;
    } = {}
  ) {
    this.mockLLMClient = new MockLLMClient();
    this.skill = skillFactory(this.mockLLMClient);
  }

  // Set up a fixture for a specific input
  givenLLMResponse(promptPattern: RegExp | string, response: any): this {
    this.mockLLMClient.setFixture(
      typeof promptPattern === 'string' ? promptPattern : promptPattern.source,
      response
    );
    return this;
  }

  // Add guardrail for security testing
  withGuardrail(guardrail: BaseGuardrail<any, any>): this {
    this.guardrails.push(guardrail);
    return this;
  }

  // Execute the skill under test
  async whenSkillExecutes(input: TInput): Promise<{
    result: TOutput;
    llmCalls: LLMCall[];
    guardrailResults: GuardrailResult<any>[];
  }> {
    const llmCalls: LLMCall[] = [];
    this.mockLLMClient.onCall = (call) => llmCalls.push(call);

    // Run guardrails first
    const guardrailResults: GuardrailResult<any>[] = [];
    for (const guardrail of this.guardrails) {
      const result = await guardrail.execute(input, {
        agentId: 'test-agent',
        runId: 'test-run',
        timestamp: new Date()
      });
      guardrailResults.push(result);
      if (result.blocked) {
        throw new GuardrailBlockedError(result);
      }
    }

    // Execute skill
    const result = await (this.skill as any).execute(input);

    return { result, llmCalls, guardrailResults };
  }

  // Assertion helpers
  expectLLMCallContaining(expectedSubstring: string): void {
    const calls = this.mockLLMClient.getCalls();
    const found = calls.some(call =>
      call.params.prompt?.includes(expectedSubstring)
    );
    expect(found).toBe(true);
  }

  reset(): void {
    this.mockLLMClient.clearFixtures();
    this.guardrails = [];
  }
}

// Usage in test
 describe('CodeReviewSkill', () => {
  const harness = new SkillTestHarness(
    (llm) => new CodeReviewSkill(llm)
  );

  beforeEach(() => harness.reset());

  it('detects security issues in code', async () => {
    harness.givenLLMResponse(/Review this code/, {
      content: JSON.stringify({
        issues: [{ severity: 'high', type: 'sql-injection' }]
      })
    });

    const { result } = await harness.whenSkillExecutes({
      code: 'const query = `SELECT * FROM users WHERE id = ${userId}`'
    });

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].type).toBe('sql-injection');
  });
});
```

### Pattern 4: LLM-as-a-Judge Evaluation Harness

**What:** Use an LLM to evaluate agent outputs against criteria - enables testing subjective qualities like "helpfulness" or "accuracy".

**When to use:** Regression testing, output quality validation, A/B testing prompts.

**Example:**
```typescript
// Source: Confident AI + Evidently AI LLM-as-a-Judge patterns
// https://www.confident-ai.com/blog/why-llm-as-a-judge-is-the-best-llm-evaluation-method
// https://www.evidentlyai.com/llm-guide/llm-as-a-judge

export interface EvaluationCriteria {
  name: string;
  description: string;
  rubric: {
    excellent: string;
    good: string;
    fair: string;
    poor: string;
  };
}

export interface JudgeResult {
  score: number; // 1-4 mapped from rubric
  reasoning: string;
  passed: boolean;
  criteria: string;
}

export class LLMJudge {
  constructor(
    private judgeLLM: LLMClient,
    private criteria: EvaluationCriteria[],
    private options: {
      temperature?: number;
      model?: string;
    } = {}
  ) {}

  async evaluate(
    input: string,
    output: string,
    context?: string
  ): Promise<JudgeResult[]> {
    const results: JudgeResult[] = [];

    for (const criterion of this.criteria) {
      const prompt = this.buildEvaluationPrompt(criterion, input, output, context);

      const response = await this.judgeLLM.complete({
        prompt,
        temperature: this.options.temperature ?? 0.1, // Low temp for consistency
        maxTokens: 500
      });

      const result = this.parseEvaluation(response.content, criterion);
      results.push(result);
    }

    return results;
  }

  private buildEvaluationPrompt(
    criteria: EvaluationCriteria,
    input: string,
    output: string,
    context?: string
  ): string {
    return `
You are an expert evaluator. Assess the following output against the criteria.

CRITERIA: ${criteria.name}
DESCRIPTION: ${criteria.description}

RUBRIC:
- Excellent (4): ${criteria.rubric.excellent}
- Good (3): ${criteria.rubric.good}
- Fair (2): ${criteria.rubric.fair}
- Poor (1): ${criteria.rubric.poor}

${context ? `CONTEXT: ${context}\n` : ''}
INPUT: ${input}

OUTPUT TO EVALUATE: ${output}

Provide your evaluation in this JSON format:
{
  "score": <1-4>,
  "reasoning": "<explanation of the score>"
}

Respond with ONLY the JSON object.`;
  }

  private parseEvaluation(content: string, criteria: EvaluationCriteria): JudgeResult {
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) ||
                       content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
      const parsed = JSON.parse(jsonStr);

      return {
        score: parsed.score,
        reasoning: parsed.reasoning,
        passed: parsed.score >= 3, // Good or better
        criteria: criteria.name
      };
    } catch (error) {
      return {
        score: 0,
        reasoning: `Failed to parse evaluation: ${error}`,
        passed: false,
        criteria: criteria.name
      };
    }
  }
}

// Pre-defined criteria for common agent evaluations
export const SecurityReviewCriteria: EvaluationCriteria[] = [
  {
    name: 'vulnerability_coverage',
    description: 'Did the review identify all relevant security issues?',
    rubric: {
      excellent: 'Identified all critical and high severity issues',
      good: 'Identified most important issues with minor gaps',
      fair: 'Identified some issues but missed significant ones',
      poor: 'Missed critical security vulnerabilities'
    }
  },
  {
    name: 'actionability',
    description: 'Are the recommendations clear and actionable?',
    rubric: {
      excellent: 'Specific, prioritized remediation steps provided',
      good: 'Clear recommendations with some prioritization',
      fair: 'Generic advice that requires interpretation',
      poor: 'Vague or unactionable recommendations'
    }
  }
];
```

### Anti-Patterns to Avoid

- **Mocking at the wrong layer:** Mock LLM client interfaces, not the agent's reasoning logic. Tool-level mocking is preferred over API-level mocking for maintaining realistic agent behavior.
- **Non-deterministic fixtures:** Avoid using `Math.random()` or timestamps in test fixtures. Use seeded random generators or fixed values.
- **Guardrail bypass in tests:** Never disable guardrails in tests. Instead, use test-mode guardrails that log but don't block, or provide safe test inputs.
- **Shared test state:** Each test should have isolated fixtures and mock state. Reset harnesses in `beforeEach`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM client mocking | Custom mock classes | `jest-mock-extended` + interface | Type-safe, maintained, standard pattern |
| Test database setup | File-based SQLite | `:memory:` SQLite | Faster, isolated, no cleanup needed |
| Content moderation | Regex-only detection | Hybrid: regex + API fallback | Regex misses semantic attacks; APIs catch context-dependent issues |
| Evaluation metrics | Custom scoring logic | LLM-as-a-Judge with rubrics | Human-aligned evaluation for subjective criteria |
| Fixture management | Hardcoded JSON files | Fixture factories with builders | Maintainable, composable test data |

**Key insight:** The complexity in agent testing comes from non-determinism and emergent behavior. Custom solutions tend to miss edge cases around tool chaining, context windows, and retry logic that established patterns handle.

## Common Pitfalls

### Pitfall 1: Fixture Drift
**What goes wrong:** LLM prompts change slightly, causing fixture keys to mismatch and tests to fail or use fallback responses.
**Why it happens:** Fixture keys are often based on exact prompt strings, but prompts evolve.
**How to avoid:** Use semantic hashing (hash of normalized prompt) or pattern-based fixture matching instead of exact string matching. Version fixtures with the code.
**Warning signs:** Tests pass locally but fail in CI; tests that previously used fixtures now making real API calls.

### Pitfall 2: Guardrail False Positives in Tests
**What goes wrong:** Security guardrails block legitimate test inputs (e.g., test code containing "ignore this error" triggers prompt injection detection).
**Why it happens:** Test data often contains edge cases and unusual patterns that trigger security heuristics.
**How to avoid:** Implement a `TestModeGuardrail` wrapper that logs violations but doesn't block, or maintain an allowlist for test contexts. Never disable guardrails entirely.
**Warning signs:** Tests failing with "Blocked by guardrail" errors; developers bypassing guardrails in test setup.

### Pitfall 3: Leaky Test State
**What goes wrong:** Tests share mock state through singleton registries (like the existing `agentRegistry` singleton), causing test interference.
**Why it happens:** The current codebase uses singleton patterns for `agentRegistry`.
**How to avoid:** Provide a `createTestRegistry()` factory for tests, or use Jest's `jest.isolateModules()` for true isolation. Clear singleton state in `afterEach`.
**Warning signs:** Tests pass in isolation but fail when run together; flaky tests with inconsistent results.

### Pitfall 4: Over-Mocking Agent Behavior
**What goes wrong:** Tests mock the agent's internal decision-making, not just external dependencies, creating tests that pass but don't verify real behavior.
**Why it happens:** Easier to mock `agent.execute()` than set up proper fixtures for LLM responses.
**How to avoid:** Mock at the LLM client layer only. Let the agent's reasoning logic execute with deterministic LLM responses.
**Warning signs:** Tests pass but production fails; high coverage but low confidence; mocks returning pre-canned results that skip agent logic.

## Code Examples

### Jest Configuration for TypeScript

```typescript
// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  // Isolate modules to prevent singleton pollution
  isolateModules: true
};

export default config;
```

### Test Setup File

```typescript
// tests/setup.ts
import { agentRegistry } from '@/agents/agent-registry';

// Global test utilities
declare global {
  function createTestContext(): {
    runId: string;
    agentId: string;
    timestamp: Date;
  };
}

global.createTestContext = () => ({
  runId: `test-run-${Date.now()}`,
  agentId: `test-agent-${Math.random().toString(36).substr(2, 9)}`,
  timestamp: new Date()
});

// Clean up singletons after each test
afterEach(() => {
  // Clear agent registry
  const stats = agentRegistry.getStats();
  if (stats.total > 0) {
    agentRegistry.getAll().forEach(agent => {
      agentRegistry.unregister(agent.getId());
    });
  }
});
```

### Fixture Factory Pattern

```typescript
// testing/fixtures/llm-responses.ts
export interface LLMResponseFixture {
  id: string;
  description: string;
  promptPattern: RegExp;
  response: any;
  metadata?: {
    model?: string;
    tokens?: number;
    latency?: number;
  };
}

export const SecurityReviewFixtures: LLMResponseFixture[] = [
  {
    id: 'security-review-sql-injection',
    description: 'Detects SQL injection vulnerability',
    promptPattern: /sql|injection|query.*\$\{/i,
    response: {
      content: JSON.stringify({
        issues: [
          {
            severity: 'critical',
            type: 'sql-injection',
            description: 'Unparameterized query with user input',
            line: 5,
            recommendation: 'Use parameterized queries or an ORM'
          }
        ],
        summary: '1 critical issue found'
      }),
      usage: { prompt: 150, completion: 80 }
    }
  },
  {
    id: 'security-review-clean',
    description: 'No security issues found',
    promptPattern: /clean|safe|no.*issue/i,
    response: {
      content: JSON.stringify({
        issues: [],
        summary: 'No security issues detected'
      }),
      usage: { prompt: 100, completion: 30 }
    }
  }
];

export class FixtureLoader {
  private fixtures = new Map<string, LLMResponseFixture>();

  constructor(fixtures: LLMResponseFixture[]) {
    fixtures.forEach(f => this.fixtures.set(f.id, f));
  }

  findMatching(prompt: string): LLMResponseFixture | undefined {
    return Array.from(this.fixtures.values()).find(f =>
      f.promptPattern.test(prompt)
    );
  }

  get(id: string): LLMResponseFixture | undefined {
    return this.fixtures.get(id);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mocking entire agent classes | Dependency injection at LLM client layer | 2024 | Tests verify actual agent logic, not just mocks |
| Regex-only content filtering | Hybrid ML + rule-based guardrails | 2024 | Better catch rate for prompt injection |
| Manual test data creation | Fixture factories with builders | 2024 | Maintainable, composable test data |
| Single guardrail | Defense-in-depth with composite guardrails | 2024 | Multiple validation layers |
| Human-only evaluation | LLM-as-a-Judge with rubrics | 2024 | Scalable evaluation for subjective criteria |

**Deprecated/outdated:**
- **Snapshot testing for LLM outputs:** Too brittle; use rubric-based evaluation instead.
- **Exact string matching for fixtures:** Use semantic/pattern matching for resilience.

## Open Questions

1. **LLM Provider Abstraction**
   - What we know: Project currently doesn't have a unified LLM client interface.
   - What's unclear: Should we create one as part of Phase 1, or wait for Phase 2 (Skill Registry)?
   - Recommendation: Create minimal interface in Phase 1 for testing purposes; expand in Phase 2.

2. **Guardrail Performance**
   - What we know: Guardrails add latency to agent execution.
   - What's unclear: What's the acceptable overhead for the security review agent?
   - Recommendation: Implement async/concurrent guardrail execution; measure and document overhead.

3. **Test Database Strategy**
   - What we know: SQLite is used with file-based persistence.
   - What's unclear: Should tests use `:memory:` databases or temporary files?
   - Recommendation: Use `:memory:` for unit tests, temporary files for integration tests requiring persistence across restarts.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest |
| Config file | `jest.config.ts` (to be created) |
| Quick run command | `npm test -- --testPathPattern=security` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-04 | Deterministic skill testing | unit | `npm test -- skill.test.ts` | No - Wave 0 |
| REQ-04 | Security guardrail blocking | unit | `npm test -- guardrail.test.ts` | No - Wave 0 |
| REQ-04 | LLM fixture matching | unit | `npm test -- fixture.test.ts` | No - Wave 0 |
| REQ-04 | Mock LLM client | unit | `npm test -- mock-llm.test.ts` | No - Wave 0 |
| REQ-04 | Integration with Jest | integration | `npm test` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=<module>`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `jest.config.ts` - Jest configuration with TypeScript support
- [ ] `tests/setup.ts` - Global test setup and singleton cleanup
- [ ] `tests/unit/security/guardrail.test.ts` - Security guardrail tests
- [ ] `tests/unit/testing/mock-llm.test.ts` - Mock LLM client tests
- [ ] `tests/fixtures/` - Test fixture directory
- [ ] `tsconfig.json` update - Include tests directory (currently excluded)

## Sources

### Primary (HIGH confidence)
- [Jest Mocking Best Practices - Microsoft ISE](https://devblogs.microsoft.com/ise/jest-mocking-best-practices/) - Official Microsoft patterns for Jest + TypeScript
- [Jest Mock Functions](https://jestjs.io/docs/mock-functions) - Official Jest documentation
- [LangWatch Scenario Testing](https://langwatch.ai/scenario/testing-guides/mocks) - Agent-specific testing patterns
- [Confident AI - LLM-as-a-Judge](https://www.confident-ai.com/blog/why-llm-as-a-judge-is-the-best-llm-evaluation-method) - Evaluation pattern
- [Evidently AI - LLM-as-a-Judge](https://www.evidentlyai.com/llm-guide/llm-as-a-judge) - Implementation patterns

### Secondary (MEDIUM confidence)
- [OpenAI Guardrails TypeScript](https://openai.github.io/openai-guardrails-js/) - Guardrail patterns (library-specific but patterns generalize)
- [HAI Guardrails (Presidio OSS)](https://www.github-zh.com/projects/976605411-hai-guardrails) - LLM guard implementations
- [Render - Security Best Practices for AI Agents](https://render.com/articles/security-best-practices-when-building-ai-agents) - Security patterns

### Tertiary (LOW confidence)
- [CodeSignal - Input Guardrails Course](https://codesignal.com/learn/courses/controlling-and-securing-openai-agents-execution-in-typescript-2/lessons/protecting-agents-with-input-guardrails) - Course content not directly accessible, pattern inferred from search snippets

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Jest is already in project; patterns well-established
- Architecture: HIGH - DI and guardrail patterns are industry standard
- Pitfalls: MEDIUM - Based on common testing anti-patterns, some agent-specific

**Research date:** 2026-03-09
**Valid until:** 30 days (testing patterns are stable)
