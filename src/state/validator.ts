/**
 * STATE.md Validator
 *
 * Validates STATE.md structure against schema.
 * Ensures data integrity and consistency.
 */

import {
  State,
  StateItem,
  StateFrontmatter,
  ValidationResult,
  ValidationIssue,
  ValidationSeverity,
  StateSectionType,
  CellStatus,
  CellType,
  StateVersion,
  StatePriority,
} from './types';

/**
 * Valid state versions
 */
const VALID_VERSIONS: StateVersion[] = ['1.0'];

/**
 * Valid cell statuses
 */
const VALID_STATUSES: CellStatus[] = ['open', 'in_progress', 'completed', 'blocked', 'cancelled'];

/**
 * Valid cell types
 */
const VALID_TYPES: CellType[] = ['epic', 'task', 'subtask', 'bug', 'feature', 'research'];

/**
 * Valid section types
 */
const VALID_SECTION_TYPES: StateSectionType[] = [
  'overview', 'active', 'completed', 'blocked', 'backlog', 'metadata', 'custom'
];

/**
 * Valid priority levels
 */
const VALID_PRIORITIES: StatePriority[] = ['critical', 'high', 'medium', 'low'];

/**
 * Validation options
 */
export interface ValidatorOptions {
  /** Require all optional fields */
  strict?: boolean;
  /** Allow unknown metadata fields */
  allowUnknownMetadata?: boolean;
  /** Validate ID format */
  validateIdFormat?: boolean;
  /** Check for duplicate IDs */
  checkDuplicates?: boolean;
}

/**
 * Default validator options
 */
const DEFAULT_OPTIONS: ValidatorOptions = {
  strict: false,
  allowUnknownMetadata: true,
  validateIdFormat: true,
  checkDuplicates: true,
};

/**
 * Validate a complete State object
 */
export function validateState(state: State, options: ValidatorOptions = {}): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const issues: ValidationIssue[] = [];

  // Validate frontmatter
  issues.push(...validateFrontmatter(state.frontmatter, opts));

  // Validate sections
  issues.push(...validateSections(state.sections, opts));

  // Check for duplicate IDs across all sections
  if (opts.checkDuplicates) {
    issues.push(...checkDuplicateIds(state));
  }

  // Calculate counts
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  return {
    valid: errorCount === 0,
    issues,
    errorCount,
    warningCount,
    infoCount,
  };
}

/**
 * Validate frontmatter
 */
function validateFrontmatter(frontmatter: StateFrontmatter, options: ValidatorOptions): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Version validation
  if (!frontmatter.version) {
    issues.push({
      severity: 'error',
      message: 'Missing required field: version',
      path: 'frontmatter.version',
      suggestion: 'Add version: "1.0" to frontmatter',
    });
  } else if (!VALID_VERSIONS.includes(frontmatter.version)) {
    issues.push({
      severity: 'error',
      message: `Invalid version: "${frontmatter.version}". Must be one of: ${VALID_VERSIONS.join(', ')}`,
      path: 'frontmatter.version',
      suggestion: 'Use version: "1.0"',
    });
  }

  // Project validation
  if (!frontmatter.project) {
    issues.push({
      severity: 'error',
      message: 'Missing required field: project',
      path: 'frontmatter.project',
      suggestion: 'Add project: "your-project-name" to frontmatter',
    });
  } else if (typeof frontmatter.project !== 'string') {
    issues.push({
      severity: 'error',
      message: 'Project must be a string',
      path: 'frontmatter.project',
    });
  } else if (frontmatter.project.length < 1) {
    issues.push({
      severity: 'error',
      message: 'Project name cannot be empty',
      path: 'frontmatter.project',
    });
  }

  // Last sync validation (optional but should be valid if present)
  if (frontmatter.lastSync) {
    const syncDate = new Date(frontmatter.lastSync);
    if (isNaN(syncDate.getTime())) {
      issues.push({
        severity: 'warning',
        message: 'Invalid lastSync timestamp',
        path: 'frontmatter.lastSync',
        suggestion: 'Use ISO 8601 format (e.g., 2024-01-15T10:30:00Z)',
      });
    }
  }

  // Metadata validation
  if (frontmatter.metadata && typeof frontmatter.metadata !== 'object') {
    issues.push({
      severity: 'warning',
      message: 'Metadata should be an object',
      path: 'frontmatter.metadata',
    });
  }

  return issues;
}

/**
 * Validate sections
 */
