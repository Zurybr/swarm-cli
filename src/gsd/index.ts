/**
 * GSD (Get Shit Done) Framework Integration
 *
 * Main entry point for the GSD system. Provides a unified API for
 * project management using the GSD methodology.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Project,
  Milestone,
  Phase,
  Task,
  Roadmap,
  GSDStatus,
  GSDPriority,
  GSDConfig,
  DEFAULT_GSD_CONFIG,
  ParseOptions,
  ExportOptions,
  QueryFilters,
  ProgressUpdate,
  ValidationResult,
  CLIContext,
} from './types';

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
} from './project';

import {
  createMilestone,
  updateMilestoneStatus,
  addPhase,
  removePhase,
  reorderPhase,
  validateMilestone,
  getMilestoneStats,
  isMilestoneReady,
  canCompleteMilestone,
  blockMilestone,
  unblockMilestone,
  getNextPhase,
  cloneMilestone,
} from './milestone';

import {
  createPhase,
  updatePhaseStatus,
  addTask,
  createAndAddTask,
  removeTask,
  updateTaskStatus,
  validatePhase,
  getPhaseStats,
  isPhaseReady,
  canCompletePhase,
  blockPhase,
  unblockPhase,
  getNextTask,
  getTasksByPriority,
  getBlockedTasks,
  clonePhase,
  verifyExitCriteria,
} from './phase';

import {
  generateRoadmap,
  exportRoadmap,
  visualizeRoadmap,
  generateTimeline,
  getUpcomingItems,
  getCriticalPath,
} from './roadmap';

/**
 * Main GSD System class
 * Provides a unified interface for all GSD operations
 */
export class GSDSystem {
  private config: GSDConfig;
  private currentProject: Project | null = null;
  private projectPath: string | null = null;

  constructor(config: Partial<GSDConfig> = {}) {
    this.config = { ...DEFAULT_GSD_CONFIG, ...config };
  }

  // ==================== Project Operations ====================

  /**
   * Load a project from a file
   * @param filePath - Path to the PROJECT.md file
   * @param options - Parse options
   * @returns The loaded project
   */
  loadProject(filePath: string, options: ParseOptions = {}): Project {
    const result = parseProjectFile(filePath, options);

    if (!result.success || !result.project) {
      throw new Error(`Failed to load project: ${result.errors.join(', ')}`);
    }

    this.currentProject = result.project;
    this.projectPath = filePath;

    return result.project;
  }

  /**
   * Load a project from content string
   * @param content - The PROJECT.md content
   * @param options - Parse options
   * @returns The loaded project
   */
  loadProjectFromContent(content: string, options: ParseOptions = {}): Project {
    const result = parseProjectContent(content, options);

    if (!result.success || !result.project) {
      throw new Error(`Failed to load project: ${result.errors.join(', ')}`);
    }

    this.currentProject = result.project;
    return result.project;
  }

  /**
   * Create a new project
   * @param name - Project name
   * @param description - Project description
   * @returns The created project
   */
  createNewProject(name: string, description: string = ''): Project {
    const project = createProject(name, description);
    this.currentProject = project;
    return project;
  }

  /**
   * Save the current project
   * @param filePath - Optional path (uses loaded path or config default)
   */
  save(filePath?: string): void {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const savePath = filePath || this.projectPath || this.config.projectFileName;
    saveProject(this.currentProject, savePath);
  }

  /**
   * Get the current project
   * @returns The current project or null
   */
  getCurrentProject(): Project | null {
    return this.currentProject;
  }

  /**
   * Validate the current project
   * @returns Validation result
   */
  validate(): ValidationResult {
    if (!this.currentProject) {
      return {
        valid: false,
        errors: [{ field: 'project', message: 'No project loaded', code: 'NO_PROJECT' }],
        warnings: [],
      };
    }

    return validateProject(this.currentProject);
  }

  /**
   * Get project statistics
   * @returns Statistics object
   */
  getStats() {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    return getProjectStats(this.currentProject);
  }

  // ==================== Milestone Operations ====================

