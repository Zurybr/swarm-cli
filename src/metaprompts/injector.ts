/**
 * Context Injector
 *
 * Handles dynamic context injection into prompt templates.
 * Supports variable substitution, conditional blocks, and context enrichment.
 */

import type {
  InjectedContext,
  TemplateVariable,
  ValidationResult,
  ValidationError,
  VariableType,
  CodeSnippet,
} from './types';

/**
 * Options for context injection
 */
export interface InjectionOptions {
  /** Whether to validate variables before injection */
  validate?: boolean;
  /** Whether to throw on validation errors */
  strict?: boolean;
  /** Maximum length for string variables */
  maxStringLength?: number;
  /** Maximum items for array variables */
  maxArrayItems?: number;
  /** Custom transformers for specific variable types */
  transformers?: Record<VariableType, (value: unknown) => string>;
}

/**
 * Default injection options
 */
const DEFAULT_OPTIONS: InjectionOptions = {
  validate: true,
  strict: false,
  maxStringLength: 10000,
  maxArrayItems: 100,
};

/**
 * Default transformers for variable types
 */
const DEFAULT_TRANSFORMERS: Record<VariableType, (value: unknown) => string> = {
  string: (v) => String(v),
  number: (v) => String(Number(v)),
  boolean: (v) => v ? 'true' : 'false',
  array: (v) => Array.isArray(v) ? v.map(String).join('\n') : String(v),
  object: (v) => JSON.stringify(v, null, 2),
  code: (v) => String(v),
  json: (v) => JSON.stringify(v, null, 2),
  markdown: (v) => String(v),
};

/**
 * Validates variables against their definitions
 */
