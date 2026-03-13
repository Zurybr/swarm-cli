# Multi-Project Support

Swarm CLI supports managing multiple projects with isolated workspaces, configurations, and git worktrees.

## Structure

```
/projects/
  /project-a/
    .planning/          # Planning documents
    .swarm/
      config.yaml       # Project-specific configuration
      sessions/         # Session data
      worktrees/        # Git worktrees for tasks
      logs/             # Logs
  /project-b/
    .planning/
    .swarm/
```

## Project Management API

### List All Projects

```http
GET /api/projects
```

Response:
```json
{
  "projects": [
    {
      "id": "proj_abc1",
      "name": "project-a",
      "path": "/workspace/projects/project-a",
      "config": {
        "defaultModel": "gpt-4",
        "maxAgents": 5,
        "timeout": 300000,
        "retryPolicy": {
          "maxRetries": 3,
          "retryDelay": 1000
        },
        "orchestration": {
          "strategy": "adaptive",
          "maxConcurrentTasks": 3
        }
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "activeProject": "proj_abc1"
}
```

### Create Project

```http
POST /api/projects
```

Request:
```json
{
  "name": "new-project",
  "path": "/workspace/projects/new-project",
  "config": {
    "defaultModel": "gpt-4",
    "maxAgents": 3
  }
}
```

Response:
```json
{
  "project": {
    "id": "proj_xyz1",
    "name": "new-project",
    "path": "/workspace/projects/new-project",
    "config": { ... },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Get Project

```http
GET /api/projects/:id
```

### Switch Active Project

```http
POST /api/projects/:id/switch
```

Response:
```json
{
  "project": { ... },
  "message": "Switched to project: project-a"
}
```

### Get Project Config

```http
GET /api/projects/:id/config
```

### Update Project Config

```http
PUT /api/projects/:id/config
```

Request:
```json
{
  "defaultModel": "gpt-4o",
  "orchestration": {
    "strategy": "parallel",
    "maxConcurrentTasks": 5
  }
}
```

### Delete Project

```http
DELETE /api/projects/:id
```

## Worktree Management

### List Worktrees

```http
GET /api/projects/:id/worktrees
```

Response:
```json
{
  "worktrees": [
    {
      "path": "/workspace/projects/project-a/.swarm/worktrees/task-123",
      "branch": "swarm/project-a/task-123"
    }
  ]
}
```

### Create Worktree

```http
POST /api/projects/:id/worktrees
```

Request:
```json
{
  "taskId": "task-123"
}
```

Response:
```json
{
  "worktree": {
    "path": "/workspace/projects/project-a/.swarm/worktrees/task-123",
    "branch": "swarm/project-a/task-123"
  }
}
```

### Remove Worktree

```http
DELETE /api/projects/:id/worktrees/:taskId
```

## Configuration File

Each project has a `.swarm/config.yaml` file:

```yaml
# Swarm CLI Project Configuration

defaultModel: gpt-4
maxAgents: 5
timeout: 300000

retryPolicy:
  maxRetries: 3
  retryDelay: 1000

orchestration:
  strategy: adaptive
  maxConcurrentTasks: 3
```

### Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultModel` | string | gpt-4 | Default LLM model |
| `maxAgents` | number | 5 | Max concurrent agents |
| `timeout` | number | 300000 | Task timeout (ms) |
| `retryPolicy.maxRetries` | number | 3 | Max retry attempts |
| `retryPolicy.retryDelay` | number | 1000 | Delay between retries (ms) |
| `orchestration.strategy` | string | adaptive | parallel, sequential, or adaptive |
| `orchestration.maxConcurrentTasks` | number | 3 | Max parallel tasks |

## Project Isolation

- Each project has isolated `.planning/` and `.swarm/` directories
- Sessions are stored per-project in `.swarm/sessions/`
- Logs are stored per-project in `.swarm/logs/`
- Worktrees are created per-task in `.swarm/worktrees/`

## Agent Sharing (Optional)

Agents can be shared between projects by placing agent definitions in a shared location and configuring the project to reference them. This is configured in the project's `config.yaml`:

```yaml
sharedAgentsPath: /path/to/shared/agents
```
