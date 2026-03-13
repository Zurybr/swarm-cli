/**
 * STATE.md Manager - Issue #19
 * Sistema de estado del proyecto como fuente única de verdad
 */

import * as fs from 'fs/promises';
import * as path from 'path';
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

  // ==================== Schema Migrations ====================

  /**
   * Migra el estado a la última versión del schema
   */
  async migrate(): Promise<{ migrated: boolean; fromVersion: string; toVersion: string }> {
    const currentVersion = this.state.metadata.version;
    const targetVersion = '1.0.0';

    if (currentVersion === targetVersion) {
      return { migrated: false, fromVersion: currentVersion, toVersion: targetVersion };
    }

    console.log(`Migrating STATE.md from v${currentVersion} to v${targetVersion}...`);

    if (currentVersion === '0.1.0' || currentVersion.startsWith('0.')) {
      this.migrateFromV0();
    }

    this.state.metadata.version = targetVersion;
    await this.save();

    return { migrated: true, fromVersion: currentVersion, toVersion: targetVersion };
  }

  /**
   * Migra desde schema v0 a v1
   */
  private migrateFromV0(): void {
    if (!this.state.completed) {
      this.state.completed = { phases: [], milestones: [] };
    }

    if (!this.state.progress_summary) {
      this.state.progress_summary = {
        phases_total: 0,
        phases_completed: 0,
        plans_total: 0,
        plans_completed: 0,
        tasks_total: 0,
        tasks_completed: 0,
        overall_progress: 0,
      };
    }

    console.log('  - Added progress_summary structure');
    console.log('  - Added completed structure');
  }

  // ==================== File Locking (Concurrent Modification) ====================

  private lockFilePath(): string {
    return this.filePath.replace(/\.md$/, '.lock');
  }

  /**
   * Adquiere un lock para el archivo
   */
  async acquireLock(timeoutMs: number = 5000): Promise<boolean> {
    const lockPath = this.lockFilePath();
    const lockData = {
      pid: process.pid,
      timestamp: Date.now(),
    };

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        await fs.writeFile(lockPath, JSON.stringify(lockData), { flag: 'wx' });
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        throw error;
      }
    }

    throw new Error(`Failed to acquire lock after ${timeoutMs}ms`);
  }

  /**
   * Libera el lock del archivo
   */
  async releaseLock(): Promise<void> {
    const lockPath = this.lockFilePath();
    try {
      await fs.unlink(lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Verifica si el archivo está bloqueado
   */
  async isLocked(): Promise<boolean> {
    const lockPath = this.lockFilePath();
    try {
      await fs.access(lockPath);
      return true;
    } catch {
      return false;
    }
  }

  // ==================== Backup & Restore ====================

  /**
   * Crea un backup del estado actual
   */
  async backup(customPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = customPath || `${this.filePath}.backup-${timestamp}`;
    
    await fs.copyFile(this.filePath, backupPath);
    return backupPath;
  }

  /**
   * Restaura el estado desde un backup
   */
  async restore(backupPath: string): Promise<void> {
    const content = await fs.readFile(backupPath, 'utf-8');
    this.state = this.parseStateMd(content);
    await this.save();
  }

  /**
   * Lista los backups disponibles
   */
  async listBackups(): Promise<{ path: string; created: Date; size: number }[]> {
    const dir = path.dirname(this.filePath);
    const basename = path.basename(this.filePath);
    
    const files = await fs.readdir(dir);
    const backupRegex = new RegExp(`^${basename}\\.backup-.+$`);
    
    const backups: { path: string; created: Date; size: number }[] = [];
    
    for (const file of files) {
      if (backupRegex.test(file)) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        backups.push({
          path: filePath,
          created: stat.mtime,
          size: stat.size,
        });
      }
    }
    
    return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  /**
   * Elimina backups antiguos
   */
  async cleanOldBackups(maxAgeDays: number = 30): Promise<number> {
    const backups = await this.listBackups();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
    
    let deleted = 0;
    for (const backup of backups) {
      if (backup.created < cutoffDate) {
        await fs.unlink(backup.path);
        deleted++;
      }
    }
    
    return deleted;
  }
}
