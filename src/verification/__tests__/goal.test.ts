/**
 * Tests for goal management
 */

import {
  GoalBuilder,
  GoalManager,
  MustHaveBuilder,
  generateGoalId,
  generateMustHaveId,
  isGoalSatisfied,
  calculateCompletion,
  deriveGoalStatus,
  serializeGoal,
  deserializeGoal,
} from '../goal';
import type { Goal, MustHave } from '../types';

describe('Goal Management', () => {
  describe('GoalBuilder', () => {
    it('should build a basic goal', () => {
      const goal = new GoalBuilder()
        .withTitle('Test Goal')
        .withDescription('A test goal')
        .build();

      expect(goal.title).toBe('Test Goal');
      expect(goal.description).toBe('A test goal');
      expect(goal.status).toBe('pending');
      expect(goal.mustHaves).toEqual([]);
    });

    it('should require title and description', () => {
      expect(() => new GoalBuilder().build()).toThrow('Goal title is required');
      expect(() => new GoalBuilder().withTitle('Test').build()).toThrow(
        'Goal description is required'
      );
    });

    it('should support all configuration options', () => {
      const goal = new GoalBuilder()
        .withTitle('Full Goal')
        .withDescription('A fully configured goal')
        .withParent('parent-goal')
        .withPriority(5)
        .withOwner('test-user')
        .withTags('tag1', 'tag2')
        .withMetadata('key', 'value')
        .withDeadline(new Date('2025-12-31'))
        .build();

      expect(goal.parentId).toBe('parent-goal');
      expect(goal.priority).toBe(5);
      expect(goal.owner).toBe('test-user');
      expect(goal.tags).toEqual(['tag1', 'tag2']);
      expect(goal.metadata).toEqual({ key: 'value' });
      expect(goal.deadline?.toISOString().startsWith('2025-12-31')).toBe(true);
    });

    it('should add must-haves using builder', () => {
      const goal = new GoalBuilder()
        .withTitle('Goal with Must-Haves')
        .withDescription('Has criteria')
        .withMustHave((builder) =>
          builder.existence('src/index.ts', 'Entry point exists')
        )
        .withMustHave((builder) =>
          builder.value('config.json', 'API key is set', 'secret-key', 'equals')
        )
        .build();

      expect(goal.mustHaves).toHaveLength(2);
      expect(goal.mustHaves[0].type).toBe('existence');
      expect(goal.mustHaves[1].type).toBe('value');
    });
  });

  describe('MustHaveBuilder', () => {
    it('should build existence must-have', () => {
      const mh = new MustHaveBuilder()
        .existence('src/index.ts', 'Entry point exists')
        .build();

      expect(mh.type).toBe('existence');
      expect(mh.target).toBe('src/index.ts');
      expect(mh.required).toBe(true);
      expect(mh.weight).toBe(1.0);
    });

    it('should build value must-have', () => {
      const mh = new MustHaveBuilder()
        .value('config.json', 'Version is set', '1.0.0', 'equals')
        .required(false)
        .withWeight(0.5)
        .build();

      expect(mh.type).toBe('value');
      expect(mh.expected).toBe('1.0.0');
      expect(mh.operator).toBe('equals');
      expect(mh.required).toBe(false);
      expect(mh.weight).toBe(0.5);
    });

    it('should build structure must-have', () => {
      const mh = new MustHaveBuilder()
        .structure('package.json', 'Has required fields', ['name', 'version'])
        .build();

      expect(mh.type).toBe('structure');
      expect(mh.expected).toEqual(['name', 'version']);
    });

    it('should build relation must-have', () => {
      const mh = new MustHaveBuilder()
        .relation('src/app.ts', 'src/utils.ts', 'depends_on', 'App depends on utils')
        .build();

      expect(mh.type).toBe('relation');
      expect(mh.relatedTarget).toBe('src/utils.ts');
      expect(mh.relationType).toBe('depends_on');
    });

    it('should support custom validator', () => {
      const validator = (actual: unknown) => actual === 'valid';
      const mh = new MustHaveBuilder()
        .existence('test.txt', 'Test file')
        .withValidator(validator)
        .withErrorMessage('Custom error message')
        .build();

      expect(mh.validator).toBe(validator);
      expect(mh.errorMessage).toBe('Custom error message');
    });
  });

  describe('GoalManager', () => {
    let manager: GoalManager;

    beforeEach(() => {
      manager = new GoalManager();
    });

    it('should create goals', () => {
      const goal = manager.createGoal({
        title: 'Test Goal',
        description: 'A test goal',
      });

      expect(goal.title).toBe('Test Goal');
      expect(manager.getGoal(goal.id)).toBe(goal);
    });

    it('should update goals', () => {
      const goal = manager.createGoal({
        title: 'Test',
        description: 'Test',
      });

      const updated = manager.updateGoal(goal.id, { title: 'Updated' });
      expect(updated?.title).toBe('Updated');
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(goal.createdAt.getTime());
    });

    it('should delete goals', () => {
      const goal = manager.createGoal({
        title: 'To Delete',
        description: 'Will be deleted',
      });

      expect(manager.deleteGoal(goal.id)).toBe(true);
      expect(manager.getGoal(goal.id)).toBeUndefined();
    });

    it('should manage hierarchical relationships', () => {
      const parent = manager.createGoal({
        title: 'Parent',
        description: 'Parent goal',
      });

      const child = manager.createGoal({
        title: 'Child',
        description: 'Child goal',
        parentId: parent.id,
      });

      expect(manager.getChildren(parent.id)).toContain(child);
      expect(manager.getParent(child.id)).toBe(parent);
      expect(parent.children).toContain(child.id);
    });

    it('should find goals by status', () => {
      const goal1 = manager.createGoal({
        title: 'Pending',
        description: 'Pending goal',
      });

      const goal2 = manager.createGoal({
        title: 'Verified',
        description: 'Verified goal',
      });
      goal2.status = 'verified';

      const pending = manager.findByStatus('pending');
      expect(pending).toContain(goal1);
      expect(pending).not.toContain(goal2);
    });

    it('should find goals by tag', () => {
      const goal = manager.createGoal({
        title: 'Tagged',
        description: 'Has tags',
        tags: ['feature', 'urgent'],
      });

      expect(manager.findByTag('feature')).toContain(goal);
      expect(manager.findByTag('urgent')).toContain(goal);
      expect(manager.findByTag('missing')).not.toContain(goal);
    });

    it('should get all ancestors of a goal', () => {
      const grandparent = manager.createGoal({
        title: 'Grandparent',
        description: 'Top level',
      });

      const parent = manager.createGoal({
        title: 'Parent',
        description: 'Middle level',
        parentId: grandparent.id,
      });

      const child = manager.createGoal({
        title: 'Child',
        description: 'Bottom level',
        parentId: parent.id,
      });

      const ancestors = manager.getAncestors(child.id);
      expect(ancestors).toHaveLength(2);
      expect(ancestors[0]).toBe(grandparent);
      expect(ancestors[1]).toBe(parent);
    });

    it('should get all descendants of a goal', () => {
      const parent = manager.createGoal({
        title: 'Parent',
        description: 'Parent goal',
      });

      const child1 = manager.createGoal({
        title: 'Child 1',
        description: 'First child',
        parentId: parent.id,
      });

      const child2 = manager.createGoal({
        title: 'Child 2',
        description: 'Second child',
        parentId: parent.id,
      });

      const grandchild = manager.createGoal({
        title: 'Grandchild',
        description: 'Grandchild',
        parentId: child1.id,
      });

      const descendants = manager.getDescendants(parent.id);
      expect(descendants).toHaveLength(3);
      expect(descendants).toContain(child1);
      expect(descendants).toContain(child2);
      expect(descendants).toContain(grandchild);
    });

    it('should orphan children when parent is deleted', () => {
      const parent = manager.createGoal({
        title: 'Parent',
        description: 'Will be deleted',
      });

      const child = manager.createGoal({
        title: 'Child',
        description: 'Will be orphaned',
        parentId: parent.id,
      });

      manager.deleteGoal(parent.id);
      expect(child.parentId).toBeUndefined();
    });

    it('should add and remove must-haves', () => {
      const goal = manager.createGoal({
        title: 'Test',
        description: 'Test',
      });

      const mustHave = new MustHaveBuilder()
        .existence('test.txt', 'Test file exists')
        .build();

      manager.addMustHaveToGoal(goal.id, mustHave);
      expect(goal.mustHaves).toHaveLength(1);

      manager.removeMustHaveFromGoal(goal.id, mustHave.id);
      expect(goal.mustHaves).toHaveLength(0);
    });
  });

  describe('Goal Utilities', () => {
    describe('isGoalSatisfied', () => {
      it('should return true when all required must-haves are satisfied', () => {
        const goal: Goal = {
          id: 'goal-1',
          title: 'Test',
          description: 'Test',
          status: 'verified',
          mustHaves: [
            { id: 'mh-1', description: 'Required', type: 'existence', status: 'satisfied', target: 'a', required: true, weight: 1, createdAt: new Date() },
            { id: 'mh-2', description: 'Optional', type: 'existence', status: 'failed', target: 'b', required: false, weight: 1, createdAt: new Date() },
          ],
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        expect(isGoalSatisfied(goal)).toBe(true);
      });

      it('should return false when a required must-have is not satisfied', () => {
        const goal: Goal = {
          id: 'goal-1',
          title: 'Test',
          description: 'Test',
          status: 'failed',
          mustHaves: [
            { id: 'mh-1', description: 'Required', type: 'existence', status: 'failed', target: 'a', required: true, weight: 1, createdAt: new Date() },
          ],
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        expect(isGoalSatisfied(goal)).toBe(false);
      });
    });

    describe('calculateCompletion', () => {
      it('should calculate weighted completion percentage', () => {
        const goal: Goal = {
          id: 'goal-1',
          title: 'Test',
          description: 'Test',
          status: 'partial',
          mustHaves: [
            { id: 'mh-1', description: 'Heavy', type: 'existence', status: 'satisfied', target: 'a', required: true, weight: 0.8, createdAt: new Date() },
            { id: 'mh-2', description: 'Light', type: 'existence', status: 'failed', target: 'b', required: true, weight: 0.2, createdAt: new Date() },
          ],
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        expect(calculateCompletion(goal)).toBe(80);
      });

      it('should return 100 for goals with no must-haves', () => {
        const goal: Goal = {
          id: 'goal-1',
          title: 'Test',
          description: 'Test',
          status: 'verified',
          mustHaves: [],
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        expect(calculateCompletion(goal)).toBe(100);
      });
    });

    describe('deriveGoalStatus', () => {
      it('should return verified when all must-haves are satisfied', () => {
        const goal: Goal = {
          id: 'goal-1',
          title: 'Test',
          description: 'Test',
          status: 'pending',
          mustHaves: [
            { id: 'mh-1', description: 'Test', type: 'existence', status: 'satisfied', target: 'a', required: true, weight: 1, createdAt: new Date() },
          ],
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        expect(deriveGoalStatus(goal)).toBe('verified');
      });

      it('should return pending when no must-haves are checked', () => {
        const goal: Goal = {
          id: 'goal-1',
          title: 'Test',
          description: 'Test',
          status: 'pending',
          mustHaves: [
            { id: 'mh-1', description: 'Test', type: 'existence', status: 'pending', target: 'a', required: true, weight: 1, createdAt: new Date() },
          ],
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        expect(deriveGoalStatus(goal)).toBe('pending');
      });

      it('should return partial for mixed results', () => {
        const goal: Goal = {
          id: 'goal-1',
          title: 'Test',
          description: 'Test',
          status: 'pending',
          mustHaves: [
            { id: 'mh-1', description: 'Test', type: 'existence', status: 'satisfied', target: 'a', required: true, weight: 0.5, createdAt: new Date() },
            { id: 'mh-2', description: 'Test', type: 'existence', status: 'pending', target: 'b', required: true, weight: 0.5, createdAt: new Date() },
          ],
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        expect(deriveGoalStatus(goal)).toBe('partial');
      });
    });

    describe('serializeGoal / deserializeGoal', () => {
      it('should round-trip serialize and deserialize goals', () => {
        const goal: Goal = {
          id: 'goal-1',
          title: 'Test',
          description: 'Test',
          status: 'verified',
          mustHaves: [
            { id: 'mh-1', description: 'Test', type: 'existence', status: 'satisfied', target: 'a', required: true, weight: 1, createdAt: new Date() },
          ],
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const serialized = serializeGoal(goal);
        const deserialized = deserializeGoal(serialized);

        expect(deserialized.id).toBe(goal.id);
        expect(deserialized.title).toBe(goal.title);
        expect(deserialized.mustHaves).toHaveLength(1);
        expect(deserialized.createdAt instanceof Date).toBe(true);
      });
    });
  });
});
