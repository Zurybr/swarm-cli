---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x |
| **Config file** | jest.config.js (exists) |
| **Quick run command** | `npm test -- --testPathPattern="skill"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="{pattern}"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | REQ-04 | unit | `npm test -- --testPathPattern="skill.test"` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | REQ-04 | unit | `npm test -- --testPathPattern="fixture"` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | REQ-04 | unit | `npm test -- --testPathPattern="guard"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/agents/testing/skill-test.ts` — skill test harness
- [ ] `src/agents/testing/fixtures/` — mock LLM response fixtures
- [ ] `src/agents/testing/guards.ts` — security guardrails base

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Security guard blocks unsafe operation | REQ-04 | Requires intentional unsafe code attempt | Run `examples/test-guard.ts` and verify error thrown |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
