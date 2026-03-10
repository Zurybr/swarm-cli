---
phase: 04-domain-expert-agents
plan: 01
subsystem: skills

tags: [typescript, ts-morph, typhonjs-escomplex, jest, tdd, security, performance, documentation]

# Dependency graph
requires:
  - phase: 03-composable-builder
    provides: AgentBuilder, ComposedAgent, SkillChain patterns for expert composition
provides:
  - SecurityReviewSkill with secret detection, vulnerability scanning, pattern analysis
  - PerformanceExpertSkill with complexity analysis using typhonjs-escomplex
  - DocumentationExpertSkill with drift detection using ts-morph
  - Dual output format (JSON + Markdown) for all experts
  - Monolithic skill pattern with internal composition
affects:
  - phase-05-orchestration
  - phase-07-observability

tech-stack:
  added:
    - typhonjs-escomplex: Complexity metrics (cyclomatic, Halstead, maintainability)
    - ts-morph: TypeScript AST manipulation for documentation analysis
  patterns:
    - Monolithic skills with parameter-driven internal composition
    - Dual output format (JSON for machines, Markdown for humans)
    - Wave 0 TDD with failing test stubs before implementation

key-files:
  created:
    - src/skills/expert-definitions/types.ts: Shared types for all experts
    - src/skills/expert-definitions/security/skill.ts: SecurityReviewSkill implementation
    - src/skills/expert-definitions/security/analyzers/secrets.ts: Entropy-based secret detection
    - src/skills/expert-definitions/security/analyzers/vulnerabilities.ts: CVE scanning
    - src/skills/expert-definitions/security/analyzers/patterns.ts: Insecure pattern detection
    - src/skills/expert-definitions/performance/skill.ts: PerformanceExpertSkill implementation
    - src/skills/expert-definitions/performance/analyzers/complexity.ts: typhonjs-escomplex integration
    - src/skills/expert-definitions/performance/analyzers/bottlenecks.ts: Threshold-based detection
    - src/skills/expert-definitions/documentation/skill.ts: DocumentationExpertSkill implementation
    - src/skills/expert-definitions/documentation/analyzers/drift.ts: ts-morph drift detection
    - src/skills/expert-definitions/documentation/analyzers/generator.ts: JSDoc template generation
    - src/skills/expert-definitions/index.ts: Public API exports
    - tests/unit/skills/expert-definitions/security-expert.test.ts: Security tests (8 tests)
    - tests/unit/skills/expert-definitions/performance-expert.test.ts: Performance tests (9 tests)
    - tests/unit/skills/expert-definitions/documentation-expert.test.ts: Documentation tests (11 tests)
  modified: []

key-decisions:
  - "Used monolithic skill pattern with internal composition via scanTypes parameter"
  - "Implemented dual output format (JSON + Markdown) for all three experts"
  - "Used typhonjs-escomplex programmatic API instead of CLI for better error handling"
  - "Used ts-morph instead of raw TypeScript compiler API for simpler AST manipulation"
  - "Applied Wave 0 TDD - created failing tests before implementation"

patterns-established:
  - "Monolithic Skill: One skill class per expert with internal analyzer composition"
  - "Internal Composition: Parameter-driven analyzer selection (e.g., scanTypes: ['secrets', 'dependencies'])"
  - "Dual Output: Every expert returns { json: structuredData, markdown: reportString }"
  - "Wave 0 TDD: Create failing test stubs, then implement to make them pass"

requirements-completed: [REQ-03]

# Metrics
duration: 45min
completed: 2026-03-10
---

# Phase 04 Plan 01: Domain Expert Agents Summary

**Three domain expert skills (Security, Performance, Documentation) with dual output format, internal composition, and 28 passing tests using typhonjs-escomplex and ts-morph**

## Performance

- **Duration:** 45 min
- **Started:** 2026-03-10T19:15:00Z
- **Completed:** 2026-03-10T20:00:00Z
- **Tasks:** 5
- **Files Created:** 14

## Accomplishments

- Security Review Skill with entropy-based secret detection (GitHub tokens, AWS keys, etc.)
- Performance Expert Skill with cyclomatic complexity and Halstead metrics via typhonjs-escomplex
- Documentation Expert Skill with JSDoc drift detection via ts-morph AST analysis
- Dual output format (JSON + Markdown) implemented consistently across all experts
- 28 unit tests covering all three expert domains

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Wave 0 test stubs and shared types** - `1ccfe39` (test)
2. **Task 2: Implement Security Review Skill with analyzers** - `e4b97b4` (feat)
3. **Task 3: Implement Performance Expert Skill with analyzers** - `3a8fc35` (feat)
4. **Task 4: Implement Documentation Expert Skill with analyzers** - `de8cfc4` (feat)
5. **Task 5: Create index.ts exports and verify all tests pass** - `57302b6` (feat)

## Files Created

### Core Types
- `src/skills/expert-definitions/types.ts` - ExpertOutput, ExpertTaskInput, BaseExpertSkill, and domain-specific types

