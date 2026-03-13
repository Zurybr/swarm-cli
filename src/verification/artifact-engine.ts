/**
 * Artifact Verification Engine
 * 
 * Verifica artifacts (archivos) del schema must_haves
 * Issue #18 - Task #5.3
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  MustHaves,
  Artifact,
  ArtifactVerificationResult,
} from '../types/verification-schema';

/**
 * Opciones para verificación de artifacts
 */
export interface ArtifactVerificationOptions {
  /** Directorio de trabajo */
  workingDir?: string;
  /** Si se debe parsear AST para exports */
  parseAST?: boolean;
}

/**
 * Verifica todos los artifacts de un schema MustHaves
 * @param mustHaves - Schema con artifacts a verificar
 * @param options - Opciones de verificación
 * @returns Array de resultados de verificación
 */
export async function verifyArtifacts(
  mustHaves: MustHaves,
  options: ArtifactVerificationOptions = {}
): Promise<ArtifactVerificationResult[]> {
  const results: ArtifactVerificationResult[] = [];

  for (const artifact of mustHaves.artifacts) {
    const result = await verifyArtifact(artifact, options);
    results.push(result);
  }

  return results;
}

/**
 * Verifica un artifact individual
 * @param artifact - Artifact a verificar
 * @param options - Opciones de verificación
 * @returns Resultado de verificación
 */
async function verifyArtifact(
  artifact: Artifact,
  options: ArtifactVerificationOptions
): Promise<ArtifactVerificationResult> {
  const errors: string[] = [];
  const result: Partial<ArtifactVerificationResult> = {
    artifact,
    errors,
  };

  // Verificar que el archivo existe
  const filePath = options.workingDir 
    ? path.join(options.workingDir, artifact.path)
    : artifact.path;

  let fileContent: string | undefined;
  let exists: boolean;

  try {
    await fs.access(filePath);
    exists = true;
    result.exists = true;

    // Leer contenido del archivo
    fileContent = await fs.readFile(filePath, 'utf-8');
  } catch {
    exists = false;
    result.exists = false;
    errors.push(`File not found: ${artifact.path}`);
  }

  // Si el archivo no existe, no seguir verificando
  if (!exists) {
    return {
      ...result,
      artifact,
      exists: false,
      passed: false,
      errors,
    } as ArtifactVerificationResult;
  }

  // Contar líneas
  if (fileContent) {
    const lines = fileContent.split('\n');
    result.lineCount = lines.length;

    // Verificar min_lines
    if (artifact.min_lines !== undefined) {
      result.meetsMinLines = lines.length >= artifact.min_lines;
      if (!result.meetsMinLines) {
        errors.push(
          `File has ${lines.length} lines, expected at least ${artifact.min_lines}`
        );
      }
    }

    // Verificar contains
    if (artifact.contains) {
      result.containsPattern = fileContent.includes(artifact.contains);
      if (!result.containsPattern) {
        errors.push(`Pattern not found: "${artifact.contains}"`);
      }
    }

    // Verificar exports (simplificado - búsqueda de texto)
    if (artifact.exports && artifact.exports.length > 0) {
      const foundExports: string[] = [];
      const missingExports: string[] = [];

      for (const exportName of artifact.exports) {
        // Buscar export en el archivo
        const exportPattern = new RegExp(
          `export\\s+(?:async\\s+)?(?:const|let|var|function|class|interface|type|enum)?\\s*${exportName}\\b`,
          'i'
        );
        
        if (exportPattern.test(fileContent)) {
          foundExports.push(exportName);
        } else {
          missingExports.push(exportName);
        }
      }

      result.foundExports = foundExports;
      result.hasExpectedExports = missingExports.length === 0;

      if (missingExports.length > 0) {
        errors.push(`Missing exports: ${missingExports.join(', ')}`);
      }
    }
  }

  // Determinar si pasó todas las verificaciones
  const passed = errors.length === 0;

  return {
    ...result,
    artifact,
    passed,
    errors,
  } as ArtifactVerificationResult;
}

/**
 * Genera un reporte de verificación de artifacts
 * @param results - Resultados de verificación
 * @returns Reporte en formato markdown
 */
export function generateArtifactReport(results: ArtifactVerificationResult[]): string {
  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  const reportLines: string[] = [
    '## Artifact Verification Report',
    '',
    `**Summary:** ${passed}/${total} artifacts passed (${Math.round((passed / total) * 100)}%)`,
    '',
    '### Results',
    '',
    '| File | Exists | Lines | Exports | Contains | Status |',
    '|------|--------|-------|---------|----------|--------|',
  ];

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    const exists = result.exists ? '✅' : '❌';
    const lineCount = result.lineCount !== undefined ? result.lineCount : 'N/A';
    const exports = result.hasExpectedExports !== undefined
      ? (result.hasExpectedExports ? '✅' : '❌')
      : '-';
    const contains = result.containsPattern !== undefined
      ? (result.containsPattern ? '✅' : '❌')
      : '-';

    reportLines.push(
      `| ${result.artifact.path} | ${exists} | ${lineCount} | ${exports} | ${contains} | ${icon} |`
    );

    if (!result.passed && result.errors.length > 0) {
      reportLines.push(`| **Errors:** | colspan=5 | ${result.errors.join('; ')} |`);
    }
  }

  return reportLines.join('\n');
}

/**
 * Clase para verificación de artifacts con estado
 */
export class ArtifactVerificationEngine {
  private options: ArtifactVerificationOptions;

  constructor(options: ArtifactVerificationOptions = {}) {
    this.options = {
      parseAST: false,
      ...options,
    };
  }

  /**
   * Verifica artifacts de un schema
   */
  async verify(mustHaves: MustHaves): Promise<ArtifactVerificationResult[]> {
    return verifyArtifacts(mustHaves, this.options);
  }

  /**
   * Genera reporte de verificación
   */
  generateReport(results: ArtifactVerificationResult[]): string {
    return generateArtifactReport(results);
  }
}

export default ArtifactVerificationEngine;
