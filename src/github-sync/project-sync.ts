import { GitHubClient, GitHubProject } from './github-client';
import { Logger } from '../utils/logger';

const logger = new Logger('ProjectSync');

export interface Board {
  id: string;
  name: string;
  columns: Column[];
}

export interface Column {
  id: string;
  name: string;
  tasks: string[]; // Task IDs
}

export class ProjectSync {
  constructor(private client: GitHubClient) {}

  async createProjectFromSpec(
    owner: string,
    repo: string,
    projectName: string,
    description?: string
  ): Promise<GitHubProject> {
    logger.info(`Creating project: ${projectName}`);
    
    try {
      const project = await this.client.createProject(
        owner,
        repo,
        projectName,
        description
      );
      
      logger.info(`Created project ${project.id}: ${project.name}`);
      return project;
    } catch (error) {
      logger.error(`Failed to create project: ${projectName}`, error);
      throw error;
    }
  }

  async syncProjectBoard(projectId: number): Promise<Board> {
    logger.info(`Syncing project board: ${projectId}`);
    
    // TODO: Implement full board sync with columns and cards
    // This requires additional Octokit methods for project columns and cards
    
    return {
      id: `project-${projectId}`,
      name: `Project ${projectId}`,
      columns: [
        { id: 'col-1', name: 'To Do', tasks: [] },
        { id: 'col-2', name: 'In Progress', tasks: [] },
        { id: 'col-3', name: 'Done', tasks: [] }
      ]
    };
  }

  async addTasksToProject(
    projectId: number,
    issueIds: number[]
  ): Promise<void> {
    logger.info(`Adding ${issueIds.length} issues to project ${projectId}`);
    
    for (const issueId of issueIds) {
      try {
        await this.client.addIssueToProject(projectId, issueId);
      } catch (error) {
        logger.error(`Failed to add issue ${issueId} to project`, error);
      }
    }
  }
}
