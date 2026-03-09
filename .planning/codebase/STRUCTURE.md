# Codebase Structure

**Analysis Date:** 2026-03-09

## Directory Layout

```
swarm-cli/
├── package.json              # NPM dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── README.md                 # Project documentation
├── LICENSE                   # MIT License
├── docs/                     # Documentation
│   ├── plans/                # Implementation plans
│   ├── architecture/         # Architecture docs and diagrams
│   └── agency-agents.md      # Agency agents reference
│
├── src/                      # Source code
│   ├── agents/               # Agent system
│   │   ├── definitions/      # Agency agent definitions
│   │   ├── base-agent.ts     # Abstract agent class
│   │   └── agent-registry.ts # Agent instance registry
│   │
│   ├── core/                 # Core orchestration
│   │   └── orchestrator.ts   # Main orchestrator implementation
│   │
│   ├── backend/              # Backend API
│   │   ├── index.ts          # Server entry point
│   │   ├── orchestrator-instance.ts  # Singleton instance
│   │   └── api/
│   │       ├── server.ts     # Express/Socket.IO setup
│   │       └── routes/
│   │           ├── runs.ts   # Run CRUD and execution
│   │           ├── agents.ts # Agent listing and stats
│   │           └── tasks.ts  # Task routes (placeholder)
│   │
│   ├── cli/                  # Command line interface
│   │   ├── index.ts          # CLI entry and commands
│   │   ├── human/
│   │   │   └── interactive.ts  # Interactive mode
│   │   └── ai/
│   │       └── structured.ts   # AI structured mode
│   │
│   ├── github-sync/          # GitHub integration
│   │   ├── github-client.ts  # Octokit wrapper
│   │   ├── issue-sync.ts     # Issue <-> Task sync
│   │   ├── project-sync.ts   # Project board sync
│   │   └── worktree-manager.ts  # Git worktree operations
│   │
│   ├── persistence/          # Data persistence
│   │   └── sqlite/
│   │       └── connection.ts # SQLite connection and schema
│   │
│   └── utils/                # Utilities
│       ├── logger.ts         # Logging utility
│       └── config-loader.ts  # YAML config loading
│
├── dist/                     # Compiled output (generated)
├── node_modules/             # Dependencies
└── .planning/                # Planning documents
    └── codebase/             # Codebase analysis docs
```

## Directory Purposes

**src/agents/:**
- Purpose: Agent lifecycle and definitions
- Contains: Base class, registry, Agency agent configs
- Key files:
  - `src/agents/base-agent.ts`: Abstract agent with lifecycle hooks
  - `src/agents/agent-registry.ts`: Singleton registry for agent instances
  - `src/agents/definitions/agency-agents.ts`: 61 pre-defined agent personalities

**src/core/:**
- Purpose: Central orchestration logic
- Contains: Orchestrator class, Run type definitions
- Key files:
  - `src/core/orchestrator.ts`: Main orchestrator (312 lines, largest file)

**src/backend/:**
- Purpose: HTTP API and WebSocket server
- Contains: Express routes, Socket.IO events
- Key files:
  - `src/backend/api/server.ts`: Server setup with event bridging
  - `src/backend/api/routes/runs.ts`: Run API endpoints
  - `src/backend/api/routes/agents.ts`: Agent API endpoints
  - `src/backend/orchestrator-instance.ts`: Shared orchestrator singleton

**src/cli/:**
- Purpose: Command-line interface
- Contains: Command definitions, interactive prompts
- Key files:
  - `src/cli/index.ts`: Main CLI with all commands (183 lines)
  - `src/cli/human/interactive.ts`: Interactive menu mode (176 lines)
  - `src/cli/ai/structured.ts`: Structured JSON output mode

**src/github-sync/:**
- Purpose: GitHub integration and git operations
- Contains: Issue sync, project sync, worktree management
- Key files:
  - `src/github-sync/worktree-manager.ts`: Git worktree operations (200 lines)
  - `src/github-sync/github-client.ts`: GitHub API wrapper
  - `src/github-sync/issue-sync.ts`: Bidirectional issue sync

**src/persistence/:**
- Purpose: Data storage
- Contains: SQLite connection
- Key files:
  - `src/persistence/sqlite/connection.ts`: Database connection and schema

**src/utils/:**
- Purpose: Shared utilities
- Contains: Logger, config loader
- Key files:
  - `src/utils/logger.ts`: Structured logging utility
  - `src/utils/config-loader.ts`: YAML configuration loading

## Key File Locations

**Entry Points:**
- `src/cli/index.ts`: CLI entry (bin: swarm-cli)
- `src/backend/index.ts`: Server entry (npm run dev)

**Configuration:**
- `tsconfig.json`: TypeScript compiler options
- `package.json`: Dependencies and scripts
- Config loaded from: `./config/default.yaml` (env: SWARM_CONFIG)

**Core Logic:**
- `src/core/orchestrator.ts`: Main orchestration logic
- `src/agents/base-agent.ts`: Agent base class
- `src/agents/agent-registry.ts`: Agent tracking

**Testing:**
- No test files detected in current codebase
- Jest configured in package.json but no tests directory present

## Naming Conventions

**Files:**
- kebab-case for all source files: `base-agent.ts`, `worktree-manager.ts`
- Descriptive names matching class/function: `orchestrator.ts` contains `Orchestrator` class

**Directories:**
- kebab-case: `github-sync`, `persistence/sqlite`
- Feature-based grouping: `agents/`, `cli/human/`, `cli/ai/`

**Classes:**
- PascalCase: `Orchestrator`, `BaseAgent`, `AgentRegistry`
- Suffix pattern: `*Manager`, `*Registry`, `*Client`

**Interfaces:**
- PascalCase with descriptive names: `AgentConfig`, `AgentResult`, `OrchestratorConfig`

**Functions:**
- camelCase: `createRun`, `spawnAgent`, `executeTask`
- Async prefix not required, but most key methods are async

## Where to Add New Code

**New Feature:**
- Primary code: `src/core/` for orchestration logic
- API endpoints: `src/backend/api/routes/`
- CLI commands: `src/cli/index.ts`

**New Agent Type:**
- Add to Agency definitions: `src/agents/definitions/agency-agents.ts`
- Or extend base class: Create new file in `src/agents/`

**New API Route:**
- Create file in: `src/backend/api/routes/`
- Mount in: `src/backend/api/server.ts`
- Follow pattern: Export `*Router` and use `app.use('/api/path', router)`

**New CLI Command:**
- Add to: `src/cli/index.ts`
- Use Commander pattern: `program.command('name').action(handler)`
- For interactive: Add case to `interactiveMode()` switch in `src/cli/human/interactive.ts`

**Utilities:**
- Shared helpers: `src/utils/`
- Logger usage: `new Logger('ContextName')`

**Persistence:**
- New tables: Add to `initializeSchema()` in `src/persistence/sqlite/connection.ts`
- New storage types: Create subdirectory under `src/persistence/`

## Special Directories

**docs/:**
- Purpose: Project documentation
- Contains: Architecture docs, plans, agent reference
- Generated: No
- Committed: Yes

**.planning/:**
- Purpose: Planning and analysis documents
- Contains: Codebase analysis docs
- Generated: No
- Committed: Yes (excluded from production)

**dist/:**
- Purpose: Compiled JavaScript output
- Generated: Yes (tsc build)
- Committed: No (in .gitignore)

**node_modules/:**
- Purpose: NPM dependencies
- Generated: Yes (npm install)
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-03-09*
