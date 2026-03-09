/**
 * Storage unit tests
 *
 * Tests for the Storage class including CRUD operations, querying,
 * and file system interactions.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Storage, StorageError } from '@/hive/storage';
import { Cell } from '@/hive/cell';
import { StorageConfig } from '@/hive/types';

describe('Storage', () => {
  let storage: Storage;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), '.hive-test', `test-${Date.now()}`);
    const config: Partial<StorageConfig> = {
      baseDir: testDir,
      enableGit: false,
      autoCommit: false,
    };
    storage = new Storage(config);
    await storage.init();
  });

  afterEach(async () => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    }
  });

  describe('init', () => {
    it('should create storage directories', async () => {
      const newDir = path.join(process.cwd(), '.hive-test', `init-${Date.now()}`);
      const config: Partial<StorageConfig> = {
        baseDir: newDir,
        enableGit: false,
        autoCommit: false,
      };
      const newStorage = new Storage(config);

      await newStorage.init();

      expect(fs.existsSync(newDir)).toBe(true);
      expect(fs.existsSync(path.join(newDir, 'cells'))).toBe(true);

      // Cleanup
      await fs.promises.rm(newDir, { recursive: true, force: true });
    });
  });

  describe('save', () => {
    it('should save a cell to storage', async () => {
      const cell = Cell.create({ title: 'Test Cell' });

      const result = await storage.save(cell);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.id).toBe(cell.id);

      // Verify file was created
      const cellPath = path.join(testDir, 'cells', cell.id.substring(0, 2), `${cell.id}.json`);
      expect(fs.existsSync(cellPath)).toBe(true);
    });

    it('should update existing cell', async () => {
      const cell = Cell.create({ title: 'Original' });
      await storage.save(cell);

      cell.update({ title: 'Updated' });
      const result = await storage.save(cell);

      expect(result.success).toBe(true);

      // Verify file was updated
      const loaded = await storage.load(cell.id);
      expect(loaded.success).toBe(true);
      expect(loaded.data!.title).toBe('Updated');
    });

    it('should write atomically using temp file', async () => {
      const cell = Cell.create({ title: 'Atomic Test' });
      await storage.save(cell);

      // No temp file should remain
      const cellPath = path.join(testDir, 'cells', cell.id.substring(0, 2), `${cell.id}.json`);
      const tempPath = `${cellPath}.tmp`;
      expect(fs.existsSync(tempPath)).toBe(false);
    });
  });

  describe('load', () => {
    it('should load a cell by ID', async () => {
      const cell = Cell.create({ title: 'Test Cell', priority: 5 });
      await storage.save(cell);

      const result = await storage.load(cell.id);

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Cell);
      expect(result.data!.id).toBe(cell.id);
      expect(result.data!.title).toBe('Test Cell');
      expect(result.data!.priority).toBe(5);
    });

    it('should return error for non-existent cell', async () => {
      const result = await storage.load('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should load cell with full history', async () => {
      const cell = Cell.create({ title: 'Test', status: 'open' });
      cell.transitionStatus('in_progress', 'Starting', 'agent-1');
      cell.transitionStatus('completed', 'Done', 'agent-1');
      await storage.save(cell);

      const result = await storage.load(cell.id);

      expect(result.success).toBe(true);
      expect(result.data!.history).toHaveLength(2);
      expect(result.data!.history[0].from).toBe('open');
      expect(result.data!.history[0].to).toBe('in_progress');
    });
  });

  describe('delete', () => {
    it('should delete a cell', async () => {
      const cell = Cell.create({ title: 'To Delete' });
      await storage.save(cell);

      const result = await storage.delete(cell.id);

      expect(result.success).toBe(true);

      const exists = await storage.exists(cell.id);
      expect(exists).toBe(false);
    });

    it('should return error for non-existent cell', async () => {
      const result = await storage.delete('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should clean up empty parent directory', async () => {
      const cell = Cell.create({ title: 'To Delete' });
      await storage.save(cell);

      const prefixDir = path.join(testDir, 'cells', cell.id.substring(0, 2));
      expect(fs.existsSync(prefixDir)).toBe(true);

      await storage.delete(cell.id);

      // Directory should be removed if empty
      expect(fs.existsSync(prefixDir)).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true for existing cell', async () => {
      const cell = Cell.create({ title: 'Exists' });
      await storage.save(cell);

      const exists = await storage.exists(cell.id);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent cell', async () => {
      const exists = await storage.exists('non-existent');

      expect(exists).toBe(false);
    });
  });

  describe('listAll', () => {
    it('should return empty array when no cells', async () => {
      const ids = await storage.listAll();

      expect(ids).toEqual([]);
    });

    it('should list all cell IDs', async () => {
      const cell1 = Cell.create({ title: 'Cell 1' });
      const cell2 = Cell.create({ title: 'Cell 2' });
      const cell3 = Cell.create({ title: 'Cell 3' });

      await storage.save(cell1);
      await storage.save(cell2);
      await storage.save(cell3);

      const ids = await storage.listAll();

      expect(ids).toHaveLength(3);
      expect(ids).toContain(cell1.id);
      expect(ids).toContain(cell2.id);
      expect(ids).toContain(cell3.id);
    });
  });

  describe('loadAll', () => {
    it('should load all cells', async () => {
      const cell1 = Cell.create({ title: 'Cell 1', type: 'epic' });
      const cell2 = Cell.create({ title: 'Cell 2', type: 'task' });

      await storage.save(cell1);
      await storage.save(cell2);

      const cells = await storage.loadAll();

      expect(cells).toHaveLength(2);
      expect(cells.map(c => c.title)).toContain('Cell 1');
      expect(cells.map(c => c.title)).toContain('Cell 2');
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      // Create test cells with various attributes
      const epic = Cell.create({ title: 'Epic 1', type: 'epic', status: 'open', priority: 10 });
      const task1 = Cell.create({
        title: 'Task 1',
        type: 'task',
        status: 'in_progress',
        priority: 5,
        parentId: epic.id,
        owner: 'agent-1',
        tags: ['urgent', 'frontend'],
      });
      const task2 = Cell.create({
        title: 'Task 2',
        type: 'task',
        status: 'open',
        priority: 3,
        owner: 'agent-2',
        tags: ['backend'],
      });
      const bug = Cell.create({
        title: 'Bug 1',
        type: 'bug',
        status: 'blocked',
        priority: 8,
      });

      await storage.save(epic);
      await storage.save(task1);
      await storage.save(task2);
      await storage.save(bug);
    });

    it('should filter by status', async () => {
      const open = await storage.query({ status: 'open' });
      expect(open).toHaveLength(2);

      const inProgress = await storage.query({ status: 'in_progress' });
      expect(inProgress).toHaveLength(1);
      expect(inProgress[0].title).toBe('Task 1');
    });

    it('should filter by multiple statuses', async () => {
      const results = await storage.query({ status: ['open', 'blocked'] });
      expect(results).toHaveLength(3);
    });

    it('should filter by type', async () => {
      const tasks = await storage.query({ type: 'task' });
      expect(tasks).toHaveLength(2);
    });

    it('should filter by parentId', async () => {
      const epic = (await storage.query({ type: 'epic' }))[0];
      const children = await storage.query({ parentId: epic.id });
      expect(children).toHaveLength(1);
      expect(children[0].title).toBe('Task 1');
    });

    it('should filter by null parentId (root cells)', async () => {
      const roots = await storage.query({ parentId: null });
      expect(roots).toHaveLength(3); // epic, task2, bug
    });

    it('should filter by owner', async () => {
      const agent1Tasks = await storage.query({ owner: 'agent-1' });
      expect(agent1Tasks).toHaveLength(1);
      expect(agent1Tasks[0].title).toBe('Task 1');
    });

    it('should filter by tags', async () => {
      const urgent = await storage.query({ tags: ['urgent'] });
      expect(urgent).toHaveLength(1);

      const frontend = await storage.query({ tags: ['frontend'] });
      expect(frontend).toHaveLength(1);

      const multiTag = await storage.query({ tags: ['urgent', 'frontend'] });
      expect(multiTag).toHaveLength(1);
    });

    it('should filter by minimum priority', async () => {
      const highPriority = await storage.query({ minPriority: 5 });
      expect(highPriority).toHaveLength(3); // epic(10), task1(5), bug(8)
    });

    it('should apply limit', async () => {
      const limited = await storage.query({ limit: 2 });
      expect(limited).toHaveLength(2);
    });

    it('should sort by priority descending, then creation date', async () => {
      const results = await storage.query({});

      expect(results[0].priority).toBe(10); // epic
      expect(results[1].priority).toBe(8); // bug
      expect(results[2].priority).toBe(5); // task1
      expect(results[3].priority).toBe(3); // task2
    });

    it('should combine filters', async () => {
      const results = await storage.query({
        type: 'task',
        status: 'open',
      });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Task 2');
    });
  });

  describe('getNextReady', () => {
    it('should return undefined when no open cells', async () => {
      const result = await storage.getNextReady();
      expect(result).toBeUndefined();
    });

    it('should return highest priority open cell', async () => {
      const cell1 = Cell.create({ title: 'Low', status: 'open', priority: 1 });
      const cell2 = Cell.create({ title: 'High', status: 'open', priority: 10 });
      const cell3 = Cell.create({ title: 'Medium', status: 'open', priority: 5 });

      await storage.save(cell1);
      await storage.save(cell2);
      await storage.save(cell3);

      const next = await storage.getNextReady();

      expect(next).toBeDefined();
      expect(next!.title).toBe('High');
    });

    it('should not return non-open cells', async () => {
      const open = Cell.create({ title: 'Open', status: 'open' });
      const inProgress = Cell.create({ title: 'In Progress', status: 'in_progress' });

      await storage.save(open);
      await storage.save(inProgress);

      const next = await storage.getNextReady();

      expect(next!.title).toBe('Open');
    });
  });

  describe('getStats', () => {
    it('should return empty stats when no cells', async () => {
      const stats = await storage.getStats();

      expect(stats.total).toBe(0);
      expect(stats.byStatus).toEqual({});
      expect(stats.byType).toEqual({});
    });

    it('should calculate statistics', async () => {
      await storage.save(Cell.create({ title: '1', type: 'epic', status: 'open' }));
      await storage.save(Cell.create({ title: '2', type: 'task', status: 'open' }));
      await storage.save(Cell.create({ title: '3', type: 'task', status: 'in_progress' }));
      await storage.save(Cell.create({ title: '4', type: 'bug', status: 'completed' }));

      const stats = await storage.getStats();

      expect(stats.total).toBe(4);
      expect(stats.byStatus).toEqual({
        open: 2,
        in_progress: 1,
        completed: 1,
      });
      expect(stats.byType).toEqual({
        epic: 1,
        task: 2,
        bug: 1,
      });
    });
  });

  describe('clear', () => {
    it('should remove all cells', async () => {
      await storage.save(Cell.create({ title: '1' }));
      await storage.save(Cell.create({ title: '2' }));

      await storage.clear();

      const ids = await storage.listAll();
      expect(ids).toHaveLength(0);
    });

    it('should recreate cells directory', async () => {
      await storage.clear();

      expect(fs.existsSync(storage.getCellsDir())).toBe(true);
    });
  });

  describe('getters', () => {
    it('should return base directory', () => {
      expect(storage.getBaseDir()).toBe(testDir);
    });

    it('should return cells directory', () => {
      expect(storage.getCellsDir()).toBe(path.join(testDir, 'cells'));
    });
  });
});
