/**
 * AgentBuilder unit tests
 *
 * Tests for the fluent API builder for composing skills into agents.
 */

import { AgentBuilder } from '../../../../src/agents/builder/agent-builder';
import { SkillRegistry } from '../../../../src/skills/registry/skill-registry';
import { SkillMetadata } from '../../../../src/skills/types/skill';
import { CompositionConfig } from '../../../../src/agents/types/composition';

// Mock SkillRegistry
jest.mock('../../../../src/skills/registry/skill-registry');

describe('AgentBuilder', () => {
  let mockRegistry: jest.Mocked<SkillRegistry>;
  let builder: AgentBuilder;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRegistry = new SkillRegistry({} as any) as jest.Mocked<SkillRegistry>;
    builder = new AgentBuilder(mockRegistry);
  });

  describe('fluent chaining', () => {
    it('chains fluently (each method returns this)', () => {
      const result = builder
        .withName('test-agent')
        .withDescription('Test description')
        .use('skill-a');

      expect(result).toBe(builder);
    });

    it('supports chaining multiple use() calls', () => {
      const mockSkillA: SkillMetadata = {
        name: 'skill-a',
        description: 'Skill A',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        schema: {
          input: { type: 'object', properties: {} },
          output: { type: 'object', properties: { result: { type: 'string' } } },
        },
      };

      const mockSkillB: SkillMetadata = {
        name: 'skill-b',
        description: 'Skill B',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        schema: {
          input: { type: 'object', properties: { result: { type: 'string' } } },
          output: { type: 'object', properties: {} },
        },
      };

      mockRegistry.getMetadata.mockImplementation((name: string) => {
        if (name === 'skill-a') return mockSkillA;
        if (name === 'skill-b') return mockSkillB;
        return undefined;
      });

      const result = builder
        .withName('test-agent')
        .withDescription('Test agent')
        .use('skill-a')
        .use('skill-b');

      expect(result).toBe(builder);
    });
  });

  describe('build() validation', () => {
    it('throws if name not provided', async () => {
      builder.withDescription('Test agent').use('skill-a');

      await expect(builder.build()).rejects.toThrow('name');
    });

    it('throws if no skills added', async () => {
      builder.withName('test-agent').withDescription('Test agent');

      await expect(builder.build()).rejects.toThrow('skills');
    });

    it('throws if skill not found in registry', async () => {
      mockRegistry.getMetadata.mockReturnValue(undefined);

      builder.withName('test-agent').withDescription('Test agent').use('unknown-skill');

      await expect(builder.build()).rejects.toThrow('not found');
    });

    it('throws if skill chain validation fails', async () => {
      const mockSkillA: SkillMetadata = {
        name: 'skill-a',
        description: 'Skill A',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        schema: {
          input: { type: 'object', properties: {} },
          output: { type: 'object', properties: { result: { type: 'string' } } },
        },
      };

      const mockSkillB: SkillMetadata = {
        name: 'skill-b',
        description: 'Skill B',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        schema: {
          input: {
            type: 'object',
            properties: { requiredField: { type: 'number' } },
            required: ['requiredField'],
          },
          output: { type: 'object', properties: {} },
        },
      };

      mockRegistry.getMetadata.mockImplementation((name: string) => {
        if (name === 'skill-a') return mockSkillA;
        if (name === 'skill-b') return mockSkillB;
        return undefined;
      });

      builder.withName('test-agent').withDescription('Test agent').use('skill-a').use('skill-b');

      await expect(builder.build()).rejects.toThrow('validation');
    });

    it('returns CompositionConfig with all properties set', async () => {
      const mockSkill: SkillMetadata = {
        name: 'test-skill',
        description: 'Test Skill',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        schema: {
          input: { type: 'object', properties: {} },
          output: { type: 'object', properties: {} },
        },
      };

      mockRegistry.getMetadata.mockReturnValue(mockSkill);

      const config: CompositionConfig = await builder
        .withName('test-agent')
        .withDescription('Test agent description')
        .use('test-skill', { customConfig: true })
        .withOutput('test-skill')
        .withGlobalConfig({ global: 'value' })
        .build();

      expect(config).toEqual({
        name: 'test-agent',
        description: 'Test agent description',
        skills: [
          {
            skillName: 'test-skill',
            config: { customConfig: true, global: 'value' },
          },
        ],
        outputSkill: 'test-skill',
        globalConfig: { global: 'value' },
      });
    });
  });

  describe('useVersion()', () => {
    it('pins specific skill version', async () => {
      const mockSkillV1: SkillMetadata = {
        name: 'test-skill',
        description: 'Test Skill v1',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        schema: {
          input: { type: 'object', properties: {} },
          output: { type: 'object', properties: {} },
        },
      };

      mockRegistry.getMetadataByVersion.mockReturnValue(mockSkillV1);

      const config: CompositionConfig = await builder
        .withName('test-agent')
        .withDescription('Test agent')
        .useVersion('test-skill', '1.0.0', { versioned: true })
        .build();

      expect(config.skills[0]).toEqual({
        skillName: 'test-skill',
        version: '1.0.0',
        config: { versioned: true },
      });
      expect(mockRegistry.getMetadataByVersion).toHaveBeenCalledWith('test-skill', '1.0.0');
    });

    it('throws if versioned skill not found', async () => {
      mockRegistry.getMetadataByVersion.mockReturnValue(undefined);

      builder.withName('test-agent').withDescription('Test agent').useVersion('test-skill', '2.0.0');

      await expect(builder.build()).rejects.toThrow('not found');
    });
  });

  describe('withGlobalConfig()', () => {
    it('merges with skill-specific configs', async () => {
      const mockSkill: SkillMetadata = {
        name: 'test-skill',
        description: 'Test Skill',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        schema: {
          input: { type: 'object', properties: {} },
          output: { type: 'object', properties: {} },
        },
      };

      mockRegistry.getMetadata.mockReturnValue(mockSkill);

      const config: CompositionConfig = await builder
        .withName('test-agent')
        .withDescription('Test agent')
        .withGlobalConfig({ shared: 'global', override: 'global' })
        .use('test-skill', { override: 'local', local: 'value' })
        .build();

      // Skill config should override global config
      expect(config.skills[0].config).toEqual({
        shared: 'global',
        override: 'local',
        local: 'value',
      });
    });
  });

  describe('complex chains', () => {
    it('handles 3+ skills chained together', async () => {
      const mockSkillA: SkillMetadata = {
        name: 'skill-a',
        description: 'Skill A',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        schema: {
          input: { type: 'object', properties: {} },
          output: {
            type: 'object',
            properties: { intermediate1: { type: 'string' } },
            required: ['intermediate1'],
          },
        },
      };

      const mockSkillB: SkillMetadata = {
        name: 'skill-b',
        description: 'Skill B',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        schema: {
          input: {
            type: 'object',
            properties: { intermediate1: { type: 'string' } },
            required: ['intermediate1'],
          },
          output: {
            type: 'object',
            properties: { intermediate2: { type: 'number' } },
            required: ['intermediate2'],
          },
        },
      };

      const mockSkillC: SkillMetadata = {
        name: 'skill-c',
        description: 'Skill C',
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        schema: {
          input: {
            type: 'object',
            properties: { intermediate2: { type: 'number' } },
            required: ['intermediate2'],
          },
          output: { type: 'object', properties: {} },
        },
      };

      mockRegistry.getMetadata.mockImplementation((name: string) => {
        if (name === 'skill-a') return mockSkillA;
        if (name === 'skill-b') return mockSkillB;
        if (name === 'skill-c') return mockSkillC;
        return undefined;
      });

      const config: CompositionConfig = await builder
        .withName('pipeline-agent')
        .withDescription('Three skill pipeline')
        .use('skill-a')
        .use('skill-b')
        .use('skill-c')
        .build();

      expect(config.skills).toHaveLength(3);
      expect(config.skills[0].skillName).toBe('skill-a');
      expect(config.skills[1].skillName).toBe('skill-b');
      expect(config.skills[2].skillName).toBe('skill-c');
    });
  });
});
