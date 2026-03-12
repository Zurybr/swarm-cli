/**
 * API Key Manager Unit Tests
 * Tests for secure API key management with env interpolation, keyring integration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ApiKeyManager, KeySource, KeyMetadata } from '@/providers/api-key-manager';

// Mock keyring for tests
jest.mock('keytar', () => ({
  setPassword: jest.fn().mockResolvedValue(true),
  getPassword: jest.fn().mockResolvedValue(null),
  deletePassword: jest.fn().mockResolvedValue(true),
}), { virtual: true });

describe('ApiKeyManager', () => {
  let keyManager: ApiKeyManager;
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    keyManager = new ApiKeyManager();
  });
  
  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('getKey', () => {
    it('should return undefined for non-existent key', async () => {
      const result = await keyManager.getKey('non-existent-provider');
      expect(result).toBeUndefined();
    });

    it('should get key from environment variable', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test-key-123';
      
      const result = await keyManager.getKey('anthropic', {
        envVar: 'ANTHROPIC_API_KEY'
      });
      
      expect(result).toBe('sk-test-key-123');
    });

    it('should interpolate env vars in key value (${VAR_NAME})', async () => {
      process.env.MY_SECRET_KEY = 'secret-value-456';
      
      // Store a key with env var interpolation
      await keyManager.setKey('test-provider', '${MY_SECRET_KEY}');
      
      const result = await keyManager.getKey('test-provider');
      expect(result).toBe('secret-value-456');
    });

    it('should handle nested env var interpolation', async () => {
      process.env.KEY_PREFIX = 'sk-';
      process.env.KEY_SUFFIX = '-abc123';
      
      await keyManager.setKey('nested-test', '${KEY_PREFIX}prod${KEY_SUFFIX}');
      
      const result = await keyManager.getKey('nested-test');
      expect(result).toBe('sk-prod-abc123');
    });

    it('should return original value if env var not found', async () => {
      await keyManager.setKey('missing-var', '${NON_EXISTENT_VAR}');
      
      const result = await keyManager.getKey('missing-var');
      expect(result).toBe('${NON_EXISTENT_VAR}');
    });
  });

  describe('setKey', () => {
    it('should store key in memory', async () => {
      await keyManager.setKey('anthropic', 'sk-ant-123');
      
      const result = await keyManager.getKey('anthropic');
      expect(result).toBe('sk-ant-123');
    });

    it('should store key with metadata', async () => {
      const metadata: KeyMetadata = {
        provider: 'anthropic',
        createdAt: new Date(),
        source: KeySource.CONFIG,
        rotationDays: 90
      };
      
      await keyManager.setKey('anthropic', 'sk-ant-123', metadata);
      
      const storedMeta = await keyManager.getKeyMetadata('anthropic');
      expect(storedMeta).toBeDefined();
      expect(storedMeta?.provider).toBe('anthropic');
      expect(storedMeta?.rotationDays).toBe(90);
    });

    it('should update existing key', async () => {
      await keyManager.setKey('openai', 'old-key');
      await keyManager.setKey('openai', 'new-key');
      
      const result = await keyManager.getKey('openai');
      expect(result).toBe('new-key');
    });
  });

  describe('deleteKey', () => {
    it('should delete stored key', async () => {
      await keyManager.setKey('temp-provider', 'temp-key');
      await keyManager.deleteKey('temp-provider');
      
      const result = await keyManager.getKey('temp-provider');
      expect(result).toBeUndefined();
    });

    it('should not throw when deleting non-existent key', async () => {
      await expect(keyManager.deleteKey('non-existent')).resolves.not.toThrow();
    });
  });

  describe('validateKey', () => {
    it('should validate Anthropic key format', async () => {
      const validKey = 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const result = await keyManager.validateKey('anthropic', validKey);
      
      expect(result.valid).toBe(true);
    });

    it('should validate OpenAI key format', async () => {
      const validKey = 'sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const result = await keyManager.validateKey('openai', validKey);
      
      expect(result.valid).toBe(true);
    });

    it('should validate Google API key format', async () => {
      const validKey = 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      const result = await keyManager.validateKey('google', validKey);
      
      expect(result.valid).toBe(true);
    });

    it('should reject invalid key format', async () => {
      const invalidKey = 'not-a-valid-key';
      const result = await keyManager.validateKey('anthropic', invalidKey);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should accept any key for local/ollama provider', async () => {
      const result = await keyManager.validateKey('ollama', 'any-key-works');
      expect(result.valid).toBe(true);
    });
  });

  describe('rotateKey', () => {
    it('should rotate key and keep history', async () => {
      await keyManager.setKey('test-rotate', 'old-key');
      await keyManager.rotateKey('test-rotate', 'new-key');
      
      const currentKey = await keyManager.getKey('test-rotate');
      expect(currentKey).toBe('new-key');
      
      const history = await keyManager.getKeyHistory('test-rotate');
      expect(history).toHaveLength(1);
      // History stores redacted keys for security
      expect(history[0].key).toBe('***'); // 'old-key' is 7 chars -> redacted
    });

    it('should update rotation timestamp', async () => {
      await keyManager.setKey('rotation-test', 'key1');
      const before = new Date();
      
      await keyManager.rotateKey('rotation-test', 'key2');
      
      const meta = await keyManager.getKeyMetadata('rotation-test');
      expect(meta?.lastRotatedAt).toBeDefined();
      expect(meta?.lastRotatedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('needsRotation', () => {
    it('should return true for key needing rotation', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100 days ago
      
      await keyManager.setKey('old-key', 'test', {
        provider: 'test',
        createdAt: oldDate,
        lastRotatedAt: oldDate,
        source: KeySource.CONFIG,
        rotationDays: 90
      });
      
      const needsRotation = await keyManager.needsRotation('old-key');
      expect(needsRotation).toBe(true);
    });

    it('should return false for recently rotated key', async () => {
      await keyManager.setKey('fresh-key', 'test', {
        provider: 'test',
        createdAt: new Date(),
        lastRotatedAt: new Date(),
        source: KeySource.CONFIG,
        rotationDays: 90
      });
      
      const needsRotation = await keyManager.needsRotation('fresh-key');
      expect(needsRotation).toBe(false);
    });

    it('should return false for key with no rotation policy', async () => {
      await keyManager.setKey('no-rotation', 'test');
      
      const needsRotation = await keyManager.needsRotation('no-rotation');
      expect(needsRotation).toBe(false);
    });
  });

  describe('resolveKey', () => {
    it('should resolve key with priority: env > keyring > config', async () => {
      // Set up all sources
      process.env.OPENAI_API_KEY = 'env-key';
      await keyManager.setKey('openai', 'config-key');
      
      const result = await keyManager.resolveKey('openai', {
        envVar: 'OPENAI_API_KEY'
      });
      
      // Env should take priority
      expect(result).toBe('env-key');
    });

    it('should fall back to config if env not available', async () => {
      delete process.env.OPENAI_API_KEY;
      await keyManager.setKey('openai', 'config-key');
      
      const result = await keyManager.resolveKey('openai', {
        envVar: 'OPENAI_API_KEY'
      });
      
      expect(result).toBe('config-key');
    });

    it('should return undefined if no source available', async () => {
      delete process.env.OPENAI_API_KEY;
      
      const result = await keyManager.resolveKey('openai', {
        envVar: 'OPENAI_API_KEY'
      });
      
      expect(result).toBeUndefined();
    });
  });

  describe('interpolateEnvVars', () => {
    it('should interpolate multiple env vars', () => {
      process.env.PREFIX = 'my-';
      process.env.SUFFIX = '-key';
      
      const result = keyManager.interpolateEnvVars('${PREFIX}test${SUFFIX}');
      expect(result).toBe('my-test-key');
    });

    it('should handle string without env vars', () => {
      const result = keyManager.interpolateEnvVars('plain-string');
      expect(result).toBe('plain-string');
    });

    it('should handle empty string', () => {
      const result = keyManager.interpolateEnvVars('');
      expect(result).toBe('');
    });

    it('should preserve unmatched patterns', () => {
      const result = keyManager.interpolateEnvVars('key-${UNDEFINED_VAR}');
      expect(result).toBe('key-${UNDEFINED_VAR}');
    });
  });

  describe('listKeys', () => {
    it('should list all stored keys', async () => {
      await keyManager.setKey('anthropic', 'key1');
      await keyManager.setKey('openai', 'key2');
      await keyManager.setKey('google', 'key3');
      
      const keys = await keyManager.listKeys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('anthropic');
      expect(keys).toContain('openai');
      expect(keys).toContain('google');
    });

    it('should return empty array when no keys stored', async () => {
      const keys = await keyManager.listKeys();
      expect(keys).toEqual([]);
    });
  });

  describe('export/redacted', () => {
    it('should export config with redacted keys', async () => {
      await keyManager.setKey('anthropic', 'sk-ant-secret-key-12345');
      await keyManager.setKey('openai', 'sk-proj-another-secret');
      
      const exported = await keyManager.exportRedacted();
      
      // Redacted format: first 6 chars + * for rest
      // 'sk-ant' = 6 chars, 'sk-proj' = 7 chars -> keeps 'sk-pro' (first 6)
      expect(exported.anthropic).toMatch(/^sk-ant\*+$/);
      expect(exported.openai).toMatch(/^sk-pro\*+$/);
      expect(exported.anthropic).not.toContain('secret-key-12345');
    });
  });
});
