/**
 * Skill Chain Tests
 *
 * Tests for SkillChain and SkillChainExecutor classes.
 * Validates sequential skill execution, config merging, and error handling.
 */

import { SkillChain, SkillChainExecutor, SkillChainResult, ExecutionStep } from '../../../../src/agents/builder/skill-chain';
import { SkillRegistry } from '../../../../src/skills/registry/skill-registry';
import { SkillMetadata } from '../../../../src/skills/types/skill';
import { Logger } from '../../../../src/utils/logger';
import { CompositionConfig } from '../../../../src/agents/types/composition';

// Mock skill registry
const createMockRegistry = () => {
  const skills = new Map<string, SkillMetadata>();

  return {
    getMetadata: (name: string) => skills.get(name),
    getMetadataByVersion: (name: string, version: string) =>
      skills.get(`${name}@${version}`),
    registerSkill: (metadata: SkillMetadata) => {
      skills.set(metadata.name, metadata);
      skills.set(`${metadata.name}@${metadata.version}`, metadata);
    },
  } as unknown as SkillRegistry;
};

// Mock skill executor that simulates skill execution
const createMockSkillExecutor = () => {
  return jest.fn().mockImplementation((skill: SkillMetadata, input: unknown, config: Record<string, unknown>) => {
    // Simulate skill transformation based on skill name
    const skillName = skill.name;

    if (skillName === 'error-skill') {
      throw new Error('Skill execution failed');
    }

    if (skillName === 'transform-skill') {
      return {
        transformed: true,
        input,
        config,
      };
    }

    if (skillName === 'extract-skill') {
      return {
        extracted: (input as any)?.content || input,
        filePath: '/path/to/file.txt',
      };
    }

    if (skillName === 'output-skill') {
      return {
        final: true,
        output: 'specific output',
      };
    }

    // Default pass-through
    return {
      ...((input as object) || {}),
      processed: skillName,
      config,
    };
  });
};

describe('SkillChain', () => {
  describe('constructor', () => {
    it('should store skill configs in order', () => {
      const skills = [
        { skillName: 'skill1', config: { key: 'value1' } },
        { skillName: 'skill2', config: { key: 'value2' } },
        { skillName: 'skill3' },
      ];

      const compositionConfig: CompositionConfig = {
        name: 'test-agent',
        description: 'Test agent',
        skills,
      };

      const chain = new SkillChain(skills, compositionConfig);

      expect(chain.getExecutionOrder()).toEqual(skills);
    });

    it('should handle empty skills array', () => {
      const compositionConfig: CompositionConfig = {
        name: 'test-agent',
        description: 'Test agent',
        skills: [],
      };

      const chain = new SkillChain([], compositionConfig);

      expect(chain.getExecutionOrder()).toEqual([]);
    });
  });

  describe('getExecutionOrder', () => {
    it('should return skills in the order they were added', () => {
      const skills = [
        { skillName: 'first' },
        { skillName: 'second' },
        { skillName: 'third' },
      ];

      const compositionConfig: CompositionConfig = {
        name: 'test-agent',
        description: 'Test agent',
        skills,
      };

      const chain = new SkillChain(skills, compositionConfig);
      const order = chain.getExecutionOrder();

      expect(order[0].skillName).toBe('first');
      expect(order[1].skillName).toBe('second');
      expect(order[2].skillName).toBe('third');
    });
  });
});

