---
phase: 3
slug: composable-builder
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npm test -- --testPathPattern="agent-builder"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="agent-builder"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 03-01-01 | 01 | 1 | REQ-02 | unit | `npm test -- --testPathPattern="agent-builder"` | ⬜ pending |
| 03-01-02 | 01 | 1 | REQ-02 | unit | `npm test -- --testPathPattern="schema-validator"` | ⬜ pending |
| 03-02-01 | 02 | 2 | REQ-02 | unit | `npm test -- --testPathPattern="composed-agent"` | ⬜ pending |
| 03-02-02 | 02 | 2 | REQ-02 | integration | `npm test -- --testPathPattern="agent-execution"` | ⬜ pending |
| 03-03-01 | 03 | 3 | REQ-02 | integration | `npm test -- --testPathPattern="agent-cli"` | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `tests/unit/agents/agent-builder.test.ts` — stubs for AgentBuilder
- [ ] `tests/unit/agents/schema-validator.test.ts` — stubs for schema validation
- [ ] `tests/integration/agent-execution.test.ts` — stubs for execution tests

*Existing Jest infrastructure from Phase 1 covers all requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CLI `agent build` output formatting | REQ-02 | Terminal UI verification | Run `swarm agent build --help` and verify formatting |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
