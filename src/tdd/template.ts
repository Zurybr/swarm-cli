/**
 * TDD Plan Templates
 *
 * Provides default templates for TDD plans, test cases, and configurations.
 */

import type {
  TDDTemplate,
  TestCaseTemplate,
  TDDPlan,
  CoverageConfig,
  CoverageThresholds,
  TDDPlanMetadata,
  TestCase,
  TDDCycle,
} from './types.js';

// ============================================================================
// Default Coverage Thresholds
// ============================================================================

/**
 * Default coverage thresholds - 80% minimum
 */
export const DEFAULT_COVERAGE_THRESHOLDS: CoverageThresholds = {
  statements: 80,
  branches: 80,
  functions: 80,
  lines: 80,
};

/**
 * Strict coverage thresholds - 90% minimum
 */
export const STRICT_COVERAGE_THRESHOLDS: CoverageThresholds = {
  statements: 90,
  branches: 90,
  functions: 90,
  lines: 90,
};

/**
 * Minimal coverage thresholds - 50% minimum
 */
export const MINIMAL_COVERAGE_THRESHOLDS: CoverageThresholds = {
  statements: 50,
  branches: 50,
  functions: 50,
  lines: 50,
};

// ============================================================================
// Default Coverage Configuration
// ============================================================================

/**
 * Default coverage configuration
 */
export const DEFAULT_COVERAGE_CONFIG: CoverageConfig = {
  enabled: true,
  thresholds: DEFAULT_COVERAGE_THRESHOLDS,
  include: ['src/**/*.ts'],
  exclude: [
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
    'src/**/__tests__/**',
    'src/**/__mocks__/**',
    'dist/**',
    'node_modules/**',
  ],
  reporter: ['text', 'json', 'html'],
  outputDir: './coverage',
};

// ============================================================================
// Test Case Templates
// ============================================================================

/**
 * Unit test template for Jest
 */
export const JEST_UNIT_TEST_TEMPLATE: TestCaseTemplate = {
  name: 'jest-unit',
  type: 'unit',
  template: `describe('{{className}}', () => {
  describe('{{methodName}}', () => {
    it('should {{expectedBehavior}}', () => {
      // Arrange
      {{arrange}}

      // Act
      {{act}}

      // Assert
      {{assert}}
    });
  });
});`,
  description: 'Standard Jest unit test template with arrange-act-assert pattern',
  placeholders: ['className', 'methodName', 'expectedBehavior', 'arrange', 'act', 'assert'],
};

/**
 * Integration test template for Jest
 */
export const JEST_INTEGRATION_TEST_TEMPLATE: TestCaseTemplate = {
  name: 'jest-integration',
  type: 'integration',
  template: `describe('{{featureName}} Integration', () => {
  beforeAll(async () => {
    {{setup}}
  });

  afterAll(async () => {
    {{teardown}}
  });

  it('should {{expectedBehavior}}', async () => {
    // Given
    {{given}}

    // When
    {{when}}

    // Then
    {{then}}
  });
});`,
  description: 'Jest integration test template with setup/teardown',
  placeholders: ['featureName', 'setup', 'teardown', 'expectedBehavior', 'given', 'when', 'then'],
};

/**
 * Property-based test template
 */
export const PROPERTY_TEST_TEMPLATE: TestCaseTemplate = {
  name: 'property-based',
  type: 'property',
  template: `describe('{{propertyName}}', () => {
  it('should satisfy {{property}} for all inputs', () => {
    fc.assert(
      fc.property({{arbitrary}}, ({{input}}) => {
        {{assertion}}
      })
    );
  });
});`,
  description: 'Property-based test using fast-check',
  placeholders: ['propertyName', 'property', 'arbitrary', 'input', 'assertion'],
};

/**
 * Error handling test template
 */
export const ERROR_TEST_TEMPLATE: TestCaseTemplate = {
  name: 'error-handling',
  type: 'unit',
  template: `describe('{{className}} - Error Handling', () => {
  it('should throw {{errorType}} when {{condition}}', () => {
    // Arrange
    {{arrange}}

    // Act & Assert
    expect(() => {
      {{act}}
    }).toThrow({{errorType}});
  });

  it('should handle {{errorType}} gracefully', async () => {
    // Arrange
    {{arrange}}

    // Act
    {{act}}

    // Assert
    {{assert}}
  });
});`,
  description: 'Test template for error handling scenarios',
  placeholders: ['className', 'errorType', 'condition', 'arrange', 'act', 'assert'],
};

/**
 * Boundary test template
 */
export const BOUNDARY_TEST_TEMPLATE: TestCaseTemplate = {
  name: 'boundary',
  type: 'unit',
  template: `describe('{{className}} - Boundary Conditions', () => {
  it('should handle minimum value {{minValue}}', () => {
    {{testCode}}
  });

  it('should handle maximum value {{maxValue}}', () => {
    {{testCode}}
  });

  it('should handle empty input', () => {
    {{emptyTestCode}}
  });

  it('should handle null/undefined input', () => {
    {{nullTestCode}}
  });
});`,
  description: 'Test template for boundary value analysis',
  placeholders: ['className', 'minValue', 'maxValue', 'testCode', 'emptyTestCode', 'nullTestCode'],
};

/**
 * All available test templates
 */
export const TEST_TEMPLATES: TestCaseTemplate[] = [
  JEST_UNIT_TEST_TEMPLATE,
  JEST_INTEGRATION_TEST_TEMPLATE,
  PROPERTY_TEST_TEMPLATE,
  ERROR_TEST_TEMPLATE,
  BOUNDARY_TEST_TEMPLATE,
];

// ============================================================================
// TDD Plan Templates
// ============================================================================

