/**
 * Tests for state/index.ts (StateManager)
 */

import { StateManager, StateManagerError } from '../../src/state';
import { State, StateItem } from '../../src/state/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('StateManager', () => {
  let tempDir: string;
  let stateFilePath: string;
  let manager: StateManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'state-manager-test-'));
    stateFilePath = path.join(tempDir, 'STATE.md');
    manager = new StateManager({
      stateFilePath,
      hiveConfig: { baseDir: path.join(tempDir, '.hive'), enableGit: false },
      autoSync: false,
    });
    await manager.init();
  });

  afterEach(async () => {
    await manager.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('init', () => {
    it('should initialize successfully', async () => {
      const newManager = new StateManager({ stateFilePath });
      await expect(newManager.init()).resolves.toBeUndefined();
      await newManager.close();
    });

    it('should be idempotent', async () => {
      await manager.init();
      await expect(manager.init()).resolves.toBeUndefined();
    });
  });

  describe('create', () => {
    it('should create a new STATE.md file', async () => {
      const state = await manager.create('test-project');

      expect(state.frontmatter.project).toBe('test-project');
      expect(state.frontmatter.version).toBe('1.0');

      // Verify file was created
      const content = await fs.readFile(stateFilePath, 'utf-8');
      expect(content).toContain('test-project');
    });

    it('should create with custom sections', async () => {
      const state = await manager.create('test', {
        sections: [
          { type: 'backlog', items: [], order: 0 },
          { type: 'active', items: [], order: 1 },
        ],
      });

      expect(state.sections).toHaveLength(2);
    });
  });

  describe('load', () => {
    it('should load existing STATE.md', async () => {
      await manager.create('test-project');

      const loadedManager = new StateManager({ stateFilePath });
      await loadedManager.init();
      const state = await loadedManager.load();

      expect(state.frontmatter.project).toBe('test-project');
      await loadedManager.close();
    });

    it('should import from Hive if file does not exist', async () => {
      // Create a cell in Hive first
      const hive = manager.getHive();
      await hive.createCell({
        title: 'Hive task',
        type: 'task',
        status: 'open',
      });

      const state = await manager.load();

      expect(state.sections.length).toBeGreaterThan(0);
      const allItems = state.sections.flatMap(s => s.items);
      expect(allItems.length).toBeGreaterThan(0);
    });
  });

  describe('exists', () => {
    it('should return false when file does not exist', async () => {
      const exists = await manager.exists();
      expect(exists).toBe(false);
    });

    it('should return true when file exists', async () => {
      await manager.create('test');
      const exists = await manager.exists();
      expect(exists).toBe(true);
    });
  });

  describe('save', () => {
    it('should save state to file', async () => {
      const state = await manager.create('test');
      await manager.save(state);

      const content = await fs.readFile(stateFilePath, 'utf-8');
      expect(content).toContain('test');
    });

    it('should throw on invalid state', async () => {
      const invalidState: State = {
        frontmatter: {
          version: '1.0',
          project: 'test',
          lastSync: new Date().toISOString(),
        },
        sections: [{
          type: 'backlog',
          items: [{ id: '', title: '', status: 'open' }], // Invalid item
          order: 0,
        }],
      };

      await expect(manager.save(invalidState)).rejects.toThrow(StateManagerError);
    });
  });

  describe('validate', () => {
    it('should validate current state', async () => {
      await manager.create('test');

      const result = await manager.validate();

      expect(result.valid).toBe(true);
    });

    it('should detect validation errors', async () => {
      // Create state with invalid item
      await fs.writeFile(stateFilePath, `---
version: "1.0"
project: test
---

## Backlog

- [ ] **task-1**:
  status: invalid-status
`);

      const result = await manager.validate();

      expect(result.valid).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });
  });

  describe('addItem', () => {
    it('should add item to state', async () => {
      await manager.create('test');

      const item: StateItem = {
        id: 'new-task',
        title: 'New task',
        status: 'open',
      };

      const state = await manager.addItem(item);

      // Item with status 'open' goes to backlog section
      const backlogSection = state.sections.find(s => s.type === 'backlog');
      expect(backlogSection?.items).toHaveLength(1);
      expect(backlogSection?.items[0].id).toBe('new-task');
    });

    it('should add item to specific section', async () => {
      await manager.create('test');

      const item: StateItem = {
        id: 'active-task',
        title: 'Active task',
        status: 'in_progress',
      };

      const state = await manager.addItem(item, 'active');
      const activeSection = state.sections.find(s => s.type === 'active');

      expect(activeSection?.items).toHaveLength(1);
    });
  });

  describe('updateItem', () => {
    it('should update existing item', async () => {
      await manager.create('test');
      await manager.addItem({ id: 'task-1', title: 'Original', status: 'open' });

      const updated = await manager.updateItem('task-1', { title: 'Updated' });

      expect(updated?.title).toBe('Updated');
      expect(updated?.updatedAt).toBeDefined();
    });

    it('should return null for non-existent item', async () => {
      await manager.create('test');

      const updated = await manager.updateItem('non-existent', { title: 'Updated' });

      expect(updated).toBeNull();
    });
  });

  describe('removeItem', () => {
    it('should remove item by ID', async () => {
      await manager.create('test');
      await manager.addItem({ id: 'task-1', title: 'To remove', status: 'open' });

      const removed = await manager.removeItem('task-1');
      const state = await manager.getState();

      expect(removed).toBe(true);
      expect(state.sections.flatMap(s => s.items)).toHaveLength(0);
    });

    it('should return false for non-existent item', async () => {
      await manager.create('test');

      const removed = await manager.removeItem('non-existent');

      expect(removed).toBe(false);
    });
  });

  describe('findItem', () => {
    it('should find item by ID', async () => {
      await manager.create('test');
      await manager.addItem({ id: 'task-1', title: 'Find me', status: 'open' });

      const item = await manager.findItem('task-1');

      expect(item).toBeDefined();
      expect(item?.title).toBe('Find me');
    });

    it('should return undefined for non-existent item', async () => {
      await manager.create('test');

      const item = await manager.findItem('non-existent');

      expect(item).toBeUndefined();
    });
  });

  describe('moveItem', () => {
    it('should move item between sections', async () => {
      await manager.create('test');
      await manager.addItem({ id: 'task-1', title: 'Move me', status: 'open' }, 'backlog');

      const moved = await manager.moveItem('task-1', 'active');
      const state = await manager.getState();

      expect(moved).toBe(true);

      const backlogSection = state.sections.find(s => s.type === 'backlog');
      const activeSection = state.sections.find(s => s.type === 'active');

      expect(backlogSection?.items).toHaveLength(0);
      expect(activeSection?.items).toHaveLength(1);
    });

    it('should return false for non-existent item', async () => {
      await manager.create('test');

      const moved = await manager.moveItem('non-existent', 'active');

      expect(moved).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return state statistics', async () => {
      await manager.create('test');
      await manager.addItem({ id: 't1', title: 'Task 1', status: 'open', type: 'task' });
      await manager.addItem({ id: 't2', title: 'Task 2', status: 'in_progress', type: 'task', owner: 'user1' });
      await manager.addItem({ id: 't3', title: 'Task 3', status: 'completed', type: 'feature' });

      const stats = await manager.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byStatus.open).toBe(1);
      expect(stats.byStatus.in_progress).toBe(1);
      expect(stats.byStatus.completed).toBe(1);
      expect(stats.byType.task).toBe(2);
      expect(stats.byType.feature).toBe(1);
      expect(stats.byOwner.user1).toBe(1);
    });

    it('should handle empty state', async () => {
      await manager.create('test');

      const stats = await manager.getStats();

      expect(stats.total).toBe(0);
      expect(Object.keys(stats.byStatus)).toHaveLength(0);
    });
  });

  describe('diff', () => {
    it('should detect added items', async () => {
      await manager.create('test');
      await manager.addItem({ id: 'task-1', title: 'Task 1', status: 'open' });

      const otherState: State = {
        frontmatter: { version: '1.0', project: 'test', lastSync: new Date().toISOString() },
        sections: [
          {
            type: 'backlog',
            items: [
              { id: 'task-1', title: 'Task 1', status: 'open' },
              { id: 'task-2', title: 'Task 2', status: 'open' },
            ],
            order: 0,
          },
        ],
      };

      const diff = await manager.diff(otherState);

      expect(diff.added).toHaveLength(1);
      expect(diff.added[0].id).toBe('task-2');
    });

    it('should detect removed items', async () => {
      await manager.create('test');
      await manager.addItem({ id: 'task-1', title: 'Task 1', status: 'open' });
      await manager.addItem({ id: 'task-2', title: 'Task 2', status: 'open' });

      const otherState: State = {
        frontmatter: { version: '1.0', project: 'test', lastSync: new Date().toISOString() },
        sections: [{
          type: 'backlog',
          items: [{ id: 'task-1', title: 'Task 1', status: 'open' }],
          order: 0,
        }],
      };

      const diff = await manager.diff(otherState);

      expect(diff.removed).toHaveLength(1);
      expect(diff.removed[0].id).toBe('task-2');
    });

    it('should detect modified items', async () => {
      await manager.create('test');
      await manager.addItem({ id: 'task-1', title: 'Original', status: 'open' });

      const otherState: State = {
        frontmatter: { version: '1.0', project: 'test', lastSync: new Date().toISOString() },
        sections: [{
          type: 'backlog',
          items: [{ id: 'task-1', title: 'Modified', status: 'open' }],
          order: 0,
        }],
      };

      const diff = await manager.diff(otherState);

      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].changes[0].field).toBe('title');
    });
  });

  describe('export', () => {
    it('should export to JSON', async () => {
      await manager.create('test');
      await manager.addItem({ id: 'task-1', title: 'Task 1', status: 'open' });

      const json = await manager.export('json');
      const parsed = JSON.parse(json);

      expect(parsed.frontmatter.project).toBe('test');
      // Item with status 'open' goes to backlog section
      const backlogSection = parsed.sections.find((s: any) => s.type === 'backlog');
      expect(backlogSection.items).toHaveLength(1);
    });

    it('should export to CSV', async () => {
      await manager.create('test');
      await manager.addItem({ id: 'task-1', title: 'Task 1', status: 'open' });

      const csv = await manager.export('csv');

      expect(csv).toContain('id,title,status');
      expect(csv).toContain('task-1');
    });

    it('should throw for unsupported format', async () => {
      await manager.create('test');

      await expect(manager.export('unsupported' as any)).rejects.toThrow(StateManagerError);
    });
  });

  describe('archive', () => {
    it('should archive completed items', async () => {
      const completedDate = new Date();
      completedDate.setDate(completedDate.getDate() - 31); // 31 days ago

      await manager.create('test');
      await manager.addItem({
        id: 'old-task',
        title: 'Old completed task',
        status: 'completed',
        completedAt: completedDate.toISOString(),
      });

      const result = await manager.archive();

      expect(result.archived).toBe(1);
      expect(result.filePath).toContain('STATE-archive');

      // Verify item was removed from current state
      const state = await manager.getState();
      const allItems = state.sections.flatMap(s => s.items);
      expect(allItems).toHaveLength(0);
    });

    it('should not archive recent items', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5); // 5 days ago

      await manager.create('test');
      await manager.addItem({
        id: 'recent-task',
        title: 'Recent completed task',
        status: 'completed',
        completedAt: recentDate.toISOString(),
      });

      const result = await manager.archive();

      expect(result.archived).toBe(0);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = manager.getConfig();

      expect(config.stateFilePath).toBe(stateFilePath);
      expect(config.autoSync).toBe(false);
    });
  });

  describe('getHive', () => {
    it('should return Hive instance', () => {
      const hive = manager.getHive();

      expect(hive).toBeDefined();
    });
  });
});
