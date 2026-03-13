/**
 * Links Verification Engine
 * 
 * Verifica conexiones (key_links) entre artifacts del schema must_haves
 * Issue #18 - Task #5.4
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  MustHaves,
  KeyLink,
  KeyLinkVerificationResult,
} from '../types/verification-schema';

/**
 * Opciones para verificación de key links
 */
export interface LinksVerificationOptions {
  /** Directorio de trabajo */
  workingDir?: string;
  /** Si se debe analizar imports */
  analyzeImports?: boolean;
}

/**
 * Verifica todos los key_links de un schema MustHaves
 * @param mustHaves - Schema con key_links a verificar
 * @param options - Opciones de verificación
 * @returns Array de resultados de verificación
 */
export async function verifyKeyLinks(
  mustHaves: MustHaves,
  options: LinksVerificationOptions = {}
): Promise<KeyLinkVerificationResult[]> {
  const results: KeyLinkVerificationResult[] = [];

  for (const keyLink of mustHaves.key_links) {
    const result = await verifyKeyLink(keyLink, options);
    results.push(result);
  }

  return results;
}

/**
 * Verifica un key_link individual
 * @param keyLink - Link a verificar
 * @param options - Opciones de verificación
 * @returns Resultado de verificación
 */
async function verifyKeyLink(
  keyLink: KeyLink,
  options: LinksVerificationOptions
): Promise<KeyLinkVerificationResult> {
  const fromPath = options.workingDir 
    ? path.join(options.workingDir, keyLink.from)
    : keyLink.from;

  try {
    // Leer archivo fuente
    const content = await fs.readFile(fromPath, 'utf-8');

    // Buscar el patrón de conexión
    const pattern = new RegExp(keyLink.pattern, 'i');
    const match = content.match(pattern);

    if (match) {
      return {
        keyLink,
        connected: true,
        passed: true,
        foundPattern: match[0],
        verifiedAt: new Date(),
      };
    } else {
      return {
        keyLink,
        connected: false,
        passed: false,
        message: `Pattern not found: "${keyLink.pattern}"`,
        verifiedAt: new Date(),
      };
    }
  } catch (error) {
    return {
      keyLink,
      connected: false,
      passed: false,
      message: `Cannot read source file: ${keyLink.from}`,
      verifiedAt: new Date(),
    };
  }
}

/**
 * Analiza imports entre archivos
 * @param mustHaves - Schema con información de archivos
 * @param options - Opciones
 * @returns Mapa de conexiones encontradas
 */
export async function analyzeImports(
  mustHaves: MustHaves,
  options: LinksVerificationOptions = {}
): Promise<Map<string, string[]>> {
  const connections = new Map<string, string[]>();

  for (const artifact of mustHaves.artifacts) {
    const filePath = options.workingDir 
      ? path.join(options.workingDir, artifact.path)
      : artifact.path;

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const imports: string[] = [];

      // Buscar imports de TypeScript/JavaScript
      const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"];?/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }

      // Buscar require()
      const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((match = requireRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }

      // Buscar fetch() calls
      const fetchRegex = /fetch\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
      while ((match = fetchRegex.exec(content)) !== null) {
        imports.push(`fetch:${match[1]}`);
      }

      connections.set(artifact.path, imports);
    } catch {
      connections.set(artifact.path, []);
    }
  }

  return connections;
}

/**
 * Genera un reporte de verificación de key links
 * @param results - Resultados de verificación
 * @returns Reporte en formato markdown
 */
export function generateKeyLinksReport(results: KeyLinkVerificationResult[]): string {
  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  const lines: string[] = [
    '## Key Links Verification Report',
    '',
    `**Summary:** ${passed}/${total} links passed (${Math.round((passed / total) * 100)}%)`,
    '',
    '### Connections',
    '',
    '| From | To | Via | Status | Pattern |',
    '|------|-----|-----|--------|---------|',
  ];

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    const foundPattern = result.foundPattern 
      ? `Found: "${result.foundPattern.substring(0, 50)}..."`
      : result.message || 'Not found';

    lines.push(
      `| ${result.keyLink.from} | ${result.keyLink.to} | ${result.keyLink.via} | ${icon} | ${foundPattern} |`
    );
  }

  return lines.join('\n');
}

/**
 * Construye un grafo de conexiones entre artifacts
 * @param mustHaves - Schema con artifacts y links
 * @returns Grafo como mapa de adyacencia
 */
export function buildConnectionGraph(
  mustHaves: MustHaves
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  // Inicializar nodos
  for (const artifact of mustHaves.artifacts) {
    graph.set(artifact.path, new Set());
  }

  // Agregar conexiones
  for (const link of mustHaves.key_links) {
    const connections = graph.get(link.from);
    if (connections) {
      connections.add(link.to);
    }
  }

  return graph;
}

/**
 * Clase para verificación de key links con estado
 */
export class LinksVerificationEngine {
  private options: LinksVerificationOptions;

  constructor(options: LinksVerificationOptions = {}) {
    this.options = {
      analyzeImports: true,
      ...options,
    };
  }

  /**
   * Verifica key_links de un schema
   */
  async verify(mustHaves: MustHaves): Promise<KeyLinkVerificationResult[]> {
    return verifyKeyLinks(mustHaves, this.options);
  }

  /**
   * Analiza imports del proyecto
   */
  async analyzeImports(mustHaves: MustHaves): Promise<Map<string, string[]>> {
    return analyzeImports(mustHaves, this.options);
  }

  /**
   * Genera reporte de verificación
   */
  generateReport(results: KeyLinkVerificationResult[]): string {
    return generateKeyLinksReport(results);
  }

  /**
   * Construye grafo de conexiones
   */
  buildGraph(mustHaves: MustHaves): Map<string, Set<string>> {
    return buildConnectionGraph(mustHaves);
  }
}

export default LinksVerificationEngine;
