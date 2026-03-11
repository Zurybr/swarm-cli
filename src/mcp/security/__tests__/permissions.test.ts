/**
 * Tests for MCP Permission System
 */

import {
  PermissionChecker,
  matchPattern,
  matchesAnyPattern,
  matchPathPattern,
  normalizePath,
  createPermissionChecker,
} from '../permissions';
import { PermissionDeniedError } from '../types';

describe('matchPattern', () => {
  it('should match exact patterns', () => {
    expect(matchPattern('github:list-repos', 'github:list-repos')).toBe(true);
    expect(matchPattern('github:list-repos', 'github:other')).toBe(false);
  });

  it('should match single wildcards', () => {
    expect(matchPattern('github:*', 'github:list-repos')).toBe(true);
    expect(matchPattern('github:*', 'github:create-repo')).toBe(true);
    expect(matchPattern('github:*', 'gitlab:list')).toBe(false);
  });

  it('should match prefix wildcards', () => {
    expect(matchPattern('*:read', 'fs:read')).toBe(true);
    expect(matchPattern('*:read', 'db:read')).toBe(true);
    expect(matchPattern('*:read', 'fs:write')).toBe(false);
  });

  it('should match double wildcards', () => {
    expect(matchPattern('**', 'anything:here:at:all')).toBe(true);
    expect(matchPattern('fs:**', 'fs:read:file')).toBe(true);
    expect(matchPattern('fs:**', 'fs:write:file')).toBe(true);
    expect(matchPattern('fs:**', 'db:read')).toBe(false);
  });
});

describe('matchesAnyPattern', () => {
  it('should return true if any pattern matches', () => {
    expect(matchesAnyPattern('github:list-repos', ['gitlab:*', 'github:*'])).toBe(true);
    expect(matchesAnyPattern('github:list-repos', ['gitlab:*', 'bitbucket:*'])).toBe(false);
  });

  it('should handle empty pattern lists', () => {
    expect(matchesAnyPattern('github:list-repos', [])).toBe(false);
  });
});

describe('matchPathPattern', () => {
  it('should match exact paths', () => {
    expect(matchPathPattern('/home/user/file.txt', '/home/user/file.txt')).toBe(true);
    expect(matchPathPattern('/home/user/file.txt', '/home/user/other.txt')).toBe(false);
  });

  it('should match single wildcards', () => {
    expect(matchPathPattern('/home/user/*.txt', '/home/user/file.txt')).toBe(true);
    expect(matchPathPattern('/home/user/*.txt', '/home/user/file.json')).toBe(false);
  });

  it('should match double wildcards (recursive)', () => {
    expect(matchPathPattern('/home/user/**/*.js', '/home/user/src/index.js')).toBe(true);
    expect(matchPathPattern('/home/user/**/*.js', '/home/user/src/lib/util.js')).toBe(true);
    expect(matchPathPattern('/home/user/**/*.js', '/home/user/src/lib/util.ts')).toBe(false);
  });

  it('should expand home directory', () => {
    const home = process.env.HOME || '';
    expect(matchPathPattern('~/projects', `${home}/projects`)).toBe(true);
  });
});

describe('normalizePath', () => {
  it('should remove trailing slashes', () => {
    expect(normalizePath('/home/user/')).toBe('/home/user');
  });

  it('should convert backslashes to forward slashes', () => {
    expect(normalizePath('C:\\Users\\test')).toBe('C:/Users/test');
  });

  it('should expand home directory', () => {
    const home = process.env.HOME || '';
    expect(normalizePath('~/documents')).toBe(`${home}/documents`);
  });
});

