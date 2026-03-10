/**
 * Tests for GSD System Integration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GSDSystem } from '../index';
import { GSDStatus, GSDPriority } from '../types';

describe('GSDSystem', () => {
  let tempDir: string;
  let system: GSDSystem;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-system-test-'));
    system = new GSDSystem({ autoSave: false });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const sys = new GSDSystem();
      expect(sys.getCurrentProject()).toBeNull();
    });

    it('should accept custom config', () => {
      const sys = new GSDSystem({ autoSave: true, defaultPriority: 'high' });
      expect(sys).toBeDefined();
    });
  });

  describe('createNewProject', () => {
    it('should create a new project', () => {
      const project = system.createNewProject('Test Project', 'Description');

      expect(project.name).toBe('Test Project');
      expect(project.description).toBe('Description');
      expect(system.getCurrentProject()).toBe(project);
    });

    it('should create with empty description by default', () => {
      const project = system.createNewProject('Test');

      expect(project.description).toBe('');
    });
  });

  describe('loadProject', () => {
    it('should load a project from file', () => {
      const projectContent = `---
name: Load Test Project
description: A test project
version: 1.0.0
---

# Load Test Project

## Milestone: Test Milestone

### Phase: Test Phase

- [ ] Test Task
`;
      const filePath = path.join(tempDir, 'PROJECT.md');
      fs.writeFileSync(filePath, projectContent, 'utf-8');

      const project = system.loadProject(filePath);

      expect(project.name).toBe('Load Test Project');
      expect(project.milestones).toHaveLength(1);
    });

    it('should throw on invalid file', () => {
      expect(() => {
        system.loadProject(path.join(tempDir, 'nonexistent.md'));
      }).toThrow('Failed to load project');
    });
  });

  describe('loadProjectFromContent', () => {
    it('should load from content string', () => {
      const content = `---
name: Content Test
---

# Content Test
`;
      const project = system.loadProjectFromContent(content);

      expect(project.name).toBe('Content Test');
    });

    it('should throw on invalid content', () => {
      expect(() => {
        system.loadProjectFromContent('invalid content');
      }).toThrow();
    });
  });

  describe('save', () => {
    it('should save project to file', () => {
      system.createNewProject('Save Test');
      const filePath = path.join(tempDir, 'PROJECT.md');

      system.save(filePath);

      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('name: Save Test');
    });

    it('should throw when no project loaded', () => {
      expect(() => {
        system.save();
      }).toThrow('No project loaded');
    });
  });

  describe('validate', () => {
    it('should validate current project', () => {
      system.createNewProject('Valid Project', 'Description');

      const result = system.validate();

      expect(result.valid).toBe(true);
    });

    it('should return errors for invalid project', () => {
      system.createNewProject('');
      const project = system.getCurrentProject()!;
      project.name = '';

      const result = system.validate();

      expect(result.valid).toBe(false);
    });

    it('should return error when no project', () => {
      const result = system.validate();

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('project');
    });
  });

  describe('getStats', () => {
    it('should return project statistics', () => {
      system.createNewProject('Stats Test');
      const milestone = system.addMilestone('M1');
      const phase = system.addPhase(milestone.id, 'P1');
      system.addTask(milestone.id, phase.id, 'T1');

      const stats = system.getStats();

      expect(stats.totalMilestones).toBe(1);
      expect(stats.totalPhases).toBe(1);
      expect(stats.totalTasks).toBe(1);
    });

    it('should throw when no project', () => {
      expect(() => {
        system.getStats();
      }).toThrow('No project loaded');
    });
  });

  describe('addMilestone', () => {
    it('should add a milestone', () => {
      system.createNewProject('Test');

      const milestone = system.addMilestone('New Milestone', 'Description');

      expect(milestone.name).toBe('New Milestone');
      expect(system.getCurrentProject()!.milestones).toHaveLength(1);
    });

    it('should auto-assign order', () => {
      system.createNewProject('Test');

      const m1 = system.addMilestone('M1');
      const m2 = system.addMilestone('M2');

      expect(m1.order).toBe(0);
      expect(m2.order).toBe(1);
    });

    it('should throw when no project', () => {
      expect(() => {
        system.addMilestone('Test');
      }).toThrow('No project loaded');
    });
  });

  describe('removeMilestone', () => {
    it('should remove a milestone', () => {
      system.createNewProject('Test');
      const milestone = system.addMilestone('To Remove');

      const result = system.removeMilestone(milestone.id);

      expect(result).toBe(true);
      expect(system.getCurrentProject()!.milestones).toHaveLength(0);
    });

    it('should return false for non-existent milestone', () => {
      system.createNewProject('Test');

      const result = system.removeMilestone('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getMilestone', () => {
    it('should get milestone by ID', () => {
      system.createNewProject('Test');
      const milestone = system.addMilestone('Test Milestone');

      const found = system.getMilestone(milestone.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(milestone.id);
    });

    it('should get milestone by name', () => {
      system.createNewProject('Test');
      system.addMilestone('Test Milestone');

      const found = system.getMilestone('Test Milestone');

      expect(found).toBeDefined();
      expect(found!.name).toBe('Test Milestone');
    });
  });

  describe('addPhase', () => {
    it('should add a phase to a milestone', () => {
      system.createNewProject('Test');
      const milestone = system.addMilestone('M1');

      const phase = system.addPhase(milestone.id, 'New Phase');

      expect(phase.name).toBe('New Phase');
      expect(milestone.phases).toHaveLength(1);
    });

    it('should throw when milestone not found', () => {
      system.createNewProject('Test');

      expect(() => {
        system.addPhase('nonexistent', 'Phase');
      }).toThrow('Milestone not found');
    });
  });

  describe('getPhase', () => {
    it('should get phase by ID', () => {
      system.createNewProject('Test');
      const milestone = system.addMilestone('M1');
      const phase = system.addPhase(milestone.id, 'P1');

      const result = system.getPhase(phase.id);

      expect(result).toBeDefined();
      expect(result!.phase.id).toBe(phase.id);
    });

    it('should get phase by name', () => {
      system.createNewProject('Test');
      const milestone = system.addMilestone('M1');
      system.addPhase(milestone.id, 'P1');

      const result = system.getPhase('P1');

      expect(result).toBeDefined();
      expect(result!.phase.name).toBe('P1');
    });
  });

  describe('addTask', () => {
    it('should add a task to a phase', () => {
      system.createNewProject('Test');
      const milestone = system.addMilestone('M1');
      const phase = system.addPhase(milestone.id, 'P1');

      const task = system.addTask(milestone.id, phase.id, 'New Task', 'high');

      expect(task.name).toBe('New Task');
      expect(task.priority).toBe('high');
      expect(phase.tasks).toHaveLength(1);
    });

    it('should default to medium priority', () => {
      system.createNewProject('Test');
      const milestone = system.addMilestone('M1');
      const phase = system.addPhase(milestone.id, 'P1');

      const task = system.addTask(milestone.id, phase.id, 'Task');

      expect(task.priority).toBe('medium');
    });
  });

  describe('getTask', () => {
    it('should get task by ID', () => {
      system.createNewProject('Test');
      const milestone = system.addMilestone('M1');
      const phase = system.addPhase(milestone.id, 'P1');
      const task = system.addTask(milestone.id, phase.id, 'T1');

      const result = system.getTask(task.id);

      expect(result).toBeDefined();
      expect(result!.task.id).toBe(task.id);
    });

    it('should get task by name', () => {
      system.createNewProject('Test');
      const milestone = system.addMilestone('M1');
      const phase = system.addPhase(milestone.id, 'P1');
      system.addTask(milestone.id, phase.id, 'T1');

      const result = system.getTask('T1');

      expect(result).toBeDefined();
      expect(result!.task.name).toBe('T1');
    });
  });

  describe('completeTask', () => {
    it('should mark a task as completed', () => {
      system.createNewProject('Test');
      const milestone = system.addMilestone('M1');
      const phase = system.addPhase(milestone.id, 'P1');
      const task = system.addTask(milestone.id, phase.id, 'T1');

      const update = system.completeTask(milestone.id, phase.id, task.id);

      expect(update).toBeDefined();
      expect(task.status).toBe('completed');
    });
  });

  describe('generateRoadmap', () => {
    it('should generate roadmap', () => {
      system.createNewProject('Test');
      system.addMilestone('M1');

      const roadmap = system.generateRoadmap();

      expect(roadmap.projectName).toBe('Test');
      expect(roadmap.milestones).toHaveLength(1);
    });

    it('should throw when no project', () => {
      expect(() => {
        system.generateRoadmap();
      }).toThrow('No project loaded');
    });
  });

  describe('exportRoadmap', () => {
    it('should export to JSON', () => {
      system.createNewProject('Test');

      const json = system.exportRoadmap('json');

      expect(JSON.parse(json).projectName).toBe('Test');
    });

    it('should export to Markdown', () => {
      system.createNewProject('Test');

      const markdown = system.exportRoadmap('markdown');

      expect(markdown).toContain('# Test - Roadmap');
    });
  });

  describe('visualizeRoadmap', () => {
    it('should return visualization', () => {
      system.createNewProject('Test');
      system.addMilestone('M1');

      const viz = system.visualizeRoadmap();

      expect(viz).toContain('Test');
    });
  });

  describe('getUpcomingItems', () => {
    it('should return upcoming items', () => {
      system.createNewProject('Test');
      const milestone = system.addMilestone('M1');
      milestone.targetDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const upcoming = system.getUpcomingItems(7);

      expect(upcoming).toHaveLength(1);
    });
  });

  describe('getCriticalPath', () => {
    it('should return critical path', () => {
      system.createNewProject('Test');
      system.addMilestone('M1');

      const critical = system.getCriticalPath();

      expect(critical).toBeDefined();
    });
  });

  describe('initProject', () => {
    it('should initialize a new project and save', () => {
      const filePath = path.join(tempDir, 'PROJECT.md');
      const sys = new GSDSystem({ autoSave: false, projectFileName: filePath });

      sys.initProject('Init Test', 'Description');

      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('name: Init Test');
    });
  });

  describe('static methods', () => {
    describe('hasProjectFile', () => {
      it('should return true when PROJECT.md exists', () => {
        fs.writeFileSync(path.join(tempDir, 'PROJECT.md'), '---\nname: Test\n---\n', 'utf-8');

        expect(GSDSystem.hasProjectFile(tempDir)).toBe(true);
      });

      it('should return false when PROJECT.md does not exist', () => {
        expect(GSDSystem.hasProjectFile(tempDir)).toBe(false);
      });
    });

    describe('findProjectFile', () => {
      it('should find PROJECT.md in current directory', () => {
        fs.writeFileSync(path.join(tempDir, 'PROJECT.md'), '---\nname: Test\n---\n', 'utf-8');

        const found = GSDSystem.findProjectFile(tempDir);

        expect(found).toBe(path.join(tempDir, 'PROJECT.md'));
      });

      it('should return null when not found', () => {
        const found = GSDSystem.findProjectFile(tempDir);

        expect(found).toBeNull();
      });
    });
  });
});