  /**
   * Add a milestone to the project
   * @param name - Milestone name
   * @param description - Milestone description
   * @returns The created milestone
   */
  addMilestone(name: string, description: string = ''): Milestone {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const order = this.currentProject.milestones.length;
    const milestone = createMilestone(name, description, order);
    this.currentProject.milestones.push(milestone);
    this.currentProject.updatedAt = new Date();

    if (this.config.autoSave) {
      this.save();
    }

    return milestone;
  }

  /**
   * Remove a milestone from the project
   * @param milestoneId - ID of the milestone to remove
   * @returns True if removed
   */
  removeMilestone(milestoneId: string): boolean {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const index = this.currentProject.milestones.findIndex(m => m.id === milestoneId);
    if (index === -1) return false;

    this.currentProject.milestones.splice(index, 1);

    // Reorder remaining milestones
    this.currentProject.milestones.forEach((m, i) => {
      m.order = i;
    });

    this.currentProject.updatedAt = new Date();

    if (this.config.autoSave) {
      this.save();
    }

    return true;
  }

  /**
   * Get a milestone by ID or name
   * @param identifier - ID or name
   * @returns The milestone or undefined
   */
  getMilestone(identifier: string): Milestone | undefined {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    return findMilestone(this.currentProject, identifier);
  }

  /**
   * Update milestone status
   * @param milestoneId - ID of the milestone
   * @returns Progress update if status changed
   */
  updateMilestone(milestoneId: string): ProgressUpdate | undefined {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const milestone = this.currentProject.milestones.find(m => m.id === milestoneId);
    if (!milestone) return undefined;

    const update = updateMilestoneStatus(milestone);

    if (update && this.config.autoSave) {
      this.save();
    }

    return update;
  }

  /**
   * Block a milestone
   * @param milestoneId - ID of the milestone
   * @param reason - Reason for blocking
   * @returns Progress update
   */
  blockMilestone(milestoneId: string, reason: string): ProgressUpdate | undefined {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const milestone = this.currentProject.milestones.find(m => m.id === milestoneId);
    if (!milestone) return undefined;

    const update = blockMilestone(milestone, reason);

    if (this.config.autoSave) {
      this.save();
    }

    return update;
  }

  /**
   * Unblock a milestone
   * @param milestoneId - ID of the milestone
   * @returns Progress update if status changed
   */
  unblockMilestone(milestoneId: string): ProgressUpdate | undefined {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const milestone = this.currentProject.milestones.find(m => m.id === milestoneId);
    if (!milestone) return undefined;

    const update = unblockMilestone(milestone);

    if (update && this.config.autoSave) {
      this.save();
    }

    return update;
  }

  // ==================== Phase Operations ====================

  /**
   * Add a phase to a milestone
   * @param milestoneId - ID of the parent milestone
   * @param name - Phase name
   * @param description - Phase description
   * @returns The created phase
   */
  addPhase(milestoneId: string, name: string, description: string = ''): Phase {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const milestone = this.currentProject.milestones.find(m => m.id === milestoneId);
    if (!milestone) {
      throw new Error(`Milestone not found: ${milestoneId}`);
    }

    const order = milestone.phases.length;
    const phase = createPhase(name, description, order);
    milestone.phases.push(phase);
    milestone.updatedAt = new Date();
    this.currentProject.updatedAt = new Date();

    if (this.config.autoSave) {
      this.save();
    }

    return phase;
  }

  /**
   * Remove a phase from a milestone
   * @param milestoneId - ID of the parent milestone
   * @param phaseId - ID of the phase to remove
   * @returns True if removed
   */
  removePhase(milestoneId: string, phaseId: string): boolean {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const milestone = this.currentProject.milestones.find(m => m.id === milestoneId);
    if (!milestone) return false;

    const result = removePhase(milestone, phaseId);

    if (result) {
      this.currentProject.updatedAt = new Date();
      if (this.config.autoSave) {
        this.save();
      }
    }

    return result;
  }

  /**
   * Get a phase by ID or name
   * @param identifier - ID or name
   * @returns Object with milestone and phase or undefined
   */
  getPhase(identifier: string): { milestone: Milestone; phase: Phase } | undefined {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    return findPhase(this.currentProject, identifier);
  }

