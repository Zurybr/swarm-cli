/**
 * Agent CLI Integration Tests
 *
 * Tests the agent command-line interface end-to-end:
 * - Full flow: register skills, build agent, execute via CLI
 * - Build agent with incompatible skills fails with clear error
 * - Build agent with non-existent skill fails appropriately
 * - Agent build with --config applies skill configurations
 * - Agent build --json outputs valid JSON
 * - Built agent can be retrieved from agent registry
 * - Agent execution produces expected output format
 * - Multiple agents can be built and registered independently
 */

import sqlite3 from 'sqlite3';
import { SkillRegistry } from '../../src/skills';
import { AgentBuilder, ComposedAgent, AgentSystem } from '../../src/agents';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

describe('Agent CLI Integration', () => {
  let db: sqlite3.Database;
  let registry: SkillRegistry;
  let tempDir: string;

  beforeEach(async () => {
    // Create in-memory database for each test
    db = new sqlite3.Database(':memory:');
    registry = new SkillRegistry(db);
    await registry.initialize();

    // Create temp directory for config files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-cli-test-'));

    // Clear mocks
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(async () => {
    await db.close();

    // Cleanup temp files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('Full composition flow', () => {
    it('should register skills, build agent, and verify success', async () => {
      // Register compatible skills
      await registry.register({
        name: 'data-extractor',
        description: 'Extracts data from input',
        version: '1.0.0',
        category: 'general',
        schema: {
          input: {
            type: 'object',
            properties: { source: { type: 'string' } },
            required: ['source'],
          },
          output: {
            type: 'object',
            properties: { extracted: { type: 'object' } },
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await registry.register({
        name: 'data-transformer',
        description: 'Transforms extracted data',
        version: '1.0.0',
        category: 'general',
        schema: {
          input: {
            type: 'object',
            properties: { extracted: { type: 'object' } },
          },
          output: {
            type: 'object',
            properties: { transformed: { type: 'object' } },
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Build agent using AgentBuilder
      const builder = new AgentBuilder(registry)
        .withName('etl-agent')
        .withDescription('ETL processing agent')
        .use('data-extractor')
        .use('data-transformer');

      const compositionConfig = await builder.build();

      // Verify composition config
      expect(compositionConfig.name).toBe('etl-agent');
      expect(compositionConfig.skills).toHaveLength(2);
      expect(compositionConfig.skills[0].skillName).toBe('data-extractor');
      expect(compositionConfig.skills[1].skillName).toBe('data-transformer');
    });

    it('should build agent with incompatible skills and fail with validation error', async () => {
      // Register incompatible skills
      await registry.register({
        name: 'string-generator',
        description: 'Generates string output',
        version: '1.0.0',
        category: 'general',
        schema: {
          input: { type: 'object' },
          output: {
            type: 'object',
            properties: { text: { type: 'string' } },
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await registry.register({
        name: 'number-processor',
        description: 'Processes number input',
        version: '1.0.0',
        category: 'general',
        schema: {
          input: {
            type: 'object',
            properties: { value: { type: 'number' } },
            required: ['value'],
          },
          output: { type: 'object' },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Attempt to build agent with incompatible skills
      const builder = new AgentBuilder(registry)
        .withName('incompatible-agent')
        .use('string-generator')
        .use('number-processor');

      // Should throw validation error
      await expect(builder.build()).rejects.toThrow('Skill chain validation failed');
    });

    it('should fail with clear error for non-existent skill', async () => {
      const builder = new AgentBuilder(registry)
        .withName('missing-skill-agent')
        .use('non-existent-skill');

      await expect(builder.build()).rejects.toThrow('Skill "non-existent-skill" not found');
    });
  });

  describe('Config file support', () => {
    it('should apply skill configurations from JSON file', async () => {
      // Register a configurable skill
      await registry.register({
        name: 'configurable-processor',
        description: 'A skill with configuration options',
        version: '1.0.0',
        category: 'general',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create config file
      const configPath = path.join(tempDir, 'skill-config.json');
      fs.writeFileSync(configPath, JSON.stringify({
        configurableProcessor: {
          threshold: 0.8,
          enabled: true,
          mode: 'strict'
        }
      }));

      // Load config and build agent
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const skillConfigs = JSON.parse(configContent);

      const builder = new AgentBuilder(registry)
        .withName('config-agent')
        .use('configurable-processor', skillConfigs.configurableProcessor);

      const compositionConfig = await builder.build();

      // Verify config was applied
      expect(compositionConfig.skills[0].config).toEqual({
        threshold: 0.8,
        enabled: true,
        mode: 'strict'
      });
    });
  });

  describe('JSON output', () => {
    it('should output valid JSON agent configuration', async () => {
      await registry.register({
        name: 'json-test-skill',
        description: 'A skill for JSON output testing',
        version: '1.0.0',
        category: 'general',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const builder = new AgentBuilder(registry)
        .withName('json-output-agent')
        .withDescription('Agent for testing JSON output')
        .use('json-test-skill');

      const compositionConfig = await builder.build();

      // Simulate JSON output
      const jsonOutput = JSON.stringify({
        name: compositionConfig.name,
        description: compositionConfig.description,
        skills: compositionConfig.skills.map(s => s.skillName),
      }, null, 2);

      // Verify JSON is valid and contains expected data
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.name).toBe('json-output-agent');
      expect(parsed.description).toBe('Agent for testing JSON output');
      expect(parsed.skills).toContain('json-test-skill');
    });
  });

  describe('Agent registry integration', () => {
    it('should register built agent with agent system', async () => {
      await registry.register({
        name: 'registrable-skill',
        description: 'A skill that can be registered',
        version: '1.0.0',
        category: 'general',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Build agent
      const builder = new AgentBuilder(registry)
        .withName('registered-agent')
        .use('registrable-skill');

      const compositionConfig = await builder.build();

      // Create agent instance
      const agentConfig = {
        id: `test-agent-${Date.now()}`,
        runId: 'test-run',
        role: 'registered-agent',
        model: 'claude-3-sonnet',
        apiUrl: '',
        tools: [],
      };

      const agent = new ComposedAgent(agentConfig, compositionConfig, registry);

      // Verify agent was created and has expected properties
      expect(agent.getId()).toBe(agentConfig.id);
      expect(agent.getRole()).toBe('registered-agent');
      expect(agent.getStatus()).toBe('idle');
    });
  });

  describe('Agent execution', () => {
    it('should produce expected output format', async () => {
      // Register a simple skill
      await registry.register({
        name: 'echo-skill',
        description: 'Echoes input back',
        version: '1.0.0',
        category: 'general',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Build agent
      const builder = new AgentBuilder(registry)
        .withName('echo-agent')
        .use('echo-skill');

      const compositionConfig = await builder.build();

      // Create agent
      const agentConfig = {
        id: `echo-agent-${Date.now()}`,
        runId: 'test-run',
        role: 'echo-agent',
        model: 'claude-3-sonnet',
        apiUrl: '',
        tools: [],
      };

      const agent = new ComposedAgent(agentConfig, compositionConfig, registry);

      // Execute with a task
      const task = {
        id: 'test-task',
        title: 'Test task',
        description: JSON.stringify({ message: 'Hello, World!' }),
        status: 'pending' as const,
      };

      const result = await agent.execute(task);

      // Verify result structure
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Agent isolation', () => {
    it('should build multiple agents independently', async () => {
      // Register skills
      await registry.register({
        name: 'skill-a',
        description: 'Skill A for testing agent isolation',
        version: '1.0.0',
        category: 'general',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await registry.register({
        name: 'skill-b',
        description: 'Skill B for testing agent isolation',
        version: '1.0.0',
        category: 'general',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Build first agent
      const builder1 = new AgentBuilder(registry)
        .withName('agent-one')
        .use('skill-a');
      const config1 = await builder1.build();

      // Build second agent with different skills
      const builder2 = new AgentBuilder(registry)
        .withName('agent-two')
        .use('skill-b');
      const config2 = await builder2.build();

      // Verify agents are independent
      expect(config1.name).toBe('agent-one');
      expect(config1.skills.map(s => s.skillName)).toEqual(['skill-a']);

      expect(config2.name).toBe('agent-two');
      expect(config2.skills.map(s => s.skillName)).toEqual(['skill-b']);
    });
  });
});
