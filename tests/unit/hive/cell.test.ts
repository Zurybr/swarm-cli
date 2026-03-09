/**
 * Cell unit tests
 *
 * Tests for the Cell class including CRUD operations, status transitions,
 * and hierarchical relationships.
 */

import {
  Cell,
  CellError,
  InvalidStatusTransitionError,
  generateCellId,
} from '@/hive/cell';
import { CreateCellOptions, CellStatus, VALID_STATUS_TRANSITIONS } from '@/hive/types';

describe('Cell', () => {
  describe('create', () => {
    it('should create a cell with default values', () => {
      const cell = Cell.create({ title: 'Test Cell' });

      expect(cell.title).toBe('Test Cell');
      expect(cell.status).toBe('open');
      expect(cell.type).toBe('task');
      expect(cell.priority).toBe(0);
      expect(cell.id).toBeDefined();
      expect(cell.createdAt).toBeDefined();
      expect(cell.updatedAt).toBeDefined();
      expect(cell.history).toEqual([]);
      expect(cell.children).toEqual([]);
    });

    it('should create a cell with custom values', () => {
      const options: CreateCellOptions = {
        title: 'Custom Cell',
        description: 'A test description',
        type: 'epic',
        status: 'in_progress',
        priority: 5,
        tags: ['test', 'important'],
        owner: 'test-agent',
        metadata: { key: 'value' },
      };

      const cell = Cell.create(options);

      expect(cell.title).toBe('Custom Cell');
      expect(cell.description).toBe('A test description');
      expect(cell.type).toBe('epic');
      expect(cell.status).toBe('in_progress');
      expect(cell.priority).toBe(5);
      expect(cell.tags).toEqual(['test', 'important']);
      expect(cell.owner).toBe('test-agent');
      expect(cell.metadata).toEqual({ key: 'value' });
    });

    it('should generate unique IDs', () => {
      const cell1 = Cell.create({ title: 'Cell 1' });
      const cell2 = Cell.create({ title: 'Cell 2' });

      expect(cell1.id).not.toBe(cell2.id);
    });

    it('should include type prefix in ID', () => {
      const epic = Cell.create({ title: 'Epic', type: 'epic' });
      const bug = Cell.create({ title: 'Bug', type: 'bug' });

      expect(epic.id.startsWith('epic-')).toBe(true);
      expect(bug.id.startsWith('bug-')).toBe(true);
    });
  });

  describe('fromJSON', () => {
    it('should rehydrate cell from JSON string', () => {
      const original = Cell.create({
        title: 'Original',
        description: 'Test desc',
        type: 'task',
        priority: 3,
      });

      const json = original.toJSON();
      const restored = Cell.fromJSON(json);

      expect(restored.id).toBe(original.id);
      expect(restored.title).toBe(original.title);
      expect(restored.description).toBe(original.description);
      expect(restored.type).toBe(original.type);
      expect(restored.priority).toBe(original.priority);
    });

    it('should rehydrate cell from data object', () => {
      const data = {
        id: 'test-123',
        title: 'Test',
        status: 'open' as CellStatus,
        type: 'task' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: [],
      };

      const cell = Cell.fromJSON(data);

      expect(cell.id).toBe('test-123');
      expect(cell.title).toBe('Test');
    });

    it('should throw on missing required fields', () => {
      expect(() => Cell.fromJSON({} as any)).toThrow(CellError);
      expect(() => Cell.fromJSON({ id: 'test' } as any)).toThrow(CellError);
      expect(() => Cell.fromJSON({ id: 'test', title: 'Test' } as any)).toThrow(CellError);
    });
  });

  describe('update', () => {
    it('should update title', () => {
      const cell = Cell.create({ title: 'Original' });
      const originalUpdatedAt = cell.updatedAt;

      // Small delay to ensure timestamp changes
      const start = Date.now();
      while (Date.now() - start < 10) { /* busy wait */ }

      cell.update({ title: 'Updated' });

      expect(cell.title).toBe('Updated');
      expect(cell.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should update description', () => {
      const cell = Cell.create({ title: 'Test' });

      cell.update({ description: 'New description' });

      expect(cell.description).toBe('New description');
    });

    it('should update priority', () => {
      const cell = Cell.create({ title: 'Test' });

      cell.update({ priority: 10 });

      expect(cell.priority).toBe(10);
    });

    it('should update tags', () => {
      const cell = Cell.create({ title: 'Test' });

      cell.update({ tags: ['new', 'tags'] });

      expect(cell.tags).toEqual(['new', 'tags']);
    });

    it('should update owner', () => {
      const cell = Cell.create({ title: 'Test' });

      cell.update({ owner: 'new-owner' });

      expect(cell.owner).toBe('new-owner');
    });

    it('should merge metadata', () => {
      const cell = Cell.create({
        title: 'Test',
        metadata: { existing: 'value' },
      });

      cell.update({ metadata: { new: 'data' } });

      expect(cell.metadata).toEqual({ existing: 'value', new: 'data' });
    });
  });

  describe('status transitions', () => {
    it('should transition from open to in_progress', () => {
      const cell = Cell.create({ title: 'Test', status: 'open' });

      cell.transitionStatus('in_progress');

      expect(cell.status).toBe('in_progress');
      expect(cell.history).toHaveLength(1);
      expect(cell.history[0].from).toBe('open');
      expect(cell.history[0].to).toBe('in_progress');
    });

    it('should record actor and reason in history', () => {
      const cell = Cell.create({ title: 'Test', status: 'open' });

      cell.transitionStatus('in_progress', 'Starting work', 'test-agent');

      expect(cell.history[0].reason).toBe('Starting work');
      expect(cell.history[0].actor).toBe('test-agent');
    });

    it('should throw on invalid transition', () => {
      const cell = Cell.create({ title: 'Test', status: 'open' });

      expect(() => cell.transitionStatus('completed')).toThrow(
        InvalidStatusTransitionError
      );
    });

    it('should allow all valid transitions', () => {
      for (const [fromStatus, toStatuses] of Object.entries(VALID_STATUS_TRANSITIONS)) {
        for (const toStatus of toStatuses) {
          const cell = Cell.create({
            title: 'Test',
            status: fromStatus as CellStatus,
          });

          expect(() => cell.transitionStatus(toStatus as CellStatus)).not.toThrow();
          expect(cell.status).toBe(toStatus);
        }
      }
    });

    it('should check canTransitionTo correctly', () => {
      const cell = Cell.create({ title: 'Test', status: 'open' });

      expect(cell.canTransitionTo('in_progress')).toBe(true);
      expect(cell.canTransitionTo('blocked')).toBe(true);
      expect(cell.canTransitionTo('cancelled')).toBe(true);
      expect(cell.canTransitionTo('completed')).toBe(false);
      expect(cell.canTransitionTo('open')).toBe(false);
    });

    it('should update status via update method', () => {
      const cell = Cell.create({ title: 'Test', status: 'open' });

      cell.update({ status: 'in_progress', statusReason: 'Started' });

      expect(cell.status).toBe('in_progress');
      expect(cell.history).toHaveLength(1);
      expect(cell.history[0].reason).toBe('Started');
    });
  });

  describe('hierarchy', () => {
    it('should add child', () => {
      const parent = Cell.create({ title: 'Parent' });
      const child = Cell.create({ title: 'Child' });

      parent.addChild(child.id);

      expect(parent.children).toContain(child.id);
    });

    it('should not add duplicate children', () => {
      const parent = Cell.create({ title: 'Parent' });
      const child = Cell.create({ title: 'Child' });

      parent.addChild(child.id);
      parent.addChild(child.id);

      expect(parent.children).toHaveLength(1);
    });

    it('should remove child', () => {
      const parent = Cell.create({ title: 'Parent' });
      const child = Cell.create({ title: 'Child' });

      parent.addChild(child.id);
      parent.removeChild(child.id);

      expect(parent.children).not.toContain(child.id);
    });

    it('should check if descendant', async () => {
      const grandparent = Cell.create({ title: 'Grandparent' });
      const parent = Cell.create({
        title: 'Parent',
        parentId: grandparent.id,
      });
      const child = Cell.create({
        title: 'Child',
        parentId: parent.id,
      });

      const getCell = async (id: string): Promise<Cell | undefined> => {
        if (id === grandparent.id) return grandparent;
        if (id === parent.id) return parent;
        return undefined;
      };

      expect(await child.isDescendantOf(grandparent.id, getCell)).toBe(true);
      expect(await child.isDescendantOf(parent.id, getCell)).toBe(true);
      expect(await parent.isDescendantOf(grandparent.id, getCell)).toBe(true);
      expect(await grandparent.isDescendantOf(child.id, getCell)).toBe(false);
    });
  });

  describe('clone', () => {
    it('should clone cell with new ID', () => {
      const original = Cell.create({
        title: 'Original',
        description: 'Desc',
        priority: 5,
      });

      const cloned = original.clone();

      expect(cloned.id).not.toBe(original.id);
      expect(cloned.title).toBe(original.title);
      expect(cloned.description).toBe(original.description);
      expect(cloned.priority).toBe(original.priority);
    });

    it('should reset history and children on clone', () => {
      const original = Cell.create({ title: 'Original' });
      original.addChild('some-child-id');
      original.transitionStatus('in_progress');

      const cloned = original.clone();

      expect(cloned.children).toEqual([]);
      expect(cloned.history).toEqual([]);
    });

    it('should apply overrides when cloning', () => {
      const original = Cell.create({ title: 'Original', priority: 5 });

      const cloned = original.clone({ title: 'Overridden', priority: 10 });

      expect(cloned.title).toBe('Overridden');
      expect(cloned.priority).toBe(10);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      const cell = Cell.create({ title: 'Test', priority: 3 });
      const json = cell.toJSON();

      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.title).toBe('Test');
      expect(parsed.priority).toBe(3);
    });

    it('should return data copy', () => {
      const cell = Cell.create({ title: 'Test' });
      const data = cell.toData();

      expect(data.title).toBe('Test');
      // Should be a copy, not the original
      data.title = 'Modified';
      expect(cell.title).toBe('Test');
    });
  });
});

describe('generateCellId', () => {
  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateCellId());
    }
    expect(ids.size).toBe(100);
  });

  it('should include type prefix', () => {
    expect(generateCellId('epic').startsWith('epic-')).toBe(true);
    expect(generateCellId('bug').startsWith('bug-')).toBe(true);
    expect(generateCellId('task').startsWith('task-')).toBe(true);
  });
});
