/**
 * SchemaValidator unit tests
 *
 * Tests for JSON Schema compatibility validation between skill outputs and inputs.
 */

import { SchemaValidator, ValidationResult } from '../../../../src/agents/builder/schema-validator';
import { SkillMetadata } from '../../../../src/skills/types/skill';

describe('SchemaValidator', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  describe('validateChain', () => {
    it('returns valid=true for compatible schemas (output has all required input fields)', () => {
      const skills: SkillMetadata[] = [
        {
          name: 'skill-a',
          description: 'First skill',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          schema: {
            input: { type: 'object', properties: { input: { type: 'string' } } },
            output: {
              type: 'object',
              properties: { result: { type: 'string' }, count: { type: 'number' } },
              required: ['result'],
            },
          },
        },
        {
          name: 'skill-b',
          description: 'Second skill',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          schema: {
            input: {
              type: 'object',
              properties: { result: { type: 'string' } },
              required: ['result'],
            },
            output: { type: 'object', properties: {} },
          },
        },
      ];

      const result: ValidationResult = validator.validateChain(skills);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid=false when input requires field missing from output', () => {
      const skills: SkillMetadata[] = [
        {
          name: 'skill-a',
          description: 'First skill',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          schema: {
            input: { type: 'object', properties: {} },
            output: {
              type: 'object',
              properties: { result: { type: 'string' } },
            },
          },
        },
        {
          name: 'skill-b',
          description: 'Second skill',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          schema: {
            input: {
              type: 'object',
              properties: { requiredField: { type: 'string' } },
              required: ['requiredField'],
            },
            output: { type: 'object', properties: {} },
          },
        },
      ];

      const result: ValidationResult = validator.validateChain(skills);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('requiredField');
    });

    it('returns valid=false for type mismatches (string vs number)', () => {
      const skills: SkillMetadata[] = [
        {
          name: 'skill-a',
          description: 'First skill',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          schema: {
            input: { type: 'object', properties: {} },
            output: {
              type: 'object',
              properties: { value: { type: 'string' } },
            },
          },
        },
        {
          name: 'skill-b',
          description: 'Second skill',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          schema: {
            input: {
              type: 'object',
              properties: { value: { type: 'number' } },
              required: ['value'],
            },
            output: { type: 'object', properties: {} },
          },
        },
      ];

      const result: ValidationResult = validator.validateChain(skills);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('value');
    });

    it('returns warnings when schemas are missing (optional schemas)', () => {
      const skills: SkillMetadata[] = [
        {
          name: 'skill-a',
          description: 'First skill without schema',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'skill-b',
          description: 'Second skill',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          schema: {
            input: { type: 'object', properties: {} },
            output: { type: 'object', properties: {} },
          },
        },
      ];

      const result: ValidationResult = validator.validateChain(skills);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('skill-a');
    });

    it('handles multiple skills in sequence, checking each adjacent pair', () => {
      const skills: SkillMetadata[] = [
        {
          name: 'skill-a',
          description: 'First skill',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          schema: {
            input: { type: 'object', properties: {} },
            output: {
              type: 'object',
              properties: { intermediate: { type: 'string' } },
              required: ['intermediate'],
            },
          },
        },
        {
          name: 'skill-b',
          description: 'Second skill',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          schema: {
            input: {
              type: 'object',
              properties: { intermediate: { type: 'string' } },
              required: ['intermediate'],
            },
            output: {
              type: 'object',
              properties: { final: { type: 'number' } },
              required: ['final'],
            },
          },
        },
        {
          name: 'skill-c',
          description: 'Third skill',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          schema: {
            input: {
              type: 'object',
              properties: { final: { type: 'number' } },
              required: ['final'],
            },
            output: { type: 'object', properties: {} },
          },
        },
      ];

      const result: ValidationResult = validator.validateChain(skills);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accumulates all errors before returning (does not fail fast)', () => {
      const skills: SkillMetadata[] = [
        {
          name: 'skill-a',
          description: 'First skill',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          schema: {
            input: { type: 'object', properties: {} },
            output: {
              type: 'object',
              properties: { field1: { type: 'string' } },
            },
          },
        },
        {
          name: 'skill-b',
          description: 'Second skill',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          schema: {
            input: {
              type: 'object',
              properties: {
                field1: { type: 'number' },
                field2: { type: 'boolean' },
              },
              required: ['field1', 'field2'],
            },
            output: { type: 'object', properties: {} },
          },
        },
      ];

      const result: ValidationResult = validator.validateChain(skills);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('handles empty skills array', () => {
      const result: ValidationResult = validator.validateChain([]);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('handles single skill (no compatibility check needed)', () => {
      const skills: SkillMetadata[] = [
        {
          name: 'skill-a',
          description: 'Only skill',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          schema: {
            input: { type: 'object', properties: {} },
            output: { type: 'object', properties: {} },
          },
        },
      ];

      const result: ValidationResult = validator.validateChain(skills);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('allows number type to accept integer type (type coercion)', () => {
      const skills: SkillMetadata[] = [
        {
          name: 'skill-a',
          description: 'First skill',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          schema: {
            input: { type: 'object', properties: {} },
            output: {
              type: 'object',
              properties: { count: { type: 'integer' } },
              required: ['count'],
            },
          },
        },
        {
          name: 'skill-b',
          description: 'Second skill',
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          schema: {
            input: {
              type: 'object',
              properties: { count: { type: 'number' } },
              required: ['count'],
            },
            output: { type: 'object', properties: {} },
          },
        },
      ];

      const result: ValidationResult = validator.validateChain(skills);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
