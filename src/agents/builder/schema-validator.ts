/**
 * Schema Validator
 *
 * Validates JSON Schema compatibility between skill outputs and inputs.
 * Uses AJV for schema validation with custom compatibility rules.
 */

import Ajv, { JSONSchemaType, SchemaObject } from 'ajv';
import addFormats from 'ajv-formats';
import { SkillMetadata } from '../../skills/types/skill';

/**
 * Validation result for schema compatibility checks
 */
export interface ValidationResult {
  /** Whether the schemas are compatible */
  valid: boolean;
  /** Array of error messages */
  errors: string[];
  /** Array of warning messages */
  warnings: string[];
}

/**
 * SchemaValidator checks compatibility between skill output and input schemas
 */
export class SchemaValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  /**
   * Validate a chain of skills for schema compatibility
   * Checks that each skill's output is compatible with the next skill's input
   *
   * @param skills - Array of skill metadata to validate
   * @returns ValidationResult with any errors or warnings
   */
  validateChain(skills: SkillMetadata[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Empty or single skill chains are always valid
    if (skills.length <= 1) {
      return { valid: true, errors, warnings };
    }

    // Check each adjacent pair of skills
    for (let i = 0; i < skills.length - 1; i++) {
      const currentSkill = skills[i];
      const nextSkill = skills[i + 1];

      const outputSchema = currentSkill.schema?.output;
      const inputSchema = nextSkill.schema?.input;

      // Handle missing schemas
      if (!currentSkill.schema) {
        warnings.push(
          `Skill "${currentSkill.name}" has no schema defined - cannot validate compatibility`
        );
        continue;
      }

      if (!nextSkill.schema) {
        warnings.push(
          `Skill "${nextSkill.name}" has no schema defined - cannot validate compatibility`
        );
        continue;
      }

      if (!outputSchema) {
        warnings.push(
          `Skill "${currentSkill.name}" has no output schema - cannot validate compatibility`
        );
        continue;
      }

      if (!inputSchema) {
        warnings.push(
          `Skill "${nextSkill.name}" has no input schema - cannot validate compatibility`
        );
        continue;
      }

      // Check compatibility between output and input
      const compatibilityErrors = this.checkCompatibility(
        outputSchema as Record<string, unknown>,
        inputSchema as Record<string, unknown>,
        currentSkill.name,
        nextSkill.name
      );

      errors.push(...compatibilityErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if an output schema is compatible with an input schema
   *
   * @param outputSchema - The output schema from the previous skill
   * @param inputSchema - The input schema for the next skill
   * @param fromSkill - Name of the source skill (for error messages)
   * @param toSkill - Name of the target skill (for error messages)
   * @returns Array of error messages (empty if compatible)
   */
  private checkCompatibility(
    outputSchema: Record<string, unknown>,
    inputSchema: Record<string, unknown>,
    fromSkill: string,
    toSkill: string
  ): string[] {
    const errors: string[] = [];

    // Get properties and required fields from schemas
    const outputProps = (outputSchema.properties || {}) as Record<
      string,
      unknown
    >;
    const inputProps = (inputSchema.properties || {}) as Record<
      string,
      unknown
    >;
    const inputRequired = ((inputSchema.required || []) as string[]);

    // Check each required input field exists in output
    for (const requiredField of inputRequired) {
      if (!(requiredField in outputProps)) {
        errors.push(
          `Skill "${toSkill}" requires field "${requiredField}" but "${fromSkill}" does not provide it`
        );
        continue;
      }

      // Check type compatibility
      const outputField = outputProps[requiredField] as Record<
        string,
        unknown
      >;
      const inputField = inputProps[requiredField] as Record<string, unknown>;

      const typeError = this.checkTypeCompatibility(
        inputField?.type as string | undefined,
        outputField?.type as string | undefined,
        requiredField,
        fromSkill,
        toSkill
      );

      if (typeError) {
        errors.push(typeError);
      }
    }

    // Check optional fields for type compatibility too
    for (const [fieldName, inputField] of Object.entries(inputProps)) {
      if (inputRequired.includes(fieldName)) continue; // Already checked

      if (fieldName in outputProps) {
        const outputField = outputProps[fieldName] as Record<
          string,
          unknown
        >;

        const typeError = this.checkTypeCompatibility(
          (inputField as Record<string, unknown>)?.type as string | undefined,
          outputField?.type as string | undefined,
          fieldName,
          fromSkill,
          toSkill
        );

        if (typeError) {
          errors.push(typeError);
        }
      }
    }

    return errors;
  }

  /**
   * Check if two types are compatible
   *
   * @param inputType - Expected input type
   * @param outputType - Provided output type
   * @param fieldName - Name of the field being checked
   * @param fromSkill - Source skill name
   * @param toSkill - Target skill name
   * @returns Error message if incompatible, undefined if compatible
   */
  private checkTypeCompatibility(
    inputType: string | undefined,
    outputType: string | undefined,
    fieldName: string,
    fromSkill: string,
    toSkill: string
  ): string | undefined {
    // If either type is undefined, we can't validate
    if (!inputType || !outputType) {
      return undefined;
    }

    // Same type is always compatible
    if (inputType === outputType) {
      return undefined;
    }

    // Type coercion rules
    // number accepts integer (integer is a subset of number)
    if (inputType === 'number' && outputType === 'integer') {
      return undefined;
    }

    // Any other combination is incompatible
    return `Type mismatch for field "${fieldName}": "${toSkill}" expects ${inputType} but "${fromSkill}" provides ${outputType}`;
  }
}
