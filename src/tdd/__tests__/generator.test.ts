/**
 * Test generator tests for TDD module
 */

import {
  TestGenerator,
  analyzeSourceCode,
  groupTestsByType,
  filterTestsByStatus,
  sortTestsByPriority,
  generateTestFileContent,
  DEFAULT_GENERATION_CONFIG,
} from '../generator';
import type { TestCase, TestCaseType, TDDPlan } from '../types';

describe('TestGenerator', () => {
  let generator: TestGenerator;

  beforeEach(() => {
    generator = new TestGenerator();
  });

  describe('constructor', () => {
    it('should use default config when none provided', () => {
      const gen = new TestGenerator();
      expect(gen).toBeDefined();
    });

    it('should merge provided config with defaults', () => {
      const gen = new TestGenerator({ publicOnly: false });
      expect(gen).toBeDefined();
    });
  });

  describe('generateTestsForClass', () => {
    const mockPlan: TDDPlan = {
      id: 'plan-1',
      name: 'Test Plan',
      description: 'Test',
      targetFiles: ['src/example.ts'],
      testFiles: ['src/example.test.ts'],
      cycles: [],
      testCases: [],
      coverageConfig: {
        enabled: true,
        thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
        include: ['src/**/*.ts'],
        exclude: [],
        reporter: ['text'],
        outputDir: './coverage',
      },
      coverageReports: [],
      metadata: {
        version: '1.0.0',
        tags: [],
        enforceCoverage: true,
        targetCoverage: 80,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockClass = {
      name: 'ExampleClass',
      filePath: 'src/example.ts',
      methods: [
        {
          name: 'doSomething',
          isAsync: false,
          parameters: [{ name: 'input', type: 'string', optional: false }],
          returnType: 'string',
          isPublic: true,
          line: 10,
        },
      ],
      dependencies: [],
      line: 1,
    };

    it('should generate tests for public methods', () => {
      const tests = generator.generateTestsForClass(mockClass, mockPlan);

      expect(tests.length).toBeGreaterThan(0);
      expect(tests[0].name).toContain('doSomething');
    });

    it('should not generate tests for private methods when publicOnly is true', () => {
      const privateClass = {
        ...mockClass,
        methods: [{ ...mockClass.methods[0], isPublic: false }],
      };

      const tests = generator.generateTestsForClass(privateClass, mockPlan);

      expect(tests.length).toBe(0);
    });

    it('should generate boundary tests when enabled', () => {
      const tests = generator.generateTestsForClass(mockClass, mockPlan);

      const boundaryTests = tests.filter(t =>
        t.name.toLowerCase().includes('boundary')
      );

      expect(boundaryTests.length).toBeGreaterThan(0);
    });

    it('should generate error handling tests when enabled', () => {
      const tests = generator.generateTestsForClass(mockClass, mockPlan);

      const errorTests = tests.filter(t =>
        t.name.toLowerCase().includes('error') ||
        t.name.toLowerCase().includes('throw')
      );

      expect(errorTests.length).toBeGreaterThan(0);
    });
  });

  describe('generateTestSuite', () => {
    const mockPlan: TDDPlan = {
      id: 'plan-1',
      name: 'Test Plan',
      description: 'Test',
      targetFiles: [],
      testFiles: ['test.ts'],
      cycles: [],
      testCases: [],
      coverageConfig: {
        enabled: true,
        thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
        include: [],
        exclude: [],
        reporter: ['text'],
        outputDir: './coverage',
      },
      coverageReports: [],
      metadata: {
        version: '1.0.0',
        tags: [],
        enforceCoverage: true,
        targetCoverage: 80,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should generate a test suite', () => {
      const suite = generator.generateTestSuite(mockPlan, 'My Suite');

      expect(suite.name).toBe('My Suite');
      expect(suite.description).toContain('Test Plan');
      expect(suite.filePattern).toBe('test.ts');
    });
  });

  describe('generateStubTest', () => {
    it('should generate a stub test', () => {
      const test = generator.generateStubTest('src/example.ts', 'Test description');

      expect(test.name).toBe('Test description');
      expect(test.status).toBe('draft');
      expect(test.code).toContain('describe');
      expect(test.file).toBe('src/example.test.ts');
    });
  });
});

describe('analyzeSourceCode', () => {
  it('should analyze a simple class', () => {
    const source = `class Example {
  greet(name: string): string {
    return 'Hello ' + name;
  }
}`;

    const classes = analyzeSourceCode(source, 'src/example.ts');

    expect(classes.length).toBe(1);
    expect(classes[0].name).toBe('Example');
    expect(classes[0].methods.length).toBe(1);
    expect(classes[0].methods[0].name).toBe('greet');
  });

  it('should detect async methods', () => {
    const source = `class Example {
  async fetchData(): Promise<string> {
    return 'data';
  }
}`;

    const classes = analyzeSourceCode(source, 'src/example.ts');

    expect(classes.length).toBeGreaterThan(0);
    expect(classes[0].methods.length).toBeGreaterThan(0);
    expect(classes[0].methods[0].isAsync).toBe(true);
  });

  it('should detect public vs private methods', () => {
    const source = `
      class Example {
        public publicMethod(): void {}
        private privateMethod(): void {}
      }
    `;

    const classes = analyzeSourceCode(source, 'src/example.ts');

    expect(classes[0].methods[0].isPublic).toBe(true);
    expect(classes[0].methods[1].isPublic).toBe(false);
  });

  it('should extract constructor dependencies', () => {
    const source = `
      class Example {
        constructor(private service: MyService, config: Config) {}
      }
    `;

    const classes = analyzeSourceCode(source, 'src/example.ts');

    expect(classes[0].dependencies.length).toBeGreaterThan(0);
  });

  it('should handle empty source', () => {
    const classes = analyzeSourceCode('', 'src/empty.ts');

    expect(classes).toEqual([]);
  });

  it('should handle source without classes', () => {
    const classes = analyzeSourceCode('const x = 1;', 'src/noclass.ts');

    expect(classes).toEqual([]);
  });
});

describe('test utilities', () => {
  const createTest = (
    id: string,
    name: string,
    type: TestCaseType,
    status: TestCase['status']
  ): TestCase => ({
    id,
    name,
    type,
    status,
    code: '',
    file: 'test.ts',
    expectedBehavior: name,
    createdAt: new Date(),
  });

  describe('groupTestsByType', () => {
    it('should group tests by type', () => {
      const tests: TestCase[] = [
        createTest('1', 'Unit 1', 'unit', 'passed'),
        createTest('2', 'Unit 2', 'unit', 'passed'),
        createTest('3', 'Integration 1', 'integration', 'passed'),
      ];

      const grouped = groupTestsByType(tests);

      expect(grouped.unit.length).toBe(2);
      expect(grouped.integration.length).toBe(1);
      expect(grouped.e2e.length).toBe(0);
    });
  });

  describe('filterTestsByStatus', () => {
    it('should filter tests by status', () => {
      const tests: TestCase[] = [
        createTest('1', 'Test 1', 'unit', 'passed'),
        createTest('2', 'Test 2', 'unit', 'failed'),
        createTest('3', 'Test 3', 'unit', 'passed'),
      ];

      const filtered = filterTestsByStatus(tests, 'passed');

      expect(filtered.length).toBe(2);
      expect(filtered.every(t => t.status === 'passed')).toBe(true);
    });
  });

  describe('sortTestsByPriority', () => {
    it('should sort tests by priority (failed first)', () => {
      const tests: TestCase[] = [
        createTest('1', 'Test 1', 'unit', 'passed'),
        createTest('2', 'Test 2', 'unit', 'failed'),
        createTest('3', 'Test 3', 'unit', 'pending'),
      ];

      const sorted = sortTestsByPriority(tests);

      expect(sorted[0].status).toBe('failed');
      expect(sorted[1].status).toBe('pending');
      expect(sorted[2].status).toBe('passed');
    });

    it('should sort error status first', () => {
      const tests: TestCase[] = [
        createTest('1', 'Test 1', 'unit', 'passed'),
        createTest('2', 'Test 2', 'unit', 'error'),
        createTest('3', 'Test 3', 'unit', 'failed'),
      ];

      const sorted = sortTestsByPriority(tests);

      expect(sorted[0].status).toBe('error');
    });
  });

  describe('generateTestFileContent', () => {
    it('should generate test file content', () => {
      const tests: TestCase[] = [
        { ...createTest('1', 'Test 1', 'unit', 'draft'), code: 'test("test 1", () => {});' },
        { ...createTest('2', 'Test 2', 'unit', 'draft'), code: 'test("test 2", () => {});' },
      ];

      const content = generateTestFileContent(tests);

      expect(content).toContain('test("test 1"');
      expect(content).toContain('test("test 2"');
    });

    it('should include imports when provided', () => {
      const tests: TestCase[] = [
        { ...createTest('1', 'Test 1', 'unit', 'draft'), code: 'test("test 1", () => {});' },
      ];

      const content = generateTestFileContent(tests, ["import { foo } from './foo';"]);

      expect(content).toContain("import { foo } from './foo';");
    });
  });
});