  /**
   * Update phase status
   * @param milestoneId - ID of the parent milestone
   * @param phaseId - ID of the phase
   * @returns Progress update if status changed
   */
  updatePhase(milestoneId: string, phaseId: string): ProgressUpdate | undefined {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const milestone = this.currentProject.milestones.find(m => m.id === milestoneId);
    if (!milestone) return undefined;

    const phase = milestone.phases.find(p => p.id === phaseId);
    if (!phase) return undefined;

    const update = updatePhaseStatus(phase);

    // Also update milestone status
    if (update) {
      updateMilestoneStatus(milestone);
      this.currentProject.updatedAt = new Date();

      if (this.config.autoSave) {
        this.save();
      }
    }

    return update;
  }

  /**
   * Block a phase
   * @param milestoneId - ID of the parent milestone
   * @param phaseId - ID of the phase
   * @param reason - Reason for blocking
   * @returns Progress update
   */
  blockPhase(milestoneId: string, phaseId: string, reason: string): ProgressUpdate | undefined {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const milestone = this.currentProject.milestones.find(m => m.id === milestoneId);
    if (!milestone) return undefined;

    const phase = milestone.phases.find(p => p.id === phaseId);
    if (!phase) return undefined;

    const update = blockPhase(phase, reason);

    if (this.config.autoSave) {
      this.save();
    }

    return update;
  }

  /**
   * Unblock a phase
   * @param milestoneId - ID of the parent milestone
   * @param phaseId - ID of the phase
   * @returns Progress update if status changed
   */
  unblockPhase(milestoneId: string, phaseId: string): ProgressUpdate | undefined {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const milestone = this.currentProject.milestones.find(m => m.id === milestoneId);
    if (!milestone) return undefined;

    const phase = milestone.phases.find(p => p.id === phaseId);
    if (!phase) return undefined;

    const update = unblockPhase(phase);

    if (update && this.config.autoSave) {
      this.save();
    }

    return update;
  }

  // ==================== Task Operations ====================

  /**
   * Add a task to a phase
   * @param milestoneId - ID of the parent milestone
   * @param phaseId - ID of the parent phase
   * @param name - Task name
   * @param priority - Task priority
   * @returns The created task
   */
  addTask(
    milestoneId: string,
    phaseId: string,
    name: string,
    priority: GSDPriority = 'medium'
  ): Task {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const milestone = this.currentProject.milestones.find(m => m.id === milestoneId);
    if (!milestone) {
      throw new Error(`Milestone not found: ${milestoneId}`);
    }

    const phase = milestone.phases.find(p => p.id === phaseId);
    if (!phase) {
      throw new Error(`Phase not found: ${phaseId}`);
    }

    const task = createAndAddTask(phase, name, priority);

    if (this.config.autoSave) {
      this.save();
    }

    return task;
  }

  /**
   * Remove a task from a phase
   * @param milestoneId - ID of the parent milestone
   * @param phaseId - ID of the parent phase
   * @param taskId - ID of the task to remove
   * @returns True if removed
   */
  removeTask(milestoneId: string, phaseId: string, taskId: string): boolean {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const milestone = this.currentProject.milestones.find(m => m.id === milestoneId);
    if (!milestone) return false;

    const phase = milestone.phases.find(p => p.id === phaseId);
    if (!phase) return false;

    const result = removeTask(phase, taskId);

    if (result && this.config.autoSave) {
      this.save();
    }

    return result;
  }

  /**
   * Get a task by ID or name
   * @param identifier - ID or name
   * @returns Object with milestone, phase, and task or undefined
   */
  getTask(identifier: string): { milestone: Milestone; phase: Phase; task: Task } | undefined {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    return findTask(this.currentProject, identifier);
  }

