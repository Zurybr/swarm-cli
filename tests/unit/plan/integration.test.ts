/**
 * Integration tests for PLAN.md system
 * Tests the full workflow: parse -> validate -> execute
 */

import { PlanParser, PlanValidator, PlanExecutor } from '@/plan';

describe('PLAN.md Integration', () => {
  const samplePlan = `---
phase: 01-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/types.ts
  - src/parser.ts
autonomous: true
requirements:
  - REQ-01
must_haves:
  truths:
    - Parser extracts all sections correctly
    - Validation catches structural errors
    - Execution follows dependency order
  artifacts:
    - path: src/types.ts
      provides: TypeScript interfaces
      exports: [Plan, PlanTask]
  key_links:
    - from: parser.ts
      to: types.ts
      via: import
---

<objective>
Implement a PLAN.md parser that can extract structured data from markdown files.
This includes parsing frontmatter, tasks, and verification sections.
</objective>

<execution_context>
@/workflows/execute-plan.md
</execution_context>

<context>
@/src/plan/types.ts
@/src/plan/parser.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Define type interfaces</name>
  <files>src/types.ts</files>
  <action>
    Create TypeScript interfaces for Plan, PlanTask, and related types.
    Include all fields from the PLAN.md specification.
  </action>
  <verify>
    <automated>cat src/types.ts | grep -q "interface Plan"</automated>
  </verify>
  <done>Types are defined and exported</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement parser</name>
  <files>src/parser.ts</files>
  <action>
    Implement the parsePlan function that reads PLAN.md content
    and returns a structured Plan object.
  </action>
  <verify>
    <automated>npm test -- parser.test.ts</automated>
  </verify>
  <done>Parser passes all tests</done>
  <behavior>
    - Parser extracts frontmatter correctly
    - Parser handles missing fields gracefully
    - Parser validates required sections
  </behavior>
</task>

<task type="manual">
  <name>Task 3: Review implementation</name>
  <files>src/types.ts, src/parser.ts</files>
  <action>
    Review the implementation for code quality and correctness.
    Check for edge cases and error handling.
  </action>
  <done>Code review completed</done>
</task>

</tasks>

<verification>
- [ ] All types are properly defined
- [ ] Parser handles all PLAN.md sections
- [ ] Tests cover edge cases
- [ ] Documentation is complete
</verification>

<success_criteria>
The PLAN.md parser is complete and can parse all existing plan files
in the .planning directory without errors.
</success_criteria>

<output>
Create .planning/phases/01-foundation/01-01-SUMMARY.md
</output>
`;

  describe('Full workflow', () => {
    it('should parse, validate, and execute a complete plan', async () => {
      const parser = new PlanParser();
      const validator = new PlanValidator();
      const executor = new PlanExecutor();

      // Parse
      const parseResult = parser.parse(samplePlan, 'test-plan.md');
      expect(parseResult.success).toBe(true);
      expect(parseResult.plan).toBeDefined();

      // Validate
      const validationResult = validator.validate(parseResult.plan!);
      expect(validationResult.valid).toBe(true);
      expect(validationResult.dependencies.ordered.length).toBeGreaterThan(0);

      // Execute (dry-run)
      const execResult = await executor.execute(parseResult.plan!, {
        workingDir: '/tmp',
        env: {},
        dryRun: true,
        options: {
          stopOnFailure: true,
          maxConcurrency: 1,
          taskTimeout: 5000,
          captureOutput: true,
        },
      });

      expect(execResult.state).toBe('completed');
      expect(execResult.taskResults.length).toBe(3);
    });

    it('should detect validation errors in invalid plans', async () => {
      const invalidPlan = `---
phase: test
plan: 01
type: invalid-type
wave: 0
depends_on:
  - bad-format
files_modified: []
autonomous: false
requirements:
  - bad-req
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>Test</objective>

<tasks>
<task type="invalid">
  <name></name>
  <files></files>
  <action></action>
  <done></done>
</task>
</tasks>
`;

      const parser = new PlanParser();
      const validator = new PlanValidator();

      const parseResult = parser.parse(invalidPlan);
      expect(parseResult.success).toBe(true);

      const validationResult = validator.validate(parseResult.plan!);
      expect(validationResult.valid).toBe(false);

      // Check for specific errors
      expect(validationResult.errors.some(e => e.code === 'INVALID_PLAN_TYPE')).toBe(true);
      expect(validationResult.errors.some(e => e.code === 'INVALID_WAVE_NUMBER')).toBe(true);
      expect(validationResult.errors.some(e => e.code === 'INVALID_TASK_TYPE')).toBe(true);
      expect(validationResult.errors.some(e => e.code === 'MISSING_TASK_NAME')).toBe(true);
      expect(validationResult.errors.some(e => e.code === 'MISSING_TASK_ACTION')).toBe(true);

      // Check for warnings
      expect(validationResult.warnings.some(w => w.code === 'INVALID_DEPENDENCY_FORMAT')).toBe(true);
      expect(validationResult.warnings.some(w => w.code === 'INVALID_REQUIREMENT_FORMAT')).toBe(true);
      expect(validationResult.warnings.some(w => w.code === 'NO_TRUTHS')).toBe(true);
    });

    it('should track progress during execution', async () => {
      const parser = new PlanParser();
      const executor = new PlanExecutor();

      const parseResult = parser.parse(samplePlan);
      expect(parseResult.success).toBe(true);

      const progressEvents: { type: string; percent: number }[] = [];

      await executor.execute(parseResult.plan!, {
        workingDir: '/tmp',
        env: {},
        dryRun: true,
        options: {
          stopOnFailure: true,
          maxConcurrency: 1,
          taskTimeout: 5000,
          captureOutput: true,
        },
      }, (event) => {
        progressEvents.push({ type: event.type, percent: event.percent });
      });

      // Verify progress events
      expect(progressEvents.some(e => e.type === 'start')).toBe(true);
      expect(progressEvents.some(e => e.type === 'complete')).toBe(true);

      // Progress should increase
      const percents = progressEvents.map(e => e.percent);
      expect(Math.max(...percents)).toBe(100);
    });
  });

  describe('Real plan files', () => {
    it('should parse existing 01-01-PLAN.md', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const planPath = path.join(process.cwd(), '.planning/phases/01-foundation/01-01-PLAN.md');

      // Skip if file doesn't exist (for CI environments)
      try {
        await fs.access(planPath);
      } catch {
        console.log('Skipping: 01-01-PLAN.md not found');
        return;
      }

      const content = await fs.readFile(planPath, 'utf-8');
      const parser = new PlanParser();
      const validator = new PlanValidator();

      const parseResult = parser.parse(content, planPath);
      expect(parseResult.success).toBe(true);
      expect(parseResult.plan).toBeDefined();

      const validationResult = validator.validate(parseResult.plan!);
      expect(validationResult.valid).toBe(true);

      // Verify structure
      expect(parseResult.plan!.metadata.phase).toBe('01-foundation');
      expect(parseResult.plan!.metadata.plan).toBe('01');
      expect(parseResult.plan!.tasks.length).toBeGreaterThan(0);
    });

    it('should parse existing 01-02-PLAN.md', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const planPath = path.join(process.cwd(), '.planning/phases/01-foundation/01-02-PLAN.md');

      try {
        await fs.access(planPath);
      } catch {
        console.log('Skipping: 01-02-PLAN.md not found');
        return;
      }

      const content = await fs.readFile(planPath, 'utf-8');
      const parser = new PlanParser();

      const parseResult = parser.parse(content, planPath);
      expect(parseResult.success).toBe(true);
      expect(parseResult.plan!.tasks.some(t => t.tdd)).toBe(true);
    });
  });
});
