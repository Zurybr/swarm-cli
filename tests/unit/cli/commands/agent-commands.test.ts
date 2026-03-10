/**
 * Agent CLI Commands Unit Tests
 *
 * Tests for agent command-line interface:
 * - registerAgentCommands adds 'agent' subcommand to program
 * - 'agent build' with valid skills succeeds and outputs success message
 * - 'agent build' with incompatible skills fails with validation error
 * - 'agent build' with missing skill name fails with error
 * - 'agent build --json' outputs agent config as JSON
 * - 'agent build' with --config file loads skill configs from JSON
 */

import { Command } from 'commander';
import sqlite3 from 'sqlite3';
import { SkillRegistry } from '../../../../src/skills';
import { registerAgentCommands } from '../../../../src/cli/commands/agent-commands';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

describe('Agent CLI Commands', () => {
  let db: sqlite3.Database;
  let registry: SkillRegistry;
  let program: Command;

  beforeEach(async () => {
    // Create in-memory database for each test
    db = new sqlite3.Database(':memory:');
    registry = new SkillRegistry(db);
    await registry.initialize();

    // Create a new program instance
    program = new Command();

    // Register agent commands
    registerAgentCommands(program, registry);

    // Clear mocks
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('registerAgentCommands', () => {
    it('should add agent subcommand to program', () => {
      const commands = program.commands.map(cmd => cmd.name());
      expect(commands).toContain('agent');
    });

    it('should have build subcommand', () => {
      const agentCmd = program.commands.find(cmd => cmd.name() === 'agent');
      expect(agentCmd).toBeDefined();

      const subcommands = agentCmd!.commands.map(cmd => cmd.name());
      expect(subcommands).toContain('build');
    });
  });

  describe('agent build command', () => {
    it('should succeed with valid skills', async () => {
      // Register test skills with compatible schemas
      await registry.register({
        name: 'text-processor',
        description: 'Processes text input',
        version: '1.0.0',
        category: 'general',
        schema: {
          input: {
            type: 'object',
            properties: { content: { type: 'string' } },
            required: ['content'],
          },
          output: {
            type: 'object',
            properties: { result: { type: 'string' } },
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await registry.register({
        name: 'text-formatter',
        description: 'Formats text output',
        version: '1.0.0',
        category: 'general',
        schema: {
          input: {
            type: 'object',
            properties: { result: { type: 'string' } },
          },
          output: {
            type: 'object',
            properties: { formatted: { type: 'string' } },
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Get the build command action
      const agentCmd = program.commands.find(cmd => cmd.name() === 'agent');
      const buildCmd = agentCmd!.commands.find(cmd => cmd.name() === 'build');

      // Parse and execute the command
      await buildCmd!.parseAsync([
        'node',
        'test',
        '--name',
        'test-agent',
        '--skills',
        'text-processor,text-formatter',
        '--description',
        'Test agent',
      ]);

      // Verify success output (find the success message among all console.log calls)
      expect(mockConsoleLog).toHaveBeenCalled();
      const successCall = mockConsoleLog.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('Successfully built agent')
      );
      expect(successCall).toBeDefined();
      expect(successCall![0]).toContain('test-agent');
    });

    it('should fail with validation error for incompatible skills', async () => {
      // Register skills with incompatible schemas
      await registry.register({
        name: 'number-generator',
        description: 'Generates numbers',
        version: '1.0.0',
        category: 'general',
        schema: {
          input: {
            type: 'object',
            properties: { count: { type: 'number' } },
          },
          output: {
            type: 'object',
            properties: { value: { type: 'number' } },
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await registry.register({
        name: 'text-processor',
        description: 'Processes text input',
        version: '1.0.0',
        category: 'general',
        schema: {
          input: {
            type: 'object',
            properties: { content: { type: 'string' } },
            required: ['content'],
          },
          output: {
            type: 'object',
            properties: { result: { type: 'string' } },
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const agentCmd = program.commands.find(cmd => cmd.name() === 'agent');
      const buildCmd = agentCmd!.commands.find(cmd => cmd.name() === 'build');

      await buildCmd!.parseAsync([
        'node',
        'test',
        '--name',
        'incompatible-agent',
        '--skills',
        'number-generator,text-processor',
      ]);

      // Verify error output
      expect(mockConsoleError).toHaveBeenCalled();
      const errorOutput = mockConsoleError.mock.calls[0][0];
      expect(errorOutput).toContain('Failed to build agent');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should fail with error for missing skill', async () => {
      const agentCmd = program.commands.find(cmd => cmd.name() === 'agent');
      const buildCmd = agentCmd!.commands.find(cmd => cmd.name() === 'build');

      await buildCmd!.parseAsync([
        'node',
        'test',
        '--name',
        'missing-skill-agent',
        '--skills',
        'non-existent-skill',
      ]);

      // Verify error output
      expect(mockConsoleError).toHaveBeenCalled();
      const errorOutput = mockConsoleError.mock.calls[0][0];
      expect(errorOutput).toContain('Failed to build agent');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should output JSON when --json flag is used', async () => {
      await registry.register({
        name: 'simple-skill',
        description: 'A simple skill',
        version: '1.0.0',
        category: 'general',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const agentCmd = program.commands.find(cmd => cmd.name() === 'agent');
      const buildCmd = agentCmd!.commands.find(cmd => cmd.name() === 'build');

      await buildCmd!.parseAsync([
        'node',
        'test',
        '--name',
        'json-agent',
        '--skills',
        'simple-skill',
        '--json',
      ]);

      // Verify JSON output (find the JSON call among all console.log calls)
      expect(mockConsoleLog).toHaveBeenCalled();
      const jsonCall = mockConsoleLog.mock.calls.find(call => {
        try {
          const parsed = JSON.parse(call[0]);
          return parsed.name === 'json-agent';
        } catch {
          return false;
        }
      });
      expect(jsonCall).toBeDefined();
      const parsed = JSON.parse(jsonCall![0]);
      expect(parsed.skills).toBeDefined();
    });

    it('should load skill configs from JSON file with --config', async () => {
      await registry.register({
        name: 'configurable-skill',
        description: 'A configurable skill',
        version: '1.0.0',
        category: 'general',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create a temporary config file
      const fs = require('fs');
      const tmpDir = require('os').tmpdir();
      const configPath = `${tmpDir}/test-skill-config.json`;
      fs.writeFileSync(configPath, JSON.stringify({
        configurableSkill: { option1: 'value1', option2: 42 }
      }));

      try {
        const agentCmd = program.commands.find(cmd => cmd.name() === 'agent');
        const buildCmd = agentCmd!.commands.find(cmd => cmd.name() === 'build');

        await buildCmd!.parseAsync([
          'node',
          'test',
          '--name',
          'config-agent',
          '--skills',
          'configurable-skill',
          '--config',
          configPath,
        ]);

        // Verify success (find the success message among all console.log calls)
        expect(mockConsoleLog).toHaveBeenCalled();
        const successCall = mockConsoleLog.mock.calls.find(call =>
          typeof call[0] === 'string' && call[0].includes('Successfully built agent')
        );
        expect(successCall).toBeDefined();
      } finally {
        // Cleanup
        fs.unlinkSync(configPath);
      }
    });
  });
});