  /**
   * Update task status
   * @param milestoneId - ID of the parent milestone
   * @param phaseId - ID of the parent phase
   * @param taskId - ID of the task
   * @param newStatus - New status
   * @param updatedBy - Who made the update
   * @returns Progress update if status changed
   */
  updateTask(
    milestoneId: string,
    phaseId: string,
    taskId: string,
    newStatus: GSDStatus,
    updatedBy?: string
  ): ProgressUpdate | undefined {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const milestone = this.currentProject.milestones.find(m => m.id === milestoneId);
    if (!milestone) return undefined;

    const phase = milestone.phases.find(p => p.id === phaseId);
    if (!phase) return undefined;

    const update = updateTaskStatus(phase, taskId, newStatus, updatedBy);

    if (update) {
      // Update phase and milestone status
      updatePhaseStatus(phase);
      updateMilestoneStatus(milestone);
      this.currentProject.updatedAt = new Date();

      if (this.config.autoSave) {
        this.save();
      }
    }

    return update;
  }

  /**
   * Complete a task
   * @param milestoneId - ID of the parent milestone
   * @param phaseId - ID of the parent phase
   * @param taskId - ID of the task
   * @param updatedBy - Who completed the task
   * @returns Progress update if status changed
   */
  completeTask(
    milestoneId: string,
    phaseId: string,
    taskId: string,
    updatedBy?: string
  ): ProgressUpdate | undefined {
    return this.updateTask(milestoneId, phaseId, taskId, 'completed', updatedBy);
  }

  // ==================== Roadmap Operations ====================

  /**
   * Generate a roadmap for the current project
   * @returns Roadmap object
   */
  generateRoadmap(): Roadmap {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    return generateRoadmap(this.currentProject);
  }

  /**
   * Export roadmap to a specific format
   * @param format - Export format
   * @param options - Additional export options
   * @returns Exported content
   */
  exportRoadmap(format: ExportOptions['format'], options: Partial<ExportOptions> = {}): string {
    const roadmap = this.generateRoadmap();
    return exportRoadmap(roadmap, { format, ...options } as ExportOptions);
  }

  /**
   * Get a text visualization of the roadmap
   * @returns ASCII visualization
   */
  visualizeRoadmap(): string {
    const roadmap = this.generateRoadmap();
    return visualizeRoadmap(roadmap);
  }

  /**
   * Get upcoming items
   * @param days - Number of days to look ahead
   * @returns Array of upcoming items
   */
  getUpcomingItems(days: number = 7) {
    const roadmap = this.generateRoadmap();
    return getUpcomingItems(roadmap, days);
  }

  /**
   * Get the critical path
   * @returns Array of blocking items
   */
  getCriticalPath() {
    const roadmap = this.generateRoadmap();
    return getCriticalPath(roadmap);
  }

  // ==================== Utility Operations ====================

  /**
   * Initialize a new project in the current directory
   * @param name - Project name
   * @param description - Project description
   */
  initProject(name: string, description: string = ''): void {
    const project = createProject(name, description);
    this.currentProject = project;
    this.projectPath = this.config.projectFileName;
    this.save();
  }

  /**
   * Check if a PROJECT.md file exists in the given directory
   * @param dir - Directory to check (defaults to current)
   * @returns True if PROJECT.md exists
   */
  static hasProjectFile(dir: string = '.'): boolean {
    const projectPath = path.join(dir, DEFAULT_GSD_CONFIG.projectFileName);
    return fs.existsSync(projectPath);
  }

  /**
   * Find PROJECT.md file in current or parent directories
   * @param startDir - Directory to start searching from
   * @returns Path to PROJECT.md or null
   */
  static findProjectFile(startDir: string = '.'): string | null {
    let currentDir = path.resolve(startDir);

    while (currentDir !== path.dirname(currentDir)) {
      const projectPath = path.join(currentDir, DEFAULT_GSD_CONFIG.projectFileName);
      if (fs.existsSync(projectPath)) {
        return projectPath;
      }
      currentDir = path.dirname(currentDir);
    }

    return null;
  }
}

// Re-export all types and functions
export * from './types';
export * from './project';
export * from './milestone';
export * from './phase';
export * from './roadmap';
export * from './state-manager';
export * from './plan-parser';
export * from './verification-system';
export * from './checkpoint-system';
export * from './wave-executor';

// Default export
export default GSDSystem;
