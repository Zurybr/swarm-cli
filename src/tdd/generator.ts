/**
 * TDD Test Generation Helpers
 *
 * Provides utilities for automatically generating test cases based on
 * code analysis and templates.
 */

import type {
  TestCase,
  TestCaseType,
  TestCaseTemplate,
  TestSuite,
  TDDPlan,
  TestCaseStatus,
} from './types';
import { applyTemplate, JEST_UNIT_TEST_TEMPLATE, ERROR_TEST_TEMPLATE, BOUNDARY_TEST_TEMPLATE } from './template';

// ============================================================================
// Test Generation Configuration
// ============================================================================

export interface TestGenerationConfig {
  /** Generate tests for public methods only */
  publicOnly: boolean;
  /** Generate boundary tests */
  includeBoundaries: boolean;
  /** Generate error handling tests */
  includeErrors: boolean;
  /** Generate async tests for async methods */
  detectAsync: boolean;
  /** Default test framework */
  framework: 'jest' | 'mocha' | 'vitest';
}

export const DEFAULT_GENERATION_CONFIG: TestGenerationConfig = {
  publicOnly: true,
  includeBoundaries: true,
  includeErrors: true,
  detectAsync: true,
  framework: 'jest',
};

// ============================================================================
// Code Analysis Types
// ============================================================================

export interface AnalyzedMethod {
  /** Method name */
  name: string;
  /** Is async method */
  isAsync: boolean;
  /** Method parameters */
  parameters: ParameterInfo[];
  /** Return type */
  returnType?: string;
  /** Is public */
  isPublic: boolean;
  /** JSDoc description */
  description?: string;
  /** Line number */
  line: number;
}

export interface ParameterInfo {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type?: string;
  /** Is optional */
  optional: boolean;
  /** Default value */
  defaultValue?: string;
}

export interface AnalyzedClass {
  /** Class name */
  name: string;
  /** File path */
  filePath: string;
  /** Methods */
  methods: AnalyzedMethod[];
  /** Dependencies (constructor params) */
  dependencies: ParameterInfo[];
  /** Line number */
  line: number;
}

// ============================================================================
// Test Generator Class
// ============================================================================

export class TestGenerator {
  private config: TestGenerationConfig;

  constructor(config: Partial<TestGenerationConfig> = {}) {
    this.config = { ...DEFAULT_GENERATION_CONFIG, ...config };
  }

  /**
   * Generate tests for an analyzed class
   */
  generateTestsForClass(
    analyzedClass: AnalyzedClass,
    plan: TDDPlan
  ): TestCase[] {
    const tests: TestCase[] = [];

    for (const method of analyzedClass.methods) {
      if (this.config.publicOnly && !method.isPublic) {
        continue;
      }

      // Generate main functionality test
      tests.push(this.generateMethodTest(method, analyzedClass, plan));

      // Generate boundary tests if enabled
      if (this.config.includeBoundaries) {
        tests.push(...this.generateBoundaryTests(method, analyzedClass, plan));
      }

      // Generate error handling tests if enabled
      if (this.config.includeErrors) {
        tests.push(...this.generateErrorTests(method, analyzedClass, plan));
      }
    }

    return tests;
  }

