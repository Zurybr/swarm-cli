---
phase: 04-domain-expert-agents
plan: 02
subsystem: skills

tags: [typescript, jest, tdd, expert-agents, agency-agents, api]

# Dependency graph
requires:
  - phase: 04-domain-expert-agents
    plan: 01
    provides: SecurityReviewSkill, PerformanceExpertSkill, DocumentationExpertSkill
provides:
  - ExpertAgent interface extending AgencyAgent
  - ExpertDefinition type with skill factory
  - Three expert definitions (security, performance, documentation)
  - ExpertAPI class for hybrid CLI/internal invocation
  - Agency agent integration pattern (securityEngineer)
affects:
  - phase-05-orchestration
  - src/agents/definitions/agency-agents.ts

tech-stack:
  added: []
  patterns:
    - ExpertAgent extends AgencyAgent with expert-specific fields
    - Factory pattern for skill creation via createSkill()
    - Type guards for runtime type checking
    - ExpertAPI for programmatic expert invocation

key-files:
  created:
    - src/skills/expert-definitions/expert-agent.ts: ExpertAgent interface, ExpertDefinition type, type guards
    - src/skills/expert-definitions/security/definition.ts: securityExpert definition
    - src/skills/expert-definitions/performance/definition.ts: performanceExpert definition
    - src/skills/expert-definitions/documentation/definition.ts: documentationExpert definition
    - src/skills/expert-definitions/api.ts: ExpertAPI class for invocation
    - tests/unit/skills/expert-definitions/expert-definitions.test.ts: 32 tests for interfaces and definitions
    - tests/unit/skills/expert-definitions/expert-api.test.ts: 20 tests for ExpertAPI
  modified:
    - src/agents/definitions/agency-agents.ts: Updated securityEngineer to show expert integration
    - src/skills/expert-definitions/index.ts: Added new exports
    - tests/unit/skills/expert-definitions/expert-definitions.test.ts: Updated to match actual skill IDs

key-decisions:
  - "ExpertAgent extends AgencyAgent: Maintains backward compatibility while adding expert-specific fields"
  - "Factory pattern: ExpertDefinition includes createSkill() for lazy skill instantiation"
  - "Skill registry validation: ExpertAPI validates skills are registered before invocation"
  - "Agency agents USE experts: securityEngineer references security-expert as a tool"
  - "Dual output format preserved: Experts maintain JSON + Markdown output from Plan 01"

patterns-established:
  - "Expert-Agent Relationship: Agency agents invoke experts via ExpertAPI as specialized tools"
  - "Factory Pattern: createSkill() enables lazy instantiation and dependency injection"
  - "Type Guards: isExpertAgent() and hasCapability() for runtime type safety"
  - "Registry Validation: ExpertAPI.validateSkillsAvailability() ensures skills are registered"

requirements-completed: [REQ-03]

# Metrics
duration: 35min
completed: 2026-03-10
---

# Phase 04 Plan 02: ExpertAgent Definitions and ExpertAPI Summary

**ExpertAgent interface extending AgencyAgent with three expert definitions and ExpertAPI for hybrid CLI/internal invocation**

## Performance

- **Duration:** 35 min
- **Started:** 2026-03-10T20:16:00Z
- **Completed:** 2026-03-10T20:51:00Z
- **Tasks:** 6
- **Files Created:** 7
- **Files Modified:** 3

## Accomplishments

- ExpertAgent interface extending AgencyAgent with skills[], capabilities[], expertiseLevel, outputFormats
- ExpertDefinition type combining ExpertAgent with createSkill() factory
- Type guards: isExpertAgent(), hasCapability(), getExpertsByCapability(), getExpertsByLevel()
- Three expert definitions:
  - securityExpert: id='security-expert', division='Security', skills=['security-review']
  - performanceExpert: id='perf-expert', division='Engineering', skills=['performance-expert']
  - documentationExpert: id='doc-expert', division='Documentation', skills=['documentation-expert']
