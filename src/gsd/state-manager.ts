/**
 * STATE.md Manager - Issue #19
 * Sistema de estado del proyecto como fuente única de verdad
 */

import * as fs from 'fs/promises';
import * as yaml from 'yaml';
import {
  ProjectState,
  StateMetadata,
  CurrentPosition,
  ProgressSummary,
  CompletedPhase,
  CompletedMilestone,
  GSDStatus,
} from './types';

export class StateManager {
  private state: ProjectState;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.state = this.createDefaultState();
  }

  /**
   * Crea un estado por defecto
   */
  private createDefaultState(): ProjectState {
    return {
      metadata: {
        project: 'unnamed-project',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: '0.1.0',
      },
      current_position: {
        current_phase: '01-foundation',
        current_plan: '01-01',
        current_task: 0,
        status: 'in_progress',
      },
      progress_summary: {
        phases_total: 0,
        phases_completed: 0,
        plans_total: 0,
        plans_completed: 0,
        tasks_total: 0,
        tasks_completed: 0,
        overall_progress: 0,
      },
      completed: {
        phases: [],
        milestones: [],
      },
    };
  }

  /**
   * Carga el estado desde archivo
   */
  async load(): Promise<ProjectState> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      this.state = this.parseStateMd(content);
      return this.state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Archivo no existe, crear estado por defecto
        await this.save();
        return this.state;
      }
      throw error;
    }
  }

  /**
   * Guarda el estado en archivo
   */
  async save(): Promise<void> {
    this.state.metadata.updated_at = new Date().toISOString();
    const content = this.serializeStateMd();
    await fs.writeFile(this.filePath, content, 'utf-8');
  }

  /**
   * Parsea contenido STATE.md
   */
  private parseStateMd(content: string): ProjectState {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      throw new Error('Formato STATE.md inválido: no se encontró frontmatter');
    }

    const parsed = yaml.parse(frontmatterMatch[1]);

    return {
      metadata: parsed.metadata,
      current_position: parsed.current_position,
      progress_summary: parsed.progress_summary,
      completed: parsed.completed || { phases: [], milestones: [] },
    };
  }

  /**
   * Serializa estado a formato STATE.md
   */
  private serializeStateMd(): string {
    const obj = {
      metadata: this.state.metadata,
      current_position: this.state.current_position,
      progress_summary: this.state.progress_summary,
      completed: this.state.completed,
    };

    const yamlContent = yaml.stringify(obj);

    return (
      `---\n${yamlContent}---\n\n# Project State\n\n## Current Position\n\n` +
      `- **Phase**: ${this.state.current_position.current_phase}\n` +
      `- **Plan**: ${this.state.current_position.current_plan}\n` +
      `- **Task**: ${this.state.current_position.current_task}\n` +
      `- **Status**: ${this.state.current_position.status}\n\n` +
      `## Progress\n\n` +
      `- **Overall**: ${this.state.progress_summary.overall_progress}%\n` +
      `- **Phases**: ${this.state.progress_summary.phases_completed}/${this.state.progress_summary.phases_total}\n` +
      `- **Plans**: ${this.state.progress_summary.plans_completed}/${this.state.progress_summary.plans_total}\n` +
      `- **Tasks**: ${this.state.progress_summary.tasks_completed}/${this.state.progress_summary.tasks_total}\n`
    );
  }

  /**
   * Actualiza la posición actual
   */
  updatePosition(position: Partial<CurrentPosition>): void {
    this.state.current_position = {
      ...this.state.current_position,
      ...position,
    };
  }

  /**
   * Actualiza el resumen de progreso
   */
  updateProgress(progress: Partial<ProgressSummary>): void {
    this.state.progress_summary = {
      ...this.state.progress_summary,
      ...progress,
    };
  }

  /**
   * Marca una fase como completada
   */
  completePhase(phaseId: string, plans: string[]): void {
    const existingIndex = this.state.completed.phases.findIndex((p) => p.id === phaseId);
    const completedPhase: CompletedPhase = {
      id: phaseId,
      completed_at: new Date().toISOString(),
      plans,
    };

    if (existingIndex >= 0) {
      this.state.completed.phases[existingIndex] = completedPhase;
    } else {
      this.state.completed.phases.push(completedPhase);
    }

    this.state.progress_summary.phases_completed = this.state.completed.phases.length;
  }

  /**
   * Marca un milestone como completado
   */
  completeMilestone(milestoneId: string, name: string, phases: string[]): void {
    const existingIndex = this.state.completed.milestones.findIndex(
      (m) => m.id === milestoneId
    );
    const completedMilestone: CompletedMilestone = {
      id: milestoneId,
      name,
      completed_at: new Date().toISOString(),
      phases,
    };

    if (existingIndex >= 0) {
      this.state.completed.milestones[existingIndex] = completedMilestone;
    } else {
      this.state.completed.milestones.push(completedMilestone);
    }
  }

  /**
   * Calcula el progreso general
   */
  calculateOverallProgress(): number {
    const { tasks_completed, tasks_total } = this.state.progress_summary;
    if (tasks_total === 0) return 0;
    return Math.round((tasks_completed / tasks_total) * 100);
  }

  /**
   * Obtiene el estado actual
   */
  getState(): ProjectState {
    return { ...this.state };
  }

  /**
   * Verifica si una fase está completada
   */
  isPhaseCompleted(phaseId: string): boolean {
    return this.state.completed.phases.some((p) => p.id === phaseId);
  }

  /**
   * Verifica si un plan está completado
   */
  isPlanCompleted(planId: string): boolean {
    return this.state.completed.phases.some((p) => p.plans.includes(planId));
  }

  /**
   * Obtiene la lista de planes completados
   */
  getCompletedPlans(): string[] {
    return this.state.completed.phases.flatMap((p) => p.plans);
  }

  /**
   * Resetea el estado (útil para testing)
   */
  reset(): void {
    this.state = this.createDefaultState();
  }

  /**
   * Exporta estado a JSON
   */
  toJSON(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Importa estado desde JSON
   */
  fromJSON(json: string): void {
    this.state = JSON.parse(json);
  }
}
