/**
 * DAG (Directed Acyclic Graph) Construction and Validation
 *
 * Handles building dependency graphs, cycle detection, and topological sorting.
 */

import {
  TaskId,
  DependencyGraph,
  DependencyNode,
  WaveTask,
  CycleDetectionResult,
  TopologicalSortResult,
} from './types';

/**
 * Create an empty dependency graph
 */
export function createDependencyGraph(): DependencyGraph {
  return {
    nodes: new Map(),
    roots: new Set(),
    leaves: new Set(),
    validated: false,
    isAcyclic: false,
  };
}

/**
 * Add a task to the dependency graph
 */
export function addTaskToGraph(graph: DependencyGraph, task: WaveTask): void {
  // Create or update node
  let node = graph.nodes.get(task.id);
  if (!node) {
    node = {
      id: task.id,
      dependencies: new Set(),
      dependents: new Set(),
      inDegree: 0,
      outDegree: 0,
    };
    graph.nodes.set(task.id, node);
  }

  // Add dependencies
  for (const depId of task.dependencies) {
    node.dependencies.add(depId);
    node.inDegree = node.dependencies.size;

    // Update the dependency's dependents
    let depNode = graph.nodes.get(depId);
    if (!depNode) {
      depNode = {
        id: depId,
        dependencies: new Set(),
        dependents: new Set(),
        inDegree: 0,
        outDegree: 0,
      };
      graph.nodes.set(depId, depNode);
    }
    depNode.dependents.add(task.id);
    depNode.outDegree = depNode.dependents.size;

    // Update roots and leaves for the dependency node
    updateRootsAndLeaves(graph, depNode);
  }

  // Update roots and leaves for the current node
  updateRootsAndLeaves(graph, node);
}

/**
 * Update roots and leaves sets based on a node
 */
function updateRootsAndLeaves(graph: DependencyGraph, node: DependencyNode): void {
  // A root has no dependencies
  if (node.inDegree === 0) {
    graph.roots.add(node.id);
  } else {
    graph.roots.delete(node.id);
  }

  // A leaf has no dependents
  if (node.outDegree === 0) {
    graph.leaves.add(node.id);
  } else {
    graph.leaves.delete(node.id);
  }
}

/**
 * Build a dependency graph from an array of tasks
 */
export function buildDependencyGraph(tasks: WaveTask[]): DependencyGraph {
  const graph = createDependencyGraph();

  for (const task of tasks) {
    addTaskToGraph(graph, task);
  }

  return graph;
}

/**
 * Detect cycles in the dependency graph using DFS
 */
export function detectCycles(graph: DependencyGraph): CycleDetectionResult {
  const visited = new Set<TaskId>();
  const recursionStack = new Set<TaskId>();
  const path: TaskId[] = [];

  function dfs(nodeId: TaskId): TaskId[] | null {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const node = graph.nodes.get(nodeId);
    if (node) {
      for (const dependentId of node.dependents) {
        if (!visited.has(dependentId)) {
          const cycle = dfs(dependentId);
          if (cycle) return cycle;
        } else if (recursionStack.has(dependentId)) {
          // Found a cycle - extract the cycle from the path
          const cycleStart = path.indexOf(dependentId);
          return path.slice(cycleStart).concat([dependentId]);
        }
      }
    }

    path.pop();
    recursionStack.delete(nodeId);
    return null;
  }

  // Check all nodes (in case of disconnected components)
  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      const cycle = dfs(nodeId);
      if (cycle) {
        return {
          hasCycle: true,
          cycle,
          description: `Cycle detected: ${cycle.join(' -> ')}`,
        };
      }
    }
  }

  return { hasCycle: false };
}

/**
 * Validate the dependency graph (check for cycles)
 */
export function validateGraph(graph: DependencyGraph): boolean {
  const cycleResult = detectCycles(graph);
  graph.validated = true;
  graph.isAcyclic = !cycleResult.hasCycle;
  return graph.isAcyclic;
}

/**
 * Perform topological sort on the dependency graph
 * Uses Kahn's algorithm for O(V + E) complexity
 */
export function topologicalSort(graph: DependencyGraph): TopologicalSortResult {
  // First validate the graph
  if (!graph.validated) {
    const isValid = validateGraph(graph);
    if (!isValid) {
      const cycleResult = detectCycles(graph);
      return {
        success: false,
        error: cycleResult.description || 'Cycle detected in dependency graph',
      };
    }
  }

  // Kahn's algorithm
  const inDegree = new Map<TaskId, number>();
  const result: TaskId[] = [];
  const queue: TaskId[] = [];

  // Initialize in-degrees
  for (const [id, node] of graph.nodes) {
    inDegree.set(id, node.inDegree);
    if (node.inDegree === 0) {
      queue.push(id);
    }
  }

  // Process queue
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    result.push(currentId);

    const node = graph.nodes.get(currentId);
    if (node) {
      for (const dependentId of node.dependents) {
        const newDegree = (inDegree.get(dependentId) || 0) - 1;
        inDegree.set(dependentId, newDegree);
        if (newDegree === 0) {
          queue.push(dependentId);
        }
      }
    }
  }

  // Check if all nodes were processed
  if (result.length !== graph.nodes.size) {
    return {
      success: false,
      error: 'Cycle detected - not all nodes could be sorted',
    };
  }

  return { success: true, order: result };
}

