import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { Project, ProjectConfig } from '../../types/api';

function generateId(prefix: string): string {
  const randomBytes = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${randomBytes}`;
}

const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  defaultModel: 'gpt-4',
  maxAgents: 5,
  timeout: 300000,
  retryPolicy: {
    maxRetries: 3,
    retryDelay: 1000,
  },
  orchestration: {
    strategy: 'adaptive',
    maxConcurrentTasks: 3,
  },
};

class ProjectService {
  private projects: Map<string, Project> = new Map();
  private activeProjectId: string | null = null;

  async initialize(): Promise<void> {
    const projectsDir = path.join(process.cwd(), 'projects');
    try {
      await fs.mkdir(projectsDir, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  async list(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async get(id: string): Promise<Project | null> {
    return this.projects.get(id) || null;
  }

  async getActive(): Promise<Project | null> {
    if (!this.activeProjectId) return null;
    return this.projects.get(this.activeProjectId) || null;
  }

  async setActive(id: string): Promise<Project | null> {
    const project = this.projects.get(id);
    if (!project) return null;
    this.activeProjectId = id;
    return project;
  }

  async create(data: { name: string; path?: string; config?: ProjectConfig }): Promise<Project> {
    const now = new Date().toISOString();
    const projectPath = data.path || path.join(process.cwd(), 'projects', data.name);

    await this.ensureProjectDirectories(projectPath);

    const config = { ...DEFAULT_PROJECT_CONFIG, ...data.config };
    await this.saveProjectConfig(projectPath, config);

    const project: Project = {
      id: generateId('proj'),
      name: data.name,
      path: projectPath,
      config,
      createdAt: now,
      updatedAt: now,
    };

    this.projects.set(project.id, project);

    if (!this.activeProjectId) {
      this.activeProjectId = project.id;
    }

    return project;
  }

  async update(id: string, data: Partial<ProjectConfig>): Promise<Project | null> {
    const project = this.projects.get(id);
    if (!project) return null;

    project.config = { ...project.config, ...data };
    project.updatedAt = new Date().toISOString();

    await this.saveProjectConfig(project.path, project.config);

    return project;
  }

  async delete(id: string): Promise<boolean> {
    const project = this.projects.get(id);
    if (!project) return false;

    if (this.activeProjectId === id) {
      this.activeProjectId = null;
    }

    this.projects.delete(id);
    return true;
  }

  async getConfig(projectId: string): Promise<ProjectConfig | null> {
    const project = this.projects.get(projectId);
    if (!project) return null;
    return project.config;
  }

  async updateConfig(projectId: string, config: Partial<ProjectConfig>): Promise<ProjectConfig | null> {
    const project = this.projects.get(projectId);
    if (!project) return null;

    project.config = { ...project.config, ...config };
    project.updatedAt = new Date().toISOString();

    await this.saveProjectConfig(project.path, project.config);

    return project.config;
  }

  async createWorktree(projectId: string, taskId: string): Promise<{ worktreePath: string; branch: string } | null> {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const worktreePath = path.join(project.path, '.swarm', 'worktrees', taskId);
    const branchName = `swarm/${project.name}/${taskId}`;

    try {
      execSync(`git worktree add "${worktreePath}" -b "${branchName}"`, {
        cwd: project.path,
        stdio: 'pipe',
      });

      return { worktreePath, branch: branchName };
    } catch (error) {
      console.error('Failed to create worktree:', error);
      return null;
    }
  }

  async removeWorktree(projectId: string, taskId: string): Promise<boolean> {
    const project = this.projects.get(projectId);
    if (!project) return false;

    const worktreePath = path.join(project.path, '.swarm', 'worktrees', taskId);

    try {
      execSync(`git worktree remove "${worktreePath}" --force`, {
        cwd: project.path,
        stdio: 'pipe',
      });
      return true;
    } catch (error) {
      console.error('Failed to remove worktree:', error);
      return false;
    }
  }

  async listWorktrees(projectId: string): Promise<Array<{ path: string; branch: string }>> {
    const project = this.projects.get(projectId);
    if (!project) return [];

    try {
      const output = execSync('git worktree list --porcelain', {
        cwd: project.path,
        encoding: 'utf-8',
      });

      const worktrees: Array<{ path: string; branch: string }> = [];
      const entries = output.split('\n\n').filter(Boolean);

      for (const entry of entries) {
        const lines = entry.split('\n');
        let path = '';
        let branch = '';

        for (const line of lines) {
          if (line.startsWith('worktree ')) {
            path = line.replace('worktree ', '');
          } else if (line.startsWith('branch ')) {
            branch = line.replace('branch ', '');
          }
        }

        if (path && path.includes('.swarm/worktrees')) {
          worktrees.push({ path, branch });
        }
      }

      return worktrees;
    } catch {
      return [];
    }
  }

  private async ensureProjectDirectories(projectPath: string): Promise<void> {
    const dirs = [
      projectPath,
      path.join(projectPath, '.planning'),
      path.join(projectPath, '.swarm'),
      path.join(projectPath, '.swarm', 'worktrees'),
      path.join(projectPath, '.swarm', 'sessions'),
      path.join(projectPath, '.swarm', 'logs'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async saveProjectConfig(projectPath: string, config: ProjectConfig): Promise<void> {
    const configPath = path.join(projectPath, '.swarm', 'config.yaml');

    const yamlContent = this.configToYaml(config);
    await fs.writeFile(configPath, yamlContent, 'utf-8');
  }

  async loadProjectConfig(projectPath: string): Promise<ProjectConfig | null> {
    const configPath = path.join(projectPath, '.swarm', 'config.yaml');

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      return this.yamlToConfig(content);
    } catch {
      return null;
    }
  }

  private configToYaml(config: ProjectConfig): string {
    const lines = ['# Swarm CLI Project Configuration', ''];

    if (config.defaultModel) {
      lines.push(`defaultModel: ${config.defaultModel}`);
    }
    if (config.maxAgents) {
      lines.push(`maxAgents: ${config.maxAgents}`);
    }
    if (config.timeout) {
      lines.push(`timeout: ${config.timeout}`);
    }

    if (config.retryPolicy) {
      lines.push('');
      lines.push('retryPolicy:');
      lines.push(`  maxRetries: ${config.retryPolicy.maxRetries}`);
      lines.push(`  retryDelay: ${config.retryPolicy.retryDelay}`);
    }

    if (config.orchestration) {
      lines.push('');
      lines.push('orchestration:');
      lines.push(`  strategy: ${config.orchestration.strategy}`);
      if (config.orchestration.maxConcurrentTasks) {
        lines.push(`  maxConcurrentTasks: ${config.orchestration.maxConcurrentTasks}`);
      }
    }

    return lines.join('\n');
  }

  private yamlToConfig(content: string): ProjectConfig {
    const config: ProjectConfig = {};
    const lines = content.split('\n');
    let currentSection: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (trimmed === 'retryPolicy:') {
        currentSection = 'retryPolicy';
        config.retryPolicy = { maxRetries: 3, retryDelay: 1000 };
        continue;
      }
      if (trimmed === 'orchestration:') {
        currentSection = 'orchestration';
        config.orchestration = { strategy: 'adaptive' };
        continue;
      }

      if (trimmed.startsWith('defaultModel:')) {
        config.defaultModel = trimmed.split(':')[1].trim();
      } else if (trimmed.startsWith('maxAgents:')) {
        config.maxAgents = parseInt(trimmed.split(':')[1].trim(), 10);
      } else if (trimmed.startsWith('timeout:')) {
        config.timeout = parseInt(trimmed.split(':')[1].trim(), 10);
      } else if (currentSection === 'retryPolicy') {
        if (trimmed.startsWith('maxRetries:')) {
          config.retryPolicy!.maxRetries = parseInt(trimmed.split(':')[1].trim(), 10);
        } else if (trimmed.startsWith('retryDelay:')) {
          config.retryPolicy!.retryDelay = parseInt(trimmed.split(':')[1].trim(), 10);
        }
      } else if (currentSection === 'orchestration') {
        if (trimmed.startsWith('strategy:')) {
          config.orchestration!.strategy = trimmed.split(':')[1].trim() as 'parallel' | 'sequential' | 'adaptive';
        } else if (trimmed.startsWith('maxConcurrentTasks:')) {
          config.orchestration!.maxConcurrentTasks = parseInt(trimmed.split(':')[1].trim(), 10);
        }
      }
    }

    return config;
  }

  getActiveProjectId(): string | null {
    return this.activeProjectId;
  }
}

export const projectService = new ProjectService();
