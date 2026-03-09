/**
 * LLM Client Interface and Mock Implementation
 *
 * Provides a deterministic mock LLM client for testing agent skills.
 * Eliminates non-determinism from LLM API calls by returning pre-defined
 * responses based on fixtures.
 */

/**
 * Parameters for completion requests
 */
export interface CompletionParams {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Result from a completion request
 */
export interface CompletionResult {
  content: string;
  usage: {
    prompt: number;
    completion: number;
  };
}

/**
 * Message structure for chat-based LLM interactions
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Response from chat-based LLM interactions
 */
export interface ChatResponse {
  message: Message;
  usage: {
    prompt: number;
    completion: number;
  };
}

/**
 * Record of an LLM call for verification
 */
export interface LLMCall {
  params: CompletionParams;
  timestamp: Date;
}

/**
 * Interface for LLM clients
 * Implementations can be real API clients or mocks for testing
 */
export interface LLMClient {
  /**
   * Execute a completion request
   */
  complete(params: CompletionParams): Promise<CompletionResult>;

  /**
   * Execute a chat completion request
   */
  chat?(messages: Message[]): Promise<ChatResponse>;
}

/**
 * Mock LLM client for deterministic testing
 *
 * Returns pre-defined responses based on fixtures, eliminating
 * non-determinism from LLM API calls in tests.
 */
export class MockLLMClient implements LLMClient {
  private fixtures: Map<string, CompletionResult> = new Map();
  private patternFixtures: Array<{ pattern: RegExp; response: CompletionResult }> = [];
  private calls: LLMCall[] = [];

  /**
   * Behavior when no fixture matches
   * - 'empty': Returns empty content (default)
   * - 'error': Throws an error
   */
  public fallbackMode: 'error' | 'empty' = 'empty';

  /**
   * Set a fixture for an exact key match
   */
  setFixture(key: string, response: CompletionResult): void {
    this.fixtures.set(key, response);
  }

  /**
   * Set a fixture that matches prompts by regex pattern
   */
  setFixturePattern(pattern: RegExp, response: CompletionResult): void {
    this.patternFixtures.push({ pattern, response });
  }

  /**
   * Get all recorded LLM calls for verification
   */
  getCalls(): LLMCall[] {
    return [...this.calls];
  }

  /**
   * Clear all fixtures
   */
  clearFixtures(): void {
    this.fixtures.clear();
    this.patternFixtures = [];
  }

  /**
   * Clear call history
   */
  clearCalls(): void {
    this.calls = [];
  }

  /**
   * Execute a completion request
   * Returns fixture match or falls back based on fallbackMode
   */
  async complete(params: CompletionParams): Promise<CompletionResult> {
    // Record the call
    this.calls.push({
      params: { ...params },
      timestamp: new Date()
    });

    // Generate key from normalized prompt
    const key = this.generateKey(params);

    // Try exact match first
    const exactMatch = this.fixtures.get(key);
    if (exactMatch) {
      return exactMatch;
    }

    // Try pattern matching
    for (const { pattern, response } of this.patternFixtures) {
      if (pattern.test(params.prompt)) {
        return response;
      }
    }

    // Fallback behavior
    if (this.fallbackMode === 'error') {
      throw new Error(`No fixture found for prompt: ${params.prompt.substring(0, 100)}...`);
    }

    // Return empty response
    return {
      content: '',
      usage: { prompt: 0, completion: 0 }
    };
  }

  /**
   * Execute a chat completion request
   */
  async chat(messages: Message[]): Promise<ChatResponse> {
    // Convert chat to completion format for fixture matching
    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');

    const result = await this.complete({ prompt });

    return {
      message: {
        role: 'assistant',
        content: result.content
      },
      usage: result.usage
    };
  }

  /**
   * Generate a deterministic key from completion parameters
   * Normalizes the prompt for consistent matching
   */
  private generateKey(params: CompletionParams): string {
    // Normalize: trim whitespace, lowercase, remove extra spaces
    const normalized = params.prompt
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

    // Simple hash for deterministic key generation
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return `prompt:${hash}`;
  }
}
