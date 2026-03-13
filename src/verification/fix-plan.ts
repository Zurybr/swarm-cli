/**
 * Fix Plan Generator - Issue #18 (#5.6)
 * 
 * Sistema de generación automática de fix plans basado en gaps
 * encontrados durante la verificación.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Gap, VerificationResult, GapSeverity, MustHaveType } from './types';

/**
 * Estructura de un fix plan según el formato del issue #18
 */
export interface FixPlan {
  /** Fase original a la que pertenece */
  phase: string;
  /** Identificador del plan (fix-{number}) */
  plan: string;
  /** Tipo de plan */
  type: 'execute';
  /** Wave de ejecución */
  wave: number;
  /** Dependencias del plan */
  depends_on: string[];
  /** Lista de fixes a aplicar */
  fixes: FixEntry[];
  /** Metadata adicional */
  metadata?: {
    createdAt: string;
    sourceVerification?: string;
    goalId?: string;
  };
}

/**
 * Entrada individual de fix en un plan
 */
export interface FixEntry {
  /** Item de verificación relacionado */
  verification_item: string;
  /** Descripción del gap encontrado */
  gap: string;
  /** Acción sugerida para corregir */
  suggested_action: string;
  /** Prioridad del fix */
  priority?: 'critical' | 'high' | 'medium' | 'low';
  /** Archivos relacionados */
  files?: string[];
}

/**
 * Opciones para generar fix plans
 */
export interface FixPlanGeneratorOptions {
  /** Directorio de salida para los fix plans */
  outputDir?: string;
  /** Fase actual (para metadata) */
  phase?: string;
  /** Prefijo para los nombres de plan */
  planPrefix?: string;
  /** Wave inicial */
  initialWave?: number;
  /** Incluir metadata extendida */
  includeMetadata?: boolean;
}

/**
 * Generador de fix plans basado en gaps de verificación
 */
export class FixPlanGenerator {
  private options: FixPlanGeneratorOptions;
  private planCounter: number;

  constructor(options: FixPlanGeneratorOptions = {}) {
    this.options = {
      outputDir: './.planning/fixes',
      phase: 'unknown',
      planPrefix: 'fix',
      initialWave: 1,
      includeMetadata: true,
      ...options,
    };
    this.planCounter = 0;
  }

  /**
   * Genera un fix plan para un gap específico
   */
  generateFixPlan(gap: Gap, goalId?: string): FixPlan {
    this.planCounter++;
    
    const fixEntry = this.createFixEntry(gap);
    
    const fixPlan: FixPlan = {
      phase: this.options.phase!,
      plan: `${this.options.planPrefix}-${this.planCounter.toString().padStart(3, '0')}`,
      type: 'execute',
      wave: this.options.initialWave!,
      depends_on: [],
      fixes: [fixEntry],
    };

    if (this.options.includeMetadata) {
      fixPlan.metadata = {
        createdAt: new Date().toISOString(),
        goalId: goalId || gap.goalId,
      };
    }

    return fixPlan;
  }

  /**
   * Genera múltiples fix plans a partir de resultados de verificación
   */
  generateFixPlans(results: VerificationResult[]): FixPlan[] {
    const fixPlans: FixPlan[] = [];
    
    for (const result of results) {
      // Solo generar plans para resultados con gaps
      if (result.gaps.length === 0) {
        continue;
      }

      // Agrupar gaps por severidad para priorizar
      const criticalGaps = result.gaps.filter(g => g.severity === 'critical');
      const majorGaps = result.gaps.filter(g => g.severity === 'major');
      const minorGaps = result.gaps.filter(g => g.severity === 'minor');

      // Generar plan para gaps críticos
      if (criticalGaps.length > 0) {
        fixPlans.push(this.createAggregatedFixPlan(
          criticalGaps,
          result.goalId,
          'critical'
        ));
      }

      // Generar plan para gaps mayores
      if (majorGaps.length > 0) {
        fixPlans.push(this.createAggregatedFixPlan(
          majorGaps,
          result.goalId,
          'major'
        ));
      }

      // Generar plan para gaps menores
      if (minorGaps.length > 0) {
        fixPlans.push(this.createAggregatedFixPlan(
          minorGaps,
          result.goalId,
          'minor'
        ));
      }
    }

    // Asignar dependencias entre planes (los críticos primero)
    this.assignDependencies(fixPlans);

    return fixPlans;
  }

  /**
   * Genera un fix plan consolidado para múltiples gaps
   */
  generateConsolidatedFixPlan(
    gaps: Gap[],
    goalId?: string,
    planName?: string
  ): FixPlan {
    this.planCounter++;
    
    const fixes = gaps.map(gap => this.createFixEntry(gap));
    
    const fixPlan: FixPlan = {
      phase: this.options.phase!,
      plan: planName || `${this.options.planPrefix}-${this.planCounter.toString().padStart(3, '0')}`,
      type: 'execute',
      wave: this.options.initialWave!,
      depends_on: [],
      fixes,
    };

    if (this.options.includeMetadata) {
      fixPlan.metadata = {
        createdAt: new Date().toISOString(),
        goalId,
      };
    }

    return fixPlan;
  }

