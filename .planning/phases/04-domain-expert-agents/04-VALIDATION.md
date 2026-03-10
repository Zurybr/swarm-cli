---
phase: 04
slug: domain-expert-agents
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x (existing) |
| **Config file** | `jest.config.ts` (existing) |
| **Quick run command** | `npm test -- --testPathPattern="expert" --testNamePattern="unit"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="expert" --testNamePattern="unit"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | REQ-03 | unit | `npm test -- security-expert` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | REQ-03 | unit | `npm test -- performance-expert` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | REQ-03 | unit | `npm test -- documentation-expert` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | REQ-03 | unit | `npm test -- expert-definitions` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | REQ-03 | integration | `npm test -- expert-integration` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | REQ-03 | unit | `npm test -- expert-cli` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/skills/expert-definitions/` — test directory for expert agents
- [ ] `tests/unit/skills/security-expert.test.ts` — stubs for security expert
- [ ] `tests/unit/skills/performance-expert.test.ts` — stubs for performance expert
- [ ] `tests/unit/skills/documentation-expert.test.ts` — stubs for documentation expert
- [ ] `tests/fixtures/sample-code/` — sample code for testing analysis

*Test stubs created in Wave 0, implemented during plan waves.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real CVE detection | REQ-03 | Requires live npm audit API | Run security expert on test project with known vulnerable dependency |
| Documentation drift UX | REQ-03 | Requires human judgment | Review generated Markdown report for clarity |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
