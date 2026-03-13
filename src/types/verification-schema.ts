/**
 * Verification Schema Types
 * 
 * TypeScript interfaces para el schema must_haves según issue #18
 * Define la estructura de truths, artifacts y key_links
 */

/**
 * Truth - Comportamiento observable desde perspectiva del usuario
 * Ejemplo: "User can see existing messages"
 */
export interface Truth {
  /** Descripción del comportamiento observable */
  description: string;
}

/**
 * Artifact - Archivo que debe existir y cumplir ciertos criterios
 */
export interface Artifact {
  /** Path del archivo relativo a la raíz del proyecto */
  path: string;
  /** Qué proporciona este artifact */
  provides: string;
  /** Mínimo de líneas requeridas (opcional) */
  min_lines?: number;
  /** Exports esperados (opcional) */
  exports?: string[];
  /** Patrón que debe contener el archivo (opcional) */
  contains?: string;
}

/**
 * KeyLink - Conexión entre artifacts
 */
export interface KeyLink {
  /** Archivo fuente */
  from: string;
  /** Archivo o endpoint destino */
  to: string;
  /** Cómo se conectan (descripción) */
  via: string;
  /** Regex para verificar la conexión */
  pattern: string;
}

/**
 * MustHaves - Schema completo para goal-backward verification
 */
export interface MustHaves {
  /** Comportamientos observables */
  truths: Truth[];
  /** Archivos requeridos */
  artifacts: Artifact[];
  /** Conexiones entre artifacts */
  key_links: KeyLink[];
}

/**
 * Resultado de verificación de un Truth
 */
export interface TruthVerificationResult {
  /** El truth verificado */
  truth: Truth;
  /** Si pasó la verificación */
  passed: boolean;
  /** Mensaje de error si falló */
  message?: string;
  /** Método de verificación usado */
  method: 'test' | 'e2e' | 'manual';
  /** Timestamp de verificación */
  verifiedAt: Date;
}

/**
 * Resultado de verificación de un Artifact
 */
export interface ArtifactVerificationResult {
  /** El artifact verificado */
  artifact: Artifact;
  /** Si existe el archivo */
  exists: boolean;
  /** Número de líneas */
  lineCount?: number;
  /** Si cumple min_lines */
  meetsMinLines?: boolean;
  /** Exports encontrados */
  foundExports?: string[];
  /** Si tiene los exports esperados */
  hasExpectedExports?: boolean;
  /** Si contiene el patrón esperado */
  containsPattern?: boolean;
  /** Si pasó todas las verificaciones */
  passed: boolean;
  /** Detalles de errores */
  errors: string[];
}

/**
 * Resultado de verificación de un KeyLink
 */
export interface KeyLinkVerificationResult {
  /** El link verificado */
  keyLink: KeyLink;
  /** Si se encontró la conexión */
  connected: boolean;
  /** Si pasó la verificación */
  passed: boolean;
  /** Mensaje de error si falló */
  message?: string;
  /** Patrón encontrado (si aplica) */
  foundPattern?: string;
  /** Timestamp de verificación */
  verifiedAt?: Date;
}

/**
 * Resultado completo de verificación de MustHaves
 */
export interface MustHavesVerificationResult {
  /** Resultados de truths */
  truths: TruthVerificationResult[];
  /** Resultados de artifacts */
  artifacts: ArtifactVerificationResult[];
  /** Resultados de key_links */
  keyLinks: KeyLinkVerificationResult[];
  /** Estadísticas */
  stats: {
    totalTruths: number;
    passedTruths: number;
    totalArtifacts: number;
    passedArtifacts: number;
    totalKeyLinks: number;
    passedKeyLinks: number;
    overallPassRate: number;
  };
  /** Si todos los must_haves pasaron */
  allPassed: boolean;
  /** Timestamp de verificación */
  verifiedAt: Date;
}
