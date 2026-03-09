/**
 * Skill metadata validation schemas
 *
 * Provides Zod schemas for validating skill metadata with strict rules.
 */

import { z } from 'zod';

/**
 * Skill schema validation for input/output JSON schemas
 */
export const SkillSchemaSchema = z.object({
  input: z.record(z.any()),
  output: z.record(z.any()),
});

/**
 * Skill metadata validation schema
 * Enforces naming conventions, version format, and field constraints
 */
export const SkillMetadataSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .regex(
      /^[a-z0-9-]+$/,
      'Name must be lowercase alphanumeric with hyphens only'
    ),

  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be 500 characters or less'),

  version: z
    .string()
    .regex(
      /^\d+\.\d+\.\d+$/,
      'Version must be semver format (e.g., 1.0.0)'
    ),

  category: z
    .enum(['security', 'performance', 'documentation', 'testing', 'general'])
    .optional(),

  tags: z.array(z.string()).optional(),

  schema: SkillSchemaSchema.optional(),

  author: z.string().optional(),

  createdAt: z.date(),

  updatedAt: z.date(),
});

/**
 * Inferred TypeScript type from SkillMetadataSchema
 */
export type SkillMetadata = z.infer<typeof SkillMetadataSchema>;

/**
 * Inferred TypeScript type from SkillSchemaSchema
 */
export type SkillSchema = z.infer<typeof SkillSchemaSchema>;

/**
 * Validates skill metadata against the schema
 * @param data - Raw data to validate
 * @returns Validated SkillMetadata
 * @throws ZodError if validation fails
 */
export function validateSkillMetadata(data: unknown): SkillMetadata {
  return SkillMetadataSchema.parse(data);
}

/**
 * Safely validates skill metadata without throwing
 * @param data - Raw data to validate
 * @returns Object with success flag and either data or error
 */
export function safeValidateSkillMetadata(
  data: unknown
): { success: true; data: SkillMetadata } | { success: false; error: z.ZodError } {
  const result = SkillMetadataSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}
