/**
 * Config Loader Unit Tests
 * Tests for parsing provider config from ~/.swarm/config.yaml
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigLoader, SwarmConfig, ProviderConfig } from '@/providers/config-loader';

// Mock fs and os modules
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe('ConfigLoader', () => {
  let configLoader: ConfigLoader;
  let mockConfigPath: string;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockConfigPath = path.join(os.homedir(), '.swarm', 'config.yaml');
    configLoader = new ConfigLoader();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('load', () => {
    it('should load config from default path', () => {
      const mockConfig = `
providers:
  anthropic:
    api_key: sk-ant-test123
    model: claude-3-sonnet-20240229
  openai:
    api_key: sk-proj-test456
    model: gpt-4
  google:
    api_key: AIzaSyTest789
  local:
    base_url: http://localhost:11434
`;
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      const config = configLoader.load();

      expect(fs.readFileSync).toHaveBeenCalledWith(mockConfigPath, 'utf-8');
      expect(config.providers.anthropic.api_key).toBe('sk-ant-test123');
      expect(config.providers.openai.api_key).toBe('sk-proj-test456');
      expect(config.providers.google.api_key).toBe('AIzaSyTest789');
      expect(config.providers.local.base_url).toBe('http://localhost:11434');
    });

    it('should return default config if file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const config = configLoader.load();

      expect(config).toEqual({
        providers: {},
        defaults: {
          provider: 'anthropic',
          model: 'claude-3-sonnet-20240229'
        }
      });
    });

    it('should load config from custom path', () => {
      const customPath = '/custom/path/config.yaml';
      const mockConfig = `
providers:
  ollama:
    base_url: http://custom:11434
`;
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      const loader = new ConfigLoader(customPath);
      const config = loader.load();

      expect(fs.readFileSync).toHaveBeenCalledWith(customPath, 'utf-8');
      expect(config.providers.ollama.base_url).toBe('http://custom:11434');
    });

    it('should interpolate env vars in config values', () => {
      process.env.ANTHROPIC_KEY = 'sk-ant-from-env';
      process.env.OPENAI_KEY = 'sk-proj-from-env';
      
      const mockConfig = `
providers:
  anthropic:
    api_key: \${ANTHROPIC_KEY}
  openai:
    api_key: \${OPENAI_KEY}
`;
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      const config = configLoader.load();

      expect(config.providers.anthropic.api_key).toBe('sk-ant-from-env');
      expect(config.providers.openai.api_key).toBe('sk-proj-from-env');
    });

    it('should handle malformed YAML gracefully', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid: yaml: [content');

      // Should not throw, return default config
      const config = configLoader.load();
      expect(config).toEqual({
        providers: {},
        defaults: {
          provider: 'anthropic',
          model: 'claude-3-sonnet-20240229'
        }
      });
    });
  });

  describe('getProviderConfig', () => {
    it('should return config for specific provider', () => {
      const mockConfig = `
providers:
  anthropic:
    api_key: sk-ant-test
    model: claude-3-opus-20240229
    max_tokens: 4096
`;
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      configLoader.load();
      const providerConfig = configLoader.getProviderConfig('anthropic');

      expect(providerConfig).toEqual({
        api_key: 'sk-ant-test',
        model: 'claude-3-opus-20240229',
        max_tokens: 4096
      });
    });

    it('should return undefined for unknown provider', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      configLoader.load();
      const providerConfig = configLoader.getProviderConfig('unknown');

      expect(providerConfig).toBeUndefined();
    });
  });

  describe('getApiKey', () => {
    it('should return API key for provider', () => {
      const mockConfig = `
providers:
  openai:
    api_key: sk-proj-test
`;
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      configLoader.load();
      const apiKey = configLoader.getApiKey('openai');

      expect(apiKey).toBe('sk-proj-test');
    });

    it('should return undefined if API key not configured', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      configLoader.load();
      const apiKey = configLoader.getApiKey('unknown');

      expect(apiKey).toBeUndefined();
    });
  });

  describe('getBaseUrl', () => {
    it('should return base URL for local provider', () => {
      const mockConfig = `
providers:
  local:
    base_url: http://localhost:11434
`;
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      configLoader.load();
      const baseUrl = configLoader.getBaseUrl('local');

      expect(baseUrl).toBe('http://localhost:11434');
    });

    it('should return undefined if base URL not configured', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      configLoader.load();
      const baseUrl = configLoader.getBaseUrl('local');

      expect(baseUrl).toBeUndefined();
    });
  });

  describe('getDefaultProvider', () => {
    it('should return configured default provider', () => {
      const mockConfig = `
defaults:
  provider: openai
  model: gpt-4-turbo
`;
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      configLoader.load();
      const defaultProvider = configLoader.getDefaultProvider();

      expect(defaultProvider).toBe('openai');
    });

    it('should return anthropic as default if not configured', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      configLoader.load();
      const defaultProvider = configLoader.getDefaultProvider();

      expect(defaultProvider).toBe('anthropic');
    });
  });

  describe('getDefaultModel', () => {
    it('should return configured default model', () => {
      const mockConfig = `
defaults:
  provider: openai
  model: gpt-4-turbo
`;
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      configLoader.load();
      const defaultModel = configLoader.getDefaultModel();

      expect(defaultModel).toBe('gpt-4-turbo');
    });

    it('should return claude-3-sonnet as default if not configured', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      configLoader.load();
      const defaultModel = configLoader.getDefaultModel();

      expect(defaultModel).toBe('claude-3-sonnet-20240229');
    });
  });

  describe('save', () => {
    it('should save config to file', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      const config: SwarmConfig = {
        providers: {
          anthropic: {
            api_key: 'sk-ant-new',
            model: 'claude-3-opus-20240229'
          }
        },
        defaults: {
          provider: 'anthropic',
          model: 'claude-3-opus-20240229'
        }
      };

      configLoader.save(config);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining('anthropic'),
        'utf-8'
      );
    });

    it('should create directory if it does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      const config: SwarmConfig = {
        providers: {},
        defaults: {
          provider: 'anthropic',
          model: 'claude-3-sonnet-20240229'
        }
      };

      configLoader.save(config);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        path.dirname(mockConfigPath),
        { recursive: true }
      );
    });
  });

  describe('setProviderConfig', () => {
    it('should update provider config', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      configLoader.load();
      configLoader.setProviderConfig('google', {
        api_key: 'AIzaSyTest',
        model: 'gemini-pro'
      });

      const providerConfig = configLoader.getProviderConfig('google');
      expect(providerConfig?.api_key).toBe('AIzaSyTest');
    });
  });

  describe('listProviders', () => {
    it('should list all configured providers', () => {
      const mockConfig = `
providers:
  anthropic:
    api_key: key1
  openai:
    api_key: key2
  google:
    api_key: key3
`;
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      configLoader.load();
      const providers = configLoader.listProviders();

      expect(providers).toEqual(['anthropic', 'openai', 'google']);
    });

    it('should return empty array when no providers configured', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      configLoader.load();
      const providers = configLoader.listProviders();

      expect(providers).toEqual([]);
    });
  });

  describe('validate', () => {
    it('should validate complete config', () => {
      const mockConfig = `
providers:
  anthropic:
    api_key: sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
defaults:
  provider: anthropic
  model: claude-3-sonnet-20240229
`;
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      configLoader.load();
      const result = configLoader.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid API key format', () => {
      const mockConfig = `
providers:
  anthropic:
    api_key: invalid-key-format
`;
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      configLoader.load();
      const result = configLoader.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about missing default provider config', () => {
      const mockConfig = `
defaults:
  provider: openai
  model: gpt-4
providers:
  anthropic:
    api_key: sk-ant-test
`;
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockConfig);

      configLoader.load();
      const result = configLoader.validate();

      expect(result.warnings).toContainEqual(
        expect.stringContaining('openai')
      );
    });
  });
});
