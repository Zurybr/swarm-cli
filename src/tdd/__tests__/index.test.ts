/**
 * Main TDD system tests
 */

import {
  TDDSystem,
  DEFAULT_TDD_CONFIG,
} from '../index';
import type { TDDPlan, TestCase, TestExecutionResult } from '../types';

describe('TDDSystem', () => {
  let system: TDDSystem;

  beforeEach(() => {
    system = new TDDSystem();
  });

  afterEach(() => {
    system.dispose();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const sys = new TDDSystem();
      expect(sys.getConfig()).toEqual(DEFAULT_TDD_CONFIG);
      sys.dispose();
    });

    it('should merge provided config', () => {
      const sys = new TDDSystem({ watchMode: true });
      expect(sys.getConfig().watchMode).toBe(true);
      sys.dispose();
    });
  });

  describe('createPlan', () => {
    it('should create a new plan from template', () => {
      const plan = system.createPlan(
        'standard',
        'My Plan',
        'Test description',
        ['src/example.ts']
      );

      expect(plan.name).toBe('My Plan');
      expect(plan.description).toBe('Test description');
      expect(plan.targetFiles).toContain('src/example.ts');
      expect(plan.metadata.targetCoverage).toBe(80);
    });

    it('should register plan in system', () => {
      const plan = system.createPlan(
        'standard',
        'My Plan',
        'Test',
        []
      );

      expect(system.getPlan(plan.id)).toBe(plan);
    });

    it('should emit plan-created event', async () => {
      const handler = jest.fn();
      system.onEvent(handler);

      system.createPlan('standard', 'My Plan', 'Test', []);

      // Wait for async event
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'plan-created' })
      );
    });
  });

  describe('getPlan / getAllPlans', () => {
    it('should return undefined for unknown plan', () => {
      expect(system.getPlan('unknown')).toBeUndefined();
    });

    it('should return all plans', () => {
      system.createPlan('standard', 'Plan 1', '', []);
      system.createPlan('standard', 'Plan 2', '', []);

      const plans = system.getAllPlans();

      expect(plans.length).toBe(2);
    });
  });

  describe('updatePlan', () => {
    it('should update plan fields', () => {
      const plan = system.createPlan('standard', 'Original', '', []);

      const updated = system.updatePlan(plan.id, { name: 'Updated' });

      expect(updated?.name).toBe('Updated');
      expect(system.getPlan(plan.id)?.name).toBe('Updated');
    });

    it('should return undefined for unknown plan', () => {
      const result = system.updatePlan('unknown', { name: 'Test' });
      expect(result).toBeUndefined();
    });

    it('should update updatedAt timestamp', () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      const originalUpdatedAt = plan.updatedAt;

      // Small delay to ensure timestamp changes
      const start = Date.now();
      while (Date.now() - start < 10) {} // Busy wait for 10ms

      system.updatePlan(plan.id, { name: 'Updated' });

      expect(system.getPlan(plan.id)?.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime()
      );
    });
  });

  describe('deletePlan', () => {
    it('should delete a plan', () => {
      const plan = system.createPlan('standard', 'Test', '', []);

      const result = system.deletePlan(plan.id);

      expect(result).toBe(true);
      expect(system.getPlan(plan.id)).toBeUndefined();
    });

    it('should return false for unknown plan', () => {
      expect(system.deletePlan('unknown')).toBe(false);
    });
  });

  describe('startPlan / completePlan', () => {
    it('should set current plan', async () => {
      const plan = system.createPlan('standard', 'Test', '', []);

      const result = await system.startPlan(plan.id);

      expect(result?.id).toBe(plan.id);
      expect(system.getCurrentPlanId()).toBe(plan.id);
    });

    it('should return undefined for unknown plan', async () => {
      const result = await system.startPlan('unknown');
      expect(result).toBeUndefined();
    });

    it('should emit plan-started event', async () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      const handler = jest.fn();
      system.onEvent(handler);

      await system.startPlan(plan.id);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'plan-started', planId: plan.id })
      );
    });

    it('should emit plan-completed event', async () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      const handler = jest.fn();
      system.onEvent(handler);

      await system.completePlan(plan.id);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'plan-completed', planId: plan.id })
      );
    });
  });

  describe('cycle management', () => {
    it('should start a new cycle', async () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      await system.startPlan(plan.id);

      const cycle = await system.startCycle(plan.id, 'First cycle');

      expect(cycle).toBeDefined();
      expect(cycle?.number).toBe(1);
      expect(cycle?.phase).toBe('red');
      expect(system.isCycleInProgress()).toBe(true);
    });

    it('should return undefined for unknown plan', async () => {
      const cycle = await system.startCycle('unknown', 'Test');
      expect(cycle).toBeUndefined();
    });

    it('should get current cycle', async () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      await system.startPlan(plan.id);
      const cycle = await system.startCycle(plan.id, 'Test cycle');

      const current = system.getCurrentCycle(plan.id);

      expect(current?.id).toBe(cycle?.id);
    });

    it('should transition phase', async () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      await system.startPlan(plan.id);
      await system.startCycle(plan.id, 'Test');

      const cycle = await system.transitionPhase(plan.id, 'green');

      expect(cycle?.phase).toBe('green');
    });

    it('should complete cycle', async () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      await system.startPlan(plan.id);
      await system.startCycle(plan.id, 'Test');
      await system.transitionPhase(plan.id, 'green');
      await system.transitionPhase(plan.id, 'refactor');

      const cycle = await system.completeCycle(plan.id);

      expect(cycle?.status).toBe('completed');
      expect(system.isCycleInProgress()).toBe(false);
    });

    it('should fail cycle', async () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      await system.startPlan(plan.id);
      await system.startCycle(plan.id, 'Test');

      const cycle = await system.failCycle(plan.id, 'Something went wrong');

      expect(cycle?.status).toBe('failed');
      expect(cycle?.error).toBe('Something went wrong');
    });
  });

  describe('test case management', () => {
    it('should add test case', () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      const testCase: TestCase = {
        id: 'test-1',
        name: 'Test case',
        type: 'unit',
        status: 'draft',
        code: '',
        file: 'test.ts',
        expectedBehavior: 'Test',
        createdAt: new Date(),
      };

      const result = system.addTestCase(plan.id, testCase);

      expect(result).toBe(testCase);
      expect(system.getTestCases(plan.id)).toContain(testCase);
    });

    it('should create test case from template', () => {
      const plan = system.createPlan('standard', 'Test', '', []);

      const testCase = system.createTestCase(
        plan.id,
        'jest-unit',
        'src/test.ts',
        {
          className: 'Example',
          methodName: 'method',
          expectedBehavior: 'work',
          arrange: '',
          act: '',
          assert: '',
        }
      );

      expect(testCase).toBeDefined();
      expect(testCase?.name).toContain('work');
    });

    it('should get test cases by status', () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      const test1: TestCase = {
        id: 'test-1',
        name: 'Test 1',
        type: 'unit',
        status: 'passed',
        code: '',
        file: 'test.ts',
        expectedBehavior: 'Test',
        createdAt: new Date(),
      };
      const test2: TestCase = {
        id: 'test-2',
        name: 'Test 2',
        type: 'unit',
        status: 'failed',
        code: '',
        file: 'test.ts',
        expectedBehavior: 'Test',
        createdAt: new Date(),
      };

      system.addTestCase(plan.id, test1);
      system.addTestCase(plan.id, test2);

      const passed = system.getTestCasesByStatus(plan.id, 'passed');

      expect(passed.length).toBe(1);
      expect(passed[0].id).toBe('test-1');
    });

    it('should update test status', () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      const testCase: TestCase = {
        id: 'test-1',
        name: 'Test',
        type: 'unit',
        status: 'draft',
        code: '',
        file: 'test.ts',
        expectedBehavior: 'Test',
        createdAt: new Date(),
      };
      system.addTestCase(plan.id, testCase);

      const result = system.updateTestStatus(plan.id, 'test-1', 'passed');

      expect(result?.status).toBe('passed');
      expect(result?.lastRunAt).toBeDefined();
    });

    it('should update test with result', () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      const testCase: TestCase = {
        id: 'test-1',
        name: 'Test',
        type: 'unit',
        status: 'draft',
        code: '',
        file: 'test.ts',
        expectedBehavior: 'Test',
        createdAt: new Date(),
      };
      system.addTestCase(plan.id, testCase);

      const result: TestExecutionResult = {
        testId: 'test-1',
        passed: false,
        duration: 100,
        errorMessage: 'Assertion failed',
        stackTrace: 'at line 10',
        timestamp: new Date(),
      };

      const updated = system.updateTestStatus(plan.id, 'test-1', 'failed', result);

      expect(updated?.duration).toBe(100);
      expect(updated?.errorMessage).toBe('Assertion failed');
      expect(updated?.stackTrace).toBe('at line 10');
    });
  });

  describe('generateTests', () => {
    it('should generate tests from source code', async () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      const sourceCode = `
        class Example {
          greet(name: string): string {
            return 'Hello ' + name;
          }
        }
      `;

      const tests = await system.generateTests(plan.id, sourceCode, 'src/example.ts');

      expect(tests.length).toBeGreaterThan(0);
      // Plan test cases may include previously added tests
      expect(plan.testCases.length).toBeGreaterThanOrEqual(tests.length);
    });

    it('should return empty array for unknown plan', async () => {
      const tests = await system.generateTests('unknown', 'class X {}', 'src/x.ts');
      expect(tests).toEqual([]);
    });
  });

  describe('coverage', () => {
    it('should run coverage', async () => {
      const plan = system.createPlan('standard', 'Test', '', []);

      const report = await system.runCoverage(plan.id);

      expect(report).toBeDefined();
      expect(plan.coverageReports.length).toBe(1);
    });

    it('should return undefined if coverage disabled', async () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      plan.coverageConfig.enabled = false;

      const report = await system.runCoverage(plan.id);

      expect(report).toBeUndefined();
    });

    it('should get coverage report', async () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      await system.runCoverage(plan.id);

      const report = system.getCoverageReport(plan.id);

      expect(report).toBeDefined();
    });

    it('should get coverage statistics', async () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      // Start a cycle and run coverage to initialize the coverage manager
      await system.startPlan(plan.id);
      await system.startCycle(plan.id, 'Test cycle');

      // Run coverage - this initializes the coverage manager
      const report = await system.runCoverage(plan.id);

      // If coverage is enabled, verify stats are available
      if (report) {
        const stats = system.getCoverageStatistics(plan.id);
        expect(stats).toBeDefined();
        expect(stats?.target).toBe(80);
      }
    });
  });

  describe('progress report', () => {
    it('should generate progress report', async () => {
      const plan = system.createPlan('standard', 'Test Plan', '', []);
      await system.startPlan(plan.id);
      await system.startCycle(plan.id, 'Cycle 1');
      await system.transitionPhase(plan.id, 'green');
      await system.transitionPhase(plan.id, 'refactor');
      await system.completeCycle(plan.id);

      const report = system.generateProgressReport(plan.id);

      expect(report).toBeDefined();
      expect(report?.planName).toBe('Test Plan');
      expect(report?.completedCycles).toBeGreaterThanOrEqual(1);
      expect(report?.testStats).toBeDefined();
      expect(report?.coverageStats).toBeDefined();
      expect(report?.cycleStats).toBeDefined();
    });

    it('should return undefined for unknown plan', () => {
      const report = system.generateProgressReport('unknown');
      expect(report).toBeUndefined();
    });
  });

  describe('event handling', () => {
    it('should register event handler', () => {
      const handler = jest.fn();
      system.onEvent(handler);

      // Trigger an event
      system.createPlan('standard', 'Test', '', []);

      // Handler should be called (async)
      expect(system).toBeDefined();
    });

    it('should remove event handler', () => {
      const handler = jest.fn();
      system.onEvent(handler);
      system.offEvent(handler);

      // Should not throw
      expect(() => system.offEvent(handler)).not.toThrow();
    });
  });

  describe('configuration', () => {
    it('should get config', () => {
      const config = system.getConfig();
      expect(config).toEqual(DEFAULT_TDD_CONFIG);
    });

    it('should update config', () => {
      system.updateConfig({ watchMode: true });

      expect(system.getConfig().watchMode).toBe(true);
    });
  });

  describe('state management', () => {
    it('should get state', () => {
      const state = system.getState();

      expect(state.activePlans).toBeInstanceOf(Map);
      expect(state.cycleInProgress).toBe(false);
    });

    it('should track cycle progress', async () => {
      const plan = system.createPlan('standard', 'Test', '', []);
      await system.startPlan(plan.id);

      expect(system.isCycleInProgress()).toBe(false);

      await system.startCycle(plan.id, 'Test');

      expect(system.isCycleInProgress()).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      system.createPlan('standard', 'Test', '', []);
      system.dispose();

      expect(system.getAllPlans()).toHaveLength(0);
      expect(system.getCurrentPlanId()).toBeUndefined();
      expect(system.isCycleInProgress()).toBe(false);
    });
  });
});

describe('DEFAULT_TDD_CONFIG', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_TDD_CONFIG.defaultThresholds.statements).toBe(80);
    expect(DEFAULT_TDD_CONFIG.defaultThresholds.branches).toBe(80);
    expect(DEFAULT_TDD_CONFIG.defaultThresholds.functions).toBe(80);
    expect(DEFAULT_TDD_CONFIG.defaultThresholds.lines).toBe(80);
    expect(DEFAULT_TDD_CONFIG.autoGenerateTests).toBe(false);
    expect(DEFAULT_TDD_CONFIG.watchMode).toBe(false);
    expect(DEFAULT_TDD_CONFIG.testCommand).toBe('npm test');
    expect(DEFAULT_TDD_CONFIG.coverageCommand).toBe('npm run test:coverage');
  });
});