/**
 * Standard TDD plan template
 */
export const STANDARD_TDD_TEMPLATE: TDDTemplate = {
  name: 'standard',
  description: 'Standard TDD plan with red-green-refactor cycles',
  plan: {
    metadata: {
      version: '1.0.0',
      tags: ['tdd', 'unit-tests'],
      enforceCoverage: true,
      targetCoverage: 80,
    } as TDDPlanMetadata,
    cycles: [],
    testCases: [],
    coverageReports: [],
  },
  testCaseTemplates: TEST_TEMPLATES,
  coverageConfig: DEFAULT_COVERAGE_CONFIG,
};

/**
 * Strict TDD plan template with higher coverage requirements
 */
export const STRICT_TDD_TEMPLATE: TDDTemplate = {
  name: 'strict',
  description: 'Strict TDD plan with 90% coverage requirement',
  plan: {
    metadata: {
      version: '1.0.0',
      tags: ['tdd', 'strict', 'high-coverage'],
      enforceCoverage: true,
      targetCoverage: 90,
    } as TDDPlanMetadata,
    cycles: [],
    testCases: [],
    coverageReports: [],
  },
  testCaseTemplates: TEST_TEMPLATES,
  coverageConfig: {
    ...DEFAULT_COVERAGE_CONFIG,
    thresholds: STRICT_COVERAGE_THRESHOLDS,
  },
};

/**
 * Integration-focused TDD plan template
 */
export const INTEGRATION_TDD_TEMPLATE: TDDTemplate = {
  name: 'integration',
  description: 'TDD plan focused on integration testing',
  plan: {
    metadata: {
      version: '1.0.0',
      tags: ['tdd', 'integration-tests'],
      enforceCoverage: true,
      targetCoverage: 70,
    } as TDDPlanMetadata,
    cycles: [],
    testCases: [],
    coverageReports: [],
  },
  testCaseTemplates: [JEST_INTEGRATION_TEST_TEMPLATE, JEST_UNIT_TEST_TEMPLATE],
  coverageConfig: {
    ...DEFAULT_COVERAGE_CONFIG,
    thresholds: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
};

/**
 * All available TDD templates
 */
export const TDD_TEMPLATES: TDDTemplate[] = [
  STANDARD_TDD_TEMPLATE,
  STRICT_TDD_TEMPLATE,
  INTEGRATION_TDD_TEMPLATE,
];

// ============================================================================
// Template Functions
// ============================================================================

/**
 * Get a template by name
 */
export function getTemplate(name: string): TDDTemplate | undefined {
  return TDD_TEMPLATES.find(t => t.name === name);
}

/**
 * Get a test case template by name
 */
export function getTestTemplate(name: string): TestCaseTemplate | undefined {
  return TEST_TEMPLATES.find(t => t.name === name);
}

/**
 * Apply template placeholders to generate test code
 */
export function applyTemplate(
  template: TestCaseTemplate,
  values: Record<string, string>
): string {
  let result = template.template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

/**
 * Create a new TDD plan from a template
 */
export function createPlanFromTemplate(
  templateName: string,
  overrides: Partial<TDDPlan> = {}
): TDDPlan {
  const template = getTemplate(templateName) || STANDARD_TDD_TEMPLATE;
  const now = new Date();

  return {
    id: generatePlanId(),
    name: 'Untitled TDD Plan',
    description: '',
    targetFiles: [],
    testFiles: [],
    cycles: [],
    testCases: [],
    coverageConfig: template.coverageConfig,
    coverageReports: [],
    metadata: {
      version: '1.0.0',
      tags: [],
      enforceCoverage: true,
      targetCoverage: 80,
      ...template.plan.metadata,
    },
    createdAt: now,
    updatedAt: now,
    ...template.plan,
    ...overrides,
  };
}

/**
 * Create a new test case from a template
 */
export function createTestFromTemplate(
  templateName: string,
  file: string,
  values: Record<string, string>,
  overrides: Partial<TestCase> = {}
): TestCase {
  const template = getTestTemplate(templateName) || JEST_UNIT_TEST_TEMPLATE;
  const now = new Date();

  return {
    id: generateTestId(),
    name: values.expectedBehavior || 'Untitled Test',
    type: template.type,
    status: 'draft',
    code: applyTemplate(template, values),
    file,
    expectedBehavior: values.expectedBehavior || '',
    createdAt: now,
    ...overrides,
  };
}

/**
 * Create a new TDD cycle from template
 */
export function createCycleFromTemplate(
  number: number,
  description: string,
  testCaseIds: string[] = [],
  overrides: Partial<TDDCycle> = {}
): TDDCycle {
  return {
    id: generateCycleId(),
    number,
    phase: 'red',
    status: 'pending',
    testCases: testCaseIds,
    description,
    phaseTimestamps: {},
    phaseDurations: { red: 0, green: 0, refactor: 0, total: 0 },
    testsPassing: false,
    ...overrides,
  };
}

// ============================================================================
// ID Generation
// ============================================================================

let planCounter = 0;
let cycleCounter = 0;
let testCounter = 0;

/**
 * Generate a unique plan ID
 */
export function generatePlanId(): string {
  return `tdd-plan-${Date.now()}-${++planCounter}`;
}

/**
 * Generate a unique cycle ID
 */
export function generateCycleId(): string {
  return `tdd-cycle-${Date.now()}-${++cycleCounter}`;
}

/**
 * Generate a unique test ID
 */
export function generateTestId(): string {
  return `tdd-test-${Date.now()}-${++testCounter}`;
}

/**
 * Reset ID counters (useful for testing)
 */
export function resetIdCounters(): void {
  planCounter = 0;
  cycleCounter = 0;
  testCounter = 0;
}
