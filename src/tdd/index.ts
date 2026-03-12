/**
 * TDD (Test-Driven Development) System
 *
 * Main entry point for TDD plan type support. Provides a unified interface
 * for managing TDD plans, cycles, tests, and coverage.
 */

import type {
  TDDPlan,
  TDDCycle,
  TestCase,
  TestCaseStatus,
  TDDProgressReport,
  TDDEvent,
  TDDEventHandler,
  TDDSystemConfig,
  TDDSystemState,
  CoverageConfig,
  CoverageReport,
  TestExecutionResult,
  TDDTemplate,
  TestCaseType,
} from './types';

import { TDDCycleManager } from './cycle';
import { CoverageManager } from './coverage';
import { TestGenerator, TestGenerationConfig } from './generator';
import {
  createPlanFromTemplate,
  createTestFromTemplate,
  createCycleFromTemplate,
  TDD_TEMPLATES,
  getTemplate,
  getTestTemplate,
  applyTemplate,
  DEFAULT_COVERAGE_CONFIG,
} from './template';

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_TDD_CONFIG: TDDSystemConfig = {
  defaultThresholds: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
  autoGenerateTests: false,
  watchMode: false,
  testCommand: 'npm test',
  coverageCommand: 'npm run test:coverage',
  workingDir: process.cwd(),
};

// ============================================================================
// TDD System Class
// ============================================================================

export class TDDSystem {
  private config: TDDSystemConfig;
  private state: TDDSystemState;
  private cycleManager: TDDCycleManager;
  private coverageManager?: CoverageManager;
  private testGenerator: TestGenerator;
  private eventHandlers: TDDEventHandler[] = [];

  constructor(config: Partial<TDDSystemConfig> = {}) {
    this.config = { ...DEFAULT_TDD_CONFIG, ...config };
    this.state = {
      activePlans: new Map(),
      cycleInProgress: false,
      config: this.config,
    };
    this.cycleManager = new TDDCycleManager();
    this.testGenerator = new TestGenerator();

    // Forward cycle events
    this.cycleManager.onEvent(this.handleCycleEvent.bind(this));
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  private async handleCycleEvent(event: TDDEvent): Promise<void> {
    await this.emitEvent(event);
  }

  /**
   * Register an event handler
   */
  onEvent(handler: TDDEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Remove an event handler
   */
  offEvent(handler: TDDEventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index > -1) {
      this.eventHandlers.splice(index, 1);
    }
  }

  /**
   * Emit an event to all handlers
   */
  private async emitEvent(event: TDDEvent): Promise<void> {
    for (const handler of this.eventHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error('Error in TDD event handler:', error);
      }
    }
  }

  // ============================================================================
  // Plan Management
  // ============================================================================

  /**
   * Create a new TDD plan from a template
   */
  createPlan(
    templateName: string,
    name: string,
    description: string,
    targetFiles: string[],
    overrides: Partial<TDDPlan> = {}
  ): TDDPlan {
    const plan = createPlanFromTemplate(templateName, {
      name,
      description,
      targetFiles,
      ...overrides,
    });

    this.state.activePlans.set(plan.id, plan);

    // Initialize coverage manager if enabled
    if (plan.coverageConfig.enabled) {
      this.coverageManager = new CoverageManager(plan.coverageConfig);
    }

    this.emitEvent({
      type: 'plan-created',
      planId: plan.id,
      timestamp: new Date(),
    });

    return plan;
  }

  /**
   * Get a plan by ID
   */
  getPlan(id: string): TDDPlan | undefined {
    return this.state.activePlans.get(id);
  }

  /**
   * Get all active plans
   */
  getAllPlans(): TDDPlan[] {
    return Array.from(this.state.activePlans.values());
  }

  /**
   * Update a plan
   */
  updatePlan(id: string, updates: Partial<TDDPlan>): TDDPlan | undefined {
    const plan = this.state.activePlans.get(id);
    if (!plan) return undefined;

    Object.assign(plan, updates, { updatedAt: new Date() });
    return plan;
  }

