/**
 * Testing Module
 *
 * Public API for testing utilities.
 * Provides deterministic LLM mocking for agent skill testing.
 *
 * @example
 * ```typescript
 * import { MockLLMClient, FixtureLoader, SecurityReviewFixtures } from '@/testing';
 *
 * const client = new MockLLMClient();
 * const loader = new FixtureLoader(SecurityReviewFixtures);
 *
 * // Set up fixtures
 * client.setFixturePattern(/security/, loader.findMatching('security')!.response);
 *
 * // Use in tests
 * const result = await client.complete({ prompt: 'security review' });
 * ```
 */

// LLM Client types and implementation
export type {
  CompletionParams,
  CompletionResult,
  Message,
  ChatResponse,
  LLMCall,
  LLMClient
} from './mock-llm-client';

export { MockLLMClient } from './mock-llm-client';

// Fixture system
export type {
  LLMResponseFixture,
  SecurityIssue,
  SecurityReviewResult
} from './fixtures/llm-responses';

export {
  FixtureLoader,
  SecurityReviewFixtures,
  GeneralFixtures,
  createSecurityFixture
} from './fixtures/llm-responses';
