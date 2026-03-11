/**
 * Goal-Backward Verification System - Issue #18
 * Sistema de verificación hacia atrás usando must_haves
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { MustHaves, Artifact, KeyLink } from '../types';

export interface VerificationResult {
  passed: boolean;
  truths: Array<{ truth: string; passed: boolean; details?: string }>;
  artifacts: Array<{ artifact: Artifact; passed: boolean; issues: string[] }>;
  keyLinks: Array<{ link: KeyLink; passed: boolean; issues: string[] }>;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

export class VerificationSystem {
  private codebasePath: string;
  
  constructor(codebasePath: string) {
    this.codebasePath = codebasePath;
  }
  
  /**
   * Verifica must_haves contra el codebase
   */
  async verify(mustHaves: MustHaves): Promise<VerificationResult> {
    const result: VerificationResult = {
      passed: false,
      truths: [],
      artifacts: [],
      keyLinks: [],
      summary: { total: 0, passed: 0, failed: 0 }
    };
    
    // Verificar truths
    if (mustHaves.truths) {
      for (const truth of mustHaves.truths) {
        const truthResult = await this.verifyTruth(truth);
        result.truths.push(truthResult);
        this.updateSummary(result, truthResult.passed);
      }
    }
    
    // Verificar artifacts
    if (mustHaves.artifacts) {
      for (const artifact of mustHaves.artifacts) {
        const artifactResult = await this.verifyArtifact(artifact);
        result.artifacts.push(artifactResult);
        this.updateSummary(result, artifactResult.passed);
      }
    }
    
    // Verificar key_links
    if (mustHaves.key_links) {
      for (const link of mustHaves.key_links) {
        const linkResult = await this.verifyKeyLink(link);
        result.keyLinks.push(linkResult);
        this.updateSummary(result, linkResult.passed);
      }
    }
    
    // Determinar si todo pasó
    result.passed = result.summary.failed === 0;
    
    return result;
  }
  
  /**
   * Verifica una verdad (truth)
   */
  private async verifyTruth(truth: string): Promise<{ truth: string; passed: boolean; details?: string }> {
    // Las truths son afirmaciones que deben ser verificadas manualmente o mediante tests
    // Por ahora, marcamos como passed si hay tests que cubren esta funcionalidad
    const testFiles = await this.findTestFiles();
    const hasTest = await this.truthHasTest(truth, testFiles);
    
    return {
      truth,
      passed: hasTest,
      details: hasTest ? 'Covered by tests' : 'No test coverage found'
    };
  }
  
  /**
   * Verifica un artifact
   */
  private async verifyArtifact(artifact: Artifact): Promise<{ artifact: Artifact; passed: boolean; issues: string[] }> {
    const issues: string[] = [];
    const filePath = path.join(this.codebasePath, artifact.path);
    
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      // Verificar min_lines
      if (artifact.min_lines && lines.length < artifact.min_lines) {
        issues.push(`File has ${lines.length} lines, expected at least ${artifact.min_lines}`);
      }
      
      // Verificar exports
      if (artifact.exports) {
        for (const exportName of artifact.exports) {
          const exportRegex = new RegExp(`export\\s+(?:const|let|var|function|class|interface|type)\\s+${exportName}\\b`);
          if (!exportRegex.test(content)) {
            issues.push(`Export "${exportName}" not found`);
          }
        }
      }
      
      // Verificar contains
      if (artifact.contains) {
        if (!content.includes(artifact.contains)) {
          issues.push(`Required content "${artifact.contains}" not found`);
        }
      }
      
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        issues.push(`File not found: ${artifact.path}`);
      } else {
        issues.push(`Error reading file: ${(error as Error).message}`);
      }
    }
    
    return {
      artifact,
      passed: issues.length === 0,
      issues
    };
  }
  
  /**
   * Verifica un key_link
   */
  private async verifyKeyLink(link: KeyLink): Promise<{ link: KeyLink; passed: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      const fromPath = path.join(this.codebasePath, link.from);
      const fromContent = await fs.readFile(fromPath, 'utf-8');
      
      // Verificar que el patrón existe en el archivo origen
      const patternRegex = new RegExp(link.pattern);
      if (!patternRegex.test(fromContent)) {
        issues.push(`Pattern "${link.pattern}" not found in ${link.from}`);
      }
      
      // Verificar que el destino existe
      const toPath = path.join(this.codebasePath, link.to);
      try {
        await fs.access(toPath);
      } catch {
        issues.push(`Target file not found: ${link.to}`);
      }
      
    } catch (error) {
      issues.push(`Error verifying link: ${(error as Error).message}`);
    }
    
    return {
      link,
      passed: issues.length === 0,
      issues
    };
  }
  
  /**
   * Busca archivos de test
   */
  private async findTestFiles(): Promise<string[]> {
    const testFiles: string[] = [];
    
    const scanDir = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('node_modules')) {
          await scanDir(fullPath);
        } else if (entry.isFile() && /\.(test|spec)\.(ts|js)$/.test(entry.name)) {
          testFiles.push(fullPath);
        }
      }
    };
    
    try {
      await scanDir(this.codebasePath);
    } catch {
      // Ignorar errores de lectura
    }
    
    return testFiles;
  }
  
  /**
   * Verifica si una truth tiene cobertura de test
   */
  private async truthHasTest(truth: string, testFiles: string[]): Promise<boolean> {
    // Buscar en archivos de test si hay tests relacionados con esta truth
    const keywords = truth.toLowerCase().split(' ').filter(w => w.length > 3);
    
    for (const testFile of testFiles) {
      try {
        const content = await fs.readFile(testFile, 'utf-8');
        const contentLower = content.toLowerCase();
        
        // Si al menos la mitad de las palabras clave aparecen, consideramos que tiene test
        const matches = keywords.filter(kw => contentLower.includes(kw)).length;
        if (matches >= keywords.length / 2) {
          return true;
        }
      } catch {
        // Ignorar errores de lectura
      }
    }
    
    return false;
  }
  
  /**
   * Actualiza el resumen de verificación
   */
  private updateSummary(result: VerificationResult, passed: boolean): void {
    result.summary.total++;
    if (passed) {
      result.summary.passed++;
    } else {
      result.summary.failed++;
    }
  }
  
  /**
   * Genera un reporte de verificación
   */
  generateReport(result: VerificationResult): string {
    const lines: string[] = [
      '# Verification Report',
      '',
      `## Summary: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`,
      `- Total: ${result.summary.total}`,
      `- Passed: ${result.summary.passed}`,
      `- Failed: ${result.summary.failed}`,
      ''
    ];
    
    if (result.truths.length > 0) {
      lines.push('## Truths');
      for (const t of result.truths) {
        lines.push(`- ${t.passed ? '✅' : '❌'} ${t.truth}`);
        if (t.details) lines.push(`  - ${t.details}`);
      }
      lines.push('');
    }
    
    if (result.artifacts.length > 0) {
      lines.push('## Artifacts');
      for (const a of result.artifacts) {
        lines.push(`- ${a.passed ? '✅' : '❌'} ${a.artifact.path}`);
        for (const issue of a.issues) {
          lines.push(`  - ❌ ${issue}`);
        }
      }
      lines.push('');
    }
    
    if (result.keyLinks.length > 0) {
      lines.push('## Key Links');
      for (const l of result.keyLinks) {
        lines.push(`- ${l.passed ? '✅' : '❌'} ${l.link.from} → ${l.link.to}`);
        for (const issue of l.issues) {
          lines.push(`  - ❌ ${issue}`);
        }
      }
      lines.push('');
    }
    
    return lines.join('\n');
  }
}
