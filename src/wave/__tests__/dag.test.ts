/**
 * DAG (Directed Acyclic Graph) tests
 */

import {
  createDependencyGraph,
  addTaskToGraph,
  buildDependencyGraph,
  detectCycles,
  validateGraph,
  topologicalSort,
  getAncestors,
  getDescendants,
  getLongestPathFromRoots,
  getCriticalPath,
  removeTaskFromGraph,
  cloneGraph,
} from '../dag';
import { WaveTask } from '../types';

function createMockTask(
  id: string,
  dependencies: string[] = []
): WaveTask {
  return {
    id,
    name: `Task ${id}`,
    dependencies,
    dependents: [],
    status: 'pending',
    waveNumber: -1,
    execute: async () => ({ success: true, durationMs: 100 }),
    priority: 0,
    maxRetries: 0,
    retryCount: 0,
    timeoutMs: 30000,
  };
}

describe('DAG Operations', () => {
  describe('createDependencyGraph', () => {
    it('should create an empty graph', () => {
      const graph = createDependencyGraph();

      expect(graph.nodes.size).toBe(0);
      expect(graph.roots.size).toBe(0);
      expect(graph.leaves.size).toBe(0);
      expect(graph.validated).toBe(false);
      expect(graph.isAcyclic).toBe(false);
    });
  });

  describe('addTaskToGraph', () => {
    it('should add a task without dependencies', () => {
      const graph = createDependencyGraph();
      const task = createMockTask('task-1');

      addTaskToGraph(graph, task);

      expect(graph.nodes.size).toBe(1);
      expect(graph.nodes.has('task-1')).toBe(true);
      expect(graph.roots.has('task-1')).toBe(true);
      expect(graph.leaves.has('task-1')).toBe(true);
    });

    it('should add a task with dependencies', () => {
      const graph = createDependencyGraph();
      const task1 = createMockTask('task-1');
      const task2 = createMockTask('task-2', ['task-1']);

      addTaskToGraph(graph, task1);
      addTaskToGraph(graph, task2);

      expect(graph.nodes.size).toBe(2);
      expect(graph.roots.has('task-1')).toBe(true);
      expect(graph.roots.has('task-2')).toBe(false);
      expect(graph.leaves.has('task-1')).toBe(false);
      expect(graph.leaves.has('task-2')).toBe(true);

      const node2 = graph.nodes.get('task-2');
      expect(node2?.dependencies.has('task-1')).toBe(true);

      const node1 = graph.nodes.get('task-1');
      expect(node1?.dependents.has('task-2')).toBe(true);
    });

    it('should handle multiple dependencies', () => {
      const graph = createDependencyGraph();
      const task1 = createMockTask('task-1');
      const task2 = createMockTask('task-2');
      const task3 = createMockTask('task-3', ['task-1', 'task-2']);

      addTaskToGraph(graph, task1);
      addTaskToGraph(graph, task2);
      addTaskToGraph(graph, task3);

      const node3 = graph.nodes.get('task-3');
      expect(node3?.dependencies.size).toBe(2);
      expect(node3?.inDegree).toBe(2);
    });
  });

  describe('buildDependencyGraph', () => {
    it('should build graph from multiple tasks', () => {
      const tasks = [
        createMockTask('a'),
        createMockTask('b', ['a']),
        createMockTask('c', ['a']),
        createMockTask('d', ['b', 'c']),
      ];

      const graph = buildDependencyGraph(tasks);

      expect(graph.nodes.size).toBe(4);
      expect(graph.roots.size).toBe(1);
      expect(graph.roots.has('a')).toBe(true);
      expect(graph.leaves.size).toBe(1);
      expect(graph.leaves.has('d')).toBe(true);
    });
  });

  describe('detectCycles', () => {
    it('should return no cycle for acyclic graph', () => {
      const tasks = [
        createMockTask('a'),
        createMockTask('b', ['a']),
        createMockTask('c', ['b']),
      ];

      const graph = buildDependencyGraph(tasks);
      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(false);
    });

    it('should detect a simple cycle', () => {
      const graph = createDependencyGraph();
      // Create a cycle: a -> b -> c -> a
      const taskA = createMockTask('a', ['c']);
      const taskB = createMockTask('b', ['a']);
      const taskC = createMockTask('c', ['b']);

      addTaskToGraph(graph, taskA);
      addTaskToGraph(graph, taskB);
      addTaskToGraph(graph, taskC);

      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(true);
      expect(result.cycle).toBeDefined();
      expect(result.cycle?.length).toBeGreaterThan(0);
    });

    it('should detect self-reference as cycle', () => {
      const graph = createDependencyGraph();
      const task = createMockTask('self-dep', ['self-dep']);

      addTaskToGraph(graph, task);

      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(true);
    });

    it('should detect cycle in disconnected graph', () => {
      const tasks = [
        createMockTask('a'),
        createMockTask('b', ['a']),
        createMockTask('x', ['y']),
        createMockTask('y', ['x']), // cycle
      ];

      const graph = buildDependencyGraph(tasks);
      const result = detectCycles(graph);

      expect(result.hasCycle).toBe(true);
    });
  });

  describe('validateGraph', () => {
    it('should return true for valid DAG', () => {
      const tasks = [
        createMockTask('a'),
        createMockTask('b', ['a']),
      ];

      const graph = buildDependencyGraph(tasks);
      const isValid = validateGraph(graph);

      expect(isValid).toBe(true);
      expect(graph.validated).toBe(true);
      expect(graph.isAcyclic).toBe(true);
    });

    it('should return false for cyclic graph', () => {
      const graph = createDependencyGraph();
      const taskA = createMockTask('a', ['b']);
      const taskB = createMockTask('b', ['a']);

      addTaskToGraph(graph, taskA);
      addTaskToGraph(graph, taskB);

      const isValid = validateGraph(graph);

      expect(isValid).toBe(false);
      expect(graph.validated).toBe(true);
      expect(graph.isAcyclic).toBe(false);
    });
  });

  describe('topologicalSort', () => {
    it('should return valid topological order', () => {
      const tasks = [
        createMockTask('a'),
        createMockTask('b', ['a']),
        createMockTask('c', ['a']),
        createMockTask('d', ['b', 'c']),
      ];

      const graph = buildDependencyGraph(tasks);
      const result = topologicalSort(graph);

      expect(result.success).toBe(true);
      expect(result.order).toBeDefined();
      expect(result.order).toHaveLength(4);

      // Verify dependencies come before dependents
      const order = result.order!;
      expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
      expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'));
      expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'));
      expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
    });

    it('should fail for cyclic graph', () => {
      const graph = createDependencyGraph();
      const taskA = createMockTask('a', ['b']);
      const taskB = createMockTask('b', ['a']);

      addTaskToGraph(graph, taskA);
      addTaskToGraph(graph, taskB);

      const result = topologicalSort(graph);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getAncestors', () => {
    it('should return all ancestors', () => {
      const tasks = [
        createMockTask('a'),
        createMockTask('b', ['a']),
        createMockTask('c', ['b']),
        createMockTask('d', ['c']),
      ];

      const graph = buildDependencyGraph(tasks);
      const ancestors = getAncestors(graph, 'd');

      expect(ancestors.has('a')).toBe(true);
      expect(ancestors.has('b')).toBe(true);
      expect(ancestors.has('c')).toBe(true);
      expect(ancestors.has('d')).toBe(false);
    });

    it('should return empty set for root', () => {
      const tasks = [createMockTask('a')];
      const graph = buildDependencyGraph(tasks);
      const ancestors = getAncestors(graph, 'a');

      expect(ancestors.size).toBe(0);
    });
  });

  describe('getDescendants', () => {
    it('should return all descendants', () => {
      const tasks = [
        createMockTask('a'),
        createMockTask('b', ['a']),
        createMockTask('c', ['a']),
        createMockTask('d', ['b']),
      ];

      const graph = buildDependencyGraph(tasks);
      const descendants = getDescendants(graph, 'a');

      expect(descendants.has('b')).toBe(true);
      expect(descendants.has('c')).toBe(true);
      expect(descendants.has('d')).toBe(true);
      expect(descendants.has('a')).toBe(false);
    });

    it('should return empty set for leaf', () => {
      const tasks = [
        createMockTask('a'),
        createMockTask('b', ['a']),
      ];

      const graph = buildDependencyGraph(tasks);
      const descendants = getDescendants(graph, 'b');

      expect(descendants.size).toBe(0);
    });
  });

  describe('getLongestPathFromRoots', () => {
    it('should calculate correct depth', () => {
      const tasks = [
        createMockTask('a'),
        createMockTask('b', ['a']),
        createMockTask('c', ['b']),
      ];

      const graph = buildDependencyGraph(tasks);

      expect(getLongestPathFromRoots(graph, 'a')).toBe(0);
      expect(getLongestPathFromRoots(graph, 'b')).toBe(1);
      expect(getLongestPathFromRoots(graph, 'c')).toBe(2);
    });

    it('should handle diamond pattern', () => {
      const tasks = [
        createMockTask('a'),
        createMockTask('b', ['a']),
        createMockTask('c', ['a']),
        createMockTask('d', ['b', 'c']),
      ];

      const graph = buildDependencyGraph(tasks);

      expect(getLongestPathFromRoots(graph, 'd')).toBe(2);
    });
  });

  describe('getCriticalPath', () => {
    it('should find critical path', () => {
      const tasks = [
        createMockTask('a'),
        createMockTask('b', ['a']),
        createMockTask('c', ['a']),
        createMockTask('d', ['b']),
        createMockTask('e', ['c']),
      ];

      const graph = buildDependencyGraph(tasks);
      const criticalPath = getCriticalPath(graph);

      expect(criticalPath.length).toBe(3);
      expect(criticalPath[0]).toBe('a');
    });

    it('should handle single node', () => {
      const tasks = [createMockTask('a')];
      const graph = buildDependencyGraph(tasks);
      const criticalPath = getCriticalPath(graph);

      expect(criticalPath).toEqual(['a']);
    });
  });

  describe('removeTaskFromGraph', () => {
    it('should remove task and update connections', () => {
      const tasks = [
        createMockTask('a'),
        createMockTask('b', ['a']),
        createMockTask('c', ['b']),
      ];

      const graph = buildDependencyGraph(tasks);
      const removed = removeTaskFromGraph(graph, 'b');

      expect(removed).toBe(true);
      expect(graph.nodes.has('b')).toBe(false);

      // c should now be a root (no dependencies)
      const nodeC = graph.nodes.get('c');
      expect(nodeC?.dependencies.has('b')).toBe(false);
    });

    it('should return false for non-existent task', () => {
      const graph = createDependencyGraph();
      const removed = removeTaskFromGraph(graph, 'non-existent');

      expect(removed).toBe(false);
    });
  });

  describe('cloneGraph', () => {
    it('should create independent copy', () => {
      const tasks = [
        createMockTask('a'),
        createMockTask('b', ['a']),
      ];

      const original = buildDependencyGraph(tasks);
      const clone = cloneGraph(original);

      expect(clone.nodes.size).toBe(original.nodes.size);
      expect(clone.roots.size).toBe(original.roots.size);

      // Modifying clone should not affect original
      removeTaskFromGraph(clone, 'a');
      expect(original.nodes.has('a')).toBe(true);
      expect(clone.nodes.has('a')).toBe(false);
    });
  });
});