- ExpertAPI class with invokeExpert(), skill validation, error handling, and duration tracking
- Agency agent integration pattern: securityEngineer updated to reference security-expert
- 52 new tests (32 for definitions, 20 for API) all passing
- Full test suite: 80 tests passing across 5 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Wave 0 test stubs** - `c04bdca` (test)
2. **Task 2: Implement ExpertAgent interface** - `443fe20` (feat)
3. **Task 3: Implement three expert definitions** - `4909b63` (feat)
4. **Task 4: Implement ExpertAPI** - `cf0c928` (feat)
5. **Task 5: Integrate with securityEngineer** - `0d394ff` (feat)
6. **Task 6: Update exports and verify tests** - `acde8ac` (feat)

## Files Created

### Core Types
- `src/skills/expert-definitions/expert-agent.ts` - ExpertAgent interface, ExpertDefinition type, type guards
- `src/skills/expert-definitions/api.ts` - ExpertAPI class for hybrid invocation

### Expert Definitions
- `src/skills/expert-definitions/security/definition.ts` - securityExpert definition
- `src/skills/expert-definitions/performance/definition.ts` - performanceExpert definition
- `src/skills/expert-definitions/documentation/definition.ts` - documentationExpert definition

### Tests
- `tests/unit/skills/expert-definitions/expert-definitions.test.ts` - 32 tests for interfaces and definitions
- `tests/unit/skills/expert-definitions/expert-api.test.ts` - 20 tests for ExpertAPI

## Files Modified

- `src/agents/definitions/agency-agents.ts` - Updated securityEngineer to show expert integration pattern
- `src/skills/expert-definitions/index.ts` - Added exports for new types, API, and definitions

## Decisions Made

- **ExpertAgent extends AgencyAgent**: Maintains backward compatibility with existing agency agent system while adding expert-specific fields (skills[], capabilities[], expertiseLevel, outputFormats).

- **Factory pattern for skill creation**: ExpertDefinition includes a createSkill() factory function enabling lazy instantiation and dependency injection. This keeps expert definitions lightweight until skills are actually needed.

- **Skill registry validation**: ExpertAPI validates that required skills are registered before invocation, throwing descriptive errors if skills are missing.

- **Agency agents USE experts**: The securityEngineer agency agent references security-expert as a tool in its workflow. This demonstrates the pattern: agency agents orchestrate work and delegate specialized analysis to experts.

- **Type guards for runtime safety**: isExpertAgent() validates objects at runtime, hasCapability() checks for specific capabilities, enabling dynamic expert selection.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed skill ID mismatch in tests**
- **Found during:** Task 3 (expert definition tests)
- **Issue:** Tests expected skill IDs 'performance-analysis' and 'documentation-review' but actual skill IDs are 'performance-expert' and 'documentation-expert'
- **Fix:** Updated tests to match actual skill IDs from 04-01 implementation
- **Files modified:** `tests/unit/skills/expert-definitions/expert-definitions.test.ts`
- **Committed in:** `4909b63` (Task 3 commit)

**2. [Rule 3 - Blocking] Fixed ExpertAPI tests for skill registry validation**
- **Found during:** Task 4 (ExpertAPI implementation)
- **Issue:** Tests failed because mock SkillRegistry returned undefined, causing validation to throw
- **Fix:** Updated tests to use temp directories and proper mock setup
- **Files modified:** `tests/unit/skills/expert-definitions/expert-api.test.ts`
- **Committed in:** `cf0c928` (Task 4 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** All fixes necessary for correctness. No scope creep.

## Issues Encountered

- **Skill ID consistency**: The skill IDs from 04-01 ('performance-expert', 'documentation-expert') differed from the expected IDs in the 04-02 plan. Updated tests to match actual implementation.

- **Test timeouts**: Initial ExpertAPI tests using './src' as target caused timeouts. Fixed by using temp directories with minimal test files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ExpertAgent interface and type definitions complete
- Three expert definitions with factory functions
- ExpertAPI providing programmatic access to experts
- Agency agent integration pattern demonstrated
- REQ-03 (Domain expert agents) is complete
- Foundation ready for Phase 05 (Orchestration patterns)

---

*Phase: 04-domain-expert-agents*
*Completed: 2026-03-10*