function validateSections(sections: Array<{ type: StateSectionType; items: StateItem[] }>, options: ValidatorOptions): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!Array.isArray(sections)) {
    issues.push({
      severity: 'error',
      message: 'Sections must be an array',
      path: 'sections',
    });
    return issues;
  }

  if (sections.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'No sections defined in state',
      path: 'sections',
      suggestion: 'Add at least one section (e.g., ## Backlog)',
    });
  }

  sections.forEach((section, sectionIndex) => {
    // Validate section type
    if (!section.type) {
      issues.push({
        severity: 'error',
        message: `Section ${sectionIndex} is missing type`,
        path: `sections[${sectionIndex}].type`,
      });
    } else if (!VALID_SECTION_TYPES.includes(section.type)) {
      issues.push({
        severity: 'warning',
        message: `Unknown section type: "${section.type}"`,
        path: `sections[${sectionIndex}].type`,
        suggestion: `Use one of: ${VALID_SECTION_TYPES.join(', ')}`,
      });
    }

    // Validate items
    if (!Array.isArray(section.items)) {
      issues.push({
        severity: 'error',
        message: `Section ${sectionIndex} items must be an array`,
        path: `sections[${sectionIndex}].items`,
      });
    } else {
      section.items.forEach((item, itemIndex) => {
        issues.push(...validateItem(item, `sections[${sectionIndex}].items[${itemIndex}]`, options));
      });
    }
  });

  return issues;
}

/**
 * Validate a single item
 */
function validateItem(item: StateItem, path: string, options: ValidatorOptions): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // ID validation
  if (!item.id) {
    issues.push({
      severity: 'error',
      message: 'Item is missing ID',
      path: `${path}.id`,
      suggestion: 'Add a unique ID to the item',
    });
  } else if (options.validateIdFormat) {
    const idValid = validateIdFormat(item.id);
    if (!idValid.valid) {
      issues.push({
        severity: 'warning',
        message: `Invalid ID format: ${idValid.reason}`,
        path: `${path}.id`,
        suggestion: 'Use format: type-timestamp-random (e.g., task-abc123-def45)',
      });
    }
  }

  // Title validation
  if (!item.title) {
    issues.push({
      severity: 'error',
      message: 'Item is missing title',
      path: `${path}.title`,
      suggestion: 'Add a descriptive title to the item',
    });
  } else if (item.title.length < 3) {
    issues.push({
      severity: 'warning',
      message: 'Title is very short (less than 3 characters)',
      path: `${path}.title`,
      suggestion: 'Use a more descriptive title',
    });
  }

  // Status validation
  if (!item.status) {
    issues.push({
      severity: 'error',
      message: 'Item is missing status',
      path: `${path}.status`,
      suggestion: `Use one of: ${VALID_STATUSES.join(', ')}`,
    });
  } else if (!VALID_STATUSES.includes(item.status)) {
    issues.push({
      severity: 'error',
      message: `Invalid status: "${item.status}"`,
      path: `${path}.status`,
      suggestion: `Use one of: ${VALID_STATUSES.join(', ')}`,
    });
  }

  // Type validation (optional)
  if (item.type !== undefined && !VALID_TYPES.includes(item.type)) {
    issues.push({
      severity: 'warning',
      message: `Invalid type: "${item.type}"`,
      path: `${path}.type`,
      suggestion: `Use one of: ${VALID_TYPES.join(', ')}`,
    });
  }

  // Priority validation (optional)
  if (item.priority !== undefined && !VALID_PRIORITIES.includes(item.priority)) {
    issues.push({
      severity: 'warning',
      message: `Invalid priority: "${item.priority}"`,
      path: `${path}.priority`,
      suggestion: `Use one of: ${VALID_PRIORITIES.join(', ')}`,
    });
  }

  // Date validations
  if (item.createdAt) {
    const created = new Date(item.createdAt);
    if (isNaN(created.getTime())) {
      issues.push({
        severity: 'warning',
        message: 'Invalid createdAt timestamp',
        path: `${path}.createdAt`,
        suggestion: 'Use ISO 8601 format',
      });
    }
  }

  if (item.updatedAt) {
    const updated = new Date(item.updatedAt);
    if (isNaN(updated.getTime())) {
      issues.push({
        severity: 'warning',
        message: 'Invalid updatedAt timestamp',
        path: `${path}.updatedAt`,
        suggestion: 'Use ISO 8601 format',
      });
    }
  }

  if (item.completedAt) {
    const completed = new Date(item.completedAt);
    if (isNaN(completed.getTime())) {
      issues.push({
        severity: 'warning',
        message: 'Invalid completedAt timestamp',
        path: `${path}.completedAt`,
        suggestion: 'Use ISO 8601 format',
      });
    }

    // If completedAt is set, status should be completed
    if (item.status !== 'completed') {
      issues.push({
        severity: 'warning',
        message: 'Item has completedAt but status is not "completed"',
        path: `${path}.completedAt`,
        suggestion: 'Set status to "completed" or remove completedAt',
      });
    }
  }

  // Blocked reason validation
  if (item.blockedReason && item.status !== 'blocked') {
    issues.push({
      severity: 'info',
      message: 'Item has blockedReason but status is not "blocked"',
      path: `${path}.blockedReason`,
      suggestion: 'Set status to "blocked" or remove blockedReason',
    });
  }

  // Tags validation
  if (item.tags) {
    if (!Array.isArray(item.tags)) {
      issues.push({
        severity: 'error',
        message: 'Tags must be an array',
        path: `${path}.tags`,
      });
    } else {
      item.tags.forEach((tag, tagIndex) => {
        if (typeof tag !== 'string') {
          issues.push({
            severity: 'error',
            message: `Tag at index ${tagIndex} must be a string`,
            path: `${path}.tags[${tagIndex}]`,
          });
        }
      });
    }
  }

  // Metadata validation
  if (item.metadata && typeof item.metadata !== 'object') {
    issues.push({
      severity: 'warning',
      message: 'Metadata should be an object',
      path: `${path}.metadata`,
    });
  }

  // Notes validation
  if (item.notes) {
    if (!Array.isArray(item.notes)) {
      issues.push({
        severity: 'error',
        message: 'Notes must be an array',
        path: `${path}.notes`,
      });
    } else {
      item.notes.forEach((note, noteIndex) => {
        if (typeof note !== 'string') {
          issues.push({
            severity: 'error',
            message: `Note at index ${noteIndex} must be a string`,
            path: `${path}.notes[${noteIndex}]`,
          });
        }
      });
    }
  }

  // Strict mode validations
  if (options.strict) {
    if (!item.type) {
      issues.push({
        severity: 'warning',
        message: 'Missing type (required in strict mode)',
        path: `${path}.type`,
        suggestion: `Use one of: ${VALID_TYPES.join(', ')}`,
      });
    }
    if (!item.priority) {
      issues.push({
        severity: 'warning',
        message: 'Missing priority (required in strict mode)',
        path: `${path}.priority`,
        suggestion: `Use one of: ${VALID_PRIORITIES.join(', ')}`,
      });
    }
    if (!item.createdAt) {
      issues.push({
        severity: 'warning',
        message: 'Missing createdAt (required in strict mode)',
        path: `${path}.createdAt`,
      });
    }
  }

  return issues;
}

