/**
 * PROJECT.md Parser and Manager
 *
 * Handles parsing and serialization of PROJECT.md files with YAML frontmatter
 * and markdown content. Manages the project lifecycle.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import {
  Project,
  Milestone,
  Phase,
  Task,
  ProjectMetadata,
  ParseOptions,
  ParseResult,
  ValidationResult,
  GSDStatus,
  GSDPriority,
  DEFAULT_GSD_CONFIG,
  GSDConfig,
} from './types';

/** Regular expression to match YAML frontmatter */
const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

/** Default project values */
const DEFAULT_PROJECT: Partial<Project> = {
  status: 'not_started',
  team: [],
  milestones: [],
  metadata: {
    tags: [],
    customFields: {},
  },
};

/**
 * Parse a PROJECT.md file
 * @param filePath - Path to the PROJECT.md file
 * @param options - Parsing options
 * @returns ParseResult with project data or errors
 */
export function parseProjectFile(
  filePath: string,
  options: ParseOptions = {}
): ParseResult {
  const opts = { validate: true, strict: false, allowUnknownFields: true, ...options };
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        errors: [`Project file not found: ${filePath}`],
        warnings: [],
      };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return parseProjectContent(content, opts);
  } catch (error) {
    return {
      success: false,
      errors: [`Failed to read project file: ${(error as Error).message}`],
      warnings,
    };
  }
}

/**
 * Parse PROJECT.md content directly
 * @param content - The markdown content to parse
 * @param options - Parsing options
 * @returns ParseResult with project data or errors
 */
