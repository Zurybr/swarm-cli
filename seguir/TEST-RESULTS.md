# Test Suite Results Report

**Generated:** 2026-03-11  
**Test Runner:** Jest  
**Execution Time:** 74.691s

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Test Suites** | 107 |
| **Passed Suites** | 96 |
| **Failed Suites** | 11 |
| **Total Tests** | 2203 |
| **Passed Tests** | 2193 |
| **Failed Tests** | 10 |
| **Pass Rate** | 99.5% |

---

## Failed Tests Details

### 1. Milestone Tracking Test
**File:** `src/gsd/__tests__/milestone.test.ts`  
**Test:** `Milestone Tracking › canCompleteMilestone › should allow completion when all phases complete`

```
Expected: true
Received: false

at line 359: expect(result.canComplete).toBe(true);
```

**Analysis:** The `canCompleteMilestone` function is returning `false` when it should return `true` for a milestone with all phases complete. Possible issues:
- Phase completion check logic may have a bug
- Status field comparison may be case-sensitive
- Missing required fields in test data

---

### 2. Coverage Manager Test
**File:** `src/tdd/__tests__/coverage.test.ts`  
**Test:** `CoverageManager › getAllReports › should return all reports`

```
Expected: 2
Received: 1

at line 101: expect(reports.length).toBe(2);
```

**Analysis:** The `getAllReports()` method returns fewer reports than expected. Possible issues:
- Report storage not persisting correctly
- Second report not being added to the internal collection
- Test isolation issue (reports from previous tests affecting count)

---

### 3. Swarm Manager Test
**File:** `src/orchestration/__tests__/swarm.test.ts`  
**Test:** `SwarmManager › registerAgent › should get agents by type`

```
Expected length: 2
Received length: 1
Received array: [executor agent]

at line 68: expect(executors).toHaveLength(2);
```

**Analysis:** The `getAgentsByType('executor')` returns only 1 agent when 2 were registered. Possible issues:
- Second agent registration failed silently
- Agent type filtering has a bug
- Agent was overwritten instead of added

---

### 4. GSD CLI Test Suite
**File:** `src/gsd/__tests__/cli.test.ts`  
**Error:** `SyntaxError: Cannot use import statement outside a module`

```
at src/gsd/cli.ts:10:1
import chalk from 'chalk';
```

**Analysis:** ESM module resolution issue with `chalk` package. Jest is not correctly transforming the ES module.

**Recommendation:** 
- Update Jest configuration to handle ESM modules
- Or downgrade chalk to a CommonJS compatible version
- Add `chalk` to `transformIgnorePatterns` in Jest config

---

### 5. Expert API Test (Timeout)
**File:** `tests/unit/skills/expert-definitions/expert-api.test.ts`  
**Test:** `ExpertAPI › invokeExpert › should return ExpertOutput for valid doc-expert`

**Error:** Exceeded timeout of 5000 ms

**Analysis:** The expert invocation is taking longer than 5 seconds. Possible causes:
- Slow file I/O operations
- Large file processing
- External dependency latency

---

### 6. Expert CLI Integration Test (Timeout)
**File:** `tests/integration/expert-cli.test.ts`  
**Test:** `Expert CLI Integration › doc-check command › should find missing JSDoc in undocumented.ts`

**Error:** Exceeded timeout of 5000 ms

**Analysis:** Same root cause as #5 - expert invocation is slow.

---

### 7. Documentation Expert Test (Timeout)
**File:** `tests/unit/skills/expert-definitions/documentation-expert.test.ts`  
**Test:** `DocumentationExpertSkill › execute() › should return ExpertOutput with findings array`

**Error:** Exceeded timeout of 5000 ms

**Analysis:** Documentation expert skill is taking too long to execute.

---

### 8-9. GSD Tests (Worker Process Terminated)
**Files:**
- `src/gsd/__tests__/project.test.ts`
- `src/gsd/__tests__/index.test.ts`

**Error:** `Jest worker process (pid=XXXXX) was terminated by signal=SIGTERM`

**Analysis:** Jest worker processes were killed, likely due to:
- Memory exhaustion
- System resource limits
- Timeout at the process level

---

## Warnings

### ts-jest Deprecation Warning
The `ts-jest` config option `isolatedModules` is deprecated.

**Recommendation:** Move `isolatedModules: true` to `tsconfig.json` instead of Jest config.

---

## Coverage

Coverage collection was not enabled for this run. To get coverage data, run:
```bash
npm test -- --coverage
```

---

## Recommendations

### High Priority
1. **Fix chalk ESM issue** - Blocks GSD CLI tests
2. **Increase test timeouts** for expert-related tests (set to 30000ms)
3. **Investigate memory usage** for GSD tests that crash workers

### Medium Priority
4. **Fix milestone completion logic** in `canCompleteMilestone`
5. **Fix coverage report storage** in `CoverageManager`
6. **Fix agent type filtering** in `SwarmManager.getAgentsByType`

### Low Priority
7. **Update ts-jest config** to remove deprecation warning

---

## Passed Test Suites (96)

The following areas have all tests passing:
- Verification system (goal, checker, must-have, report, index)
- Wave execution and scheduling
- Context management (injector, filter, analyzer, compress)
- Metaprompts (registry, injector, optimizer, index)
- TDD cycle and generator
- Agent system (router, permissions, metaprompts, index)
- Swarm Mail (reservations, notifications, mailbox)
- Kanban (index, dragdrop)
- Orchestration messaging
- Security guardrails
- And many more...
