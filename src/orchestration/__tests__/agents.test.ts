/**
 * Tests for agent definitions
 */

import {
  createAgentConfig,
  getDefaultCapabilities,
  getDefaultPermissions,
  getAgentDescription,
  getAgentName,
  getSuitableTaskTypes,
  isSuitableForTaskType,
  getAllAgentTypes,
  getAgentTypesForTaskType,
  compareCapabilities,
  getDefaultMetaPrompt,
} from '../agents';
import { ALL_AGENT_TYPES } from '../types';
import { AgentType } from '../types';

describe('Agent Definitions', () => {
  describe('getAllAgentTypes', () => {
    it('should return all 13 agent types', () => {
      const types = getAllAgentTypes();
      expect(types).toHaveLength(13);
      expect(types).toContain('architect');
    });
  });

  describe('createAgentConfig', () => {
    it('should create a valid agent config for each type', () => {
      for (const type of ALL_AGENT_TYPES) {
        const config = createAgentConfig(type);

        expect(config.id).toBeDefined();
        expect(config.type).toBe(type);
        expect(config.name).toBeDefined();
        expect(config.description).toBeDefined();
        expect(config.capabilities).toBeDefined();
        expect(config.permissions).toBeDefined();
        expect(config.metaPrompt).toBeDefined();
      }
    });

    it('should apply overrides correctly', () => {
      const config = createAgentConfig('executor', {
        name: 'Custom Executor',
        customConfig: { foo: 'bar' },
      });

      expect(config.name).toBe('Custom Executor');
      expect(config.customConfig).toEqual({ foo: 'bar' });
    });

    it('should generate unique IDs', () => {
      const config1 = createAgentConfig('executor');
      const config2 = createAgentConfig('executor');

      expect(config1.id).not.toBe(config2.id);
    });
  });

  describe('getDefaultCapabilities', () => {
    it('should return capabilities for each agent type', () => {
      for (const type of ALL_AGENT_TYPES) {
        const caps = getDefaultCapabilities(type);

        expect(caps.canSpawnAgents).toBeDefined();
        expect(caps.canModifyCode).toBeDefined();
        expect(caps.canAccessExternal).toBeDefined();
        expect(caps.canExecuteShell).toBeDefined();
        expect(caps.maxParallelTasks).toBeGreaterThan(0);
        expect(caps.preferredModel).toBeDefined();
        expect(caps.taskTimeoutMinutes).toBeGreaterThan(0);
      }
    });

    it('should give coordinator spawn capability', () => {
      const caps = getDefaultCapabilities('coordinator');
      expect(caps.canSpawnAgents).toBe(true);
    });

    it('should give executor code modification capability', () => {
      const caps = getDefaultCapabilities('executor');
      expect(caps.canModifyCode).toBe(true);
    });
  });

  describe('getDefaultPermissions', () => {
    it('should return permissions for each agent type', () => {
      for (const type of ALL_AGENT_TYPES) {
        const perms = getDefaultPermissions(type);
        expect(Array.isArray(perms)).toBe(true);
      }
    });
  });

  describe('getAgentDescription', () => {
    it('should return a description for each agent type', () => {
      for (const type of ALL_AGENT_TYPES) {
        const desc = getAgentDescription(type);
        expect(desc).toBeDefined();
        expect(desc.length).toBeGreaterThan(10);
      }
    });
  });

  describe('getAgentName', () => {
    it('should return a name for each agent type', () => {
      for (const type of ALL_AGENT_TYPES) {
        const name = getAgentName(type);
        expect(name).toBeDefined();
        expect(name.length).toBeGreaterThan(0);
      }
    });

    it('should return capitalized names', () => {
      expect(getAgentName('coordinator')).toBe('Coordinator');
      expect(getAgentName('architect')).toBe('Architect');
    });
  });

  describe('getSuitableTaskTypes', () => {
    it('should return task types for each agent type', () => {
      for (const type of ALL_AGENT_TYPES) {
        const types = getSuitableTaskTypes(type);
        expect(Array.isArray(types)).toBe(true);
        expect(types.length).toBeGreaterThan(0);
      }
    });
  });

  describe('isSuitableForTaskType', () => {
    it('should return true for matching task types', () => {
      expect(isSuitableForTaskType('executor', 'implement')).toBe(true);
      expect(isSuitableForTaskType('tester', 'test')).toBe(true);
      expect(isSuitableForTaskType('debugger', 'debug')).toBe(true);
    });

    it('should return false for non-matching task types', () => {
      expect(isSuitableForTaskType('documenter', 'implement')).toBe(false);
    });

    it('should handle partial matches', () => {
      expect(isSuitableForTaskType('executor', 'implementation')).toBe(true);
    });
  });

  describe('getAgentTypesForTaskType', () => {
    it('should return suitable agent types for a task', () => {
      const types = getAgentTypesForTaskType('implement');
      expect(types).toContain('executor');
    });

    it('should return multiple types when applicable', () => {
      const types = getAgentTypesForTaskType('code');
      expect(types.length).toBeGreaterThan(0);
    });
  });

  describe('compareCapabilities', () => {
    it('should compare capabilities between two agent types', () => {
      const comparison = compareCapabilities('coordinator', 'executor');

      expect(comparison.canSpawnAgents).toEqual({
        type1: true,
        type2: false,
      });
      expect(comparison.canModifyCode).toEqual({
        type1: false,
        type2: true,
      });
    });
  });

  describe('getDefaultMetaPrompt', () => {
    it('should return a meta-prompt for each agent type', () => {
      for (const type of ALL_AGENT_TYPES) {
        const metaPrompt = getDefaultMetaPrompt(type);

        expect(metaPrompt.agentType).toBe(type);
        expect(metaPrompt.systemPrompt).toBeDefined();
        expect(metaPrompt.systemPrompt.length).toBeGreaterThan(50);
        expect(metaPrompt.taskPrompts).toBeDefined();
        expect(metaPrompt.defaultTools).toBeDefined();
        expect(metaPrompt.responseFormat).toBeDefined();
        expect(metaPrompt.examples).toBeDefined();
      }
    });
  });

  describe('Architect agent', () => {
    it('should have architect in all agent types', () => {
      expect(ALL_AGENT_TYPES).toContain('architect');
    });

    it('should have correct capabilities for architect', () => {
      const caps = getDefaultCapabilities('architect');
      expect(caps.canModifyCode).toBe(true);
      expect(caps.preferredModel).toBe('powerful');
      expect(caps.taskTimeoutMinutes).toBe(90);
    });

    it('should have suitable task types for architect', () => {
      const types = getSuitableTaskTypes('architect');
      expect(types).toContain('architecture');
      expect(types).toContain('design-system');
    });
  });
});
