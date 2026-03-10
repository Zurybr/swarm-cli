/**
 * Tests for coordinator
 */

import { Coordinator } from '../coordinator';
import { SwarmManager, createSwarm } from '../swarm';
import { AgentType, CoordinationStrategyType } from '../types';

describe('Coordinator', () => {
  let swarm: SwarmManager;
  let coordinator: Coordinator;

  beforeEach(() => {
    swarm = createSwarm('Test Swarm', {
      maxAgents: 10,
      strategy: 'adaptive',
    });
    coordinator = new Coordinator(swarm, {
      defaultStrategy: 'adaptive',
      autoRoute: false,
    });
  });

  afterEach(async () => {
    if (swarm.getStatus() !== 'terminated') {
      await swarm.shutdown(false);
    }
  });

  describe('setStrategy', () => {
    it('should set strategy correctly', () => {
      coordinator.setStrategy('parallel');
      expect(coordinator.getStrategy().type).toBe('parallel');
    });

    it('should throw error for unknown strategy', () => {
      expect(() => {
        coordinator.setStrategy('unknown' as CoordinationStrategyType);
      }).toThrow('Unknown strategy type');
    });
  });

  describe('processPendingTasks', () => {
    it('should assign pending tasks to available agents', async () => {
      const agent = swarm.registerAgent({ type: 'executor' });
      swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      const assignments = await coordinator.processPendingTasks();

      expect(assignments.length).toBeGreaterThan(0);
      expect(swarm.getTask(assignments[0].taskId)?.assignedTo).toBe(agent.id);
    });

    it('should not assign when no agents available', async () => {
      swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      const assignments = await coordinator.processPendingTasks();

      expect(assignments).toHaveLength(0);
    });

    it('should not assign when no pending tasks', async () => {
      swarm.registerAgent({ type: 'executor' });

      const assignments = await coordinator.processPendingTasks();

      expect(assignments).toHaveLength(0);
    });
  });

  describe('routeTask', () => {
    it('should route task to best agent type', () => {
      const task = swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      const decision = coordinator.routeTask(task);

      expect(decision.agentType).toBeDefined();
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.reasoning).toBeDefined();
      expect(decision.alternatives).toBeDefined();
      expect(decision.modelConfig).toBeDefined();
    });

    it('should route to required agent type when specified', () => {
      const task = swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
        requiredAgentType: 'tester',
      });

      const decision = coordinator.routeTask(task);

      expect(decision.agentType).toBe('tester');
    });

    it('should provide alternatives', () => {
      const task = swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      const decision = coordinator.routeTask(task);

      expect(decision.alternatives.length).toBeGreaterThan(0);
    });
  });

  describe('getWorkloadDistribution', () => {
    it('should calculate workload distribution', () => {
      swarm.registerAgent({ type: 'executor' });
      swarm.registerAgent({ type: 'tester' });

      const distribution = coordinator.getWorkloadDistribution();

      expect(distribution.executor).toBeDefined();
      expect(distribution.tester).toBeDefined();
    });

    it('should track agent counts', () => {
      swarm.registerAgent({ type: 'executor' });
      swarm.registerAgent({ type: 'executor' });

      const distribution = coordinator.getWorkloadDistribution();

      expect(distribution.executor.count).toBe(2);
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue status', () => {
      const agent = swarm.registerAgent({ type: 'executor' });

      // Create tasks in different states
      const task1 = swarm.createTask({
        title: 'Pending Task',
        description: 'Test',
        taskType: 'implement',
      });

      const task2 = swarm.createTask({
        title: 'Completed Task',
        description: 'Test',
        taskType: 'implement',
      });

      swarm.assignTask(task2.id, agent.id);
      swarm.startTask(task2.id);
      swarm.completeTask(task2.id, { success: true });

      const status = coordinator.getQueueStatus();

      expect(status.pending).toBe(1);
      expect(status.completed).toBe(1);
      expect(status.pending + status.assigned + status.inProgress + status.completed + status.failed).toBe(2);
    });
  });

  describe('createWorkflow', () => {
    it('should create a workflow with tasks', () => {
      const taskIds = coordinator.createWorkflow([
        { title: 'Task 1', description: 'First', taskType: 'implement' },
        { title: 'Task 2', description: 'Second', taskType: 'test' },
      ]);

      expect(taskIds).toHaveLength(2);
      expect(swarm.getTask(taskIds[0])).toBeDefined();
      expect(swarm.getTask(taskIds[1])).toBeDefined();
    });

    it('should set up dependencies correctly', () => {
      const taskIds = coordinator.createWorkflow([
        { title: 'Task 1', description: 'First', taskType: 'implement' },
        { title: 'Task 2', description: 'Second', taskType: 'test', dependencies: ['Task 1'] },
      ]);

      const task2 = swarm.getTask(taskIds[1]);
      expect(task2?.dependencies).toContain(taskIds[0]);
    });
  });

  describe('getWorkflowStatus', () => {
    it('should return workflow status', () => {
      const agent = swarm.registerAgent({ type: 'executor' });

      const taskIds = coordinator.createWorkflow([
        { title: 'Task 1', description: 'First', taskType: 'implement' },
        { title: 'Task 2', description: 'Second', taskType: 'implement' },
      ]);

      // Complete first task
      swarm.assignTask(taskIds[0], agent.id);
      swarm.startTask(taskIds[0]);
      swarm.completeTask(taskIds[0], { success: true });

      const status = coordinator.getWorkflowStatus(taskIds);

      expect(status.total).toBe(2);
      expect(status.completed).toBe(1);
      expect(status.progress).toBe(0.5);
    });
  });

  describe('getStats', () => {
    it('should return coordinator statistics', () => {
      const stats = coordinator.getStats();

      expect(stats.totalAssignments).toBeDefined();
      expect(stats.successfulAssignments).toBeDefined();
      expect(stats.failedAssignments).toBeDefined();
      expect(stats.strategy).toBeDefined();
    });
  });

  describe('balanceLoad', () => {
    it('should redistribute tasks from overloaded agents', () => {
      const agent1 = swarm.registerAgent({ type: 'executor' });
      const agent2 = swarm.registerAgent({ type: 'executor' });

      // Create multiple tasks and assign to agent1
      for (let i = 0; i < 5; i++) {
        const task = swarm.createTask({
          title: `Task ${i}`,
          description: 'Test',
          taskType: 'implement',
        });
        swarm.assignTask(task.id, agent1.id);
      }

      // Update workload to simulate overload
      swarm.updateAgentWorkload(agent1.id, 1);

      const assignments = coordinator.balanceLoad();

      // Should have redistributed some tasks
      expect(assignments.length).toBeGreaterThan(0);
    });
  });
});
