/**
 * Tests for permission system
 */

import {
  checkPermission,
  checkPermissions,
  getPermissions,
  getPermissionsByCategory,
  canPerformOperation,
  getAllowedOperations,
  getAccessibleResources,
  validateTaskExecution,
  createPermissionGuard,
  getPermissionSummary,
  comparePermissions,
  PermissionManager,
} from '../permissions';
import { AgentType, PermissionLevel } from '../types';

describe('Permission System', () => {
  describe('checkPermission', () => {
    it('should grant permission when agent has sufficient level', () => {
      const result = checkPermission('executor', 'code', 'write');

      expect(result.granted).toBe(true);
    });

    it('should deny permission when agent has insufficient level', () => {
      const result = checkPermission('researcher', 'code', 'write');

      expect(result.granted).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should grant read permission when agent has write', () => {
      const result = checkPermission('executor', 'code', 'read');

      expect(result.granted).toBe(true);
    });

    it('should deny admin permission when agent has write', () => {
      const result = checkPermission('executor', 'code', 'admin');

      expect(result.granted).toBe(false);
    });

    it('should include actual and required levels in result', () => {
      const result = checkPermission('researcher', 'code', 'write');

      expect(result.actualLevel).toBe('read');
      expect(result.requiredLevel).toBe('write');
    });
  });

  describe('checkPermissions', () => {
    it('should grant when all permissions pass', () => {
      const result = checkPermissions('executor', [
        { resource: 'code', level: 'write' },
        { resource: 'tests', level: 'write' },
      ]);

      expect(result.granted).toBe(true);
    });

    it('should deny when any permission fails', () => {
      const result = checkPermissions('researcher', [
        { resource: 'code', level: 'read' },
        { resource: 'code', level: 'write' },
      ]);

      expect(result.granted).toBe(false);
    });
  });

  describe('getPermissions', () => {
    it('should return permissions for all agent types', () => {
      const types: AgentType[] = [
        'coordinator', 'researcher', 'planner', 'executor', 'reviewer',
        'tester', 'debugger', 'optimizer', 'documenter', 'validator',
        'migrator', 'analyzer'
      ];

      for (const type of types) {
        const perms = getPermissions(type);
        expect(perms).toBeDefined();
        expect(perms.length).toBeGreaterThan(0);
      }
    });

    it('should return permissions array', () => {
      const perms = getPermissions('executor');

      expect(perms).toBeDefined();
      expect(perms.length).toBeGreaterThan(0);
      expect(perms[0].resource).toBeDefined();
      expect(perms[0].level).toBeDefined();
    });
  });

  describe('getPermissionsByCategory', () => {
    it('should return permissions for code category', () => {
      const perms = getPermissionsByCategory('executor', 'code');

      expect(perms.length).toBeGreaterThan(0);
    });
  });

  describe('canPerformOperation', () => {
    it('should return true for allowed operations', () => {
      expect(canPerformOperation('executor', 'canModifyCode')).toBe(true);
      expect(canPerformOperation('coordinator', 'canSpawnAgents')).toBe(true);
    });

    it('should return false for disallowed operations', () => {
      expect(canPerformOperation('researcher', 'canModifyCode')).toBe(false);
      expect(canPerformOperation('executor', 'canSpawnAgents')).toBe(false);
    });
  });

  describe('getAllowedOperations', () => {
    it('should return operations executor can perform', () => {
      const ops = getAllowedOperations('executor');

      expect(ops).toContain('canModifyCode');
      expect(ops).toContain('canExecuteShell');
      expect(ops).not.toContain('canSpawnAgents');
    });

    it('should return operations coordinator can perform', () => {
      const ops = getAllowedOperations('coordinator');

      expect(ops).toContain('canSpawnAgents');
      expect(ops).not.toContain('canModifyCode');
    });
  });

  describe('getAccessibleResources', () => {
    it('should return resources with at least read access', () => {
      const resources = getAccessibleResources('executor');

      expect(resources).toContain('code');
      expect(resources).toContain('tests');
    });

    it('should filter by minimum level', () => {
      const resources = getAccessibleResources('executor', 'write');

      expect(resources).toContain('code');
    });
  });

  describe('validateTaskExecution', () => {
    it('should validate task with matching requirements', () => {
      const result = validateTaskExecution('executor', {
        type: 'implement',
        requiresCodeModification: true,
      });

      expect(result.granted).toBe(true);
    });

    it('should invalidate task with non-matching requirements', () => {
      const result = validateTaskExecution('researcher', {
        type: 'implement',
        requiresCodeModification: true,
      });

      expect(result.granted).toBe(false);
    });

    it('should validate shell execution requirement', () => {
      const result = validateTaskExecution('executor', {
        type: 'deploy',
        requiresShell: true,
      });

      expect(result.granted).toBe(true);
    });

    it('should invalidate shell execution for agents without permission', () => {
      const result = validateTaskExecution('researcher', {
        type: 'deploy',
        requiresShell: true,
      });

      expect(result.granted).toBe(false);
    });
  });

  describe('createPermissionGuard', () => {
    it('should create guard with check methods', () => {
      const guard = createPermissionGuard('executor');

      expect(guard.check).toBeDefined();
      expect(guard.canRead).toBeDefined();
      expect(guard.canWrite).toBeDefined();
      expect(guard.canAdmin).toBeDefined();
    });

    it('should correctly check read permission', () => {
      const guard = createPermissionGuard('executor');
      const result = guard.canRead('code');

      expect(result.granted).toBe(true);
    });

    it('should correctly check write permission', () => {
      const guard = createPermissionGuard('executor');
      const result = guard.canWrite('code');

      expect(result.granted).toBe(true);
    });
  });

  describe('getPermissionSummary', () => {
    it('should return summary for agent type', () => {
      const summary = getPermissionSummary('executor');

      expect(summary.agentType).toBe('executor');
      expect(summary.totalPermissions).toBeGreaterThan(0);
      expect(summary.canModifyCode).toBe(true);
      expect(summary.canExecuteShell).toBe(true);
      expect(summary.capabilities).toContain('canModifyCode');
    });
  });

  describe('comparePermissions', () => {
    it('should compare permissions between agent types', () => {
      const comparison = comparePermissions('executor', 'researcher');

      expect(comparison.type1Only).toBeDefined();
      expect(comparison.type2Only).toBeDefined();
      expect(comparison.both).toBeDefined();
    });

    it('should identify resources unique to each agent', () => {
      const comparison = comparePermissions('coordinator', 'executor');

      // Coordinator has 'agents' resource that executor doesn't
      expect(comparison.type1Only).toContain('agents');

      // Executor has 'shell' resource that coordinator doesn't
      expect(comparison.type2Only).toContain('shell');
    });
  });

  describe('PermissionManager', () => {
    let manager: PermissionManager;

    beforeEach(() => {
      manager = new PermissionManager();
    });

    it('should add and retrieve permission overrides', () => {
      manager.addOverride('agent-1', {
        resource: 'special',
        level: 'admin',
      });

      const perms = manager.getEffectivePermissions('executor', 'agent-1');
      const specialPerm = perms.find(p => p.resource === 'special');

      expect(specialPerm).toBeDefined();
      expect(specialPerm?.level).toBe('admin');
    });

    it('should check permissions with overrides', () => {
      manager.addOverride('agent-1', {
        resource: 'code',
        level: 'admin',
      });

      const result = manager.checkWithOverrides(
        'researcher',
        'agent-1',
        'code',
        'admin'
      );

      expect(result.granted).toBe(true);
    });

    it('should clear overrides for an agent', () => {
      manager.addOverride('agent-1', {
        resource: 'special',
        level: 'admin',
      });

      manager.clearOverrides('agent-1');

      const perms = manager.getEffectivePermissions('executor', 'agent-1');
      const specialPerm = perms.find(p => p.resource === 'special');

      expect(specialPerm).toBeUndefined();
    });

    it('should filter out expired overrides', () => {
      const pastDate = new Date(Date.now() - 1000);

      manager.addOverride('agent-1', {
        resource: 'expired',
        level: 'admin',
        expiresAt: pastDate,
      });

      const perms = manager.getEffectivePermissions('executor', 'agent-1');
      const expiredPerm = perms.find(p => p.resource === 'expired');

      expect(expiredPerm).toBeUndefined();
    });

    it('should cleanup expired overrides', () => {
      const pastDate = new Date(Date.now() - 1000);

      manager.addOverride('agent-1', {
        resource: 'expired',
        level: 'admin',
        expiresAt: pastDate,
      });

      const cleaned = manager.cleanupExpired();

      expect(cleaned).toBe(1);
    });
  });
});
