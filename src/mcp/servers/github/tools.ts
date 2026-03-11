/**
 * GitHub MCP Server Tools
 * 
 * Provides GitHub API tools for MCP clients
 */

import type { ServerTool } from '../types.js';
import { textResult, errorResult } from '../types.js';
import { getGitHubClient } from './client.js';

/**
 * List issues in a repository
 */
async function listIssuesHandler(args: Record<string, unknown>) {
  try {
    const client = getGitHubClient();
    const issues = await client.listIssues({
      repo: args.repo as string,
      state: args.state as 'open' | 'closed' | 'all',
      labels: args.labels as string[],
      limit: args.limit as number,
    });
    return textResult(JSON.stringify(issues, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to list issues: ${errorMessage}`);
  }
}

/**
 * Create a new issue
 */
async function createIssueHandler(args: Record<string, unknown>) {
  const title = args.title as string;
  
  if (!title) {
    return errorResult('Title is required');
  }

  try {
    const client = getGitHubClient();
    const issue = await client.createIssue({
      repo: args.repo as string,
      title,
      body: args.body as string,
      labels: args.labels as string[],
      assignees: args.assignees as string[],
    });
    return textResult(JSON.stringify(issue, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to create issue: ${errorMessage}`);
  }
}

/**
 * Update an existing issue
 */
async function updateIssueHandler(args: Record<string, unknown>) {
  const issueNumber = args.issueNumber as number;
  
  if (!issueNumber) {
    return errorResult('Issue number is required');
  }

  try {
    const client = getGitHubClient();
    const issue = await client.updateIssue({
      repo: args.repo as string,
      issueNumber,
      title: args.title as string,
      body: args.body as string,
      state: args.state as 'open' | 'closed',
      labels: args.labels as string[],
      assignees: args.assignees as string[],
    });
    return textResult(JSON.stringify(issue, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to update issue: ${errorMessage}`);
  }
}

/**
 * List pull requests
 */
async function listPullRequestsHandler(args: Record<string, unknown>) {
  try {
    const client = getGitHubClient();
    const prs = await client.listPullRequests({
      repo: args.repo as string,
      state: args.state as 'open' | 'closed' | 'all',
      limit: args.limit as number,
    });
    return textResult(JSON.stringify(prs, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to list pull requests: ${errorMessage}`);
  }
}

/**
 * Review a pull request
 */
async function reviewPullRequestHandler(args: Record<string, unknown>) {
  const prNumber = args.prNumber as number;
  
  if (!prNumber) {
    return errorResult('PR number is required');
  }

  try {
    const client = getGitHubClient();
    
    // Get PR details first
    const pr = await client.getPullRequest({
      repo: args.repo as string,
      prNumber,
    });
    
    // Create review if event is specified
    if (args.event || args.body) {
      const review = await client.createReview({
        repo: args.repo as string,
        prNumber,
        body: args.body as string,
        event: args.event as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
        comments: args.comments as Array<{ path: string; body: string; line?: number }>,
      });
      return textResult(JSON.stringify({ pr, review }, null, 2));
    }
    
    return textResult(JSON.stringify(pr, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to review pull request: ${errorMessage}`);
  }
}

/**
 * Get repository information
 */
async function getRepoInfoHandler(args: Record<string, unknown>) {
  try {
    const client = getGitHubClient();
    const repo = await client.getRepoInfo({
      repo: args.repo as string,
    });
    return textResult(JSON.stringify(repo, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to get repo info: ${errorMessage}`);
  }
}

/**
 * All GitHub tools
 */
export const githubTools: ServerTool[] = [
  {
    definition: {
      name: 'github:issues:list',
      description: 'List issues in a GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          repo: {
            type: 'string',
            description: 'Repository in owner/repo format (optional if defaults set)',
          },
          state: {
            type: 'string',
            enum: ['open', 'closed', 'all'],
            description: 'Issue state filter (default: open)',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by labels',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of issues to return (default: 30)',
          },
        },
      },
    },
    handler: listIssuesHandler,
  },
  {
    definition: {
      name: 'github:issues:create',
      description: 'Create a new GitHub issue',
      inputSchema: {
        type: 'object',
        properties: {
          repo: {
            type: 'string',
            description: 'Repository in owner/repo format',
          },
          title: {
            type: 'string',
            description: 'Issue title',
          },
          body: {
            type: 'string',
            description: 'Issue body/description',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Labels to apply',
          },
          assignees: {
            type: 'array',
            items: { type: 'string' },
            description: 'GitHub usernames to assign',
          },
        },
        required: ['title'],
      },
    },
    handler: createIssueHandler,
  },
  {
    definition: {
      name: 'github:issues:update',
      description: 'Update an existing GitHub issue',
      inputSchema: {
        type: 'object',
        properties: {
          repo: {
            type: 'string',
            description: 'Repository in owner/repo format',
          },
          issueNumber: {
            type: 'number',
            description: 'Issue number to update',
          },
          title: {
            type: 'string',
            description: 'New title',
          },
          body: {
            type: 'string',
            description: 'New body/description',
          },
          state: {
            type: 'string',
            enum: ['open', 'closed'],
            description: 'New state',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'New labels',
          },
          assignees: {
            type: 'array',
            items: { type: 'string' },
            description: 'New assignees',
          },
        },
        required: ['issueNumber'],
      },
    },
    handler: updateIssueHandler,
  },
  {
    definition: {
      name: 'github:pr:list',
      description: 'List pull requests in a GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          repo: {
            type: 'string',
            description: 'Repository in owner/repo format',
          },
          state: {
            type: 'string',
            enum: ['open', 'closed', 'all'],
            description: 'PR state filter (default: open)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of PRs to return (default: 30)',
          },
        },
      },
    },
    handler: listPullRequestsHandler,
  },
  {
    definition: {
      name: 'github:pr:review',
      description: 'Get PR details and optionally create a review',
      inputSchema: {
        type: 'object',
        properties: {
          repo: {
            type: 'string',
            description: 'Repository in owner/repo format',
          },
          prNumber: {
            type: 'number',
            description: 'Pull request number',
          },
          event: {
            type: 'string',
            enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'],
            description: 'Review event type',
          },
          body: {
            type: 'string',
            description: 'Review comment body',
          },
          comments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                body: { type: 'string' },
                line: { type: 'number' },
              },
            },
            description: 'Line-specific comments',
          },
        },
        required: ['prNumber'],
      },
    },
    handler: reviewPullRequestHandler,
  },
  {
    definition: {
      name: 'github:repo:info',
      description: 'Get information about a GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          repo: {
            type: 'string',
            description: 'Repository in owner/repo format',
          },
        },
      },
    },
    handler: getRepoInfoHandler,
  },
];
