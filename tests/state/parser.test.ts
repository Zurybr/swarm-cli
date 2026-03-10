/**
 * Tests for state/parser.ts
 */

import {
  parseState,
  serializeState,
  ParseError,
  extractAllItems,
  findItemById,
  upsertItem,
  removeItem,
} from '../../src/state/parser';
import { State, StateItem } from '../../src/state/types';

describe('State Parser', () => {
  const validStateContent = `---
version: "1.0"
project: test-project
lastSync: "2024-01-15T10:00:00Z"
---

## Overview

- [ ] **task-abc123**: Test task
  type: task
  priority: high
  owner: test-user

## Active

- [x] **task-def456**: Completed task
  type: feature
  status: completed
  completed: "2024-01-15T12:00:00Z"

## Backlog

- [ ] Simple task without ID
  type: bug
`;

  describe('parseState', () => {
    it('should parse valid STATE.md content', () => {
      const state = parseState(validStateContent);

      expect(state.frontmatter.version).toBe('1.0');
      expect(state.frontmatter.project).toBe('test-project');
      expect(state.frontmatter.lastSync).toBe('2024-01-15T10:00:00Z');
      expect(state.sections).toHaveLength(3);
    });

    it('should parse sections correctly', () => {
      const state = parseState(validStateContent);

      expect(state.sections[0].type).toBe('overview');
      expect(state.sections[1].type).toBe('active');
      expect(state.sections[2].type).toBe('backlog');
    });

    it('should parse items with all fields', () => {
      const state = parseState(validStateContent);
      const item = state.sections[0].items[0];

      expect(item.id).toBe('task-abc123');
      expect(item.title).toBe('Test task');
      expect(item.type).toBe('task');
      expect(item.priority).toBe('high');
      expect(item.owner).toBe('test-user');
    });

    it('should parse completed items', () => {
      const state = parseState(validStateContent);
      const item = state.sections[1].items[0];

      expect(item.id).toBe('task-def456');
      expect(item.status).toBe('completed');
      expect(item.completedAt).toBe('2024-01-15T12:00:00Z');
    });

    it('should generate IDs for items without them', () => {
      const state = parseState(validStateContent);
      const item = state.sections[2].items[0];

      expect(item.id).toBeDefined();
      expect(item.title).toBe('Simple task without ID');
    });

    it('should throw ParseError for missing frontmatter', () => {
      const content = '## Section\n\n- Item';
      expect(() => parseState(content)).toThrow(ParseError);
    });

    it('should throw ParseError for missing version', () => {
      const content = `---
project: test
---

## Section`;
      expect(() => parseState(content)).toThrow(ParseError);
    });

    it('should throw ParseError for missing project', () => {
      const content = `---
version: "1.0"
---

## Section`;
      expect(() => parseState(content)).toThrow(ParseError);
    });

    it('should handle empty sections', () => {
      const content = `---
version: "1.0"
project: test
---

## EmptySection`;

      const state = parseState(content);
      expect(state.sections[0].items).toHaveLength(0);
    });

    it('should parse custom metadata fields', () => {
      const content = `---
version: "1.0"
project: test
customField: customValue
---

## Section

- [ ] **task-1**: Test
  customKey: customValue
`;

      const state = parseState(content);
      expect(state.frontmatter.metadata?.customField).toBe('customValue');
      expect(state.sections[0].items[0].metadata?.customKey).toBe('customValue');
    });

    it('should parse tags correctly', () => {
      const content = `---
version: "1.0"
project: test
---

## Section

- [ ] **task-1**: Test
  tags: tag1, tag2, tag3
`;

      const state = parseState(content);
      expect(state.sections[0].items[0].tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should parse parent relationships', () => {
      const content = `---
version: "1.0"
project: test
---

## Section

- [ ] **task-1**: Test
  parent: epic-1
`;

      const state = parseState(content);
      expect(state.sections[0].items[0].parentId).toBe('epic-1');
    });

    it('should handle notes', () => {
      const content = `---
version: "1.0"
project: test
---

## Section

- [ ] **task-1**: Test
  This is a note
  Another note
`;

      const state = parseState(content);
      expect(state.sections[0].items[0].notes).toContain('This is a note');
      expect(state.sections[0].items[0].notes).toContain('Another note');
    });
  });

  describe('serializeState', () => {
    it('should serialize state to valid markdown', () => {
      const state = parseState(validStateContent);
      const serialized = serializeState(state);

      expect(serialized).toContain('---');
      expect(serialized).toContain('version: "1.0"');
      expect(serialized).toContain('project: test-project');
      expect(serialized).toContain('## Overview');
      expect(serialized).toContain('## Active');
    });

    it('should include all item fields', () => {
      const state = parseState(validStateContent);
      const serialized = serializeState(state);

      expect(serialized).toContain('task-abc123');
      expect(serialized).toContain('type: task');
      expect(serialized).toContain('priority: high');
      expect(serialized).toContain('owner: test-user');
    });

    it('should update lastSync timestamp', () => {
      const state = parseState(validStateContent);
      const serialized = serializeState(state);

      expect(serialized).toContain('lastSync:');
    });

    it('should maintain section order', () => {
      const state: State = {
        frontmatter: {
          version: '1.0',
          project: 'test',
          lastSync: new Date().toISOString(),
        },
        sections: [
          { type: 'backlog', items: [], order: 2 },
          { type: 'active', items: [], order: 0 },
          { type: 'completed', items: [], order: 1 },
        ],
      };

      const serialized = serializeState(state);
      const activeIndex = serialized.indexOf('## Active');
      const completedIndex = serialized.indexOf('## Completed');
      const backlogIndex = serialized.indexOf('## Backlog');

      expect(activeIndex).toBeLessThan(completedIndex);
      expect(completedIndex).toBeLessThan(backlogIndex);
    });
  });

  describe('extractAllItems', () => {
    it('should extract all items from all sections', () => {
      const state = parseState(validStateContent);
      const items = extractAllItems(state);

      expect(items).toHaveLength(3);
    });

    it('should return empty array for empty state', () => {
      const state: State = {
        frontmatter: {
          version: '1.0',
          project: 'test',
          lastSync: new Date().toISOString(),
        },
        sections: [],
      };

      const items = extractAllItems(state);
      expect(items).toHaveLength(0);
    });
  });

  describe('findItemById', () => {
    it('should find item by ID', () => {
      const state = parseState(validStateContent);
      const item = findItemById(state, 'task-abc123');

      expect(item).toBeDefined();
      expect(item?.title).toBe('Test task');
    });

    it('should return undefined for non-existent ID', () => {
      const state = parseState(validStateContent);
      const item = findItemById(state, 'non-existent');

      expect(item).toBeUndefined();
    });
  });

  describe('upsertItem', () => {
    it('should update existing item', () => {
      const state = parseState(validStateContent);
      const updatedItem: StateItem = {
        id: 'task-abc123',
        title: 'Updated title',
        status: 'completed',
      };

      const newState = upsertItem(state, updatedItem);
      const item = findItemById(newState, 'task-abc123');

      expect(item?.title).toBe('Updated title');
      expect(item?.status).toBe('completed');
    });

    it('should add new item to appropriate section', () => {
      const state = parseState(validStateContent);
      const newItem: StateItem = {
        id: 'task-new',
        title: 'New task',
        status: 'blocked',
      };

      const newState = upsertItem(state, newItem);
      const item = findItemById(newState, 'task-new');

      expect(item).toBeDefined();
    });
  });

  describe('removeItem', () => {
    it('should remove item by ID', () => {
      const state = parseState(validStateContent);
      const newState = removeItem(state, 'task-abc123');

      expect(findItemById(newState, 'task-abc123')).toBeUndefined();
    });

    it('should not modify state if item not found', () => {
      const state = parseState(validStateContent);
      const newState = removeItem(state, 'non-existent');

      expect(newState.sections[0].items).toHaveLength(1);
    });
  });
});
