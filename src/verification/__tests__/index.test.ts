/**
 * Integration tests for the verification system
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  VerificationSystem,
  createVerificationSystem,
  quickVerify,
  GoalBuilder,
  existenceMustHave,
  valueMustHave,
} from '../index';

describe('VerificationSystem Integration', () => {
  let tempDir: string;
  let system: VerificationSystem;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'verify-int-test-'));
    system = createVerificationSystem({ workingDir: tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Goal Management', () => {
    it('should create and retrieve goals', () => {
      const goal = system.createGoal({
        title: 'Test Goal',
        description: 'A test goal',
      });

      expect(goal.title).toBe('Test Goal');
      expect(system.getGoal(goal.id)).toBe(goal);
    });

    it('should list all goals', () => {
      system.createGoal({ title: 'Goal 1', description: 'First' });
      system.createGoal({ title: 'Goal 2', description: 'Second' });

      const goals = system.listGoals();
      expect(goals).toHaveLength(2);
    });

    it('should update goals', () => {
      const goal = system.createGoal({
        title: 'Original',
        description: 'Will be updated',
      });

      const updated = system.updateGoal(goal.id, { title: 'Updated' });
      expect(updated?.title).toBe('Updated');
    });

    it('should delete goals', () => {
      const goal = system.createGoal({
        title: 'To Delete',
        description: 'Will be deleted',
      });

      expect(system.deleteGoal(goal.id)).toBe(true);
      expect(system.getGoal(goal.id)).toBeUndefined();
    });
  });

  describe('Verification', () => {
    it('should verify a goal with passing must-haves', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');

      const goal = system.createGoal({
        title: 'Passing Goal',
        description: 'All must-haves pass',
        mustHaves: [existenceMustHave('test.txt', 'File exists')],
      });

      const result = await system.verify(goal.id);

      expect(result.achieved).toBe(true);
      expect(result.completionPercentage).toBe(100);
      expect(result.gaps).toHaveLength(0);
    });

    it('should identify gaps for failing must-haves', async () => {
      const goal = system.createGoal({
        title: 'Failing Goal',
        description: 'Some must-haves fail',
        mustHaves: [existenceMustHave('missing.txt', 'File exists')],
      });

      const result = await system.verify(goal.id);

      expect(result.achieved).toBe(false);
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0].severity).toBe('critical');
    });

    it('should verify multiple goals', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content');

      const goal1 = system.createGoal({
        title: 'Goal 1',
        description: 'First goal',
        mustHaves: [existenceMustHave('file1.txt', 'File 1 exists')],
      });

      const goal2 = system.createGoal({
        title: 'Goal 2',
        description: 'Second goal',
        mustHaves: [existenceMustHave('file2.txt', 'File 2 exists')],
      });

      const results = await system.verifyAll([goal1.id, goal2.id]);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.achieved)).toBe(true);
    });

    it('should verify by tag', async () => {
      await fs.writeFile(path.join(tempDir, 'tagged.txt'), 'content');

      system.createGoal({
        title: 'Tagged Goal',
        description: 'Has a tag',
        tags: ['important'],
        mustHaves: [existenceMustHave('tagged.txt', 'File exists')],
      });

      system.createGoal({
        title: 'Untagged Goal',
        description: 'No tag',
        mustHaves: [existenceMustHave('missing.txt', 'File missing')],
      });

      const results = await system.verifyByTag('important');

      expect(results).toHaveLength(1);
      expect(results[0].achieved).toBe(true);
    });

    it('should track verification steps', async () => {
      await fs.writeFile(path.join(tempDir, 'step.txt'), 'content');

      const goal = system.createGoal({
        title: 'Step Goal',
        description: 'Track steps',
        mustHaves: [existenceMustHave('step.txt', 'File exists')],
      });

      const { result, steps } = await system.verifyWithSteps(goal.id);

      expect(steps).toHaveLength(1);
      expect(steps[0].passed).toBe(true);
      expect(result.achieved).toBe(true);
    });
  });

  describe('Reporting', () => {
    it('should generate console report', async () => {
      const goal = system.createGoal({
        title: 'Report Goal',
        description: 'For reporting',
        mustHaves: [existenceMustHave('missing.txt', 'File missing')],
      });

      await system.verify(goal.id);
      const report = system.generateReport('console');

      expect(report).toContain('VERIFICATION REPORT');
    });

    it('should generate JSON report', async () => {
      const goal = system.createGoal({
        title: 'JSON Goal',
        description: 'For JSON report',
        mustHaves: [existenceMustHave('missing.txt', 'File missing')],
      });

      await system.verify(goal.id);
      const report = system.generateReport('json');
      const parsed = JSON.parse(report);

      expect(parsed.summary.totalGoals).toBe(1);
    });

    it('should build report object', async () => {
      const goal = system.createGoal({
        title: 'Build Goal',
        description: 'For building report',
        mustHaves: [existenceMustHave('missing.txt', 'File missing')],
      });

      await system.verify(goal.id);
      const report = system.buildReport();

      expect(report.summary.totalGoals).toBe(1);
      expect(report.results).toHaveLength(1);
    });
  });

  describe('Statistics', () => {
    it('should calculate overall statistics', async () => {
      await fs.writeFile(path.join(tempDir, 'pass.txt'), 'content');

      system.createGoal({
        title: 'Passing',
        description: 'Passes',
        mustHaves: [existenceMustHave('pass.txt', 'File exists')],
      });

      system.createGoal({
        title: 'Failing',
        description: 'Fails',
        mustHaves: [existenceMustHave('missing.txt', 'File missing')],
      });

      // Verify to update statuses
      await system.verifyAll();

      const stats = system.getStatistics();

      expect(stats.totalGoals).toBe(2);
      expect(stats.verifiedGoals).toBe(1);
      // Goal with 0% completion is 'pending', not 'failed' (failed = partial completion with failures)
      expect(stats.failedGoals).toBe(0);
      expect(stats.partialGoals).toBe(0); // Also 0% completion = pending
      expect(stats.overallCompletion).toBe(50);
    });
  });

  describe('Configuration', () => {
    it('should update checker options', () => {
      system.setCheckerOptions({ stopOnFailure: true });

      const context = system.getChecker().getContext();
      expect(context.stopOnFailure).toBe(true);
    });

    it('should set working directory', () => {
      system.setWorkingDir('/tmp');

      const context = system.getChecker().getContext();
      expect(context.workingDir).toBe('/tmp');
    });
  });

  describe('quickVerify', () => {
    it('should quickly verify a goal', async () => {
      await fs.writeFile(path.join(tempDir, 'quick.txt'), 'content');

      const result = await quickVerify(
        {
          title: 'Quick Goal',
          description: 'Quick verification',
          mustHaves: [existenceMustHave('quick.txt', 'File exists')],
        },
        { workingDir: tempDir }
      );

      expect(result.achieved).toBe(true);
    });
  });

  describe('Hierarchical Goals', () => {
    it('should manage parent-child relationships', () => {
      const parent = system.createGoal({
        title: 'Parent',
        description: 'Parent goal',
      });

      const child = system.createGoal({
        title: 'Child',
        description: 'Child goal',
        parentId: parent.id,
      });

      expect(system.getParentGoal(child.id)).toBe(parent);
      expect(system.getChildGoals(parent.id)).toContain(child);
    });

    it('should find goals by status', async () => {
      await fs.writeFile(path.join(tempDir, 'status.txt'), 'content');

      const passing = system.createGoal({
        title: 'Passing',
        description: 'Passes',
        mustHaves: [existenceMustHave('status.txt', 'File exists')],
      });

      const failing = system.createGoal({
        title: 'Failing',
        description: 'Fails',
        mustHaves: [existenceMustHave('missing.txt', 'File missing')],
      });

      await system.verify(passing.id);
      await system.verify(failing.id);

      const verified = system.findGoalsByStatus('verified');
      expect(verified).toContain(passing);
      expect(verified).not.toContain(failing);
    });
  });

  describe('Must-Have Management', () => {
    it('should add must-haves to existing goals', () => {
      const goal = system.createGoal({
        title: 'Extendable',
        description: 'Can add must-haves',
      });

      const mustHave = existenceMustHave('extra.txt', 'Extra file');
      system.addMustHave(goal.id, mustHave);

      expect(goal.mustHaves).toHaveLength(1);
    });

    it('should remove must-haves from goals', () => {
      const mustHave = existenceMustHave('removable.txt', 'Removable file');

      const goal = system.createGoal({
        title: 'Reducible',
        description: 'Can remove must-haves',
        mustHaves: [mustHave],
      });

      system.removeMustHave(goal.id, mustHave.id);

      expect(goal.mustHaves).toHaveLength(0);
    });
  });
});
