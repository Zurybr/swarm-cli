/**
 * Context injector tests
 */

import {
  validateVariables,
  applyDefaults,
  renderTemplate,
  injectContext,
  enrichContext,
  contextEnrichers,
  formatCodeSnippet,
  estimateTokens,
  truncateForTokens,
} from '../injector';
import type { TemplateVariable, InjectedContext, CodeSnippet } from '../types';

describe('Injector', () => {
  describe('validateVariables', () => {
    const variables: TemplateVariable[] = [
      { name: 'required', type: 'string', description: 'Required var', required: true },
      { name: 'optional', type: 'string', description: 'Optional var', required: false },
      { name: 'number', type: 'number', description: 'Number var', required: false },
      { name: 'boolean', type: 'boolean', description: 'Boolean var', required: false },
      { name: 'array', type: 'array', description: 'Array var', required: false },
      { name: 'object', type: 'object', description: 'Object var', required: false },
    ];

    it('should pass with all required values', () => {
      const values = { required: 'test' };
      const result = validateVariables(variables, values);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when required value is missing', () => {
      const values = {};
      const result = validateVariables(variables, values);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].variable).toBe('required');
      expect(result.errors[0].type).toBe('missing');
    });

    it('should validate string type', () => {
      const values = { required: 123 };
      const result = validateVariables([variables[0]], values);
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('invalid_type');
    });

    it('should validate number type', () => {
      const values = { number: 'not a number', required: 'test' };
      const result = validateVariables(variables, values);
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('invalid_type');
    });

    it('should validate boolean type', () => {
      const values = { boolean: 'true', required: 'test' };
      const result = validateVariables(variables, values);
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('invalid_type');
    });

    it('should validate array type', () => {
      const values = { array: 'not an array', required: 'test' };
      const result = validateVariables(variables, values);
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('invalid_type');
    });

    it('should validate object type', () => {
      const values = { object: 'not an object', required: 'test' };
      const result = validateVariables(variables, values);
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('invalid_type');
    });

    it('should warn on extra variables', () => {
      const values = { required: 'test', extra: 'value' };
      const result = validateVariables(variables, values);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('extra');
    });

    it('should validate pattern constraints', () => {
      const vars: TemplateVariable[] = [
        { name: 'pattern', type: 'string', description: 'Pattern var', required: true, pattern: '^[a-z]+$' },
      ];
      const values = { pattern: 'ABC123' };
      const result = validateVariables(vars, values);
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('pattern_mismatch');
    });

    it('should validate minLength constraint', () => {
      const vars: TemplateVariable[] = [
        { name: 'min', type: 'string', description: 'Min var', required: true, constraints: { minLength: 5 } },
      ];
      const values = { min: 'ab' };
      const result = validateVariables(vars, values);
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('constraint_violation');
    });

    it('should validate maxLength constraint', () => {
      const vars: TemplateVariable[] = [
        { name: 'max', type: 'string', description: 'Max var', required: true, constraints: { maxLength: 5 } },
      ];
      const values = { max: 'this is too long' };
      const result = validateVariables(vars, values);
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('constraint_violation');
    });

    it('should validate minItems constraint', () => {
      const vars: TemplateVariable[] = [
        { name: 'items', type: 'array', description: 'Items var', required: true, constraints: { minItems: 2 } },
      ];
      const values = { items: ['one'] };
      const result = validateVariables(vars, values);
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('constraint_violation');
    });

    it('should validate maxItems constraint', () => {
      const vars: TemplateVariable[] = [
        { name: 'items', type: 'array', description: 'Items var', required: true, constraints: { maxItems: 2 } },
      ];
      const values = { items: ['one', 'two', 'three'] };
      const result = validateVariables(vars, values);
      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('constraint_violation');
    });
  });

  describe('applyDefaults', () => {
    const variables: TemplateVariable[] = [
      { name: 'withDefault', type: 'string', description: 'With default', required: false, default: 'default' },
      { name: 'withoutDefault', type: 'string', description: 'Without default', required: false },
      { name: 'provided', type: 'string', description: 'Provided', required: false, default: 'default' },
    ];

    it('should apply default values', () => {
      const values = {};
      const result = applyDefaults(variables, values);
      expect(result.withDefault).toBe('default');
      expect(result.withoutDefault).toBeUndefined();
    });

    it('should not override provided values', () => {
      const values = { provided: 'custom' };
      const result = applyDefaults(variables, values);
      expect(result.provided).toBe('custom');
    });
  });

  describe('renderTemplate', () => {
    it('should substitute simple variables', () => {
      const template = 'Hello {{name}}!';
      const values = { name: 'World' };
      const result = renderTemplate(template, values);
      expect(result).toBe('Hello World!');
    });

    it('should handle missing variables', () => {
      const template = 'Hello {{name}}!';
      const values = {};
      const result = renderTemplate(template, values);
      expect(result).toBe('Hello !');
    });

    it('should handle {{#if}} blocks', () => {
      const template = '{{#if show}}Visible{{/if}}';
      expect(renderTemplate(template, { show: true })).toBe('Visible');
      expect(renderTemplate(template, { show: false })).toBe('');
      expect(renderTemplate(template, {})).toBe('');
    });

    it('should handle {{#each}} blocks with arrays', () => {
      const template = '{{#each items}}- {{this}}\n{{/each}}';
      const values = { items: ['a', 'b', 'c'] };
      const result = renderTemplate(template, values);
      expect(result).toBe('- a\n- b\n- c\n');
    });

    it('should handle {{#each}} with object arrays', () => {
      const template = '{{#each items}}{{this.name}}: {{this.value}}\n{{/each}}';
      const values = { items: [{ name: 'foo', value: 'bar' }] };
      const result = renderTemplate(template, values);
      expect(result).toBe('foo: bar\n');
    });

    it('should handle empty arrays in {{#each}}', () => {
      const template = '{{#each items}}content{{/each}}';
      const values = { items: [] };
      const result = renderTemplate(template, values);
      expect(result).toBe('');
    });
  });

  describe('injectContext', () => {
    const variables: TemplateVariable[] = [
      { name: 'task', type: 'string', description: 'Task', required: true },
      { name: 'name', type: 'string', description: 'Name', required: false },
    ];

    const context: InjectedContext = {
      task: 'Test task',
      project: { name: 'Test Project', path: '/test' },
    };

    it('should inject context into template', () => {
      const template = 'Task: {{task}}';
      const result = injectContext(template, variables, context);
      expect(result.result).toBe('Task: Test task');
      expect(result.validation.valid).toBe(true);
    });

    it('should include custom values', () => {
      const template = 'Task: {{task}}, Name: {{name}}';
      const result = injectContext(template, variables, context, { name: 'Test' });
      expect(result.result).toBe('Task: Test task, Name: Test');
    });

    it('should validate when requested', () => {
      const template = 'Task: {{task}}';
      const vars: TemplateVariable[] = [
        { name: 'task', type: 'string', description: 'Task', required: true },
      ];
      const ctx: InjectedContext = { task: 'test' };
      const result = injectContext(template, vars, ctx, {}, { validate: true });
      expect(result.validation.valid).toBe(true);
    });

    it('should throw in strict mode with validation errors', () => {
      const template = 'Task: {{task}}';
      const vars: TemplateVariable[] = [
        { name: 'task', type: 'string', description: 'Task', required: true },
      ];
      const ctx: InjectedContext = { task: undefined as unknown as string };
      expect(() => injectContext(template, vars, ctx, {}, { validate: true, strict: true })).toThrow();
    });
  });

  describe('enrichContext', () => {
    it('should add timestamp enricher', () => {
      const context: InjectedContext = { task: 'test' };
      const enriched = enrichContext(context, [contextEnrichers.timestamp]);
      expect(enriched.custom?.timestamp).toBeDefined();
      expect(enriched.custom?.date).toBeDefined();
    });

    it('should add code stats enricher', () => {
      const context: InjectedContext = {
        task: 'test',
        code: {
          snippets: [
            { file: 'test.ts', lines: { start: 1, end: 10 }, content: '', language: 'ts', relevance: 0.9 },
            { file: 'test2.ts', lines: { start: 1, end: 5 }, content: '', language: 'ts', relevance: 0.8 },
          ],
        },
      };
      const enriched = enrichContext(context, [contextEnrichers.codeStats]);
      expect(enriched.custom?.codeSnippetCount).toBe(2);
      expect(enriched.custom?.totalLinesOfCode).toBe(15);
    });

    it('should add history summary enricher', () => {
      const context: InjectedContext = {
        task: 'test',
        history: {
          previousAttempts: ['attempt1', 'attempt2'],
          errors: ['error1'],
        },
      };
      const enriched = enrichContext(context, [contextEnrichers.historySummary]);
      expect(enriched.custom?.hasPreviousAttempts).toBe(true);
      expect(enriched.custom?.previousAttemptCount).toBe(2);
      expect(enriched.custom?.hasErrors).toBe(true);
      expect(enriched.custom?.errorCount).toBe(1);
    });

    it('should apply multiple enrichers', () => {
      const context: InjectedContext = { task: 'test' };
      const enriched = enrichContext(context, [
        contextEnrichers.timestamp,
        contextEnrichers.historySummary,
      ]);
      expect(enriched.custom?.timestamp).toBeDefined();
      expect(enriched.custom?.hasPreviousAttempts).toBeDefined();
    });
  });

  describe('formatCodeSnippet', () => {
    it('should format code snippet correctly', () => {
      const snippet: CodeSnippet = {
        file: 'src/test.ts',
        lines: { start: 10, end: 20 },
        content: 'const x = 1;',
        language: 'typescript',
        relevance: 0.95,
      };
      const result = formatCodeSnippet(snippet);
      expect(result).toContain('src/test.ts');
      expect(result).toContain('lines 10-20');
      expect(result).toContain('95%');
      expect(result).toContain('```typescript');
      expect(result).toContain('const x = 1;');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      // 40 chars / 4 chars per token = 10 tokens
      expect(estimateTokens('a'.repeat(40))).toBe(10);
    });

    it('should use custom chars per token', () => {
      // 30 chars / 3 chars per token = 10 tokens
      expect(estimateTokens('a'.repeat(30), 3)).toBe(10);
    });

    it('should round up', () => {
      expect(estimateTokens('abc')).toBe(1);
    });
  });

  describe('truncateForTokens', () => {
    it('should not truncate short content', () => {
      const content = 'Short content';
      const result = truncateForTokens(content, 100);
      expect(result).toBe(content);
    });

    it('should truncate long content', () => {
      const content = 'a'.repeat(1000);
      const result = truncateForTokens(content, 100);
      expect(result.length).toBeLessThan(content.length);
      expect(result).toContain('[... content truncated');
    });

    it('should include both head and tail', () => {
      const content = 'HEAD' + 'a'.repeat(1000) + 'TAIL';
      const result = truncateForTokens(content, 50);
      expect(result).toContain('HEAD');
      expect(result).toContain('TAIL');
      expect(result).toContain('[... content truncated');
    });
  });
});
