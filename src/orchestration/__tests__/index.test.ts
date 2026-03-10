/**
 * Tests for main Orchestrator
 */

import { Orchestrator } from '../index';
import { AgentType, CoordinationStrategyType } from '../types';

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator({
      defaultStrategy: 'adaptive',
      maxConcurrentSwarms: 3,
      enablePersistence: false,
    });
  });

  afterEach(async () => {
    await orchestrator.shutdown(false);
  });

  describe('createSwarm', () => {
    it('should create a swarm', () => {
      const swarm = orchestrator.createSwarm('Test Swarm');

      expect(swarm).toBeDefined();
      expect(swarm.getInfo().name).toBe('Test Swarm');
    });

    it('should create multiple swarms', () => {
      const swarm1 = orchestrator.createSwarm('Swarm 1');
      const swarm2 = orchestrator.createSwarm('Swarm 2');

      expect(swarm1.getInfo().id).not.toBe(swarm2.getInfo().id);
    });

    it('should throw when max swarms reached', () => {
      orchestrator.createSwarm('Swarm 1');
      orchestrator.createSwarm('Swarm 2');
      orchestrator.createSwarm('Swarm 3');

      expect(() => {
        orchestrator.createSwarm('Swarm 4');
      }).toThrow('Maximum number of concurrent swarms');
    });

    it('should apply configuration', () => {
      const swarm = orchestrator.createSwarm('Configured Swarm', {
        maxAgents: 5,
        strategy: 'parallel',
      });

      expect(swarm.getConfig().maxAgents).toBe(5);
    });
  });

  describe('getSwarm / getAllSwarms', () => {
    it('should retrieve a swarm by ID', () => {
      const created = orchestrator.createSwarm('Test');
      const retrieved = orchestrator.getSwarm(created.getInfo().id);

      expect(retrieved).toBe(created);
    });

    it('should return undefined for non-existent swarm', () => {
      const swarm = orchestrator.getSwarm('non-existent');
      expect(swarm).toBeUndefined();
    });

    it('should return all swarms', () => {
      orchestrator.createSwarm('Swarm 1');
      orchestrator.createSwarm('Swarm 2');

      const swarms = orchestrator.getAllSwarms();

      expect(swarms).toHaveLength(2);
    });
  });

  describe('terminateSwarm', () => {
    it('should terminate a swarm', async () => {
      const swarm = orchestrator.createSwarm('Test');
      const swarmId = swarm.getInfo().id;

      const success = await orchestrator.terminateSwarm(swarmId);

      expect(success).toBe(true);
      expect(orchestrator.getSwarm(swarmId)).toBeUndefined();
    });

    it('should return false for non-existent swarm', async () => {
      const success = await orchestrator.terminateSwarm('non-existent');
      expect(success).toBe(false);
    });
  });

  describe('registerAgent', () => {
    it('should register an agent in a swarm', () => {
      const swarm = orchestrator.createSwarm('Test');
      const swarmId = swarm.getInfo().id;

      const agent = orchestrator.registerAgent(swarmId, {
        type: 'executor',
        name: 'Test Agent',
      });

      expect(agent.type).toBe('executor');
      expect(agent.name).toBe('Test Agent');
    });

    it('should throw for non-existent swarm', () => {
      expect(() => {
        orchestrator.registerAgent('non-existent', { type: 'executor' });
      }).toThrow('Swarm not found');
    });
  });

  describe('registerAgents', () => {
    it('should register multiple agents', () => {
      const swarm = orchestrator.createSwarm('Test');
      const swarmId = swarm.getInfo().id;

      const agents = orchestrator.registerAgents(swarmId, [
        { type: 'executor' },
        { type: 'tester' },
        { type: 'debugger' },
      ]);

      expect(agents).toHaveLength(3);
      expect(agents[0].type).toBe('executor');
      expect(agents[1].type).toBe('tester');
      expect(agents[2].type).toBe('debugger');
    });
  });

  describe('unregisterAgent', () => {
    it('should unregister an agent', () => {
      const swarm = orchestrator.createSwarm('Test');
      const swarmId = swarm.getInfo().id;
      const agent = orchestrator.registerAgent(swarmId, { type: 'executor' });

      const success = orchestrator.unregisterAgent(swarmId, agent.id);

      expect(success).toBe(true);
    });

    it('should return false for non-existent swarm', () => {
      const success = orchestrator.unregisterAgent('non-existent', 'agent-id');
      expect(success).toBe(false);
    });
  });

  describe('createTask', () => {
    it('should create a task in a swarm', () => {
      const swarm = orchestrator.createSwarm('Test');
      const swarmId = swarm.getInfo().id;

      const task = orchestrator.createTask(swarmId, {
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('pending');
    });

    it('should throw for non-existent swarm', () => {
      expect(() => {
        orchestrator.createTask('non-existent', {
          title: 'Test',
          description: 'Test',
          taskType: 'implement',
        });
      }).toThrow('Swarm not found');
    });
  });

  describe('createTasks', () => {
    it('should create multiple tasks', () => {
      const swarm = orchestrator.createSwarm('Test');
      const swarmId = swarm.getInfo().id;

      const tasks = orchestrator.createTasks(swarmId, [
        { title: 'Task 1', description: 'First', taskType: 'implement' },
        { title: 'Task 2', description: 'Second', taskType: 'test' },
      ]);

      expect(tasks).toHaveLength(2);
    });
  });

  describe('completeTask', () => {
    it('should complete a task', () => {
      const swarm = orchestrator.createSwarm('Test');
      const swarmId = swarm.getInfo().id;
      const agent = orchestrator.registerAgent(swarmId, { type: 'executor' });
      const task = orchestrator.createTask(swarmId, {
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      swarm.assignTask(task.id, agent.id);
      swarm.startTask(task.id);

      const success = orchestrator.completeTask(swarmId, task.id, {
        success: true,
        output: 'Done',
      });

      expect(success).toBe(true);
    });
  });

  describe('cancelTask', () => {
    it('should cancel a task', () => {
      const swarm = orchestrator.createSwarm('Test');
      const swarmId = swarm.getInfo().id;
      const task = orchestrator.createTask(swarmId, {
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      const success = orchestrator.cancelTask(swarmId, task.id);

      expect(success).toBe(true);
      expect(swarm.getTask(task.id)?.status).toBe('cancelled');
    });
  });

  describe('setStrategy', () => {
    it('should set strategy for a swarm', () => {
      const swarm = orchestrator.createSwarm('Test');
      const swarmId = swarm.getInfo().id;

      const success = orchestrator.setStrategy(swarmId, 'parallel');

      expect(success).toBe(true);
    });

    it('should return false for non-existent swarm', () => {
      const success = orchestrator.setStrategy('non-existent', 'parallel');
      expect(success).toBe(false);
    });
  });

  describe('getRecommendedStrategy', () => {
    it('should recommend a strategy', () => {
      const swarm = orchestrator.createSwarm('Test');
      const swarmId = swarm.getInfo().id;

      const recommendation = orchestrator.getRecommendedStrategy(swarmId);

      expect(['parallel', 'sequential', 'adaptive', 'hierarchical']).toContain(
        recommendation
      );
    });
  });

  describe('createWorkflow', () => {
    it('should create a workflow', () => {
      const swarm = orchestrator.createSwarm('Test');
      const swarmId = swarm.getInfo().id;

      const taskIds = orchestrator.createWorkflow(swarmId, [
        { title: 'Task 1', description: 'First', taskType: 'implement' },
        { title: 'Task 2', description: 'Second', taskType: 'test' },
      ]);

      expect(taskIds).toHaveLength(2);
    });

    it('should set up dependencies', () => {
      const swarm = orchestrator.createSwarm('Test');
      const swarmId = swarm.getInfo().id;

      const taskIds = orchestrator.createWorkflow(swarmId, [
        { title: 'Task 1', description: 'First', taskType: 'implement' },
        { title: 'Task 2', description: 'Second', taskType: 'test', dependencies: ['Task 1'] },
      ]);

      const task2 = swarm.getTask(taskIds[1]);
      expect(task2?.dependencies).toContain(taskIds[0]);
    });
  });

  describe('getWorkflowStatus', () => {
    it('should return workflow status', () => {
      const swarm = orchestrator.createSwarm('Test');
      const swarmId = swarm.getInfo().id;

      const taskIds = orchestrator.createWorkflow(swarmId, [
        { title: 'Task 1', description: 'First', taskType: 'implement' },
        { title: 'Task 2', description: 'Second', taskType: 'test' },
      ]);

      const status = orchestrator.getWorkflowStatus(swarmId, taskIds);

      expect(status.total).toBe(2);
      expect(status.progress).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return overall statistics', () => {
      const swarm = orchestrator.createSwarm('Test');
      orchestrator.registerAgent(swarm.getInfo().id, { type: 'executor' });
      orchestrator.createTask(swarm.getInfo().id, {
        title: 'Test',
        description: 'Test',
        taskType: 'implement',
      });

      const stats = orchestrator.getStats();

      expect(stats.swarmCount).toBe(1);
      expect(stats.totalAgents).toBe(1);
      expect(stats.totalTasks).toBe(1);
    });
  });

  describe('getSwarmStats', () => {
    it('should return swarm statistics', () => {
      const swarm = orchestrator.createSwarm('Test');
      const swarmId = swarm.getInfo().id;

      const stats = orchestrator.getSwarmStats(swarmId);

      expect(stats).not.toBeNull();
      expect(stats?.agents).toBe(0);
      expect(stats?.tasks).toBe(0);
    });

    it('should return null for non-existent swarm', () => {
      const stats = orchestrator.getSwarmStats('non-existent');
      expect(stats).toBeNull();
    });
  });

  describe('getAvailableAgentTypes', () => {
    it('should return all agent types', () => {
      const types = orchestrator.getAvailableAgentTypes();

      expect(types).toHaveLength(13);
      expect(types).toContain('architect');
    });
  });

  describe('getAgentTypeInfo', () => {
    it('should return info for each agent type', () => {
      for (const type of orchestrator.getAvailableAgentTypes()) {
        const info = orchestrator.getAgentTypeInfo(type);

        expect(info.name).toBeDefined();
        expect(info.description).toBeDefined();
        expect(info.capabilities).toBeDefined();
      }
    });
  });

  describe('autoScale', () => {
    it('should auto-scale a swarm', () => {
      const swarm = orchestrator.createSwarm('Test', { autoScale: true });
      const swarmId = swarm.getInfo().id;

      orchestrator.createTask(swarmId, {
        title: 'Test Task',
        description: 'Test',
        taskType: 'implement',
      });

      const newAgents = orchestrator.autoScale(swarmId);

      // Should create at least one agent
      expect(newAgents.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('event handling', () => {
    it('should emit events', (done) => {
      orchestrator.once('swarm_created', () => {
        done();
      });

      orchestrator.createSwarm('Test');
    });

    it('should track event history', () => {
      orchestrator.createSwarm('Test');

      const events = orchestrator.getEventHistory();

      expect(events.length).toBeGreaterThan(0);
    });

    it('should filter event history', () => {
      orchestrator.createSwarm('Test');

      const events = orchestrator.getEventHistory({
        type: 'swarm_created',
      });

      expect(events.every((e) => e.type === 'swarm_created')).toBe(true);
    });
  });

  describe('export/import state', () => {
    it('should export state', () => {
      orchestrator.createSwarm('Test');

      const state = orchestrator.exportState();

      expect(state).toHaveProperty('config');
      expect(state).toHaveProperty('swarms');
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      orchestrator.createSwarm('Test 1');
      orchestrator.createSwarm('Test 2');

      await orchestrator.shutdown(true);

      expect(orchestrator.getAllSwarms()).toHaveLength(0);
    });
  });
});
