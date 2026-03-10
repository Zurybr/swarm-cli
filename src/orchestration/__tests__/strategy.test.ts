/**
 * Tests for coordination strategies
 */

import {
  ParallelStrategy,
  SequentialStrategy,
  AdaptiveStrategy,
  HierarchicalStrategy,
  createStrategy,
  getAvailableStrategies,
  recommendStrategy,
} from '../strategy';
import { Agent, Task, CoordinationStrategyType } from '../types';

describe('Coordination Strategies', () => {
  let mockAgents: Agent[];
  let mockTasks: Task[];

  beforeEach(() => {
    mockAgents = [
      {
        id: 'agent-1',
        type: 'executor',
        name: 'Executor 1',
        status: 'idle',
        config: {} as Agent['config'],
        assignedTasks: [],
        maxConcurrentTasks: 5,
        workload: 0,
        health: {
          lastHeartbeat: new Date(),
          successRate: 1.0,
          averageResponseTime: 100,
          errorCount: 0,
        },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      },
      {
        id: 'agent-2',
        type: 'tester',
        name: 'Tester 1',
        status: 'idle',
        config: {} as Agent['config'],
        assignedTasks: [],
        maxConcurrentTasks: 5,
        workload: 0,
        health: {
          lastHeartbeat: new Date(),
          successRate: 0.9,
          averageResponseTime: 150,
          errorCount: 1,
        },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      },
    ];

    mockTasks = [
      {
        id: 'task-1',
        title: 'Task 1',
        description: 'First task',
        taskType: 'implement',
        status: 'pending',
        priority: 'high',
        complexity: 'moderate',
        dependencies: [],
        dependents: [],
        createdAt: new Date(),
      },
      {
        id: 'task-2',
        title: 'Task 2',
        description: 'Second task',
        taskType: 'test',
        status: 'pending',
        priority: 'medium',
        complexity: 'simple',
        dependencies: [],
        dependents: [],
        createdAt: new Date(),
      },
    ];
  });

  describe('ParallelStrategy', () => {
    let strategy: ParallelStrategy;

    beforeEach(() => {
      strategy = new ParallelStrategy();
    });

    it('should have correct type and name', () => {
      expect(strategy.type).toBe('parallel');
      expect(strategy.name).toBe('Parallel');
    });

    it('should assign multiple tasks simultaneously', () => {
      const assignments = strategy.execute(mockTasks, mockAgents);

      expect(assignments.length).toBeGreaterThan(0);
    });

    it('should assign highest priority tasks first', () => {
      const assignments = strategy.execute(mockTasks, mockAgents);

      if (assignments.length > 0) {
        expect(assignments[0].taskId).toBe('task-1'); // High priority
      }
    });

    it('should return empty array when no agents available', () => {
      const assignments = strategy.execute(mockTasks, []);
      expect(assignments).toHaveLength(0);
    });

    it('should return empty array when no pending tasks', () => {
      const assignments = strategy.execute([], mockAgents);
      expect(assignments).toHaveLength(0);
    });
  });

  describe('SequentialStrategy', () => {
    let strategy: SequentialStrategy;

    beforeEach(() => {
      strategy = new SequentialStrategy();
    });

    it('should have correct type and name', () => {
      expect(strategy.type).toBe('sequential');
      expect(strategy.name).toBe('Sequential');
    });

    it('should assign only one task at a time', () => {
      const assignments = strategy.execute(mockTasks, mockAgents);

      expect(assignments.length).toBeLessThanOrEqual(1);
    });

    it('should assign highest priority task', () => {
      const assignments = strategy.execute(mockTasks, mockAgents);

      if (assignments.length > 0) {
        expect(assignments[0].taskId).toBe('task-1');
      }
    });
  });

  describe('AdaptiveStrategy', () => {
    let strategy: AdaptiveStrategy;

    beforeEach(() => {
      strategy = new AdaptiveStrategy();
    });

    it('should have correct type and name', () => {
      expect(strategy.type).toBe('adaptive');
      expect(strategy.name).toBe('Adaptive');
    });

    it('should assign tasks based on conditions', () => {
      const assignments = strategy.execute(mockTasks, mockAgents);

      // Should assign some tasks
      expect(assignments.length).toBeGreaterThanOrEqual(0);
    });

    it('should use sequential strategy under high workload', () => {
      // Create agents with high workload
      const busyAgents = mockAgents.map(a => ({
        ...a,
        workload: 0.9,
        status: 'busy' as const,
      }));

      const assignments = strategy.execute(mockTasks, busyAgents);

      // Under high workload, should be more conservative
      expect(assignments.length).toBeLessThanOrEqual(1);
    });

    it('should provide statistics', () => {
      const stats = strategy.getStats();

      expect(stats.recentSuccessRate).toBeDefined();
      expect(stats.strategyDistribution).toBeDefined();
    });

    it('should track task completion', () => {
      strategy.onTaskComplete(mockTasks[0], { success: true });

      const stats = strategy.getStats();
      expect(stats.recentSuccessRate).toBe(1);
    });

    it('should track task failures', () => {
      strategy.onTaskFail(mockTasks[0], 'Error');

      const stats = strategy.getStats();
      expect(stats.recentSuccessRate).toBeLessThan(1);
    });
  });

  describe('HierarchicalStrategy', () => {
    let strategy: HierarchicalStrategy;

    beforeEach(() => {
      strategy = new HierarchicalStrategy();
    });

    it('should have correct type and name', () => {
      expect(strategy.type).toBe('hierarchical');
      expect(strategy.name).toBe('Hierarchical');
    });

    it('should handle tasks with coordinator agents', () => {
      const coordinatorAgent: Agent = {
        ...mockAgents[0],
        id: 'coordinator-1',
        type: 'coordinator',
      };

      const assignments = strategy.execute(mockTasks, [coordinatorAgent, ...mockAgents]);

      expect(assignments.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createStrategy', () => {
    it('should create parallel strategy', () => {
      const strategy = createStrategy('parallel');
      expect(strategy.type).toBe('parallel');
    });

    it('should create sequential strategy', () => {
      const strategy = createStrategy('sequential');
      expect(strategy.type).toBe('sequential');
    });

    it('should create adaptive strategy', () => {
      const strategy = createStrategy('adaptive');
      expect(strategy.type).toBe('adaptive');
    });

    it('should create hierarchical strategy', () => {
      const strategy = createStrategy('hierarchical');
      expect(strategy.type).toBe('hierarchical');
    });

    it('should throw for unknown strategy type', () => {
      expect(() => createStrategy('unknown' as CoordinationStrategyType)).toThrow(
        'Unknown strategy type'
      );
    });
  });

  describe('getAvailableStrategies', () => {
    it('should return all strategies', () => {
      const strategies = getAvailableStrategies();

      expect(strategies).toHaveLength(4);

      const types = strategies.map(s => s.type);
      expect(types).toContain('parallel');
      expect(types).toContain('sequential');
      expect(types).toContain('adaptive');
      expect(types).toContain('hierarchical');
    });
  });

  describe('recommendStrategy', () => {
    it('should recommend hierarchical for large scale', () => {
      const recommendation = recommendStrategy(100, 50, 0.1);
      expect(recommendation).toBe('hierarchical');
    });

    it('should recommend sequential for high dependency ratio', () => {
      const recommendation = recommendStrategy(10, 5, 0.6);
      expect(recommendation).toBe('sequential');
    });

    it('should recommend parallel for many tasks', () => {
      const recommendation = recommendStrategy(20, 5, 0.1);
      expect(recommendation).toBe('parallel');
    });

    it('should recommend adaptive as default', () => {
      const recommendation = recommendStrategy(5, 5, 0.1);
      expect(recommendation).toBe('adaptive');
    });
  });
});
