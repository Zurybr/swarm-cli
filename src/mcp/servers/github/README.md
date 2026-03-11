# GitHub MCP Server

A built-in MCP server providing GitHub API tools for Swarm CLI.

## Installation

```bash
npm install @swarm-cli/mcp-github
```

## Configuration

Set the following environment variables:

```bash
export GITHUB_TOKEN=your_personal_access_token
export GITHUB_OWNER=default_owner  # optional
export GITHUB_REPO=default_repo    # optional
```

## Usage

### Standalone

```bash
# Run directly with ts-node
GITHUB_TOKEN=your_token npx ts-node src/mcp/servers/github/index.ts

# Or after building
GITHUB_TOKEN=your_token node dist/github/index.js
```

### With Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["/path/to/swarm-cli/dist/mcp/servers/github/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_personal_access_token"
      }
    }
  }
}
```

## Available Tools

### `github:issues:list`

List issues in a GitHub repository.

**Parameters:**
- `repo` (string, optional): Repository in owner/repo format
- `state` (string, optional): 'open' | 'closed' | 'all' (default: 'open')
- `labels` (string[], optional): Filter by labels
- `limit` (number, optional): Max results (default: 30)

**Example:**
```json
{
  "name": "github:issues:list",
  "arguments": {
    "repo": "owner/repo",
    "state": "open",
    "labels": ["bug", "priority"]
  }
}
```

### `github:issues:create`

Create a new GitHub issue.

**Parameters:**
- `title` (string, required): Issue title
- `repo` (string, optional): Repository in owner/repo format
- `body` (string, optional): Issue description
- `labels` (string[], optional): Labels to apply
- `assignees` (string[], optional): GitHub usernames to assign

**Example:**
```json
{
  "name": "github:issues:create",
  "arguments": {
    "repo": "owner/repo",
    "title": "Bug: Something is broken",
    "body": "Description of the issue...",
    "labels": ["bug"]
  }
}
```

### `github:issues:update`

Update an existing GitHub issue.

**Parameters:**
- `issueNumber` (number, required): Issue number
- `repo` (string, optional): Repository in owner/repo format
- `title` (string, optional): New title
- `body` (string, optional): New description
- `state` (string, optional): 'open' | 'closed'
- `labels` (string[], optional): New labels
- `assignees` (string[], optional): New assignees

### `github:pr:list`

List pull requests in a repository.

**Parameters:**
- `repo` (string, optional): Repository in owner/repo format
- `state` (string, optional): 'open' | 'closed' | 'all' (default: 'open')
- `limit` (number, optional): Max results (default: 30)

### `github:pr:review`

Get PR details and optionally create a review.

**Parameters:**
- `prNumber` (number, required): Pull request number
- `repo` (string, optional): Repository in owner/repo format
- `event` (string, optional): 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
- `body` (string, optional): Review comment
- `comments` (array, optional): Line-specific comments

### `github:repo:info`

Get information about a repository.

**Parameters:**
- `repo` (string, optional): Repository in owner/repo format

## Required GitHub Token Permissions

For full functionality, your GitHub token needs these scopes:
- `repo` - Full repository access
- `read:org` - Read organization data

For read-only access:
- `public_repo` - Access public repositories
- `read:org` - Read organization data
