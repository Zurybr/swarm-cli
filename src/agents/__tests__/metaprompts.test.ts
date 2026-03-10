/**
 * Tests for meta-prompts
 */

import {
  getMetaPrompt,
  getSystemPrompt,
  getTaskPrompt,
  getAvailableTaskTypes,
  formatTaskPrompt,
  getDefaultTools,
  getResponseFormat,
  getExamples,
  METAPROMPTS,
} from '../metaprompts';
import { AgentType, ALL_AGENT_TYPES } from '../types';

describe('Meta-prompts', () => {
  describe('getMetaPrompt', () => {
    it('should return meta-prompt for all agent types', () => {
      for (const type of ALL_AGENT_TYPES) {
        const meta = getMetaPrompt(type);

        expect(meta).toBeDefined();
        expect(meta.agentType).toBe(type);
        expect(meta.systemPrompt).toBeDefined();
        expect(meta.taskPrompts).toBeDefined();
        expect(meta.defaultTools).toBeDefined();
        expect(meta.responseFormat).toBeDefined();
        expect(meta.examples).toBeDefined();
      }
    });
  });

  describe('getSystemPrompt', () => {
    it('should return system prompt for all agent types', () => {
      for (const type of ALL_AGENT_TYPES) {
        const prompt = getSystemPrompt(type);

        expect(prompt).toBeDefined();
        expect(prompt.length).toBeGreaterThan(100);
      }
    });

    it('should include role description', () => {
      const coordinatorPrompt = getSystemPrompt('coordinator');
      expect(coordinatorPrompt).toContain('Coordinator');

      const executorPrompt = getSystemPrompt('executor');
      expect(executorPrompt).toContain('Executor');
    });

    it('should include responsibilities', () => {
      for (const type of ALL_AGENT_TYPES) {
        const prompt = getSystemPrompt(type);
        expect(prompt).toContain('Responsibilities');
      }
    });

    it('should include response format', () => {
      for (const type of ALL_AGENT_TYPES) {
        const prompt = getSystemPrompt(type);
        expect(prompt).toContain('Response Format');
      }
    });
  });

  describe('getTaskPrompt', () => {
    it('should return task prompts for available task types', () => {
      const executorPrompt = getTaskPrompt('executor', 'implement');
      expect(executorPrompt).toBeDefined();

      const researcherPrompt = getTaskPrompt('researcher', 'research');
      expect(researcherPrompt).toBeDefined();
    });

    it('should return undefined for unknown task types', () => {
      const prompt = getTaskPrompt('executor', 'unknown-task');
      expect(prompt).toBeUndefined();
    });
  });

  describe('getAvailableTaskTypes', () => {
    it('should return task types for all agent types', () => {
      for (const type of ALL_AGENT_TYPES) {
        const types = getAvailableTaskTypes(type);

        expect(types).toBeDefined();
        expect(types.length).toBeGreaterThan(0);
      }
    });

    it('should return specific task types for coordinator', () => {
      const types = getAvailableTaskTypes('coordinator');

      expect(types).toContain('orchestrate');
      expect(types).toContain('delegate');
      expect(types).toContain('monitor');
      expect(types).toContain('sync');
    });

    it('should return specific task types for executor', () => {
      const types = getAvailableTaskTypes('executor');

      expect(types).toContain('implement');
      expect(types).toContain('code');
      expect(types).toContain('build');
    });
  });

  describe('formatTaskPrompt', () => {
    it('should replace variables in template', () => {
      const formatted = formatTaskPrompt('executor', 'implement', {
        FEATURE: 'user authentication',
        SPEC: 'JWT-based auth',
        FILES: 'src/auth.ts',
      });

      expect(formatted).toContain('user authentication');
      expect(formatted).toContain('JWT-based auth');
      expect(formatted).toContain('src/auth.ts');
    });

    it('should throw for unknown task type', () => {
      expect(() => {
        formatTaskPrompt('executor', 'unknown', {});
      }).toThrow();
    });

    it('should keep unmapped variables as-is', () => {
      const formatted = formatTaskPrompt('executor', 'implement', {
        FEATURE: 'test',
      });

      // Variables not provided should remain as {{VARIABLE}}
      expect(formatted).toContain('{{');
    });
  });

  describe('getDefaultTools', () => {
    it('should return tools for all agent types', () => {
      for (const type of ALL_AGENT_TYPES) {
        const tools = getDefaultTools(type);

        expect(tools).toBeDefined();
        expect(tools.length).toBeGreaterThan(0);
        expect(Array.isArray(tools)).toBe(true);
      }
    });

    it('should return specific tools for executor', () => {
      const tools = getDefaultTools('executor');

      expect(tools).toContain('read');
      expect(tools).toContain('write');
      expect(tools).toContain('edit');
    });

    it('should return specific tools for researcher', () => {
      const tools = getDefaultTools('researcher');

      expect(tools).toContain('search');
      expect(tools).toContain('read');
    });
  });

  describe('getResponseFormat', () => {
    it('should return response format for all agent types', () => {
      for (const type of ALL_AGENT_TYPES) {
        const format = getResponseFormat(type);

        expect(format).toBeDefined();
        expect(format.length).toBeGreaterThan(0);
      }
    });

    it('should include structured sections', () => {
      for (const type of ALL_AGENT_TYPES) {
        const format = getResponseFormat(type);

        // Most formats use ## for headers
        expect(format).toContain('##');
      }
    });
  });

  describe('getExamples', () => {
    it('should return examples for all agent types', () => {
      for (const type of ALL_AGENT_TYPES) {
        const examples = getExamples(type);

        expect(examples).toBeDefined();
        expect(Array.isArray(examples)).toBe(true);
      }
    });

    it('should have examples with input and output', () => {
      for (const type of ALL_AGENT_TYPES) {
        const examples = getExamples(type);

        for (const example of examples) {
          expect(example.input).toBeDefined();
          expect(example.output).toBeDefined();
        }
      }
    });
  });

  describe('METAPROMPTS registry', () => {
    it('should contain all 12 agent types', () => {
      expect(Object.keys(METAPROMPTS)).toHaveLength(12);

      for (const type of ALL_AGENT_TYPES) {
        expect(METAPROMPTS[type]).toBeDefined();
      }
    });

    it('should have unique system prompts per agent type', () => {
      const prompts = new Set<string>();

      for (const type of ALL_AGENT_TYPES) {
        const prompt = METAPROMPTS[type].systemPrompt;
        expect(prompts.has(prompt)).toBe(false);
        prompts.add(prompt);
      }
    });
  });

  describe('Coordinator meta-prompt', () => {
    it('should include delegation guidelines', () => {
      const meta = getMetaPrompt('coordinator');

      expect(meta.systemPrompt).toContain('Delegation');
      expect(meta.systemPrompt).toContain('Researcher');
      expect(meta.systemPrompt).toContain('Executor');
    });

    it('should include all agent types in delegation', () => {
      const meta = getMetaPrompt('coordinator');

      for (const type of ALL_AGENT_TYPES) {
        if (type !== 'coordinator') {
          expect(meta.systemPrompt.toLowerCase()).toContain(type.toLowerCase());
        }
      }
    });
  });

  describe('Executor meta-prompt', () => {
    it('should include implementation guidelines', () => {
      const meta = getMetaPrompt('executor');

      expect(meta.systemPrompt).toContain('Implementation');
      expect(meta.systemPrompt).toContain('code');
    });

    it('should include testing requirements', () => {
      const meta = getMetaPrompt('executor');

      expect(meta.systemPrompt).toContain('test');
    });
  });

  describe('Reviewer meta-prompt', () => {
    it('should include review checklist', () => {
      const meta = getMetaPrompt('reviewer');

      expect(meta.systemPrompt).toContain('Checklist');
      expect(meta.systemPrompt).toContain('Correctness');
      expect(meta.systemPrompt).toContain('Security');
    });
  });

  describe('Tester meta-prompt', () => {
    it('should include testing methodology', () => {
      const meta = getMetaPrompt('tester');

      expect(meta.systemPrompt).toContain('Methodology');
      expect(meta.systemPrompt).toContain('test');
    });
  });

  describe('Debugger meta-prompt', () => {
    it('should include debugging methodology', () => {
      const meta = getMetaPrompt('debugger');

      expect(meta.systemPrompt).toContain('Debugging');
      expect(meta.systemPrompt).toContain('root cause');
    });
  });

  describe('Optimizer meta-prompt', () => {
    it('should include optimization methodology', () => {
      const meta = getMetaPrompt('optimizer');

      expect(meta.systemPrompt).toContain('Optimization');
      expect(meta.systemPrompt).toContain('performance');
    });
  });

  describe('Documenter meta-prompt', () => {
    it('should include documentation principles', () => {
      const meta = getMetaPrompt('documenter');

      expect(meta.systemPrompt).toContain('Documentation');
      expect(meta.systemPrompt).toContain('Principles');
    });
  });

  describe('Validator meta-prompt', () => {
    it('should include validation methodology', () => {
      const meta = getMetaPrompt('validator');

      expect(meta.systemPrompt).toContain('Validation');
      expect(meta.systemPrompt).toContain('requirements');
    });
  });

  describe('Migrator meta-prompt', () => {
    it('should include migration methodology', () => {
      const meta = getMetaPrompt('migrator');

      expect(meta.systemPrompt).toContain('Migration');
      expect(meta.systemPrompt).toContain('backup');
    });
  });

  describe('Analyzer meta-prompt', () => {
    it('should include analysis methodology', () => {
      const meta = getMetaPrompt('analyzer');

      expect(meta.systemPrompt).toContain('Analysis');
      expect(meta.systemPrompt).toContain('Methodology');
    });
  });
});
