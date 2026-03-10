/**
 * GSD (Get Shit Done) Framework Types
 *
 * Defines the core data structures for project management using the GSD methodology.
 * GSD organizes work into Projects -> Milestones -> Phases with clear deliverables.
 */

/** Status values for GSD entities */
export type GSDStatus =
  | 'not_started'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled';

/** Priority levels for tasks and phases */
export type GSDPriority = 'critical' | 'high' | 'medium' | 'low';

/** A task within a phase */
export interface Task {
  id: string;
  name: string;
  description: string;
  status: GSDStatus;
  priority: GSDPriority;
  assignee?: string;
  estimatedHours?: number;
  actualHours?: number;
  dependencies: string[];
  deliverables: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/** A phase within a milestone */
export interface Phase {
  id: string;
  name: string;
  description: string;
  status: GSDStatus;
  order: number;
  tasks: Task[];
  deliverables: string[];
  entryCriteria: string[];
  exitCriteria: string[];
  startDate?: Date;
  targetDate?: Date;
  completedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A milestone within a project */
export interface Milestone {
  id: string;
  name: string;
  description: string;
  status: GSDStatus;
  order: number;
  phases: Phase[];
  deliverables: string[];
  startDate?: Date;
  targetDate?: Date;
  completedAt?: Date;
  successCriteria: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** The main project structure */
export interface Project {
  id: string;
  name: string;
  description: string;
  version: string;
  status: GSDStatus;
  owner?: string;
  team: string[];
  milestones: Milestone[];
  startDate?: Date;
  targetDate?: Date;
  completedAt?: Date;
  metadata: ProjectMetadata;
  createdAt: Date;
  updatedAt: Date;
}

/** Project metadata for tracking and organization */
export interface ProjectMetadata {
  tags: string[];
  category?: string;
  repository?: string;
  documentationUrl?: string;
  customFields: Record<string, string>;
}

/** Roadmap view of the project */
export interface Roadmap {
  projectId: string;
  projectName: string;
  generatedAt: Date;
  milestones: RoadmapMilestone[];
  summary: RoadmapSummary;
}

/** Milestone view for roadmap */
export interface RoadmapMilestone {
  id: string;
  name: string;
  status: GSDStatus;
  order: number;
  phaseCount: number;
  completedPhases: number;
  progressPercent: number;
  targetDate?: Date;
  phases: RoadmapPhase[];
}

/** Phase view for roadmap */
export interface RoadmapPhase {
  id: string;
  name: string;
  status: GSDStatus;
  order: number;
  taskCount: number;
  completedTasks: number;
  progressPercent: number;
  targetDate?: Date;
}

/** Summary statistics for roadmap */
export interface RoadmapSummary {
  totalMilestones: number;
  completedMilestones: number;
  totalPhases: number;
  completedPhases: number;
  totalTasks: number;
  completedTasks: number;
  overallProgressPercent: number;
  estimatedCompletionDate?: Date;
}

/** Progress update for any GSD entity */
export interface ProgressUpdate {
  entityId: string;
  entityType: 'project' | 'milestone' | 'phase' | 'task';
  oldStatus: GSDStatus;
  newStatus: GSDStatus;
  updatedBy?: string;
  updatedAt: Date;
  note?: string;
}

/** Validation result for GSD entities */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/** Validation error */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/** Validation warning */
export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

/** Filter options for querying GSD entities */
export interface QueryFilters {
  status?: GSDStatus | GSDStatus[];
  priority?: GSDPriority | GSDPriority[];
  assignee?: string;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  tags?: string[];
}

/** Options for parsing PROJECT.md files */
export interface ParseOptions {
  strict?: boolean;
  validate?: boolean;
  allowUnknownFields?: boolean;
}

/** Result of parsing a PROJECT.md file */
export interface ParseResult {
  success: boolean;
  project?: Project;
  errors: string[];
  warnings: string[];
}

/** Export options for roadmap visualization */
export interface ExportOptions {
  format: 'json' | 'markdown' | 'html' | 'svg';
  includeCompleted?: boolean;
  includeDetails?: boolean;
  theme?: 'light' | 'dark';
}

/** CLI command context */
export interface CLIContext {
  projectPath: string;
  verbose: boolean;
  dryRun: boolean;
}

/** GSD Configuration */
export interface GSDConfig {
  projectFileName: string;
  autoSave: boolean;
  defaultPriority: GSDPriority;
  enforceDependencies: boolean;
  notifyOnBlock: boolean;
}

/** Default GSD configuration */
export const DEFAULT_GSD_CONFIG: GSDConfig = {
  projectFileName: 'PROJECT.md',
  autoSave: true,
  defaultPriority: 'medium',
  enforceDependencies: true,
  notifyOnBlock: true,
};
