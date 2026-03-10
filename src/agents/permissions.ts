/**
 * Permission System for the Specialized Agent System
 * Manages access control and permission checking for agent operations
 */

import {
  AgentType,
  Permission,
  PermissionLevel,
  PermissionCheckResult,
  AgentCapabilities,
} from './types';
import { getDefaultPermissions, getDefaultCapabilities } from './definitions';

/**
 * Permission hierarchy (higher includes lower)
 */
const PERMISSION_HIERARCHY: Record<PermissionLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
};

/**
 * Resource categories for grouping permissions
 */
const RESOURCE_CATEGORIES: Record<string, string[]> = {
  code: ['code', 'tests', 'docs', 'comments'],
  data: ['database', 'files', 'cache'],
  execution: ['shell', 'git', 'deploy'],
  system: ['agents', 'tasks', 'logs', 'system', 'metrics'],
  external: ['external', 'api', 'webhook'],
  communication: ['reviews', 'reports', 'notifications'],
};

/**
 * Default conditions that can be applied to permissions
 */
const DEFAULT_CONDITIONS: Record<string, (context: PermissionContext) => boolean> = {
  sandboxed: () => true, // Assume sandboxed environment
  'test-only': (ctx) => ctx.operation?.startsWith('test') || false,
  'debug-only': (ctx) => ctx.operation?.startsWith('debug') || false,
  'benchmark-only': (ctx) => ctx.operation?.startsWith('benchmark') || false,
  'validate-only': (ctx) => ctx.operation?.startsWith('validate') || false,
  'migration-only': (ctx) => ctx.operation?.startsWith('migrate') || false,
};

/**
 * Context for permission checks
 */
export interface PermissionContext {
  agentType?: AgentType;
  agentId?: string;
  operation?: string;
  resource?: string;
  path?: string;
  taskId?: string;
  [key: string]: unknown;
}

/**
 * Check if a permission level satisfies a required level
 */
function hasSufficientPermission(
  actual: PermissionLevel,
  required: PermissionLevel
): boolean {
  return PERMISSION_HIERARCHY[actual] >= PERMISSION_HIERARCHY[required];
}

/**
 * Get the effective permission level for a resource
 */
function getEffectivePermission(
  permissions: Permission[],
  resource: string
): PermissionLevel {
  // Check for exact resource match
  const exactMatch = permissions.find((p) => p.resource === resource);
  if (exactMatch) {
    return exactMatch.level;
  }

  // Check for wildcard match
  const wildcardMatch = permissions.find((p) => p.resource === '*');
  if (wildcardMatch) {
    return wildcardMatch.level;
  }

  // Check category match
  for (const [category, resources] of Object.entries(RESOURCE_CATEGORIES)) {
    if (resources.includes(resource)) {
      const categoryPerm = permissions.find((p) => p.resource === category);
      if (categoryPerm) {
        return categoryPerm.level;
      }
    }
  }

  return 'none';
}

/**
 * Evaluate conditions for a permission
 */
function evaluateConditions(
  permission: Permission,
  context: PermissionContext
): boolean {
  if (!permission.conditions || permission.conditions.length === 0) {
    return true;
  }

  return permission.conditions.every((condition) => {
    const evaluator = DEFAULT_CONDITIONS[condition];
    if (evaluator) {
      return evaluator(context);
    }
    // Unknown conditions default to allowing
    return true;
  });
}

/**
 * Check if an agent type has permission for an operation
 */
export function checkPermission(
  agentType: AgentType,
  resource: string,
  requiredLevel: PermissionLevel,
  context: PermissionContext = {}
): PermissionCheckResult {
  const permissions = getDefaultPermissions(agentType);
  const effectiveLevel = getEffectivePermission(permissions, resource);

  // Check level
  if (!hasSufficientPermission(effectiveLevel, requiredLevel)) {
    return {
      granted: false,
      reason: `Agent type '${agentType}' has '${effectiveLevel}' permission for '${resource}', but '${requiredLevel}' is required`,
      requiredLevel,
      actualLevel: effectiveLevel,
    };
  }

  // Check conditions
  const permission = permissions.find(
    (p) => p.resource === resource || p.resource === '*' || isInCategory(p.resource, resource)
  );

  if (permission && permission.conditions) {
    const conditionsMet = evaluateConditions(permission, {
      ...context,
      agentType,
    });

    if (!conditionsMet) {
      return {
        granted: false,
        reason: `Permission conditions not met for '${resource}': ${permission.conditions.join(', ')}`,
        requiredLevel,
        actualLevel: effectiveLevel,
      };
    }
  }

  return {
    granted: true,
    requiredLevel,
    actualLevel: effectiveLevel,
  };
}