  /**
   * Generate a basic test for a method
   */
  private generateMethodTest(
    method: AnalyzedMethod,
    classInfo: AnalyzedClass,
    plan: TDDPlan
  ): TestCase {
    const testFile = this.getTestFileName(classInfo.filePath);
    const values = this.generateTemplateValues(method, classInfo);

    return {
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${method.name} should ${values.expectedBehavior}`,
      type: 'unit',
      status: 'draft',
      code: applyTemplate(JEST_UNIT_TEST_TEMPLATE, values),
      file: testFile,
      line: 1,
      expectedBehavior: values.expectedBehavior,
      createdAt: new Date(),
    };
  }

  /**
   * Generate boundary tests for a method
   */
  private generateBoundaryTests(
    method: AnalyzedMethod,
    classInfo: AnalyzedClass,
    plan: TDDPlan
  ): TestCase[] {
    const tests: TestCase[] = [];
    const testFile = this.getTestFileName(classInfo.filePath);

    // Generate tests for each parameter with boundary conditions
    for (const param of method.parameters) {
      if (param.type === 'number' || param.type === 'string') {
        const values = {
          className: classInfo.name,
          minValue: param.type === 'number' ? '0' : "''",
          maxValue: param.type === 'number' ? 'Number.MAX_SAFE_INTEGER' : "'a'.repeat(1000)",
          testCode: this.generateBoundaryTestCode(method, param, 'boundary'),
          emptyTestCode: this.generateBoundaryTestCode(method, param, 'empty'),
          nullTestCode: this.generateBoundaryTestCode(method, param, 'null'),
        };

        tests.push({
          id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: `${method.name} handles boundary conditions for ${param.name}`,
          type: 'unit',
          status: 'draft',
          code: applyTemplate(BOUNDARY_TEST_TEMPLATE, values),
          file: testFile,
          line: 1,
          expectedBehavior: `handle boundary conditions for ${param.name}`,
          createdAt: new Date(),
        });
      }
    }

    return tests;
  }

  /**
   * Generate error handling tests for a method
   */
  private generateErrorTests(
    method: AnalyzedMethod,
    classInfo: AnalyzedClass,
    plan: TDDPlan
  ): TestCase[] {
    const tests: TestCase[] = [];
    const testFile = this.getTestFileName(classInfo.filePath);

    const values = this.generateTemplateValues(method, classInfo);
    values.errorType = 'Error';
    values.condition = 'invalid input is provided';
    values.arrange = `const instance = new ${classInfo.name}();`;
    values.act = `await instance.${method.name}();`;
    values.assert = '// Assert error is thrown';

    tests.push({
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${method.name} throws error for invalid input`,
      type: 'unit',
      status: 'draft',
      code: applyTemplate(ERROR_TEST_TEMPLATE, values),
      file: testFile,
      line: 1,
      expectedBehavior: 'throw error for invalid input',
      createdAt: new Date(),
    });

    return tests;
  }

  /**
   * Generate template values for a method
   */
  private generateTemplateValues(
    method: AnalyzedMethod,
    classInfo: AnalyzedClass
  ): Record<string, string> {
    const paramList = method.parameters
      .map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type || 'any'}`)
      .join(', ');

    const argList = method.parameters.map(p => p.name).join(', ');

    return {
      className: classInfo.name,
      methodName: method.name,
      expectedBehavior: method.description || 'work correctly',
      arrange: `const instance = new ${classInfo.name}();`,
      act: method.isAsync
        ? `const result = await instance.${method.name}(${argList});`
        : `const result = instance.${method.name}(${argList});`,
      assert: 'expect(result).toBeDefined();',
    };
  }

  /**
   * Generate boundary test code
   */
  private generateBoundaryTestCode(
    method: AnalyzedMethod,
    param: ParameterInfo,
    scenario: 'boundary' | 'empty' | 'null'
  ): string {
    const argList = method.parameters.map(p =>
      p.name === param.name
        ? scenario === 'null'
          ? 'null'
          : scenario === 'empty'
            ? param.type === 'number'
              ? '0'
              : "''"
            : param.type === 'number'
              ? 'Number.MAX_SAFE_INTEGER'
              : "'test'"
        : p.name
    );

    const call = method.isAsync ? 'await' : '';
    return `const instance = new ${method.name}();
