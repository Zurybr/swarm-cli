# Swarm CLI - New Agent Capabilities

## What This Is

A TypeScript CLI tool for orchestrating AI agent swarms to assist with software development tasks. The system manages agent lifecycle, coordinates multi-agent workflows, persists state across runs, and integrates with GitHub for issue/project synchronization.

## Core Value

Enable developers to spawn specialized AI agents that collaborate on development tasks with persistent memory, human oversight, and seamless GitHub integration.

## Requirements

### Validated

- ✓ Orchestrator manages agent lifecycle and task distribution — existing
- ✓ 61 specialized agency agents available for task assignment — existing
- ✓ GitHub integration (issues, projects, worktrees) — existing
- ✓ Multi-store persistence (SQLite, vector, graph) — existing
- ✓ Dual CLI modes (interactive human, structured AI) — existing
- ✓ WebSocket API for real-time orchestration events — existing

### Active

- [ ] New domain-specific expert agents (security, performance, data analysis)
- [ ] New workflow agents (reviewers, validators, documenters)
- [ ] New agent skills/patterns (planning strategies, code analysis techniques)
- [ ] Agent skill discovery and registration system
- [ ] Agent capability composability

### Out of Scope

- Replacing existing 61 agency agents — current agents remain
- Web UI development — CLI focus only
- Multi-language support beyond TypeScript/JavaScript
- Cloud deployment infrastructure

## Context

**Existing Architecture:**
- Agent system: `src/agents/` with base class, registry, and 61 agency agent definitions
- Persistence: SQLite for runs/tasks, vector store for embeddings, graph store for relationships
- GitHub sync: Issue/project synchronization with git worktree management
- Backend API: Express + Socket.IO for orchestration events
- CLI: Commander.js with interactive and structured modes

**Technical Environment:**
- TypeScript 5.3+, Node.js 22+
- SQLite3, vector DB, graph DB interfaces configured
- @octokit/rest for GitHub API
- Jest for testing

## Constraints

- **Tech Stack**: TypeScript/Node.js — existing codebase
- **Compatibility**: Must integrate with existing `AGENCY_AGENTS` definitions
- **Testing**: New agents need unit tests following existing patterns
- **Documentation**: Agent definitions require markdown documentation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Extend agent ecosystem | Leverage existing infrastructure | — Pending |
| Maintain agency pattern | Consistency with 61 existing agents | — Pending |
| Use existing persistence | SQLite/vector/graph already configured | — Pending |

---
*Last updated: 2026-03-09 after initialization*
