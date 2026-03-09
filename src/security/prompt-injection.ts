/**
 * Prompt Injection Detection Guardrail
 *
 * Detects and blocks prompt injection attempts using pattern matching.
 * Runs at highest priority (priority 0) to catch attacks before processing.
 */

import {
  BaseGuardrail,
  GuardrailContext,
  GuardrailResult
} from './base-guardrail';

/**
 * Prompt injection detection guardrail
 *
 * Uses regex patterns to detect common prompt injection attacks.
 * Reference: Pattern 2 from 01-RESEARCH.md
 */
export class PromptInjectionGuardrail extends BaseGuardrail<string, string> {
  readonly name = 'PromptInjectionDetection';
  readonly priority = 0; // Run first, before content safety
  readonly description = 'Detects prompt injection attempts';

  /**
   * Regex patterns for detecting prompt injection attempts
   *
   * These patterns detect:
   * - Instruction override attempts
   * - System prompt access attempts
   * - Role-playing attacks (DAN, etc.)
   * - Memory/forget manipulation
   */
  private readonly injectionPatterns: Array<{
    pattern: RegExp;
    description: string;
  }> = [
    {
      pattern: /ignore\s+(previous|prior|all)\s+(instructions|prompts?)/i,
      description: 'Ignore previous instructions'
    },
    {
      pattern: /disregard\s+(all|your)\s+(instructions|prompt)/i,
      description: 'Disregard instructions'
    },
    {
      pattern: /system\s+prompt/i,
      description: 'System prompt access attempt'
    },
    {
      pattern: /you\s+are\s+now/i,
      description: 'Role override attempt'
    },
    {
      pattern: /DAN|do\s+anything\s+now/i,
      description: 'DAN (Do Anything Now) attack'
    },
    {
      pattern: /forget\s+(everything|your|all)/i,
      description: 'Memory manipulation attempt'
    },
    {
      pattern: /new\s+instructions/i,
      description: 'New instructions injection'
    },
    {
      pattern: /override\s+(previous|prior)/i,
      description: 'Override previous instructions'
    },
    {
      pattern: /ignore\s+above/i,
      description: 'Ignore above instructions'
    },
    {
      pattern: /ignore\s+the\s+above/i,
      description: 'Ignore the above'
    },
    {
      pattern: /from\s+now\s+on/i,
      description: 'Behavior change attempt'
    },
    {
      pattern: /you\s+will\s+not/i,
      description: 'Negative constraint injection'
    },
    {
      pattern: /developer\s+mode/i,
      description: 'Developer mode activation'
    },
    {
      pattern: /jailbreak/i,
      description: 'Jailbreak attempt'
    }
  ];

  /**
   * Validate input for prompt injection attempts
   *
   * Tests input against all known injection patterns.
   * Returns blocked=true with critical severity if any pattern matches.
   */
  async validate(
    input: string,
    context: GuardrailContext
  ): Promise<GuardrailResult<string>> {
    const lowerInput = input.toLowerCase();

    for (const { pattern, description } of this.injectionPatterns) {
      if (pattern.test(input)) {
        return {
          output: input,
          blocked: true,
          reason: `Potential prompt injection detected: ${description}`,
          severity: 'critical',
          metadata: {
            matchedPattern: pattern.source,
            patternDescription: description,
            guardrail: this.name,
            inputLength: input.length
          }
        };
      }
    }

    // No injection patterns detected
    return {
      output: input,
      blocked: false,
      severity: 'low',
      metadata: {
        guardrail: this.name,
        patternsChecked: this.injectionPatterns.length,
        inputLength: input.length
      }
    };
  }

  /**
   * Get the list of patterns being checked (for debugging/testing)
   */
  getPatterns(): Array<{ pattern: string; description: string }> {
    return this.injectionPatterns.map(p => ({
      pattern: p.pattern.source,
      description: p.description
    }));
  }
}
