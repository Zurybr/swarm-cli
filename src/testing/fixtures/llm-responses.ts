/**
 * LLM Response Fixtures
 *
 * Pre-defined LLM responses for deterministic testing.
 * Uses the fixture factory pattern for maintainable test data.
 */

import type { CompletionResult } from '../mock-llm-client';

/**
 * Fixture definition for LLM responses
 */
export interface LLMResponseFixture {
  /** Unique identifier for the fixture */
  id: string;
  /** Human-readable description */
  description: string;
  /** Regex pattern to match prompts */
  promptPattern: RegExp;
  /** The response to return when pattern matches */
  response: CompletionResult;
  /** Optional metadata about the response */
  metadata?: {
    model?: string;
    tokens?: number;
    latency?: number;
  };
}

/**
 * Loads and matches fixtures for LLM responses
 */
export class FixtureLoader {
  private fixtures: Map<string, LLMResponseFixture> = new Map();

  /**
   * Create a fixture loader with initial fixtures
   */
  constructor(fixtures: LLMResponseFixture[] = []) {
    fixtures.forEach(fixture => {
      this.fixtures.set(fixture.id, fixture);
    });
  }

  /**
   * Find a fixture matching the given prompt
   * Returns the first match based on pattern testing
   */
  findMatching(prompt: string): LLMResponseFixture | undefined {
    for (const fixture of this.fixtures.values()) {
      if (fixture.promptPattern.test(prompt)) {
        return fixture;
      }
    }
    return undefined;
  }

  /**
   * Get a fixture by its ID
   */
  get(id: string): LLMResponseFixture | undefined {
    return this.fixtures.get(id);
  }

  /**
   * Add a fixture to the loader
   */
  add(fixture: LLMResponseFixture): void {
    this.fixtures.set(fixture.id, fixture);
  }

  /**
   * Get all fixture IDs
   */
  getIds(): string[] {
    return Array.from(this.fixtures.keys());
  }

  /**
   * Get count of loaded fixtures
   */
  count(): number {
    return this.fixtures.size;
  }
}

/**
 * Security review response types
 */
export interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  lineNumber?: number;
  recommendation: string;
}

export interface SecurityReviewResult {
  issues: SecurityIssue[];
  summary: string;
  scannedAt: string;
}

// Helper to create security review JSON responses
function createSecurityResponse(issues: SecurityIssue[], summary: string): CompletionResult {
  const result: SecurityReviewResult = {
    issues,
    summary,
    scannedAt: new Date().toISOString()
  };

  const content = JSON.stringify(result, null, 2);
  return {
    content,
    usage: {
      prompt: Math.floor(content.length / 4),
      completion: Math.floor(content.length / 4)
    }
  };
}

/**
 * Pre-defined fixtures for security review agent testing
 */
export const SecurityReviewFixtures: LLMResponseFixture[] = [
  {
    id: 'security-review-sql-injection',
    description: 'Detects SQL injection vulnerabilities in code',
    promptPattern: /sql|injection|query.*concatenation/i,
    response: createSecurityResponse(
      [
        {
          severity: 'critical',
          category: 'SQL Injection',
          description: 'User input is directly concatenated into SQL query without parameterization',
          lineNumber: 42,
          recommendation: 'Use parameterized queries or prepared statements'
        }
      ],
      'Found 1 critical SQL injection vulnerability. Immediate action required.'
    ),
    metadata: {
      model: 'gpt-4',
      tokens: 150,
      latency: 120
    }
  },
  {
    id: 'security-review-xss',
    description: 'Detects XSS vulnerabilities in code',
    promptPattern: /xss|cross.site|innerHTML|document\.write/i,
    response: createSecurityResponse(
      [
        {
          severity: 'high',
          category: 'XSS',
          description: 'User input rendered without HTML escaping',
          lineNumber: 23,
          recommendation: 'Use textContent instead of innerHTML or sanitize with DOMPurify'
        },
        {
          severity: 'medium',
          category: 'XSS',
          description: 'Dynamic href attribute may allow javascript: protocol',
          recommendation: 'Validate URL scheme or use a whitelist'
        }
      ],
      'Found 2 XSS vulnerabilities (1 high, 1 medium). Review recommended.'
    ),
    metadata: {
      model: 'gpt-4',
      tokens: 200,
      latency: 150
    }
  },
  {
    id: 'security-review-clean',
    description: 'No security issues found',
    promptPattern: /clean|safe|no.*issues|review.*code/i,
    response: createSecurityResponse(
      [],
      'No security issues detected. Code follows security best practices.'
    ),
    metadata: {
      model: 'gpt-4',
      tokens: 80,
      latency: 100
    }
  },
  {
    id: 'security-review-hardcoded-secrets',
    description: 'Detects hardcoded secrets and credentials',
    promptPattern: /secret|password|api.?key|token|credential/i,
    response: createSecurityResponse(
      [
        {
          severity: 'critical',
          category: 'Secrets Management',
          description: 'Hardcoded API key detected in source code',
          lineNumber: 15,
          recommendation: 'Move to environment variables or secure secret store'
        },
        {
          severity: 'high',
          category: 'Secrets Management',
          description: 'Database password visible in configuration',
          recommendation: 'Use secret management service (AWS Secrets Manager, etc.)'
        }
      ],
      'Found 2 hardcoded secrets. Remove immediately and rotate credentials.'
    ),
    metadata: {
      model: 'gpt-4',
      tokens: 180,
      latency: 130
    }
  },
  {
    id: 'security-review-path-traversal',
    description: 'Detects path traversal vulnerabilities',
    promptPattern: /path|traversal|\.\.|file.*upload/i,
    response: createSecurityResponse(
      [
        {
          severity: 'high',
          category: 'Path Traversal',
          description: 'User input used directly in file path construction',
          lineNumber: 67,
          recommendation: 'Validate and sanitize file paths, use allowlists'
        }
      ],
      'Found 1 path traversal vulnerability. Validate all file paths.'
    ),
    metadata: {
      model: 'gpt-4',
      tokens: 140,
      latency: 110
    }
  }
];

/**
 * Factory function to create custom security fixtures
 */
export function createSecurityFixture(
  id: string,
  pattern: RegExp,
  issues: SecurityIssue[],
  summary: string,
  metadata?: LLMResponseFixture['metadata']
): LLMResponseFixture {
  return {
    id,
    description: `Custom security fixture: ${id}`,
    promptPattern: pattern,
    response: createSecurityResponse(issues, summary),
    metadata
  };
}

/**
 * General purpose fixtures for common testing scenarios
 */
export const GeneralFixtures: LLMResponseFixture[] = [
  {
    id: 'empty-response',
    description: 'Returns empty content',
    promptPattern: /^\s*$/, // Only whitespace
    response: {
      content: '',
      usage: { prompt: 0, completion: 0 }
    }
  },
  {
    id: 'error-response',
    description: 'Simulates an error condition',
    promptPattern: /error|fail|exception/i,
    response: {
      content: JSON.stringify({ error: 'Simulated error', code: 'TEST_ERROR' }),
      usage: { prompt: 10, completion: 10 }
    }
  },
  {
    id: 'json-response',
    description: 'Returns generic JSON response',
    promptPattern: /json|parse|object/i,
    response: {
      content: JSON.stringify({ status: 'ok', data: {} }),
      usage: { prompt: 20, completion: 20 }
    }
  }
];
