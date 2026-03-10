/**
 * Tests for backward verification checker
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  VerificationChecker,
  verifyGoalBackward,
  verifyGoalsBackward,
  verifyWithSteps,
  analyzeGaps,
  getBlockingGaps,
  estimateRemediationEffort,
} from '../checker';
import { GoalBuilder, MustHaveBuilder } from '../goal';
import { existenceMustHave, valueMustHave } from '../must-have';
import type { Goal, BackwardVerificationContext } from '../types';

describe('Backward Verification Checker', () => {
  let tempDir: string;
  let checker: VerificationChecker;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'checker-test-'));
    checker = new VerificationChecker({ workingDir: tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('verifyGoalBackward', () => {
    it('should verify a goal with all must-haves satisfied', async () => {
      // Create test files
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content');

      const goal = new GoalBuilder()
        .withTitle('Test Goal')
        .withDescription('All must-haves pass')
        .withMustHave((b) => b.existence('file1.txt', 'File 1 exists'))
        .withMustHave((b) => b.existence('file2.txt', 'File 2 exists'))
        .build();

      const context: BackwardVerificationContext = {
        workingDir: tempDir,
        env: {},
        stopOnFailure: false,
        checkTimeout: 30000,
        maxDepth: 10,
        gaps: [],
      };

      const result = await verifyGoalBackward(goal, context);

      expect(result.achieved).toBe(true);
      expect(result.completionPercentage).toBe(100);
      expect(result.gaps).toHaveLength(0);
      expect(result.stats.satisfied).toBe(2);
      expect(result.stats.failed).toBe(0);
    });

    it('should identify gaps when must-haves fail', async () => {
      const goal = new GoalBuilder()
        .withTitle('Failing Goal')
        .withDescription('Some must-haves fail')
        .withMustHave((b) => b.existence('missing1.txt', 'File 1 exists'))
        .withMustHave((b) => b.existence('missing2.txt', 'File 2 exists'))
        .build();

      const context: BackwardVerificationContext = {
        workingDir: tempDir,
        env: {},
        stopOnFailure: false,
        checkTimeout: 30000,
        maxDepth: 10,
        gaps: [],
      };

      const result = await verifyGoalBackward(goal, context);

      expect(result.achieved).toBe(false);
      expect(result.gaps).toHaveLength(2);
      expect(result.stats.failed).toBe(2);
    });

    it('should prioritize required must-haves over optional', async () => {
      const goal = new GoalBuilder()
        .withTitle('Mixed Goal')
        .withDescription('Required and optional must-haves')
        .withMustHave((b) =>
          b.existence('required.txt', 'Required file').required(true).withWeight(0.9)
        )
        .withMustHave((b) =>
          b.existence('optional.txt', 'Optional file').required(false).withWeight(0.1)
        )
        .build();

      const context: BackwardVerificationContext = {
        workingDir: tempDir,
        env: {},
        stopOnFailure: false,
        checkTimeout: 30000,
        maxDepth: 10,
        gaps: [],
      };

      const result = await verifyGoalBackward(goal, context);

      // Required must-have fails, so goal not achieved
      expect(result.achieved).toBe(false);
      // But optional can fail without blocking
      expect(result.gaps.some((g) => g.blocking)).toBe(true);
    });

    it('should calculate weighted completion percentage', async () => {
      await fs.writeFile(path.join(tempDir, 'heavy.txt'), 'content');

      const goal = new GoalBuilder()
        .withTitle('Weighted Goal')
        .withDescription('Different weights')
        .withMustHave((b) =>
          b.existence('heavy.txt', 'Heavy file').withWeight(0.8)
        )
        .withMustHave((b) =>
          b.existence('light.txt', 'Light file').withWeight(0.2)
        )
        .build();

      const context: BackwardVerificationContext = {
        workingDir: tempDir,
        env: {},
        stopOnFailure: false,
        checkTimeout: 30000,
        maxDepth: 10,
        gaps: [],
      };

      const result = await verifyGoalBackward(goal, context);

      // 80% of weighted must-haves satisfied
      expect(result.completionPercentage).toBe(80);
      expect(result.stats.weightedSatisfaction).toBe(80);
    });

    it('should stop on first failure when configured', async () => {
      const goal = new GoalBuilder()
        .withTitle('Stop Early')
        .withDescription('Stop on first failure')
        .withMustHave((b) => b.existence('missing1.txt', 'First missing'))
        .withMustHave((b) => b.existence('missing2.txt', 'Second missing'))
        .build();

      const context: BackwardVerificationContext = {
        workingDir: tempDir,
        env: {},
        stopOnFailure: true,
        checkTimeout: 30000,
        maxDepth: 10,
        gaps: [],
      };

      const result = await verifyGoalBackward(goal, context);

      // Should stop after first failure
      expect(result.mustHaveResults).toHaveLength(1);
      expect(result.gaps).toHaveLength(1);
    });

    it('should update goal status after verification', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

      const goal = new GoalBuilder()
        .withTitle('Status Update')
        .withDescription('Status should be updated')
        .withMustHave((b) => b.existence('test.txt', 'File exists'))
        .build();

      expect(goal.status).toBe('pending');

      const context: BackwardVerificationContext = {
        workingDir: tempDir,
        env: {},
        stopOnFailure: false,
        checkTimeout: 30000,
        maxDepth: 10,
        gaps: [],
      };

      await verifyGoalBackward(goal, context);

      expect(goal.status).toBe('verified');
    });
  });

  describe('verifyGoalsBackward', () => {
    it('should verify multiple goals', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content');

      const goal1 = new GoalBuilder()
        .withTitle('Goal 1')
        .withDescription('First goal')
        .withMustHave((b) => b.existence('file1.txt', 'File 1 exists'))
        .build();

      const goal2 = new GoalBuilder()
        .withTitle('Goal 2')
        .withDescription('Second goal')
        .withMustHave((b) => b.existence('file2.txt', 'File 2 exists'))
        .build();

      const results = await verifyGoalsBackward([goal1, goal2], {
        workingDir: tempDir,
      });

      expect(results).toHaveLength(2);
      expect(results[0].achieved).toBe(true);
      expect(results[1].achieved).toBe(true);
    });

    it('should process leaf goals before parent goals', async () => {
      const parent = new GoalBuilder()
        .withTitle('Parent')
        .withDescription('Parent goal')
        .build();

      const child = new GoalBuilder()
        .withTitle('Child')
        .withDescription('Child goal')
        .withParent(parent.id)
        .build();

      // Parent has children, so it should be processed after child
      parent.children = [child.id];

      const results = await verifyGoalsBackward([parent, child], {
        workingDir: tempDir,
      });

      // Both should be verified (no must-haves)
      expect(results).toHaveLength(2);
    });
  });

  describe('verifyWithSteps', () => {
    it('should track verification steps', async () => {
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'content');

      const goal = new GoalBuilder()
        .withTitle('Step Tracking')
        .withDescription('Track verification steps')
        .withMustHave((b) => b.existence('file.txt', 'File exists'))
        .build();

      const { result, steps } = await verifyWithSteps(goal, {
        workingDir: tempDir,
      });

      expect(steps).toHaveLength(1);
      expect(steps[0].step).toBe(1);
      expect(steps[0].passed).toBe(true);
      expect(steps[0].duration).toBeGreaterThanOrEqual(0);
      expect(result.achieved).toBe(true);
    });

    it('should track multiple steps', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content');

      const goal = new GoalBuilder()
        .withTitle('Multiple Steps')
        .withDescription('Multiple must-haves')
        .withMustHave((b) => b.existence('file1.txt', 'File 1 exists'))
        .withMustHave((b) => b.existence('file2.txt', 'File 2 exists'))
        .build();

      const { steps } = await verifyWithSteps(goal, {
        workingDir: tempDir,
      });

      expect(steps).toHaveLength(2);
      expect(steps[0].step).toBe(1);
      expect(steps[1].step).toBe(2);
    });
  });

  describe('VerificationChecker class', () => {
    it('should verify a single goal', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

      const goal = new GoalBuilder()
        .withTitle('Test')
        .withDescription('Test goal')
        .withMustHave((b) => b.existence('test.txt', 'File exists'))
        .build();

      const result = await checker.verify(goal);

      expect(result.achieved).toBe(true);
    });

    it('should verify multiple goals', async () => {
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'content');

      const goal1 = new GoalBuilder()
        .withTitle('Goal 1')
        .withDescription('First')
        .withMustHave((b) => b.existence('file.txt', 'File exists'))
        .build();

      const goal2 = new GoalBuilder()
        .withTitle('Goal 2')
        .withDescription('Second')
        .withMustHave((b) => b.existence('file.txt', 'File exists'))
        .build();

      const results = await checker.verifyAll([goal1, goal2]);

      expect(results).toHaveLength(2);
    });

    it('should update options', () => {
      checker.setOptions({ stopOnFailure: true, checkTimeout: 5000 });

      const context = checker.getContext();
      expect(context.stopOnFailure).toBe(true);
      expect(context.checkTimeout).toBe(5000);
    });
  });

  describe('Gap Analysis', () => {
    it('should analyze gaps across multiple results', () => {
      const results = [
        {
          goalId: 'goal-1',
          achieved: false,
          gaps: [
            {
              id: 'gap-1',
              description: 'Critical gap',
              severity: 'critical' as const,
              mustHaveId: 'mh-1',
              goalId: 'goal-1',
              expected: 'file.txt',
              blocking: true,
              identifiedAt: new Date(),
            },
            {
              id: 'gap-2',
              description: 'Minor gap',
              severity: 'minor' as const,
              mustHaveId: 'mh-2',
              goalId: 'goal-1',
              expected: 'other.txt',
              blocking: false,
              identifiedAt: new Date(),
            },
          ],
        } as any,
        {
          goalId: 'goal-2',
          achieved: false,
          gaps: [
            {
              id: 'gap-3',
              description: 'Major gap',
              severity: 'major' as const,
              mustHaveId: 'mh-3',
              goalId: 'goal-2',
              expected: 'config.txt',
              blocking: false,
              identifiedAt: new Date(),
            },
          ],
        } as any,
      ];

      const analysis = analyzeGaps(results);

      expect(analysis.totalGaps).toBe(3);
      expect(analysis.criticalGaps).toBe(1);
      expect(analysis.blockingGaps).toBe(1);
    });

    it('should get blocking gaps', () => {
      const results = [
        {
          goalId: 'goal-1',
          gaps: [
            {
              id: 'gap-1',
              severity: 'critical',
              blocking: true,
            },
            {
              id: 'gap-2',
              severity: 'minor',
              blocking: false,
            },
          ],
        } as any,
      ];

      const blocking = getBlockingGaps(results);

      expect(blocking).toHaveLength(1);
      expect(blocking[0].id).toBe('gap-1');
    });

    it('should estimate remediation effort', () => {
      const results = [
        {
          goalId: 'goal-1',
          gaps: [
            {
              id: 'gap-1',
              severity: 'critical',
              estimatedEffort: 8,
            },
            {
              id: 'gap-2',
              severity: 'major',
              estimatedEffort: 5,
            },
            {
              id: 'gap-3',
              severity: 'minor',
              estimatedEffort: 2,
            },
          ],
        } as any,
      ];

      const effort = estimateRemediationEffort(results);

      expect(effort.total).toBe(15);
      expect(effort.bySeverity.critical).toBe(8);
      expect(effort.bySeverity.major).toBe(5);
      expect(effort.bySeverity.minor).toBe(2);
    });

    it('should identify top remediation steps', () => {
      const results = [
        {
          goalId: 'goal-1',
          gaps: [
            {
              id: 'gap-1',
              remediation: ['Create file', 'Add content'],
            },
            {
              id: 'gap-2',
              remediation: ['Create file', 'Configure'],
            },
          ],
        } as any,
      ];

      const analysis = analyzeGaps(results);

      expect(analysis.topRemediation).toContain('Create file');
    });
  });
});