/**
 * Check if a resource is in a category
 */
function isInCategory(category: string, resource: string): boolean {
  const resources = RESOURCE_CATEGORIES[category];
  return resources ? resources.includes(resource) : false;
}

/**
 * Check multiple permissions at once
 */
export function checkPermissions(
  agentType: AgentType,
  checks: Array<{
    resource: string;
    level: PermissionLevel;
    context?: PermissionContext;
  }>
): PermissionCheckResult {
  for (const check of checks) {
    const result = checkPermission(
      agentType,
      check.resource,
      check.level,
      check.context
    );
    if (!result.granted) {
      return result;
    }
  }

  return {
    granted: true,
  };
}

/**
 * Get all permissions for an agent type
 */
export function getPermissions(agentType: AgentType): Permission[] {
  return [...getDefaultPermissions(agentType)];
}

/**
 * Get permissions for a specific resource category
 */
export function getPermissionsByCategory(
  agentType: AgentType,
  category: string
): Permission[] {
  const permissions = getDefaultPermissions(agentType);
  const resources = RESOURCE_CATEGORIES[category] || [];

  return permissions.filter(
    (p) => resources.includes(p.resource) || p.resource === category
  );
}

/**
 * Check if an agent type can perform a capability-based operation
 */
export function canPerformOperation(
  agentType: AgentType,
  operation: keyof AgentCapabilities
): boolean {
  const capabilities = getDefaultCapabilities(agentType);
  return !!capabilities[operation];
}

/**
 * Get all operations an agent type can perform
 */
export function getAllowedOperations(agentType: AgentType): string[] {
  const capabilities = getDefaultCapabilities(agentType);
  const operations: string[] = [];

  for (const [key, value] of Object.entries(capabilities)) {
    if (typeof value === 'boolean' && value) {
      operations.push(key);
    }
  }

  return operations;
}

/**
 * Get all resources an agent type has access to
 */
export function getAccessibleResources(
  agentType: AgentType,
  minLevel: PermissionLevel = 'read'
): string[] {
  const permissions = getDefaultPermissions(agentType);
  const accessible: string[] = [];

  for (const permission of permissions) {
    if (hasSufficientPermission(permission.level, minLevel)) {
      accessible.push(permission.resource);
    }
  }

  return accessible;
}

/**
 * Validate if an agent type can execute a task
 */
export function validateTaskExecution(
  agentType: AgentType,
  task: {
    type: string;
    resources?: string[];
    requiresShell?: boolean;
    requiresCodeModification?: boolean;
    requiresExternalAccess?: boolean;
  }
): PermissionCheckResult {
  const capabilities = getDefaultCapabilities(agentType);

  // Check capability requirements
  if (task.requiresShell && !capabilities.canExecuteShell) {
    return {
      granted: false,
      reason: `Agent type '${agentType}' cannot execute shell commands`,
    };
  }

  if (task.requiresCodeModification && !capabilities.canModifyCode) {
    return {
      granted: false,
      reason: `Agent type '${agentType}' cannot modify code`,
    };
  }

  if (task.requiresExternalAccess && !capabilities.canAccessExternal) {
    return {
      granted: false,
      reason: `Agent type '${agentType}' cannot access external resources`,
    };
  }

  // Check resource permissions
  if (task.resources) {
    for (const resource of task.resources) {
      const result = checkPermission(agentType, resource, 'write');
      if (!result.granted) {
        return result;
      }
    }
  }

  return {
    granted: true,
  };
}

/**
 * Create a permission guard function
 */
export function createPermissionGuard(agentType: AgentType) {
  return {
    check: (resource: string, level: PermissionLevel, context?: PermissionContext) =>
      checkPermission(agentType, resource, level, context),
    canRead: (resource: string, context?: PermissionContext) =>
      checkPermission(agentType, resource, 'read', context),
    canWrite: (resource: string, context?: PermissionContext) =>
      checkPermission(agentType, resource, 'write', context),
    canAdmin: (resource: string, context?: PermissionContext) =>
      checkPermission(agentType, resource, 'admin', context),
  };
}

/**
 * Get permission summary for an agent type
 */