export function parseProjectContent(
  content: string,
  options: ParseOptions = {}
): ParseResult {
  const opts = { validate: true, strict: false, allowUnknownFields: true, ...options };
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const match = content.match(FRONTMATTER_REGEX);

    if (!match) {
      return {
        success: false,
        errors: ['Invalid PROJECT.md format: missing YAML frontmatter'],
        warnings: [],
      };
    }

    const [, yamlContent, markdownContent] = match;
    let frontmatter: Record<string, unknown>;

    try {
      frontmatter = yaml.parse(yamlContent) || {};
    } catch (yamlError) {
      return {
        success: false,
        errors: [`YAML parsing error: ${(yamlError as Error).message}`],
        warnings: [],
      };
    }

    // Parse milestones from markdown content
    const milestones = parseMilestonesFromMarkdown(markdownContent, errors, warnings);

    // Build project object
    const project: Project = {
      id: frontmatter.id as string || generateId(),
      name: frontmatter.name as string || 'Untitled Project',
      description: frontmatter.description as string || extractDescription(markdownContent),
      version: frontmatter.version as string || '1.0.0',
      status: parseStatus(frontmatter.status) || 'not_started',
      owner: frontmatter.owner as string | undefined,
      team: parseStringArray(frontmatter.team),
      milestones,
      startDate: parseDate(frontmatter.startDate),
      targetDate: parseDate(frontmatter.targetDate),
      completedAt: parseDate(frontmatter.completedAt),
      metadata: parseMetadata(frontmatter.metadata),
      createdAt: parseDate(frontmatter.createdAt) || new Date(),
      updatedAt: parseDate(frontmatter.updatedAt) || new Date(),
    };

    if (opts.validate) {
      const validation = validateProject(project);
      errors.push(...validation.errors.map(e => e.message));
      warnings.push(...validation.warnings.map(w => w.message));
    }

    if (opts.strict && errors.length > 0) {
      return { success: false, errors, warnings };
    }

    return {
      success: errors.length === 0,
      project,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Parse error: ${(error as Error).message}`],
      warnings,
    };
  }
}

/**
 * Serialize a project to PROJECT.md format
 * @param project - The project to serialize
 * @returns The serialized markdown content
 */
export function serializeProject(project: Project): string {
  const frontmatter = {
    id: project.id,
    name: project.name,
    description: project.description,
    version: project.version,
    status: project.status,
    owner: project.owner,
    team: project.team,
    startDate: formatDate(project.startDate),
    targetDate: formatDate(project.targetDate),
    completedAt: formatDate(project.completedAt),
    metadata: project.metadata,
    createdAt: formatDate(project.createdAt),
    updatedAt: new Date().toISOString(),
  };

  const yamlContent = yaml.stringify(frontmatter, {
    sortMapEntries: false,
    lineWidth: 0,
  });

  const markdownContent = serializeMilestones(project.milestones);

  return `---\n${yamlContent}---\n\n${markdownContent}`;
}

/**
 * Save a project to a file
 * @param project - The project to save
 * @param filePath - Path to save the file (defaults to PROJECT.md in current directory)
 */
export function saveProject(
  project: Project,
  filePath: string = 'PROJECT.md'
): void {
  const content = serializeProject(project);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Create a new project with defaults
 * @param name - Project name
 * @param description - Project description
 * @returns A new project instance
 */
export function createProject(name: string, description: string = ''): Project {
  const now = new Date();
  return {
    ...DEFAULT_PROJECT,
    id: generateId(),
    name,
    description,
    version: '1.0.0',
    status: 'not_started',
    team: [],
    milestones: [],
    metadata: {
      tags: [],
      customFields: {},
    },
    createdAt: now,
    updatedAt: now,
  } as Project;
}

/**
 * Validate a project structure
 * @param project - The project to validate
 * @returns ValidationResult with errors and warnings
 */
export function validateProject(project: Project): ValidationResult {
  const errors: { field: string; message: string; code: string }[] = [];
  const warnings: { field: string; message: string; suggestion?: string }[] = [];

  // Required fields
  if (!project.id) {
    errors.push({ field: 'id', message: 'Project ID is required', code: 'MISSING_ID' });
  }

  if (!project.name || project.name.trim() === '') {
    errors.push({ field: 'name', message: 'Project name is required', code: 'MISSING_NAME' });
  }

  if (!project.description || project.description.trim() === '') {
    warnings.push({
      field: 'description',
      message: 'Project description is empty',
      suggestion: 'Add a meaningful description to help team members understand the project',
    });
  }

  // Validate version format (semver-like)
  if (!project.version || !/^\d+\.\d+\.\d+/.test(project.version)) {
    warnings.push({
      field: 'version',
      message: 'Version should follow semantic versioning (e.g., 1.0.0)',
    });
  }

  // Validate dates
  if (project.targetDate && project.startDate && project.targetDate < project.startDate) {
    errors.push({
      field: 'targetDate',
      message: 'Target date cannot be before start date',
      code: 'INVALID_DATE_RANGE',
    });
  }

  // Validate milestones
  project.milestones?.forEach((milestone, index) => {
    const milestoneErrors = validateMilestone(milestone);
    errors.push(...milestoneErrors.map(msg => ({
      field: `milestones[${index}]`,
      message: msg,
      code: 'INVALID_MILESTONE',
    })));
  });

  // Check for duplicate milestone names
  const milestoneNames = project.milestones?.map(m => m.name) || [];
  const duplicates = milestoneNames.filter((item, index) => milestoneNames.indexOf(item) !== index);
  if (duplicates.length > 0) {
    warnings.push({
      field: 'milestones',
      message: `Duplicate milestone names found: ${duplicates.join(', ')}`,
      suggestion: 'Use unique names for milestones to avoid confusion',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get project statistics
 * @param project - The project to analyze
 * @returns Statistics object
 */
export function getProjectStats(project: Project): {
  totalMilestones: number;
  totalPhases: number;
  totalTasks: number;
  completedMilestones: number;
  completedPhases: number;
  completedTasks: number;
  progressPercent: number;
} {
  const totalMilestones = project.milestones.length;
  const completedMilestones = project.milestones.filter(m => m.status === 'completed').length;

  const totalPhases = project.milestones.reduce((sum, m) => sum + m.phases.length, 0);
  const completedPhases = project.milestones.reduce(
    (sum, m) => sum + m.phases.filter(p => p.status === 'completed').length,
    0
  );

  const totalTasks = project.milestones.reduce(
    (sum, m) => sum + m.phases.reduce((psum, p) => psum + p.tasks.length, 0),
    0
  );
  const completedTasks = project.milestones.reduce(
    (sum, m) =>
      sum +
      m.phases.reduce(
        (psum, p) => psum + p.tasks.filter(t => t.status === 'completed').length,
        0
      ),
    0
  );

  const totalItems = totalMilestones + totalPhases + totalTasks;
  const completedItems = completedMilestones + completedPhases + completedTasks;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return {
    totalMilestones,
    totalPhases,
    totalTasks,
    completedMilestones,
    completedPhases,
    completedTasks,
    progressPercent,
  };
}

/**
 * Find a milestone by ID or name
 * @param project - The project to search
 * @param identifier - ID or name to search for
 * @returns The milestone or undefined
 */
export function findMilestone(project: Project, identifier: string): Milestone | undefined {
  return project.milestones.find(
    m => m.id === identifier || m.name.toLowerCase() === identifier.toLowerCase()
  );
}

/**
 * Find a phase by ID or name within a project
 * @param project - The project to search
 * @param identifier - ID or name to search for
 * @returns Object with milestone and phase, or undefined
 */
export function findPhase(
  project: Project,
  identifier: string
): { milestone: Milestone; phase: Phase } | undefined {
  for (const milestone of project.milestones) {
    const phase = milestone.phases.find(
      p => p.id === identifier || p.name.toLowerCase() === identifier.toLowerCase()
    );
    if (phase) {
      return { milestone, phase };
    }
  }
  return undefined;
}

/**
 * Find a task by ID or name within a project
 * @param project - The project to search
 * @param identifier - ID or name to search for
 * @returns Object with milestone, phase, and task, or undefined
 */
export function findTask(
  project: Project,
  identifier: string
): { milestone: Milestone; phase: Phase; task: Task } | undefined {
  for (const milestone of project.milestones) {
    for (const phase of milestone.phases) {
      const task = phase.tasks.find(
        t => t.id === identifier || t.name.toLowerCase() === identifier.toLowerCase()
      );
      if (task) {
        return { milestone, phase, task };
      }
    }
  }
  return undefined;
}

// Helper functions

function parseMilestonesFromMarkdown(
  content: string,
  errors: string[],
  warnings: string[]
): Milestone[] {
  const milestones: Milestone[] = [];
  const milestoneRegex = /^##\s+Milestone:\s+(.+)$/gm;
  const phaseRegex = /^###\s+Phase:\s+(.+)$/gm;
  const taskRegex = /^-\s+\[(.)\]\s+(.+)$/gm;

  let milestoneMatch;
  let milestoneOrder = 0;

  // Reset regex lastIndex
  milestoneRegex.lastIndex = 0;

  while ((milestoneMatch = milestoneRegex.exec(content)) !== null) {
    const milestoneName = milestoneMatch[1].trim();
    const milestoneStart = milestoneMatch.index;
    const nextMilestoneMatch = milestoneRegex.exec(content);
    const milestoneEnd = nextMilestoneMatch ? nextMilestoneMatch.index : content.length;

    // Reset lastIndex for next iteration
    if (nextMilestoneMatch) {
      milestoneRegex.lastIndex = nextMilestoneMatch.index;
    }

    const milestoneContent = content.substring(milestoneStart, milestoneEnd);

    // Parse phases within this milestone
    const phases: Phase[] = [];
    let phaseMatch;
    let phaseOrder = 0;

    phaseRegex.lastIndex = 0;

    while ((phaseMatch = phaseRegex.exec(milestoneContent)) !== null) {
      const phaseName = phaseMatch[1].trim();
      const phaseStart = phaseMatch.index;
      const nextPhaseMatch = phaseRegex.exec(milestoneContent);
      const phaseEnd = nextPhaseMatch ? nextPhaseMatch.index : milestoneContent.length;

      if (nextPhaseMatch) {
        phaseRegex.lastIndex = nextPhaseMatch.index;
      }

      const phaseContent = milestoneContent.substring(phaseStart, phaseEnd);

      // Parse tasks within this phase
      const tasks: Task[] = [];
      let taskMatch;

      taskRegex.lastIndex = 0;

      while ((taskMatch = taskRegex.exec(phaseContent)) !== null) {
        const status = taskMatch[1];
        const taskName = taskMatch[2].trim();

        tasks.push({
          id: generateId(),
          name: taskName,
          description: '',
          status: status === 'x' ? 'completed' : 'not_started',
          priority: 'medium',
          dependencies: [],
          deliverables: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      phases.push({
        id: generateId(),
        name: phaseName,
        description: '',
        status: calculatePhaseStatus(tasks),
        order: phaseOrder++,
        tasks,
        deliverables: [],
        entryCriteria: [],
        exitCriteria: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    milestones.push({
      id: generateId(),
      name: milestoneName,
      description: '',
      status: calculateMilestoneStatus(phases),
      order: milestoneOrder++,
      phases,
      deliverables: [],
      successCriteria: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return milestones;
}

function calculatePhaseStatus(tasks: Task[]): GSDStatus {
  if (tasks.length === 0) return 'not_started';
  if (tasks.every(t => t.status === 'completed')) return 'completed';
  if (tasks.some(t => t.status === 'in_progress')) return 'in_progress';
  if (tasks.some(t => t.status === 'completed')) return 'in_progress';
  return 'not_started';
}

function calculateMilestoneStatus(phases: Phase[]): GSDStatus {
  if (phases.length === 0) return 'not_started';
  if (phases.every(p => p.status === 'completed')) return 'completed';
  if (phases.some(p => p.status === 'in_progress')) return 'in_progress';
  if (phases.some(p => p.status === 'completed')) return 'in_progress';
  return 'not_started';
}

function serializeMilestones(milestones: Milestone[]): string {
  if (milestones.length === 0) {
    return '## Project Roadmap\n\nNo milestones defined yet.\n';
  }

  const lines: string[] = ['## Project Roadmap\n'];

  for (const milestone of milestones.sort((a, b) => a.order - b.order)) {
    lines.push(`## Milestone: ${milestone.name}`);
    lines.push('');

    if (milestone.description) {
      lines.push(milestone.description);
      lines.push('');
    }

    if (milestone.successCriteria.length > 0) {
      lines.push('**Success Criteria:**');
      for (const criteria of milestone.successCriteria) {
        lines.push(`- ${criteria}`);
      }
      lines.push('');
    }

    for (const phase of milestone.phases.sort((a, b) => a.order - b.order)) {
      lines.push(`### Phase: ${phase.name}`);
      lines.push('');

      if (phase.description) {
        lines.push(phase.description);
        lines.push('');
      }

      for (const task of phase.tasks) {
        const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
        lines.push(`- ${checkbox} ${task.name}`);
      }

      lines.push('');
    }
  }

  return lines.join('\n');
}

