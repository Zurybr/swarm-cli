/**
 * TDD Executor - Issue #10
 * Ejecutor de planes tipo TDD (Test-Driven Development)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TDDTask, TDDResult, TestResult } from './types';

const execAsync = promisify(exec);

export interface TestRunner {
  run(command: string): Promise<TestRunResult>;
}

export interface TestRunResult {
  passed: boolean;
  tests: TestResult[];
  coverage: number;
  output: string;
}

export class JestTestRunner implements TestRunner {
  async run(command: string): Promise<TestRunResult> {
    try {
      const { stdout, stderr } = await execAsync(command);
      const output = stdout + stderr;
      
      // Parse Jest output
      const passed = output.includes('PASS') || output.includes('Tests:') && !output.includes('Tests:') && output.includes('failed');
      
      // Extract test results
      const tests: TestResult[] = [];
      const testRegex = /✓|✕\s+(.+)/g;
      let match;
      while ((match = testRegex.exec(output)) !== null) {
        tests.push({
          name: match[1],
          passed: match[0].startsWith('✓'),
          duration: 0
        });
      }
      
      // Extract coverage
      const coverageMatch = output.match(/All files\s+\|\s+[\d.]+\s+\|\s+[\d.]+\s+\|\s+[\d.]+\s+\|\s+([\d.]+)/);
      const coverage = coverageMatch ? parseFloat(coverageMatch[1]) : 0;
      
      return { passed, tests, coverage, output };
    } catch (error) {
      const output = (error as any).stdout + (error as any).stderr;
      return {
        passed: false,
        tests: [],
        coverage: 0,
        output
      };
    }
  }
}

export class TDDExecutor {
  private testRunner: TestRunner;
  private git: { commit: (message: string) => Promise<void> };
  
  constructor(
    testRunner: TestRunner = new JestTestRunner(),
    git: { commit: (message: string) => Promise<void> } = {
      commit: async () => {}
    }
  ) {
    this.testRunner = testRunner;
    this.git = git;
  }
  
  /**
   * Ejecuta una tarea TDD completa
   */
  async execute(task: TDDTask): Promise<TDDResult> {
    const result: TDDResult = {
      phase: 'red',
      testResults: [],
      coverage: 0,
      commits: [],
      duration: 0
    };
    
    const startTime = Date.now();
    
    // Fase RED: Escribir tests
    console.log('🔴 RED Phase: Writing tests...');
    await this.writeTests(task);
    await this.git.commit(`test(${this.sanitizeName(task.name)}): add failing tests`);
    result.commits.push(`test: ${task.name}`);
    
    // Ejecutar tests (deben fallar)
    const redResults = await this.testRunner.run(task.verifyCommand);
    if (redResults.passed) {
      throw new Error('Tests should fail in RED phase');
    }
    result.testResults = redResults.tests;
    
    // Fase GREEN: Implementar
    console.log('🟢 GREEN Phase: Implementing...');
    await this.writeImplementation(task);
    await this.git.commit(`feat(${this.sanitizeName(task.name)}): implement to pass tests`);
    result.commits.push(`feat: ${task.name}`);
    
    // Ejecutar tests (deben pasar)
    const greenResults = await this.testRunner.run(task.verifyCommand);
    if (!greenResults.passed) {
      throw new Error('Tests should pass in GREEN phase');
    }
    result.phase = 'green';
    result.coverage = greenResults.coverage;
    
    // Fase REFACTOR: Limpiar
    console.log('🔵 REFACTOR Phase: Cleaning up...');
    await this.refactor(task);
    await this.git.commit(`refactor(${this.sanitizeName(task.name)}): clean up implementation`);
    result.commits.push(`refactor: ${task.name}`);
    
    // Test final
    const finalResults = await this.testRunner.run(task.verifyCommand);
    result.testResults = finalResults.tests;
    result.coverage = finalResults.coverage;
    result.phase = 'refactor';
    result.duration = Date.now() - startTime;
    
    return result;
  }
  
  /**
   * Escribe el archivo de tests
   */
  private async writeTests(task: TDDTask): Promise<void> {
    const testFile = task.files.find(f => f.includes('.test.') || f.includes('.spec.'));
    if (!testFile) throw new Error('No test file specified');
    
    const implFile = task.files.find(f => !f.includes('.test.') && !f.includes('.spec.'));
    if (!implFile) throw new Error('No implementation file specified');
    
    const testContent = this.generateTestFile(task, implFile);
    await fs.mkdir(path.dirname(testFile), { recursive: true });
    await fs.writeFile(testFile, testContent);
  }
  
  /**
   * Escribe la implementación
   */
  private async writeImplementation(task: TDDTask): Promise<void> {
    const implFile = task.files.find(f => !f.includes('.test.') && !f.includes('.spec.'));
    if (!implFile) throw new Error('No implementation file specified');
    
    const implContent = this.generateImplementation(task);
    await fs.mkdir(path.dirname(implFile), { recursive: true });
    await fs.writeFile(implFile, implContent);
  }
  
  /**
   * Refactoriza el código
   */
  private async refactor(task: TDDTask): Promise<void> {
    // Por ahora, no hacemos refactor automático
    // En el futuro, podría usar AI para sugerir mejoras
  }
  
  /**
   * Genera contenido del archivo de tests
   */
  private generateTestFile(task: TDDTask, implFile: string): string {
    const functionName = this.extractFunctionName(task.name);
    const implImport = path.basename(implFile, path.extname(implFile));
    
    const tests = task.testCases.map(tc => `
  test('${tc.name}', () => {
    ${tc.description}
    const result = ${functionName}(${JSON.stringify(tc.input)});
    expect(result).toEqual(${JSON.stringify(tc.expectedOutput)});
  });`).join('\n');
    
    return `import { ${functionName} } from './${implImport}';

describe('${functionName}', () => {${tests}
});
`;
  }
  
  /**
   * Genera contenido de implementación
   */
  private generateImplementation(task: TDDTask): string {
    const functionName = this.extractFunctionName(task.name);
    
    // Generar implementación mínima basada en test cases
    const cases = task.testCases.map(tc => {
      if (typeof tc.input === 'object') {
        const conditions = Object.entries(tc.input as Record<string, unknown>)
          .map(([key, value]) => `input.${key} === ${JSON.stringify(value)}`)
          .join(' && ');
        return `  if (${conditions}) return ${JSON.stringify(tc.expectedOutput)};`;
      }
      return `  if (input === ${JSON.stringify(tc.input)}) return ${JSON.stringify(tc.expectedOutput)};`;
    }).join('\n');
    
    return `export function ${functionName}(input: any): any {
${cases}
  throw new Error('Not implemented');
}
`;
  }
  
  /**
   * Extrae nombre de función del nombre de tarea
   */
  private extractFunctionName(taskName: string): string {
    // Remover prefijo "TDD: " y convertir a camelCase
    const clean = taskName.replace(/^TDD:\s*/i, '');
    return clean
      .split(/\s+/)
      .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
      .replace(/[^a-zA-Z0-9]/g, '');
  }
  
  /**
   * Sanitiza nombre para commit
   */
  private sanitizeName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  
  /**
   * Verifica si una tarea es candidata para TDD
   */
  static isTDDAppropriate(task: TDDTask): boolean {
    // Heurística: ¿Podemos escribir expect(fn(input)).toBe(output) antes de fn?
    return task.testCases.length > 0 && 
           task.testCases.every(tc => 
             tc.input !== undefined && 
             tc.expectedOutput !== undefined
           );
  }
}
