/**
 * Tests for the main AgentSystem class
 */

import {
  AgentSystem,
  getAgentSystem,
  resetAgentSystem,
  AgentType,
  TaskAssignment,
} from '../index';

describe('AgentSystem', () => {
  let system: AgentSystem;

  beforeEach(() => {
    resetAgentSystem();
    system = getAgentSystem();
  });

  afterEach(() => {
    resetAgentSystem();
  });

  describe('createAgent', () => {
    it('should create an agent instance', () => {
      const agent = system.createAgent('executor');

      expect(agent).toBeDefined();
      expect(agent.id).toBeDefined();
      expect(agent.type).toBe('executor');
      expect(agent.status).toBe('idle');
    });

    it('should create agents with custom names', () => {
      const agent = system.createAgent('executor', { name: 'Custom Executor' });

      expect(agent).toBeDefined();
    });

    it('should track created agents', () => {
      const agent = system.createAgent('executor');
      const retrieved = system.getAgent(agent.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(agent.id);
    });
  });

  describe('getAllAgents', () => {
    it('should return all created agents', () => {
      system.createAgent('executor');
      system.createAgent('researcher');
      system.createAgent('coordinator');

      const agents = system.getAllAgents();

      expect(agents).toHaveLength(3);
    });

    it('should return empty array when no agents', () => {
      const agents = system.getAllAgents();

      expect(agents).toEqual([]);
    });
  });

  describe('getAgentsByType', () => {
    it('should filter agents by type', () => {
      system.createAgent('executor');
      system.createAgent('executor');
      system.createAgent('researcher');

      const executors = system.getAgentsByType('executor');

      expect(executors).toHaveLength(2);
    });

    it('should return empty array for non-existent type', () => {
      const agents = system.getAgentsByType('executor');

      expect(agents).toEqual([]);
    });
  });

  describe('getAgentsByStatus', () => {
    it('should filter agents by status', () => {
      const agent = system.createAgent('executor');
      system.pauseAgent(agent.id);

      const paused = system.getAgentsByStatus('paused');

      expect(paused).toHaveLength(1);
    });
  });

  describe('destroyAgent', () => {
    it('should remove an agent', () => {
      const agent = system.createAgent('executor');

      const result = system.destroyAgent(agent.id);

      expect(result).toBe(true);
      expect(system.getAgent(agent.id)).toBeUndefined();
    });

    it('should return false for non-existent agent', () => {
      const result = system.destroyAgent('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('pauseAgent and resumeAgent', () => {
    it('should pause an agent', () => {
      const agent = system.createAgent('executor');

      const result = system.pauseAgent(agent.id);

      expect(result).toBe(true);
      expect(system.getAgent(agent.id)?.status).toBe('paused');
    });

    it('should resume a paused agent', () => {
      const agent = system.createAgent('executor');
      system.pauseAgent(agent.id);

      const result = system.resumeAgent(agent.id);

      expect(result).toBe(true);
      expect(system.getAgent(agent.id)?.status).toBe('idle');
    });

    it('should not resume non-paused agent', () => {
      const agent = system.createAgent('executor');

      const result = system.resumeAgent(agent.id);

      expect(result).toBe(false);
    });
  });

  describe('markAgentError', () => {
    it('should mark agent as error', () => {
      const agent = system.createAgent('executor');

      const result = system.markAgentError(agent.id, 'Test error');

      expect(result).toBe(true);
      expect(system.getAgent(agent.id)?.status).toBe('error');
    });
  });

  describe('routeTask', () => {
    it('should route tasks to appropriate agent types', () => {
      const task: TaskAssignment = {
        taskId: 'test',
        description: 'Implement feature',
        taskType: 'implement',
        requiredCapabilities: {},
        priority: 'medium',
        complexity: 'moderate',
      };

      const decision = system.routeTask(task);

      expect(decision.agentType).toBe('executor');
      expect(decision.confidence).toBeGreaterThan(0);
    });
  });

  describe('getSystemPrompt', () => {
    it('should return system prompt for agent type', () => {
      const prompt = system.getSystemPrompt('executor');

      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toContain('Executor');
    });
  });

  describe('getTaskPrompt', () => {
    it('should return formatted task prompt', () => {
      const prompt = system.getTaskPrompt('executor', 'implement', {
        FEATURE: 'test feature',
        SPEC: 'test spec',
        FILES: 'test.ts',
      });

      expect(prompt).toBeDefined();
      expect(prompt).toContain('test feature');
    });
  });

  describe('getResponseFormat', () => {
    it('should return response format for agent type', () => {
      const format = system.getResponseFormat('executor');

      expect(format).toBeDefined();
      expect(format.length).toBeGreaterThan(0);
    });
  });

  describe('getDefaultTools', () => {
    it('should return default tools for agent type', () => {
      const tools = system.getDefaultTools('executor');

      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe('checkPermission', () => {
    it('should check agent permissions', () => {
      const agent = system.createAgent('executor');

      const result = system.checkPermission(agent.id, 'code', 'write');

      expect(result.granted).toBe(true);
    });

    it('should deny for non-existent agent', () => {
      const result = system.checkPermission('non-existent', 'code', 'write');

      expect(result.granted).toBe(false);
    });
  });

  describe('getPermissionGuard', () => {
    it('should return permission guard for agent', () => {
      const agent = system.createAgent('executor');

      const guard = system.getPermissionGuard(agent.id);

      expect(guard).toBeDefined();
      expect(guard.check).toBeDefined();
    });

    it('should throw for non-existent agent', () => {
      expect(() => system.getPermissionGuard('non-existent')).toThrow();
    });
  });

  describe('getPermissionSummary', () => {
    it('should return permission summary for agent', () => {
      const agent = system.createAgent('executor');

      const summary = system.getPermissionSummary(agent.id);

      expect(summary.agentType).toBe('executor');
      expect(summary.canModifyCode).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return system statistics', () => {
      system.createAgent('executor');
      system.createAgent('researcher');

      const stats = system.getStats();

      expect(stats.totalAgents).toBe(2);
      expect(stats.byType.executor).toBe(1);
      expect(stats.byType.researcher).toBe(1);
    });

    it('should track task statistics', () => {
      const stats = system.getStats();

      expect(stats.totalTasks).toBeDefined();
      expect(stats.successfulTasks).toBeDefined();
      expect(stats.failedTasks).toBeDefined();
    });
  });

  describe('listAgentTypes', () => {
    it('should list all agent types with descriptions', () => {
      const types = system.listAgentTypes();

      expect(types.length).toBe(12);

      for (const type of types) {
        expect(type.type).toBeDefined();
        expect(type.name).toBeDefined();
        expect(type.description).toBeDefined();
        expect(type.capabilities).toBeDefined();
      }
    });
  });

  describe('clearAllAgents', () => {
    it('should remove all agents', () => {
      system.createAgent('executor');
      system.createAgent('researcher');

      system.clearAllAgents();

      expect(system.getAllAgents()).toHaveLength(0);
    });
  });

  describe('getConfig', () => {
    it('should return system configuration', () => {
      const config = system.getConfig();

      expect(config.defaultConfigs).toBeDefined();
      expect(config.modelConfigs).toBeDefined();
    });
  });

  describe('updateConfig', () => {
    it('should update system configuration', () => {
      system.updateConfig({
        globalPermissions: [{ resource: 'test', level: 'read' }],
      });

      const config = system.getConfig();

      expect(config.globalPermissions).toHaveLength(1);
    });
  });
});

describe('getAgentSystem singleton', () => {
  beforeEach(() => {
    resetAgentSystem();
  });

  afterEach(() => {
    resetAgentSystem();
  });

  it('should return the same instance', () => {
    const system1 = getAgentSystem();
    const system2 = getAgentSystem();

    expect(system1).toBe(system2);
  });

  it('should create new instance after reset', () => {
    const system1 = getAgentSystem();
    resetAgentSystem();
    const system2 = getAgentSystem();

    expect(system1).not.toBe(system2);
  });
});