  /**
   * Exporta un fix plan a formato YAML
   */
  exportToYAML(fixPlan: FixPlan): string {
    const lines: string[] = [
      '---',
      `phase: ${fixPlan.phase}`,
      `plan: ${fixPlan.plan}`,
      `type: ${fixPlan.type}`,
      `wave: ${fixPlan.wave}`,
      `depends_on: [${fixPlan.depends_on.join(', ')}]`,
      'fixes:',
    ];

    for (const fix of fixPlan.fixes) {
      lines.push(`  - verification_item: "${fix.verification_item}"`);
      lines.push(`    gap: "${fix.gap}"`);
      lines.push(`    suggested_action: "${fix.suggested_action}"`);
      
      if (fix.priority) {
        lines.push(`    priority: ${fix.priority}`);
      }
      
      if (fix.files && fix.files.length > 0) {
        lines.push(`    files: [${fix.files.map(f => `"${f}"`).join(', ')}]`);
      }
    }

    if (fixPlan.metadata) {
      lines.push('metadata:');
      lines.push(`  createdAt: ${fixPlan.metadata.createdAt}`);
      if (fixPlan.metadata.goalId) {
        lines.push(`  goalId: ${fixPlan.metadata.goalId}`);
      }
    }

    lines.push('---');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Guarda un fix plan en un archivo PLAN.md
   */
  async saveFixPlan(fixPlan: FixPlan, outputPath?: string): Promise<string> {
    const dir = outputPath || this.options.outputDir!;
    
    // Crear directorio si no existe
    await fs.mkdir(dir, { recursive: true });
    
    const fileName = `${fixPlan.plan}-PLAN.md`;
    const filePath = path.join(dir, fileName);
    
    const yamlContent = this.exportToYAML(fixPlan);
    await fs.writeFile(filePath, yamlContent, 'utf-8');
    
    return filePath;
  }

  /**
   * Guarda múltiples fix plans
   */
  async saveFixPlans(fixPlans: FixPlan[], outputDir?: string): Promise<string[]> {
    const savedPaths: string[] = [];
    
    for (const fixPlan of fixPlans) {
      const savedPath = await this.saveFixPlan(fixPlan, outputDir);
      savedPaths.push(savedPath);
    }
    
    return savedPaths;
  }

  /**
   * Genera una descripción del gap basada en su tipo
   */
  private createFixEntry(gap: Gap): FixEntry {
    const suggestedAction = this.generateSuggestedAction(gap);
    
    return {
      verification_item: this.extractVerificationItem(gap),
      gap: gap.description,
      suggested_action: suggestedAction,
      priority: this.mapSeverityToPriority(gap.severity),
      files: this.extractRelatedFiles(gap),
    };
  }

  /**
   * Genera una acción sugerida basada en el tipo de gap
   */
  private generateSuggestedAction(gap: Gap): string {
    // Usar remediation si está disponible
    if (gap.remediation && gap.remediation.length > 0) {
      return gap.remediation.join('; ');
    }

    // Generar sugerencia basada en la descripción del gap
    const description = gap.description.toLowerCase();
    const expected = String(gap.expected || '');

    // Check for export-related gaps first (before "not found")
    if (description.includes('export') && (description.includes('not found') || description.includes('missing'))) {
      return `Add missing export "${expected}" to the file`;
    }

    if (description.includes('not found') || description.includes('missing')) {
      return `Create missing file or component: ${expected}`;
    }

    if (description.includes('too short') || description.includes('lines')) {
      return 'Add additional implementation: error handling, logging, validation';
    }

    if (description.includes('pattern')) {
      return `Implement required pattern: ${expected}`;
    }

    if (description.includes('link') || description.includes('connection')) {
      return `Establish connection between components: ${expected}`;
    }

    // Acción por defecto
    return `Address gap: ${gap.description}`;
  }

  /**
   * Extrae el item de verificación del gap
   */
  private extractVerificationItem(gap: Gap): string {
    // Intentar extraer del target si está disponible
    if (typeof gap.expected === 'string') {
      return gap.expected;
    }

    if (typeof gap.actual === 'string') {
      return gap.actual;
    }

    return `must-have-${gap.mustHaveId}`;
  }

  /**
   * Extrae archivos relacionados del gap
   */
  private extractRelatedFiles(gap: Gap): string[] {
    const files: string[] = [];
    
    // Extraer paths de archivos del expected/actual
    const expected = String(gap.expected || '');
    const actual = String(gap.actual || '');
    
    // Buscar paths que parezcan archivos
    const pathRegex = /(?:src\/|lib\/|app\/)[\w\-\/]+\.(ts|tsx|js|jsx)/g;
    
    const expectedMatches = expected.match(pathRegex);
    const actualMatches = actual.match(pathRegex);
    
    if (expectedMatches) {
      files.push(...expectedMatches);
    }
    
    if (actualMatches) {
      files.push(...actualMatches);
    }
    
    return [...new Set(files)]; // Eliminar duplicados
  }

  /**
   * Mapea severidad de gap a prioridad de fix
   */
  private mapSeverityToPriority(severity: GapSeverity): FixEntry['priority'] {
    switch (severity) {
      case 'critical':
        return 'critical';
      case 'major':
        return 'high';
      case 'minor':
        return 'medium';
      case 'info':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Crea un fix plan agregado para múltiples gaps
   */
  private createAggregatedFixPlan(
    gaps: Gap[],
    goalId: string,
    severity: GapSeverity
  ): FixPlan {
    this.planCounter++;
    
    const fixes = gaps.map(gap => this.createFixEntry(gap));
    
    const fixPlan: FixPlan = {
      phase: this.options.phase!,
      plan: `${this.options.planPrefix}-${severity}-${this.planCounter.toString().padStart(3, '0')}`,
      type: 'execute',
      wave: this.options.initialWave!,
      depends_on: [],
      fixes,
    };

    if (this.options.includeMetadata) {
      fixPlan.metadata = {
        createdAt: new Date().toISOString(),
        goalId,
      };
    }

    return fixPlan;
  }

  /**
   * Asigna dependencias entre planes
   */
  private assignDependencies(fixPlans: FixPlan[]): void {
    // Los planes críticos no tienen dependencias (ejecutan primero)
    // Los planes mayores dependen de los críticos
    // Los planes menores dependen de los mayores
    
    const criticalPlans = fixPlans.filter(p => p.plan.includes('critical'));
    const majorPlans = fixPlans.filter(p => p.plan.includes('major'));
    const minorPlans = fixPlans.filter(p => p.plan.includes('minor'));

    // Major plans dependen de critical plans
    for (const majorPlan of majorPlans) {
      majorPlan.depends_on = criticalPlans.map(p => p.plan);
      majorPlan.wave = 2;
    }

    // Minor plans dependen de major plans
    for (const minorPlan of minorPlans) {
      minorPlan.depends_on = majorPlans.map(p => p.plan);
      minorPlan.wave = 3;
    }
  }

  /**
   * Estima el esfuerzo total de todos los fix plans
   */
  estimateTotalEffort(fixPlans: FixPlan[]): number {
    let totalEffort = 0;
    
    for (const plan of fixPlans) {
      for (const fix of plan.fixes) {
        // Asignar peso basado en prioridad
        switch (fix.priority) {
          case 'critical':
            totalEffort += 8; // 8 horas
            break;
          case 'high':
            totalEffort += 4; // 4 horas
            break;
          case 'medium':
            totalEffort += 2; // 2 horas
            break;
          case 'low':
            totalEffort += 1; // 1 hora
            break;
        }
      }
    }
    
    return totalEffort;
  }

  /**
   * Genera un reporte resumido de los fix plans
   */
  generateSummary(fixPlans: FixPlan[]): string {
    const totalFixes = fixPlans.reduce((sum, p) => sum + p.fixes.length, 0);
    const criticalFixes = fixPlans.flatMap(p => p.fixes).filter(f => f.priority === 'critical').length;
    const highFixes = fixPlans.flatMap(p => p.fixes).filter(f => f.priority === 'high').length;
    
    const lines = [
      '# Fix Plans Summary',
      '',
      `Total Plans: ${fixPlans.length}`,
      `Total Fixes: ${totalFixes}`,
      '',
      '## By Priority',
      `- Critical: ${criticalFixes}`,
      `- High: ${highFixes}`,
      `- Medium: ${fixPlans.flatMap(p => p.fixes).filter(f => f.priority === 'medium').length}`,
      `- Low: ${fixPlans.flatMap(p => p.fixes).filter(f => f.priority === 'low').length}`,
      '',
      `## Estimated Effort`,
      `${this.estimateTotalEffort(fixPlans)} hours`,
      '',
      '## Plans',
    ];

    for (const plan of fixPlans) {
      lines.push(`- ${plan.plan} (${plan.fixes.length} fixes, wave ${plan.wave})`);
    }

    return lines.join('\n');
  }
}

/**
 * Factory function para crear un FixPlanGenerator
 */
export function createFixPlanGenerator(
  options?: FixPlanGeneratorOptions
): FixPlanGenerator {
  return new FixPlanGenerator(options);
}

/**
 * Función helper para generar fix plans rápidamente desde resultados de verificación
 */
export async function generateFixPlansFromResults(
  results: VerificationResult[],
  options?: FixPlanGeneratorOptions
): Promise<{ plans: FixPlan[]; savedPaths: string[] }> {
  const generator = new FixPlanGenerator(options);
  
  const plans = generator.generateFixPlans(results);
  const savedPaths = await generator.saveFixPlans(plans);
  
  return { plans, savedPaths };
}

// Export default
export default FixPlanGenerator;
