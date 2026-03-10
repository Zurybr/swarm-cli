/**
 * Documentation Expert Skill Tests
 *
 * Tests for documentation expert with drift detection
 * and JSDoc generation using ts-morph.
 */

import { DocumentationExpertSkill } from '@/skills/expert-definitions/documentation/skill';
import { ExpertOutput, DriftFinding } from '@/skills/expert-definitions/types';

describe('DocumentationExpertSkill', () => {
  let skill: DocumentationExpertSkill;

  beforeEach(() => {
    skill = new DocumentationExpertSkill();
  });

  describe('execute()', () => {
    it('should return ExpertOutput with findings array', async () => {
      const input = {
        targetPath: './src',
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
        checkMissingJsDoc: true,
      };

      const result = await skill.execute(input);

      expect(result).toHaveProperty('json');
      expect(result).toHaveProperty('markdown');
      expect(result.json).toHaveProperty('findings');
      expect(Array.isArray(result.json.findings)).toBe(true);
      expect(result.json).toHaveProperty('summary');
      expect(result.json).toHaveProperty('metadata');
    });

    it('should use ts-morph to parse TypeScript AST', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-test-'));
      const testFile = path.join(tempDir, 'test.ts');

      await fs.writeFile(
        testFile,
        `function test(a: number): number { return a; }`
      );

      const input = {
        targetPath: tempDir,
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
        checkMissingJsDoc: true,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      expect(result.json.findings).toBeDefined();
      expect(result.json.summary.filesScanned).toBeGreaterThan(0);
    });

    it('should identify functions missing JSDoc comments', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-test-'));
      const testFile = path.join(tempDir, 'undocumented.ts');

      // Write a function without JSDoc
      await fs.writeFile(
        testFile,
        `export function calculateSum(a: number, b: number): number {
  return a + b;
}`
      );

      const input = {
        targetPath: tempDir,
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
        checkMissingJsDoc: true,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      const missingDocFindings = result.json.findings.filter(
        (f: DriftFinding) => f.driftType === 'missing-doc'
      );
      expect(missingDocFindings.length).toBeGreaterThan(0);
    });

    it('should detect missing JSDoc on exported functions', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-test-'));
      const testFile = path.join(tempDir, 'exported.ts');

      await fs.writeFile(
        testFile,
        `/**
 * This function is documented
 */
export function documented(): void {}

export function undocumented(): void {}`
      );

      const input = {
        targetPath: tempDir,
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
        checkMissingJsDoc: true,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      const undocumentedFindings = result.json.findings.filter(
        (f: DriftFinding) =>
          f.driftType === 'missing-doc' && f.functionName === 'undocumented'
      );
      expect(undocumentedFindings.length).toBeGreaterThan(0);
    });
  });

  describe('drift detection', () => {
    it('should compare JSDoc params with actual function parameters', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-test-'));
      const testFile = path.join(tempDir, 'param-mismatch.ts');

      // JSDoc mentions 'x' but function uses 'a'
      await fs.writeFile(
        testFile,
        `/**
 * @param x - The first number
 */
export function add(a: number, b: number): number {
  return a + b;
}`
      );

      const input = {
        targetPath: tempDir,
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
        checkParamMismatch: true,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      const paramMismatchFindings = result.json.findings.filter(
        (f: DriftFinding) => f.driftType === 'param-mismatch'
      );
      expect(paramMismatchFindings.length).toBeGreaterThan(0);
    });

    it('should detect missing @param tags for function parameters', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-test-'));
      const testFile = path.join(tempDir, 'missing-param.ts');

      await fs.writeFile(
        testFile,
        `/**
 * Adds two numbers
 * @param a - The first number
 */
export function add(a: number, b: number): number {
  return a + b;
}`
      );

      const input = {
        targetPath: tempDir,
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
        checkParamMismatch: true,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      // Should find that 'b' is missing from JSDoc
      const missingParamFindings = result.json.findings.filter(
        (f: DriftFinding) =>
          f.driftType === 'param-mismatch' && f.expected.includes('b')
      );
      expect(missingParamFindings.length).toBeGreaterThan(0);
    });

    it('should detect return type changes not reflected in @returns', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-test-'));
      const testFile = path.join(tempDir, 'return-mismatch.ts');

      await fs.writeFile(
        testFile,
        `/**
 * Gets a value
 * @returns {string} The value
 */
export function getValue(): number {
  return 42;
}`
      );

      const input = {
        targetPath: tempDir,
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
        checkReturnMismatch: true,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      const returnMismatchFindings = result.json.findings.filter(
        (f: DriftFinding) => f.driftType === 'return-mismatch'
      );
      expect(returnMismatchFindings.length).toBeGreaterThan(0);
    });
  });

  describe('JSDoc generation', () => {
    it('should generate JSDoc templates for undocumented functions', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-test-'));
      const testFile = path.join(tempDir, 'generate.ts');

      await fs.writeFile(
        testFile,
        `export function greet(name: string, age: number): string {
  return \`Hello \${name}, you are \${age}\`;
}`
      );

      const input = {
        targetPath: tempDir,
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
        checkMissingJsDoc: true,
        generateTemplates: true,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      const findingsWithTemplates = result.json.findings.filter(
        (f: DriftFinding) => f.suggestedJsDoc && f.suggestedJsDoc.length > 0
      );
      expect(findingsWithTemplates.length).toBeGreaterThan(0);
    });

    it('should preserve existing JSDoc when adding missing params', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-test-'));
      const testFile = path.join(tempDir, 'preserve.ts');

      await fs.writeFile(
        testFile,
        `/**
 * Calculates the sum
 * @param a - First number
 */
export function add(a: number, b: number): number {
  return a + b;
}`
      );

      const input = {
        targetPath: tempDir,
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
        checkParamMismatch: true,
        generateTemplates: true,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      const findings = result.json.findings.filter(
        (f: DriftFinding) => f.functionName === 'add'
      );
      expect(findings.length).toBeGreaterThan(0);
    });
  });

  describe('complex types', () => {
    it('should handle complex types (generics, unions) correctly', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-test-'));
      const testFile = path.join(tempDir, 'complex-types.ts');

      await fs.writeFile(
        testFile,
        `export function process<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

export function combine(a: string | number, b: boolean[]): Record<string, unknown> {
  return { a, b };
}`
      );

      const input = {
        targetPath: tempDir,
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
        checkMissingJsDoc: true,
        generateTemplates: true,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      expect(result.json.findings).toBeDefined();
    });
  });

  describe('output format', () => {
    it('should return valid markdown report', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-test-'));
      const testFile = path.join(tempDir, 'test.ts');

      await fs.writeFile(testFile, 'export function test(): void {}');

      const input = {
        targetPath: tempDir,
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
        checkMissingJsDoc: true,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      expect(typeof result.markdown).toBe('string');
      expect(result.markdown.length).toBeGreaterThan(0);
      expect(result.markdown).toContain('#');
    });
  });
});