describe('SkillChainExecutor', () => {
  let mockRegistry: SkillRegistry;
  let mockLogger: Logger;
  let mockExecuteSkill: jest.Mock;

  beforeEach(() => {
    mockRegistry = createMockRegistry();
    mockLogger = new Logger('Test');
    mockExecuteSkill = createMockSkillExecutor();
  });

  describe('execute', () => {
    it('should run skills sequentially, passing output to next input', async () => {
      // Register mock skills
      (mockRegistry as any).registerSkill({
        name: 'skill1',
        version: '1.0.0',
      });
      (mockRegistry as any).registerSkill({
        name: 'skill2',
        version: '1.0.0',
      });

      const skills = [
        { skillName: 'skill1' },
        { skillName: 'skill2' },
      ];

      const compositionConfig: CompositionConfig = {
        name: 'test-agent',
        description: 'Test agent',
        skills,
      };

      const chain = new SkillChain(skills, compositionConfig);
      const executor = new SkillChainExecutor(
        chain,
        mockRegistry,
        mockLogger,
        mockExecuteSkill
      );

      const initialInput = { content: 'hello' };
      const result = await executor.execute(initialInput);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        content: 'hello',
        processed: 'skill2',
        config: {},
      });

      // Verify sequential execution
      expect(mockExecuteSkill).toHaveBeenCalledTimes(2);
      expect(mockExecuteSkill.mock.calls[0][1]).toEqual(initialInput);
      expect(mockExecuteSkill.mock.calls[1][1]).toMatchObject({
        content: 'hello',
        processed: 'skill1',
      });
    });

    it('should merge globalConfig with skill-specific config (skill config takes precedence)', async () => {
      (mockRegistry as any).registerSkill({
        name: 'transform-skill',
        version: '1.0.0',
      });

      const skills = [
        { skillName: 'transform-skill', config: { localKey: 'local', sharedKey: 'localValue' } },
      ];

      const compositionConfig: CompositionConfig = {
        name: 'test-agent',
        description: 'Test agent',
        skills,
        globalConfig: { globalKey: 'global', sharedKey: 'globalValue' },
      };

      const chain = new SkillChain(skills, compositionConfig);
      const executor = new SkillChainExecutor(
        chain,
        mockRegistry,
        mockLogger,
        mockExecuteSkill
      );

      const result = await executor.execute({});

      expect(result.success).toBe(true);
      // Skill config should take precedence for sharedKey
      expect(mockExecuteSkill).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          globalKey: 'global',
          localKey: 'local',
          sharedKey: 'localValue', // skill config wins
        })
      );
    });

    it('should stop on skill error and return error result', async () => {
      (mockRegistry as any).registerSkill({
        name: 'skill1',
        version: '1.0.0',
      });
      (mockRegistry as any).registerSkill({
        name: 'error-skill',
        version: '1.0.0',
      });
      (mockRegistry as any).registerSkill({
        name: 'skill3',
        version: '1.0.0',
      });

      const skills = [
        { skillName: 'skill1' },
        { skillName: 'error-skill' },
        { skillName: 'skill3' },
      ];

      const compositionConfig: CompositionConfig = {
        name: 'test-agent',
        description: 'Test agent',
        skills,
      };

      const chain = new SkillChain(skills, compositionConfig);
      const executor = new SkillChainExecutor(
        chain,
        mockRegistry,
        mockLogger,
        mockExecuteSkill
      );

      const result = await executor.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Skill execution failed');
      // Should only have executed first two skills
      expect(mockExecuteSkill).toHaveBeenCalledTimes(2);
    });

    it('should track execution context with skill names and intermediate outputs', async () => {
      (mockRegistry as any).registerSkill({
        name: 'skill1',
        version: '1.0.0',
      });
      (mockRegistry as any).registerSkill({
        name: 'skill2',
        version: '1.0.0',
      });

      const skills = [
        { skillName: 'skill1' },
        { skillName: 'skill2' },
      ];

      const compositionConfig: CompositionConfig = {
        name: 'test-agent',
        description: 'Test agent',
        skills,
      };

      const chain = new SkillChain(skills, compositionConfig);
      const executor = new SkillChainExecutor(
        chain,
        mockRegistry,
        mockLogger,
        mockExecuteSkill
      );

      const result = await executor.execute({ content: 'test' });

      expect(result.success).toBe(true);
      expect(result.trace).toHaveLength(2);
      expect(result.trace[0]).toMatchObject({
        skill: 'skill1',
        input: { content: 'test' },
      });
      expect(result.trace[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(result.trace[1]).toMatchObject({
        skill: 'skill2',
      });
      expect(result.trace[1].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should return specified skill output when outputSkill is set', async () => {
      (mockRegistry as any).registerSkill({
        name: 'extract-skill',
        version: '1.0.0',
      });
      (mockRegistry as any).registerSkill({
        name: 'output-skill',
        version: '1.0.0',
      });

      const skills = [
        { skillName: 'extract-skill' },
        { skillName: 'output-skill' },
      ];

      const compositionConfig: CompositionConfig = {
        name: 'test-agent',
        description: 'Test agent',
        skills,
        outputSkill: 'extract-skill',
      };

      const chain = new SkillChain(skills, compositionConfig);
      const executor = new SkillChainExecutor(
        chain,
        mockRegistry,
        mockLogger,
        mockExecuteSkill
      );

      const result = await executor.execute({ content: 'data' });

      expect(result.success).toBe(true);
      // Should return extract-skill output, not output-skill
      // The mock returns extracted: input.content (which is 'data') for extract-skill
      expect(result.output).toEqual({
        extracted: 'data',
        filePath: '/path/to/file.txt',
      });
    });

    it('should resolve skill with version if specified', async () => {
      (mockRegistry as any).registerSkill({
        name: 'versioned-skill',
        version: '2.0.0',
      });

      const skills = [
        { skillName: 'versioned-skill', version: '2.0.0' },
      ];

      const compositionConfig: CompositionConfig = {
        name: 'test-agent',
        description: 'Test agent',
        skills,
      };

      const chain = new SkillChain(skills, compositionConfig);
      const executor = new SkillChainExecutor(
        chain,
        mockRegistry,
        mockLogger,
        mockExecuteSkill
      );

      const result = await executor.execute({});

      expect(result.success).toBe(true);
      expect(mockExecuteSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'versioned-skill',
          version: '2.0.0',
        }),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle skill not found error', async () => {
      const skills = [
        { skillName: 'nonexistent-skill' },
      ];

      const compositionConfig: CompositionConfig = {
        name: 'test-agent',
        description: 'Test agent',
        skills,
      };

      const chain = new SkillChain(skills, compositionConfig);
      const executor = new SkillChainExecutor(
        chain,
        mockRegistry,
        mockLogger,
        mockExecuteSkill
      );

      const result = await executor.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle empty skills array', async () => {
      const compositionConfig: CompositionConfig = {
        name: 'test-agent',
        description: 'Test agent',
        skills: [],
      };

      const chain = new SkillChain([], compositionConfig);
      const executor = new SkillChainExecutor(
        chain,
        mockRegistry,
        mockLogger,
        mockExecuteSkill
      );

      const result = await executor.execute({ content: 'test' });

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ content: 'test' });
      expect(result.trace).toEqual([]);
    });
  });
});
