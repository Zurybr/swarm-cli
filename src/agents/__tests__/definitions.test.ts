/**
 * Tests for agent definitions and capabilities
 */

import {
  AgentType,
  AgentCapabilities,
  Permission,
} from '../types';
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
  DEFAULT_CAPABILITIES,
  DEFAULT_PERMISSIONS,
} from '../definitions';

describe('Agent Definitions', () => {
  describe('getDefaultCapabilities', () => {
    it('should return capabilities for all agent types', () => {
      for (const type of getAllAgentTypes()) {
        const caps = getDefaultCapabilities(type);
        expect(caps).toBeDefined();
        expect(typeof caps.canModifyCode).toBe('boolean');
        expect(typeof caps.canExecuteShell).toBe('boolean');
        expect(typeof caps.canAccessExternal).toBe('boolean');
        expect(typeof caps.canSpawnAgents).toBe('boolean');
        expect(typeof caps.maxParallelTasks).toBe('number');
        expect(typeof caps.taskTimeoutMinutes).toBe('number');
      }
    });

    it('should have correct capabilities for coordinator', () => {
      const caps = getDefaultCapabilities('coordinator');
      expect(caps.canSpawnAgents).toBe(true);
      expect(caps.canModifyCode).toBe(false);
      expect(caps.maxParallelTasks).toBe(10);
      expect(caps.preferredModel).toBe('powerful');
    });

    it('should have correct capabilities for executor', () => {
      const caps = getDefaultCapabilities('executor');
      expect(caps.canModifyCode).toBe(true);
      expect(caps.canExecuteShell).toBe(true);
      expect(caps.canSpawnAgents).toBe(false);
    });

    it('should have correct capabilities for researcher', () => {
      const caps = getDefaultCapabilities('researcher');
      expect(caps.canAccessExternal).toBe(true);
      expect(caps.canModifyCode).toBe(false);
      expect(caps.preferredModel).toBe('balanced');
    });
  });

  describe('getDefaultPermissions', () => {
    it('should return permissions for all agent types', () => {
      for (const type of getAllAgentTypes()) {
        const perms = getDefaultPermissions(type);
        expect(perms).toBeDefined();
        expect(perms.length).toBeGreaterThan(0);

        for (const perm of perms) {
          expect(perm.resource).toBeDefined();
          expect(perm.level).toBeDefined();
          expect(['none', 'read', 'write', 'admin']).toContain(perm.level);
        }
      }
    });

    it('should give executor code write permissions', () => {
      const perms = getDefaultPermissions('executor');
      const codePerm = perms.find((p) => p.resource === 'code');
      expect(codePerm).toBeDefined();
      expect(codePerm?.level).toBe('write');
    });

    it('should give coordinator admin permissions on agents', () => {
      const perms = getDefaultPermissions('coordinator');
      const agentPerm = perms.find((p) => p.resource === 'agents');
      expect(agentPerm).toBeDefined();
      expect(agentPerm?.level).toBe('admin');
    });
  });

  describe('getAgentDescription', () => {
    it('should return descriptions for all agent types', () => {
      for (const type of getAllAgentTypes()) {
        const desc = getAgentDescription(type);
        expect(desc).toBeDefined();
        expect(desc.length).toBeGreaterThan(10);
      }
    });
  });

  describe('getAgentName', () => {
    it('should return names for all agent types', () => {
      for (const type of getAllAgentTypes()) {
        const name = getAgentName(type);
        expect(name).toBeDefined();
        expect(name.length).toBeGreaterThan(0);
        // Should be capitalized
        expect(name[0]).toBe(name[0].toUpperCase());
      }
    });
  });

  describe('getSuitableTaskTypes', () => {
    it('should return task types for all agent types', () => {
      for (const type of getAllAgentTypes()) {
        const tasks = getSuitableTaskTypes(type);
        expect(tasks).toBeDefined();
        expect(tasks.length).toBeGreaterThan(0);
      }
    });

    it('should return correct task types for executor', () => {
      const tasks = getSuitableTaskTypes('executor');
      expect(tasks).toContain('implement');
      expect(tasks).toContain('code');
      expect(tasks).toContain('build');
    });

    it('should return correct task types for reviewer', () => {
      const tasks = getSuitableTaskTypes('reviewer');
      expect(tasks).toContain('review');
      expect(tasks).toContain('audit');
    });
  });

  describe('isSuitableForTaskType', () => {
    it('should return true for matching task types', () => {
      expect(isSuitableForTaskType('executor', 'implement')).toBe(true);
      expect(isSuitableForTaskType('reviewer', 'review')).toBe(true);
      expect(isSuitableForTaskType('tester', 'test')).toBe(true);
    });

    it('should return false for non-matching task types', () => {
      expect(isSuitableForTaskType('researcher', 'implement')).toBe(false);
      expect(isSuitableForTaskType('documenter', 'debug')).toBe(false);
    });

    it('should handle partial matches', () => {
      expect(isSuitableForTaskType('executor', 'code-review')).toBe(true);
    });
  });

  describe('getAgentTypesForTaskType', () => {
    it('should return agent types for implement task', () => {
      const types = getAgentTypesForTaskType('implement');
      expect(types).toContain('executor');
    });

    it('should return agent types for research task', () => {
      const types = getAgentTypesForTaskType('research');
      expect(types).toContain('researcher');
    });
  });

  describe('compareCapabilities', () => {
    it('should compare capabilities between agent types', () => {
      const comparison = compareCapabilities('coordinator', 'executor');

      expect(comparison.canSpawnAgents).toEqual({ type1: true, type2: false });
      expect(comparison.canModifyCode).toEqual({ type1: false, type2: true });
    });
  });

  describe('createAgentConfig', () => {
    it('should create config with defaults', () => {
      const config = createAgentConfig('executor');

      expect(config.type).toBe('executor');
      expect(config.name).toBe('Executor');
      expect(config.id).toBeDefined();
      expect(config.capabilities.canModifyCode).toBe(true);
    });

    it('should allow overriding defaults', () => {
      const config = createAgentConfig('executor', {
        name: 'Custom Executor',
        customConfig: { key: 'value' },
      });

      expect(config.name).toBe('Custom Executor');
      expect(config.customConfig).toEqual({ key: 'value' });
    });

    it('should generate unique IDs', async () => {
      const config1 = createAgentConfig('executor');
      await new Promise(resolve => setTimeout(resolve, 10));
      const config2 = createAgentConfig('executor');

      expect(config1.id).not.toBe(config2.id);
    });
  });

  describe('DEFAULT_CAPABILITIES', () => {
    it('should have unique timeout values per agent type needs', () => {
      // Coordinator and migrator should have longer timeouts
      expect(DEFAULT_CAPABILITIES.coordinator.taskTimeoutMinutes).toBeGreaterThanOrEqual(
        DEFAULT_CAPABILITIES.executor.taskTimeoutMinutes
      );
    });

    it('should have appropriate parallel task limits', () => {
      // Coordinator should handle most parallel tasks
      expect(DEFAULT_CAPABILITIES.coordinator.maxParallelTasks).toBeGreaterThanOrEqual(
        DEFAULT_CAPABILITIES.executor.maxParallelTasks
      );
    });
  });

  describe('DEFAULT_PERMISSIONS', () => {
    it('should have shell permissions only for appropriate agents', () => {
      const agentsWithShell = getAllAgentTypes().filter((type) => {
        const perms = DEFAULT_PERMISSIONS[type];
        return perms.some((p) => p.resource === 'shell' && p.level === 'write');
      });

      expect(agentsWithShell).toContain('executor');
      expect(agentsWithShell).toContain('tester');
      expect(agentsWithShell).toContain('debugger');
      expect(agentsWithShell).not.toContain('coordinator');
      expect(agentsWithShell).not.toContain('researcher');
    });
  });
});