function extractDescription(content: string): string {
  // Try to extract the first paragraph after any headers
  const lines = content.split('\n');
  let foundHeader = false;

  for (const line of lines) {
    if (line.startsWith('#')) {
      foundHeader = true;
      continue;
    }
    if (foundHeader && line.trim() && !line.startsWith('#')) {
      return line.trim();
    }
  }

  return '';
}

function parseStatus(status: unknown): GSDStatus | undefined {
  const validStatuses: GSDStatus[] = ['not_started', 'in_progress', 'blocked', 'completed', 'cancelled'];
  if (typeof status === 'string' && validStatuses.includes(status as GSDStatus)) {
    return status as GSDStatus;
  }
  return undefined;
}

function parsePriority(priority: unknown): GSDPriority | undefined {
  const validPriorities: GSDPriority[] = ['critical', 'high', 'medium', 'low'];
  if (typeof priority === 'string' && validPriorities.includes(priority as GSDPriority)) {
    return priority as GSDPriority;
  }
  return undefined;
}

function parseDate(date: unknown): Date | undefined {
  if (date instanceof Date) return date;
  if (typeof date === 'string') {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

function formatDate(date: Date | undefined): string | undefined {
  return date?.toISOString();
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  if (typeof value === 'string') {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function parseMetadata(metadata: unknown): ProjectMetadata {
  if (typeof metadata === 'object' && metadata !== null) {
    const m = metadata as Record<string, unknown>;
    return {
      tags: parseStringArray(m.tags),
      category: typeof m.category === 'string' ? m.category : undefined,
      repository: typeof m.repository === 'string' ? m.repository : undefined,
      documentationUrl: typeof m.documentationUrl === 'string' ? m.documentationUrl : undefined,
      customFields: (typeof m.customFields === 'object' && m.customFields !== null)
        ? m.customFields as Record<string, string>
        : {},
    };
  }
  return { tags: [], customFields: {} };
}

function validateMilestone(milestone: Milestone): string[] {
  const errors: string[] = [];

  if (!milestone.name || milestone.name.trim() === '') {
    errors.push('Milestone name is required');
  }

  if (milestone.phases.length === 0) {
    errors.push(`Milestone "${milestone.name}" has no phases`);
  }

  return errors;
}

function generateId(): string {
  return `gsd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Re-export types
export * from './types';
