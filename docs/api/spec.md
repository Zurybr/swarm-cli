# Swarm CLI Server API Specification

**Version:** 1.0.0
**Base URL:** `http://localhost:3000/api`
**WebSocket URL:** `ws://localhost:3000`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Data Models](#data-models)
3. [Project Management](#project-management)
4. [Project Configuration](#project-configuration)
5. [Worktree Management](#worktree-management)
6. [Session Management](#session-management)
7. [Session Control](#session-control)
8. [Messaging](#messaging)
9. [File Operations](#file-operations)
10. [Plan/Execution](#planexecution)
11. [WebSocket Events](#websocket-events)
12. [Error Responses](#error-responses)

---

## Authentication

Swarm CLI supports two authentication methods:

### API Key Authentication

Include the API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/projects
```

### JWT Authentication

Include the JWT token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer your-jwt-token" http://localhost:3000/api/projects
```

### Authentication Configuration

Authentication is configured via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `SWARM_API_KEYS` | Comma-separated API keys | none |
| `SWARM_JWT_SECRET` | Secret for JWT validation | none |
| `SWARM_AUTH_ENABLED` | Enable authentication | `false` |

---

## Data Models

### Project

```typescript
interface Project {
  id: string;              // UUID
  name: string;            // Project name
  path: string;            // Absolute path to project
  config: ProjectConfig;   // Project configuration
  createdAt: string;       // ISO 8601 timestamp
  updatedAt: string;       // ISO 8601 timestamp
}

interface ProjectConfig {
  defaultModel?: string;
  maxAgents?: number;
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
  };
  orchestration?: {
    strategy: 'parallel' | 'sequential' | 'adaptive';
    maxConcurrentTasks?: number;
  };
}
```

### Session

```typescript
interface Session {
  id: string;              // UUID
  projectId: string;        // Reference to Project
  status: SessionStatus;   // Current session state
  config: SessionConfig;   // Session configuration
  agents: AgentSummary[]; // Active agents in session
  metrics: SessionMetrics; // Session metrics
  createdAt: string;        // ISO 8601 timestamp
  updatedAt: string;       // ISO 8601 timestamp
}

type SessionStatus = 
  | 'initializing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'aborted'
  | 'error';

interface SessionConfig {
  maxAgents?: number;
  timeout?: number;
  contextLimit?: number;
  model?: string;
}

interface AgentSummary {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'busy' | 'paused' | 'error';
}

interface SessionMetrics {
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  messagesSent: number;
  tokensUsed: number;
}
```

### Message

```typescript
interface Message {
  id: string;              // UUID
  sessionId: string;       // Reference to Session
  role: MessageRole;       // Message sender role
  content: string;         // Message content
  metadata?: Record<string, unknown>;
  timestamp: string;       // ISO 8601 timestamp
}

type MessageRole = 'system' | 'user' | 'assistant' | 'agent';
```

### Plan

```typescript
interface Plan {
  id: string;              // UUID
  projectId: string;        // Reference to Project
  status: PlanStatus;      // Current plan state
  tasks: PlanTask[];       // Tasks in the plan
  wave?: number;           // Execution wave number
  createdAt: string;       // ISO 8601 timestamp
  updatedAt: string;       // ISO 8601 timestamp
}

type PlanStatus = 
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

interface PlanTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  assignedTo?: string;
  result?: {
    success: boolean;
    output?: string;
    error?: string;
    artifacts?: string[];
  };
}
```

### File

```typescript
interface File {
  path: string;            // Relative path from project root
  status: FileStatus;      // File tracking status
  lastModified?: string;   // ISO 8601 timestamp
}

type FileStatus = 
  | 'tracked'
  | 'modified'
  | 'untracked'
  | 'ignored';

interface FileContent {
  path: string;
  content: string;         // Base64 encoded for binary files
  encoding: 'utf-8' | 'base64';
  size: number;
  lastModified: string;
}

interface FileStatusResult {
  path: string;
  status: FileStatus;
  staged: boolean;
  conflicts?: string[];
}
```

---

## Project Management

### List Projects

```
GET /projects
```

Returns a list of all projects.

**Response: 200 OK**

```json
{
  "projects": [
    {
      "id": "proj_abc123",
      "name": "my-project",
      "path": "/home/user/projects/my-project",
      "config": {
        "defaultModel": "claude-3-opus",
        "maxAgents": 5
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T14:22:00Z"
    }
  ]
}
```

---

### Create Project

```
POST /projects
```

Creates a new project.

**Request Body:**

```json
{
  "name": "my-project",
  "path": "/home/user/projects/my-project",
  "config": {
    "defaultModel": "claude-3-opus",
    "maxAgents": 5,
    "timeout": 3600
  }
}
```

**Response: 201 Created**

```json
{
  "project": {
    "id": "proj_abc123",
    "name": "my-project",
    "path": "/home/user/projects/my-project",
    "config": { ... },
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### Get Project

```
GET /projects/:id
```

Returns a single project by ID.

**Response: 200 OK**

```json
{
  "project": { ... }
}
```

**Response: 404 Not Found**

```json
{
  "error": "Project not found"
}
```

---

### Delete Project

```
DELETE /projects/:id
```

Deletes a project and all associated sessions.

**Response: 204 No Content**

**Response: 404 Not Found**

```json
{
  "error": "Project not found"
}
```

---

### Switch Active Project

```
POST /projects/:id/switch
```

Sets the active project for the current session.

**Response: 200 OK**

```json
{
  "project": { ... },
  "message": "Switched to project: my-project"
}
```

**Response: 404 Not Found**

```json
{
  "error": "Project not found"
}
```

---

## Project Configuration

### Get Project Config

```
GET /projects/:id/config
```

Returns the project configuration.

**Response: 200 OK**

```json
{
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
  }
}
```

---

### Update Project Config

```
PUT /projects/:id/config
```

Updates the project configuration.

**Request Body:**

```json
{
  "defaultModel": "gpt-4o",
  "orchestration": {
    "strategy": "parallel",
    "maxConcurrentTasks": 5
  }
}
```

**Response: 200 OK**

```json
{
  "config": { ... }
}
```

---

## Worktree Management

### List Worktrees

```
GET /projects/:id/worktrees
```

Lists all git worktrees for the project.

**Response: 200 OK**

```json
{
  "worktrees": [
    {
      "path": "/home/user/projects/my-project/.swarm/worktrees/task-123",
      "branch": "swarm/my-project/task-123"
    }
  ]
}
```

---

### Create Worktree

```
POST /projects/:id/worktrees
```

Creates a new git worktree for a task.

**Request Body:**

```json
{
  "taskId": "task-123"
}
```

**Response: 201 Created**

```json
{
  "worktree": {
    "path": "/home/user/projects/my-project/.swarm/worktrees/task-123",
    "branch": "swarm/my-project/task-123"
  }
}
```

---

### Remove Worktree

```
DELETE /projects/:id/worktrees/:taskId
```

Removes a git worktree.

**Response: 204 No Content**

---

## Session Management

### List Sessions

```
GET /projects/:projectId/sessions
```

Returns all sessions for a project.

**Response: 200 OK**

```json
{
  "sessions": [
    {
      "id": "ses_xyz789",
      "projectId": "proj_abc123",
      "status": "running",
      "config": { "maxAgents": 3 },
      "agents": [
        { "id": "agent_1", "name": "coordinator", "role": "coordinator", "status": "busy" }
      ],
      "metrics": {
        "tasksTotal": 10,
        "tasksCompleted": 5,
        "tasksFailed": 0,
        "messagesSent": 15,
        "tokensUsed": 45000
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T11:00:00Z"
    }
  ]
}
```

---

### Create Session

```
POST /projects/:projectId/sessions
```

Creates a new session within a project.

**Request Body:**

```json
{
  "config": {
    "maxAgents": 5,
    "timeout": 7200,
    "model": "claude-3-opus"
  }
}
```

**Response: 201 Created**

```json
{
  "session": {
    "id": "ses_xyz789",
    "projectId": "proj_abc123",
    "status": "initializing",
    "config": { ... },
    "agents": [],
    "metrics": {
      "tasksTotal": 0,
      "tasksCompleted": 0,
      "tasksFailed": 0,
      "messagesSent": 0,
      "tokensUsed": 0
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### Get Session

```
GET /projects/:projectId/sessions/:sessionId
```

Returns a single session.

**Response: 200 OK**

```json
{
  "session": { ... }
}
```

**Response: 404 Not Found**

```json
{
  "error": "Session not found"
}
```

---

### Delete Session

```
DELETE /projects/:projectId/sessions/:sessionId
```

Terminates and deletes a session.

**Response: 204 No Content**

**Response: 404 Not Found**

---

## Session Control

### Initialize Session

```
POST /projects/:projectId/sessions/:sessionId/init
```

Initializes and starts a session.

**Request Body (optional):**

```json
{
  "spec": "implement user authentication",
  "context": {
    "files": ["src/auth/*.ts"],
    "dependencies": ["bcrypt", "jsonwebtoken"]
  }
}
```

**Response: 200 OK**

```json
{
  "session": { ... },
  "message": "Session initialized successfully"
}
```

---

### Abort Session

```
POST /projects/:projectId/sessions/:sessionId/abort
```

Immediately stops a running session.

**Response: 200 OK**

```json
{
  "session": { ... },
  "message": "Session aborted"
}
```

---

### Pause Session

```
POST /projects/:projectId/sessions/:sessionId/pause
```

Pauses a running session.

**Response: 200 OK**

```json
{
  "session": { ... },
  "message": "Session paused"
}
```

---

### Resume Session

```
POST /projects/:projectId/sessions/:sessionId/resume
```

Resumes a paused session.

**Response: 200 OK**

```json
{
  "session": { ... },
  "message": "Session resumed"
}
```

---

## Messaging

### List Messages

```
GET /projects/:projectId/sessions/:sessionId/messages
```

Returns all messages in a session.

**Query Parameters:**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `limit` | number | Maximum messages to return | 50 |
| `offset` | number | Offset for pagination | 0 |
| `role` | string | Filter by role | - |

**Response: 200 OK**

```json
{
  "messages": [
    {
      "id": "msg_123",
      "sessionId": "ses_xyz789",
      "role": "user",
      "content": "Implement user authentication",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    {
      "id": "msg_124",
      "sessionId": "ses_xyz789",
      "role": "assistant",
      "content": "I'll help you implement user authentication...",
      "timestamp": "2024-01-15T10:30:05Z"
    }
  ],
  "total": 2
}
```

---

### Send Message

```
POST /projects/:projectId/sessions/:sessionId/messages
```

Sends a message to the session.

**Request Body:**

```json
{
  "role": "user",
  "content": "Implement user authentication with JWT",
  "metadata": {
    "priority": "high"
  }
}
```

**Response: 201 Created**

```json
{
  "message": {
    "id": "msg_125",
    "sessionId": "ses_xyz789",
    "role": "user",
    "content": "Implement user authentication with JWT",
    "metadata": { "priority": "high" },
    "timestamp": "2024-01-15T10:35:00Z"
  }
}
```

---

### Get Message

```
GET /projects/:projectId/sessions/:sessionId/messages/:messageId
```

Returns a single message.

**Response: 200 OK**

```json
{
  "message": { ... }
}
```

**Response: 404 Not Found**

---

## File Operations

### List Files

```
GET /projects/:projectId/sessions/:sessionId/files
```

Returns all tracked files in the session.

**Response: 200 OK**

```json
{
  "files": [
    {
      "path": "src/index.ts",
      "status": "tracked",
      "lastModified": "2024-01-15T10:30:00Z"
    },
    {
      "path": "src/auth/login.ts",
      "status": "modified",
      "lastModified": "2024-01-15T11:00:00Z"
    },
    {
      "path": "src/new-feature.ts",
      "status": "untracked",
      "lastModified": "2024-01-15T11:05:00Z"
    }
  ]
}
```

---

### Get File Content

```
GET /projects/:projectId/sessions/:sessionId/files/:path
```

Returns the content of a specific file. The path is URL-encoded.

**Response: 200 OK**

```json
{
  "path": "src/index.ts",
  "content": "console.log('Hello World');",
  "encoding": "utf-8",
  "size": 25,
  "lastModified": "2024-01-15T10:30:00Z"
}
```

---

### Get File Status

```
GET /projects/:projectId/sessions/:sessionId/files/status
```

Returns the git status of all files in the session.

**Response: 200 OK**

```json
{
  "files": [
    {
      "path": "src/index.ts",
      "status": "tracked",
      "staged": false
    },
    {
      "path": "src/auth/login.ts",
      "status": "modified",
      "staged": false,
      "conflicts": []
    }
  ]
}
```

---

## Plan/Execution

### List Plans

```
GET /projects/:projectId/plans
```

Returns all plans for a project.

**Response: 200 OK**

```json
{
  "plans": [
    {
      "id": "plan_001",
      "projectId": "proj_abc123",
      "status": "completed",
      "tasks": [
        {
          "id": "task_1",
          "title": "Setup project structure",
          "status": "completed",
          "priority": "high",
          "dependencies": [],
          "result": { "success": true }
        }
      ],
      "wave": 1,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T11:00:00Z"
    }
  ]
}
```

---

### Execute Plan

```
POST /projects/:projectId/plans/:planId/execute
```

Starts execution of a plan.

**Response: 200 OK**

```json
{
  "plan": { ... },
  "message": "Plan execution started"
}
```

---

### Get Plan Status

```
GET /projects/:projectId/plans/:planId/status
```

Returns the current status of a plan.

**Response: 200 OK**

```json
{
  "plan": {
    "id": "plan_001",
    "projectId": "proj_abc123",
    "status": "running",
    "tasks": [
      {
        "id": "task_1",
        "title": "Setup project structure",
        "status": "completed",
        "priority": "high",
        "dependencies": [],
        "assignedTo": "agent_1",
        "result": { "success": true }
      },
      {
        "id": "task_2",
        "title": "Implement auth",
        "status": "in_progress",
        "priority": "high",
        "dependencies": ["task_1"],
        "assignedTo": "agent_2"
      }
    ],
    "wave": 1,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

---

### Cancel Plan

```
POST /projects/:projectId/plans/:planId/cancel
```

Cancels a running plan.

**Response: 200 OK**

```json
{
  "plan": { ... },
  "message": "Plan cancelled"
}
```

---

## WebSocket Events

### Connection

Connect to the WebSocket server:

```
ws://localhost:3000/projects/:projectId/sessions/:sessionId/stream
```

### Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `subscribe:run` | `{ runId: string }` | Subscribe to run updates |
| `unsubscribe:run` | `{ runId: string }` | Unsubscribe from run updates |

### Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `session:status` | `{ sessionId, status }` | Session status changed |
| `agent:spawned` | `{ agentId, name, role }` | New agent spawned |
| `agent:status` | `{ agentId, status }` | Agent status changed |
| `task:started` | `{ taskId, title, assignedTo }` | Task started |
| `task:completed` | `{ taskId, result }` | Task completed |
| `task:failed` | `{ taskId, error }` | Task failed |
| `message:new` | `{ message }` | New message received |
| `plan:status` | `{ planId, status }` | Plan status changed |
| `error` | `{ code, message }` | Error occurred |

### Example WebSocket Usage

```javascript
const socket = new WebSocket('ws://localhost:3000/projects/proj_abc123/sessions/ses_xyz789/stream');

socket.onopen = () => {
  console.log('Connected to session stream');
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'task:completed':
      console.log(`Task ${data.taskId} completed!`);
      break;
    case 'agent:spawned':
      console.log(`Agent ${data.name} spawned`);
      break;
  }
};

socket.send(JSON.stringify({
  type: 'subscribe:run',
  runId: 'run_123'
}));
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `CONFLICT` | 409 | Resource conflict |
| `INTERNAL_ERROR` | 500 | Server error |

### Example Error Responses

**400 Bad Request:**

```json
{
  "error": "Invalid request body",
  "code": "VALIDATION_ERROR",
  "details": {
    "path": "name",
    "message": "Name is required"
  }
}
```

**401 Unauthorized:**

```json
{
  "error": "API key required",
  "code": "UNAUTHORIZED"
}
```

**404 Not Found:**

```json
{
  "error": "Project not found",
  "code": "NOT_FOUND"
}
```

---

## Rate Limiting

Rate limiting is applied to all endpoints:

| Tier | Requests/minute |
|------|-----------------|
| Free | 60 |
| Pro | 300 |
| Enterprise | Unlimited |

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705329000
```

---

## Versioning

The API uses URL versioning:

```
GET /api/v1/projects
GET /api/v2/projects
```

The current version is `v1`.

---

## OpenAPI Specification

A machine-readable OpenAPI 3.0 specification is available at:

```
GET /api/spec.json
GET /api/spec.yaml
```

---

*Last updated: 2024-01-15*