/**
 * Get all ancestors of a task (transitive dependencies)
 */
export function getAncestors(graph: DependencyGraph, taskId: TaskId): Set<TaskId> {
  const ancestors = new Set<TaskId>();
  const visited = new Set<TaskId>();

  function visit(id: TaskId): void {
    if (visited.has(id)) return;
    visited.add(id);

    const node = graph.nodes.get(id);
    if (node) {
      for (const depId of node.dependencies) {
        ancestors.add(depId);
        visit(depId);
      }
    }
  }

  visit(taskId);
  return ancestors;
}

/**
 * Get all descendants of a task (transitive dependents)
 */
export function getDescendants(graph: DependencyGraph, taskId: TaskId): Set<TaskId> {
  const descendants = new Set<TaskId>();
  const visited = new Set<TaskId>();

  function visit(id: TaskId): void {
    if (visited.has(id)) return;
    visited.add(id);

    const node = graph.nodes.get(id);
    if (node) {
      for (const dependentId of node.dependents) {
        descendants.add(dependentId);
        visit(dependentId);
      }
    }
  }

  visit(taskId);
  return descendants;
}

/**
 * Find the longest path from any root to this task
 * This determines the minimum wave number for a task
 */
export function getLongestPathFromRoots(graph: DependencyGraph, taskId: TaskId): number {
  const memo = new Map<TaskId, number>();

  function getDepth(id: TaskId): number {
    if (memo.has(id)) {
      return memo.get(id)!;
    }

    const node = graph.nodes.get(id);
    if (!node || node.dependencies.size === 0) {
      memo.set(id, 0);
      return 0;
    }

    let maxDepth = 0;
    for (const depId of node.dependencies) {
      maxDepth = Math.max(maxDepth, getDepth(depId) + 1);
    }

    memo.set(id, maxDepth);
    return maxDepth;
  }

  return getDepth(taskId);
}

/**
 * Get the critical path (longest path from any root to any leaf)
 */
export function getCriticalPath(graph: DependencyGraph): TaskId[] {
  const memo = new Map<TaskId, { length: number; path: TaskId[] }>();

  function computePath(id: TaskId): { length: number; path: TaskId[] } {
    if (memo.has(id)) {
      return memo.get(id)!;
    }

    const node = graph.nodes.get(id);
    if (!node || node.dependents.size === 0) {
      const result = { length: 1, path: [id] };
      memo.set(id, result);
      return result;
    }

    let longest = { length: 1, path: [id] };
    for (const dependentId of node.dependents) {
      const subPath = computePath(dependentId);
      if (subPath.length + 1 > longest.length) {
        longest = {
          length: subPath.length + 1,
          path: [id, ...subPath.path],
        };
      }
    }

    memo.set(id, longest);
    return longest;
  }

  // Find the longest path starting from any root
  let criticalPath: TaskId[] = [];
  let maxLength = 0;

  for (const rootId of graph.roots) {
    const pathInfo = computePath(rootId);
    if (pathInfo.length > maxLength) {
      maxLength = pathInfo.length;
      criticalPath = pathInfo.path;
    }
  }

  return criticalPath;
}

/**
 * Remove a task from the graph
 */
export function removeTaskFromGraph(graph: DependencyGraph, taskId: TaskId): boolean {
  const node = graph.nodes.get(taskId);
  if (!node) return false;

  // Remove this task from its dependencies' dependents
  for (const depId of node.dependencies) {
    const depNode = graph.nodes.get(depId);
    if (depNode) {
      depNode.dependents.delete(taskId);
      depNode.outDegree = depNode.dependents.size;
      updateRootsAndLeaves(graph, depNode);
    }
  }

  // Remove this task from its dependents' dependencies
  for (const dependentId of node.dependents) {
    const dependentNode = graph.nodes.get(dependentId);
    if (dependentNode) {
      dependentNode.dependencies.delete(taskId);
      dependentNode.inDegree = dependentNode.dependencies.size;
      updateRootsAndLeaves(graph, dependentNode);
    }
  }

  // Remove the node
  graph.nodes.delete(taskId);
  graph.roots.delete(taskId);
  graph.leaves.delete(taskId);

  // Reset validation state
  graph.validated = false;

  return true;
}

/**
 * Clone a dependency graph
 */
export function cloneGraph(graph: DependencyGraph): DependencyGraph {
  const cloned = createDependencyGraph();

  for (const [id, node] of graph.nodes) {
    cloned.nodes.set(id, {
      id: node.id,
      dependencies: new Set(node.dependencies),
      dependents: new Set(node.dependents),
      inDegree: node.inDegree,
      outDegree: node.outDegree,
    });
  }

  for (const id of graph.roots) {
    cloned.roots.add(id);
  }

  for (const id of graph.leaves) {
    cloned.leaves.add(id);
  }

  cloned.validated = graph.validated;
  cloned.isAcyclic = graph.isAcyclic;

  return cloned;
}
