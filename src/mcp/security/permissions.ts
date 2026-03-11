/**
 * MCP Permission System - Issue #24.5
 * Permission checking for MCP tools, resources, and filesystem access
 */

import { MCPSecurityPermissions, PermissionDeniedError } from './types';

/**
 * Pattern matching for permission checks
 * Supports:
 * - Exact matches: "github:list-repos"
 * - Wildcards: "github:*", "*:read"
 * - Single "*" matches everything
 * - Glob patterns: "fs:read:**", "**:.env"
 */
export function matchPattern(pattern: string, value: string): boolean {
  // Handle exact match
  if (pattern === value) {
    return true;
  }

  // Handle single "*" as match-all
  if (pattern === '*') {
    return true;
  }

  // Convert glob pattern to regex
  // * matches anything except separator
  // ** matches anything including separators
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\*\*/g, '<<<DOUBLE_STAR>>>') // Temp placeholder
    .replace(/\*/g, '[^:]*') // Single * matches non-separator
    .replace(/<<<DOUBLE_STAR>>>/g, '.*'); // ** matches anything

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(value);
}

/**
 * Check if a value matches any pattern in a list
 */
export function matchesAnyPattern(value: string, patterns: string[]): boolean {
  return patterns.some(pattern => matchPattern(pattern, value));
}

/**
 * Normalize a file path for comparison
 */
export function normalizePath(path: string): string {
  // Expand home directory
  if (path.startsWith('~')) {
    path = path.replace('~', process.env.HOME || '');
  }
  
  // Remove trailing slashes and normalize
  return path.replace(/\/+$/, '').replace(/\\/g, '/');
}

/**
 * Check if a path matches a glob pattern
 * Supports:
 * - Exact paths: "/home/user/file.txt"
 * - Single wildcard: "/home/user/*.txt"
 * - Recursive wildcard: "/home/user/**\/*.js"
 */
export function matchPathPattern(pattern: string, path: string): boolean {
  const normalizedPattern = normalizePath(pattern);
  const normalizedPath = normalizePath(path);

  // Exact match
  if (normalizedPattern === normalizedPath) {
    return true;
  }

  // Convert glob to regex
  const regexPattern = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\*\*/g, '<<<DOUBLE_STAR>>>') // Temp placeholder
    .replace(/\*/g, '[^/]*') // Single * matches non-separator
    .replace(/<<<DOUBLE_STAR>>>/g, '.*'); // ** matches anything

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(normalizedPath);
}

/**
 * Permission Checker for MCP operations
 */
export class PermissionChecker {
  private permissions: MCPSecurityPermissions;

  constructor(permissions: MCPSecurityPermissions = {}) {
    this.permissions = permissions;
  }

  /**
   * Update permissions
   */
  updatePermissions(permissions: MCPSecurityPermissions): void {
    this.permissions = { ...this.permissions, ...permissions };
  }

  /**
   * Check if a tool can be used
   * Deny list takes precedence over allow list
   */
  canUseTool(toolName: string): boolean {
    const { tools } = this.permissions;
    
    if (!tools) {
      return true; // No restrictions
    }

    // Check deny list first (takes precedence)
    if (tools.deny && matchesAnyPattern(toolName, tools.deny)) {
      return false;
    }

    // If allow list exists, tool must match
    if (tools.allow) {
      return matchesAnyPattern(toolName, tools.allow);
    }

    // No allow list means all tools are allowed (except denied ones)
    return true;
  }

  /**
   * Check if a tool can be used, throw if not
   */
  checkTool(toolName: string): void {
    if (!this.canUseTool(toolName)) {
      throw new PermissionDeniedError('tool', toolName);
    }
  }

  /**
   * Check if a resource can be accessed
   * Deny list takes precedence over allow list
   */
  canAccessResource(uri: string): boolean {
    const { resources } = this.permissions;
    
    if (!resources) {
      return true; // No restrictions
    }

    // Check deny list first (takes precedence)
    if (resources.deny && matchesAnyPattern(uri, resources.deny)) {
      return false;
    }

    // If allow list exists, resource must match
    if (resources.allow) {
      return matchesAnyPattern(uri, resources.allow);
    }

    // No allow list means all resources are allowed
    return true;
  }

  /**
   * Check if a resource can be accessed, throw if not
   */
  checkResource(uri: string): void {
    if (!this.canAccessResource(uri)) {
      throw new PermissionDeniedError('resource', uri);
    }
  }

  /**
   * Check if a file can be read
   * Deny list takes precedence
   */
  canReadFile(path: string): boolean {
    const { filesystem } = this.permissions;
    
    if (!filesystem) {
      return true; // No restrictions
    }

    // Check deny list first (takes precedence)
    if (filesystem.deny && matchesAnyPath(path, filesystem.deny)) {
      return false;
    }

    // If read allow list exists, path must match
    if (filesystem.read) {
      return matchesAnyPath(path, filesystem.read);
    }

    // No read list means all files are readable (except denied ones)
    return true;
  }

  /**
   * Check if a file can be read, throw if not
   */
  checkFileRead(path: string): void {
    if (!this.canReadFile(path)) {
      throw new PermissionDeniedError('file', path, 'read access denied');
    }
  }

  /**
   * Check if a file can be written
   * Deny list takes precedence
   */
  canWriteFile(path: string): boolean {
    const { filesystem } = this.permissions;
    
    if (!filesystem) {
      return true; // No restrictions
    }

    // Check deny list first (takes precedence)
    if (filesystem.deny && matchesAnyPath(path, filesystem.deny)) {
      return false;
    }

    // If write allow list exists, path must match
    if (filesystem.write) {
      return matchesAnyPath(path, filesystem.write);
    }

    // No write list means no write access
    return false;
  }

  /**
   * Check if a file can be written, throw if not
   */
  checkFileWrite(path: string): void {
    if (!this.canWriteFile(path)) {
      throw new PermissionDeniedError('file', path, 'write access denied');
    }
  }

  /**
   * Get current permissions (read-only copy)
   */
  getPermissions(): Readonly<MCPSecurityPermissions> {
    return { ...this.permissions };
  }

  /**
   * Check if any permissions are configured
   */
  hasPermissions(): boolean {
    const { tools, resources, filesystem } = this.permissions;
    return !!(tools || resources || filesystem);
  }
}

/**
 * Helper function to check if a path matches any pattern in a list
 */
function matchesAnyPath(path: string, patterns: string[]): boolean {
  return patterns.some(pattern => matchPathPattern(pattern, path));
}

/**
 * Create a permission checker from configuration
 */
export function createPermissionChecker(
  permissions?: MCPSecurityPermissions
): PermissionChecker | null {
  if (!permissions || Object.keys(permissions).length === 0) {
    return null;
  }
  return new PermissionChecker(permissions);
}
