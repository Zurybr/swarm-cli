---
phase: 04-domain-expert-agents
plan: 03
type: execute
wave: 3
subsystem: expert-definitions
tags: [cli, integration, security, performance, documentation]
dependencies:
  requires: [04-01, 04-02]
  provides: [04-04]
tech-stack:
  added: [commander, chalk]
  patterns: [cli-command-pattern, lazy-initialization]
key-files:
  created:
    - src/skills/expert-definitions/cli/commands/security-scan.ts
    - src/skills/expert-definitions/cli/commands/perf-analyze.ts
    - src/skills/expert-definitions/cli/commands/doc-check.ts
    - src/skills/expert-definitions/cli/index.ts
    - src/cli/skill-registry.ts
    - src/cli/agent-builder.ts
    - tests/integration/expert-cli.test.ts
    - tests/fixtures/sample-code/vulnerable.ts
    - tests/fixtures/sample-code/complex.ts
    - tests/fixtures/sample-code/undocumented.ts
  modified:
    - src/cli/index.ts
decisions:
  - "CLI commands use lazy initialization via getSkillRegistry() and getAgentBuilder() utilities"
  - "Exit code 1 on critical findings enables CI integration patterns"
  - "Tests register skills in beforeEach to satisfy ExpertAPI validation requirements"
metrics:
  duration: 45
  completed-date: "2026-03-10"
---

# Phase 04 Plan 03: Expert CLI Commands and Integration Tests

## Summary

Implemented three CLI commands (`security-scan`, `perf-analyze`, `doc-check`) providing human-friendly access to expert capabilities. Created integration tests with sample code fixtures to verify end-to-end workflows from CLI through ExpertAPI to skills.

## What Was Built

### CLI Commands

1. **security-scan**: Scan code for security vulnerabilities and secrets
   - Options: `--severity`, `--format`, `--scan-types`
   - Supports secrets, dependencies, and patterns scanning
   - Exit code 1 on critical findings for CI integration

2. **perf-analyze**: Analyze code complexity and identify performance bottlenecks
   - Options: `--threshold-cyclomatic`, `--threshold-maintainability`, `--threshold-length`
   - Uses cyclomatic complexity, Halstead metrics, maintainability index
   - Outputs Markdown tables for complexity metrics

3. **doc-check**: Check documentation coverage and detect drift
   - Options: `--check-drift`, `--generate`, `--format`
   - Detects missing JSDoc, parameter mismatches, return type mismatches
   - Generates JSDoc templates for undocumented functions

### Infrastructure

- **cli/index.ts**: Registration module exporting `registerExpertCommands()`
- **cli/skill-registry.ts**: Lazy initialization singleton for SkillRegistry
- **cli/agent-builder.ts**: Factory for AgentBuilder instances
- **src/cli/index.ts**: Integrated expert commands into main CLI

### Test Fixtures

- **vulnerable.ts**: Hardcoded secrets (GitHub tokens, AWS keys), SQL injection, eval usage
- **complex.ts**: High cyclomatic complexity functions, long functions (>50 lines), nested logic
- **undocumented.ts**: Missing JSDoc, parameter mismatches, wrong return types

### Integration Tests

19 tests covering:
- Command existence and argument handling
- Security scanning with secret detection
- Performance analysis with threshold options
- Documentation checking with drift detection
- Output formats (json, markdown, both)
- End-to-end workflows

## Test Results

```
PASS tests/integration/expert-cli.test.ts
  Expert CLI Integration
    CLI command existence and arguments
      ✓ should have security-scan command that accepts path argument
      ✓ should have perf-analyze command that accepts path argument
      ✓ should have doc-check command that accepts path argument
    security-scan command
      ✓ should detect secrets in vulnerable.ts
      ✓ should support --format json flag
      ✓ should support --severity threshold flag
    perf-analyze command
      ✓ should identify complex functions in complex.ts
      ✓ should support threshold options
      ✓ should output complexity metrics in Markdown table format
    doc-check command
      ✓ should find missing JSDoc in undocumented.ts
      ✓ should detect drift between code and documentation
      ✓ should support --generate flag for JSDoc templates
    CLI output formats
      ✓ should output Markdown by default
      ✓ should output JSON when --format json specified
      ✓ should output both formats when --format both specified
    CLI exit codes
      ✓ should indicate critical findings in output
    End-to-end workflows
      ✓ should complete full security scan workflow
      ✓ should complete full performance analysis workflow
      ✓ should complete full documentation check workflow

Test Suites: 1 passed, 1 total
Tests:       19 passed, 19 total
```

Total expert-related tests: **99 passed**

## Commits

1. `17c49a2` - test(04-03): add integration test stubs and sample fixtures
2. `d341724` - feat(04-03): implement expert CLI commands and registration
3. `f2686d2` - test(04-03): update integration tests with skill registration setup

## Key Design Decisions

### Lazy Initialization Pattern
CLI commands use `getSkillRegistry()` and `getAgentBuilder()` utilities to avoid startup overhead. Database connections are established on first use and cleaned up on process exit.

### Exit Codes for CI Integration
All commands exit with code 1 when critical findings are detected, enabling integration with CI/CD pipelines:
```bash
swarm security-scan ./src || echo "Critical security issues found"
```

### Test Setup Strategy
Tests register required skills in `beforeEach` to satisfy ExpertAPI validation. This ensures the tests work with the actual ExpertAPI behavior rather than mocking it.

## Deviations from Plan

None - plan executed exactly as written.

## Known Limitations

- Performance analyzer uses `typhonjs-escomplex` which only supports JavaScript, not TypeScript
- Documentation analyzer uses `ts-morph` which requires TypeScript files to be parseable
- Security analyzer pattern detection is regex-based and may have false positives

## Verification

- [x] CLI command 'swarm security-scan <path>' works with all options
- [x] CLI command 'swarm perf-analyze <path>' works with threshold options
- [x] CLI command 'swarm doc-check <path>' works with drift and generation options
- [x] All commands output Markdown by default, JSON with --format json
- [x] Integration tests verify complete CLI -> ExpertAPI -> Skill workflows
- [x] Exit codes support CI integration patterns (1 on critical findings)
