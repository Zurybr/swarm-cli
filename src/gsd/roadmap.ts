/**
 * Roadmap Generation and Visualization
 *
 * Generates roadmap views, visualizations, and exports for GSD projects.
 */

import {
  Project,
  Milestone,
  Phase,
  Roadmap,
  RoadmapMilestone,
  RoadmapPhase,
  RoadmapSummary,
  ExportOptions,
  GSDStatus,
} from './types';
import { getProjectStats } from './project';

/**
 * Generate a roadmap view from a project
 * @param project - The project to generate roadmap for
 * @returns Roadmap view
 */
export function generateRoadmap(project: Project): Roadmap {
  const stats = getProjectStats(project);

  const roadmapMilestones: RoadmapMilestone[] = project.milestones
    .sort((a, b) => a.order - b.order)
    .map(milestone => ({
      id: milestone.id,
      name: milestone.name,
      status: milestone.status,
      order: milestone.order,
      phaseCount: milestone.phases.length,
      completedPhases: milestone.phases.filter(p => p.status === 'completed').length,
      progressPercent: calculateMilestoneProgress(milestone),
      targetDate: milestone.targetDate,
      phases: milestone.phases
        .sort((a, b) => a.order - b.order)
        .map(phase => ({
          id: phase.id,
          name: phase.name,
          status: phase.status,
          order: phase.order,
          taskCount: phase.tasks.length,
          completedTasks: phase.tasks.filter(t => t.status === 'completed').length,
          progressPercent: calculatePhaseProgress(phase),
          targetDate: phase.targetDate,
        })),
    }));

  const summary: RoadmapSummary = {
    totalMilestones: stats.totalMilestones,
    completedMilestones: stats.completedMilestones,
    totalPhases: stats.totalPhases,
    completedPhases: stats.completedPhases,
    totalTasks: stats.totalTasks,
    completedTasks: stats.completedTasks,
    overallProgressPercent: stats.progressPercent,
    estimatedCompletionDate: calculateEstimatedCompletion(project),
  };

  return {
    projectId: project.id,
    projectName: project.name,
    generatedAt: new Date(),
    milestones: roadmapMilestones,
    summary,
  };
}

/**
 * Export roadmap to various formats
 * @param roadmap - The roadmap to export
 * @param options - Export options
 * @returns Exported content as string
 */
