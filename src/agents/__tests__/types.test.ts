/**
 * Tests for agent types and core type definitions
 */

import {
  AgentType,
  ALL_AGENT_TYPES,
  PermissionLevel,
  TaskAssignment,
  RoutingDecision,
} from '../types';

describe('Agent Types', () => {
  describe('ALL_AGENT_TYPES', () => {
    it('should contain exactly 12 agent types', () => {
      expect(ALL_AGENT_TYPES).toHaveLength(12);
    });

    it('should include all expected agent types', () => {
      const expectedTypes: AgentType[] = [
        'coordinator',
        'researcher',
        'planner',
        'executor',
        'reviewer',
        'tester',
        'debugger',
        'optimizer',
        'documenter',
        'validator',
        'migrator',
        'analyzer',
      ];

      for (const type of expectedTypes) {
        expect(ALL_AGENT_TYPES).toContain(type);
      }
    });

    it('should have no duplicate agent types', () => {
      const uniqueTypes = new Set(ALL_AGENT_TYPES);
      expect(uniqueTypes.size).toBe(ALL_AGENT_TYPES.length);
    });
  });

  describe('PermissionLevel', () => {
    it('should have valid permission hierarchy values', () => {
      const levels: PermissionLevel[] = ['none', 'read', 'write', 'admin'];
      for (const level of levels) {
        expect(['none', 'read', 'write', 'admin']).toContain(level);
      }
    });
  });

  describe('TaskAssignment interface', () => {
    it('should allow creating valid task assignments', () => {
      const task: TaskAssignment = {
        taskId: 'test-task-1',
        description: 'Test task description',
        taskType: 'implement',
        requiredCapabilities: {
          canModifyCode: true,
        },
        priority: 'high',
        complexity: 'moderate',
        context: {
          codebase: 'test-project',
          files: ['src/test.ts'],
        },
      };

      expect(task.taskId).toBe('test-task-1');
      expect(task.priority).toBe('high');
      expect(task.context?.files).toContain('src/test.ts');
    });

    it('should allow minimal task assignments', () => {
      const task: TaskAssignment = {
        taskId: 'minimal-task',
        description: 'Minimal task',
        taskType: 'research',
        requiredCapabilities: {},
        priority: 'medium',
        complexity: 'simple',
      };

      expect(task.context).toBeUndefined();
    });
  });

  describe('RoutingDecision interface', () => {
    it('should allow creating valid routing decisions', () => {
      const decision: RoutingDecision = {
        agentType: 'executor',
        confidence: 0.95,
        reasoning: 'Task requires code modification',
        alternatives: [
          { agentType: 'debugger', confidence: 0.7 },
        ],
        modelConfig: {
          model: 'claude-3-sonnet',
          temperature: 0.5,
          maxTokens: 4096,
        },
      };

      expect(decision.confidence).toBe(0.95);
      expect(decision.alternatives).toHaveLength(1);
      expect(decision.modelConfig.temperature).toBe(0.5);
    });
  });
});
