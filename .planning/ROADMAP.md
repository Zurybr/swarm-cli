# Roadmap: New Agent Capabilities

**Version:** 1.0
**Status:** Phase 1 Complete (4/4 plans), Phase 2 Complete (3/3), Phase 3 Complete (3/3), Phase 4 In Progress (1/3 plans)
**Created:** 2026-03-09

---

## Phase Overview

| Phase | Name | Requirements | Est. Duration |
|-------|------|--------------|---------------|
| 1 | Foundation | Complete    | 2026-03-09 |
| 2 | Complete | Complete | 2026-03-09 |
| 3 | Complete | Complete | 2026-03-10 |
| 4 | In Progress | REQ-03 | 3-4 days |
| 5 | Orchestration Patterns | REQ-05 | 2-3 days |
| 6 | Conflict Detection | REQ-06 | 2-3 days |
| 7 | Observability | REQ-07, REQ-04 | 2-3 days |

---

## Phase 1: Foundation
**Focus:** Testing framework and security controls

**Goal:** Enable safe development of agent capabilities with proper testing infrastructure.

**Requirements:**
- REQ-04: Agent testing framework (foundations)

**Plans:**
4/4 plans complete
- [x] 01-02-PLAN.md — Mock LLM client and fixtures (Complete)
- [x] 01-03-PLAN.md — Security guardrails base class and implementations (Complete)
- [x] 01-04-PLAN.md — Test harnesses and integration (Complete)

**Key Deliverables:**
- Deterministic test mode for skills
- Mock LLM response fixtures
- Security guardrails base class

**Success Criteria:**
- Can write a test that verifies agent skill behavior deterministically
- Security guards prevent unsafe operations in test mode

---

## Phase 2: Skill Registry
**Focus:** Dynamic capability registration

**Goal:** Central registry for agent skills with metadata and versioning.

**Requirements:**
- REQ-01: Agent skill registry

**Plans:**
3/3 plans executed
- [x] 02-01-PLAN.md — Core types, schemas, and SQLite persistence (Wave 1) — Complete
- [x] 02-02-PLAN.md — FTS5 search, version management, and SkillRegistry class (Wave 2) — Complete
- [x] 02-03-PLAN.md — CLI commands and public API exports (Wave 3) — Complete

**Key Deliverables:**
- `SkillRegistry` class with CRUD operations — Complete
- Skill metadata schema (name, description, schema, version) — Complete
- SQLite persistence integration — Complete
- FTS5 full-text search — Complete
- Semantic version management — Complete
- CLI commands: `skill register`, `skill list`, `skill search`, `skill get` — Complete

**Success Criteria:**
- Can register a skill and retrieve it by name — Complete
- Skills persist across process restarts — Complete
- Search returns relevant skills by description — Complete

**Depends On:** Phase 1

---

## Phase 3: Composable Builder
**Focus:** Agent composition from skills

**Goal:** Build agents by composing skills from registry with validation.

**Requirements:**
- REQ-02: Composable agent builder

**Plans:**
3/3 plans complete
- [x] 03-01-PLAN.md — AgentBuilder fluent API and schema validation (Wave 1) — Complete
- [x] 03-02-PLAN.md — ComposedAgent class and orchestrator integration (Wave 2) — Complete
- [x] 03-03-PLAN.md — CLI commands and integration tests (Wave 3) — Complete

**Key Deliverables:**
- `AgentBuilder` fluent API — Complete
- `ComposedAgent` class with skill chain execution — Complete
- `SkillChain` and `SkillChainExecutor` for orchestration — Complete
- Input/output compatibility validation — Complete
- CLI command: `agent build` — Complete

**Success Criteria:**
- Can compose two compatible skills into an agent — Complete
- Incompatible skills trigger validation error — Complete
- Composed agents execute via existing orchestrator — Complete

**Depends On:** Phase 2

---

## Phase 4: Domain Expert Agents
**Focus:** Pre-built specialized agents

**Goal:** Three production-ready domain agents using the composition system.

**Requirements:**
- REQ-03: Domain expert agents

**Plans:**
1/3 plans executed
- [x] 04-01-PLAN.md — Core expert skills: Security, Performance, Documentation (Wave 1) — Complete
- [ ] 04-02-PLAN.md — ExpertAgent definitions extending AgencyAgent, ExpertAPI (Wave 2)
- [ ] 04-03-PLAN.md — CLI commands and integration tests (Wave 3)

**Key Deliverables:**
- [x] Security Review Skill (dependency scanning, secret detection) — Complete
- [x] Performance Expert Skill (complexity analysis, bottleneck detection) — Complete
- [x] Documentation Expert Skill (doc generation, drift detection) — Complete
- [x] Expert definitions in `src/skills/expert-definitions/` — Complete
- [ ] CLI commands: `swarm security-scan`, `swarm perf-analyze`, `swarm doc-check` — Planned for 04-03

**Success Criteria:**
- [x] Security agent flags known vulnerability patterns — Complete
- [x] Performance agent identifies slow functions — Complete
- [x] Documentation agent generates JSDoc for undocumented functions — Complete

**Depends On:** Phase 3

---

## Phase 5: Orchestration Patterns
**Focus:** Multi-agent coordination

**Goal:** Built-in patterns for agent collaboration.

**Requirements:**
- REQ-05: Workflow orchestration patterns

**Key Deliverables:**
- `SequentialPipeline` pattern
- `ParallelSpecialists` pattern
- `SupervisorDelegate` pattern
- Pattern factory integrated with orchestrator

**Success Criteria:**
- Can chain 3 agents in sequence via pipeline
- Parallel agents execute concurrently
- Supervisor routes tasks to appropriate delegate

**Depends On:** Phase 3

---

## Phase 6: Conflict Detection
**Focus:** Skill conflict resolution

**Goal:** Detect and resolve capability conflicts at composition/runtime.

**Requirements:**
- REQ-06: Capability conflict detection

**Key Deliverables:**
- Static conflict analyzer
- Runtime conflict resolver with confidence scoring
- Conflict reporting in registry

**Success Criteria:**
- Static analysis flags incompatible skill pair
- Runtime conflict resolved via confidence voting
- Conflicts logged with resolution details

**Depends On:** Phase 2, Phase 3

---

## Phase 7: Observability
**Focus:** Metrics and monitoring

**Goal:** Full observability into agent execution.

**Requirements:**
- REQ-07: Agent performance metrics
- REQ-04: Agent testing framework (evaluation)

**Key Deliverables:**
- Metrics collection service
- CLI dashboard: `swarm metrics`
- LLM-as-a-Judge evaluation harness
- Prometheus-compatible export

**Success Criteria:**
- Metrics show skill invocation latency
- Dashboard displays agent success rates
- Evaluation harness scores agent outputs

**Depends On:** Phase 2, Phase 4

---

## Milestone Summary

| Milestone | Phases | Deliverables |
|-----------|--------|--------------|
| v1.0 Foundation | 1 | Testing + security base |
| v1.0 Core | 2-3 | Skill registry + composition |
| v1.0 Agents | 4 | 3 domain expert agents |
| v1.0 Advanced | 5-7 | Orchestration + observability |

---

## Next Steps

1. **Phase 4** → Continue with 04-02: ExpertAgent definitions and ExpertAPI
2. Phase 4-01 complete: SecurityReviewSkill, PerformanceExpertSkill, DocumentationExpertSkill (28 tests)
3. Phase 4 in progress: 1 of 3 plans complete, 2 remaining (ExpertAgent definitions, CLI commands)

---

*Requirements: .planning/REQUIREMENTS.md*
*Research: .planning/research/SUMMARY.md*
