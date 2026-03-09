# Technology Stack

**Analysis Date:** 2026-03-09

## Languages

**Primary:**
- TypeScript 5.3+ - All application code
- JavaScript (ES2022 target) - Runtime output

**Secondary:**
- YAML - Configuration files
- Shell/Bash - Docker entrypoints and dev scripts

## Runtime

**Environment:**
- Node.js 22+ (specified in `package.json` engines and `Dockerfile.dev`)

**Package Manager:**
- npm (lockfile: `package-lock.json` expected but not committed)

## Frameworks

**Core:**
- Express.js 4.18 - HTTP API server (`src/backend/api/server.ts`)
- Socket.IO - Real-time WebSocket communication for orchestrator events
- Commander 12.0 - CLI framework (`src/cli/index.ts`)

**Agent Framework:**
- @mastra/core 0.1.0 - AI agent framework (declared in dependencies, not actively imported in current codebase)

**Testing:**
- Jest 29.7 - Test runner
- @types/jest 29.5 - TypeScript definitions

**Build/Dev:**
- TypeScript 5.3 - Compiler
- ts-node 10.9 - TypeScript execution for development
- nodemon - Hot reload in Docker dev environment

## Key Dependencies

**Critical:**
- `sqlite3` 5.1.6 - Local database for runs, tasks, agents (`src/persistence/sqlite/connection.ts`)
- `@octokit/rest` 20.0 - GitHub API integration (`src/github-sync/github-client.ts`)
- `ws` 8.16 - WebSocket support (via Socket.IO)

**CLI/UI:**
- `chalk` 5.3 - Terminal colors
- `inquirer` 9.2 - Interactive prompts (`src/cli/human/interactive.ts`)

**Data:**
- `yaml` 2.3 - YAML parsing for config files (`src/utils/config-loader.ts`)

**Utilities:**
- `commander` 12.0 - CLI argument parsing

## Configuration

**TypeScript:**
- Config: `tsconfig.json`
- Target: ES2022
- Module: CommonJS
- Output: `./dist`
- Source: `./src`
- Strict mode enabled

**Build:**
- Entry point: `dist/index.js` (main), `dist/cli/index.js` (CLI binary)
- Build command: `npm run build` (runs `tsc`)

**Development:**
- Dev server: `npm run dev` (runs `ts-node src/backend/index.ts`)
- CLI dev: `npm run cli` (runs `ts-node src/cli/index.ts`)

**Linting:**
- ESLint 8.56 configured
- Run: `npm run lint`

**Testing:**
- Jest configured (no config file found, using defaults)
- Run: `npm test`

## Platform Requirements

**Development:**
- Node.js >= 22.0.0
- npm
- Git (for worktree operations)
- Docker + Docker Compose (optional, for containerized dev)

**Production:**
- Node.js >= 22.0.0 runtime
- SQLite file system access for persistence
- Git executable in PATH (for worktree operations)

**Docker:**
- Base image: `node:22-alpine`
- Development Dockerfile: `Dockerfile.dev`
- Compose file: `docker-compose.yml`
- Exposed ports: 3000 (API), 9229 (Node.js debug)

## Notable Architecture Decisions

**No External Database Required:**
- Uses SQLite for all persistence needs
- Database path configurable via `SWARM_DATA_PATH` env var
- Schema auto-initializes on connection

**Git-Native Workflow:**
- Uses git worktrees for isolated task execution
- Requires git repository context

**Event-Driven:**
- Orchestrator extends EventEmitter
- WebSocket broadcasts events to connected clients

---

*Stack analysis: 2026-03-09*
