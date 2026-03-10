/**
 * Tests for GSD Types
 */

import {
  GSDStatus,
  GSDPriority,
  DEFAULT_GSD_CONFIG,
  Task,
  Phase,
  Milestone,
  Project,
} from '../types';

describe('GSD Types', () => {
  describe('GSDStatus', () => {
    it('should have all required status values', () => {
      const statuses: GSDStatus[] = ['not_started', 'in_progress', 'blocked', 'completed', 'cancelled'];
      expect(statuses).toHaveLength(5);
    });
  });

  describe('GSDPriority', () => {
    it('should have all required priority values', () => {
      const priorities: GSDPriority[] = ['critical', 'high', 'medium', 'low'];
      expect(priorities).toHaveLength(4);
    });
  });

  describe('DEFAULT_GSD_CONFIG', () => {
    it('should have default values', () => {
      expect(DEFAULT_GSD_CONFIG.projectFileName).toBe('PROJECT.md');
      expect(DEFAULT_GSD_CONFIG.autoSave).toBe(true);
      expect(DEFAULT_GSD_CONFIG.defaultPriority).toBe('medium');
      expect(DEFAULT_GSD_CONFIG.enforceDependencies).toBe(true);
      expect(DEFAULT_GSD_CONFIG.notifyOnBlock).toBe(true);
    });
  });

  describe('Task interface', () => {
    it('should create a valid task object', () => {
      const task: Task = {
        id: 'task_001',
        name: 'Test Task',
        description: 'A test task',
        status: 'not_started',
        priority: 'high',
        assignee: 'user@example.com',
        estimatedHours: 4,
        dependencies: [],
        deliverables: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(task.id).toBe('task_001');
      expect(task.name).toBe('Test Task');
      expect(task.status).toBe('not_started');
      expect(task.priority).toBe('high');
    });
  });

  describe('Phase interface', () => {
    it('should create a valid phase object', () => {
      const phase: Phase = {
        id: 'phase_001',
        name: 'Test Phase',
        description: 'A test phase',
        status: 'not_started',
        order: 0,
        tasks: [],
        deliverables: [],
        entryCriteria: [],
        exitCriteria: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(phase.id).toBe('phase_001');
      expect(phase.name).toBe('Test Phase');
      expect(phase.order).toBe(0);
      expect(phase.tasks).toEqual([]);
    });
  });

  describe('Milestone interface', () => {
    it('should create a valid milestone object', () => {
      const milestone: Milestone = {
        id: 'milestone_001',
        name: 'Test Milestone',
        description: 'A test milestone',
        status: 'not_started',
        order: 0,
        phases: [],
        deliverables: [],
        successCriteria: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(milestone.id).toBe('milestone_001');
      expect(milestone.name).toBe('Test Milestone');
      expect(milestone.phases).toEqual([]);
    });
  });

  describe('Project interface', () => {
    it('should create a valid project object', () => {
      const project: Project = {
        id: 'project_001',
        name: 'Test Project',
        description: 'A test project',
        version: '1.0.0',
        status: 'not_started',
        team: [],
        milestones: [],
        metadata: {
          tags: [],
          customFields: {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(project.id).toBe('project_001');
      expect(project.name).toBe('Test Project');
      expect(project.version).toBe('1.0.0');
      expect(project.milestones).toEqual([]);
    });
  });
});