  /**
   * Delete a plan
   */
  deletePlan(id: string): boolean {
    return this.state.activePlans.delete(id);
  }

  /**
   * Start a plan (set as current)
   */
  async startPlan(id: string): Promise<TDDPlan | undefined> {
    const plan = this.state.activePlans.get(id);
    if (!plan) return undefined;

    this.state.currentPlanId = id;

    await this.emitEvent({
      type: 'plan-started',
      planId: id,
      timestamp: new Date(),
    });

    return plan;
  }

  /**
   * Complete a plan
   */
  async completePlan(id: string): Promise<TDDPlan | undefined> {
    const plan = this.state.activePlans.get(id);
    if (!plan) return undefined;

    await this.emitEvent({
      type: 'plan-completed',
      planId: id,
      timestamp: new Date(),
    });

    return plan;
  }

  // ============================================================================
  // Cycle Management
  // ============================================================================

  /**
   * Start a new TDD cycle for a plan
   */
  async startCycle(
    planId: string,
    description: string,
    testCaseIds: string[] = []
  ): Promise<TDDCycle | undefined> {
    const plan = this.state.activePlans.get(planId);
    if (!plan) return undefined;

    const cycleNumber = plan.cycles.length + 1;
    const cycle = createCycleFromTemplate(cycleNumber, description, testCaseIds);

    plan.cycles.push(cycle);
    plan.currentCycle = cycle;
    plan.updatedAt = new Date();

    this.cycleManager.registerCycle(cycle);
    await this.cycleManager.startCycle(cycle.id, planId);

    this.state.cycleInProgress = true;

    return cycle;
  }

  /**
   * Get the current cycle for a plan
   */
  getCurrentCycle(planId: string): TDDCycle | undefined {
    const plan = this.state.activePlans.get(planId);
    return plan?.currentCycle;
  }

  /**
   * Transition to the next phase in the current cycle
   */
  async transitionPhase(planId: string, newPhase: TDDCycle['phase']): Promise<TDDCycle | undefined> {
    const plan = this.state.activePlans.get(planId);
    if (!plan || !plan.currentCycle) return undefined;

    return this.cycleManager.transitionPhase(
      plan.currentCycle.id,
      newPhase,
      planId
    );
  }

  /**
   * Complete the current cycle
   */
  async completeCycle(planId: string): Promise<TDDCycle | undefined> {
    const plan = this.state.activePlans.get(planId);
    if (!plan || !plan.currentCycle) return undefined;

    const cycle = await this.cycleManager.completeCycle(plan.currentCycle.id, planId);

    // Update plan state
    plan.currentCycle = undefined;
    plan.updatedAt = new Date();
    this.state.cycleInProgress = false;

    // Run coverage if enabled
    if (plan.coverageConfig.enabled && this.coverageManager) {
      await this.coverageManager.runCoverage(cycle.id);
    }

    return cycle;
  }

  /**
   * Fail the current cycle
   */
  async failCycle(planId: string, error: string): Promise<TDDCycle | undefined> {
    const plan = this.state.activePlans.get(planId);
    if (!plan || !plan.currentCycle) return undefined;

    return this.cycleManager.failCycle(plan.currentCycle.id, planId, error);
  }

  // ============================================================================
  // Test Case Management
  // ============================================================================

  /**
   * Add a test case to a plan
   */
  addTestCase(planId: string, testCase: TestCase): TestCase | undefined {
    const plan = this.state.activePlans.get(planId);
    if (!plan) return undefined;

    plan.testCases.push(testCase);
    plan.updatedAt = new Date();

    this.emitEvent({
      type: 'test-added',
      planId,
      testId: testCase.id,
      timestamp: new Date(),
    });

    return testCase;
  }

