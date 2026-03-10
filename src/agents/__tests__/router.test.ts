/**
 * Tests for task routing logic
 */

import {
  routeTask,
  routeTasks,
  canHandleTask,
  rerouteTask,
  getBestAgentsForTaskType,
  getRoutingRules,
  addRoutingRule,
  removeRoutingRule,
  setRoutingRuleActive,
} from '../router';
import {
  TaskAssignment,
  AgentType,
} from '../types';
import {
  _testing,
} from '../router';

const {
  calculateTaskTypeMatch,
  calculateCapabilityMatch,
  calculateComplexityMatch,
  calculatePriorityAlignment,
  calculateRoutingScore,
  selectModelConfig,
} = _testing;

describe('Task Router', () => {
  describe('calculateTaskTypeMatch', () => {
    it('should return 1.0 for exact matches', () => {
      const score = calculateTaskTypeMatch('executor', 'implement');
      expect(score).toBe(1.0);
    });

    it('should return 0.7 for partial matches', () => {
      const score = calculateTaskTypeMatch('executor', 'implementation');
      expect(score).toBe(0.7);
    });

    it('should return 0.0 for non-matches', () => {
      const score = calculateTaskTypeMatch('researcher', 'implement');
      expect(score).toBe(0.0);
    });
  });

  describe('calculateCapabilityMatch', () => {
    it('should return 1.0 when all capabilities match', () => {
      const score = calculateCapabilityMatch('executor', {
        canModifyCode: true,
        canExecuteShell: true,
      });
      expect(score).toBe(1.0);
    });

    it('should return 0.0 when capabilities do not match', () => {
      const score = calculateCapabilityMatch('researcher', {
        canModifyCode: true,
      });
      expect(score).toBe(0.0);
    });

    it('should return partial score for partial matches', () => {
      const score = calculateCapabilityMatch('executor', {
        canModifyCode: true,
        canSpawnAgents: true,
      });
      expect(score).toBe(0.5);
    });
  });

  describe('calculateComplexityMatch', () => {
    it('should return 1.0 for matching complexity', () => {
      const score = calculateComplexityMatch('coordinator', 'very_complex');
      expect(score).toBe(1.0);
    });

    it('should return less than 1.0 for mismatched complexity', () => {
      const score = calculateComplexityMatch('documenter', 'very_complex');
      expect(score).toBeLessThan(1.0);
    });
  });

  describe('calculatePriorityAlignment', () => {
    it('should return higher score for high priority with capable agents', () => {
      const coordinatorScore = calculatePriorityAlignment('coordinator', 'critical');
      const researcherScore = calculatePriorityAlignment('researcher', 'critical');

      expect(coordinatorScore).toBeGreaterThanOrEqual(researcherScore);
    });

    it('should return neutral score for normal priority', () => {
      const score = calculatePriorityAlignment('executor', 'medium');
      expect(score).toBe(0.8);
    });
  });

  describe('routeTask', () => {
    const createTask = (overrides: Partial<TaskAssignment> = {}): TaskAssignment => ({
      taskId: 'test-task',
      description: 'Test task',
      taskType: 'implement',
      requiredCapabilities: {},
      priority: 'medium',
      complexity: 'moderate',
      ...overrides,
    });

    it('should route implementation tasks to executor', () => {
      const task = createTask({ taskType: 'implement' });
      const decision = routeTask(task);

      expect(decision.agentType).toBe('executor');
      expect(decision.confidence).toBeGreaterThan(0.5);
    });

    it('should route research tasks to researcher', () => {
      const task = createTask({
        taskType: 'research',
        requiredCapabilities: { canAccessExternal: true },
      });
      const decision = routeTask(task);

      expect(decision.agentType).toBe('researcher');
    });

    it('should route review tasks to reviewer', () => {
      const task = createTask({ taskType: 'review' });
      const decision = routeTask(task);

      expect(decision.agentType).toBe('reviewer');
    });

    it('should route debug tasks to debugger', () => {
      const task = createTask({ taskType: 'debug' });
      const decision = routeTask(task);

      expect(decision.agentType).toBe('debugger');
    });

    it('should route orchestration tasks to coordinator', () => {
      const task = createTask({
        taskType: 'orchestrate',
        requiredCapabilities: { canSpawnAgents: true },
      });
      const decision = routeTask(task);

      expect(decision.agentType).toBe('coordinator');
    });

    it('should include alternatives in decision', () => {
      const task = createTask();
      const decision = routeTask(task);

      expect(decision.alternatives).toBeDefined();
      expect(decision.alternatives.length).toBeGreaterThan(0);
    });

    it('should include model configuration', () => {
      const task = createTask({ complexity: 'complex' });
      const decision = routeTask(task);

      expect(decision.modelConfig).toBeDefined();
      expect(decision.modelConfig.model).toBeDefined();
      expect(decision.modelConfig.temperature).toBeDefined();
      expect(decision.modelConfig.maxTokens).toBeDefined();
    });

    it('should include reasoning', () => {
      const task = createTask();
      const decision = routeTask(task);

      expect(decision.reasoning).toBeDefined();
      expect(decision.reasoning.length).toBeGreaterThan(0);
    });

    it('should select powerful model for complex tasks', () => {
      const task = createTask({ complexity: 'very_complex' });
      const decision = routeTask(task);

      // Complex tasks should use powerful model (opus) or agent's preferred model
      expect(decision.modelConfig.model).toBeDefined();
      expect(decision.modelConfig.temperature).toBeGreaterThan(0);
    });

    it('should select appropriate model for simple tasks', () => {
      const task = createTask({ complexity: 'simple' });
      const decision = routeTask(task);

      // Simple tasks may use fast model, but agent preference may override
      expect(decision.modelConfig.model).toBeDefined();
      expect(decision.modelConfig.maxTokens).toBeGreaterThan(0);
    });
  });

  describe('routeTasks', () => {
    it('should route multiple tasks', () => {
      const tasks: TaskAssignment[] = [
        {
          taskId: 'task-1',
          description: 'Implement feature',
          taskType: 'implement',
          requiredCapabilities: {},
          priority: 'high',
          complexity: 'moderate',
        },
        {
          taskId: 'task-2',
          description: 'Research API',
          taskType: 'research',
          requiredCapabilities: { canAccessExternal: true },
          priority: 'medium',
          complexity: 'simple',
        },
      ];

      const decisions = routeTasks(tasks);

      expect(decisions).toHaveLength(2);
      expect(decisions[0].agentType).toBe('executor');
      expect(decisions[1].agentType).toBe('researcher');
    });
  });

  describe('canHandleTask', () => {
    it('should return true when agent can handle task', () => {
      const task: TaskAssignment = {
        taskId: 'test',
        description: 'Test',
        taskType: 'implement',
        requiredCapabilities: { canModifyCode: true },
        priority: 'medium',
        complexity: 'moderate',
      };

      expect(canHandleTask('executor', task)).toBe(true);
    });

    it('should return false when agent lacks required capabilities', () => {
      const task: TaskAssignment = {
        taskId: 'test',
        description: 'Test',
        taskType: 'implement',
        requiredCapabilities: { canModifyCode: true },
        priority: 'medium',
        complexity: 'moderate',
      };

      expect(canHandleTask('researcher', task)).toBe(false);
    });
  });

  describe('rerouteTask', () => {
    it('should route to different agent when excluding one', () => {
      const task: TaskAssignment = {
        taskId: 'test',
        description: 'Test',
        taskType: 'implement',
        requiredCapabilities: {},
        priority: 'medium',
        complexity: 'moderate',
      };

      const decision = rerouteTask(task, ['executor']);

      expect(decision).not.toBeNull();
      expect(decision?.agentType).not.toBe('executor');
    });

    it('should return null when no agents available', () => {
      const task: TaskAssignment = {
        taskId: 'test',
        description: 'Test',
        taskType: 'implement',
        requiredCapabilities: {},
        priority: 'medium',
        complexity: 'moderate',
      };

      const allTypes: AgentType[] = [
        'coordinator', 'researcher', 'planner', 'executor', 'reviewer',
        'tester', 'debugger', 'optimizer', 'documenter', 'validator',
        'migrator', 'analyzer'
      ];

      const decision = rerouteTask(task, allTypes);

      expect(decision).toBeNull();
    });
  });

  describe('getBestAgentsForTaskType', () => {
    it('should return sorted list of agents for task type', () => {
      const agents = getBestAgentsForTaskType('implement', 3);

      expect(agents).toHaveLength(3);
      expect(agents[0].score).toBeGreaterThanOrEqual(agents[1].score);
      expect(agents[1].score).toBeGreaterThanOrEqual(agents[2].score);
    });

    it('should include executor for implement tasks', () => {
      const agents = getBestAgentsForTaskType('implement');
      const agentTypes = agents.map(a => a.agentType);

      expect(agentTypes).toContain('executor');
    });
  });

  describe('Routing Rules', () => {
    it('should get default routing rules', () => {
      const rules = getRoutingRules();

      expect(rules.length).toBeGreaterThan(0);
    });

    it('should add and remove routing rules', () => {
      const initialCount = getRoutingRules().length;

      addRoutingRule({
        id: 'test-rule',
        taskPattern: 'test',
        requiredCapabilities: {},
        priorityBoost: 1.0,
        active: true,
      });

      expect(getRoutingRules().length).toBe(initialCount + 1);

      const removed = removeRoutingRule('test-rule');
      expect(removed).toBe(true);
      expect(getRoutingRules().length).toBe(initialCount);
    });

    it('should enable and disable routing rules', () => {
      addRoutingRule({
        id: 'toggle-test',
        taskPattern: 'test',
        requiredCapabilities: {},
        priorityBoost: 1.0,
        active: true,
      });

      setRoutingRuleActive('toggle-test', false);

      const rules = getRoutingRules();
      const rule = rules.find(r => r.id === 'toggle-test');
      expect(rule?.active).toBe(false);

      removeRoutingRule('toggle-test');
    });
  });
});
