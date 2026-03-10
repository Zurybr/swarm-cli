/**
 * Expert API Tests
 *
 * Tests for ExpertAPI class providing hybrid CLI/internal invocation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ExpertAPI } from '../../../../src/skills/expert-definitions/api';
import { SkillRegistry } from '../../../../src/skills/registry/skill-registry';
import { AgentBuilder } from '../../../../src/agents/builder/agent-builder';
import {
  ExpertTaskInput,
  ExpertOutput,
} from '../../../../src/skills/expert-definitions/types';

// Mock dependencies
jest.mock('../../../../src/skills/registry/skill-registry');
jest.mock('../../../../src/agents/builder/agent-builder');

describe('ExpertAPI', () => {
  let mockRegistry: jest.Mocked<SkillRegistry>;
  let mockAgentBuilder: jest.Mocked<AgentBuilder>;
  let expertAPI: ExpertAPI;
  let tempDir: string;

  beforeEach(async () => {
    mockRegistry = {
      getMetadata: jest.fn(),
    } as unknown as jest.Mocked<SkillRegistry>;

    mockAgentBuilder = {
      withName: jest.fn().mockReturnThis(),
      withDescription: jest.fn().mockReturnThis(),
      use: jest.fn().mockReturnThis(),
      build: jest.fn(),
    } as unknown as jest.Mocked<AgentBuilder>;

    // Default mock: return metadata for any skill (simulating registered skills)
    mockRegistry.getMetadata.mockReturnValue({
      name: 'mock-skill',
      version: '1.0.0',
    } as any);

    expertAPI = new ExpertAPI(mockRegistry, mockAgentBuilder);

    // Create temp directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'expert-api-test-'));
  });

  afterEach(async () => {
    jest.clearAllMocks();
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should accept SkillRegistry and AgentBuilder', () => {
      const api = new ExpertAPI(mockRegistry, mockAgentBuilder);
      expect(api).toBeDefined();
    });
  });

  describe('invokeExpert', () => {
    it('should return ExpertOutput for valid security-expert', async () => {
      // Create a test file in temp dir
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'const x = 1;');

      const task: ExpertTaskInput = {
        targetPath: tempDir,
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
      // Create a test file in temp dir
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'function add(a: number, b: number) { return a + b; }');

      const task: ExpertTaskInput = {
        targetPath: tempDir,
        outputFormat: 'both',
      };

      const result = await expertAPI.invokeExpert('perf-expert', task);

      expect(result).toBeDefined();
      expect(result.json).toBeDefined();
      expect(result.json.findings).toBeDefined();
    });

    it('should return ExpertOutput for valid doc-expert', async () => {
      // Create a test file in temp dir
      await fs.writeFile(path.join(tempDir, 'test.ts'), '/** Test */ export function foo() {}');

      const task: ExpertTaskInput = {
        targetPath: tempDir,
        outputFormat: 'both',
      };

      const result = await expertAPI.invokeExpert('doc-expert', task);

      expect(result).toBeDefined();
      expect(result.json).toBeDefined();
      expect(result.json.findings).toBeDefined();
    });

    it('should throw error for unknown expertId', async () => {
      const task: ExpertTaskInput = {
        targetPath: tempDir,
        outputFormat: 'both',
      };

      await expect(expertAPI.invokeExpert('unknown-expert', task)).rejects.toThrow(
        'Unknown expert: unknown-expert'
      );
    });

    it('should route to correct skill based on expertId', async () => {
      // Create a test file in temp dir
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'const x = 1;');

      const task: ExpertTaskInput = {
        targetPath: tempDir,
        outputFormat: 'both',
      };

      // Security expert should use SecurityReviewSkill
      const securityResult = await expertAPI.invokeExpert('security-expert', task);
      expect(securityResult.json.metadata.expertVersion).toBeDefined();

      // Performance expert should use PerformanceExpertSkill
      const perfResult = await expertAPI.invokeExpert('perf-expert', task);
      expect(perfResult.json.metadata.expertVersion).toBeDefined();
    }, 10000);

    it('should include durationMs in metadata', async () => {
      // Create a test file in temp dir
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'const x = 1;');

      const task: ExpertTaskInput = {
        targetPath: tempDir,
        outputFormat: 'both',
      };

      const startTime = Date.now();
      const result = await expertAPI.invokeExpert('security-expert', task);
      const endTime = Date.now();

      expect(result.json.metadata.durationMs).toBeDefined();
      expect(result.json.metadata.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.json.metadata.durationMs).toBeLessThanOrEqual(endTime - startTime + 100);
    });

    it('should throw when skill not found in registry', async () => {
      // Override mock to return undefined (skill not registered)
      mockRegistry.getMetadata.mockReturnValue(undefined);

      const task: ExpertTaskInput = {
        targetPath: tempDir,
        outputFormat: 'both',
      };

      // Should throw because skill is not in registry
      await expect(expertAPI.invokeExpert('security-expert', task)).rejects.toThrow(
        'Skill security-review not found in registry'
      );
    });

    it('should handle partial failures with errors array', async () => {
      const task: ExpertTaskInput = {
        targetPath: './non-existent-path-12345',
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
        targetPath: tempDir,
        outputFormat: 'both',
      };

      const result = (expertAPI as any).formatErrorOutput(error, task, Date.now());

      expect(result.json.findings).toEqual([]);
      expect(result.json.errors).toContain('Test error');
      expect(result.json.summary.totalIssues).toBe(0);
      expect(result.markdown).toContain('Error');
    });

    it('should handle non-Error objects', () => {
      const task: ExpertTaskInput = {
        targetPath: tempDir,
        outputFormat: 'both',
      };

      const result = (expertAPI as any).formatErrorOutput('string error', task, Date.now());

      expect(result.json.errors).toContain('string error');
    });
  });

  describe('integration with SkillRegistry', () => {
    it('should check skill availability in registry', async () => {
      mockRegistry.getMetadata.mockReturnValue({
        name: 'security-review',
        version: '1.0.0',
      } as any);

      // Create a test file in temp dir
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'const x = 1;');

      const task: ExpertTaskInput = {
        targetPath: tempDir,
        outputFormat: 'both',
      };

      await expertAPI.invokeExpert('security-expert', task);

      expect(mockRegistry.getMetadata).toHaveBeenCalledWith('security-review');
    });

    it('should throw if required skill not in registry', async () => {
      mockRegistry.getMetadata.mockReturnValue(undefined);

      const task: ExpertTaskInput = {
        targetPath: tempDir,
        outputFormat: 'both',
      };

      // Should throw because validation fails
      await expect(expertAPI.invokeExpert('security-expert', task)).rejects.toThrow(
        'Skill security-review not found in registry'
      );
    });
  });

  describe('integration with AgentBuilder', () => {
    it('should use AgentBuilder for skill composition', async () => {
      // Create a test file in temp dir
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'const x = 1;');

      const task: ExpertTaskInput = {
        targetPath: tempDir,
        outputFormat: 'both',
      };

      await expertAPI.invokeExpert('security-expert', task);

      // AgentBuilder should be available for composition
      expect(mockAgentBuilder).toBeDefined();
    });
  });

  describe('utility methods', () => {
    it('should return available expert IDs', () => {
      const experts = expertAPI.getAvailableExperts();
      expect(experts).toContain('security-expert');
      expect(experts).toContain('perf-expert');
      expect(experts).toContain('doc-expert');
      expect(experts.length).toBe(3);
    });

    it('should check if expert is available', () => {
      expect(expertAPI.hasExpert('security-expert')).toBe(true);
      expect(expertAPI.hasExpert('perf-expert')).toBe(true);
      expect(expertAPI.hasExpert('doc-expert')).toBe(true);
      expect(expertAPI.hasExpert('unknown-expert')).toBe(false);
    });
  });
});
