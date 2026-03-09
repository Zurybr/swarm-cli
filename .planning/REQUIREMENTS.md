# Requirements: New Agent Capabilities

**Project:** Swarm CLI Agent Extensions
**Version:** v1.0
**Last Updated:** 2026-03-09

---

## Must Have (v1)

### REQ-01: Agent Skill Registry
**Description:** Dynamic registration and discovery of agent capabilities

**Acceptance Criteria:**
- [x] Skills can be registered at runtime with metadata (name, description, input/output schema)
- [x] Registry supports versioned skill definitions
- [ ] Skills can be discovered via semantic search or category browsing
- [x] Registry persists to existing SQLite backend

**From Research:** Pattern from LangGraph/AG2 — central registry with metadata enables dynamic agent composition

---

### REQ-02: Composable Agent Builder
**Description:** Build agents by composing skills from the registry

**Acceptance Criteria:**
- [ ] Agents can be defined as composition of 1+ skills
- [ ] Skill composition validates input/output compatibility
- [ ] Agents can be instantiated with specific skill configurations
- [ ] Composed agents integrate with existing `BaseAgent` class

**From Research:** Fractal composition pattern — agents as graphs of skills

---

### REQ-03: Domain Expert Agents
**Description:** Pre-built agents for common domains

**Acceptance Criteria:**
- [ ] Security Review Agent — analyzes code for vulnerabilities
- [ ] Performance Agent — identifies optimization opportunities
- [ ] Documentation Agent — generates/maintains docs
- [ ] Each domain agent uses composable skill system (REQ-02)

**From Research:** Specialized agents with explicit handoffs reduce "tool overload"

---

### REQ-04: Agent Testing Framework
**Description:** Testing utilities for agent behaviors

**Acceptance Criteria:**
- [x] Deterministic test mode for agent skills (mocked LLM responses)
- [ ] Evaluation harness for agent outputs (LLM-as-a-Judge pattern)
- [x] Test fixtures for common agent scenarios
- [x] Integration with existing Jest setup

**From Research:** Non-determinism requires simulation-based testing approaches

---

## Should Have (v1)

### REQ-05: Workflow Orchestration Patterns
**Description:** Built-in patterns for multi-agent coordination

**Acceptance Criteria:**
- [ ] Sequential pipeline pattern
- [ ] Parallel specialist pattern
- [ ] Supervisor-delegate pattern
- [ ] Patterns integrate with existing orchestrator

**From Research:** AG2's patterns (Group Chat, Swarm, Explicit Handoffs)

---

### REQ-06: Capability Conflict Detection
**Description:** Detect and resolve skill conflicts at composition time

**Acceptance Criteria:**
- [ ] Static analysis detects conflicting skill requirements
- [ ] Runtime conflict resolution with confidence scoring
- [ ] Hierarchical supervision for ambiguous cases
- [ ] Conflict reporting in agent registry

**From Research:** Five conflict types (result, resource, temporal, goal, overlap)

---

### REQ-07: Agent Performance Metrics
**Description:** Observability for agent execution

**Acceptance Criteria:**
- [ ] Track skill invocation counts and latency
- [ ] Agent-level success/failure rates
- [ ] Integration with existing persistence layer
- [ ] CLI command to view metrics

---

## Out of Scope (v1)

| Feature | Reason | Future Consideration |
|---------|--------|---------------------|
| MCP/A2A protocol support | Requires significant protocol implementation | v2 — external agent interoperability |
| Hot-reload of skills in production | Security complexity | v2 — sandboxed dynamic loading |
| Visual agent builder UI | CLI-first project | Separate project — web dashboard |
| Multi-language agent skills | TypeScript-only codebase | Not planned |

---

## Requirement Dependencies

```
REQ-01 (Skill Registry)
    ├── REQ-02 (Composable Builder) — depends on registry
    ├── REQ-06 (Conflict Detection) — analyzes registry contents
    └── REQ-07 (Metrics) — tracks registry usage

REQ-02 (Composable Builder)
    └── REQ-03 (Domain Experts) — built using composition

REQ-04 (Testing) — independent, parallel work
REQ-05 (Orchestration) — independent, parallel work
```

---

## Verification Criteria

All v1 requirements met when:
1. New security agent can find and report a known vulnerability pattern
2. Two skills can be composed into a new agent via registry
3. Agent test suite runs with deterministic outputs
4. Metrics show skill usage across agent instances

---

*Next: ROADMAP.md phase breakdown*
