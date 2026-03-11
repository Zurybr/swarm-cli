/**
 * GitHub API Client
 * 
 * Handles authentication and API calls to GitHub
 */

import { Octokit } from '@octokit/rest';

export interface GitHubClientConfig {
  token?: string;
  owner?: string;
  repo?: string;
}

export class GitHubClient {
  private octokit: Octokit;
  private owner?: string;
  private repo?: string;

  constructor(config: GitHubClientConfig = {}) {
    const token = config.token || process.env.GITHUB_TOKEN;
    
    this.octokit = new Octokit({
      auth: token,
    });
    
    this.owner = config.owner || process.env.GITHUB_OWNER;
    this.repo = config.repo || process.env.GITHUB_REPO;
  }

  /**
   * Parse owner/repo from a string or use defaults
   */
  private parseRepo(repoPath?: string): { owner: string; repo: string } {
    if (repoPath?.includes('/')) {
      const [owner, repo] = repoPath.split('/');
      return { owner, repo };
    }
    
    if (!this.owner || !this.repo) {
      throw new Error('Owner and repo must be specified via config or GITHUB_OWNER/GITHUB_REPO env vars');
    }
    
    return { owner: this.owner, repo: this.repo };
  }

  // ===== Issues =====

  async listIssues(params: {
    repo?: string;
    state?: 'open' | 'closed' | 'all';
    labels?: string[];
    limit?: number;
  } = {}) {
    const { owner, repo } = this.parseRepo(params.repo);
    
    const response = await this.octokit.issues.listForRepo({
      owner,
      repo,
      state: params.state || 'open',
      labels: params.labels?.join(','),
      per_page: params.limit || 30,
    });

    return response.data.map(issue => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      body: issue.body,
      labels: issue.labels.map(l => typeof l === 'string' ? l : l.name),
      assignees: issue.assignees?.map(a => a.login) || [],
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      url: issue.html_url,
    }));
  }

  async createIssue(params: {
    repo?: string;
    title: string;
    body?: string;
    labels?: string[];
    assignees?: string[];
  }) {
    const { owner, repo } = this.parseRepo(params.repo);
    
    const response = await this.octokit.issues.create({
      owner,
      repo,
      title: params.title,
      body: params.body,
      labels: params.labels,
      assignees: params.assignees,
    });

    return {
      id: response.data.id,
      number: response.data.number,
      title: response.data.title,
      url: response.data.html_url,
    };
  }

  async updateIssue(params: {
    repo?: string;
    issueNumber: number;
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    labels?: string[];
    assignees?: string[];
  }) {
    const { owner, repo } = this.parseRepo(params.repo);
    
    const response = await this.octokit.issues.update({
      owner,
      repo,
      issue_number: params.issueNumber,
      title: params.title,
      body: params.body,
      state: params.state,
      labels: params.labels,
      assignees: params.assignees,
    });

    return {
      id: response.data.id,
      number: response.data.number,
      title: response.data.title,
      state: response.data.state,
      url: response.data.html_url,
    };
  }

  // ===== Pull Requests =====

  async listPullRequests(params: {
    repo?: string;
    state?: 'open' | 'closed' | 'all';
    limit?: number;
  } = {}) {
    const { owner, repo } = this.parseRepo(params.repo);
    
    const response = await this.octokit.pulls.list({
      owner,
      repo,
      state: params.state || 'open',
      per_page: params.limit || 30,
    });

    return response.data.map(pr => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      body: pr.body,
      head: pr.head.ref,
      base: pr.base.ref,
      user: pr.user?.login,
      createdAt: pr.created_at,
      url: pr.html_url,
    }));
  }

  async getPullRequest(params: {
    repo?: string;
    prNumber: number;
  }) {
    const { owner, repo } = this.parseRepo(params.repo);
    
    const response = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: params.prNumber,
    });

    return {
      id: response.data.id,
      number: response.data.number,
      title: response.data.title,
      state: response.data.state,
      body: response.data.body,
      head: response.data.head.ref,
      base: response.data.base.ref,
      user: response.data.user?.login,
      mergeable: response.data.mergeable,
      mergeableState: response.data.mergeable_state,
      createdAt: response.data.created_at,
      url: response.data.html_url,
    };
  }

  async createReview(params: {
    repo?: string;
    prNumber: number;
    body?: string;
    event?: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    comments?: Array<{
      path: string;
      body: string;
      line?: number;
    }>;
  }) {
    const { owner, repo } = this.parseRepo(params.repo);
    
    const response = await this.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: params.prNumber,
      body: params.body,
      event: params.event || 'COMMENT',
      comments: params.comments?.map(c => ({
        path: c.path,
        body: c.body,
        line: c.line,
      })),
    });

    return {
      id: response.data.id,
      state: response.data.state,
      body: response.data.body,
      url: response.data.html_url,
    };
  }

  // ===== Repository =====

  async getRepoInfo(params: {
    repo?: string;
  } = {}) {
    const { owner, repo } = this.parseRepo(params.repo);
    
    const response = await this.octokit.repos.get({
      owner,
      repo,
    });

    return {
      id: response.data.id,
      name: response.data.name,
      fullName: response.data.full_name,
      description: response.data.description,
      private: response.data.private,
      stars: response.data.stargazers_count,
      forks: response.data.forks_count,
      openIssues: response.data.open_issues_count,
      language: response.data.language,
      defaultBranch: response.data.default_branch,
      url: response.data.html_url,
    };
  }
}

// Singleton instance
let client: GitHubClient | null = null;

export function getGitHubClient(config?: GitHubClientConfig): GitHubClient {
  if (!client) {
    client = new GitHubClient(config);
  }
  return client;
}

export function resetGitHubClient(): void {
  client = null;
}
