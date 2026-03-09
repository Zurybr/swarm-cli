# External Integrations

**Analysis Date:** 2026-03-09

## APIs & External Services

**GitHub:**
- Purpose: Issue tracking, project management, repository operations
- SDK: `@octokit/rest` 20.0
- Auth: GitHub Personal Access Token (passed to `GitHubClient` constructor)
- Key capabilities:
  - Create/list/update issues (`src/github-sync/github-client.ts`)
  - Create projects and add issues to projects
  - Worktree management via local git (`src/github-sync/worktree-manager.ts`)
- Implementation: `src/github-sync/github-client.ts`, `src/github-sync/issue-sync.ts`, `src/github-sync/project-sync.ts`

**LLM APIs:**
- Purpose: Agent execution (configured per-agent, not hardcoded)
- No specific SDK dependency - uses configurable API URLs
- Expected endpoints: OpenAI-compatible API format
- Configuration: Per-agent via `apiUrl`, `apiKey`, `model` in `AgentConfig`
- Default example: `https://api.openai.com/v1` (in interactive prompts)

## Data Storage

**Databases:**
- SQLite 3
  - Connection: `src/persistence/sqlite/connection.ts`
  - Path: Configurable via `SWARM_DATA_PATH` env var (default: `/app/data` in Docker)
  - Schema: Auto-initializes tables for runs, tasks, agents
  - Tables:
    - `runs` - Run metadata and status
    - `tasks` - Task definitions with dependencies and GitHub issue linkage
    - `agents` - Agent instances and status

**File Storage:**
- Local filesystem for SQLite database
- Git worktrees in `.worktrees/` directory
- Logs directory (mounted in Docker)

**Caching:**
- None detected (in-memory Maps used for runtime state)

## Authentication & Identity

**Auth Provider:**
- Custom/None for internal API
- GitHub token for GitHub operations (external)
- No JWT or session management detected

**API Security:**
- Config placeholder for auth in `Config` interface: `{ type: string; secret: string }`
- Not actively enforced in current routes

## Monitoring & Observability

**Error Tracking:**
- None (custom Logger class only)

**Logs:**
- Custom logger: `src/utils/logger.ts`
- Console output with timestamps
- Log levels: DEBUG, INFO, WARN, ERROR
- Context-based tagging (e.g., `[Agent:role:id]`, `[Orchestrator]`)

**Health Checks:**
- HTTP endpoint: `GET /health`
- Docker healthcheck configured in compose

## CI/CD & Deployment

**Hosting:**
- Docker-based deployment
- Development environment provided
- No production Dockerfile detected (only `Dockerfile.dev`)

**CI Pipeline:**
- None detected

**Scripts:**
- `dev.sh` - Development helper script
- `Makefile` - Common tasks (build, dev, docker-dev)

## Environment Configuration

**Required env vars:**
- `PORT` - API server port (default: 3000)
- `NODE_ENV` - development/production
- `SWARM_DATA_PATH` - SQLite database location
- `DEBUG` - Enable debug logging

**Configuration file:**
- YAML-based config: `config/default.yaml` (path configurable via `SWARM_CONFIG`)
- Loaded by: `src/utils/config-loader.ts`
- Sections: backend, persistence, github, embedding, agents

**Secrets location:**
- `.env` file (referenced in docker-compose, not in repo)
- GitHub token passed at runtime

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected
- WebSocket events broadcast from orchestrator (internal, not external webhooks)

## Integration Architecture

**Orchestrator Event Flow:**
```
Orchestrator (EventEmitter)
  -> WebSocket broadcast (Socket.IO)
  -> Connected clients receive real-time updates
```

**GitHub Sync Flow:**
```
Spec -> IssueSync -> GitHubClient -> GitHub API
     -> ProjectSync -> GitHub Projects
     -> WorktreeManager -> Local git worktrees
```

**Agent Execution Flow:**
```
Orchestrator -> spawnAgent -> AgentRegistry
             -> executeTask -> BaseAgent subclasses
             -> (intended) LLM API calls
```

---

*Integration audit: 2026-03-09*
