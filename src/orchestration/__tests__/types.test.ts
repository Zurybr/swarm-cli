/**
 * Tests for orchestration types
 */

import {
  ALL_AGENT_TYPES,
  AgentStatus,
  TaskStatus,
  SwarmStatus,
  CoordinationStrategyType,
  PermissionLevel,
} from '../types';

describe('Orchestration Types', () => {
  describe('ALL_AGENT_TYPES', () => {
    it('should contain exactly 13 agent types', () => {
      expect(ALL_AGENT_TYPES).toHaveLength(13);
    });

    it('should include all expected agent types', () => {
      const expectedTypes = [
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
        'architect',
      ];

      for (const type of expectedTypes) {
        expect(ALL_AGENT_TYPES).toContain(type);
      }
    });
  });

  describe('AgentStatus', () => {
    it('should have valid status values', () => {
      const statuses: AgentStatus[] = ['idle', 'busy', 'paused', 'error', 'offline'];
      for (const status of statuses) {
        expect(status).toBeDefined();
      }
    });
  });

  describe('TaskStatus', () => {
    it('should have valid status values', () => {
      const statuses: TaskStatus[] = [
        'pending',
        'assigned',
        'in_progress',
        'completed',
        'failed',
        'cancelled',
        'blocked',
      ];
      for (const status of statuses) {
        expect(status).toBeDefined();
      }
    });
  });

  describe('SwarmStatus', () => {
    it('should have valid status values', () => {
      const statuses: SwarmStatus[] = [
        'initializing',
        'active',
        'paused',
        'shutting_down',
        'terminated',
        'error',
      ];
      for (const status of statuses) {
        expect(status).toBeDefined();
      }
    });
  });

  describe('CoordinationStrategyType', () => {
    it('should have valid strategy types', () => {
      const strategies: CoordinationStrategyType[] = [
        'parallel',
        'sequential',
        'adaptive',
        'hierarchical',
      ];
      for (const strategy of strategies) {
        expect(strategy).toBeDefined();
      }
    });
  });

  describe('PermissionLevel', () => {
    it('should have valid permission levels', () => {
      const levels: PermissionLevel[] = ['none', 'read', 'write', 'admin'];
      for (const level of levels) {
        expect(level).toBeDefined();
      }
    });
  });
});