export function validateVariables(
  variables: TemplateVariable[],
  values: Record<string, unknown>,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  for (const variable of variables) {
    const value = values[variable.name];

    // Check required variables
    if (variable.required && (value === undefined || value === null)) {
      errors.push({
        variable: variable.name,
        message: `Required variable "${variable.name}" is missing`,
        type: 'missing',
      });
      continue;
    }

    // Skip validation for optional variables with no value
    if (value === undefined || value === null) {
      continue;
    }

    // Validate type
    const typeError = validateType(variable.name, variable.type, value);
    if (typeError) {
      errors.push(typeError);
      continue;
    }

    // Validate pattern for strings
    if (variable.type === 'string' && variable.pattern) {
      const regex = new RegExp(variable.pattern);
      if (!regex.test(String(value))) {
        errors.push({
          variable: variable.name,
          message: `Value does not match pattern: ${variable.pattern}`,
          type: 'pattern_mismatch',
          received: value,
        });
      }
    }

    // Validate constraints
    if (variable.constraints) {
      const constraintErrors = validateConstraints(
        variable.name,
        variable.type,
        value,
        variable.constraints,
      );
      errors.push(...constraintErrors);
    }
  }

  // Check for extra variables
  const definedNames = new Set(variables.map((v) => v.name));
  for (const name of Object.keys(values)) {
    if (!definedNames.has(name)) {
      warnings.push(`Extra variable "${name}" provided but not defined in template`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a value against its expected type
 */
function validateType(
  name: string,
  type: VariableType,
  value: unknown,
): ValidationError | null {
  switch (type) {
    case 'string':
    case 'code':
    case 'markdown':
      if (typeof value !== 'string') {
        return {
          variable: name,
          message: `Expected string, got ${typeof value}`,
          type: 'invalid_type',
          received: value,
        };
      }
      break;
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return {
          variable: name,
          message: `Expected number, got ${typeof value}`,
          type: 'invalid_type',
          received: value,
        };
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        return {
          variable: name,
          message: `Expected boolean, got ${typeof value}`,
          type: 'invalid_type',
          received: value,
        };
      }
      break;
    case 'array':
      if (!Array.isArray(value)) {
        return {
          variable: name,
          message: `Expected array, got ${typeof value}`,
          type: 'invalid_type',
          received: value,
        };
      }
      break;
    case 'object':
    case 'json':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return {
          variable: name,
          message: `Expected object, got ${typeof value}`,
          type: 'invalid_type',
          received: value,
        };
      }
      break;
  }
  return null;
}

/**
 * Validates constraints on a value
 */
function validateConstraints(
  name: string,
  type: VariableType,
  value: unknown,
  constraints: NonNullable<TemplateVariable['constraints']>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (type === 'array' && Array.isArray(value)) {
    if (constraints.minItems !== undefined && value.length < constraints.minItems) {
      errors.push({
        variable: name,
        message: `Array must have at least ${constraints.minItems} items`,
        type: 'constraint_violation',
        received: value,
      });
    }
    if (constraints.maxItems !== undefined && value.length > constraints.maxItems) {
      errors.push({
        variable: name,
        message: `Array must have at most ${constraints.maxItems} items`,
        type: 'constraint_violation',
        received: value,
      });
    }
  }

  if (type === 'string' && typeof value === 'string') {
    if (constraints.minLength !== undefined && value.length < constraints.minLength) {
      errors.push({
        variable: name,
        message: `String must be at least ${constraints.minLength} characters`,
        type: 'constraint_violation',
        received: value,
      });
    }
    if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
      errors.push({
        variable: name,
        message: `String must be at most ${constraints.maxLength} characters`,
        type: 'constraint_violation',
        received: value,
      });
    }
  }

  return errors;
}

/**
 * Applies default values for missing optional variables
 */
export function applyDefaults(
  variables: TemplateVariable[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...values };

  for (const variable of variables) {
    if (result[variable.name] === undefined && variable.default !== undefined) {
      result[variable.name] = variable.default;
    }
  }

  return result;
}

/**
 * Transforms a value to its string representation
 */
function transformValue(
  type: VariableType,
  value: unknown,
  transformers: Record<VariableType, (value: unknown) => string>,
): string {
  const transformer = transformers[type] || DEFAULT_TRANSFORMERS[type];
  return transformer(value);
}

/**
 * Simple template engine supporting {{variable}} and {{#if variable}}...{{/if}} syntax
 */
export function renderTemplate(
  template: string,
  values: Record<string, unknown>,
  transformers: Record<VariableType, (value: unknown) => string> = DEFAULT_TRANSFORMERS,
): string {
  let result = template;

  // Handle {{#if variable}}...{{/if}} blocks
  result = result.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (match, varName, content) => {
      const value = values[varName];
      // Treat false as falsy
      if (value === false) {
        return '';
      }
      const condition =
        value !== undefined &&
        value !== null &&
        value !== '' &&
        !(Array.isArray(value) && value.length === 0) &&
        !(typeof value === 'object' && Object.keys(value).length === 0);
      return condition ? content : '';
    },
  );

  // Handle {{#each variable}}...{{/each}} blocks for arrays
  result = result.replace(
    /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (match, varName, content) => {
      const value = values[varName];
      if (!Array.isArray(value)) {
        return '';
      }
      return value
        .map((item) => {
          // Replace {{this}} and {{this.property}} in the content
          if (typeof item === 'object' && item !== null) {
            let itemContent = content;
            for (const [key, val] of Object.entries(item)) {
              itemContent = itemContent.replace(
                new RegExp(`\\{\\{this\\.${key}\\}\\}`, 'g'),
                String(val),
              );
            }
            // Replace {{this}} for the whole item
            itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
            return itemContent;
          }
          return content.replace(/\{\{this\}\}/g, String(item));
        })
        .join('');
    },
  );

  // Handle simple {{variable}} substitutions
  result = result.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const value = values[varName];
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  });

  return result;
}

/**
 * Injects context into a template
 */
export function injectContext(
  template: string,
  variables: TemplateVariable[],
  context: InjectedContext,
  customValues: Record<string, unknown> = {},
  options: InjectionOptions = {},
): { result: string; validation: ValidationResult } {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Build values from context and custom values
  const values: Record<string, unknown> = {
    task: context.task,
    ...flattenContext(context),
    ...customValues,
  };

  // Apply defaults
  const valuesWithDefaults = applyDefaults(variables, values);

  // Validate if requested
  let validation: ValidationResult;
  if (opts.validate) {
    validation = validateVariables(variables, valuesWithDefaults);
    if (opts.strict && !validation.valid) {
      throw new Error(
        `Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`,
      );
    }
  } else {
    validation = { valid: true, errors: [], warnings: [] };
  }

  // Merge custom transformers
  const transformers = { ...DEFAULT_TRANSFORMERS, ...opts.transformers };

  // Render template
  const result = renderTemplate(template, valuesWithDefaults, transformers);

  return { result, validation };
}

