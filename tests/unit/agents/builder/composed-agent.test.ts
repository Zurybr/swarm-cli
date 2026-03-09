/**
 * Composed Agent Tests
 *
 * Tests for ComposedAgent class that extends BaseAgent.
 * Validates BaseAgent integration, lifecycle hooks, and skill execution.
 */

import { ComposedAgent } from '../../../../src/agents/builder/composed-agent';
import {
  BaseAgent,
  AgentConfig,
  Task,
  AgentResult,
} from '../../../../src/agents/base-agent';
import { SkillRegistry } from '../../../../src/skills/registry/skill-registry';
import { CompositionConfig } from '../../../../src/agents/types/composition';
import { SkillMetadata } from '../../../../src/skills/types/skill';

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

// Mock skill chain executor
jest.mock('../../../../src/agents/builder/skill-chain', () => {
  return {
    SkillChain: jest.fn().mockImplementation(() => ({
      getExecutionOrder: () => [],
      getCompositionConfig: () => ({}),
    })),
    SkillChainExecutor: jest.fn().mockImplementation(() => ({
      execute: jest.fn(),
    })),
  };
});

describe('ComposedAgent', () => {
  let mockRegistry: SkillRegistry;
  let agentConfig: AgentConfig;
  let compositionConfig: CompositionConfig;

  beforeEach(() => {
    mockRegistry = createMockRegistry();
    agentConfig = {
      id: 'test-agent-1',
      runId: 'run-1',
      role: 'test-role',
      model: 'gpt-4',
      apiUrl: 'http://localhost:3000',
      tools: [],
    };
    compositionConfig = {
      name: 'test-composed-agent',
      description: 'A test composed agent',
      skills: [{ skillName: 'test-skill' }],
    };

    // Register a mock skill
    (mockRegistry as any).registerSkill({
      name: 'test-skill',
      version: '1.0.0',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should extend BaseAgent (instanceof check)', () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      expect(agent).toBeInstanceOf(BaseAgent);
      expect(agent).toBeInstanceOf(ComposedAgent);
    });

    it('should store composition config and skill registry', () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      // Access private fields for testing
      expect((agent as any).compositionConfig).toBe(compositionConfig);
      expect((agent as any).skillRegistry).toBe(mockRegistry);
    });

    it('should initialize chain executor', () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      expect((agent as any).chainExecutor).toBeDefined();
    });

    it('should create logger with agent role', () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      expect((agent as any).logger).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should call beforeExecute hook before running skills', async () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      const beforeExecuteSpy = jest.spyOn(agent as any, 'beforeExecute');

      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: '{"content": "test"}',
        status: 'pending',
      };

      await agent.execute(task);

      expect(beforeExecuteSpy).toHaveBeenCalledWith(task);
      expect(beforeExecuteSpy).toHaveBeenCalledTimes(1);
    });

    it('should call afterExecute hook after completion', async () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      const afterExecuteSpy = jest.spyOn(agent as any, 'afterExecute');

      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: '{"content": "test"}',
        status: 'pending',
      };

      await agent.execute(task);

      expect(afterExecuteSpy).toHaveBeenCalledTimes(1);
      expect(afterExecuteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: expect.any(Boolean),
        })
      );
    });

    it('should extract input from task description (JSON parse)', async () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      const chainExecutor = (agent as any).chainExecutor;
      chainExecutor.execute = jest.fn().mockResolvedValue({
        success: true,
        output: { result: 'done' },
        trace: [],
      });

      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: '{"content": "test data", "number": 42}',
        status: 'pending',
      };

      await agent.execute(task);

      expect(chainExecutor.execute).toHaveBeenCalledWith({
        content: 'test data',
        number: 42,
      });
    });

    it('should wrap non-JSON description as content property', async () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      const chainExecutor = (agent as any).chainExecutor;
      chainExecutor.execute = jest.fn().mockResolvedValue({
        success: true,
        output: { result: 'done' },
        trace: [],
      });

      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'Plain text description',
        status: 'pending',
      };

      await agent.execute(task);

      expect(chainExecutor.execute).toHaveBeenCalledWith({
        content: 'Plain text description',
      });
    });

    it('should return AgentResult with success=true on completion', async () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      const chainExecutor = (agent as any).chainExecutor;
      chainExecutor.execute = jest.fn().mockResolvedValue({
        success: true,
        output: { result: 'success' },
        trace: [{ skill: 'test', input: {}, output: {}, durationMs: 10 }],
      });

      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'test',
        status: 'pending',
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should return AgentResult with success=false on error', async () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      const chainExecutor = (agent as any).chainExecutor;
      chainExecutor.execute = jest.fn().mockResolvedValue({
        success: false,
        output: null,
        trace: [],
        error: 'Skill execution failed',
      });

      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'test',
        status: 'pending',
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Skill execution failed');
    });

    it('should extract artifacts from skill outputs (filePath, artifacts array)', async () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      const chainExecutor = (agent as any).chainExecutor;
      chainExecutor.execute = jest.fn().mockResolvedValue({
        success: true,
        output: {
          data: 'result',
          filePath: '/path/to/file.txt',
          artifacts: ['/path/art1.txt', '/path/art2.txt'],
        },
        trace: [],
      });

      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'test',
        status: 'pending',
      };

      const result = await agent.execute(task);

      expect(result.artifacts).toContain('/path/to/file.txt');
      expect(result.artifacts).toContain('/path/art1.txt');
      expect(result.artifacts).toContain('/path/art2.txt');
    });

    it('should format AgentResult output as JSON string', async () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      const chainExecutor = (agent as any).chainExecutor;
      chainExecutor.execute = jest.fn().mockResolvedValue({
        success: true,
        output: { key: 'value', number: 123 },
        trace: [],
      });

      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'test',
        status: 'pending',
      };

      const result = await agent.execute(task);

      expect(typeof result.output).toBe('string');
      expect(JSON.parse(result.output!)).toEqual({
        key: 'value',
        number: 123,
      });
    });

    it('should handle chain executor throwing an error', async () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      const chainExecutor = (agent as any).chainExecutor;
      chainExecutor.execute = jest.fn().mockRejectedValue(new Error('Unexpected error'));

      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'test',
        status: 'pending',
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });

    it('should update agent status through lifecycle', async () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      expect(agent.getStatus()).toBe('idle');

      const chainExecutor = (agent as any).chainExecutor;
      chainExecutor.execute = jest.fn().mockResolvedValue({
        success: true,
        output: {},
        trace: [],
      });

      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'test',
        status: 'pending',
      };

      const executePromise = agent.execute(task);
      expect(agent.getStatus()).toBe('working');

      await executePromise;
      expect(agent.getStatus()).toBe('completed');
    });

    it('should track current task during execution', async () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      const chainExecutor = (agent as any).chainExecutor;
      chainExecutor.execute = jest.fn().mockResolvedValue({
        success: true,
        output: {},
        trace: [],
      });

      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'test',
        status: 'pending',
      };

      expect(agent.getCurrentTask()).toBeUndefined();

      await agent.execute(task);

      expect(agent.getCurrentTask()).toEqual(task);
    });

    it('should handle empty JSON object in description', async () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      const chainExecutor = (agent as any).chainExecutor;
      chainExecutor.execute = jest.fn().mockResolvedValue({
        success: true,
        output: {},
        trace: [],
      });

      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: '{}',
        status: 'pending',
      };

      await agent.execute(task);

      expect(chainExecutor.execute).toHaveBeenCalledWith({});
    });

    it('should handle JSON array in description', async () => {
      const agent = new ComposedAgent(
        agentConfig,
        compositionConfig,
        mockRegistry
      );

      const chainExecutor = (agent as any).chainExecutor;
      chainExecutor.execute = jest.fn().mockResolvedValue({
        success: true,
        output: {},
        trace: [],
      });

      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: '[1, 2, 3]',
        status: 'pending',
      };

      await agent.execute(task);

      expect(chainExecutor.execute).toHaveBeenCalledWith([1, 2, 3]);
    });
  });
});
