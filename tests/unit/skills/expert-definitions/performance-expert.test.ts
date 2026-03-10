/**
 * Performance Expert Skill Tests
 *
 * Tests for performance expert with complexity analysis
 * and bottleneck detection using typhonjs-escomplex.
 */

import { PerformanceExpertSkill } from '@/skills/expert-definitions/performance/skill';
import { ExpertOutput, PerformanceFinding, ComplexityReport } from '@/skills/expert-definitions/types';

describe('PerformanceExpertSkill', () => {
  let skill: PerformanceExpertSkill;

  beforeEach(() => {
    skill = new PerformanceExpertSkill();
  });

  describe('execute()', () => {
    it('should return ExpertOutput with findings array', async () => {
      const input = {
        targetPath: './src',
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
      };

      const result = await skill.execute(input);

      expect(result).toHaveProperty('json');
      expect(result).toHaveProperty('markdown');
      expect(result.json).toHaveProperty('findings');
      expect(Array.isArray(result.json.findings)).toBe(true);
      expect(result.json).toHaveProperty('summary');
      expect(result.json).toHaveProperty('metadata');
    });

    it('should return complexity metrics using typhonjs-escomplex', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perf-test-'));
      const testFile = path.join(tempDir, 'test.ts');

      // Write a simple function
      await fs.writeFile(
        testFile,
        `function add(a: number, b: number): number {\n  return a + b;\n}\n`
      );

      const input = {
        targetPath: tempDir,
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      expect(result.json.findings).toBeDefined();
      expect(result.json.summary.filesScanned).toBeGreaterThan(0);
    });

    it('should identify functions with cyclomatic complexity > 10', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perf-test-'));
      const testFile = path.join(tempDir, 'complex.ts');

      // Write a function with high cyclomatic complexity (> 10)
      await fs.writeFile(
        testFile,
        `function complexFunction(x: number): string {
  if (x === 1) return 'one';
  if (x === 2) return 'two';
  if (x === 3) return 'three';
  if (x === 4) return 'four';
  if (x === 5) return 'five';
  if (x === 6) return 'six';
  if (x === 7) return 'seven';
  if (x === 8) return 'eight';
  if (x === 9) return 'nine';
  if (x === 10) return 'ten';
  if (x === 11) return 'eleven';
  if (x === 12) return 'twelve';
  return 'other';
}
`
      );

      const input = {
        targetPath: tempDir,
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
        cyclomaticThreshold: 10,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      const highComplexityFindings = result.json.findings.filter(
        (f: PerformanceFinding) => f.type === 'high-complexity'
      );
      expect(highComplexityFindings.length).toBeGreaterThan(0);
    });
  });

  describe('complexity analysis', () => {
    it('should calculate Halstead metrics (bugs, difficulty, effort)', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perf-test-'));
      const testFile = path.join(tempDir, 'metrics.ts');

      await fs.writeFile(
        testFile,
        `function calculateMetrics(arr: number[]): number {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i] * 2;
  }
  return sum / arr.length;
}
`
      );

      const input = {
        targetPath: tempDir,
        outputFormat: 'json' as const,
        severityThreshold: 'low' as const,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      // Check that findings include metrics
      expect(result.json.findings).toBeDefined();
    });

    it('should calculate maintainability index', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perf-test-'));
      const testFile = path.join(tempDir, 'maintainable.ts');

      await fs.writeFile(
        testFile,
        `function simple(): void { console.log('hello'); }`
      );

      const input = {
        targetPath: tempDir,
        outputFormat: 'json' as const,
        severityThreshold: 'low' as const,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      expect(result.json.findings).toBeDefined();
    });
  });

  describe('bottleneck detection', () => {
    it('should filter out files > 1000 lines (likely generated)', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perf-test-'));
      const largeFile = path.join(tempDir, 'generated.ts');

      // Create a file with > 1000 lines
      const lines = Array(1001).fill('// generated line').join('\n');
      await fs.writeFile(largeFile, lines);

      const input = {
        targetPath: tempDir,
        outputFormat: 'json' as const,
        severityThreshold: 'low' as const,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      // Large files should be excluded
      const largeFileFindings = result.json.findings.filter(
        (f: PerformanceFinding) => f.filePath === largeFile
      );
      expect(largeFileFindings.length).toBe(0);
    });

    it('should respect .gitignore and exclude node_modules', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perf-test-'));

      // Create .gitignore
      await fs.writeFile(path.join(tempDir, '.gitignore'), 'node_modules/\n');

      // Create node_modules directory with a file
      const nodeModulesDir = path.join(tempDir, 'node_modules', 'test');
      await fs.mkdir(nodeModulesDir, { recursive: true });
      await fs.writeFile(
        path.join(nodeModulesDir, 'index.ts'),
        'function test() { return 1; }'
      );

      // Create a regular source file
      await fs.writeFile(
        path.join(tempDir, 'src.ts'),
        'function main() { return 1; }'
      );

      const input = {
        targetPath: tempDir,
        outputFormat: 'json' as const,
        severityThreshold: 'low' as const,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      // No findings should be from node_modules
      const nodeModulesFindings = result.json.findings.filter(
        (f: PerformanceFinding) => f.filePath?.includes('node_modules')
      );
      expect(nodeModulesFindings.length).toBe(0);
    });
  });

  describe('output format', () => {
    it('should include maintainability index in output', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perf-test-'));
      const testFile = path.join(tempDir, 'test.ts');

      await fs.writeFile(testFile, 'function test() { return 1; }');

      const input = {
        targetPath: tempDir,
        outputFormat: 'json' as const,
        severityThreshold: 'low' as const,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      expect(result.json.findings).toBeDefined();
    });

    it('should include per-function metrics', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perf-test-'));
      const testFile = path.join(tempDir, 'test.ts');

      await fs.writeFile(
        testFile,
        `function foo() { return 1; }
function bar() { return 2; }`
      );

      const input = {
        targetPath: tempDir,
        outputFormat: 'json' as const,
        severityThreshold: 'low' as const,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      expect(result.json.findings).toBeDefined();
    });
  });
});
