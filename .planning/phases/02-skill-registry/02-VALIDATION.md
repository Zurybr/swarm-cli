---
phase: 2
slug: skill-registry
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x |
| **Config file** | jest.config.ts (from Phase 1) |
| **Quick run command** | `npm test -- --testPathPattern="skill"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="{pattern}"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | REQ-01 | unit | `npm test -- --testPathPattern="skill-registry"` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | REQ-01 | unit | `npm test -- --testPathPattern="skill"` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | REQ-01 | unit | `npm test -- --testPathPattern="sqlite"` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | REQ-01 | unit | `npm test -- --testPathPattern="cli"` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | REQ-01 | integration | `npm test -- --testPathPattern="integration"` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 3 | REQ-01 | integration | `npm test -- --testPathPattern="e2e"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/skills/skill-registry.ts` — skill registry implementation
- [ ] `src/skills/skill.ts` — skill metadata types
- [ ] `tests/unit/skills/skill-registry.test.ts` — registry tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CLI command `skill register` works interactively | REQ-01 | Requires user input | Run `npm run cli -- skill register` and verify prompt flow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