/**
 * Validate ID format
 */
function validateIdFormat(id: string): { valid: boolean; reason?: string } {
  if (!id || typeof id !== 'string') {
    return { valid: false, reason: 'ID is empty' };
  }

  // Check for valid characters
  if (!/^[\w-]+$/.test(id)) {
    return { valid: false, reason: 'ID contains invalid characters (use only letters, numbers, underscores, and hyphens)' };
  }

  // Check length
  if (id.length < 3) {
    return { valid: false, reason: 'ID is too short (minimum 3 characters)' };
  }

  if (id.length > 100) {
    return { valid: false, reason: 'ID is too long (maximum 100 characters)' };
  }

  return { valid: true };
}

/**
 * Check for duplicate IDs across all sections
 */
function checkDuplicateIds(state: State): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenIds = new Map<string, string[]>();

  state.sections.forEach((section, sectionIndex) => {
    section.items.forEach((item, itemIndex) => {
      if (item.id) {
        const path = `sections[${sectionIndex}].items[${itemIndex}].id`;
        if (!seenIds.has(item.id)) {
          seenIds.set(item.id, [path]);
        } else {
          seenIds.get(item.id)!.push(path);
        }
      }
    });
  });

  seenIds.forEach((paths, id) => {
    if (paths.length > 1) {
      issues.push({
        severity: 'error',
        message: `Duplicate ID "${id}" found ${paths.length} times`,
        path: paths.join(', '),
        suggestion: 'Ensure each item has a unique ID',
      });
    }
  });

  return issues;
}

/**
 * Quick validation - returns true if valid, false otherwise
 */
export function isValid(state: State, options?: ValidatorOptions): boolean {
  return validateState(state, options).valid;
}

/**
 * Validate and throw on error
 */
export function validateOrThrow(state: State, options?: ValidatorOptions): void {
  const result = validateState(state, options);
  if (!result.valid) {
    const errors = result.issues.filter(i => i.severity === 'error');
    throw new Error(`State validation failed: ${errors.map(e => e.message).join(', ')}`);
  }
}

/**
 * Get validation summary as string
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push('✓ Validation passed');
  } else {
    lines.push(`✗ Validation failed: ${result.errorCount} error(s)`);
  }

  if (result.warningCount > 0) {
    lines.push(`⚠ ${result.warningCount} warning(s)`);
  }

  if (result.infoCount > 0) {
    lines.push(`ℹ ${result.infoCount} info(s)`);
  }

  if (result.issues.length > 0) {
    lines.push('');
    lines.push('Issues:');
    result.issues.forEach(issue => {
      const icon = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ';
      lines.push(`  ${icon} [${issue.severity.toUpperCase()}] ${issue.path}: ${issue.message}`);
      if (issue.suggestion) {
        lines.push(`    → ${issue.suggestion}`);
      }
    });
  }

  return lines.join('\n');
}
