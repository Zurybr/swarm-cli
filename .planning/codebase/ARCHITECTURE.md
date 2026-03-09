# Architecture

**Analysis Date:** 2026-03-09

## Pattern Overview

**Overall:** Modular Agent-Orchestration System with Event-Driven Architecture

**Key Characteristics:**
- Event-driven orchestration with EventEmitter pattern
- Multi-interface support (CLI human, CLI AI, REST API, WebSocket)
- Run-based execution model with parallel/sequential task strategies
- Agent registry pattern with singleton orchestrator
- Git worktree isolation for task execution

## Layers

**CLI Layer:**
- Purpose: User interaction and command dispatch
- Location: `src/cli/`
- Contains: Interactive prompts, structured AI mode, command definitions
- Depends on: Orchestrator, Agent definitions
- Used by: End users (humans and AIs)

**API Layer:**
- Purpose: HTTP/WebSocket interface for external integration
- Location: `src/backend/api/`
- Contains: Express routes, Socket.IO events, middleware
- Depends on: Orchestrator
- Used by: Frontend clients, external systems

**Orchestration Layer:**
- Purpose: Central coordination of runs, agents, and tasks
- Location: `src/core/orchestrator.ts`
- Contains: Run lifecycle management, execution strategies, RALPH loop
- Depends on: Agent registry, Agent definitions, Logger
- Used by: CLI, API, GitHub sync

**Agent Layer:**
- Purpose: Agent definitions, lifecycle, and execution
- Location: `src/agents/`
- Contains: Base agent class, registry, 61 Agency agent definitions
- Depends on: Logger
- Used by: Orchestrator

**Persistence Layer:**
- Purpose: Data storage and retrieval
- Location: `src/persistence/`
- Contains: SQLite connection, schema management
- Depends on: sqlite3
- Used by: Orchestrator (partially implemented)

**GitHub Sync Layer:**
- Purpose: Bidirectional sync with GitHub issues/projects
- Location: `src/github-sync/`
- Contains: GitHub client, issue sync, project sync, worktree manager
- Depends on: @octokit/rest, Logger
- Used by: Orchestrator

**Utilities Layer:**
- Purpose: Cross-cutting concerns
- Location: `src/utils/`
- Contains: Logger, config loader
- Depends on: None (foundational)
- Used by: All layers

## Data Flow

**Run Creation Flow:**

1. CLI/API receives request with spec
2. `Orchestrator.createRun()` creates run record
3. Run stored in memory Map (runs)
4. Event `run:created` emitted
5. WebSocket broadcasts to subscribed clients

**Agent Spawn Flow:**

1. CLI/API calls `orchestrator.spawnAgent(runId, agencyAgentId, config)`
2. Orchestrator validates run exists and parallel limit not exceeded
3. `AgentRegistry.register()` stores agent instance
4. Agent added to run.agents array
5. Event `agent:spawned` emitted
6. WebSocket broadcasts update

**Task Execution Flow:**

1. `orchestrator.executeRun(runId)` called
2. Strategy decided: parallel vs sequential based on dependencies
3. For each task:
   - Event `task:started` emitted
   - If RALPH loop enabled: retry until success or max iterations
   - Agent.execute() called
   - Task status updated
   - Event `task:completed` emitted
4. Run status updated to completed/failed
5. Event `run:completed` emitted

**GitHub Integration Flow:**

1. Spec parsed into tasks
2. `IssueSync.createIssuesFromSpec()` creates GitHub issues
3. `WorktreeManager.createWorktree()` isolates work per issue
4. Agent executes in worktree context
5. Changes committed and merged via worktree manager

## Key Abstractions

**Orchestrator:**
- Purpose: Central coordinator for all operations
- Location: `src/core/orchestrator.ts`
- Pattern: Singleton with EventEmitter
- Key methods: createRun, spawnAgent, executeRun, executeTask

**BaseAgent:**
- Purpose: Abstract base for all agent implementations
- Location: `src/agents/base-agent.ts`
- Pattern: Template method pattern with lifecycle hooks
- Key methods: execute (abstract), beforeExecute, afterExecute, retryWithBackoff

**AgentRegistry:**
- Purpose: Central agent instance tracking
- Location: `src/agents/agent-registry.ts`
- Pattern: Registry pattern with Map storage
- Key features: Query by run, status, role; statistics

**Agency Agents:**
- Purpose: Pre-defined agent personalities and capabilities
- Location: `src/agents/definitions/agency-agents.ts`
- Pattern: Static configuration objects
- Contains: 61 agent definitions across Engineering, Testing, PM, Marketing divisions

**Run:**
- Purpose: Execution context for a specification
- Location: Defined in `src/core/orchestrator.ts`
- Pattern: Data structure with lifecycle state
- States: pending -> planning -> executing -> validating -> completed/failed

## Entry Points

**CLI Entry:**
- Location: `src/cli/index.ts`
- Triggers: Command line invocation
- Responsibilities: Parse commands, dispatch to handlers, interactive mode

**Backend/Server Entry:**
- Location: `src/backend/index.ts`
- Triggers: `npm run dev` or direct execution
- Responsibilities: Start API server on configured port

**API Server:**
- Location: `src/backend/api/server.ts`
- Triggers: Called from backend entry
- Responsibilities: Express setup, route mounting, WebSocket initialization, event bridging

**Orchestrator Singleton:**
- Location: `src/backend/orchestrator-instance.ts`
- Triggers: Module import
- Responsibilities: Provide shared orchestrator instance with default config

## Error Handling

**Strategy:** Try-catch with logging, graceful degradation

**Patterns:**
- All async operations wrapped in try-catch blocks
- Errors logged via Logger utility
- API returns 500 status with generic error message
- RALPH loop catches exceptions and continues retrying
- Agent execution failures tracked in AgentResult

## Cross-Cutting Concerns

**Logging:**
- Implementation: Custom Logger class (`src/utils/logger.ts`)
- Pattern: Context-based logging with timestamps
- Levels: DEBUG, INFO, WARN, ERROR
- Usage: All classes receive Logger instance with context name

**Validation:**
- Implementation: Manual validation in route handlers and methods
- Pattern: Early returns with 400 status for missing required fields
- Examples: Required params checked in `runs.ts`, `agents.ts` routes

**Authentication:**
- Implementation: Not implemented (placeholder in config)
- Config location: `src/utils/config-loader.ts`
- Note: Auth type defined but not enforced in current routes

**Configuration:**
- Implementation: YAML-based config with env override
- Pattern: `loadConfig()` reads from `SWARM_CONFIG` env var or default path
- Default path: `./config/default.yaml`

---

*Architecture analysis: 2026-03-09*
