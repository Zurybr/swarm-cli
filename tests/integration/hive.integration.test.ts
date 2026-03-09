/**
 * Hive integration tests
 *
 * End-to-end tests for the Hive system including Cell, Storage, and GitSync.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Hive, Cell, StorageError, InvalidStatusTransitionError } from '@/hive';

describe('Hive Integration', () => {
  let hive: Hive;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), '.hive-test-integration', `test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    // Initialize a git repo
    execSync('git init', { cwd: testDir });
    execSync('git config user.email "test@test.com"', { cwd: testDir });
    execSync('git config user.name "Test User"', { cwd: testDir });
    fs.writeFileSync(path.join(testDir, 'README.md'), '# Test');
    execSync('git add README.md', { cwd: testDir });
    execSync('git commit -m "Initial commit"', { cwd: testDir });

    hive = new Hive(
      { baseDir: path.join(testDir, '.hive'), enableGit: true, autoCommit: false },
      testDir
    );
    await hive.init();
  });

  afterEach(async () => {
    await hive.close();
    if (fs.existsSync(testDir)) {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    }
  });

  describe('cell lifecycle', () => {
    it('should create, read, update, and delete a cell', async () => {
      // Create
      const cell = await hive.createCell({
        title: 'Test Task',
        description: 'A test task',
        type: 'task',
        priority: 5,
      });

      expect(cell.id).toBeDefined();
      expect(cell.title).toBe('Test Task');

      // Read
      const retrieved = await hive.getCell(cell.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.title).toBe('Test Task');

      // Update
      const updated = await hive.updateCell(cell.id, {
        title: 'Updated Task',
        status: 'in_progress',
      });

      expect(updated.title).toBe('Updated Task');
      expect(updated.status).toBe('in_progress');
      expect(updated.history).toHaveLength(1);

      // Delete
      await hive.deleteCell(cell.id);
      const deleted = await hive.getCell(cell.id);
      expect(deleted).toBeUndefined();
    });

    it('should handle cell hierarchy', async () => {
      const epic = await hive.createCell({
        title: 'Epic',
        type: 'epic',
      });

      const task1 = await hive.createCell({
        title: 'Task 1',
        type: 'task',
        parentId: epic.id,
      });

      const task2 = await hive.createCell({
        title: 'Task 2',
        type: 'task',
        parentId: epic.id,
      });

      // Get children
      const children = await hive.getChildren(epic.id);
      expect(children).toHaveLength(2);
      expect(children.map(c => c.id)).toContain(task1.id);
      expect(children.map(c => c.id)).toContain(task2.id);

      // Query by parent
      const byParent = await hive.query({ parentId: epic.id });
      expect(byParent).toHaveLength(2);
    });

    it('should prevent circular references', async () => {
      const parent = await hive.createCell({ title: 'Parent', type: 'task' });
      const child = await hive.createCell({
        title: 'Child',
        type: 'task',
        parentId: parent.id,
      });

      await expect(hive.addChild(child.id, parent.id)).rejects.toThrow(
        'Cannot add child: would create circular reference'
      );
    });
  });

  describe('status transitions', () => {
    it('should handle valid status transitions', async () => {
      const cell = await hive.createCell({
        title: 'Test',
        status: 'open',
      });

      await hive.transitionStatus(cell.id, 'in_progress');
      let updated = await hive.getCell(cell.id);
      expect(updated!.status).toBe('in_progress');

      await hive.transitionStatus(cell.id, 'completed');
      updated = await hive.getCell(cell.id);
      expect(updated!.status).toBe('completed');
    });

    it('should reject invalid status transitions', async () => {
      const cell = await hive.createCell({
        title: 'Test',
        status: 'open',
      });

      await expect(hive.transitionStatus(cell.id, 'completed')).rejects.toThrow(
        InvalidStatusTransitionError
      );
    });
  });

  describe('querying', () => {
    beforeEach(async () => {
      await hive.createCell({ title: 'Open Task', status: 'open', priority: 1, type: 'task' });
      await hive.createCell({ title: 'High Priority', status: 'open', priority: 10, type: 'task' });
      await hive.createCell({ title: 'In Progress', status: 'in_progress', priority: 5, type: 'task' });
      await hive.createCell({ title: 'Bug', status: 'open', priority: 8, type: 'bug' });
    });

    it('should query by status', async () => {
      const open = await hive.query({ status: 'open' });
      expect(open).toHaveLength(3);
    });

    it('should query by type', async () => {
      const bugs = await hive.query({ type: 'bug' });
      expect(bugs).toHaveLength(1);
      expect(bugs[0].title).toBe('Bug');
    });

    it('should sort by priority', async () => {
      const tasks = await hive.query({ type: 'task' });
      expect(tasks[0].title).toBe('High Priority');
      expect(tasks[1].title).toBe('In Progress');
      expect(tasks[2].title).toBe('Open Task');
    });

    it('should get next ready cell', async () => {
      const next = await hive.getNextReady();
      expect(next).toBeDefined();
      expect(next!.title).toBe('High Priority');
    });

    it('should get statistics', async () => {
      const stats = await hive.getStats();
      expect(stats.total).toBe(4);
      expect(stats.byStatus.open).toBe(3);
      expect(stats.byStatus.in_progress).toBe(1);
    });
  });

  describe('git integration', () => {
    it('should commit changes when autoCommit is enabled', async () => {
      const autoHive = new Hive(
        { baseDir: path.join(testDir, '.hive-auto'), enableGit: true, autoCommit: true },
        testDir
      );
      await autoHive.init();

      const cell = await autoHive.createCell({ title: 'Auto Commit Test' });

      // Check that commit was made
      const log = execSync('git log -1 --format=%s', { cwd: testDir, encoding: 'utf-8' });
      expect(log).toContain(`hive(${cell.id}): create Auto Commit Test`);

      await autoHive.close();
    });

    it('should get git status', async () => {
      const status = await hive.getGitStatus();
      expect(status.isRepo).toBe(true);
      expect(status.enabled).toBe(true);
    });

    it('should manually commit', async () => {
      await hive.createCell({ title: 'Manual Commit Test' });

      const result = await hive.commit('Custom commit message');
      expect(result.success).toBe(true);

      const log = execSync('git log -1 --format=%s', { cwd: testDir, encoding: 'utf-8' });
      expect(log.trim()).toBe('Custom commit message');
    });
  });

  describe('cloning', () => {
    it('should clone a cell', async () => {
      const original = await hive.createCell({
        title: 'Original',
        description: 'Desc',
        priority: 5,
      });

      const cloned = await hive.cloneCell(original.id, { title: 'Cloned' });

      expect(cloned.id).not.toBe(original.id);
      expect(cloned.title).toBe('Cloned');
      expect(cloned.description).toBe('Desc');
      expect(cloned.priority).toBe(5);
      expect(cloned.history).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should throw when getting non-existent cell with requireCell', async () => {
      await expect(hive.requireCell('non-existent')).rejects.toThrow('Cell not found');
    });

    it('should return undefined for non-existent cell with getCell', async () => {
      const cell = await hive.getCell('non-existent');
      expect(cell).toBeUndefined();
    });

    it('should throw when not initialized', async () => {
      const newHive = new Hive({}, testDir);
      // Don't initialize

      await expect(newHive.createCell({ title: 'Test' })).rejects.toThrow(
        'Hive not initialized'
      );
    });
  });
});