describe('PermissionChecker', () => {
  let checker: PermissionChecker;

  beforeEach(() => {
    checker = new PermissionChecker();
  });

  describe('tool permissions', () => {
    it('should allow all tools when no permissions configured', () => {
      expect(checker.canUseTool('any:tool')).toBe(true);
    });

    it('should respect allow list', () => {
      checker.updatePermissions({
        tools: {
          allow: ['github:*', 'fs:read'],
        },
      });

      expect(checker.canUseTool('github:list-repos')).toBe(true);
      expect(checker.canUseTool('fs:read')).toBe(true);
      expect(checker.canUseTool('fs:write')).toBe(false);
      expect(checker.canUseTool('db:query')).toBe(false);
    });

    it('should respect deny list', () => {
      checker.updatePermissions({
        tools: {
          deny: ['db:*', 'admin:*'],
        },
      });

      expect(checker.canUseTool('github:list-repos')).toBe(true);
      expect(checker.canUseTool('db:query')).toBe(false);
      expect(checker.canUseTool('admin:delete')).toBe(false);
    });

    it('should give deny list precedence', () => {
      checker.updatePermissions({
        tools: {
          allow: ['*'],
          deny: ['admin:*'],
        },
      });

      expect(checker.canUseTool('github:list-repos')).toBe(true);
      expect(checker.canUseTool('admin:delete')).toBe(false);
    });

    it('should throw on denied tool', () => {
      checker.updatePermissions({
        tools: {
          deny: ['admin:*'],
        },
      });

      expect(() => checker.checkTool('admin:delete')).toThrow(PermissionDeniedError);
    });
  });

  describe('resource permissions', () => {
    it('should allow all resources when no permissions configured', () => {
      expect(checker.canAccessResource('file:///home/user/file.txt')).toBe(true);
    });

    it('should respect allow list', () => {
      checker.updatePermissions({
        resources: {
          allow: ['file:///home/user/**', 'http://api.example.com/**'],
        },
      });

      expect(checker.canAccessResource('file:///home/user/file.txt')).toBe(true);
      expect(checker.canAccessResource('file:///etc/passwd')).toBe(false);
      expect(checker.canAccessResource('http://api.example.com/users')).toBe(true);
      expect(checker.canAccessResource('http://other.com/api')).toBe(false);
    });

    it('should respect deny list', () => {
      checker.updatePermissions({
        resources: {
          deny: ['file:///etc/**', 'file:///**/.env'],
        },
      });

      expect(checker.canAccessResource('file:///etc/passwd')).toBe(false);
      expect(checker.canAccessResource('file:///home/user/.env')).toBe(false);
      expect(checker.canAccessResource('file:///home/user/file.txt')).toBe(true);
    });

    it('should give deny list precedence', () => {
      checker.updatePermissions({
        resources: {
          allow: ['file:///**'],
          deny: ['file:///etc/**'],
        },
      });

      expect(checker.canAccessResource('file:///home/user/file.txt')).toBe(true);
      expect(checker.canAccessResource('file:///etc/passwd')).toBe(false);
    });
  });

  describe('filesystem permissions', () => {
    it('should allow all files when no permissions configured', () => {
      expect(checker.canReadFile('/home/user/file.txt')).toBe(true);
      expect(checker.canWriteFile('/home/user/file.txt')).toBe(true);
    });

    it('should respect read permissions', () => {
      checker.updatePermissions({
        filesystem: {
          read: ['/home/user/**', '/tmp/**'],
        },
      });

      expect(checker.canReadFile('/home/user/file.txt')).toBe(true);
      expect(checker.canReadFile('/tmp/cache')).toBe(true);
      expect(checker.canReadFile('/etc/passwd')).toBe(false);
    });

    it('should respect write permissions', () => {
      checker.updatePermissions({
        filesystem: {
          write: ['/home/user/**'],
        },
      });

      expect(checker.canWriteFile('/home/user/file.txt')).toBe(true);
      expect(checker.canWriteFile('/etc/passwd')).toBe(false);
    });

    it('should respect deny list for filesystem', () => {
      checker.updatePermissions({
        filesystem: {
          read: ['/home/user/**'],
          write: ['/home/user/**'],
          deny: ['/home/user/secrets/**'],
        },
      });

      expect(checker.canReadFile('/home/user/file.txt')).toBe(true);
      expect(checker.canReadFile('/home/user/secrets/key.pem')).toBe(false);
      expect(checker.canWriteFile('/home/user/file.txt')).toBe(true);
      expect(checker.canWriteFile('/home/user/secrets/key.pem')).toBe(false);
    });
  });

  describe('updatePermissions', () => {
    it('should merge permissions on update', () => {
      checker.updatePermissions({
        tools: { allow: ['github:*'] },
      });
      
      checker.updatePermissions({
        resources: { allow: ['file:///home/**'] },
      });

      const permissions = checker.getPermissions();
      expect(permissions.tools?.allow).toContain('github:*');
      expect(permissions.resources?.allow).toContain('file:///home/**');
    });
  });

  describe('hasPermissions', () => {
    it('should return false when no permissions configured', () => {
      expect(checker.hasPermissions()).toBe(false);
    });

    it('should return true when permissions are configured', () => {
      checker.updatePermissions({
        tools: { allow: ['*'] },
      });
      expect(checker.hasPermissions()).toBe(true);
    });
  });
});

describe('createPermissionChecker', () => {
  it('should return null when no permissions provided', () => {
    expect(createPermissionChecker()).toBeNull();
    expect(createPermissionChecker({})).toBeNull();
  });

  it('should return checker when permissions provided', () => {
    const checker = createPermissionChecker({
      tools: { allow: ['*'] },
    });
    expect(checker).toBeInstanceOf(PermissionChecker);
  });
});
