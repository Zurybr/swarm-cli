/**
 * Security Module
 *
 * Public API for security guardrails.
 * Provides defense-in-depth controls for agent operations.
 */

// Base guardrail exports
export {
  BaseGuardrail,
  GuardrailContext,
  GuardrailResult,
  GuardrailSeverity,
  GuardrailBlockedError
} from './base-guardrail';

// Concrete guardrail exports
export {
  ContentSafetyGuardrail,
  ContentCategory,
  ModerationApi
} from './content-safety';

export {
  PromptInjectionGuardrail
} from './prompt-injection';

export {
  CompositeGuardrail,
  CompositeMode
} from './composite-guardrail';
