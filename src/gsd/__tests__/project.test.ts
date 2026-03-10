/**
 * Tests for PROJECT.md Parser and Manager
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  parseProjectFile,
  parseProjectContent,
  serializeProject,
  saveProject,
  createProject,
  validateProject,
  getProjectStats,
  findMilestone,
  findPhase,
  findTask,
} from '../project';
import { Project, Milestone, Phase, Task } from '../types';

describe('Project Parser and Manager', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('createProject', () => {
    it('should create a project with default values', () => {
      const project = createProject('Test Project', 'Test Description');

      expect(project.name).toBe('Test Project');
      expect(project.description).toBe('Test Description');
      expect(project.version).toBe('1.0.0');
      expect(project.status).toBe('not_started');
      expect(project.milestones).toEqual([]);
      expect(project.team).toEqual([]);
    });

    it('should generate unique IDs', () => {
      const project1 = createProject('Project 1');
      const project2 = createProject('Project 2');

      expect(project1.id).not.toBe(project2.id);
    });
  });

  describe('parseProjectContent', () => {
    it('should parse valid PROJECT.md content', () => {
      const content = `---
id: test_project
name: Test Project
description: A test project
version: 1.0.0
status: in_progress
---

# Test Project

This is a test project.

## Milestone: First Milestone

Description of the milestone.

### Phase: First Phase

Description of the phase.

- [ ] Task 1
- [x] Task 2
- [ ] Task 3
`;

      const result = parseProjectContent(content);

      expect(result.success).toBe(true);
      expect(result.project).toBeDefined();
      expect(result.project!.name).toBe('Test Project');
      expect(result.project!.status).toBe('in_progress');
      expect(result.project!.milestones).toHaveLength(1);
      expect(result.project!.milestones[0].name).toBe('First Milestone');
      expect(result.project!.milestones[0].phases).toHaveLength(1);
      expect(result.project!.milestones[0].phases[0].tasks).toHaveLength(3);
    });

    it('should handle missing frontmatter', () => {
      const content = '# Just a markdown file\n\nNo frontmatter here.';
      const result = parseProjectContent(content);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid PROJECT.md format: missing YAML frontmatter');
    });

    it('should handle invalid YAML', () => {
      const content = `---
name: "unclosed string
---

# Project
`;
      const result = parseProjectContent(content);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('YAML parsing error'))).toBe(true);
    });

    it('should parse multiple milestones and phases', () => {
      const content = `---
name: Multi-Milestone Project
---

# Project

## Milestone: Milestone 1

### Phase: Phase 1A

- [ ] Task 1

### Phase: Phase 1B

- [x] Task 2

## Milestone: Milestone 2

### Phase: Phase 2A

- [ ] Task 3
`;

      const result = parseProjectContent(content);

      expect(result.success).toBe(true);
      expect(result.project!.milestones).toHaveLength(2);
      expect(result.project!.milestones[0].phases).toHaveLength(2);
      expect(result.project!.milestones[1].phases).toHaveLength(1);
    });
  });

  describe('parseProjectFile', () => {
    it('should parse a file from disk', () => {
      const content = `---
name: File Test Project
---

# File Test

## Milestone: Test

### Phase: Test Phase

- [ ] Test Task
`;
      const filePath = path.join(tempDir, 'PROJECT.md');
      fs.writeFileSync(filePath, content, 'utf-8');

      const result = parseProjectFile(filePath);

      expect(result.success).toBe(true);
      expect(result.project!.name).toBe('File Test Project');
    });

    it('should handle missing file', () => {
      const result = parseProjectFile(path.join(tempDir, 'nonexistent.md'));

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('not found'))).toBe(true);
    });
  });

  describe('serializeProject', () => {
    it('should serialize a project to markdown', () => {
      const project = createProject('Serialize Test', 'Test serialization');
      const content = serializeProject(project);

      expect(content).toContain('---');
      expect(content).toContain('name: Serialize Test');
      expect(content).toContain('# Project Roadmap');
    });

    it('should include milestones in serialization', () => {
      const project = createProject('Test');
      const milestone: Milestone = {
        id: 'm1',
        name: 'Test Milestone',
        description: 'Milestone description',
        status: 'not_started',
        order: 0,
        phases: [],
        deliverables: [],
        successCriteria: ['Criterion 1'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      project.milestones.push(milestone);

      const content = serializeProject(project);

      expect(content).toContain('## Milestone: Test Milestone');
      expect(content).toContain('**Success Criteria:**');
      expect(content).toContain('- Criterion 1');
    });
  });

  describe('saveProject', () => {
    it('should save a project to disk', () => {
      const project = createProject('Save Test');
      const filePath = path.join(tempDir, 'PROJECT.md');

      saveProject(project, filePath);

      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('name: Save Test');
    });

    it('should create directories if needed', () => {
      const project = createProject('Nested Test');
      const filePath = path.join(tempDir, 'nested', 'dir', 'PROJECT.md');

      saveProject(project, filePath);

      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('validateProject', () => {
    it('should validate a valid project', () => {
      const project = createProject('Valid Project', 'A valid description');
      const result = validateProject(project);

      expect(result.valid).toBe(true);
    });

    it('should detect missing name', () => {
      const project = createProject('');
      project.name = '';

      const result = validateProject(project);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
    });

    it('should warn about empty description', () => {
      const project = createProject('Test');
      project.description = '';

      const result = validateProject(project);

      expect(result.warnings.some(w => w.field === 'description')).toBe(true);
    });

    it('should detect invalid date ranges', () => {
      const project = createProject('Test');
      project.startDate = new Date('2024-12-01');
      project.targetDate = new Date('2024-01-01');

      const result = validateProject(project);

      expect(result.errors.some(e => e.field === 'targetDate')).toBe(true);
    });

    it('should warn about duplicate milestone names', () => {
      const project = createProject('Test');
      const m1 = createMilestone('Same Name');
      const m2 = createMilestone('Same Name');
      project.milestones.push(m1, m2);

      const result = validateProject(project);

      expect(result.warnings.some(w => w.field === 'milestones')).toBe(true);
    });
  });

  describe('getProjectStats', () => {
    it('should calculate project statistics', () => {
      const project = createProject('Stats Test');
      const milestone = createMilestone('M1');
      const phase = createPhase('P1');
      const task1: Task = {
        id: 't1',
        name: 'Task 1',
        description: '',
        status: 'completed',
        priority: 'medium',
        dependencies: [],
        deliverables: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
      };
      const task2: Task = {
        id: 't2',
        name: 'Task 2',
        description: '',
        status: 'not_started',
        priority: 'medium',
        dependencies: [],
        deliverables: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      phase.tasks.push(task1, task2);
      milestone.phases.push(phase);
      project.milestones.push(milestone);

      const stats = getProjectStats(project);

      expect(stats.totalMilestones).toBe(1);
      expect(stats.totalPhases).toBe(1);
      expect(stats.totalTasks).toBe(2);
      expect(stats.completedTasks).toBe(1);
      expect(stats.progressPercent).toBe(33); // 1/3 rounded
    });

    it('should handle empty projects', () => {
      const project = createProject('Empty');
      const stats = getProjectStats(project);

      expect(stats.totalMilestones).toBe(0);
      expect(stats.progressPercent).toBe(0);
    });
  });

  describe('findMilestone', () => {
    it('should find milestone by ID', () => {
      const project = createProject('Test');
      const milestone = createMilestone('Test Milestone');
      project.milestones.push(milestone);

      const found = findMilestone(project, milestone.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(milestone.id);
    });

    it('should find milestone by name', () => {
      const project = createProject('Test');
      const milestone = createMilestone('Test Milestone');
      project.milestones.push(milestone);

      const found = findMilestone(project, 'Test Milestone');

      expect(found).toBeDefined();
      expect(found!.name).toBe('Test Milestone');
    });

    it('should return undefined for non-existent milestone', () => {
      const project = createProject('Test');
      const found = findMilestone(project, 'nonexistent');

      expect(found).toBeUndefined();
    });
  });

  describe('findPhase', () => {
    it('should find phase by ID', () => {
      const project = createProject('Test');
      const milestone = createMilestone('M1');
      const phase = createPhase('P1');
      milestone.phases.push(phase);
      project.milestones.push(milestone);

      const result = findPhase(project, phase.id);

      expect(result).toBeDefined();
      expect(result!.phase.id).toBe(phase.id);
      expect(result!.milestone.id).toBe(milestone.id);
    });
  });

  describe('findTask', () => {
    it('should find task by ID', () => {
      const project = createProject('Test');
      const milestone = createMilestone('M1');
      const phase = createPhase('P1');
      const task: Task = {
        id: 'task_123',
        name: 'Test Task',
        description: '',
        status: 'not_started',
        priority: 'medium',
        dependencies: [],
        deliverables: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      phase.tasks.push(task);
      milestone.phases.push(phase);
      project.milestones.push(milestone);

      const result = findTask(project, 'task_123');

      expect(result).toBeDefined();
      expect(result!.task.id).toBe('task_123');
    });
  });
});

// Helper functions for tests
function createMilestone(name: string): Milestone {
  return {
    id: `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description: '',
    status: 'not_started',
    order: 0,
    phases: [],
    deliverables: [],
    successCriteria: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createPhase(name: string): Phase {
  return {
    id: `phase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description: '',
    status: 'not_started',
    order: 0,
    tasks: [],
    deliverables: [],
    entryCriteria: [],
    exitCriteria: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