export function getPermissionSummary(agentType: AgentType): {
  agentType: AgentType;
  totalPermissions: number;
  resources: Record<string, PermissionLevel>;
  capabilities: string[];
  canModifyCode: boolean;
  canExecuteShell: boolean;
  canAccessExternal: boolean;
  canSpawnAgents: boolean;
} {
  const permissions = getDefaultPermissions(agentType);
  const capabilities = getDefaultCapabilities(agentType);

  const resources: Record<string, PermissionLevel> = {};
  for (const perm of permissions) {
    resources[perm.resource] = perm.level;
  }

  return {
    agentType,
    totalPermissions: permissions.length,
    resources,
    capabilities: getAllowedOperations(agentType),
    canModifyCode: capabilities.canModifyCode,
    canExecuteShell: capabilities.canExecuteShell,
    canAccessExternal: capabilities.canAccessExternal,
    canSpawnAgents: capabilities.canSpawnAgents,
  };
}

/**
 * Compare permissions between two agent types
 */
export function comparePermissions(
  type1: AgentType,
  type2: AgentType
): {
  type1Only: string[];
  type2Only: string[];
  both: Array<{ resource: string; type1: PermissionLevel; type2: PermissionLevel }>;
} {
  const perms1 = getDefaultPermissions(type1);
  const perms2 = getDefaultPermissions(type2);

  const resources1 = new Set(perms1.map((p) => p.resource));
  const resources2 = new Set(perms2.map((p) => p.resource));

  const type1Only = Array.from(resources1).filter((r) => !resources2.has(r));
  const type2Only = Array.from(resources2).filter((r) => !resources1.has(r));

  const both: Array<{ resource: string; type1: PermissionLevel; type2: PermissionLevel }> = [];
  for (const resource of resources1) {
    if (resources2.has(resource)) {
      const level1 = perms1.find((p) => p.resource === resource)?.level || 'none';
      const level2 = perms2.find((p) => p.resource === resource)?.level || 'none';
      both.push({ resource, type1: level1, type2: level2 });
    }
  }

  return { type1Only, type2Only, both };
}

/**
 * Grant temporary permission (creates a permission override)
 */
export function createTemporaryPermission(
  agentType: AgentType,
  resource: string,
  level: PermissionLevel,
  expiresAt: Date,
  reason: string
): Permission & { expiresAt: Date; reason: string } {
  return {
    resource,
    level,
    expiresAt,
    reason,
  };
}

/**
 * Permission manager for runtime permission handling
 */
export class PermissionManager {
  private overrides: Map<string, Permission[]> = new Map();

  /**
   * Add a permission override for an agent instance
   */
  addOverride(
    agentId: string,
    permission: Permission & { expiresAt?: Date }
  ): void {
    const existing = this.overrides.get(agentId) || [];
    existing.push(permission);
    this.overrides.set(agentId, existing);
  }

  /**
   * Get effective permissions for an agent instance
   */
  getEffectivePermissions(
    agentType: AgentType,
    agentId: string
  ): Permission[] {
    const basePermissions = [...getDefaultPermissions(agentType)];
    const overrides = this.overrides.get(agentId) || [];

    // Filter out expired overrides
    const now = new Date();
    const validOverrides = overrides.filter(
      (o) => !(o as any).expiresAt || (o as any).expiresAt > now
    );

    // Merge overrides with base permissions
    const permissionMap = new Map(basePermissions.map((p) => [p.resource, p]));

    for (const override of validOverrides) {
      permissionMap.set(override.resource, override);
    }

    return Array.from(permissionMap.values());
  }

  /**
   * Check permission with overrides
   */
  checkWithOverrides(
    agentType: AgentType,
    agentId: string,
    resource: string,
    requiredLevel: PermissionLevel,
    context: PermissionContext = {}
  ): PermissionCheckResult {
    const permissions = this.getEffectivePermissions(agentType, agentId);
    const effectiveLevel = getEffectivePermission(permissions, resource);

    if (!hasSufficientPermission(effectiveLevel, requiredLevel)) {
      return {
        granted: false,
        reason: `Permission denied for '${resource}'`,
        requiredLevel,
        actualLevel: effectiveLevel,
      };
    }

    return {
      granted: true,
      requiredLevel,
      actualLevel: effectiveLevel,
    };
  }

  /**
   * Clear overrides for an agent
   */
  clearOverrides(agentId: string): void {
    this.overrides.delete(agentId);
  }

  /**
   * Clean up expired overrides
   */
  cleanupExpired(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [agentId, permissions] of this.overrides.entries()) {
      const valid = permissions.filter(
        (p) => !('expiresAt' in p) || (p as any).expiresAt > now
      );
      if (valid.length !== permissions.length) {
        cleaned += permissions.length - valid.length;
        if (valid.length === 0) {
          this.overrides.delete(agentId);
        } else {
          this.overrides.set(agentId, valid);
        }
      }
    }

    return cleaned;
  }
}

// Singleton instance
export const permissionManager = new PermissionManager();
