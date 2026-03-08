import { Octokit } from '@octokit/rest';
import { Logger } from '../utils/logger';

const logger = new Logger('GitHub');

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: string[];
}

export interface GitHubProject {
  id: number;
  name: string;
  body: string | null;
  state: string;
}

export class GitHubClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async createIssue(
    owner: string, 
    repo: string, 
    title: string, 
    body: string, 
    labels?: string[]
  ): Promise<GitHubIssue> {
    const { data } = await this.octokit.rest.issues.create({
      owner,
      repo,
      title,
      body,
      labels
    });
    logger.info(`Created issue #${data.number}: ${title}`);
    return {
      number: data.number,
      title: data.title,
      body: data.body,
      state: data.state,
      labels: data.labels.map((l: any) => typeof l === 'string' ? l : l.name || '')
    };
  }

  async createProject(
    owner: string, 
    repo: string, 
    name: string,
    body?: string
  ): Promise<GitHubProject> {
    const { data } = await this.octokit.rest.projects.createForRepo({
      owner,
      repo,
      name,
      body: body || ''
    });
    logger.info(`Created project: ${name}`);
    return {
      id: data.id,
      name: data.name,
      body: data.body,
      state: data.state
    };
  }

  async addIssueToProject(projectId: number, issueId: number): Promise<void> {
    await this.octokit.rest.projects.createCard({
      project_id: projectId,
      content_id: issueId,
      content_type: 'Issue'
    });
    logger.info(`Added issue ${issueId} to project ${projectId}`);
  }

  async listIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubIssue[]> {
    const { data } = await this.octokit.rest.issues.listForRepo({
      owner,
      repo,
      state
    });
    return data.map(issue => ({
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      labels: issue.labels.map((l: any) => typeof l === 'string' ? l : l.name || '')
    }));
  }

  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    updates: { title?: string; body?: string; state?: 'open' | 'closed' }
  ): Promise<void> {
    await this.octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      ...updates
    });
    logger.info(`Updated issue #${issueNumber}`);
  }
}