### Security Expert
- `src/skills/expert-definitions/security/skill.ts` - SecurityReviewSkill with internal composition
- `src/skills/expert-definitions/security/analyzers/secrets.ts` - Entropy-based secret detection with regex patterns
- `src/skills/expert-definitions/security/analyzers/vulnerabilities.ts` - Dependency CVE scanning
- `src/skills/expert-definitions/security/analyzers/patterns.ts` - SQL injection, XSS, eval() detection

### Performance Expert
- `src/skills/expert-definitions/performance/skill.ts` - PerformanceExpertSkill with complexity analysis
- `src/skills/expert-definitions/performance/analyzers/complexity.ts` - typhonjs-escomplex integration
- `src/skills/expert-definitions/performance/analyzers/bottlenecks.ts` - Threshold-based bottleneck detection

### Documentation Expert
- `src/skills/expert-definitions/documentation/skill.ts` - DocumentationExpertSkill with drift detection
- `src/skills/expert-definitions/documentation/analyzers/drift.ts` - ts-morph AST-based signature comparison
- `src/skills/expert-definitions/documentation/analyzers/generator.ts` - JSDoc template generation

### Exports
- `src/skills/expert-definitions/index.ts` - Public API exports organized by domain

### Tests
- `tests/unit/skills/expert-definitions/security-expert.test.ts` - 8 tests
- `tests/unit/skills/expert-definitions/performance-expert.test.ts` - 9 tests
- `tests/unit/skills/expert-definitions/documentation-expert.test.ts` - 11 tests

## Decisions Made

- **Monolithic skills with internal composition**: Each expert is a single skill class that internally composes analyzers based on task input parameters (e.g., `scanTypes: ['secrets', 'dependencies']`). This keeps the external API simple while allowing flexible internal behavior.

- **Dual output format**: All experts return both structured JSON (for programmatic use by agency agents) and Markdown (for human-readable CLI output). This satisfies the requirement that experts complement agency agents.

- **Programmatic APIs over CLI**: Used typhonjs-escomplex and ts-morph programmatic APIs instead of spawning external CLI processes. This provides better error handling, performance, and control.

- **Wave 0 TDD**: Created failing test stubs before implementation, following the RED-GREEN-REFACTOR pattern. This ensured test coverage from the start.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed typhonjs-escomplex import and API usage**
- **Found during:** Task 3 (Performance Expert implementation)
- **Issue:** Initial import `import * as escomplex from 'typhonjs-escomplex'` didn't work correctly with ts-jest. Also, the API uses `methods` not `functions` in the report.
- **Fix:** Changed to default import `import escomplex from 'typhonjs-escomplex'` and updated code to use `report.methods` instead of `report.functions`.
- **Files modified:** `src/skills/expert-definitions/performance/analyzers/complexity.ts`
- **Verification:** Performance tests pass after fix
- **Committed in:** `3a8fc35` (Task 3 commit)

**2. [Rule 1 - Bug] Fixed test token entropy in security tests**
- **Found during:** Task 2 (Security Expert implementation)
- **Issue:** Test used `ghp_` + 'a'.repeat(36) which has very low entropy and was filtered out by the entropy threshold.
- **Fix:** Changed test token to use mixed characters with high entropy.
- **Files modified:** `tests/unit/skills/expert-definitions/security-expert.test.ts`
- **Verification:** Security tests pass after fix
- **Committed in:** `e4b97b4` (Task 2 commit)

**3. [Rule 3 - Blocking] Updated tests to use temp directories**
- **Found during:** Task 3 and 4 (Performance and Documentation tests)
- **Issue:** Tests using `./src` as target path were timing out (5s+ Jest timeout) because they scanned the entire source tree.
- **Fix:** Changed tests to create temp directories with minimal test files.
- **Files modified:** `tests/unit/skills/expert-definitions/performance-expert.test.ts`, `tests/unit/skills/expert-definitions/documentation-expert.test.ts`
- **Verification:** All tests now complete in under 20 seconds
- **Committed in:** `3a8fc35` and `de8cfc4` (Task 3 and 4 commits)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All fixes necessary for correctness and test performance. No scope creep.

## Issues Encountered

- **typhonjs-escomplex module structure**: The module uses CommonJS exports and the report structure uses `methods` instead of `functions`. Required debugging to understand the API.

- **ts-morph project setup**: Initial attempts to create a Project without proper file discovery failed. Fixed by using `project.addSourceFilesAtPaths()` with glob patterns.

- **Test timeouts**: Initial tests using `./src` as target caused 5+ second timeouts. Fixed by using temp directories with minimal files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three expert skills are implemented and tested
- Dual output format working for all experts
- Foundation ready for CLI integration (Phase 04-02) and Agency Agent integration (Phase 05)
- REQ-03 (Domain expert agents) is complete

---

*Phase: 04-domain-expert-agents*
*Completed: 2026-03-10*
