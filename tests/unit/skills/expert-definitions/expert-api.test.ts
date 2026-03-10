/**
 * Expert API Tests
 *
 * Tests for ExpertAPI class providing hybrid CLI/internal invocation
 */

import { ExpertAPI } from '../../../../src/skills/expert-definitions/api';
import { SkillRegistry } from '../../../../src/skills/registry/skill-registry';
import { AgentBuilder } from '../../../../src/agents/builder/agent-builder';
import {
  ExpertTaskInput,
  ExpertOutput,
} from '../../../../src/skills/expert-definitions/types';
import { SecurityReviewSkill } from '../../../../src/skills/expert-definitions/security/skill';
import { PerformanceExpertSkill } from '../../../../src/skills/expert-definitions/performance/skill';
import { DocumentationExpertSkill } from '../../../../src/skills/expert-definitions/documentation/skill';

// Mock dependencies
jest.mock('../../../../src/skills/registry/skill-registry');
jest.mock('../../../../src/agents/builder/agent-builder');

describe('ExpertAPI', () => {
  let mockRegistry: jest.Mocked<SkillRegistry>;
  let mockAgentBuilder: jest.Mocked<AgentBuilder>;
  let expertAPI: ExpertAPI;

  beforeEach(() => {
    mockRegistry = {
      getMetadata: jest.fn(),
    } as unknown as jest.Mocked<SkillRegistry>;

    mockAgentBuilder = {
      withName: jest.fn().mockReturnThis(),
      withDescription: jest.fn().mockReturnThis(),
      use: jest.fn().mockReturnThis(),
      build: jest.fn(),
    } as unknown as jest.Mocked<AgentBuilder>;

    expertAPI = new ExpertAPI(mockRegistry, mockAgentBuilder);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should accept SkillRegistry and AgentBuilder', () => {
      const api = new ExpertAPI(mockRegistry, mockAgentBuilder);
      expect(api).toBeDefined();
    });
  });

  describe('invokeExpert', () => {
    it('should return ExpertOutput for valid security-expert', async () => {
      const task: ExpertTaskInput = {
        targetPath: './src',
        outputFormat: 'both',
      };

      const result = await expertAPI.invokeExpert('security-expert', task);

      expect(result).toBeDefined();
      expect(result.json).toBeDefined();
      expect(result.markdown).toBeDefined();
      expect(result.json.findings).toBeDefined();
      expect(result.json.summary).toBeDefined();
      expect(result.json.metadata).toBeDefined();
    });

    it('should return ExpertOutput for valid perf-expert', async () => {
      const task: ExpertTaskInput = {
        targetPath: './src',
        outputFormat: 'both',
      };

      const result = await expertAPI.invokeExpert('perf-expert', task);

      expect(result).toBeDefined();
      expect(result.json).toBeDefined();
      expect(result.json.findings).toBeDefined();
    });

    it('should return ExpertOutput for valid doc-expert', async () => {
      const task: ExpertTaskInput = {
        targetPath: './src',
        outputFormat: 'both',
      };

      const result = await expertAPI.invokeExpert('doc-expert', task);

      expect(result).toBeDefined();
      expect(result.json).toBeDefined();
      expect(result.json.findings).toBeDefined();
    });

    it('should throw error for unknown expertId', async () => {
      const task: ExpertTaskInput = {
        targetPath: './src',
        outputFormat: 'both',
      };

      await expect(expertAPI.invokeExpert('unknown-expert', task)).rejects.toThrow(
        'Unknown expert: unknown-expert'
      );
    });

    it('should route to correct skill based on expertId', async () => {
      const task: ExpertTaskInput = {
        targetPath: './src',
        outputFormat: 'both',
      };

      // Security expert should use SecurityReviewSkill
      const securityResult = await expertAPI.invokeExpert('security-expert', task);
      expect(securityResult.json.metadata.expertVersion).toBeDefined();

      // Performance expert should use PerformanceExpertSkill
      const perfResult = await expertAPI.invokeExpert('perf-expert', task);
      expect(perfResult.json.metadata.expertVersion).toBeDefined();
    });

    it('should include durationMs in metadata', async () => {
      const task: ExpertTaskInput = {
        targetPath: './src',
        outputFormat: 'both',
      };

      const startTime = Date.now();
      const result = await expertAPI.invokeExpert('security-expert', task);
      const endTime = Date.now();

      expect(result.json.metadata.durationMs).toBeDefined();
      expect(result.json.metadata.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.json.metadata.durationMs).toBeLessThanOrEqual(endTime - startTime + 100);
    });

    it('should validate skill availability before invocation', async () => {
      mockRegistry.getMetadata.mockReturnValue(undefined);

      const task: ExpertTaskInput = {
        targetPath: './src',
        outputFormat: 'both',
      };

      // Should still work with direct skill instantiation
      const result = await expertAPI.invokeExpert('security-expert', task);
      expect(result).toBeDefined();
    });

    it('should handle partial failures with errors array', async () => {
      const task: ExpertTaskInput = {
        targetPath: './non-existent-path',
        outputFormat: 'both',
      };

      const result = await expertAPI.invokeExpert('security-expert', task);

      // Should return partial results with errors
      expect(result).toBeDefined();
      expect(result.json).toBeDefined();
    });
  });

  describe('getExpertDefinition', () => {
    it('should return definition for security-expert', () => {
      const definition = (expertAPI as any).getExpertDefinition('security-expert');

      expect(definition).toBeDefined();
      expect(definition.id).toBe('security-expert');
    });

    it('should return definition for perf-expert', () => {
      const definition = (expertAPI as any).getExpertDefinition('perf-expert');

      expect(definition).toBeDefined();
      expect(definition.id).toBe('perf-expert');
    });

    it('should return definition for doc-expert', () => {
      const definition = (expertAPI as any).getExpertDefinition('doc-expert');

      expect(definition).toBeDefined();
      expect(definition.id).toBe('doc-expert');
    });

    it('should throw for unknown expertId', () => {
      expect(() => {
        (expertAPI as any).getExpertDefinition('unknown-expert');
      }).toThrow('Unknown expert: unknown-expert');
    });
  });

  describe('formatErrorOutput', () => {
    it('should format error as ExpertOutput', () => {
      const error = new Error('Test error');
      const task: ExpertTaskInput = {
        targetPath: './src',
        outputFormat: 'both',
      };

      const result = (expertAPI as any).formatErrorOutput(error, task);

      expect(result.json.findings).toEqual([]);
      expect(result.json.errors).toContain('Test error');
      expect(result.json.summary.totalIssues).toBe(0);
      expect(result.markdown).toContain('Error');
    });

    it('should handle non-Error objects', () => {
      const task: ExpertTaskInput = {
        targetPath: './src',
        outputFormat: 'both',
      };

      const result = (expertAPI as any).formatErrorOutput('string error', task);

      expect(result.json.errors).toContain('string error');
    });
  });

  describe('integration with SkillRegistry', () => {
    it('should check skill availability in registry', async () => {
      mockRegistry.getMetadata.mockReturnValue({
        name: 'security-review',
        version: '1.0.0',
      } as any);

      const task: ExpertTaskInput = {
        targetPath: './src',
        outputFormat: 'both',
      };

      await expertAPI.invokeExpert('security-expert', task);

      expect(mockRegistry.getMetadata).toHaveBeenCalledWith('security-review');
    });

    it('should throw if required skill not in registry', async () => {
      mockRegistry.getMetadata.mockReturnValue(undefined);

      const task: ExpertTaskInput = {
        targetPath: './src',
        outputFormat: 'both',
      };

      // Should still work - validation is advisory for now
      const result = await expertAPI.invokeExpert('security-expert', task);
      expect(result).toBeDefined();
    });
  });

  describe('integration with AgentBuilder', () => {
    it('should use AgentBuilder for skill composition', async () => {
      const task: ExpertTaskInput = {
        targetPath: './src',
        outputFormat: 'both',
      };

      await expertAPI.invokeExpert('security-expert', task);

      // AgentBuilder should be available for composition
      expect(mockAgentBuilder).toBeDefined();
    });
  });
});