  /**
   * Create and add a test case from a template
   */
  createTestCase(
    planId: string,
    templateName: string,
    file: string,
    values: Record<string, string>,
    overrides: Partial<TestCase> = {}
  ): TestCase | undefined {
    const plan = this.state.activePlans.get(planId);
    if (!plan) return undefined;

    const testCase = createTestFromTemplate(templateName, file, values, overrides);
    return this.addTestCase(planId, testCase);
  }

  /**
   * Get all test cases for a plan
   */
  getTestCases(planId: string): TestCase[] {
    const plan = this.state.activePlans.get(planId);
    return plan?.testCases || [];
  }

  /**
   * Get test cases by status
   */
  getTestCasesByStatus(planId: string, status: TestCaseStatus): TestCase[] {
    return this.getTestCases(planId).filter(t => t.status === status);
  }

  /**
   * Update test case status
   */
  updateTestStatus(
    planId: string,
    testId: string,
    status: TestCaseStatus,
    result?: TestExecutionResult
  ): TestCase | undefined {
    const plan = this.state.activePlans.get(planId);
    if (!plan) return undefined;

    const testCase = plan.testCases.find(t => t.id === testId);
    if (!testCase) return undefined;

    testCase.status = status;
    testCase.lastRunAt = new Date();

    if (result) {
      testCase.duration = result.duration;
      if (!result.passed) {
        testCase.errorMessage = result.errorMessage;
        testCase.stackTrace = result.stackTrace;
      }
    }

    return testCase;
  }

  /**
   * Update test results for the current cycle
   */
  async updateTestResults(
    planId: string,
    results: TestExecutionResult[]
  ): Promise<TDDCycle | undefined> {
    const plan = this.state.activePlans.get(planId);
    if (!plan || !plan.currentCycle) return undefined;

    return this.cycleManager.updateTestResults(
      plan.currentCycle.id,
      planId,
      results
    );
  }

  // ============================================================================
  // Test Generation
  // ============================================================================

  /**
   * Auto-generate tests for source files
   */
  async generateTests(
    planId: string,
    sourceCode: string,
    filePath: string,
    config?: Partial<TestGenerationConfig>
  ): Promise<TestCase[]> {
    const plan = this.state.activePlans.get(planId);
    if (!plan) return [];

    if (config) {
      this.testGenerator = new TestGenerator(config);
    }

    const { analyzeSourceCode } = await import('./generator');
    const classes = analyzeSourceCode(sourceCode, filePath);

    const tests: TestCase[] = [];
    for (const classInfo of classes) {
      const classTests = this.testGenerator.generateTestsForClass(classInfo, plan);
      for (const test of classTests) {
        this.addTestCase(planId, test);
        tests.push(test);
      }
    }

    return tests;
  }

  // ============================================================================
  // Coverage Management
  // ============================================================================

  /**
   * Run coverage analysis
   */
  async runCoverage(planId: string): Promise<CoverageReport | undefined> {
    const plan = this.state.activePlans.get(planId);
    if (!plan || !plan.coverageConfig.enabled) return undefined;

    if (!this.coverageManager) {
      this.coverageManager = new CoverageManager(plan.coverageConfig);
    }

    const cycleId = plan.currentCycle?.id;
    const report = await this.coverageManager.runCoverage(cycleId);

    plan.coverageReports.push(report);
    plan.updatedAt = new Date();

    await this.emitEvent({
      type: 'coverage-updated',
      planId,
      timestamp: new Date(),
      data: { report },
    });

    if (!report.thresholdsMet) {
      await this.emitEvent({
        type: 'threshold-violated',
        planId,
        timestamp: new Date(),
        data: { violations: report.violations },
      });
    }

    return report;
  }

  /**
   * Get the latest coverage report
   */
  getCoverageReport(planId: string): CoverageReport | undefined {
    const plan = this.state.activePlans.get(planId);
    if (!plan || plan.coverageReports.length === 0) return undefined;

    return plan.coverageReports[plan.coverageReports.length - 1];
  }

