/**
 * Tests for Fix Plan Generator (Issue #18)
 */

import { FixPlanGenerator, generateFixPlansFromResults, FixPlan, FixEntry } from '../fix-plan';
import { Gap, VerificationResult, GapSeverity } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

describe('FixPlanGenerator', () => {
  let generator: FixPlanGenerator;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'fix-plan-test-'));
    generator = new FixPlanGenerator({
      outputDir: tempDir,
      phase: 'test-phase',
    });
  });

  afterEach(async () => {
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('generateFixPlan', () => {
    it('should generate a fix plan for a single gap', () => {
      const gap: Gap = {
        id: 'gap-1',
        description: 'File not found: src/components/Chat.tsx',
        severity: 'critical',
        mustHaveId: 'mh-1',
        goalId: 'goal-1',
        expected: 'src/components/Chat.tsx',
        actual: undefined,
        blocking: true,
        identifiedAt: new Date(),
      };

      const fixPlan = generator.generateFixPlan(gap);

      expect(fixPlan).toBeDefined();
      expect(fixPlan.phase).toBe('test-phase');
      expect(fixPlan.plan).toMatch(/^fix-\d{3}$/);
      expect(fixPlan.type).toBe('execute');
      expect(fixPlan.wave).toBe(1);
      expect(fixPlan.fixes).toHaveLength(1);
      expect(fixPlan.metadata).toBeDefined();
      expect(fixPlan.metadata?.goalId).toBe('goal-1');
    });

    it('should include fix entry with suggested action', () => {
      const gap: Gap = {
        id: 'gap-1',
        description: 'Export "Chat" not found',
        severity: 'major',
        mustHaveId: 'mh-1',
        goalId: 'goal-1',
        expected: 'Chat',
        actual: undefined,
        blocking: false,
        identifiedAt: new Date(),
      };

      const fixPlan = generator.generateFixPlan(gap);
      const fix = fixPlan.fixes[0];

      expect(fix.verification_item).toBe('Chat');
      expect(fix.gap).toBe('Export "Chat" not found');
      expect(fix.suggested_action).toContain('Add missing export');
      expect(fix.priority).toBe('high');
    });

    it('should use remediation steps when available', () => {
      const gap: Gap = {
        id: 'gap-1',
        description: 'Missing validation',
        severity: 'major',
        mustHaveId: 'mh-1',
        goalId: 'goal-1',
        expected: 'Input validation',
        actual: 'No validation',
        remediation: ['Add zod schema', 'Validate in route handler'],
        blocking: false,
        identifiedAt: new Date(),
      };

      const fixPlan = generator.generateFixPlan(gap);
      
      expect(fixPlan.fixes[0].suggested_action).toContain('Add zod schema');
      expect(fixPlan.fixes[0].suggested_action).toContain('Validate in route handler');
    });
  });

  describe('generateFixPlans', () => {
    it('should generate fix plans for verification results with gaps', () => {
      const result: VerificationResult = {
        goalId: 'goal-1',
        achieved: false,
        completionPercentage: 50,
        mustHaveResults: [],
        gaps: [
          {
            id: 'gap-1',
            description: 'Critical gap',
            severity: 'critical',
            mustHaveId: 'mh-1',
            goalId: 'goal-1',
            expected: 'something',
            blocking: true,
            identifiedAt: new Date(),
          },
          {
            id: 'gap-2',
            description: 'Major gap',
            severity: 'major',
            mustHaveId: 'mh-2',
            goalId: 'goal-1',
            expected: 'else',
            blocking: false,
            identifiedAt: new Date(),
          },
        ],
        stats: {
          totalMustHaves: 2,
          satisfied: 1,
          failed: 1,
          pending: 0,
          criticalGaps: 1,
          majorGaps: 1,
          minorGaps: 0,
          weightedSatisfaction: 0.5,
        },
        verifiedAt: new Date(),
        duration: 100,
        method: 'backward',
      };

      const fixPlans = generator.generateFixPlans([result]);

      expect(fixPlans).toHaveLength(2); // One for critical, one for major
      expect(fixPlans.some(p => p.plan.includes('critical'))).toBe(true);
      expect(fixPlans.some(p => p.plan.includes('major'))).toBe(true);
    });

    it('should not generate plans for results without gaps', () => {
      const result: VerificationResult = {
        goalId: 'goal-1',
        achieved: true,
        completionPercentage: 100,
        mustHaveResults: [],
        gaps: [],
        stats: {
          totalMustHaves: 2,
          satisfied: 2,
          failed: 0,
          pending: 0,
          criticalGaps: 0,
          majorGaps: 0,
          minorGaps: 0,
          weightedSatisfaction: 1,
        },
        verifiedAt: new Date(),
        duration: 100,
        method: 'backward',
      };

      const fixPlans = generator.generateFixPlans([result]);

      expect(fixPlans).toHaveLength(0);
    });

    it('should assign wave numbers based on severity', () => {
      const result: VerificationResult = {
        goalId: 'goal-1',
        achieved: false,
        completionPercentage: 0,
        mustHaveResults: [],
        gaps: [
          {
            id: 'gap-1',
            description: 'Critical',
            severity: 'critical',
            mustHaveId: 'mh-1',
            goalId: 'goal-1',
            expected: 'critical',
            blocking: true,
            identifiedAt: new Date(),
          },
          {
            id: 'gap-2',
            description: 'Major',
            severity: 'major',
            mustHaveId: 'mh-2',
            goalId: 'goal-1',
            expected: 'major',
            blocking: false,
            identifiedAt: new Date(),
          },
          {
            id: 'gap-3',
            description: 'Minor',
            severity: 'minor',
            mustHaveId: 'mh-3',
            goalId: 'goal-1',
            expected: 'minor',
            blocking: false,
            identifiedAt: new Date(),
          },
        ],
        stats: {
          totalMustHaves: 3,
          satisfied: 0,
          failed: 3,
          pending: 0,
          criticalGaps: 1,
          majorGaps: 1,
          minorGaps: 1,
          weightedSatisfaction: 0,
        },
        verifiedAt: new Date(),
        duration: 100,
        method: 'backward',
      };

      const fixPlans = generator.generateFixPlans([result]);

      const criticalPlan = fixPlans.find(p => p.plan.includes('critical'));
      const majorPlan = fixPlans.find(p => p.plan.includes('major'));
      const minorPlan = fixPlans.find(p => p.plan.includes('minor'));

      expect(criticalPlan?.wave).toBe(1);
      expect(majorPlan?.wave).toBe(2);
      expect(minorPlan?.wave).toBe(3);
    });
  });

  describe('exportToYAML', () => {
    it('should export fix plan to valid YAML format', () => {
      const gap: Gap = {
        id: 'gap-1',
        description: 'Missing file',
        severity: 'critical',
        mustHaveId: 'mh-1',
        goalId: 'goal-1',
        expected: 'src/app.ts',
        blocking: true,
        identifiedAt: new Date(),
      };

      const fixPlan = generator.generateFixPlan(gap);
      const yaml = generator.exportToYAML(fixPlan);

      expect(yaml).toContain('---');
      expect(yaml).toContain('phase: test-phase');
      expect(yaml).toContain('type: execute');
      expect(yaml).toContain('fixes:');
      expect(yaml).toContain('verification_item:');
      expect(yaml).toContain('gap:');
      expect(yaml).toContain('suggested_action:');
    });

    it('should include metadata when present', () => {
      const gap: Gap = {
        id: 'gap-1',
        description: 'Missing file',
        severity: 'critical',
        mustHaveId: 'mh-1',
        goalId: 'goal-1',
        expected: 'src/app.ts',
        blocking: true,
        identifiedAt: new Date(),
      };

      const fixPlan = generator.generateFixPlan(gap);
      const yaml = generator.exportToYAML(fixPlan);

      expect(yaml).toContain('metadata:');
      expect(yaml).toContain('createdAt:');
      expect(yaml).toContain('goalId:');
    });
  });

  describe('saveFixPlan', () => {
    it('should save fix plan to file', async () => {
      const gap: Gap = {
        id: 'gap-1',
        description: 'Missing file',
        severity: 'critical',
        mustHaveId: 'mh-1',
        goalId: 'goal-1',
        expected: 'src/app.ts',
        blocking: true,
        identifiedAt: new Date(),
      };

      const fixPlan = generator.generateFixPlan(gap);
      const savedPath = await generator.saveFixPlan(fixPlan);

      expect(savedPath).toContain('fix-001-PLAN.md');
      
      const content = await fs.readFile(savedPath, 'utf-8');
      expect(content).toContain('---');
      expect(content).toContain('phase: test-phase');
    });

    it('should create output directory if it does not exist', async () => {
      const newDir = path.join(tempDir, 'nested', 'dir');
      const gap: Gap = {
        id: 'gap-1',
        description: 'Missing file',
        severity: 'critical',
        mustHaveId: 'mh-1',
        goalId: 'goal-1',
        expected: 'src/app.ts',
        blocking: true,
        identifiedAt: new Date(),
      };

      const fixPlan = generator.generateFixPlan(gap);
      const savedPath = await generator.saveFixPlan(fixPlan, newDir);

      const stats = await fs.stat(newDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('generateSummary', () => {
    it('should generate a summary of fix plans', () => {
      const gap1: Gap = {
        id: 'gap-1',
        description: 'Critical gap',
        severity: 'critical',
        mustHaveId: 'mh-1',
        goalId: 'goal-1',
        expected: 'critical',
        blocking: true,
        identifiedAt: new Date(),
      };

      const gap2: Gap = {
        id: 'gap-2',
        description: 'Major gap',
        severity: 'major',
        mustHaveId: 'mh-2',
        goalId: 'goal-1',
        expected: 'major',
        blocking: false,
        identifiedAt: new Date(),
      };

      const plan1 = generator.generateFixPlan(gap1);
      const plan2 = generator.generateFixPlan(gap2);

      const summary = generator.generateSummary([plan1, plan2]);

      expect(summary).toContain('Fix Plans Summary');
      expect(summary).toContain('Total Plans: 2');
      expect(summary).toContain('Total Fixes: 2');
      expect(summary).toContain('By Priority');
      expect(summary).toContain('Estimated Effort');
    });
  });

  describe('estimateTotalEffort', () => {
    it('should calculate effort based on priorities', () => {
      const result: VerificationResult = {
        goalId: 'goal-1',
        achieved: false,
        completionPercentage: 0,
        mustHaveResults: [],
        gaps: [
          {
            id: 'gap-1',
            description: 'Critical',
            severity: 'critical',
            mustHaveId: 'mh-1',
            goalId: 'goal-1',
            expected: 'critical',
            blocking: true,
            identifiedAt: new Date(),
          },
          {
            id: 'gap-2',
            description: 'Major',
            severity: 'major',
            mustHaveId: 'mh-2',
            goalId: 'goal-1',
            expected: 'major',
            blocking: false,
            identifiedAt: new Date(),
          },
        ],
        stats: {
          totalMustHaves: 2,
          satisfied: 0,
          failed: 2,
          pending: 0,
          criticalGaps: 1,
          majorGaps: 1,
          minorGaps: 0,
          weightedSatisfaction: 0,
        },
        verifiedAt: new Date(),
        duration: 100,
        method: 'backward',
      };

      const fixPlans = generator.generateFixPlans([result]);
      const effort = generator.estimateTotalEffort(fixPlans);

      // Critical = 8 hours, High = 4 hours
      expect(effort).toBe(12);
    });
  });

  describe('suggested actions', () => {
    it('should suggest creating file for missing file gap', () => {
      const gap: Gap = {
        id: 'gap-1',
        description: 'File not found: src/app.ts',
        severity: 'critical',
        mustHaveId: 'mh-1',
        goalId: 'goal-1',
        expected: 'src/app.ts',
        blocking: true,
        identifiedAt: new Date(),
      };

      const fixPlan = generator.generateFixPlan(gap);
      
      expect(fixPlan.fixes[0].suggested_action).toContain('Create missing file');
    });

    it('should suggest adding exports for export gaps', () => {
      const gap: Gap = {
        id: 'gap-1',
        description: 'Export "Chat" not found in Chat.tsx',
        severity: 'major',
        mustHaveId: 'mh-1',
        goalId: 'goal-1',
        expected: 'Chat',
        blocking: false,
        identifiedAt: new Date(),
      };

      const fixPlan = generator.generateFixPlan(gap);
      
      expect(fixPlan.fixes[0].suggested_action).toContain('Add missing export');
    });

    it('should suggest adding implementation for short files', () => {
      const gap: Gap = {
        id: 'gap-1',
        description: 'File too short: only 45 lines, expected 100+',
        severity: 'minor',
        mustHaveId: 'mh-1',
        goalId: 'goal-1',
        expected: '100+ lines',
        blocking: false,
        identifiedAt: new Date(),
      };

      const fixPlan = generator.generateFixPlan(gap);
      
      expect(fixPlan.fixes[0].suggested_action).toContain('error handling');
      expect(fixPlan.fixes[0].suggested_action).toContain('logging');
    });
  });
});

describe('generateFixPlansFromResults', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'fix-plan-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should generate and save fix plans in one call', async () => {
    const result: VerificationResult = {
      goalId: 'goal-1',
      achieved: false,
      completionPercentage: 50,
      mustHaveResults: [],
      gaps: [
        {
          id: 'gap-1',
          description: 'Critical gap',
          severity: 'critical',
          mustHaveId: 'mh-1',
          goalId: 'goal-1',
          expected: 'something',
          blocking: true,
          identifiedAt: new Date(),
        },
      ],
      stats: {
        totalMustHaves: 1,
        satisfied: 0,
        failed: 1,
        pending: 0,
        criticalGaps: 1,
        majorGaps: 0,
        minorGaps: 0,
        weightedSatisfaction: 0,
      },
      verifiedAt: new Date(),
      duration: 100,
      method: 'backward',
    };

    const { plans, savedPaths } = await generateFixPlansFromResults([result], {
      outputDir: tempDir,
      phase: 'test',
    });

    expect(plans).toHaveLength(1);
    expect(savedPaths).toHaveLength(1);
    
    const content = await fs.readFile(savedPaths[0], 'utf-8');
    expect(content).toContain('---');
  });
});