/**
 * Flattens context object for template substitution
 */
function flattenContext(context: InjectedContext): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};

  if (context.project) {
    flattened.projectName = context.project.name;
    flattened.projectPath = context.project.path;
    flattened.projectLanguage = context.project.language;
    flattened.projectFramework = context.project.framework;
  }

  if (context.code) {
    flattened.codeFiles = context.code.files || [];
    flattened.codeSnippets = context.code.snippets || [];
    flattened.dependencies = context.code.dependencies || [];
  }

  if (context.history) {
    flattened.previousAttempts = context.history.previousAttempts || [];
    flattened.learnings = context.history.learnings || [];
    flattened.errors = context.history.errors || [];
  }

  if (context.environment) {
    flattened.os = context.environment.os;
    flattened.shell = context.environment.shell;
    flattened.nodeVersion = context.environment.nodeVersion;
    flattened.tools = context.environment.tools || [];
  }

  if (context.custom) {
    Object.assign(flattened, context.custom);
  }

  return flattened;
}

/**
 * Enriches context with additional computed values
 */
export function enrichContext(
  context: InjectedContext,
  enrichers: Array<(ctx: InjectedContext) => Record<string, unknown>>,
): InjectedContext {
  const enriched = { ...context };

  if (!enriched.custom) {
    enriched.custom = {};
  }

  for (const enricher of enrichers) {
    const additions = enricher(enriched);
    Object.assign(enriched.custom!, additions);
  }

  return enriched;
}

/**
 * Built-in context enrichers
 */
export const contextEnrichers = {
  /**
   * Adds timestamp information
   */
  timestamp: (): Record<string, unknown> => ({
    timestamp: new Date().toISOString(),
    date: new Date().toDateString(),
  }),

  /**
   * Adds code statistics
   */
  codeStats: (ctx: InjectedContext): Record<string, unknown> => {
    const snippets = ctx.code?.snippets || [];
    return {
      codeSnippetCount: snippets.length,
      totalLinesOfCode: snippets.reduce(
        (sum, s) => sum + (s.lines.end - s.lines.start + 1),
        0,
      ),
    };
  },

  /**
   * Adds history summary
   */
  historySummary: (ctx: InjectedContext): Record<string, unknown> => {
    const history = ctx.history;
    return {
      hasPreviousAttempts: (history?.previousAttempts?.length || 0) > 0,
      previousAttemptCount: history?.previousAttempts?.length || 0,
      hasErrors: (history?.errors?.length || 0) > 0,
      errorCount: history?.errors?.length || 0,
    };
  },
};

/**
 * Formats a code snippet for injection
 */
export function formatCodeSnippet(snippet: CodeSnippet): string {
  return `File: ${snippet.file} (lines ${snippet.lines.start}-${snippet.lines.end})
Language: ${snippet.language}
Relevance: ${Math.round(snippet.relevance * 100)}%

\`\`\`${snippet.language}
${snippet.content}
\`\`\``;
}

/**
 * Truncates content to fit within token limits
 */
export function truncateForTokens(
  content: string,
  maxTokens: number,
  avgCharsPerToken = 4,
): string {
  const maxChars = maxTokens * avgCharsPerToken;

  if (content.length <= maxChars) {
    return content;
  }

  const truncationMarker = '\n\n[... content truncated due to length ...]\n\n';
  const availableChars = maxChars - truncationMarker.length;
  const headChars = Math.floor(availableChars * 0.7);
  const tailChars = Math.floor(availableChars * 0.3);

  return (
    content.slice(0, headChars) +
    truncationMarker +
    content.slice(-tailChars)
  );
}

/**
 * Estimates token count for a string
 */
export function estimateTokens(content: string, avgCharsPerToken = 4): number {
  return Math.ceil(content.length / avgCharsPerToken);
}
