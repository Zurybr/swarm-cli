# Codebase Concerns

**Analysis Date:** 2026-03-09

## Tech Debt

### In-Memory Run Storage
- Issue: Runs are stored in a Map in memory only (`this.runs: Map<string, Run>` in `src/core/orchestrator.ts`)
- Files: `src/core/orchestrator.ts` (lines 28, 41-60)
- Impact: All run data is lost on process restart; no persistence across server restarts
- Fix approach: Integrate SQLite persistence layer (schema already exists in `src/persistence/sqlite/connection.ts`)

### Simulated Agent Execution
- Issue: `GenericAgent.execute()` only simulates work with a 100ms timeout
- Files: `src/core/orchestrator.ts` (lines 273-312)
- Impact: No actual LLM integration; agents do not perform real work
- Fix approach: Implement actual LLM API calls using the `apiUrl`, `apiKey`, and `model` from `AgentConfig`

### Placeholder API Endpoints
- Issue: Tasks API routes are stubbed with TODO comments
- Files: `src/backend/api/routes/tasks.ts` (lines 8-17)
- Impact: Task management via API is non-functional
- Fix approach: Implement database-backed task CRUD operations

### Unimplemented CLI Commands
- Issue: `init` and `agent:stats` commands are placeholders
- Files: `src/cli/index.ts` (lines 56-57, 138-139)
- Impact: Core functionality advertised but not implemented
- Fix approach: Implement project initialization and agent statistics retrieval

### Incomplete Project Board Sync
- Issue: `syncProjectBoard` returns hardcoded mock data
- Files: `src/github-sync/project-sync.ts` (lines 45-60)
- Impact: Project board synchronization does not work
- Fix approach: Implement GitHub Projects API v2 integration for columns and cards

## Known Bugs

### Agent Registry Type Safety Issue
- Issue: Uses `(agent as any).config?.runId` to access private config
- Files: `src/agents/agent-registry.ts` (lines 26, 66)
- Symptoms: Potential runtime errors if config structure changes
- Trigger: Any refactoring of `AgentConfig` interface
- Workaround: Add public `getRunId()` method to `BaseAgent` class

### Error Swallowing in Issue Sync
- Issue: `syncIssuesToTasks` returns empty array on error instead of propagating
- Files: `src/github-sync/issue-sync.ts` (lines 79-82)
- Symptoms: Silent failures when GitHub API fails; appears as "0 issues synced"
- Trigger: GitHub API errors, network issues, authentication failures
- Workaround: Check logs for error messages

### Missing Error Handling in Worktree Listing
- Issue: `listWorktrees` returns empty array on error
- Files: `src/github-sync/worktree-manager.ts` (lines 176-178)
- Symptoms: Cannot distinguish between "no worktrees" and "error listing worktrees"
- Trigger: Git command failures, permission issues
- Workaround: Check application logs

## Security Considerations

### API Key Logging
- Risk: API keys may be logged in agent metadata or error traces
- Files: `src/core/orchestrator.ts` (lines 86-95), `src/agents/base-agent.ts` (line 9)
- Current mitigation: None identified
- Recommendations: Explicitly exclude `apiKey` from logs; consider using environment variables only

### CORS Configuration
- Risk: WebSocket server allows all origins (`cors: { origin: '*' }`)
- Files: `src/backend/api/server.ts` (line 16)
- Current mitigation: None
- Recommendations: Restrict to known origins in production; make configurable via environment

### No Input Validation
- Risk: API endpoints do not validate request body structure
- Files: `src/backend/api/routes/runs.ts`, `src/backend/api/routes/agents.ts`
- Current mitigation: Express JSON parsing only
- Recommendations: Add Zod or Joi validation schemas for all inputs

### Config File Path Traversal
- Risk: `loadConfig()` uses user-supplied path without validation
- Files: `src/utils/config-loader.ts` (line 22)
- Current mitigation: None
- Recommendations: Validate path is within allowed directories; use absolute path resolution

## Performance Bottlenecks

### Synchronous File Operations
- Problem: `config-loader.ts` uses synchronous file read
- Files: `src/utils/config-loader.ts` (line 22)
- Cause: `fs.readFileSync` blocks event loop
- Improvement path: Use async file operations; cache config after first load

### No Connection Pooling for SQLite
- Problem: Each operation creates new database connections
- Files: `src/persistence/sqlite/connection.ts`
- Cause: Single connection instance without pooling
- Improvement path: Implement connection pooling for concurrent operations

