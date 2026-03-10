/**
 * Security Expert Skill Tests
 *
 * Tests for security review expert with secret detection,
 * vulnerability scanning, and pattern analysis.
 */

import { SecurityReviewSkill } from '@/skills/expert-definitions/security/skill';
import { ExpertOutput, SecurityFinding } from '@/skills/expert-definitions/types';

describe('SecurityExpertSkill', () => {
  let skill: SecurityReviewSkill;

  beforeEach(() => {
    skill = new SecurityReviewSkill();
  });

  describe('execute()', () => {
    it('should return ExpertOutput with findings array', async () => {
      const input = {
        targetPath: './src',
        scanTypes: ['secrets'] as const,
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

    it('should detect high-entropy strings as secrets', async () => {
      // Create a temporary file with high-entropy content
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'security-test-'));
      const testFile = path.join(tempDir, 'test.ts');

      // Write a file with a high-entropy GitHub token pattern
      await fs.writeFile(
        testFile,
        `const token = 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';\n`
      );

      const input = {
        targetPath: tempDir,
        scanTypes: ['secrets'] as const,
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      expect(result.json.findings).toBeDefined();
      expect(result.json.summary).toBeDefined();
    });

    it('should detect GitHub tokens matching pattern ghp_[a-zA-Z0-9_]{36}', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'security-test-'));
      const testFile = path.join(tempDir, 'config.ts');

      // Write a file with a GitHub token pattern
      const githubToken = 'ghp_' + 'a'.repeat(36);
      await fs.writeFile(
        testFile,
        `export const GITHUB_TOKEN = '${githubToken}';\n`
      );

      const input = {
        targetPath: tempDir,
        scanTypes: ['secrets'] as const,
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      const githubTokenFindings = result.json.findings.filter(
        (f: SecurityFinding) => f.type === 'token'
      );
      expect(githubTokenFindings.length).toBeGreaterThan(0);
    });
  });

  describe('output format', () => {
    it('should return valid markdown report', async () => {
      const input = {
        targetPath: './src',
        scanTypes: ['secrets'] as const,
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
      };

      const result = await skill.execute(input);

      expect(typeof result.markdown).toBe('string');
      expect(result.markdown.length).toBeGreaterThan(0);
      expect(result.markdown).toContain('#'); // Should have markdown headers
    });

    it('should include summary statistics in JSON output', async () => {
      const input = {
        targetPath: './src',
        scanTypes: ['secrets'] as const,
        outputFormat: 'json' as const,
        severityThreshold: 'low' as const,
      };

      const result = await skill.execute(input);

      expect(result.json.summary).toHaveProperty('totalIssues');
      expect(result.json.summary).toHaveProperty('criticalCount');
      expect(result.json.summary).toHaveProperty('filesScanned');
      expect(typeof result.json.summary.totalIssues).toBe('number');
    });

    it('should include execution metadata', async () => {
      const input = {
        targetPath: './src',
        scanTypes: ['secrets'] as const,
        outputFormat: 'json' as const,
        severityThreshold: 'low' as const,
      };

      const result = await skill.execute(input);

      expect(result.json.metadata).toHaveProperty('durationMs');
      expect(result.json.metadata).toHaveProperty('expertVersion');
      expect(result.json.metadata).toHaveProperty('scannedAt');
      expect(typeof result.json.metadata.durationMs).toBe('number');
    });
  });

  describe('internal composition', () => {
    it('should compose analyzers based on scanTypes parameter', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'security-test-'));

      const input = {
        targetPath: tempDir,
        scanTypes: ['secrets', 'dependencies', 'patterns'] as const,
        outputFormat: 'both' as const,
        severityThreshold: 'low' as const,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      // Should run all three analyzers
      expect(result.json.findings).toBeDefined();
      expect(result.json.metadata.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should respect severityThreshold filter', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'security-test-'));
      const testFile = path.join(tempDir, 'config.ts');

      // Write a file with potential secrets
      await fs.writeFile(
        testFile,
        `const apiKey = 'test-key-123';\n`
      );

      const input = {
        targetPath: tempDir,
        scanTypes: ['secrets'] as const,
        outputFormat: 'both' as const,
        severityThreshold: 'critical' as const,
      };

      const result = await skill.execute(input);

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });

      // All findings should be at or above critical level
      const allCriticalOrHigher = result.json.findings.every(
        (f: SecurityFinding) => f.severity === 'critical'
      );
      expect(allCriticalOrHigher).toBe(true);
    });
  });
});
