/**
 * Must-Have Criteria Definition and Validation
 *
 * Provides validators for each must-have type (existence, value, structure, relation)
 * and utilities for checking criteria against actual state.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  type MustHave,
  type MustHaveType,
  type MustHaveResult,
  type MustHaveStatus,
  type ValueOperator,
  type CreateMustHaveOptions,
} from './types';

// ============================================================================
// Must-Have Factory
// ============================================================================

let mustHaveIdCounter = 0;

/**
 * Generate a unique must-have ID
 */
export function generateMustHaveId(): string {
  return `mh-${Date.now()}-${++mustHaveIdCounter}`;
}

/**
 * Factory function to create must-have criteria
 */
export function createMustHave(options: CreateMustHaveOptions): MustHave {
  return {
    id: generateMustHaveId(),
    description: options.description,
    type: options.type,
    status: 'pending',
    target: options.target,
    expected: options.expected,
    operator: options.operator,
    relatedTarget: options.relatedTarget,
    relationType: options.relationType,
    required: options.required ?? true,
    weight: options.weight ?? 1.0,
    validator: options.validator,
    errorMessage: options.errorMessage,
    createdAt: new Date(),
  };
}

// ============================================================================
// Type-Specific Must-Have Creators
// ============================================================================

/**
 * Create an existence-type must-have
 */
export function existenceMustHave(
  target: string,
  description: string,
  options: Omit<CreateMustHaveOptions, 'type' | 'target' | 'description'> = {}
): MustHave {
  return createMustHave({
    type: 'existence',
    target,
    description,
    ...options,
  });
}

/**
 * Create a value-type must-have
 */
export function valueMustHave(
  target: string,
  description: string,
  expected: unknown,
  operator: ValueOperator = 'equals',
  options: Omit<CreateMustHaveOptions, 'type' | 'target' | 'description' | 'expected' | 'operator'> = {}
): MustHave {
  return createMustHave({
    type: 'value',
    target,
    description,
    expected,
    operator,
    ...options,
  });
}

/**
 * Create a structure-type must-have
 */
export function structureMustHave(
  target: string,
  description: string,
  expected: unknown,
  options: Omit<CreateMustHaveOptions, 'type' | 'target' | 'description' | 'expected'> = {}
): MustHave {
  return createMustHave({
    type: 'structure',
    target,
    description,
    expected,
    ...options,
  });
}

/**
 * Create a relation-type must-have
 */
export function relationMustHave(
  target: string,
  relatedTarget: string,
  relationType: MustHave['relationType'],
  description: string,
  options: Omit<CreateMustHaveOptions, 'type' | 'target' | 'description' | 'relatedTarget' | 'relationType'> = {}
): MustHave {
  return createMustHave({
    type: 'relation',
    target,
    relatedTarget,
    relationType,
    description,
    ...options,
  });
}

// ============================================================================
// Value Operator Functions
// ============================================================================

/**
 * Apply a value operator to compare actual vs expected values
 */
export function applyOperator(
  actual: unknown,
  expected: unknown,
  operator: ValueOperator
): boolean {
  switch (operator) {
    case 'equals':
      return JSON.stringify(actual) === JSON.stringify(expected);

    case 'not_equals':
      return JSON.stringify(actual) !== JSON.stringify(expected);

    case 'contains':
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.includes(expected);
      }
      if (Array.isArray(actual)) {
        return actual.some(item =>
          JSON.stringify(item) === JSON.stringify(expected)
        );
      }
      return false;

    case 'starts_with':
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.startsWith(expected);
      }
      return false;

    case 'ends_with':
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.endsWith(expected);
      }
      return false;

    case 'matches_regex':
      if (typeof actual === 'string' && typeof expected === 'string') {
        try {
          const regex = new RegExp(expected);
          return regex.test(actual);
        } catch {
          return false;
        }
      }
      return false;

    case 'greater_than':
      if (typeof actual === 'number' && typeof expected === 'number') {
        return actual > expected;
      }
      return false;

    case 'less_than':
      if (typeof actual === 'number' && typeof expected === 'number') {
        return actual < expected;
      }
      return false;

    case 'in_range':
      if (
        typeof actual === 'number' &&
        Array.isArray(expected) &&
        expected.length === 2 &&
        typeof expected[0] === 'number' &&
        typeof expected[1] === 'number'
      ) {
        return actual >= expected[0] && actual <= expected[1];
      }
      return false;

    case 'one_of':
      if (Array.isArray(expected)) {
        return expected.some(item =>
          JSON.stringify(item) === JSON.stringify(actual)
        );
      }
      return false;

    default:
      return false;
  }
}

