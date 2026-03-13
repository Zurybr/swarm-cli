/**
 * Plan Schema Parser
 * 
 * Parsea y valida el frontmatter YAML de PLAN.md
 * Incluye validación del schema must_haves
 */

import * as yaml from 'js-yaml';
import { z } from 'zod';
import type {
  MustHaves,
  Truth,
  Artifact,
  KeyLink,
} from '../types/verification-schema';

// ============================================================================
// Zod Schemas para validación
// ============================================================================

/**
 * Schema Zod para Truth
 */
export const TruthSchema = z.object({
  description: z.string().min(1, 'Truth description cannot be empty'),
});

/**
 * Schema Zod para Artifact
 */
export const ArtifactSchema = z.object({
  path: z.string().min(1, 'Artifact path cannot be empty'),
  provides: z.string().min(1, 'Artifact must specify what it provides'),
  min_lines: z.number().int().positive().optional(),
  exports: z.array(z.string()).optional(),
  contains: z.string().optional(),
});

/**
 * Schema Zod para KeyLink
 */
export const KeyLinkSchema = z.object({
  from: z.string().min(1, 'KeyLink must specify source'),
  to: z.string().min(1, 'KeyLink must specify target'),
  via: z.string().min(1, 'KeyLink must specify connection method'),
  pattern: z.string().min(1, 'KeyLink must specify verification pattern'),
});

/**
 * Schema Zod completo para MustHaves
 */
export const MustHavesSchema = z.object({
  truths: z.array(TruthSchema).default([]),
  artifacts: z.array(ArtifactSchema).default([]),
  key_links: z.array(KeyLinkSchema).default([]),
});

/**
 * Schema extendido para PLAN.md completo
 */
export const PlanFrontmatterSchema = z.object({
  phase: z.string().optional(),
  plan: z.string().optional(),
  type: z.enum(['plan', 'execute', 'verify']).optional(),
  wave: z.number().int().positive().optional(),
  depends_on: z.array(z.string()).default([]),
  must_haves: MustHavesSchema.optional(),
});

// ============================================================================
// TypeScript Types derivados de Zod
// ============================================================================

export type ValidatedMustHaves = z.infer<typeof MustHavesSchema>;
export type ValidatedPlanFrontmatter = z.infer<typeof PlanFrontmatterSchema>;

// ============================================================================
// Funciones de parseo
// ============================================================================

/**
 * Parsea un string YAML de must_haves
 * @param yamlString - String YAML con la sección must_haves
 * @returns MustHaves validado
 * @throws Error si el YAML es inválido
 */
export function parseMustHaves(yamlString: string): MustHaves {
  try {
    const parsed = yaml.load(yamlString);
    const validated = MustHavesSchema.parse(parsed);
    return validated as MustHaves;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new Error(`Invalid must_haves schema: ${issues}`);
    }
    if (error instanceof Error && error.name === 'YAMLException') {
      throw new Error(`Invalid YAML syntax: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Extrae y parsea must_haves del frontmatter de un PLAN.md
 * @param frontmatter - String con el frontmatter YAML
 * @returns MustHaves o null si no existe
 */
export function extractMustHaves(frontmatter: string): MustHaves | null {
  try {
    const parsed = yaml.load(frontmatter);
    const validated = PlanFrontmatterSchema.parse(parsed);
    return validated.must_haves || null;
  } catch (error) {
    return null;
  }
}

/**
 * Valida si un objeto cumple con el schema MustHaves
 * @param obj - Objeto a validar
 * @returns Resultado de validación
 */
export function validateMustHaves(obj: unknown): {
  valid: boolean;
  errors: string[];
  data?: MustHaves;
} {
  const result = MustHavesSchema.safeParse(obj);
  
  if (result.success) {
    return {
      valid: true,
      errors: [],
      data: result.data as MustHaves,
    };
  }
  
  return {
    valid: false,
    errors: result.error.issues.map(i => 
      `${i.path.join('.')}: ${i.message}`
    ),
  };
}

/**
 * Parsea el frontmatter completo de un PLAN.md
 * @param frontmatter - String con el frontmatter YAML
 * @returns PlanFrontmatter validado
 */
export function parsePlanFrontmatter(frontmatter: string): ValidatedPlanFrontmatter {
  try {
    const parsed = yaml.load(frontmatter);
    return PlanFrontmatterSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new Error(`Invalid PLAN.md frontmatter: ${issues}`);
    }
    throw error;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Genera un ejemplo de must_haves para documentación
 */
export function generateMustHavesExample(): MustHaves {
  return {
    truths: [
      { description: 'User can see existing messages' },
      { description: 'User can send a message' },
      { description: 'Messages persist across refresh' },
    ],
    artifacts: [
      {
        path: 'src/components/Chat.tsx',
        provides: 'Message list rendering with scrollback',
        min_lines: 50,
        exports: ['Chat', 'ChatProps'],
        contains: 'export function Chat',
      },
      {
        path: 'src/app/api/chat/route.ts',
        provides: 'Message CRUD operations',
        min_lines: 100,
        exports: ['GET', 'POST'],
        contains: 'prisma.message',
      },
    ],
    key_links: [
      {
        from: 'src/components/Chat.tsx',
        to: '/api/chat',
        via: 'fetch in useEffect',
        pattern: 'fetch.*api/chat',
      },
      {
        from: 'src/app/api/chat/route.ts',
        to: 'prisma.message',
        via: 'database query',
        pattern: 'prisma\\.message\\.(find|create)',
      },
    ],
  };
}

/**
 * Serializa must_haves a YAML
 * @param mustHaves - Objeto MustHaves
 * @returns String YAML
 */
export function serializeMustHaves(mustHaves: MustHaves): string {
  return yaml.dump(mustHaves, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
}

// Export default
export default {
  parseMustHaves,
  extractMustHaves,
  validateMustHaves,
  parsePlanFrontmatter,
  generateMustHavesExample,
  serializeMustHaves,
};