  /**
   * Get coverage statistics
   */
  getCoverageStatistics(planId: string) {
    const plan = this.state.activePlans.get(planId);
    if (!plan || !this.coverageManager) return undefined;

    return this.coverageManager.getCoverageStatistics(plan.metadata.targetCoverage);
  }

  // ============================================================================
  // Progress Reporting
  // ============================================================================

  /**
   * Generate a progress report for a plan
   */
  generateProgressReport(planId: string): TDDProgressReport | undefined {
    const plan = this.state.activePlans.get(planId);
    if (!plan) return undefined;

    const completedCycles = plan.cycles.filter(c => c.status === 'completed').length;
    const totalCycles = plan.cycles.length;
    const currentCycle = plan.currentCycle?.number || completedCycles;

    // Calculate test statistics
    const testStats = this.calculateTestStatistics(plan.testCases);

    // Get coverage statistics
    const coverageStats = this.coverageManager
      ? this.coverageManager.getCoverageStatistics(plan.metadata.targetCoverage)
      : {
          statements: 0,
          branches: 0,
          functions: 0,
          lines: 0,
          target: plan.metadata.targetCoverage,
          targetMet: false,
        };

    // Get cycle statistics
    const cycleStats = this.cycleManager.getCycleStatistics();

    // Calculate overall progress
    const cycleProgress = totalCycles > 0 ? (completedCycles / totalCycles) * 100 : 0;
    const testProgress = testStats.total > 0
      ? (testStats.passed / testStats.total) * 100
      : 0;
    const coverageProgress = coverageStats.target > 0
      ? Math.min((coverageStats.lines / coverageStats.target) * 100, 100)
      : 0;

    const overallProgress = Math.round((cycleProgress + testProgress + coverageProgress) / 3);

    return {
      planId,
      planName: plan.name,
      overallProgress,
      currentCycle,
      totalCycles,
      completedCycles,
      testStats,
      coverageStats,
      cycleStats,
      generatedAt: new Date(),
    };
  }

  private calculateTestStatistics(tests: TestCase[]) {
    const total = tests.length;
    const passed = tests.filter(t => t.status === 'passed').length;
    const failed = tests.filter(t => t.status === 'failed' || t.status === 'error').length;
    const pending = tests.filter(t => t.status === 'pending' || t.status === 'draft').length;
    const skipped = tests.filter(t => t.status === 'skipped').length;

    const durations = tests
      .filter(t => t.duration !== undefined)
      .map(t => t.duration!);

    const averageDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return {
      total,
      passed,
      failed,
      pending,
      skipped,
      averageDuration,
    };
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Get current configuration
   */
  getConfig(): TDDSystemConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TDDSystemConfig>): void {
    this.config = { ...this.config, ...config };
    this.state.config = this.config;
  }

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Get current system state
   */
  getState(): TDDSystemState {
    return {
      activePlans: new Map(this.state.activePlans),
      currentPlanId: this.state.currentPlanId,
      cycleInProgress: this.state.cycleInProgress,
      config: { ...this.state.config },
    };
  }

  /**
   * Check if a cycle is in progress
   */
  isCycleInProgress(): boolean {
    return this.state.cycleInProgress;
  }

  /**
   * Get the current plan ID
   */
  getCurrentPlanId(): string | undefined {
    return this.state.currentPlanId;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clean up resources
   */
  dispose(): void {
    this.eventHandlers = [];
    this.cycleManager = new TDDCycleManager();
    this.coverageManager = undefined;
    this.state.activePlans.clear();
    this.state.currentPlanId = undefined;
    this.state.cycleInProgress = false;
  }
}

// ============================================================================
// Exports
// ============================================================================

export * from './types';
export * from './template';
export { TDDCycleManager } from './cycle';
export { CoverageManager, TrendDataPoint } from './coverage';
export { TestGenerator, TestGenerationConfig, AnalyzedClass, AnalyzedMethod } from './generator';
export { TDDExecutor, JestTestRunner, TestRunner, TestRunResult } from './tdd-executor';

export { TDDSystem as default } from './index';
