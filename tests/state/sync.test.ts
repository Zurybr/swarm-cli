/**
 * Tests for state/sync.ts
 */

import { Hive } from '../../src/hive';
import {
  syncWithHive,
  importFromHive,
  exportToHive,
  getSyncStatus,
} from '../../src/state/sync';
import { State, StateItem } from '../../src/state/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('State Sync', () => {
  let tempDir: string;
  let hive: Hive;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'state-sync-test-'));
    hive = new Hive({ baseDir: path.join(tempDir, '.hive'), enableGit: false });
    await hive.init();
  });

  afterEach(async () => {
    await hive.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createTestState = (): State => ({
    frontmatter: {
      version: '1.0',
      project: 'test-project',
      lastSync: new Date().toISOString(),
    },
    sections: [
      {
        type: 'backlog',
        items: [
          {
            id: 'task-1',
            title: 'Test task 1',
            status: 'open',
            type: 'task',
            priority: 'high',
            owner: 'test-user',
          },
          {
            id: 'task-2',
            title: 'Test task 2',
            status: 'in_progress',
            type: 'feature',
            priority: 'medium',
          },
        ],
        order: 0,
      },
      {
        type: 'completed',
        items: [
          {
            id: 'task-3',
            title: 'Completed task',
            status: 'completed',
            type: 'task',
            completedAt: new Date().toISOString(),
          },
        ],
        order: 1,
      },
    ],
  });

  describe('syncWithHive', () => {
    it('should sync new items to Hive', async () => {
      const state = createTestState();

      const result = await syncWithHive(state, hive, { direction: 'to-hive' });

      expect(result.success).toBe(true);
      expect(result.syncedToHive).toBe(3);

      // Verify items were created
      const cells = await hive.getAllCells();
      expect(cells).toHaveLength(3);
    });

    it('should sync items from Hive', async () => {
      // First create cells in Hive
      await hive.createCell({
        title: 'Hive task',
        type: 'task',
        status: 'open',
      });

      const state: State = {
        frontmatter: {
          version: '1.0',
          project: 'test',
          lastSync: new Date().toISOString(),
        },
        sections: [{ type: 'backlog', items: [], order: 0 }],
      };

      const result = await syncWithHive(state, hive, { direction: 'from-hive' });

      expect(result.success).toBe(true);
      expect(result.syncedFromHive).toBe(1);
    });

    it('should detect conflicts in bidirectional sync', async () => {
      // Create a cell in Hive
      const cell = await hive.createCell({
        title: 'Original title',
        type: 'task',
        status: 'open',
      });

      // Create state with same ID but different title
      const state: State = {
        frontmatter: {
          version: '1.0',
          project: 'test',
          lastSync: new Date().toISOString(),
        },
        sections: [{
          type: 'backlog',
          items: [{
            id: cell.id,
            title: 'Modified title',
            status: 'open',
          }],
          order: 0,
        }],
      };

      const result = await syncWithHive(state, hive, {
        direction: 'bidirectional',
        conflictResolution: 'manual',
      });

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0].field).toBe('title');
    });

    it('should auto-resolve conflicts with state preference', async () => {
      const cell = await hive.createCell({
        title: 'Original title',
        type: 'task',
        status: 'open',
      });

      const state: State = {
        frontmatter: {
          version: '1.0',
          project: 'test',
          lastSync: new Date().toISOString(),
        },
        sections: [{
          type: 'backlog',
          items: [{
            id: cell.id,
            title: 'Modified title',
            status: 'open',
          }],
          order: 0,
        }],
      };

      const result = await syncWithHive(state, hive, {
        direction: 'bidirectional',
        conflictResolution: 'state',
      });

      expect(result.success).toBe(true);

      // Verify Hive was updated
      const updatedCell = await hive.getCell(cell.id);
      expect(updatedCell?.title).toBe('Modified title');
    });

    it('should filter by sections', async () => {
      const state = createTestState();

      const result = await syncWithHive(state, hive, {
        direction: 'to-hive',
        sections: ['backlog'],
      });

      expect(result.syncedToHive).toBe(2); // Only backlog items
    });

    it('should filter by status', async () => {
      const state = createTestState();

      const result = await syncWithHive(state, hive, {
        direction: 'to-hive',
        statusFilter: ['open'],
      });

      expect(result.syncedToHive).toBe(1); // Only open items
    });
  });

  describe('importFromHive', () => {
    it('should import all cells from Hive', async () => {
      // Create cells in Hive
      await hive.createCell({ title: 'Task 1', type: 'task', status: 'open' });
      await hive.createCell({ title: 'Task 2', type: 'feature', status: 'in_progress' });
      await hive.createCell({ title: 'Task 3', type: 'task', status: 'completed' });

      const state = await importFromHive(hive, 'imported-project');

      expect(state.frontmatter.project).toBe('imported-project');
      expect(state.frontmatter.autoGenerated).toBe(true);

      // Should have sections based on status
      const allItems = state.sections.flatMap(s => s.items);
      expect(allItems).toHaveLength(3);
    });

    it('should categorize items by status', async () => {
      await hive.createCell({ title: 'Open', type: 'task', status: 'open' });
      await hive.createCell({ title: 'In Progress', type: 'task', status: 'in_progress' });
      await hive.createCell({ title: 'Blocked', type: 'task', status: 'blocked' });
      await hive.createCell({ title: 'Completed', type: 'task', status: 'completed' });

      const state = await importFromHive(hive, 'test');

      const activeSection = state.sections.find(s => s.type === 'active');
      const blockedSection = state.sections.find(s => s.type === 'blocked');
      const completedSection = state.sections.find(s => s.type === 'completed');

      expect(activeSection?.items).toHaveLength(1);
      expect(activeSection?.items[0].title).toBe('In Progress');

      expect(blockedSection?.items).toHaveLength(1);
      expect(blockedSection?.items[0].title).toBe('Blocked');

      expect(completedSection?.items).toHaveLength(1);
      expect(completedSection?.items[0].title).toBe('Completed');
    });

    it('should map priority correctly', async () => {
      await hive.createCell({
        title: 'High priority',
        type: 'task',
        status: 'open',
        priority: 3,
      });

      const state = await importFromHive(hive, 'test');
      const item = state.sections[0].items[0];

      expect(item.priority).toBe('high');
    });
  });

  describe('exportToHive', () => {
    it('should create new cells in Hive', async () => {
      const state = createTestState();

      const result = await exportToHive(state, hive);

      expect(result.created).toBe(3);
      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);

      const cells = await hive.getAllCells();
      expect(cells).toHaveLength(3);
    });

    it('should update existing cells', async () => {
      // Create initial cell
      const cell = await hive.createCell({
        title: 'Original',
        type: 'task',
        status: 'open',
      });
      // Update the state item to match the created cell's ID
      const state = createTestState();
      state.sections[0].items[0].id = cell.id;

      const result = await exportToHive(state, hive);

      expect(result.created).toBe(2);
      expect(result.updated).toBe(1);

      const updatedCell = await hive.getCell(cell.id);
      expect(updatedCell?.title).toBe('Test task 1');
    });

    it('should clear existing cells when specified', async () => {
      // Create existing cells
      await hive.createCell({ title: 'Old 1', type: 'task', status: 'open' });
      await hive.createCell({ title: 'Old 2', type: 'task', status: 'open' });

      const state = createTestState();

      await exportToHive(state, hive, { clearExisting: true });

      const cells = await hive.getAllCells();
      expect(cells).toHaveLength(3); // Only new cells
    });
  });

  describe('getSyncStatus', () => {
    it('should report in-sync when state and Hive match', async () => {
      // Create state and sync to Hive
      const state = createTestState();
      await exportToHive(state, hive);

      const status = await getSyncStatus(state, hive);

      expect(status.inSync).toBe(true);
      expect(status.stateOnly).toHaveLength(0);
      expect(status.hiveOnly).toHaveLength(0);
      expect(status.divergent).toHaveLength(0);
    });

    it('should detect items only in STATE.md', async () => {
      const state = createTestState();
      // Don't sync to Hive

      const status = await getSyncStatus(state, hive);

      expect(status.inSync).toBe(false);
      expect(status.stateOnly).toHaveLength(3);
    });

    it('should detect items only in Hive', async () => {
      await hive.createCell({ title: 'Hive only', type: 'task', status: 'open' });

      const state: State = {
        frontmatter: {
          version: '1.0',
          project: 'test',
          lastSync: new Date().toISOString(),
        },
        sections: [{ type: 'backlog', items: [], order: 0 }],
      };

      const status = await getSyncStatus(state, hive);

      expect(status.inSync).toBe(false);
      expect(status.hiveOnly).toHaveLength(1);
    });

    it('should detect divergent items', async () => {
      const cell = await hive.createCell({
        title: 'Hive title',
        type: 'task',
        status: 'open',
      });

      const state: State = {
        frontmatter: {
          version: '1.0',
          project: 'test',
          lastSync: new Date().toISOString(),
        },
        sections: [{
          type: 'backlog',
          items: [{
            id: cell.id,
            title: 'State title',
            status: 'open',
          }],
          order: 0,
        }],
      };

      const status = await getSyncStatus(state, hive);

      expect(status.inSync).toBe(false);
      expect(status.divergent).toHaveLength(1);
      expect(status.divergent[0].differences).toContain('title');
    });
  });
});
