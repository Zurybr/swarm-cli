/**
 * Template definitions tests
 */

import {
  AGENT_TEMPLATES,
  getTemplate,
  listAgentTypes,
  getTemplateSummary,
  getAllTemplateSummaries,
} from '../templates';
import type { AgentType } from '../types';

describe('Agent Templates', () => {
  describe('AGENT_TEMPLATES', () => {
    it('should have all 12 agent types', () => {
      const types = Object.keys(AGENT_TEMPLATES);
      expect(types).toHaveLength(12);
    });

    it('should have valid templates for each agent type', () => {
      for (const [type, template] of Object.entries(AGENT_TEMPLATES)) {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.agentType).toBe(type);
        expect(template.content).toBeDefined();
        expect(template.variables).toBeDefined();
        expect(template.metadata).toBeDefined();
      }
    });
  });

  describe('getTemplate', () => {
    it('should return template for valid agent type', () => {
      const template = getTemplate('executor');
      expect(template.agentType).toBe('executor');
      expect(template.id).toContain('executor');
    });

    it('should return template for all agent types', () => {
      const types: AgentType[] = [
        'coordinator',
        'researcher',
        'planner',
        'executor',
        'reviewer',
        'tester',
        'debugger',
        'optimizer',
        'documenter',
        'validator',
        'migrator',
        'analyzer',
      ];

      for (const type of types) {
        const template = getTemplate(type);
        expect(template).toBeDefined();
        expect(template.agentType).toBe(type);
      }
    });

    it('should throw error for invalid agent type', () => {
      expect(() => getTemplate('invalid' as AgentType)).toThrow(
        'No template found for agent type: invalid'
      );
    });
  });

  describe('listAgentTypes', () => {
    it('should return all 12 agent types', () => {
      const types = listAgentTypes();
      expect(types).toHaveLength(12);
      expect(types).toContain('coordinator');
      expect(types).toContain('executor');
      expect(types).toContain('debugger');
    });
  });

  describe('getTemplateSummary', () => {
    it('should return summary for valid agent type', () => {
      const summary = getTemplateSummary('planner');
      expect(summary.id).toBeDefined();
      expect(summary.name).toBeDefined();
      expect(summary.description).toBeDefined();
      expect(summary.complexity).toBeGreaterThanOrEqual(1);
      expect(summary.complexity).toBeLessThanOrEqual(5);
      expect(summary.estimatedTokens).toBeGreaterThan(0);
      expect(summary.variableCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAllTemplateSummaries', () => {
    it('should return summaries for all templates', () => {
      const summaries = getAllTemplateSummaries();
      expect(summaries).toHaveLength(12);

      for (const summary of summaries) {
        expect(summary.id).toBeDefined();
        expect(summary.name).toBeDefined();
        expect(summary.complexity).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('Template content', () => {
    it('should have task variable in all templates', () => {
      for (const template of Object.values(AGENT_TEMPLATES)) {
        const hasTaskVar = template.variables.some((v) => v.name === 'task');
        expect(hasTaskVar).toBe(true);
      }
    });

    it('should have valid complexity levels', () => {
      for (const template of Object.values(AGENT_TEMPLATES)) {
        expect(template.metadata.complexity).toBeGreaterThanOrEqual(1);
        expect(template.metadata.complexity).toBeLessThanOrEqual(5);
      }
    });

    it('should have positive estimated token counts', () => {
      for (const template of Object.values(AGENT_TEMPLATES)) {
        expect(template.metadata.estimatedTokens).toBeGreaterThan(0);
      }
    });

    it('should have metadata dates', () => {
      for (const template of Object.values(AGENT_TEMPLATES)) {
        expect(template.metadata.createdAt).toBeInstanceOf(Date);
        expect(template.metadata.modifiedAt).toBeInstanceOf(Date);
      }
    });

    it('should have tags array', () => {
      for (const template of Object.values(AGENT_TEMPLATES)) {
        expect(Array.isArray(template.metadata.tags)).toBe(true);
      }
    });
  });
});
