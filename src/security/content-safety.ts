/**
 * Content Safety Guardrail
 *
 * Blocks harmful or inappropriate content using rule-based detection.
 * Designed to be compatible with future ML-based moderation API integration.
 */

import {
  BaseGuardrail,
  GuardrailContext,
  GuardrailResult,
  GuardrailSeverity
} from './base-guardrail';

/**
 * Categories of content to block
 */
export type ContentCategory = 'hate' | 'violence' | 'self-harm' | 'harassment' | 'explicit';

/**
 * Interface for future moderation API integration
 */
export interface ModerationApi {
  moderate(text: string): Promise<{
    flagged: boolean;
    categories: Record<string, boolean>;
    scores?: Record<string, number>;
  }>;
}

/**
 * Rule-based content safety guardrail
 *
 * For Phase 1: Uses keyword and regex patterns
 * Future: Can integrate with external moderation API
 */
export class ContentSafetyGuardrail extends BaseGuardrail<string, string> {
  readonly name = 'ContentSafety';
  readonly priority = 1;
  readonly description = 'Blocks harmful or inappropriate content';

  private readonly blockedCategories: ContentCategory[];
  private readonly moderationApi?: ModerationApi;

  /**
   * Keywords for each blocked category
   */
  private readonly categoryKeywords: Record<ContentCategory, string[]> = {
    hate: ['hate', 'racist', 'bigot', 'slur', 'supremacist'],
    violence: ['kill', 'murder', 'attack', 'hurt', 'violence', 'weapon', 'bomb'],
    'self-harm': ['suicide', 'self-harm', 'hurt myself', 'end my life'],
    harassment: ['harass', 'stalk', 'dox', 'blackmail', 'extort'],
    explicit: ['porn', 'sexual', 'nsfw', 'explicit']
  };

  /**
   * Regex patterns for more nuanced detection
   */
  private readonly patterns: Array<{ pattern: RegExp; category: ContentCategory; severity: GuardrailSeverity }> = [
    { pattern: /\b(kill|murder)\s+(you|them|him|her|myself)\b/i, category: 'violence', severity: 'critical' },
    { pattern: /\b(hate\s+(you|them|all|everyone))\b/i, category: 'hate', severity: 'high' },
    { pattern: /\b(k[i!]ll\s*my\s*self)\b/i, category: 'self-harm', severity: 'critical' },
    { pattern: /\b(suicide|self[-\s]?harm)\b/i, category: 'self-harm', severity: 'critical' },
    { pattern: /\b(dox|doxx)\s*\w+\b/i, category: 'harassment', severity: 'high' }
  ];

  constructor(
    blockedCategories: ContentCategory[] = ['hate', 'violence', 'self-harm'],
    moderationApi?: ModerationApi
  ) {
    super();
    this.blockedCategories = blockedCategories;
    this.moderationApi = moderationApi;
  }

  /**
   * Validate content for safety
   *
   * Checks:
   * 1. Regex patterns for high-confidence matches
   * 2. Keyword matching for each blocked category
   * 3. Future: External moderation API if configured
   */
  async validate(
    input: string,
    context: GuardrailContext
  ): Promise<GuardrailResult<string>> {
    // Check regex patterns first (higher confidence)
    for (const { pattern, category, severity } of this.patterns) {
      if (this.blockedCategories.includes(category) && pattern.test(input)) {
        return {
          output: input,
          blocked: true,
          reason: `Content flagged for ${category}: potential harmful content detected`,
          severity,
          metadata: {
            category,
            matchedPattern: pattern.source,
            guardrail: this.name
          }
        };
      }
    }

    // Check keyword matches
    const lowerInput = input.toLowerCase();
    for (const category of this.blockedCategories) {
      const keywords = this.categoryKeywords[category];
      const matchedKeywords = keywords.filter(kw => lowerInput.includes(kw.toLowerCase()));

      if (matchedKeywords.length > 0) {
        return {
          output: input,
          blocked: true,
          reason: `Content flagged for ${category}: contains prohibited terms`,
          severity: category === 'self-harm' ? 'critical' : 'high',
          metadata: {
            category,
            matchedKeywords,
            guardrail: this.name
          }
        };
      }
    }

    // Future: External API integration
    if (this.moderationApi) {
      try {
        const apiResult = await this.moderationApi.moderate(input);
        if (apiResult.flagged) {
          const flaggedCategories = Object.entries(apiResult.categories)
            .filter(([, flagged]) => flagged)
            .map(([cat]) => cat);

          return {
            output: input,
            blocked: true,
            reason: `Content flagged by moderation API: ${flaggedCategories.join(', ')}`,
            severity: 'high',
            metadata: {
              apiCategories: flaggedCategories,
              apiScores: apiResult.scores,
              guardrail: this.name
            }
          };
        }
      } catch (error) {
        // Fail closed: if API fails, block the content
        return {
          output: input,
          blocked: true,
          reason: 'Content safety check failed: moderation API error',
          severity: 'high',
          metadata: {
            apiError: error instanceof Error ? error.message : 'Unknown error',
            guardrail: this.name,
            failClosed: true
          }
        };
      }
    }

    // Content is safe
    return {
      output: input,
      blocked: false,
      severity: 'low',
      metadata: {
        guardrail: this.name,
        checkedCategories: this.blockedCategories
      }
    };
  }
}