export function exportRoadmap(roadmap: Roadmap, options: ExportOptions): string {
  switch (options.format) {
    case 'json':
      return exportToJson(roadmap, options);
    case 'markdown':
      return exportToMarkdown(roadmap, options);
    case 'html':
      return exportToHtml(roadmap, options);
    case 'svg':
      return exportToSvg(roadmap, options);
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}

/**
 * Generate a text-based visualization of the roadmap
 * @param roadmap - The roadmap to visualize
 * @returns ASCII art representation
 */
export function visualizeRoadmap(roadmap: Roadmap): string {
  const lines: string[] = [];

  lines.push('╔════════════════════════════════════════════════════════════════╗');
  lines.push(`║  ${roadmap.projectName.padEnd(60)} ║`);
  lines.push('╚════════════════════════════════════════════════════════════════╝');
  lines.push('');

  // Progress bar
  const progressBar = renderProgressBar(roadmap.summary.overallProgressPercent, 50);
  lines.push(`Overall Progress: ${roadmap.summary.overallProgressPercent}%`);
  lines.push(progressBar);
  lines.push('');

  // Milestones
  for (const milestone of roadmap.milestones) {
    const statusIcon = getStatusIcon(milestone.status);
    const progress = `${milestone.completedPhases}/${milestone.phaseCount} phases`;

    lines.push(`${statusIcon} ${milestone.name}`);
    lines.push(`   ${progress.padEnd(20)} ${renderProgressBar(milestone.progressPercent, 30)} ${milestone.progressPercent}%`);

    if (milestone.targetDate) {
      const date = milestone.targetDate.toLocaleDateString();
      lines.push(`   Target: ${date}`);
    }

    // Phases (if detailed view)
    for (const phase of milestone.phases) {
      const phaseIcon = getStatusIcon(phase.status);
      const phaseProgress = `${phase.completedTasks}/${phase.taskCount} tasks`;
      lines.push(`   ${phaseIcon} ${phase.name.padEnd(30)} ${phaseProgress}`);
    }

    lines.push('');
  }

  // Summary
  lines.push('─'.repeat(66));
  lines.push('Summary:');
  lines.push(`  Milestones: ${roadmap.summary.completedMilestones}/${roadmap.summary.totalMilestones}`);
  lines.push(`  Phases:     ${roadmap.summary.completedPhases}/${roadmap.summary.totalPhases}`);
  lines.push(`  Tasks:      ${roadmap.summary.completedTasks}/${roadmap.summary.totalTasks}`);

  if (roadmap.summary.estimatedCompletionDate) {
    lines.push(`  Est. Completion: ${roadmap.summary.estimatedCompletionDate.toLocaleDateString()}`);
  }

  return lines.join('\n');
}

/**
 * Generate a timeline view of the roadmap
 * @param roadmap - The roadmap to visualize
 * @returns Timeline as string
 */
export function generateTimeline(roadmap: Roadmap): string {
  const lines: string[] = [];
  lines.push('# Project Timeline\n');

  const items: Array<{
    type: 'milestone' | 'phase';
    name: string;
    status: GSDStatus;
    targetDate?: Date;
    indent: number;
  }> = [];

  for (const milestone of roadmap.milestones) {
    items.push({
      type: 'milestone',
      name: milestone.name,
      status: milestone.status,
      targetDate: milestone.targetDate,
      indent: 0,
    });

    for (const phase of milestone.phases) {
      items.push({
        type: 'phase',
        name: phase.name,
        status: phase.status,
        targetDate: phase.targetDate,
        indent: 2,
      });
    }
  }

  // Sort by target date
  items.sort((a, b) => {
    if (!a.targetDate && !b.targetDate) return 0;
    if (!a.targetDate) return 1;
    if (!b.targetDate) return -1;
    return a.targetDate.getTime() - b.targetDate.getTime();
  });

  for (const item of items) {
    const icon = getStatusIcon(item.status);
    const date = item.targetDate
      ? item.targetDate.toLocaleDateString().padEnd(12)
      : 'TBD'.padEnd(12);
    const indent = ' '.repeat(item.indent);
    const type = item.type === 'milestone' ? '[M]' : '[P]';

    lines.push(`${date} ${icon} ${indent}${type} ${item.name}`);
  }

  return lines.join('\n');
}

/**
 * Get upcoming items (milestones/phases) based on target dates
 * @param roadmap - The roadmap to analyze
 * @param days - Number of days to look ahead
 * @returns Array of upcoming items
 */
export function getUpcomingItems(
  roadmap: Roadmap,
  days: number = 7
): Array<{
  type: 'milestone' | 'phase';
  name: string;
  targetDate: Date;
  daysRemaining: number;
}> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const items: Array<{
    type: 'milestone' | 'phase';
    name: string;
    targetDate: Date;
    daysRemaining: number;
  }> = [];

  for (const milestone of roadmap.milestones) {
    if (
      milestone.targetDate &&
      milestone.targetDate > now &&
      milestone.targetDate <= cutoff &&
      milestone.status !== 'completed'
    ) {
      const daysRemaining = Math.ceil(
        (milestone.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      items.push({
        type: 'milestone',
        name: milestone.name,
        targetDate: milestone.targetDate,
        daysRemaining,
      });
    }

    for (const phase of milestone.phases) {
      if (
        phase.targetDate &&
        phase.targetDate > now &&
        phase.targetDate <= cutoff &&
        phase.status !== 'completed'
      ) {
        const daysRemaining = Math.ceil(
          (phase.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        items.push({
          type: 'phase',
          name: `${milestone.name} > ${phase.name}`,
          targetDate: phase.targetDate,
          daysRemaining,
        });
      }
    }
  }

  return items.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * Get critical path (items that are blocking progress)
 * @param roadmap - The roadmap to analyze
 * @returns Array of blocking items
 */
export function getCriticalPath(roadmap: Roadmap): Array<{
  type: 'milestone' | 'phase';
  name: string;
  status: GSDStatus;
  blocking: string;
}> {
  const items: Array<{
    type: 'milestone' | 'phase';
    name: string;
    status: GSDStatus;
    blocking: string;
  }> = [];

  for (let i = 0; i < roadmap.milestones.length; i++) {
    const milestone = roadmap.milestones[i];

    if (milestone.status === 'blocked') {
      items.push({
        type: 'milestone',
        name: milestone.name,
        status: milestone.status,
        blocking: `Milestone blocked`,
      });
    } else if (milestone.status !== 'completed') {
      // Find first incomplete phase
      const incompletePhase = milestone.phases.find(p => p.status !== 'completed');
      if (incompletePhase) {
        if (incompletePhase.status === 'blocked') {
          items.push({
            type: 'phase',
            name: `${milestone.name} > ${incompletePhase.name}`,
            status: incompletePhase.status,
            blocking: 'Phase blocked',
          });
        } else if (milestone.status === 'in_progress') {
          items.push({
            type: 'phase',
            name: `${milestone.name} > ${incompletePhase.name}`,
            status: incompletePhase.status,
            blocking: 'Current phase in progress',
          });
        }
      }

      // Only show first incomplete milestone
      break;
    }
  }

  return items;
}

// Helper functions

function calculateMilestoneProgress(milestone: Milestone): number {
  if (milestone.phases.length === 0) return 0;
  const totalProgress = milestone.phases.reduce((sum, p) => sum + calculatePhaseProgress(p), 0);
  return Math.round(totalProgress / milestone.phases.length);
}

function calculatePhaseProgress(phase: Phase): number {
  if (phase.tasks.length === 0) {
    // If no tasks, use status
    switch (phase.status) {
      case 'completed':
        return 100;
      case 'in_progress':
        return 50;
      default:
        return 0;
    }
  }

  const completedTasks = phase.tasks.filter(t => t.status === 'completed').length;
  return Math.round((completedTasks / phase.tasks.length) * 100);
}

function calculateEstimatedCompletion(project: Project): Date | undefined {
  // Simple estimation based on progress and dates
  // In a real implementation, this would use velocity tracking

  const stats = getProjectStats(project);
  if (stats.progressPercent === 0 || stats.progressPercent === 100) {
    return stats.progressPercent === 100 ? new Date() : undefined;
  }

  // If we have a target date, use that
  if (project.targetDate) {
    return project.targetDate;
  }

  // Otherwise, estimate based on average phase duration
  // This is a simplified estimation
  const remainingWork = 100 - stats.progressPercent;
  const daysRemaining = Math.ceil(remainingWork / 10); // Assume 10% per week

  const estimated = new Date();
  estimated.setDate(estimated.getDate() + daysRemaining * 7);

  return estimated;
}

function getStatusIcon(status: GSDStatus): string {
  switch (status) {
    case 'completed':
      return '✓';
    case 'in_progress':
      return '▶';
    case 'blocked':
      return '✗';
    case 'cancelled':
      return '⊘';
    default:
      return '○';
  }
}

function renderProgressBar(percent: number, width: number = 20): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function exportToJson(roadmap: Roadmap, options: ExportOptions): string {
  const data = options.includeCompleted
    ? roadmap
    : {
        ...roadmap,
        milestones: roadmap.milestones
          .filter(m => m.status !== 'completed')
          .map(m => ({
            ...m,
            phases: options.includeCompleted
              ? m.phases
              : m.phases.filter(p => p.status !== 'completed'),
          })),
      };

  return JSON.stringify(data, null, 2);
}

function exportToMarkdown(roadmap: Roadmap, options: ExportOptions): string {
  const lines: string[] = [];

  lines.push(`# ${roadmap.projectName} - Roadmap`);
  lines.push('');
  lines.push(`Generated: ${roadmap.generatedAt.toLocaleString()}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Overall Progress:** ${roadmap.summary.overallProgressPercent}%`);
  lines.push(`- **Milestones:** ${roadmap.summary.completedMilestones}/${roadmap.summary.totalMilestones}`);
  lines.push(`- **Phases:** ${roadmap.summary.completedPhases}/${roadmap.summary.totalPhases}`);
  lines.push(`- **Tasks:** ${roadmap.summary.completedTasks}/${roadmap.summary.totalTasks}`);

  if (roadmap.summary.estimatedCompletionDate) {
    lines.push(`- **Est. Completion:** ${roadmap.summary.estimatedCompletionDate.toLocaleDateString()}`);
  }

  lines.push('');

  // Milestones
  lines.push('## Milestones');
  lines.push('');

  for (const milestone of roadmap.milestones) {
    if (!options.includeCompleted && milestone.status === 'completed') {
      continue;
    }

    const statusEmoji = milestone.status === 'completed' ? '✅' :
                       milestone.status === 'in_progress' ? '🔄' :
                       milestone.status === 'blocked' ? '⛔' : '⏳';

    lines.push(`### ${statusEmoji} ${milestone.name}`);
    lines.push('');
    lines.push(`- **Status:** ${milestone.status}`);
    lines.push(`- **Progress:** ${milestone.progressPercent}%`);
    lines.push(`- **Phases:** ${milestone.completedPhases}/${milestone.phaseCount}`);

    if (milestone.targetDate) {
      lines.push(`- **Target Date:** ${milestone.targetDate.toLocaleDateString()}`);
    }

    lines.push('');

    if (options.includeDetails) {
      lines.push('#### Phases');
      lines.push('');

      for (const phase of milestone.phases) {
        if (!options.includeCompleted && phase.status === 'completed') {
          continue;
        }

        const phaseEmoji = phase.status === 'completed' ? '✅' :
                          phase.status === 'in_progress' ? '🔄' :
                          phase.status === 'blocked' ? '⛔' : '⏳';

        lines.push(`- ${phaseEmoji} **${phase.name}** (${phase.progressPercent}%)`);
        lines.push(`  - Tasks: ${phase.completedTasks}/${phase.taskCount}`);

        if (phase.targetDate) {
          lines.push(`  - Target: ${phase.targetDate.toLocaleDateString()}`);
        }
      }

      lines.push('');
    }
  }

  return lines.join('\n');
}

function exportToHtml(roadmap: Roadmap, options: ExportOptions): string {
  const isDark = options.theme === 'dark';
  const bgColor = isDark ? '#1a1a1a' : '#ffffff';
  const textColor = isDark ? '#e0e0e0' : '#333333';
  const headerColor = isDark ? '#4a9eff' : '#0066cc';

  const lines: string[] = [];

  lines.push('<!DOCTYPE html>');
  lines.push('<html>');
  lines.push('<head>');
  lines.push(`<title>${escapeHtml(roadmap.projectName)} - Roadmap</title>`);
  lines.push('<style>');
  lines.push(`body { font-family: system-ui, sans-serif; background: ${bgColor}; color: ${textColor}; max-width: 1200px; margin: 0 auto; padding: 20px; }`);
  lines.push(`h1 { color: ${headerColor}; }`);
  lines.push('.milestone { border: 1px solid #ccc; border-radius: 8px; padding: 16px; margin: 16px 0; }');
  lines.push('.milestone-header { display: flex; align-items: center; gap: 10px; }');
  lines.push('.progress-bar { height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; }');
  lines.push('.progress-fill { height: 100%; background: #4caf50; transition: width 0.3s; }');
  lines.push('.phase { margin-left: 20px; padding: 8px; border-left: 3px solid #ccc; }');
  lines.push('.status-completed { color: #4caf50; }');
  lines.push('.status-in_progress { color: #ff9800; }');
  lines.push('.status-blocked { color: #f44336; }');
  lines.push('.status-not_started { color: #9e9e9e; }');
  lines.push('</style>');
  lines.push('</head>');
  lines.push('<body>');

  lines.push(`<h1>${escapeHtml(roadmap.projectName)}</h1>`);
  lines.push(`<p>Generated: ${roadmap.generatedAt.toLocaleString()}</p>`);

  // Summary
  lines.push('<div class="summary">');
  lines.push(`<h2>Summary</h2>`);
  lines.push(`<p>Overall Progress: ${roadmap.summary.overallProgressPercent}%</p>`);
  lines.push('<div class="progress-bar">');
  lines.push(`<div class="progress-fill" style="width: ${roadmap.summary.overallProgressPercent}%"></div>`);
  lines.push('</div>');
  lines.push(`<p>Milestones: ${roadmap.summary.completedMilestones}/${roadmap.summary.totalMilestones}</p>`);
  lines.push(`<p>Phases: ${roadmap.summary.completedPhases}/${roadmap.summary.totalPhases}</p>`);
  lines.push(`<p>Tasks: ${roadmap.summary.completedTasks}/${roadmap.summary.totalTasks}</p>`);
  lines.push('</div>');

  // Milestones
  for (const milestone of roadmap.milestones) {
    if (!options.includeCompleted && milestone.status === 'completed') {
      continue;
    }

    lines.push('<div class="milestone">');
    lines.push('<div class="milestone-header">');
    lines.push(`<span class="status-${milestone.status}">${getStatusIcon(milestone.status)}</span>`);
    lines.push(`<h3>${escapeHtml(milestone.name)}</h3>`);
    lines.push('</div>');

    lines.push(`<p>Progress: ${milestone.progressPercent}%</p>`);
    lines.push('<div class="progress-bar">');
    lines.push(`<div class="progress-fill" style="width: ${milestone.progressPercent}%"></div>`);
    lines.push('</div>');

    if (milestone.targetDate) {
      lines.push(`<p>Target: ${milestone.targetDate.toLocaleDateString()}</p>`);
    }

    if (options.includeDetails) {
      for (const phase of milestone.phases) {
        if (!options.includeCompleted && phase.status === 'completed') {
          continue;
        }

        lines.push('<div class="phase">');
        lines.push(`<span class="status-${phase.status}">${getStatusIcon(phase.status)}</span>`);
        lines.push(`<strong>${escapeHtml(phase.name)}</strong>`);
        lines.push(`<span>(${phase.progressPercent}%) - ${phase.completedTasks}/${phase.taskCount} tasks</span>`);
        lines.push('</div>');
      }
    }

    lines.push('</div>');
  }

  lines.push('</body>');
  lines.push('</html>');

  return lines.join('\n');
}

function exportToSvg(roadmap: Roadmap, options: ExportOptions): string {
  const width = 800;
  const milestoneHeight = 80;
  const phaseHeight = 40;
  const padding = 20;

  const visibleMilestones = options.includeCompleted
    ? roadmap.milestones
    : roadmap.milestones.filter(m => m.status !== 'completed');

  const totalHeight = padding * 2 +
    visibleMilestones.length * milestoneHeight +
    visibleMilestones.reduce((sum, m) => sum + (options.includeDetails ? m.phases.length * phaseHeight : 0), 0);

  const lines: string[] = [];

  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">`);
  lines.push('<defs>');
  lines.push('<style>');
  lines.push('.milestone-rect { fill: #f5f5f5; stroke: #ccc; stroke-width: 1; }');
  lines.push('.milestone-text { font-family: system-ui, sans-serif; font-size: 14px; font-weight: bold; }');
  lines.push('.phase-text { font-family: system-ui, sans-serif; font-size: 12px; }');
  lines.push('.progress-bg { fill: #e0e0e0; }');
  lines.push('.progress-fill { fill: #4caf50; }');
  lines.push('</style>');
  lines.push('</defs>');

  // Title
  lines.push(`<text x="${width / 2}" y="30" text-anchor="middle" class="milestone-text">${escapeHtml(roadmap.projectName)}</text>`);

  let y = 50;

  for (const milestone of visibleMilestones) {
    // Milestone box
    lines.push(`<rect x="${padding}" y="${y}" width="${width - padding * 2}" height="${milestoneHeight - 10}" class="milestone-rect" rx="5" />`);

    // Milestone name
    lines.push(`<text x="${padding + 10}" y="${y + 25}" class="milestone-text">${escapeHtml(milestone.name)}</text>`);

    // Progress bar background
    lines.push(`<rect x="${padding + 10}" y="${y + 35}" width="200" height="10" class="progress-bg" rx="5" />`);

    // Progress bar fill
    const fillWidth = (milestone.progressPercent / 100) * 200;
    lines.push(`<rect x="${padding + 10}" y="${y + 35}" width="${fillWidth}" height="10" class="progress-fill" rx="5" />`);

    // Progress text
    lines.push(`<text x="${padding + 220}" y="${y + 44}" class="phase-text">${milestone.progressPercent}%</text>`);

    y += milestoneHeight;

    if (options.includeDetails) {
      for (const phase of milestone.phases) {
        if (!options.includeCompleted && phase.status === 'completed') {
          continue;
        }

        lines.push(`<text x="${padding + 30}" y="${y + 20}" class="phase-text">${getStatusIcon(phase.status)} ${escapeHtml(phase.name)} (${phase.progressPercent}%)</text>`);
        y += phaseHeight;
      }
    }
  }

  lines.push('</svg>');

  return lines.join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Re-export types
export * from './types';