// ============================================================================
// Validation Functions by Type
// ============================================================================

/**
 * Validate an existence-type must-have
 */
export async function validateExistence(
  mustHave: MustHave,
  workingDir: string = process.cwd()
): Promise<MustHaveResult> {
  const startTime = Date.now();
  const targetPath = path.resolve(workingDir, mustHave.target);

  try {
    await fs.access(targetPath);
    return {
      mustHaveId: mustHave.id,
      satisfied: true,
      actual: targetPath,
      checkedAt: new Date(),
      duration: Date.now() - startTime,
    };
  } catch {
    return {
      mustHaveId: mustHave.id,
      satisfied: false,
      actual: null,
      message: mustHave.errorMessage || `Target does not exist: ${mustHave.target}`,
      checkedAt: new Date(),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Validate a value-type must-have
 */
export async function validateValue(
  mustHave: MustHave,
  workingDir: string = process.cwd()
): Promise<MustHaveResult> {
  const startTime = Date.now();

  try {
    // Try to read the target as a file first
    const targetPath = path.resolve(workingDir, mustHave.target);
    let actual: unknown;

    try {
      const content = await fs.readFile(targetPath, 'utf-8');
      // Try to parse as JSON, otherwise use as string
      try {
        actual = JSON.parse(content);
      } catch {
        actual = content.trim();
      }
    } catch {
      // If not a file, treat target as an environment variable or direct value
      actual = process.env[mustHave.target] ?? mustHave.target;
    }

    const operator = mustHave.operator ?? 'equals';
    const satisfied = applyOperator(actual, mustHave.expected, operator);

    // Run custom validator if provided
    const customValid = mustHave.validator ? mustHave.validator(actual) : true;
    const finalSatisfied = satisfied && customValid;

    return {
      mustHaveId: mustHave.id,
      satisfied: finalSatisfied,
      actual,
      message: finalSatisfied
        ? undefined
        : mustHave.errorMessage ||
          `Expected ${JSON.stringify(mustHave.expected)} (${operator}), but got ${JSON.stringify(actual)}`,
      checkedAt: new Date(),
      duration: Date.now() - startTime,
      details: {
        operator,
        customValidatorPassed: customValid,
      },
    };
  } catch (error) {
    return {
      mustHaveId: mustHave.id,
      satisfied: false,
      message: mustHave.errorMessage ||
        `Error validating value: ${error instanceof Error ? error.message : String(error)}`,
      checkedAt: new Date(),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Validate a structure-type must-have
 */
export async function validateStructure(
  mustHave: MustHave,
  workingDir: string = process.cwd()
): Promise<MustHaveResult> {
  const startTime = Date.now();

  try {
    const targetPath = path.resolve(workingDir, mustHave.target);
    const content = await fs.readFile(targetPath, 'utf-8');

    let actual: unknown;
    try {
      actual = JSON.parse(content);
    } catch {
      actual = content;
    }

    const expected = mustHave.expected;
    let satisfied = false;
    let details: Record<string, unknown> = {};

    // Handle different expected structure types
    if (typeof expected === 'object' && expected !== null) {
      if (Array.isArray(expected)) {
        // Check if actual is an array with expected structure
        satisfied = Array.isArray(actual);
        details = { isArray: satisfied };
      } else {
        // Check if actual has expected properties
        const expectedKeys = Object.keys(expected);
        const actualKeys = typeof actual === 'object' && actual !== null
          ? Object.keys(actual)
          : [];
        const hasAllKeys = expectedKeys.every(key =>
          actualKeys.includes(key)
        );
        satisfied = hasAllKeys;
        details = {
          expectedKeys,
          actualKeys,
          missingKeys: expectedKeys.filter(key => !actualKeys.includes(key)),
        };
      }
    } else if (typeof expected === 'string') {
      // Treat expected as a pattern or schema name
      if (expected === 'array') {
        satisfied = Array.isArray(actual);
      } else if (expected === 'object') {
        satisfied = typeof actual === 'object' && actual !== null && !Array.isArray(actual);
      } else if (expected === 'string') {
        satisfied = typeof actual === 'string';
      } else if (expected === 'number') {
        satisfied = typeof actual === 'number';
      } else if (expected === 'boolean') {
        satisfied = typeof actual === 'boolean';
      } else {
        // Try as regex pattern
        try {
          const regex = new RegExp(expected);
          satisfied = regex.test(String(actual));
          details = { pattern: expected };
        } catch {
          satisfied = false;
        }
      }
    }

    // Run custom validator if provided
    const customValid = mustHave.validator ? mustHave.validator(actual) : true;
    const finalSatisfied = satisfied && customValid;

    return {
      mustHaveId: mustHave.id,
      satisfied: finalSatisfied,
      actual,
      message: finalSatisfied
        ? undefined
        : mustHave.errorMessage ||
          `Structure does not match expected: ${JSON.stringify(expected)}`,
      checkedAt: new Date(),
      duration: Date.now() - startTime,
      details: {
        ...details,
        customValidatorPassed: customValid,
      },
    };
  } catch (error) {
    return {
      mustHaveId: mustHave.id,
      satisfied: false,
      message: mustHave.errorMessage ||
        `Error validating structure: ${error instanceof Error ? error.message : String(error)}`,
      checkedAt: new Date(),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Validate a relation-type must-have
 */
export async function validateRelation(
  mustHave: MustHave,
  workingDir: string = process.cwd()
): Promise<MustHaveResult> {
  const startTime = Date.now();

  if (!mustHave.relatedTarget || !mustHave.relationType) {
    return {
      mustHaveId: mustHave.id,
      satisfied: false,
      message: 'Relation must-have requires relatedTarget and relationType',
      checkedAt: new Date(),
      duration: Date.now() - startTime,
    };
  }

  try {
    const targetPath = path.resolve(workingDir, mustHave.target);
    const relatedPath = path.resolve(workingDir, mustHave.relatedTarget);

    // Check if both files exist
    let targetExists = false;
    let relatedExists = false;

    try {
      await fs.access(targetPath);
      targetExists = true;
    } catch {
      targetExists = false;
    }

    try {
      await fs.access(relatedPath);
      relatedExists = true;
    } catch {
      relatedExists = false;
    }

    if (!targetExists || !relatedExists) {
      return {
        mustHaveId: mustHave.id,
        satisfied: false,
        actual: { targetExists, relatedExists },
        message: mustHave.errorMessage ||
          `Relation validation failed: target exists=${targetExists}, related exists=${relatedExists}`,
        checkedAt: new Date(),
        duration: Date.now() - startTime,
      };
    }

    // Read target content to check for references
    const targetContent = await fs.readFile(targetPath, 'utf-8');
    let satisfied = false;
    let details: Record<string, unknown> = {};

    switch (mustHave.relationType) {
      case 'depends_on':
        // Check if target imports/references related
        satisfied = targetContent.includes(mustHave.relatedTarget) ||
          targetContent.includes(path.basename(mustHave.relatedTarget, path.extname(mustHave.relatedTarget)));
        details = { checkType: 'import/reference' };
        break;

      case 'references':
        // Check if target mentions related
        satisfied = targetContent.includes(path.basename(mustHave.relatedTarget));
        details = { checkType: 'mention' };
        break;

      case 'contains':
        // For this case, check if target file contains content from related
        try {
          const relatedContent = await fs.readFile(relatedPath, 'utf-8');
          satisfied = targetContent.includes(relatedContent.substring(0, 100));
          details = { checkType: 'content inclusion' };
        } catch {
          satisfied = false;
        }
        break;

      case 'extends':
        // Check for inheritance/extension patterns
        const relatedName = path.basename(mustHave.relatedTarget, path.extname(mustHave.relatedTarget));
        satisfied =
          targetContent.includes(`extends ${relatedName}`) ||
          targetContent.includes(`implements ${relatedName}`) ||
          targetContent.includes(`: ${relatedName}`);
        details = { checkType: 'inheritance' };
        break;

      default:
        satisfied = false;
    }

    // Run custom validator if provided
    const customValid = mustHave.validator ? mustHave.validator(targetContent) : true;
    const finalSatisfied = satisfied && customValid;

    return {
      mustHaveId: mustHave.id,
      satisfied: finalSatisfied,
      actual: { targetExists, relatedExists, relationType: mustHave.relationType },
      message: finalSatisfied
        ? undefined
        : mustHave.errorMessage ||
          `Relation '${mustHave.relationType}' not found between ${mustHave.target} and ${mustHave.relatedTarget}`,
      checkedAt: new Date(),
      duration: Date.now() - startTime,
      details: {
        ...details,
        customValidatorPassed: customValid,
      },
    };
  } catch (error) {
    return {
      mustHaveId: mustHave.id,
      satisfied: false,
      message: mustHave.errorMessage ||
        `Error validating relation: ${error instanceof Error ? error.message : String(error)}`,
      checkedAt: new Date(),
      duration: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Main Validation Dispatcher
// ============================================================================

/**
 * Validate a must-have criterion based on its type
 */
export async function validateMustHave(
  mustHave: MustHave,
  workingDir: string = process.cwd()
): Promise<MustHaveResult> {
  // Update status to checking
  mustHave.status = 'checking';

  let result: MustHaveResult;

  switch (mustHave.type) {
    case 'existence':
      result = await validateExistence(mustHave, workingDir);
      break;
    case 'value':
      result = await validateValue(mustHave, workingDir);
      break;
    case 'structure':
      result = await validateStructure(mustHave, workingDir);
      break;
    case 'relation':
      result = await validateRelation(mustHave, workingDir);
      break;
    default:
      result = {
        mustHaveId: mustHave.id,
        satisfied: false,
        message: `Unknown must-have type: ${mustHave.type}`,
        checkedAt: new Date(),
        duration: 0,
      };
  }

  // Update must-have status based on result
  mustHave.status = result.satisfied ? 'satisfied' : 'failed';
  mustHave.lastCheckedAt = new Date();
  mustHave.lastResult = result;

  return result;
}

// ============================================================================
// Batch Validation
// ============================================================================

/**
 * Validate multiple must-haves in parallel
 */
export async function validateMustHaves(
  mustHaves: MustHave[],
  workingDir: string = process.cwd()
): Promise<MustHaveResult[]> {
  const promises = mustHaves.map(mh => validateMustHave(mh, workingDir));
  return Promise.all(promises);
}

/**
 * Filter must-haves by type
 */
export function filterByType(
  mustHaves: MustHave[],
  type: MustHaveType
): MustHave[] {
  return mustHaves.filter(mh => mh.type === type);
}

/**
 * Get all required must-haves
 */
export function getRequiredMustHaves(mustHaves: MustHave[]): MustHave[] {
  return mustHaves.filter(mh => mh.required);
}

/**
 * Get all optional must-haves
 */
export function getOptionalMustHaves(mustHaves: MustHave[]): MustHave[] {
  return mustHaves.filter(mh => !mh.required);
}

/**
 * Calculate weighted satisfaction score
 */
export function calculateWeightedSatisfaction(
  mustHaves: MustHave[]
): { score: number; total: number; percentage: number } {
  const total = mustHaves.reduce((sum, mh) => sum + mh.weight, 0);
  const satisfied = mustHaves
    .filter(mh => mh.status === 'satisfied')
    .reduce((sum, mh) => sum + mh.weight, 0);

  return {
    score: satisfied,
    total,
    percentage: total > 0 ? (satisfied / total) * 100 : 100,
  };
}

/**
 * Reset all must-have statuses to pending
 */
export function resetMustHaves(mustHaves: MustHave[]): void {
  for (const mh of mustHaves) {
    mh.status = 'pending';
    mh.lastCheckedAt = undefined;
    mh.lastResult = undefined;
  }
}
