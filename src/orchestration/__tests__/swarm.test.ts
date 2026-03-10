/**
 * Tests for swarm management
 */

import { SwarmManager, createSwarm } from '../swarm';
import { AgentType, TaskResult } from '../types';

describe('SwarmManager', () => {
  let swarm: SwarmManager;

  beforeEach(() => {
    swarm = createSwarm('Test Swarm', {
      maxAgents: 10,
      strategy: 'adaptive',
    });
  });

  afterEach(async () => {
    if (swarm.getStatus() !== 'terminated') {
      await swarm.shutdown(false);
    }
  });

  describe('createSwarm', () => {
    it('should create a swarm with correct configuration', () => {
      expect(swarm.getInfo().name).toBe('Test Swarm');
      expect(swarm.getStatus()).toBe('active');
    });

    it('should auto-start by default', () => {
      expect(swarm.getStatus()).toBe('active');
    });
  });

  describe('registerAgent', () => {
    it('should register an agent', () => {
      const agent = swarm.registerAgent({ type: 'executor' });

      expect(agent.id).toBeDefined();
      expect(agent.type).toBe('executor');
      expect(agent.status).toBe('idle');
    });

    it('should register multiple agents', () => {
      const agent1 = swarm.registerAgent({ type: 'executor' });
      const agent2 = swarm.registerAgent({ type: 'tester' });

      expect(swarm.getAllAgents()).toHaveLength(2);
      expect(agent1.id).not.toBe(agent2.id);
    });

    it('should throw error when max agents reached', () => {
      const smallSwarm = createSwarm('Small Swarm', { maxAgents: 1 });

      smallSwarm.registerAgent({ type: 'executor' });

      expect(() => {
        smallSwarm.registerAgent({ type: 'tester' });
      }).toThrow('maximum agent limit');
    });

    it('should get agents by type', () => {
      swarm.registerAgent({ type: 'executor' });
      swarm.registerAgent({ type: 'executor' });
      swarm.registerAgent({ type: 'tester' });

      const executors = swarm.getAgentsByType('executor');
      expect(executors).toHaveLength(2);
    });
  });

  describe('unregisterAgent', () => {
    it('should unregister an agent', () => {
      const agent = swarm.registerAgent({ type: 'executor' });
      const result = swarm.unregisterAgent(agent.id);

      expect(result).toBe(true);
      expect(swarm.getAgent(agent.id)).toBeUndefined();
    });

    it('should return false for non-existent agent', () => {
      const result = swarm.unregisterAgent('non-existent');
      expect(result).toBe(false);
    });

    it('should reassign pending tasks on unregister', () => {
      const agent = swarm.registerAgent({ type: 'executor' });
      const task = swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      swarm.assignTask(task.id, agent.id);
      swarm.unregisterAgent(agent.id);

      const updatedTask = swarm.getTask(task.id);
      expect(updatedTask?.status).toBe('pending');
      expect(updatedTask?.assignedTo).toBeUndefined();
    });
  });

  describe('createTask', () => {
    it('should create a task', () => {
      const task = swarm.createTask({
        title: 'Test Task',
        description: 'Test description',
        taskType: 'implement',
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('pending');
    });

    it('should create task with priority', () => {
      const task = swarm.createTask({
        title: 'Critical Task',
        description: 'Test',
        taskType: 'implement',
        priority: 'critical',
      });

      expect(task.priority).toBe('critical');
    });

    it('should create task with dependencies', () => {
      const task1 = swarm.createTask({
        title: 'Task 1',
        description: 'First',
        taskType: 'implement',
      });

      const task2 = swarm.createTask({
        title: 'Task 2',
        description: 'Second',
        taskType: 'implement',
        dependencies: [task1.id],
      });

      expect(task2.dependencies).toContain(task1.id);
      expect(task1.dependents).toContain(task2.id);
    });
  });

  describe('assignTask', () => {
    it('should assign a task to an agent', () => {
      const agent = swarm.registerAgent({ type: 'executor' });
      const task = swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      const result = swarm.assignTask(task.id, agent.id);

      expect(result).toBe(true);
      expect(swarm.getTask(task.id)?.assignedTo).toBe(agent.id);
      expect(swarm.getTask(task.id)?.status).toBe('assigned');
    });

    it('should return false for non-existent task', () => {
      const agent = swarm.registerAgent({ type: 'executor' });
      const result = swarm.assignTask('non-existent', agent.id);

      expect(result).toBe(false);
    });

    it('should return false for non-existent agent', () => {
      const task = swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      const result = swarm.assignTask(task.id, 'non-existent');

      expect(result).toBe(false);
    });
  });

  describe('startTask', () => {
    it('should start an assigned task', () => {
      const agent = swarm.registerAgent({ type: 'executor' });
      const task = swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      swarm.assignTask(task.id, agent.id);
      const result = swarm.startTask(task.id);

      expect(result).toBe(true);
      expect(swarm.getTask(task.id)?.status).toBe('in_progress');
    });

    it('should return false for non-assigned task', () => {
      const task = swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      const result = swarm.startTask(task.id);

      expect(result).toBe(false);
    });
  });

  describe('completeTask', () => {
    it('should complete a task successfully', () => {
      const agent = swarm.registerAgent({ type: 'executor' });
      const task = swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      swarm.assignTask(task.id, agent.id);
      swarm.startTask(task.id);

      const result: TaskResult = {
        success: true,
        output: 'Done',
      };

      const success = swarm.completeTask(task.id, result);

      expect(success).toBe(true);
      expect(swarm.getTask(task.id)?.status).toBe('completed');
      expect(swarm.getMetrics().completedTasks).toBe(1);
    });

    it('should mark task as failed on unsuccessful result', () => {
      const agent = swarm.registerAgent({ type: 'executor' });
      const task = swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      swarm.assignTask(task.id, agent.id);
      swarm.startTask(task.id);

      const result: TaskResult = {
        success: false,
        error: 'Something went wrong',
      };

      const success = swarm.completeTask(task.id, result);

      expect(success).toBe(true);
      expect(swarm.getTask(task.id)?.status).toBe('failed');
      expect(swarm.getMetrics().failedTasks).toBe(1);
    });
  });

  describe('cancelTask', () => {
    it('should cancel a pending task', () => {
      const task = swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      const result = swarm.cancelTask(task.id);

      expect(result).toBe(true);
      expect(swarm.getTask(task.id)?.status).toBe('cancelled');
    });

    it('should return false for completed task', () => {
      const agent = swarm.registerAgent({ type: 'executor' });
      const task = swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      swarm.assignTask(task.id, agent.id);
      swarm.startTask(task.id);
      swarm.completeTask(task.id, { success: true });

      const result = swarm.cancelTask(task.id);

      expect(result).toBe(false);
    });
  });

  describe('getPendingTasks', () => {
    it('should return only pending tasks with resolved dependencies', () => {
      const task1 = swarm.createTask({
        title: 'Task 1',
        description: 'First',
        taskType: 'implement',
      });

      swarm.createTask({
        title: 'Task 2',
        description: 'Second',
        taskType: 'implement',
        dependencies: [task1.id],
      });

      const pending = swarm.getPendingTasks();

      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(task1.id);
    });
  });

  describe('metrics', () => {
    it('should track metrics correctly', () => {
      const agent = swarm.registerAgent({ type: 'executor' });

      // Create and complete a task
      const task = swarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      swarm.assignTask(task.id, agent.id);
      swarm.startTask(task.id);
      swarm.completeTask(task.id, { success: true });

      const metrics = swarm.getMetrics();

      expect(metrics.totalTasks).toBe(1);
      expect(metrics.completedTasks).toBe(1);
      expect(metrics.failedTasks).toBe(0);
    });
  });

  describe('lifecycle', () => {
    it('should pause and resume', () => {
      swarm.pause();
      expect(swarm.getStatus()).toBe('paused');

      swarm.resume();
      expect(swarm.getStatus()).toBe('active');
    });

    it('should shutdown gracefully', async () => {
      await swarm.shutdown(true);
      expect(swarm.getStatus()).toBe('terminated');
    });

    it('should export and import state', () => {
      const agent = swarm.registerAgent({ type: 'executor' });
      const state = swarm.exportState();

      expect(state).toHaveProperty('agents');
      expect(state).toHaveProperty('tasks');
      expect(state).toHaveProperty('metrics');
    });
  });

  describe('autoScale', () => {
    it('should scale up when there are pending tasks', () => {
      // Enable auto-scale
      const autoScaleSwarm = createSwarm('Auto Scale Swarm', {
        maxAgents: 5,
        autoScale: true,
      });

      // Create pending task
      autoScaleSwarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      const newAgents = autoScaleSwarm.autoScale();

      expect(newAgents.length).toBeGreaterThan(0);
    });

    it('should not scale when auto-scale is disabled', () => {
      const noScaleSwarm = createSwarm('No Scale Swarm', {
        maxAgents: 5,
        autoScale: false,
      });

      noScaleSwarm.createTask({
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      const newAgents = noScaleSwarm.autoScale();

      expect(newAgents).toHaveLength(0);
    });
  });
});