const result = ${call} instance.${method.name}(${argList.join(', ')});
expect(result).toBeDefined();`;
  }

  /**
   * Get test file name from source file
   */
  private getTestFileName(sourceFile: string): string {
    const dir = sourceFile.substring(0, sourceFile.lastIndexOf('/'));
    const base = sourceFile.substring(
      sourceFile.lastIndexOf('/') + 1,
      sourceFile.lastIndexOf('.')
    );
    const ext = sourceFile.substring(sourceFile.lastIndexOf('.'));
    return `${dir}/${base}.test${ext}`;
  }

  /**
   * Generate a test suite from a plan
   */
  generateTestSuite(plan: TDDPlan, name: string): TestSuite {
    return {
      id: `suite-${Date.now()}`,
      name,
      description: `Test suite for ${plan.name}`,
      testCases: plan.testCases,
      filePattern: plan.testFiles.join(','),
    };
  }

  /**
   * Generate stub test for a file
   */
  generateStubTest(filePath: string, description: string): TestCase {
    return {
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: description,
      type: 'unit',
      status: 'draft',
      code: `describe('${description}', () => {
  it('should be implemented', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});`,
      file: this.getTestFileName(filePath),
      line: 1,
      expectedBehavior: description,
      createdAt: new Date(),
    };
  }
}

// ============================================================================
// Code Analysis Functions
// ============================================================================

/**
 * Simple regex-based code analysis
 * In production, this would use the TypeScript compiler API
 */
export function analyzeSourceCode(sourceCode: string, filePath: string): AnalyzedClass[] {
  const classes: AnalyzedClass[] = [];

  // Find class definitions
  const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = classRegex.exec(sourceCode)) !== null) {
    const className = match[1];
    const startIndex = match.index;
    const line = sourceCode.substring(0, startIndex).split('\n').length;

    // Find class body (simplified - assumes balanced braces)
    const classBody = extractClassBody(sourceCode, startIndex);

    const classInfo: AnalyzedClass = {
      name: className,
      filePath,
      methods: extractMethods(classBody, line),
      dependencies: extractDependencies(classBody),
      line,
    };

    classes.push(classInfo);
  }

  return classes;
}

/**
 * Extract class body (simplified)
 */
function extractClassBody(source: string, startIndex: number): string {
  let braceCount = 0;
  let started = false;
  let endIndex = startIndex;

  for (let i = startIndex; i < source.length; i++) {
    if (source[i] === '{') {
      braceCount++;
      started = true;
    } else if (source[i] === '}') {
      braceCount--;
      if (started && braceCount === 0) {
        endIndex = i;
        break;
      }
    }
  }

  return source.substring(startIndex, endIndex + 1);
}

/**
 * Extract methods from class body
 */
function extractMethods(classBody: string, baseLine: number): AnalyzedMethod[] {
  const methods: AnalyzedMethod[] = [];

  // Match method definitions
  const methodRegex = /(?:async\s+)?(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = methodRegex.exec(classBody)) !== null) {
    const methodName = match[1];
    const paramsStr = match[2];
    const returnType = match[3];
    const isAsync = classBody.substring(match.index, match.index + 5) === 'async';
    const isPublic = !classBody.substring(match.index, match.index + 20).includes('private');

    const line = baseLine + classBody.substring(0, match.index).split('\n').length;

    methods.push({
      name: methodName,
      isAsync,
      parameters: parseParameters(paramsStr),
      returnType,
      isPublic,
      line,
    });
  }

  return methods;
}

/**
 * Parse parameter string
 */
function parseParameters(paramsStr: string): ParameterInfo[] {
  if (!paramsStr.trim()) return [];

  return paramsStr.split(',').map(param => {
    const trimmed = param.trim();
    const optional = trimmed.includes('?');
    const [name, type] = trimmed
      .replace('?', '')
      .split(':')
      .map(s => s.trim());

    return {
      name,
      type,
      optional,
    };
  });
}

/**
 * Extract constructor dependencies
 */
function extractDependencies(classBody: string): ParameterInfo[] {
  const constructorMatch = classBody.match(/constructor\s*\(([^)]*)\)/);
  if (constructorMatch) {
    return parseParameters(constructorMatch[1]);
  }
  return [];
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Group tests by type
 */
export function groupTestsByType(tests: TestCase[]): Record<TestCaseType, TestCase[]> {
  const groups: Record<TestCaseType, TestCase[]> = {
    unit: [],
    integration: [],
    e2e: [],
    property: [],
    benchmark: [],
  };

  for (const test of tests) {
    groups[test.type].push(test);
  }

  return groups;
}

/**
 * Filter tests by status
 */
export function filterTestsByStatus(
  tests: TestCase[],
  status: TestCaseStatus
): TestCase[] {
  return tests.filter(t => t.status === status);
}

/**
 * Sort tests by priority (failed first, then pending, then passed)
 */
export function sortTestsByPriority(tests: TestCase[]): TestCase[] {
  const priority: Record<TestCaseStatus, number> = {
    error: 0,
    failed: 1,
    pending: 2,
    running: 3,
    draft: 4,
    skipped: 5,
    passed: 6,
  };

  return [...tests].sort((a, b) => priority[a.status] - priority[b.status]);
}

/**
 * Generate test file content from test cases
 */
export function generateTestFileContent(
  tests: TestCase[],
  imports: string[] = []
): string {
  const importStatements = imports.length > 0
    ? imports.join('\n') + '\n\n'
    : '';

  const testCode = tests.map(t => t.code).join('\n\n');

  return `${importStatements}${testCode}`;
}
