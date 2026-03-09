"use strict";
/**
 * Unit tests for PLAN.md Parser
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("@/plan/parser");
describe('PlanParser', () => {
    describe('parsePlan', () => {
        it('should parse a valid PLAN.md with frontmatter', () => {
            const content = `---
phase: 01-foundation
plan: 01
type: execute
wave: 1
depends_on:
  - 01-00
files_modified:
  - src/test.ts
autonomous: true
requirements:
  - REQ-01
must_haves:
  truths:
    - Test truth 1
  artifacts:
    - path: src/test.ts
      provides: Test file
      exports: []
  key_links: []
---

<objective>
Test objective description
</objective>

<execution_context>
@test-context.md
</execution_context>

<context>
@/path/to/file.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Test task</name>
  <files>src/test.ts</files>
  <action>
    Do something
  </action>
  <verify>
    <automated>cat src/test.ts</automated>
  </verify>
  <done>Task is done</done>
</task>

</tasks>

<verification>
- [ ] Test verification
</verification>

<success_criteria>
Success criteria met
</success_criteria>

<output>
Output file created
</output>
`;
            const result = (0, parser_1.parsePlan)(content, 'test-plan.md');
            expect(result.success).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.plan).toBeDefined();
            if (result.plan) {
                expect(result.plan.metadata.phase).toBe('01-foundation');
                expect(result.plan.metadata.plan).toBe('01');
                expect(result.plan.metadata.type).toBe('execute');
                expect(result.plan.metadata.wave).toBe(1);
                expect(result.plan.metadata.depends_on).toContain('01-00');
                expect(result.plan.metadata.files_modified).toContain('src/test.ts');
                expect(result.plan.metadata.autonomous).toBe(true);
                expect(result.plan.metadata.requirements).toContain('REQ-01');
                expect(result.plan.mustHaves.truths).toContain('Test truth 1');
                expect(result.plan.objective).toContain('Test objective');
                expect(result.plan.executionContext).toContain('@test-context.md');
                expect(result.plan.context).toContain('/path/to/file.ts');
                expect(result.plan.tasks).toHaveLength(1);
                expect(result.plan.tasks[0].name).toBe('Task 1: Test task');
                expect(result.plan.tasks[0].files).toContain('src/test.ts');
                expect(result.plan.tasks[0].action).toContain('Do something');
                expect(result.plan.tasks[0].verify).toContain('cat src/test.ts');
                expect(result.plan.tasks[0].done).toBe('Task is done');
                expect(result.plan.verification).toContain('Test verification');
                expect(result.plan.successCriteria).toContain('Success criteria met');
                expect(result.plan.output).toContain('Output file created');
            }
        });
        it('should fail when frontmatter is missing', () => {
            const content = 'No frontmatter here';
            const result = (0, parser_1.parsePlan)(content);
            expect(result.success).toBe(false);
            expect(result.errors.some(e => e.code === 'MISSING_FRONTMATTER')).toBe(true);
        });
        it('should fail when frontmatter is unterminated', () => {
            const content = '---\nphase: test\n';
            const result = (0, parser_1.parsePlan)(content);
            expect(result.success).toBe(false);
            expect(result.errors.some(e => e.code === 'UNTERMINATED_FRONTMATTER')).toBe(true);
        });
        it('should warn when objective is missing', () => {
            const content = `---
phase: test
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
requirements: []
---

<tasks>
</tasks>
`;
            const result = (0, parser_1.parsePlan)(content);
            expect(result.warnings.some(w => w.code === 'MISSING_OBJECTIVE')).toBe(true);
        });
        it('should warn when no tasks are present', () => {
            const content = `---
phase: test
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
requirements: []
---

<objective>Test</objective>
`;
            const result = (0, parser_1.parsePlan)(content);
            expect(result.warnings.some(w => w.code === 'NO_TASKS')).toBe(true);
        });
        it('should parse multiple tasks', () => {
            const content = `---
phase: test
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
requirements: []
---

<objective>Test</objective>

<tasks>

<task type="auto">
  <name>First task</name>
  <files>file1.ts</files>
  <action>Action 1</action>
  <done>Done 1</done>
</task>

<task type="manual">
  <name>Second task</name>
  <files>file2.ts</files>
  <action>Action 2</action>
  <done>Done 2</done>
</task>

<task type="decision" tdd="true">
  <name>Third task</name>
  <files>file3.ts</files>
  <action>Action 3</action>
  <done>Done 3</done>
  <behavior>
    - Behavior 1
    - Behavior 2
  </behavior>
</task>

</tasks>
`;
            const result = (0, parser_1.parsePlan)(content);
            expect(result.success).toBe(true);
            expect(result.plan.tasks).toHaveLength(3);
            expect(result.plan.tasks[0].type).toBe('auto');
            expect(result.plan.tasks[0].tdd).toBeUndefined();
            expect(result.plan.tasks[1].type).toBe('manual');
            expect(result.plan.tasks[2].type).toBe('decision');
            expect(result.plan.tasks[2].tdd).toBe(true);
            expect(result.plan.tasks[2].behavior).toContain('Behavior 1');
            expect(result.plan.tasks[2].behavior).toContain('Behavior 2');
        });
        it('should parse task with multiple files', () => {
            const content = `---
phase: test
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
requirements: []
---

<objective>Test</objective>

<task type="auto">
  <name>Multi-file task</name>
  <files>
    file1.ts
    file2.ts
    file3.ts
  </files>
  <action>Action</action>
  <done>Done</done>
</task>
`;
            const result = (0, parser_1.parsePlan)(content);
            expect(result.success).toBe(true);
            expect(result.plan.tasks[0].files).toHaveLength(3);
            expect(result.plan.tasks[0].files).toContain('file1.ts');
            expect(result.plan.tasks[0].files).toContain('file2.ts');
            expect(result.plan.tasks[0].files).toContain('file3.ts');
        });
    });
    describe('PlanParser class', () => {
        it('should parse content using class method', () => {
            const parser = new parser_1.PlanParser();
            const content = `---
phase: test
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
requirements: []
---

<objective>Test</objective>
`;
            const result = parser.parse(content);
            expect(result.success).toBe(true);
            expect(result.plan).toBeDefined();
        });
        it('should parse file from path', async () => {
            const parser = new parser_1.PlanParser();
            // Create a temporary test file
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const path = await Promise.resolve().then(() => __importStar(require('path')));
            const os = await Promise.resolve().then(() => __importStar(require('os')));
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plan-test-'));
            const tempFile = path.join(tempDir, 'test-plan.md');
            const content = `---
phase: test
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
requirements: []
---

<objective>File test</objective>
`;
            await fs.writeFile(tempFile, content);
            try {
                const result = await parser.parseFile(tempFile);
                expect(result.success).toBe(true);
                expect(result.plan.objective).toContain('File test');
            }
            finally {
                await fs.unlink(tempFile);
                await fs.rmdir(tempDir);
            }
        });
    });
});
//# sourceMappingURL=parser.test.js.map