### In-Memory Run Storage Limits
- Problem: No limit on number of runs stored in memory
- Files: `src/core/orchestrator.ts` (line 28)
- Cause: Unbounded Map growth
- Improvement path: Add LRU eviction or persist to database

### Ralph Loop Blocking
- Problem: Ralph loop retries block the agent execution thread
- Files: `src/core/orchestrator.ts` (lines 147-186)
- Cause: Synchronous while loop with fixed 1-second delays
- Improvement path: Implement exponential backoff; make delay configurable

## Fragile Areas

### Git Command Execution
- Files: `src/github-sync/worktree-manager.ts` (lines 30-40, 55, 84, 109-118, 143-145)
- Why fragile: Relies on git CLI output parsing; no validation of git repository state
- Safe modification: Always wrap in try-catch; validate git repo exists before operations
- Test coverage: No tests found for git operations

### SQLite Schema Initialization
- Files: `src/persistence/sqlite/connection.ts` (lines 25-74)
- Why fragile: Schema changes require manual migration; no versioning
- Safe modification: Add migration system; version schema
- Test coverage: No migration tests found

### Agent Registry Memory Leaks
- Files: `src/agents/agent-registry.ts`
- Why fragile: No automatic cleanup of completed/failed agents; `clearRun` must be called explicitly
- Safe modification: Add TTL or automatic cleanup based on agent status
- Test coverage: No lifecycle tests found

### Singleton Orchestrator State
- Files: `src/backend/orchestrator-instance.ts`
- Why fragile: Global mutable state; difficult to test; race conditions possible
- Safe modification: Use dependency injection; create orchestrator per request or scope
- Test coverage: No isolation tests found

## Scaling Limits

### Concurrent Agent Limit
- Current capacity: 10 parallel agents (configurable via `maxParallelAgents`)
- Limit: Memory and event loop constraints
- Scaling path: Implement worker threads or process pool for CPU-intensive agents

### WebSocket Connections
- Current capacity: Unlimited (no connection limit)
- Limit: Memory and file descriptor limits
- Scaling path: Add connection limits; implement Redis adapter for multi-instance deployments

### SQLite Concurrency
- Current capacity: Single writer, multiple readers
- Limit: Write contention under high load
- Scaling path: Migrate to PostgreSQL or implement write queue

## Dependencies at Risk

### @octokit/rest
- Risk: GitHub Projects API v1 deprecated; methods used may be removed
- Impact: `createForRepo`, `createCard` in `src/github-sync/github-client.ts` (lines 58, 74)
- Migration plan: Migrate to GitHub Projects API v2 (GraphQL-based)

### @mastra/core
- Risk: Version 0.1.0 is pre-release; API may change significantly
- Impact: Core orchestration if Mastra integration expands
- Migration plan: Pin version; monitor changelog; wrap in abstraction layer

### sqlite3
- Risk: Native module compilation issues on some platforms
- Impact: Deployment complexity
- Migration plan: Consider better-sqlite3 or migrate to PostgreSQL

### chalk v5
- Risk: ESM-only package may cause compatibility issues
- Impact: CLI may fail in certain Node.js configurations
- Migration plan: Use dynamic import or downgrade to chalk v4

## Missing Critical Features

### Authentication/Authorization
- Problem: API server has no authentication mechanism
- Blocks: Production deployment; multi-tenant usage
- Priority: High

### Run Persistence
- Problem: Runs exist only in memory
- Blocks: Production reliability; crash recovery
- Priority: High

### Real LLM Integration
- Problem: Agents simulate execution only
- Blocks: Actual AI-powered functionality
- Priority: High

### Task Queue
- Problem: No persistent task queue for retries and scheduling
- Blocks: Reliable task execution; failure recovery
- Priority: Medium

### Webhook Handling
- Problem: No incoming webhook support for GitHub events
- Blocks: Real-time GitHub integration
- Priority: Medium

## Test Coverage Gaps

### No Unit Tests
- What's not tested: All source files
- Files: Entire `src/` directory
- Risk: Regressions undetected; refactoring dangerous
- Priority: High

### No Integration Tests
- What's not tested: GitHub API interactions, database operations, CLI workflows
- Files: `src/github-sync/`, `src/persistence/`, `src/cli/`
- Risk: External API changes break functionality silently
- Priority: High

### No Error Scenario Tests
- What's not tested: Network failures, API errors, disk full conditions
- Risk: Error handling paths may not work
- Priority: Medium

---

*Concerns audit: 2026-03-09*
